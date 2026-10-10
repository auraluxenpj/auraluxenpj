import { Link, createFileRoute } from '@tanstack/react-router'
import { Clock, MapPin, PartyPopper, Receipt } from 'lucide-react'
import { SiteLayout } from '@/components/SiteChrome'
import { Wrap } from '@/components/Section'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { cdn, formatPrice, whatsappLink } from '@/lib/format'
import { FREE_SIZE } from '@/lib/catalog'
import { PAYMENT_METHODS, PAYMENT_STATUS_LABEL, statusLabel } from '@/lib/orders'
import { getCustomerOrder } from '@/server/orders.functions'

export const Route = createFileRoute('/order/$number')({
  validateSearch: (search: Record<string, unknown>): { t?: string } => ({
    t: typeof search.t === 'string' ? search.t : undefined,
  }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  // The order is only shown with the secret token from the customer's own confirmation link
  loader: ({ params, deps }) => (deps.t ? getCustomerOrder({ data: { number: params.number, token: deps.t } }) : null),
  head: () => ({ meta: [{ title: 'Your order — Aura Luxe' }, { name: 'robots', content: 'noindex' }] }),
  component: OrderPage,
})

const DEFAULT_MESSAGE = 'Your payment proof has been submitted. Our team will verify the payment and confirm your order shortly.'

function OrderPage() {
  const data = Route.useLoaderData()
  if (!data) {
    return (
      <SiteLayout>
        <Wrap className="grid min-h-[50vh] place-items-center py-16 text-center">
          <div className="max-w-md">
            <h1 className="font-display text-3xl">We couldn’t find this order</h1>
            <p className="mt-2 text-sm text-muted">Open the link from the device you ordered on, or message us on WhatsApp with your order number.</p>
            <Link to="/shop" search={{}} className="btn btn-dark mt-6">Continue Shopping</Link>
          </div>
        </Wrap>
      </SiteLayout>
    )
  }

  const { order, lines, whatsapp, confirmationMessage } = data
  const fresh = order.status === 'payment_verification'
  const placed = new Date(order.createdAt)
  const chat = whatsappLink(whatsapp, `Hi Aura Luxe 👋\nI placed order ${order.number} (${formatPrice(order.total)}). Could you help me with it?`)

  return (
    <SiteLayout chatHref={chat}>
      <Wrap className="max-w-3xl pt-8 pb-12 md:pt-12">
        <div className="rise rounded-lg border border-sand bg-white p-6 text-center sm:p-10">
          <PartyPopper className="mx-auto size-9 text-gold-deep" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-3xl sm:text-4xl">{fresh ? 'Order Placed Successfully' : 'Your Order'}</h1>
          <p className="mt-2 text-muted">Thank you for shopping with Aura Luxe!</p>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-muted">Order Number</p>
          <p className="mt-1 font-display text-3xl tracking-[0.08em] text-ink sm:text-4xl">{order.number}</p>
          <p className="mt-1 text-sm text-muted">
            {placed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
            {placed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <div className="mx-auto mt-6 max-w-md rounded-md bg-blush/60 p-4 text-left">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-gold-deep" /> {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
            </p>
            {order.paymentStatus === 'submitted' && <p className="mt-1.5 text-sm text-muted">{confirmationMessage || DEFAULT_MESSAGE}</p>}
            {order.paymentStatus === 'rejected' && (
              <p className="mt-1.5 text-sm text-muted">We couldn’t verify your payment. Please contact us on WhatsApp so we can help.</p>
            )}
            {!fresh && <p className="mt-1.5 text-sm text-muted">Order status: <span className="font-medium text-ink">{statusLabel(order.status)}</span></p>}
          </div>
        </div>

        <section className="mt-6 rounded-lg border border-sand bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
            <Receipt className="size-4" /> Order details
          </h2>
          <ul className="mt-3 divide-y divide-sand">
            {lines.map((l) => (
              <li key={l.id} className="flex gap-3 py-3">
                <div className="aspect-[4/5] w-14 shrink-0 overflow-hidden rounded bg-cream">{l.image && <img src={cdn(l.image, 120)} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-muted">
                    {l.size === FREE_SIZE ? 'Free Size' : `Size ${l.size}`}
                    {l.colour ? ` · ${l.colour}` : ''} · Qty {l.quantity}
                  </p>
                  <p className="text-xs text-muted">{formatPrice(l.unitPrice)} × {l.quantity}</p>
                </div>
                <p className="text-sm font-medium">{formatPrice(l.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-sand pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{order.deliveryCharge ? formatPrice(order.deliveryCharge) : 'Free'}</dd></div>
            {order.discount > 0 && <div className="flex justify-between text-sale"><dt>Discount</dt><dd>− {formatPrice(order.discount)}</dd></div>}
            <div className="flex items-baseline justify-between border-t border-sand pt-3">
              <dt className="font-medium">Total</dt>
              <dd className="text-xl font-semibold">{formatPrice(order.total)}</dd>
            </div>
            <div className="flex justify-between pt-1 text-xs"><dt className="text-muted">Payment method</dt><dd>{PAYMENT_METHODS[order.paymentMethod as keyof typeof PAYMENT_METHODS] ?? order.paymentMethod}</dd></div>
          </dl>
        </section>

        <section className="mt-6 rounded-lg border border-sand bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
            <MapPin className="size-4" /> Delivery address
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            {order.customerName} · {order.phone}
            <br />
            {order.address}, {order.area}, {order.city}
            {order.landmark && (
              <>
                <br />
                <span className="text-muted">Landmark: {order.landmark}</span>
              </>
            )}
          </p>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/shop" search={{}} className="btn btn-dark min-h-12 flex-1">Continue Shopping</Link>
          <a href={chat} target="_blank" rel="noreferrer" className="btn btn-whatsapp min-h-12 flex-1">
            <WhatsAppIcon className="size-5" /> Contact Aura Luxe on WhatsApp
          </a>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Bookmark this page to check your order status later. It’s also saved under “Your recent orders” in your bag.</p>
      </Wrap>
    </SiteLayout>
  )
}
