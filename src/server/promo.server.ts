import { and, count, desc, eq, gt, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auditLog, offers, orders, settings } from '../../db/schema.js'
import type { Offer } from '../../db/schema.js'
import { RELEASES_STOCK } from '@/lib/orders'
import { DEFAULT_DELIVERY, FREE_DELIVERY_OFF, freeDeliveryLive, offerState } from '@/lib/promo'
import type { DeliveryRules, DeliveryZone, FreeDelivery, OfferRule, PublicOffer } from '@/lib/promo'
import type { PricingContext } from '@/lib/pricing'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Conn = typeof db | Tx

/* ---------- Delivery settings (settings rows: delivery_charge, delivery_zones, free_delivery) ---------- */

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function loadDeliverySettings(conn: Conn = db) {
  const rows = await conn.select().from(settings).where(inArray(settings.key, ['delivery_charge', 'delivery_zones', 'free_delivery']))
  const found = new Map(rows.map((r) => [r.key, r.value]))
  const baseCharge = found.has('delivery_charge') ? Math.max(0, Math.round(Number(found.get('delivery_charge'))) || 0) : DEFAULT_DELIVERY
  const zones = parseJson<DeliveryZone[]>(found.get('delivery_zones'), [])
  const free = { ...FREE_DELIVERY_OFF, ...parseJson<Partial<FreeDelivery>>(found.get('free_delivery'), {}) }
  return { baseCharge, zones, free }
}

export async function loadDeliveryRules(conn: Conn = db): Promise<DeliveryRules> {
  const s = await loadDeliverySettings(conn)
  return { baseCharge: s.baseCharge, zones: s.zones, free: freeDeliveryLive(s.free) ? s.free : null }
}

/* ---------- Usage ---------- */

// Cancelled / payment-rejected orders don't use up an offer
const counts = notInArray(orders.status, RELEASES_STOCK)

/** Orders (excluding cancelled/rejected) that used each offer — overall, and by this phone number. */
async function usageOf(conn: Conn, ids: number[], phone: string | null) {
  const out = new Map<number, { total: number; mine: number }>()
  if (!ids.length) return out
  const mine = phone ? sql<number>`count(*) filter (where ${orders.phone} = ${phone})::int` : sql<number>`0`
  for (const col of [orders.offerId, orders.couponId]) {
    const rows = await conn
      .select({ id: col, total: count(), mine })
      .from(orders)
      .where(and(inArray(col, ids), counts))
      .groupBy(col)
    for (const r of rows) {
      if (r.id == null) continue
      const prev = out.get(r.id) ?? { total: 0, mine: 0 }
      out.set(r.id, { total: prev.total + r.total, mine: prev.mine + Number(r.mine) })
    }
  }
  return out
}

export const toRule = (o: Offer): OfferRule => ({
  id: o.id,
  name: o.name,
  kind: o.kind,
  code: o.code,
  discountType: o.discountType,
  discountValue: o.discountValue,
  minPurchase: o.minPurchase,
  maxDiscount: o.maxDiscount,
  scope: o.scope,
  productIds: o.productIds,
  categoryIds: o.categoryIds,
  excludeProductIds: o.excludeProductIds,
  excludeSale: o.excludeSale,
  stackable: o.stackable,
})

const nepalDate = (d: Date) =>
  d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kathmandu' })

const liveNow = (now: Date) =>
  and(eq(offers.active, true), or(isNull(offers.startsAt), lte(offers.startsAt, now)), or(isNull(offers.endsAt), gt(offers.endsAt, now)))

export const normalizeCode = (code: string) => code.trim().toUpperCase()

/**
 * Everything priceCart needs, read from the database. With `lock`, the offer rows are locked
 * (FOR UPDATE) so concurrent orders can't push an offer past its usage limit.
 */
export async function pricingContext(
  conn: Conn,
  { couponCode, phone, city, lock = false }: { couponCode?: string; phone?: string | null; city?: string | null; lock?: boolean },
): Promise<PricingContext> {
  const now = new Date()
  const code = couponCode ? normalizeCode(couponCode) : ''
  const autoQuery = conn.select().from(offers).where(and(eq(offers.kind, 'automatic'), liveNow(now))).orderBy(offers.id)
  const autos = lock ? await autoQuery.for('update') : await autoQuery
  let found: Offer | undefined
  if (code) {
    const q = conn.select().from(offers).where(and(eq(offers.kind, 'coupon'), eq(offers.code, code)))
    ;[found] = lock ? await q.for('update') : await q
  }

  const limited = [...autos, ...(found ? [found] : [])].filter((o) => o.totalLimit != null || o.perCustomerLimit != null)
  const usage = await usageOf(conn, limited.map((o) => o.id), phone ?? null)
  const blocked = (o: Offer) => {
    const u = usage.get(o.id) ?? { total: 0, mine: 0 }
    if (o.totalLimit != null && u.total >= o.totalLimit) return 'total'
    if (phone && o.perCustomerLimit != null && u.mine >= o.perCustomerLimit) return 'customer'
    return null
  }

  let couponError: string | null = null
  if (code) {
    if (!found) couponError = 'This coupon code isn’t valid. Check the spelling and try again.'
    else {
      const state = offerState(found, now.getTime())
      if (state === 'paused') couponError = 'This coupon is not active right now.'
      else if (state === 'expired') couponError = `This coupon expired on ${nepalDate(found.endsAt!)}.`
      else if (state === 'scheduled') couponError = `This coupon can be used from ${nepalDate(found.startsAt!)}.`
      else {
        const why = blocked(found)
        if (why === 'total') couponError = 'This coupon has reached its usage limit.'
        if (why === 'customer') {
          couponError = `You’ve already used this coupon${found.perCustomerLimit! > 1 ? ` ${found.perCustomerLimit} times` : ''} — that’s the limit per customer.`
        }
      }
    }
  }

  return {
    delivery: await loadDeliveryRules(conn),
    city,
    offers: autos.filter((o) => !blocked(o)).map(toRule),
    coupon: found && !couponError ? toRule(found) : null,
    couponError,
  }
}

/* ---------- Storefront ---------- */

const toPublic = (o: Offer, withCode: boolean): PublicOffer => ({
  ...toRule(o),
  code: withCode ? o.code : null,
  showBanner: o.showBanner,
  bannerTitle: o.bannerTitle,
  bannerText: o.bannerText,
  bannerImage: o.bannerImage,
  ctaText: o.ctaText,
  announcement: o.announcement,
  showCountdown: o.showCountdown,
  cartMessage: o.cartMessage,
  startsAt: o.startsAt ? o.startsAt.toISOString() : null,
  endsAt: o.endsAt ? o.endsAt.toISOString() : null,
})

/**
 * Promotions the storefront may show: live automatic offers (used for bag previews), advertised
 * coupons (banner on, so the code is public), and upcoming advertised offers for "starts soon".
 * Coupons without a banner stay secret.
 */
export async function loadPublicPromo() {
  const now = new Date()
  const [rows, delivery] = await Promise.all([
    db.select().from(offers).where(and(eq(offers.active, true), or(isNull(offers.endsAt), gt(offers.endsAt, now)))).orderBy(desc(offers.createdAt)),
    loadDeliveryRules(),
  ])
  const usage = await usageOf(db, rows.filter((o) => o.totalLimit != null).map((o) => o.id), null)
  const live: PublicOffer[] = []
  const upcoming: PublicOffer[] = []
  for (const o of rows) {
    const state = offerState(o, now.getTime(), usage.get(o.id)?.total ?? 0)
    const advertised = o.showBanner || o.announcement.trim() !== ''
    if (state === 'active' && (o.kind === 'automatic' || advertised)) live.push(toPublic(o, o.kind === 'coupon'))
    else if (state === 'scheduled' && o.showBanner) upcoming.push({ ...toPublic(o, false), code: null })
  }
  return { offers: live, upcoming, delivery }
}

/* ---------- Admin ---------- */

export async function audit(conn: Conn, entry: { action: string; entity: string; entityId?: number | null; summary: string; details?: Record<string, unknown> }) {
  await conn.insert(auditLog).values({ ...entry, entityId: entry.entityId ?? null, details: entry.details ?? {} })
}

/** Offers with their results, overall promotion totals, delivery settings and the recent audit trail. */
export async function loadAdminPromo() {
  const [rows, delivery, log] = await Promise.all([
    db.select().from(offers).orderBy(desc(offers.createdAt)),
    loadDeliverySettings(),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(60),
  ])
  const per = new Map<number, { orders: number; discount: number; revenue: number }>()
  const add = (id: number | null, n: number, d: number, r: number) => {
    if (id == null) return
    const p = per.get(id) ?? { orders: 0, discount: 0, revenue: 0 }
    per.set(id, { orders: p.orders + n, discount: p.discount + d, revenue: p.revenue + r })
  }
  const [byOffer, byCoupon, [totals]] = await Promise.all([
    db
      .select({ id: orders.offerId, n: count(), d: sql<number>`coalesce(sum(${orders.offerDiscount}), 0)::int`, r: sql<number>`coalesce(sum(${orders.total}), 0)::int` })
      .from(orders)
      .where(and(sql`${orders.offerId} is not null`, counts))
      .groupBy(orders.offerId),
    db
      .select({ id: orders.couponId, n: count(), d: sql<number>`coalesce(sum(${orders.couponDiscount}), 0)::int`, r: sql<number>`coalesce(sum(${orders.total}), 0)::int` })
      .from(orders)
      .where(and(sql`${orders.couponId} is not null`, counts))
      .groupBy(orders.couponId),
    db
      .select({
        promoOrders: sql<number>`count(*) filter (where ${orders.offerDiscount} + ${orders.couponDiscount} > 0 or ${orders.deliveryWaived} > 0)::int`,
        discount: sql<number>`coalesce(sum(${orders.offerDiscount} + ${orders.couponDiscount}), 0)::int`,
        freeDeliveryOrders: sql<number>`count(*) filter (where ${orders.deliveryWaived} > 0)::int`,
        deliveryWaived: sql<number>`coalesce(sum(${orders.deliveryWaived}), 0)::int`,
        revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.offerDiscount} + ${orders.couponDiscount} > 0 or ${orders.deliveryWaived} > 0), 0)::int`,
      })
      .from(orders)
      .where(counts),
  ])
  for (const r of byOffer) add(r.id, r.n, r.d, r.r)
  for (const r of byCoupon) add(r.id, r.n, r.d, r.r)
  const now = Date.now()
  return {
    offers: rows.map((o) => {
      const stats = per.get(o.id) ?? { orders: 0, discount: 0, revenue: 0 }
      return { ...o, stats, state: offerState(o, now, stats.orders) }
    }),
    totals,
    delivery,
    // Only which fields changed; full before/after stays in the database
    log: log.map((e) => ({ id: e.id, action: e.action, summary: e.summary, createdAt: e.createdAt, fields: e.action.endsWith('.update') ? Object.keys(e.details) : [] })),
  }
}
