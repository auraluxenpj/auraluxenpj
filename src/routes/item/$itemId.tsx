import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, ImageOff, Ruler, Share2, ShoppingBag, Store, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Item } from '../../../db/schema'
import { getItem } from '@/server/catalog.functions'
import { SiteLayout } from '@/components/SiteChrome'
import { ItemGrid } from '@/components/ItemCard'
import { SectionHeader, Wrap } from '@/components/Section'
import { CompleteTheLook } from '@/components/CompleteTheLook'
import { RecentlyViewed } from '@/components/RecentlyViewed'
import { WishlistButton } from '@/components/WishlistButton'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { cdn, cdnSet, crossedPrice, discountPercent, enquiryMessage, formatPrice, itemBadge, whatsappLink } from '@/lib/format'
import { PRODUCT_DISCLAIMER, descriptionText, isSoldOut, lookFor, similarItems, sortSizes, stockOf } from '@/lib/catalog'
import { categoryLabel, useSite } from '@/lib/site'
import { addToBag, bag, markViewed, qtyOf } from '@/lib/store'

export const Route = createFileRoute('/item/$itemId')({
  loader: async ({ params }) => {
    const id = Number(params.itemId)
    const data = Number.isInteger(id) ? await getItem({ data: { id } }) : null
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.item.name} — Aura Luxe` },
          { name: 'description', content: descriptionText(loaderData.item.description).slice(0, 160) },
          { property: 'og:title', content: `${loaderData.item.name} — Aura Luxe` },
          ...(loaderData.item.images[0]
            ? [{ property: 'og:image', content: cdn(loaderData.item.images[0], 1200).replace('fm=webp', 'fm=jpg') }]
            : []),
        ]
      : [],
  }),
  component: ItemPage,
  notFoundComponent: NotFound,
})

function ItemPage() {
  const { item } = Route.useLoaderData()
  const { items, whatsapp, categoryName } = useSite()
  const router = useRouter()
  const sizes = sortSizes(item.sizes)
  const outOfStock = sizes.filter((s) => stockOf(item, s) <= 0)
  const available = sizes.filter((s) => !outOfStock.includes(s))
  const [size, setSize] = useState<string | null>(null)
  const [colour, setColour] = useState<string | null>(null)
  const [url, setUrl] = useState<string>()
  const [flash, setFlash] = useState('')
  const was = crossedPrice(item)
  const badge = itemBadge(item)
  const soldOut = isSoldOut(item)
  const category = categoryLabel(categoryName, item.categoryId)

  useEffect(() => {
    // A single option needs no choosing — preselect it so it's always in the message
    setSize(available.length === 1 && sizes.length === 1 ? available[0] : null)
    setColour(item.colors.length === 1 ? item.colors[0] : null)
    setUrl(window.location.href.split('?')[0])
    markViewed(item.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const message = enquiryMessage({
    name: item.name,
    price: item.price,
    size: size ?? (sizes.length ? 'Not sure yet — please advise' : null),
    colour: colour ?? (item.colors.length > 1 ? 'Not sure yet' : null),
    url,
  })
  const enquireHref = whatsappLink(whatsapp, message)
  const look = lookFor(item, items)
  const similar = similarItems(item, items, look.map((i) => i.id))

  const say = (text: string) => {
    setFlash(text)
    setTimeout(() => setFlash(''), 2500)
  }

  // Units left for the current choice (free-size pieces have a single stock count)
  const left = sizes.length ? (size ? stockOf(item, size) : null) : stockOf(item, null)

  function add() {
    if (soldOut) return say('This piece is sold out')
    if (sizes.length && !size) return say('Please choose a size')
    if (item.colors.length > 1 && !colour) return say('Please choose a colour')
    if (item.price == null) return say('Price on request — enquire on WhatsApp')
    const inBag = bag
      .get()
      .filter((e) => e.id === item.id && e.size === size)
      .reduce((n, e) => n + qtyOf(e), 0)
    if (left != null && inBag >= left) return say(`Only ${left} available — already in your bag`)
    addToBag({ id: item.id, size, colour, qty: 1 }, left ?? Infinity)
    say('Added to your bag')
  }

  async function share() {
    const shareUrl = url ?? ''
    if (navigator.share) {
      await navigator.share({ title: item.name, url: shareUrl }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(shareUrl)
      say('Link copied')
    }
  }

  const description = descriptionText(item.description)
  const details = [
    ['Fabric', item.fabric],
    ['Pattern', item.pattern],
    ['Set contents', item.setContents],
    ['Occasion', item.occasions.join(', ')],
    ['Fit', item.fit],
    ['Colour', item.colors.join(', ')],
  ].filter(([, v]) => v)

  return (
    <SiteLayout chatHref={enquireHref} hideFloatingOnMobile>
      <Wrap className="pt-4 md:pt-6">
        <button
          onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: '/shop', search: {} }))}
          className="inline-flex h-10 items-center gap-2 text-sm text-muted transition hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
      </Wrap>

      <Wrap className="grid gap-8 pt-2 md:grid-cols-[1.15fr_1fr] md:gap-10 lg:gap-14">
        <Gallery item={item} />

        {/* Details */}
        <div className="md:sticky md:top-24 md:self-start">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/shop" search={item.categoryId ? { c: String(item.categoryId) } : { c: 'other' }} className="eyebrow hover:underline">
              {category}
            </Link>
            {badge && (
              <span className={`rounded-sm px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${badge.tone === 'sale' ? 'bg-sale text-white' : 'bg-ink text-white'}`}>
                {badge.label}
              </span>
            )}
          </div>
          <h1 className="mt-2.5 font-display text-[1.9rem] leading-tight text-ink sm:text-4xl">{item.name}</h1>

          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-ink">{formatPrice(item.price)}</span>
            {was != null && item.price != null && (
              <>
                <s className="text-base text-muted">{formatPrice(was)}</s>
                <span className="text-sm font-semibold text-sale">{discountPercent(item.price, was)}% OFF</span>
              </>
            )}
          </p>
          {soldOut && <p className="mt-2 text-sm font-medium text-sale">Currently sold out — ask us about restocks or similar pieces.</p>}

          {item.colors.length > 0 && (
            <OptionGroup label="Colour" options={item.colors} value={colour} onChange={setColour} />
          )}
          {sizes.length > 0 ? (
            <OptionGroup
              label="Size"
              options={sizes}
              disabled={outOfStock}
              value={size}
              onChange={setSize}
              aside={
                <Link to="/help" hash="size-guide" className="inline-flex items-center gap-1 text-xs font-medium text-ink underline-offset-4 hover:underline">
                  <Ruler className="size-3.5" /> Size Guide <ArrowRight className="size-3" />
                </Link>
              }
            />
          ) : (
            <div className="mt-6">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">Size</p>
              <span className="mt-3 inline-flex h-11 items-center rounded-md border border-ink bg-ink px-4 text-sm text-white">Free Size</span>
            </div>
          )}
          {!soldOut && left != null && left > 0 && left <= 3 && (
            <p className="mt-3 text-xs font-medium text-sale">Only {left} left{sizes.length ? ` in size ${size}` : ''}</p>
          )}

          <div className="mt-7 space-y-3">
            <a href={enquireHref} target="_blank" rel="noreferrer" className="btn btn-whatsapp min-h-13 w-full text-[0.8rem]">
              <WhatsAppIcon className="size-5" /> Check availability on WhatsApp
            </a>
            <div className="flex gap-3">
              <button onClick={add} disabled={soldOut} className="btn btn-outline flex-1 disabled:cursor-not-allowed disabled:opacity-50">
                <ShoppingBag className="size-4" /> {soldOut ? 'Sold out' : 'Add to bag'}
              </button>
              <WishlistButton id={item.id} name={item.name} className="size-11! rounded-md! border border-ink bg-white! shadow-none!" />
              <button onClick={share} aria-label="Share this piece" className="grid size-11 place-items-center rounded-md border border-ink transition hover:bg-ink hover:text-white">
                <Share2 className="size-4" />
              </button>
            </div>
            <p className="min-h-5 text-xs text-muted" aria-live="polite">
              {flash ? (
                <span className="inline-flex items-center gap-1 text-ink">
                  <Check className="size-3.5" /> {flash}
                  {flash === 'Added to your bag' && (
                    <Link to="/bag" className="ml-1 underline underline-offset-4">View bag</Link>
                  )}
                </span>
              ) : (
                'Add to bag to order online with bank transfer / QR, or enquire on WhatsApp — size and colour are added to your message.'
              )}
            </p>
          </div>

          {details.length > 0 && (
            <div className="mt-6 border-t border-sand pt-6">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">Product information</h2>
              <dl className="mt-3 grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-6 border-t border-sand pt-6">
            {description && (
              <>
                <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">Description</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
              </>
            )}
            <p className={`${description ? 'mt-5' : ''} rounded-xl border border-sand/80 bg-white/70 px-4 py-3 text-xs leading-relaxed text-muted/90 sm:text-[0.8rem]`}>
              <strong className="font-semibold text-ink/80">Disclaimer:</strong> {PRODUCT_DISCLAIMER}
            </p>
          </div>

          <ul className="mt-6 space-y-3 border-t border-sand pt-6 text-sm text-muted">
            <li className="flex gap-3">
              <Ruler className="mt-0.5 size-4 shrink-0 text-gold-deep" /> Fittings and custom sizes available — send your measurements on WhatsApp.
            </li>
            <li className="flex gap-3">
              <Store className="mt-0.5 size-4 shrink-0 text-gold-deep" />
              <span>
                Try it in person at our store.{' '}
                <Link to="/" hash="visit" className="text-ink underline-offset-4 hover:underline">Visit Aura Luxe</Link>
              </span>
            </li>
          </ul>
        </div>
      </Wrap>

      {look.length > 0 && (
        <Wrap className="mt-16 md:mt-24">
          <CompleteTheLook item={item} look={look} />
        </Wrap>
      )}

      {similar.length > 0 && (
        <Wrap className="mt-16 md:mt-24">
          <SectionHeader title="You May Also Like" />
          <ItemGrid items={similar} />
        </Wrap>
      )}

      <RecentlyViewed exclude={item.id} />

      {/* Mobile: the enquiry action stays in reach, above the bottom navigation */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-sand bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{size ? `Size ${size}` : sizes.length ? 'Choose a size above' : item.name}{colour ? ` · ${colour}` : ''}</p>
          <p className="text-sm font-semibold">{formatPrice(item.price)}</p>
        </div>
        <a href={enquireHref} target="_blank" rel="noreferrer" className="btn btn-whatsapp px-4 text-[0.7rem]">
          <WhatsAppIcon className="size-4" /> Check availability
        </a>
      </div>
      <div className="h-16 lg:hidden" />
    </SiteLayout>
  )
}

function Gallery({ item }: { item: Item }) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)
  const track = useRef<HTMLDivElement>(null)
  const count = item.images.length

  useEffect(() => {
    setActive(0)
    track.current?.scrollTo({ left: 0 })
  }, [item.id])

  const show = (i: number) => {
    const next = (i + count) % count
    setActive(next)
    const el = track.current
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false)
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % count)
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, count])

  if (!count) {
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-lg bg-cream text-muted">
        <ImageOff className="size-10" />
      </div>
    )
  }

  return (
    <div className="-mx-4 flex flex-col gap-3 sm:mx-0 md:flex-row-reverse">
      <div className="group relative flex-1 overflow-hidden bg-cream sm:rounded-lg">
        {/* Swipeable on touch, arrow-driven on desktop */}
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget
            const i = Math.round(el.scrollLeft / el.clientWidth)
            if (i !== active) setActive(i)
          }}
          className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto"
        >
          {item.images.map((src, i) => (
            <button key={src} onClick={() => setZoom(true)} className="relative size-full shrink-0 snap-center cursor-zoom-in" aria-label={`View photo ${i + 1} full screen`}>
              <img
                src={cdn(src, 900)}
                srcSet={cdnSet(src, [480, 720, 900, 1200])}
                sizes="(min-width: 768px) 50vw, 100vw"
                alt={`${item.name} — photo ${i + 1} of ${count}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
        {count > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => show(active - 1)} />
            <GalleryArrow side="right" onClick={() => show(active + 1)} />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden">
              {item.images.map((src, i) => (
                <span key={src} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
              ))}
            </div>
          </>
        )}
        <WishlistButton id={item.id} name={item.name} className="absolute top-3 right-3" />
      </div>
      {count > 1 && (
        <div className="no-scrollbar hidden gap-2 md:flex md:w-20 md:flex-col">
          {item.images.map((src, i) => (
            <button
              key={src}
              onClick={() => show(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === active}
              className={`aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md border-2 transition ${i === active ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              <img src={cdn(src, 160)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div className="fade fixed inset-0 z-[80] flex items-center justify-center bg-ink/95" onClick={() => setZoom(false)} role="dialog" aria-modal="true" aria-label="Photo viewer">
          <button className="absolute top-4 right-4 grid size-11 place-items-center text-white/80 hover:text-white" aria-label="Close" autoFocus>
            <X className="size-7" />
          </button>
          <img src={cdn(item.images[active], 1600)} alt={item.name} className="max-h-[92vh] max-w-[94vw] object-contain" onClick={(e) => e.stopPropagation()} />
          {count > 1 && (
            <div onClick={(e) => e.stopPropagation()}>
              <GalleryArrow side="left" onClick={() => setActive((i) => (i - 1 + count) % count)} dark />
              <GalleryArrow side="right" onClick={() => setActive((i) => (i + 1) % count)} dark />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GalleryArrow({ side, onClick, dark }: { side: 'left' | 'right'; onClick: () => void; dark?: boolean }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 ${side === 'left' ? 'left-3' : 'right-3'} grid size-10 -translate-y-1/2 place-items-center rounded-full transition ${
        dark ? 'bg-white/10 text-white hover:bg-white/20' : 'hidden bg-white/90 text-ink shadow-sm md:grid md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
      }`}
    >
      <Icon className="size-5" />
    </button>
  )
}

function OptionGroup({
  label,
  options,
  value,
  onChange,
  disabled = [],
  aside,
}: {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
  disabled?: string[]
  aside?: React.ReactNode
}) {
  return (
    <fieldset className="mt-6">
      <div className="flex items-center justify-between">
        <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
          {label}
          {value && <span className="ml-2 font-normal tracking-normal normal-case text-muted">— {value}</span>}
        </legend>
        {aside}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const off = disabled.includes(o)
          return (
            <button
              key={o}
              type="button"
              disabled={off}
              onClick={() => onChange(value === o ? null : o)}
              aria-pressed={value === o}
              aria-label={off ? `${o} — Out of Stock` : o}
              className={`flex h-11 min-w-12 flex-col items-center justify-center rounded-md border px-3.5 text-sm leading-tight transition active:scale-95 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-cream disabled:text-muted/70 ${
                value === o ? 'border-ink bg-ink text-white' : 'border-sand bg-white text-ink hover:border-ink'
              }`}
            >
              <span className={off ? 'line-through' : ''}>{o}</span>
              {off && <span className="text-[0.55rem] font-medium uppercase tracking-wide">Out of Stock</span>}
            </button>
          )
        })}
      </div>
      {disabled.some((d) => options.includes(d)) && <p className="mt-2 text-xs text-muted">Out-of-stock sizes can’t be added to your bag — ask us on WhatsApp about restocks.</p>}
    </fieldset>
  )
}

function NotFound() {
  return (
    <SiteLayout>
      <Wrap className="grid min-h-[50vh] place-items-center py-20 text-center">
        <div>
          <p className="eyebrow">Aura Luxe</p>
          <h1 className="mt-3 font-display text-4xl">This piece has moved on</h1>
          <p className="mt-3 text-muted">It may have sold out or been removed from the collection.</p>
          <Link to="/shop" search={{}} className="btn btn-dark mt-8">
            See the collection
          </Link>
        </div>
      </Wrap>
    </SiteLayout>
  )
}
