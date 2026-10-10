import { Link, createFileRoute } from '@tanstack/react-router'
import { AlertCircle, ArrowRight, Minus, Plus, Receipt, ShoppingBag, Trash2 } from 'lucide-react'
import { SiteLayout } from '@/components/SiteChrome'
import { Wrap } from '@/components/Section'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { bagMessage, cdn, formatPrice, whatsappLink } from '@/lib/format'
import { sizeKeys, sortSizes, stockOf } from '@/lib/catalog'
import { priceCart } from '@/lib/pricing'
import { useSite } from '@/lib/site'
import { bag, placedOrders, qtyOf, removeFromBag, setBagOption, setBagQty } from '@/lib/store'

export const Route = createFileRoute('/bag')({
  head: () => ({ meta: [{ title: 'Your bag — Aura Luxe' }, { name: 'robots', content: 'noindex' }] }),
  component: BagPage,
})

/**
 * The bag feeds two paths: order online (bank transfer / QR, verified by the team) or send
 * every piece in one WhatsApp enquiry. Stock shown here is re-checked on the server at checkout.
 */
function BagPage() {
  const { items, whatsapp } = useSite()
  const entries = bag.use()
  const recentOrders = placedOrders.use()
  const byId = new Map(items.map((i) => [i.id, i]))
  const lines = entries.map((e, index) => ({ ...e, qty: qtyOf(e), index, item: byId.get(e.id) })).filter((l) => l.item != null)
  const quote = priceCart(lines.map((l) => ({ id: l.id, size: l.size, colour: l.colour, qty: l.qty })), items, 0)
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const pieces = lines.reduce((n, l) => n + l.qty, 0)
  const hasOnRequest = lines.some((l) => l.item!.price == null)

  const href = whatsappLink(
    whatsapp,
    bagMessage(
      lines.map((l) => ({
        name: l.qty > 1 ? `${l.item!.name} × ${l.qty}` : l.item!.name,
        price: l.item!.price,
        size: l.size,
        colour: l.colour,
        url: `${origin}/item/${l.id}`,
      })),
    ),
  )

  return (
    <SiteLayout chatHref={lines.length ? href : undefined}>
      <Wrap className="pt-8 md:pt-12">
        <h1 className="font-display text-3xl tracking-[0.06em] uppercase sm:text-4xl">Your Bag</h1>
        <p className="mt-1 text-sm text-muted">Order online with bank transfer / QR, or send every piece in one WhatsApp message.</p>

        {lines.length === 0 ? (
          <div className="mt-8 grid place-items-center rounded-lg border border-dashed border-sand bg-white px-6 py-16 text-center">
            <ShoppingBag className="size-7 text-gold-deep" strokeWidth={1.5} />
            <p className="mt-4 font-display text-2xl">Your bag is empty</p>
            <p className="mt-2 max-w-sm text-sm text-muted">Choose a size on any product page and add it to your bag.</p>
            <Link to="/shop" search={{}} className="btn btn-dark mt-6">Browse the collection</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
            <ul className="divide-y divide-sand rounded-lg border border-sand bg-white">
              {lines.map(({ item, index, size, colour, qty }, i) => {
                const q = quote.lines[i]
                const sized = item!.sizes.length > 0
                const max = Math.max(1, stockOf(item!, size))
                return (
                  <li key={`${item!.id}-${size}-${colour}-${index}`} className="flex gap-4 p-4">
                    <Link to="/item/$itemId" params={{ itemId: String(item!.id) }} className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md bg-cream sm:w-24">
                      {item!.images[0] && <img src={cdn(item!.images[0], 200)} alt="" loading="lazy" className="size-full object-cover" />}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <Link to="/item/$itemId" params={{ itemId: String(item!.id) }} className="text-sm font-medium hover:underline">
                          {item!.name}
                        </Link>
                        <button onClick={() => removeFromBag(index)} className="-m-2 grid size-10 shrink-0 place-items-center text-muted hover:text-sale" aria-label={`Remove ${item!.name} from bag`}>
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <p className="text-sm text-muted">
                        {formatPrice(item!.price)}
                        {item!.price != null && qty > 1 && (
                          <>
                            {' '}× {qty} = <span className="font-semibold text-ink">{formatPrice(item!.price * qty)}</span>
                          </>
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {sized ? (
                          <select
                            value={size ?? ''}
                            onChange={(e) => setBagOption(index, 'size', e.target.value || null)}
                            aria-label="Size"
                            className="h-10 rounded-md border border-sand bg-white px-2 text-sm"
                          >
                            <option value="">Choose size</option>
                            {sortSizes(item!.sizes).map((s) => {
                              const out = stockOf(item!, s) <= 0
                              return (
                                <option key={s} value={s} disabled={out && s !== size}>
                                  Size {s}{out ? ' — Out of Stock' : ''}
                                </option>
                              )
                            })}
                          </select>
                        ) : (
                          <span className="inline-flex h-10 items-center rounded-md border border-sand px-3 text-sm text-muted">{sizeKeys(item!)[0]}</span>
                        )}
                        {item!.colors.length > 0 && (
                          <select value={colour ?? ''} onChange={(e) => setBagOption(index, 'colour', e.target.value || null)} aria-label="Colour" className="h-10 rounded-md border border-sand bg-white px-2 text-sm">
                            <option value="">{item!.colors.length > 1 ? 'Choose colour' : 'Colour'}</option>
                            {item!.colors.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex h-10 items-center rounded-md border border-sand" role="group" aria-label="Quantity">
                          <button onClick={() => setBagQty(index, qty - 1)} disabled={qty <= 1} className="grid size-10 place-items-center text-ink disabled:text-muted/40" aria-label="Decrease quantity">
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">{qty}</span>
                          <button onClick={() => setBagQty(index, qty + 1)} disabled={qty >= Math.min(max, 20)} className="grid size-10 place-items-center text-ink disabled:text-muted/40" aria-label="Increase quantity">
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      {q?.error && (
                        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-sale">
                          <AlertCircle className="mt-px size-3.5 shrink-0" /> {q.error}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <aside className="rounded-lg border border-sand bg-white p-5 lg:sticky lg:top-24">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal ({pieces} {pieces === 1 ? 'piece' : 'pieces'})</dt>
                  <dd>{formatPrice(quote.subtotal)}</dd>
                </div>
                {quote.discount > 0 && (
                  <div className="flex justify-between text-sale">
                    <dt>Discount</dt>
                    <dd>− {formatPrice(quote.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd className="text-muted">At checkout</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-sand pt-3">
                  <dt className="font-medium">Total before delivery</dt>
                  <dd className="text-lg font-semibold">{formatPrice(quote.total)}</dd>
                </div>
              </dl>
              {quote.ok ? (
                <Link to="/checkout" className="btn btn-dark mt-5 min-h-12 w-full">
                  Proceed to checkout <ArrowRight className="size-4" />
                </Link>
              ) : (
                <>
                  <button disabled className="btn btn-dark mt-5 min-h-12 w-full cursor-not-allowed opacity-40">Proceed to checkout</button>
                  <p className="mt-2 text-xs text-sale">
                    {hasOnRequest ? 'Pieces with price on request can only be ordered on WhatsApp. ' : ''}Fix the highlighted pieces to check out.
                  </p>
                </>
              )}
              <a href={href} target="_blank" rel="noreferrer" className="btn btn-whatsapp mt-3 min-h-12 w-full">
                <WhatsAppIcon className="size-5" /> Check availability on WhatsApp
              </a>
              <Link to="/shop" search={{}} className="mt-3 block text-center text-xs font-medium tracking-[0.14em] uppercase text-muted hover:text-ink">
                Continue shopping
              </Link>
            </aside>
          </div>
        )}

        {recentOrders.length > 0 && (
          <section className="mt-10 rounded-lg border border-sand bg-white p-5">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">Your recent orders</h2>
            <ul className="mt-3 divide-y divide-sand text-sm">
              {recentOrders.slice(0, 5).map((o) => (
                <li key={o.number}>
                  <Link to="/order/$number" params={{ number: o.number }} search={{ t: o.token }} className="flex items-center gap-3 py-2.5 hover:underline">
                    <Receipt className="size-4 text-gold-deep" /> <span className="font-medium">{o.number}</span>
                    <span className="text-muted">{new Date(o.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <ArrowRight className="ml-auto size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Wrap>
    </SiteLayout>
  )
}
