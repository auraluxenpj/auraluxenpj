import { z } from 'zod'

/** Fulfilment pipeline, in order. Cancelled and Payment Rejected release the reserved stock. */
export const ORDER_STATUSES = [
  { key: 'pending_payment', label: 'Pending Payment' },
  { key: 'payment_verification', label: 'Payment Verification' },
  { key: 'payment_verified', label: 'Payment Verified' },
  { key: 'processing', label: 'Processing' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'payment_rejected', label: 'Payment Rejected' },
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]['key']
export const ORDER_STATUS_KEYS = ORDER_STATUSES.map((s) => s.key) as [OrderStatus, ...OrderStatus[]]
export const RELEASES_STOCK: OrderStatus[] = ['cancelled', 'payment_rejected']

export const statusLabel = (key: string) => ORDER_STATUSES.find((s) => s.key === key)?.label ?? key

/** What the customer sees for the payment. */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment',
  submitted: 'Payment Verification Pending',
  verified: 'Payment Verified',
  rejected: 'Payment Rejected',
}

export const PAYMENT_METHODS = { bank_transfer: 'Bank Transfer / QR Payment' } as const

/** Payment proof: screenshots or a bank PDF. Netlify Functions accept request bodies up to 6 MB. */
export const PROOF_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
}
export const PROOF_MAX_MB_LIMIT = 5
export const PROOF_MAX_MB_DEFAULT = 5

/** Nepali mobile numbers: 10 digits starting 96/97/98, optionally prefixed with +977. */
export function normalizePhone(input: string) {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+?977/, '')
  return /^9[678]\d{8}$/.test(digits) ? digits : null
}

const text = (max: number) => z.string().trim().max(max)
const required = (label: string, max: number) => text(max).min(1, `${label} is required`)

export const cartLineSchema = z.object({
  id: z.number().int().positive(),
  size: z.string().trim().max(20).nullable(),
  colour: z.string().trim().max(30).nullable(),
  qty: z.number().int().min(1).max(20),
})
export const cartSchema = z.array(cartLineSchema).min(1, 'Your bag is empty').max(30)
export type CartLine = z.infer<typeof cartLineSchema>

/** Everything the checkout form sends. Prices and totals are never accepted from the browser. */
export const checkoutSchema = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, 'Invalid checkout session'),
  customer: z.object({
    name: required('Full name', 80).min(2, 'Enter your full name'),
    phone: z.string().refine((v) => normalizePhone(v) != null, 'Enter a valid 10-digit mobile number, e.g. 98XXXXXXXX'),
    email: z.union([z.literal(''), z.email('Enter a valid email or leave it blank')]),
    address: required('Address', 200),
    city: required('City', 60),
    area: required('Area / locality', 80),
    landmark: text(120),
  }),
  paymentMethod: z.literal('bank_transfer'),
  transactionId: text(60),
  paymentDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid payment date')]),
  lines: cartSchema,
  couponCode: z.string().trim().max(30).regex(/^[A-Za-z0-9_-]*$/, 'Invalid coupon code').default(''),
  // The total the customer saw (and paid); the server rejects the order if its own total differs
  expectedTotal: z.number().int().nonnegative().optional(),
})
export type CheckoutInput = z.infer<typeof checkoutSchema>
