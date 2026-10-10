import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { and, count, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { getSetting } from './auth.server'
import { items, orderItems, orders, payments, settings } from '../../db/schema.js'
import { FREE_SIZE } from '@/lib/catalog'
import { priceCart } from '@/lib/pricing'
import { PROOF_MAX_MB_DEFAULT, PROOF_MAX_MB_LIMIT, RELEASES_STOCK, normalizePhone } from '@/lib/orders'
import type { CartLine, CheckoutInput, OrderStatus } from '@/lib/orders'

/** A problem the customer can fix; its message is safe to show. Anything else is reported generically. */
export class CheckoutError extends Error {}

/* ---------- Payment settings ---------- */

export const PAYMENT_KEYS = [
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'bank_branch',
  'payment_qr',
  'payment_instructions',
  'payment_confirmation_message',
  'delivery_charge',
  'proof_max_mb',
] as const
export type PaymentKey = (typeof PAYMENT_KEYS)[number]
export type PaymentSettings = Record<PaymentKey, string>

const DEFAULT_DELIVERY = 100

export async function loadPaymentSettings(): Promise<PaymentSettings> {
  const rows = await db.select().from(settings).where(inArray(settings.key, [...PAYMENT_KEYS]))
  const found = new Map(rows.map((r) => [r.key, r.value]))
  const out = Object.fromEntries(PAYMENT_KEYS.map((k) => [k, found.get(k) ?? ''])) as PaymentSettings
  if (!found.has('delivery_charge')) out.delivery_charge = String(DEFAULT_DELIVERY)
  if (!found.has('proof_max_mb')) out.proof_max_mb = String(PROOF_MAX_MB_DEFAULT)
  return out
}

export const deliveryChargeOf = (s: PaymentSettings) => Math.max(0, Math.round(Number(s.delivery_charge)) || 0)
export const proofMaxBytes = (s: PaymentSettings) =>
  Math.min(PROOF_MAX_MB_LIMIT, Math.max(1, Number(s.proof_max_mb) || PROOF_MAX_MB_DEFAULT)) * 1024 * 1024

/** Checkout is only open once the owner has entered somewhere to pay. */
export const paymentConfigured = (s: PaymentSettings) => Boolean(s.payment_qr || (s.bank_name && s.bank_account_number))

/* ---------- Pricing (always from the database) ---------- */

export async function quoteCart(lines: CartLine[]) {
  const ids = [...new Set(lines.map((l) => l.id))]
  const [rows, payment] = await Promise.all([db.select().from(items).where(inArray(items.id, ids)), loadPaymentSettings()])
  return priceCart(lines, rows, deliveryChargeOf(payment))
}

/* ---------- Payment proofs (private Blob store) ---------- */

export const proofStore = () => getStore('payment-proofs')

/** Confirm the bytes really are the claimed type, so a renamed file can't slip through. */
export function sniffProof(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf'
  return null
}

/* ---------- Orders ---------- */

const NUMBER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function orderNumber() {
  const bytes = randomBytes(6)
  return `ALX-${Array.from(bytes, (b) => NUMBER_CHARS[b % NUMBER_CHARS.length]).join('')}`
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Add (or with sign -1, remove) an order's units from stock. Rows are locked so concurrent orders can't oversell. */
async function adjustStock(tx: Tx, lines: { itemId: number | null; size: string; quantity: number }[], sign: 1 | -1) {
  const ids = [...new Set(lines.map((l) => l.itemId).filter((x): x is number => x != null))]
  if (!ids.length) return
  const rows = await tx.select().from(items).where(inArray(items.id, ids)).for('update')
  for (const row of rows) {
    const stock = { ...row.stock }
    for (const l of lines.filter((x) => x.itemId === row.id)) {
      const next = (Number(stock[l.size]) || 0) + sign * l.quantity
      if (next < 0) {
        throw new CheckoutError(
          `Sorry — ${row.name}${l.size === FREE_SIZE ? '' : ` in size ${l.size}`} just sold out. Only ${Number(stock[l.size]) || 0} left.`,
        )
      }
      stock[l.size] = next
    }
    const soldOutSizes = row.sizes.filter((s) => !(Number(stock[s]) > 0))
    await tx.update(items).set({ stock, soldOutSizes }).where(eq(items.id, row.id))
  }
}

export type PlacedOrder = { number: string; token: string }

/**
 * Create the order, its lines and payment, and deduct stock — all in one transaction, priced from
 * locked product rows. Re-sending the same idempotency key returns the original order.
 */
export async function placeOrder(
  input: CheckoutInput,
  proof: { bytes: ArrayBuffer; type: string },
  clientIp: string,
): Promise<PlacedOrder> {
  const existing = await findByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing

  const phone = normalizePhone(input.customer.phone)!
  const clientHash = createHmac('sha256', (await getSetting('session_secret')) ?? 'auraluxe').update(clientIp).digest('hex').slice(0, 32)
  await checkRateLimit(clientHash, phone)

  const payment = await loadPaymentSettings()
  if (!paymentConfigured(payment)) throw new CheckoutError('Online checkout is not open yet. Please order on WhatsApp.')

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }[proof.type]
  const proofKey = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`
  await proofStore().set(proofKey, proof.bytes, { metadata: { type: proof.type } })

  const token = randomBytes(24).toString('base64url')
  const c = input.customer
  try {
    return await db.transaction(async (tx) => {
      const ids = [...new Set(input.lines.map((l) => l.id))]
      const rows = await tx.select().from(items).where(inArray(items.id, ids)).for('update')
      const quote = priceCart(input.lines, rows, deliveryChargeOf(payment))
      const problem = quote.lines.find((l) => l.error)
      if (problem) throw new CheckoutError(`${problem.name}: ${problem.error}`)

      let order: typeof orders.$inferSelect | undefined
      for (let attempt = 0; !order && attempt < 5; attempt++) {
        ;[order] = await tx
          .insert(orders)
          .values({
            number: orderNumber(),
            accessToken: token,
            idempotencyKey: input.idempotencyKey,
            customerName: c.name,
            phone,
            clientHash,
            email: c.email.toLowerCase(),
            address: c.address,
            city: c.city,
            area: c.area,
            landmark: c.landmark,
            subtotal: quote.subtotal,
            deliveryCharge: quote.deliveryCharge,
            discount: quote.discount,
            total: quote.total,
            paymentMethod: input.paymentMethod,
            paymentStatus: 'submitted',
            status: 'payment_verification',
          })
          .onConflictDoNothing({ target: orders.number })
          .returning()
      }
      if (!order) throw new Error('Could not allocate an order number')

      const lines = quote.lines.map((l) => ({
        orderId: order.id,
        itemId: l.id,
        name: l.name,
        image: l.image,
        size: l.sizeLabel,
        colour: l.colour ?? '',
        quantity: l.qty,
        unitPrice: l.unitPrice,
        listPrice: l.listPrice,
        lineTotal: l.lineTotal,
      }))
      await tx.insert(orderItems).values(lines)
      await tx.insert(payments).values({
        orderId: order.id,
        method: input.paymentMethod,
        amount: quote.total,
        status: 'pending',
        transactionId: input.transactionId,
        paymentDate: input.paymentDate,
        proofKey,
        proofType: proof.type,
      })
      await adjustStock(tx, lines, -1)
      return { number: order.number, token }
    })
  } catch (err) {
    await proofStore().delete(proofKey).catch(() => {})
    // A double-submit that raced past the first check hits the unique idempotency key
    const replay = await findByIdempotencyKey(input.idempotencyKey)
    if (replay) return replay
    throw err
  }
}

// Fake orders would hold stock until rejected, so cap how often one network or phone can order
const LIMIT_WINDOW_MS = 60 * 60 * 1000
const MAX_PER_CLIENT = 5
const MAX_PER_PHONE = 3

async function checkRateLimit(clientHash: string, phone: string) {
  const since = new Date(Date.now() - LIMIT_WINDOW_MS)
  const [[byClient], [byPhone]] = await Promise.all([
    db.select({ n: count() }).from(orders).where(and(eq(orders.clientHash, clientHash), gt(orders.createdAt, since))),
    db.select({ n: count() }).from(orders).where(and(eq(orders.phone, phone), gt(orders.createdAt, since))),
  ])
  if (byClient.n >= MAX_PER_CLIENT || byPhone.n >= MAX_PER_PHONE) {
    throw new CheckoutError('You’ve placed several orders in the last hour. Please message us on WhatsApp and we’ll help you complete this one.')
  }
}

async function findByIdempotencyKey(key: string) {
  const [row] = await db.select({ number: orders.number, token: orders.accessToken }).from(orders).where(eq(orders.idempotencyKey, key))
  return row ?? null
}

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** The customer's view of an order — only with the secret token from their confirmation link. */
export async function loadCustomerOrder(number: string, token: string) {
  const [order] = await db.select().from(orders).where(eq(orders.number, number))
  if (!order || !sameSecret(order.accessToken, token)) return null
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(orderItems.id)
  const { accessToken, idempotencyKey, adminNotes, stockReserved, clientHash, ...safe } = order
  return { order: safe, lines }
}

/* ---------- Admin ---------- */

export async function listOrders() {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      customerName: orders.customerName,
      phone: orders.phone,
      city: orders.city,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      status: orders.status,
      createdAt: orders.createdAt,
      pieces: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(300)
}

export async function loadAdminOrder(id: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id))
  if (!order) return null
  const [lines, pays] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.id),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt)),
  ])
  const { accessToken, idempotencyKey, clientHash, ...safe } = order
  return { order: safe, lines, payments: pays }
}

/**
 * Move an order to a new status. Cancelling or rejecting payment returns its units to stock;
 * moving such an order back into the pipeline reserves them again (failing if they've since sold).
 */
export async function setOrderStatus(id: number, status: OrderStatus) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for('update')
    if (!order) throw new CheckoutError('Order not found.')
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
    const release = RELEASES_STOCK.includes(status)
    if (release && order.stockReserved) await adjustStock(tx, lines, 1)
    if (!release && !order.stockReserved) await adjustStock(tx, lines, -1)

    const paymentStatus =
      status === 'payment_rejected' ? 'rejected' : status === 'payment_verified' ? 'verified' : order.paymentStatus
    await tx
      .update(orders)
      .set({ status, paymentStatus, stockReserved: !release, updatedAt: new Date() })
      .where(eq(orders.id, id))
    if (paymentStatus !== order.paymentStatus && (paymentStatus === 'verified' || paymentStatus === 'rejected')) {
      const [latest] = await tx.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt)).limit(1)
      if (latest) {
        await tx
          .update(payments)
          .set({ status: paymentStatus, reviewedAt: new Date() })
          .where(and(eq(payments.id, latest.id), eq(payments.orderId, id)))
      }
    }
  })
}

export async function setOrderNotes(id: number, notes: string) {
  await db.update(orders).set({ adminNotes: notes, updatedAt: new Date() }).where(eq(orders.id, id))
}
