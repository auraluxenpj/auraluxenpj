import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSetting, putSetting, requireAdmin } from './auth.server'
import { deleteUploadedImages } from './images.server'
import {
  CheckoutError,
  PAYMENT_KEYS,
  deliveryChargeOf,
  loadAdminOrder,
  loadCustomerOrder,
  loadPaymentSettings,
  paymentConfigured,
  proofMaxBytes,
  quoteCart,
  setOrderNotes,
  setOrderStatus,
} from './orders.server'
import { DEFAULT_WHATSAPP } from './catalog.server'
import { ORDER_STATUS_KEYS, PROOF_MAX_MB_LIMIT, cartSchema } from '@/lib/orders'

/* ---------- Public ---------- */

/** Bank/QR details and limits the checkout page needs — nothing private. */
export const getCheckoutSettings = createServerFn({ method: 'GET' }).handler(async () => {
  const s = await loadPaymentSettings()
  return {
    bankName: s.bank_name,
    accountName: s.bank_account_name,
    accountNumber: s.bank_account_number,
    branch: s.bank_branch,
    qr: s.payment_qr,
    instructions: s.payment_instructions,
    deliveryCharge: deliveryChargeOf(s),
    proofMaxBytes: proofMaxBytes(s),
    open: paymentConfigured(s),
  }
})

/** Re-price the bag from the database so checkout shows live prices and stock. */
export const getCartQuote = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      lines: cartSchema,
      couponCode: z.string().trim().max(30).optional(),
      city: z.string().trim().max(60).optional(),
      phone: z.string().trim().max(20).optional(),
    }),
  )
  .handler(({ data }) => quoteCart(data.lines, data))

export const getCustomerOrder = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ number: z.string().max(20), token: z.string().max(64) }))
  .handler(async ({ data }) => {
    const found = await loadCustomerOrder(data.number, data.token)
    if (!found) return null
    const [s, whatsapp] = await Promise.all([loadPaymentSettings(), getSetting('whatsapp')])
    return { ...found, confirmationMessage: s.payment_confirmation_message, whatsapp: whatsapp ?? DEFAULT_WHATSAPP }
  })

/* ---------- Admin ---------- */

export const getAdminOrder = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const found = await loadAdminOrder(data.id)
    if (!found) throw new Error('Order not found.')
    return found
  })

export const updateOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int(), status: z.enum(ORDER_STATUS_KEYS) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    try {
      await setOrderStatus(data.id, data.status)
    } catch (err) {
      if (err instanceof CheckoutError) throw new Error(err.message)
      console.error('updateOrderStatus failed', err)
      throw new Error('Could not update the order. Please try again.')
    }
    return { ok: true }
  })

export const saveOrderNotes = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int(), notes: z.string().max(4000) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await setOrderNotes(data.id, data.notes)
    return { ok: true }
  })

const line = (max: number) => z.string().trim().max(max)

export const savePaymentSettings = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      bank_name: line(80),
      bank_account_name: line(80),
      bank_account_number: line(40),
      bank_branch: line(80),
      payment_qr: z.string().trim().max(300).refine((v) => v === '' || v.startsWith('/api/images/'), 'Upload the QR code image'),
      payment_instructions: line(1000),
      payment_confirmation_message: line(1000),
      // Edited with the other delivery settings in Admin → Offers; only written when sent
      delivery_charge: z.string().trim().regex(/^\d{0,6}$/, 'Delivery charge must be a whole number of rupees').optional(),
      proof_max_mb: z
        .string()
        .trim()
        .refine((v) => Number(v) >= 1 && Number(v) <= PROOF_MAX_MB_LIMIT, `Maximum upload size must be 1–${PROOF_MAX_MB_LIMIT} MB`),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    const before = await loadPaymentSettings()
    const values = { ...data, delivery_charge: data.delivery_charge == null ? before.delivery_charge : String(Number(data.delivery_charge) || 0) }
    for (const key of PAYMENT_KEYS) if (key !== 'delivery_charge' || data.delivery_charge != null) await putSetting(key, values[key])
    if (before.payment_qr && before.payment_qr !== values.payment_qr) await deleteUploadedImages([before.payment_qr])
    return values
  })
