import { createFileRoute } from '@tanstack/react-router'
import { CheckoutError, loadPaymentSettings, placeOrder, proofMaxBytes, sniffProof } from '@/server/orders.server'
import { PROOF_TYPES, checkoutSchema } from '@/lib/orders'

const fail = (error: string, status = 400) => Response.json({ error }, { status })

/**
 * Place an order: multipart form with `order` (JSON) and `proof` (the payment screenshot/PDF).
 * Sending both in one request means a proof is only ever stored for a real order.
 */
export const Route = createFileRoute('/api/orders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData
        try {
          form = await request.formData()
        } catch {
          return fail('We could not read your order. If your payment proof is very large, try a smaller screenshot.')
        }

        let raw: unknown
        try {
          raw = JSON.parse(String(form.get('order') ?? ''))
        } catch {
          return fail('We could not read your order. Please refresh the page and try again.')
        }
        const parsed = checkoutSchema.safeParse(raw)
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check your details and try again.')

        const file = form.get('proof')
        if (!(file instanceof File) || file.size === 0) return fail('Please upload your payment screenshot or receipt.')
        const settings = await loadPaymentSettings()
        const max = proofMaxBytes(settings)
        if (file.size > max) return fail(`Your payment proof is larger than ${Math.round(max / 1024 / 1024)} MB. Please upload a smaller file.`)
        const bytes = await file.arrayBuffer()
        // Trust the file's contents, not its name or the browser-reported type
        const type = sniffProof(new Uint8Array(bytes.slice(0, 8)))
        if (!type || !PROOF_TYPES[type]) return fail('Payment proof must be a JPG, PNG or PDF file.')

        try {
          const ip = request.headers.get('x-nf-client-connection-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
          const placed = await placeOrder(parsed.data, { bytes, type }, ip)
          return Response.json(placed, { status: 201 })
        } catch (err) {
          if (err instanceof CheckoutError) return fail(err.message, 409)
          console.error('Order failed', err)
          return fail('We could not place your order right now. Please try again in a moment — nothing has been saved.', 500)
        }
      },
    },
  },
})
