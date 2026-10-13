import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Gift, PartyPopper, Sparkles, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cdn, formatPrice } from '@/lib/format'
import { bannerCopy, discountLabel, fillTemplate } from '@/lib/promo'
import type { PublicOffer } from '@/lib/promo'
import type { FreeDeliveryProgress } from '@/lib/pricing'
import { useSite } from '@/lib/site'

/** Re-render every `ms` once mounted; null on the server so markup always hydrates cleanly. */
function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/**
 * Live promotions from the root loader. Offers that end while the page is open drop out on the
 * next minute tick; the server re-checks everything at checkout anyway.
 */
export function usePromo() {
  const { promo } = useSite()
  const now = useNow(60_000)
  return useMemo(() => {
    const t = now ?? 0
    const live = (o: PublicOffer) => !now || !o.endsAt || new Date(o.endsAt).getTime() > t
    const offers = promo.offers.filter(live)
    const automatic = offers.filter((o) => o.kind === 'automatic')
    const banner = offers.find((o) => o.showBanner) ?? null
    const upcoming = promo.upcoming.filter((o) => !now || !o.startsAt || new Date(o.startsAt).getTime() > t)
    return { ...promo, offers, automatic, banner, upcoming, free: promo.delivery.free }
  }, [promo, now])
}

/* ---------------- Announcement bar ---------------- */

export function AnnouncementBar() {
  const { offers, free } = usePromo()
  const messages = [
    ...offers.filter((o) => o.announcement.trim()).map((o) => fillTemplate(o.announcement, o, free)),
    ...(free?.announce ? [`FREE DELIVERY on orders over ${formatPrice(free.min)}${free.zoneIds.length ? ' (selected areas)' : ''}`] : []),
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    if (messages.length < 2) return
    const t = setInterval(() => setI((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [messages.length])
  if (!messages.length) return null
  const text = messages[i % messages.length]
  return (
    <div className="bg-ink px-4 py-2 text-center text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ivory sm:text-xs" role="region" aria-label="Offers">
      <Link to="/shop" search={{}} className="inline-flex items-center gap-2 hover:text-gold-soft">
        <Sparkles className="size-3.5 shrink-0 text-gold" aria-hidden />
        <span key={text} className="fade">{text}</span>
      </Link>
    </div>
  )
}

/* ---------------- Countdown ---------------- */

export function Countdown({ to, label, tone = 'light' }: { to: string; label: string; tone?: 'light' | 'dark' }) {
  const now = useNow()
  if (now == null) return <div className="h-14" aria-hidden />
  const left = Math.max(0, new Date(to).getTime() - now)
  if (left === 0) return null
  const parts = [
    { v: Math.floor(left / 86_400_000), l: 'Days' },
    { v: Math.floor(left / 3_600_000) % 24, l: 'Hrs' },
    { v: Math.floor(left / 60_000) % 60, l: 'Min' },
    { v: Math.floor(left / 1000) % 60, l: 'Sec' },
  ]
  return (
    <div>
      <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${tone === 'dark' ? 'text-gold-soft' : 'text-gold-deep'}`}>{label}</p>
      <div className="mt-1.5 flex gap-1.5" role="timer" aria-label={`${label} ${parts.map((p) => `${p.v} ${p.l}`).join(' ')}`}>
        {parts.map((p) => (
          <span key={p.l} className={`grid min-w-12 place-items-center rounded-md px-2 py-1 ${tone === 'dark' ? 'bg-white/10 text-white' : 'border border-gold-soft bg-white text-ink'}`}>
            <span className="text-lg leading-tight font-semibold tabular-nums">{String(p.v).padStart(2, '0')}</span>
            <span className="text-[0.55rem] uppercase tracking-[0.14em] opacity-70">{p.l}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Festive banner (home + shop) ---------------- */

function ctaSearch(o: PublicOffer): { c?: string } {
  if (o.scope === 'categories' && o.categoryIds.length === 1) return { c: String(o.categoryIds[0]) }
  return {}
}

export function PromoBanner({ compact = false }: { compact?: boolean }) {
  const { banner, upcoming, free } = usePromo()

  if (!banner) {
    const next = upcoming[0]
    if (!next?.startsAt) return null
    const { title } = bannerCopy(next, free)
    return (
      <section aria-label="Upcoming offer" className="rounded-xl border border-dashed border-gold-soft bg-white px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow text-gold-deep">Coming soon · not active yet</p>
            <p className="mt-1 font-display text-2xl text-ink">{title}</p>
            <p className="mt-1 text-sm text-muted">
              {discountLabel(next)} starts{' '}
              {new Date(next.startsAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kathmandu' })} (Nepal time).
            </p>
          </div>
          <Countdown to={next.startsAt} label="Starts in" />
        </div>
      </section>
    )
  }

  const { title, text, cta } = bannerCopy(banner, free)
  return (
    <section aria-label={banner.name} className="relative overflow-hidden rounded-xl bg-ink text-white">
      <div className={`grid ${banner.bannerImage && !compact ? 'md:grid-cols-[1.2fr_1fr]' : ''}`}>
        <div className={`relative z-10 flex flex-col justify-center gap-4 ${compact ? 'p-5 sm:p-6' : 'p-6 sm:p-10'}`}>
          <p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold">
            <PartyPopper className="size-4" /> {banner.name}
          </p>
          <h2 className={`font-display leading-tight ${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'}`}>{title}</h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">{text}</p>
          {banner.code && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              Use code
              <span className="rounded-md border border-dashed border-gold px-3 py-1 font-semibold tracking-[0.18em] text-gold">{banner.code}</span>
              at checkout
            </p>
          )}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {banner.showCountdown && banner.endsAt && <Countdown to={banner.endsAt} label="Offer ends in" tone="dark" />}
            {!compact && (
              <Link to="/shop" search={ctaSearch(banner)} className="btn mt-1 min-h-12 bg-gold text-ink hover:brightness-105">
                {cta} <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
        {banner.bannerImage && !compact && (
          <div className="relative min-h-56 md:min-h-full">
            <img src={cdn(banner.bannerImage, 900)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent md:bg-gradient-to-r md:from-ink md:via-ink/20" />
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------------- Cart / checkout ---------------- */

/** "Add Rs. 350 more to unlock FREE DELIVERY!" or the congratulations line. */
export function FreeDeliveryNote({ progress, knownCity = true }: { progress: FreeDeliveryProgress | null; knownCity?: boolean }) {
  if (!progress) return null
  const pct = Math.min(100, Math.round(((progress.min - progress.remaining) / Math.max(1, progress.min)) * 100))
  const reached = progress.remaining === 0
  return (
    <div className={`rounded-md p-3 text-sm ${progress.qualifies ? 'bg-whatsapp/10 text-whatsapp-ink' : 'bg-blush/70 text-ink'}`} aria-live="polite">
      <p className="flex items-start gap-2 font-medium">
        {progress.qualifies ? <Check className="mt-0.5 size-4 shrink-0" /> : <Truck className="mt-0.5 size-4 shrink-0 text-gold-deep" />}
        <span>
          {progress.qualifies
            ? 'Congratulations! You qualify for FREE DELIVERY.'
            : reached
              ? progress.zoneBlocked && knownCity
                ? 'Free delivery isn’t available for your delivery city.'
                : 'You’ve reached the free-delivery amount — free delivery applies in selected areas.'
              : `Add ${formatPrice(progress.remaining)} more${progress.limited ? ' of eligible pieces' : ''} to unlock FREE DELIVERY!`}
        </span>
      </p>
      {!progress.qualifies && !reached && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white" aria-hidden>
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

/** Owner-written promo messages for the bag and checkout. */
export function CartMessages() {
  const { offers, free } = usePromo()
  const msgs = offers.filter((o) => o.cartMessage.trim()).map((o) => ({ id: o.id, text: fillTemplate(o.cartMessage, o, free) }))
  if (!msgs.length) return null
  return (
    <ul className="space-y-2">
      {msgs.map((m) => (
        <li key={m.id} className="flex items-start gap-2 rounded-md border border-gold-soft bg-gold-soft/20 p-3 text-sm">
          <Gift className="mt-0.5 size-4 shrink-0 text-gold-deep" /> {m.text}
        </li>
      ))}
    </ul>
  )
}

export type Breakdown = {
  subtotal: number
  saleDiscount: number
  offer: { name: string; amount: number } | null
  coupon: { code: string; amount: number } | null
  deliveryCharge: number | null
  deliveryWaived: number
  deliveryZone?: string
  total: number
  totalLabel?: string
}

/** Breakdown of a saved order (its own snapshot of offers and delivery, not today's settings). */
export function orderBreakdown(o: {
  subtotal: number
  discount: number
  offerName: string
  offerDiscount: number
  couponCode: string
  couponDiscount: number
  deliveryCharge: number
  deliveryWaived: number
  deliveryZone: string
  total: number
}): Breakdown {
  return {
    subtotal: o.subtotal,
    saleDiscount: o.discount - o.offerDiscount - o.couponDiscount,
    offer: o.offerDiscount ? { name: o.offerName, amount: o.offerDiscount } : null,
    coupon: o.couponDiscount ? { code: o.couponCode, amount: o.couponDiscount } : null,
    deliveryCharge: o.deliveryCharge,
    deliveryWaived: o.deliveryWaived,
    deliveryZone: o.deliveryZone,
    total: o.total,
  }
}

/** The same order summary on the bag, checkout, confirmation and admin pages. */
export function PriceBreakdown({ b }: { b: Breakdown }) {
  const saved = b.saleDiscount + (b.offer?.amount ?? 0) + (b.coupon?.amount ?? 0) + b.deliveryWaived
  return (
    <dl className="space-y-2 text-sm">
      <Row label="Subtotal" value={formatPrice(b.subtotal)} />
      {b.saleDiscount > 0 && <Row label="Sale discount" value={`− ${formatPrice(b.saleDiscount)}`} tone="text-sale" />}
      {b.offer && b.offer.amount > 0 && <Row label={`Offer · ${b.offer.name}`} value={`− ${formatPrice(b.offer.amount)}`} tone="text-sale" />}
      {b.coupon && b.coupon.amount > 0 && <Row label={`Coupon · ${b.coupon.code}`} value={`− ${formatPrice(b.coupon.amount)}`} tone="text-sale" />}
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Delivery{b.deliveryZone ? ` · ${b.deliveryZone}` : ''}</dt>
        <dd className="text-right">
          {b.deliveryCharge == null ? (
            <span className="text-muted">At checkout</span>
          ) : b.deliveryCharge === 0 ? (
            <>
              {b.deliveryWaived > 0 && <s className="mr-1.5 text-muted">{formatPrice(b.deliveryWaived)}</s>}
              <span className="font-semibold text-whatsapp-ink">FREE</span>
            </>
          ) : (
            formatPrice(b.deliveryCharge)
          )}
        </dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-sand pt-3">
        <dt className="font-medium">{b.totalLabel ?? 'Total'}</dt>
        <dd className="text-xl font-semibold">{formatPrice(b.total)}</dd>
      </div>
      {saved > 0 && (
        <p className="rounded-md bg-whatsapp/10 px-3 py-2 text-center text-xs font-semibold text-whatsapp-ink">
          You save {formatPrice(saved)} on this order{b.deliveryWaived > 0 ? ' (incl. free delivery)' : ''}
        </p>
      )}
    </dl>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${tone ?? ''}`}>
      <dt className={tone ? '' : 'text-muted'}>{label}</dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  )
}
