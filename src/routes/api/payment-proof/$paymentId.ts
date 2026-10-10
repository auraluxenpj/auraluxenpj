import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/index.js'
import { payments } from '../../../../db/schema.js'
import { isAdminRequest } from '@/server/auth.server'
import { proofStore } from '@/server/orders.server'
import { PROOF_TYPES } from '@/lib/orders'

/** Payment proofs are private: only a signed-in admin can view them, and they are never cached publicly. */
export const Route = createFileRoute('/api/payment-proof/$paymentId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isAdminRequest(request))) return new Response('Not found', { status: 404 })
        const id = Number(params.paymentId)
        if (!Number.isInteger(id)) return new Response('Not found', { status: 404 })
        const [payment] = await db.select().from(payments).where(eq(payments.id, id))
        if (!payment?.proofKey) return new Response('Not found', { status: 404 })
        const data = await proofStore().get(payment.proofKey, { type: 'arrayBuffer' })
        if (!data) return new Response('Not found', { status: 404 })
        const type = PROOF_TYPES[payment.proofType] ? payment.proofType : 'application/octet-stream'
        return new Response(data, {
          headers: {
            'Content-Type': type,
            'Content-Disposition': `inline; filename="payment-${id}.${PROOF_TYPES[type] ?? 'bin'}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Robots-Tag': 'noindex',
          },
        })
      },
    },
  },
})
