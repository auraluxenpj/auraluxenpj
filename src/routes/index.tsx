import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Gem, MapPin, MessageCircle, Phone, Store } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Item } from '../../db/schema'
import { SiteLayout } from '@/components/SiteChrome'
import { ProductRail, SectionHeader, Wrap, underlineLink } from '@/components/Section'
import { CompleteTheLook } from '@/components/CompleteTheLook'
import { PromoBanner, usePromo } from '@/components/Promo'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { GREETING, PRICE_RANGES, cdn, cdnSet, crossedPrice, discountPercent, whatsappLink } from '@/lib/format'
import { OCCASIONS, inPriceRange, isOnOffer, lookFor, newestFirst } from '@/lib/catalog'
import { useSite } from '@/lib/site'
import { COLLECTIONS, collectionItems } from '@/lib/collections'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, absoluteUrl, jsonLd, seo } from '@/lib/seo'

// Opening hero: the ivory anarkali twirl, paired with the front pose on desktop
const HERO = ['/img/hero-anarkali-twirl.jpg', '/img/hero-anarkali-front.jpg']
const HERO_WIDTHS = [480, 800, 1080, 1350]
// Wide boutique interior, used for the store and social sections
const STORE = '/img/hero.jpg'

export const Route = createFileRoute('/')({
  // Old catalogue links (/?c=<category|clearance>) now live on the listing page
  validateSearch: (search: Record<string, unknown>): { c?: string } => ({
    c: typeof search.c === 'string' || typeof search.c === 'number' ? String(search.c) : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.c) throw redirect({ to: '/shop', search: { c: search.c } })
  },
  head: ({ matches }) => {
    const page = seo({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: '/' })
    const root = matches[0]?.loaderData as { whatsapp?: string; store?: Record<string, string> } | undefined
    return {
      meta: page.meta,
      scripts: [jsonLd(businessSchema(root?.store ?? {}, root?.whatsapp ?? ''))],
      links: [
        ...page.links,
        {
          rel: 'preload',
          as: 'image',
          href: cdn(HERO[0], 800),
          imageSrcSet: cdnSet(HERO[0], HERO_WIDTHS),
          imageSizes: '(min-width: 1024px) 29vw, 100vw',
          fetchPriority: 'high',
        },
      ],
    }
  },
  component: Home,
})

/**
 * Organization data for search engines, built only from the store details the owner has entered in admin.
 * It becomes a ClothingStore (a LocalBusiness) once a store address is set.
 */
function businessSchema(store: Record<string, string>, whatsapp: string) {
  const sameAs = [store.instagram, store.tiktok, store.facebook].filter(Boolean)
  const telephone = store.store_phone || (whatsapp ? `+${whatsapp}` : '')
  return {
    '@context': 'https://schema.org',
    '@type': store.store_address ? 'ClothingStore' : 'Organization',
    name: SITE_NAME,
    alternateName: 'AURALUXE',
    url: `${SITE_URL}/`,
    image: absoluteUrl(`/.netlify/images?url=${STORE}&w=1200&fm=jpg`),
    description: SITE_DESCRIPTION,
    ...(!!telephone && { telephone }),
    ...(!!store.store_address && {
      address: { '@type': 'PostalAddress', streetAddress: store.store_address.replace(/\s*\n\s*/g, ', '), addressCountry: 'NP' },
    }),
    ...(!!store.store_map_url && { hasMap: store.store_map_url }),
    ...(sameAs.length > 0 && { sameAs }),
  }
}

function Home() {
  const { items } = useSite()
  const offers = useMemo(() => items.filter(isOnOffer), [items])
  const newest = useMemo(() => newestFirst(items).slice(0, 8), [items])
  const tagged = items.filter((i) => i.badge === 'trending' || i.badge === 'bestseller')
  const trending = (tagged.length ? tagged : items.filter((i) => i.featured)).slice(0, 8)
  const lookItem = items.find((i) => lookFor(i, items).length > 0)
  const promo = usePromo()
  const hasBanner = Boolean(promo.banner || promo.upcoming[0]?.startsAt)

  return (
    <SiteLayout>
      <h1 className="sr-only">Aura Luxe — women’s fashion boutique</h1>
      <Hero offers={offers} />

      {hasBanner && (
        <Wrap className="mt-10 md:mt-14">
          <PromoBanner />
        </Wrap>
      )}

      <Categories />

      {newest.length > 0 && (
        <Wrap className="mt-16 md:mt-24">
          <SectionHeader
            title="New Arrivals"
            subtitle="Fresh styles just landed."
            action={
              <Link to="/shop" search={{ c: 'new', sort: 'new' }} className={underlineLink}>
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ProductRail items={newest} label="New arrivals" />
        </Wrap>
      )}

      {offers.length > 0 && <Offers offers={offers} />}

      {trending.length > 0 && (
        <Wrap className="mt-16 md:mt-24">
          <SectionHeader
            title="Trending Now"
            subtitle={tagged.length ? 'The pieces everyone is asking about.' : 'Signature pieces, chosen by Aura Luxe.'}
            action={
              <Link to="/shop" search={{}} className={underlineLink}>
                Shop all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ProductRail items={trending} label="Trending now" />
        </Wrap>
      )}

      <Budget />

      {lookItem && (
        <Wrap className="mt-16 md:mt-24">
          <CompleteTheLook item={lookItem} look={lookFor(lookItem, items)} />
        </Wrap>
      )}
      <Styling />

      <WhyAuraLuxe />

      {/* "Loved by our customers" appears here once genuine reviews are collected — none are shown until then. */}

      <Social />

      <Visit />
    </SiteLayout>
  )
}

/* ---------------- Hero ---------------- */

type Slide = {
  key: string
  eyebrow: string
  title: string
  message?: string
  text: string
  images: string[]
  primary: React.ReactNode
  secondary: React.ReactNode
}

function Hero({ offers }: { offers: Item[] }) {
  const { items } = useSite()
  const festive = items.filter((i) => i.images[0] && i.occasions.some((o) => o === 'Festive' || o === 'Wedding'))
  const maxOff = Math.max(0, ...offers.map((i) => (crossedPrice(i) != null && i.price != null ? discountPercent(i.price, crossedPrice(i)!) : 0)))

  const newArrivals = (
    <Link to="/shop" search={{ c: 'new', sort: 'new' }} className="btn btn-ghost-light">
      New Arrivals
    </Link>
  )
  const slides: Slide[] = [
    {
      key: 'new',
      eyebrow: 'Women’s fashion · New collection',
      title: 'AURA LUXE',
      message: 'Fashion that feels like you.',
      text: 'Discover styles for every occasion.',
      images: HERO,
      primary: <Link to="/shop" search={{}} className="btn btn-light">Shop Now</Link>,
      secondary: newArrivals,
    },
  ]
  if (festive.length) {
    slides.push({
      key: 'festive',
      eyebrow: 'Festive collection',
      title: 'Made for celebrations',
      text: 'Sarees, anarkalis and lehengas for festive days and wedding season.',
      images: festive.slice(0, 2).map((i) => i.images[0]),
      primary: <Link to="/shop" search={{ occasion: 'Festive,Wedding' }} className="btn btn-light">Shop Festive</Link>,
      secondary: newArrivals,
    })
  }
  const offerImages = offers.map((i) => i.images[0]).filter(Boolean)
  if (offers.length) {
    slides.push({
      key: 'offers',
      eyebrow: 'Aura Luxe specials',
      title: maxOff >= 5 ? `Up to ${maxOff}% off` : 'Clearance edit',
      text: 'Limited pieces. While stocks last.',
      images: (offerImages.length ? offerImages : HERO).slice(0, 2),
      primary: <Link to="/shop" search={{ c: 'offers' }} className="btn btn-light">Shop Offers</Link>,
      secondary: newArrivals,
    })
  }

  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  // Later slides' photos load only after the first paint so the hero image gets the bandwidth
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setActive((i) => (i + 1) % slides.length), 6500)
    return () => clearInterval(t)
  }, [slides.length, paused])

  const go = (d: number) => setActive((i) => (i + d + slides.length) % slides.length)

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-[min(76svh,600px)] overflow-hidden bg-ink text-white sm:h-[min(72vh,620px)] lg:h-[min(80vh,660px)]"
    >
      {slides.map((s, i) => {
        const current = i === active
        const load = i === 0 || ready
        return (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${s.eyebrow}`}
            aria-hidden={!current}
            inert={!current}
            className={`absolute inset-0 transition-opacity duration-700 ${current ? 'z-10 opacity-100' : 'z-0 opacity-0'}`}
          >
            {/* Photos: full-bleed on mobile; on desktop two portrait shots sit side by side beside the text */}
            <div className="absolute inset-0 lg:left-[42%] lg:grid lg:grid-cols-2 lg:gap-1">
              {load &&
                s.images.map((src, n) => (
                  <img
                    key={src}
                    src={cdn(src, 800)}
                    srcSet={cdnSet(src, i === 0 ? HERO_WIDTHS : [480, 800, 928])}
                    sizes="(min-width: 1024px) 29vw, 100vw"
                    alt={
                      i === 0
                        ? n === 0
                          ? 'A model twirling in an ivory anarkali with a gold-trimmed hem and dupatta, framed by marigold garlands'
                          : 'The same ivory and gold anarkali, worn with the dupatta draped over one arm'
                        : `${s.eyebrow} at Aura Luxe`
                    }
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    decoding="async"
                    className={`size-full object-cover object-top ${n > 0 ? 'hidden lg:block' : ''}`}
                  />
                ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/0 lg:hidden" />
            <div className="relative flex h-full items-end lg:w-[42%] lg:items-center lg:bg-ink">
              <div className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8 lg:pb-0">
                <div className={`max-w-lg ${current ? 'rise' : ''}`}>
                  <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-soft">{s.eyebrow}</p>
                  <p className={`mt-3 font-display leading-[1.02] ${s.key === 'new' ? 'text-[2.9rem] tracking-[0.14em] sm:text-6xl lg:text-5xl xl:text-6xl' : 'text-[2.3rem] sm:text-5xl lg:text-[3.4rem]'}`}>
                    {s.title}
                  </p>
                  {s.message && <p className="mt-3 font-display text-xl italic text-white/95 sm:text-2xl">{s.message}</p>}
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">{s.text}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {s.primary}
                    {s.secondary}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-5 z-20 mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setActive(i)}
                aria-label={`Show slide ${i + 1}: ${s.eyebrow}`}
                aria-current={i === active}
                className="grid h-6 place-items-center"
              >
                <span className={`block h-0.5 rounded-full transition-all ${i === active ? 'w-9 bg-white' : 'w-5 bg-white/45'}`} />
              </button>
            ))}
          </div>
          <div className="hidden gap-2 sm:flex">
            <button onClick={() => go(-1)} aria-label="Previous slide" className="grid size-10 place-items-center rounded-full border border-white/40 transition hover:bg-white hover:text-ink">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => go(1)} aria-label="Next slide" className="grid size-10 place-items-center rounded-full border border-white/40 transition hover:bg-white hover:text-ink">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------------- Shop by category ---------------- */

function Categories() {
  const { categories, items } = useSite()
  const tiles = categories
    .map((c) => {
      const list = items.filter((i) => i.categoryId === c.id)
      return { id: String(c.id), name: c.name, count: list.length, cover: list.find((i) => i.images[0])?.images[0] }
    })
    .filter((t) => t.count > 0)
  const other = items.filter((i) => i.categoryId == null)
  if (other.length) tiles.push({ id: 'other', name: 'Other', count: other.length, cover: other.find((i) => i.images[0])?.images[0] })
  if (!tiles.length) return null
  const styles = COLLECTIONS.filter((c) => collectionItems(c, items, categories).length)

  const cols = ['', 'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4', 'md:grid-cols-5'][Math.min(tiles.length, 5)]
  return (
    <Wrap className="mt-12 md:mt-20">
      <div id="categories" className="scroll-mt-20" />
      <SectionHeader title="Shop by Category" />
      <div className={`no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:overflow-visible md:px-0 lg:gap-5 ${cols}`}>
        {tiles.map((t) => (
          <Link
            key={t.id}
            to="/shop"
            search={{ c: t.id }}
            className="group relative aspect-[3/4] w-[42vw] max-w-56 shrink-0 snap-start overflow-hidden rounded-lg bg-cream md:w-auto md:max-w-none"
          >
            {t.cover && (
              <img
                src={cdn(t.cover, 480)}
                srcSet={cdnSet(t.cover, [320, 480, 720])}
                sizes="(min-width: 768px) 22vw, 42vw"
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover object-top transition duration-700 group-hover:scale-[1.04]"
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
            <span className="absolute inset-x-0 bottom-0 p-3 text-white md:p-4">
              <span className="block font-display text-lg leading-tight md:text-xl">{t.name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[0.68rem] uppercase tracking-[0.16em] text-white/80">
                {t.count} {t.count === 1 ? 'style' : 'styles'} <ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        ))}
      </div>
      {styles.length > 0 && (
        <nav aria-label="Shop by style" className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted">Shop by style</span>
          {styles.map((c) => (
            <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }} className="rounded-full border border-sand bg-white px-4 py-2 text-sm transition hover:border-ink">
              {c.label}
            </Link>
          ))}
        </nav>
      )}
    </Wrap>
  )
}

/* ---------------- Offers ---------------- */

const SHORTCUTS = [
  { label: 'Under Rs. 999', price: 'u999' },
  { label: 'Under Rs. 1,499', price: 'u999,999-1499' },
  { label: 'Under Rs. 2,499', price: 'u999,999-1499,1499-2499' },
]

function Offers({ offers }: { offers: Item[] }) {
  const maxOff = Math.max(0, ...offers.map((i) => (crossedPrice(i) != null && i.price != null ? discountPercent(i.price, crossedPrice(i)!) : 0)))
  const cover = offers.find((i) => i.images[0])?.images[0]
  return (
    <Wrap className="mt-16 md:mt-24">
      <section aria-labelledby="offers-title" className="grid overflow-hidden rounded-xl bg-ink text-white md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold">Aura Luxe Specials</p>
          <h2 id="offers-title" className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {maxOff >= 5 ? `Up to ${maxOff}% off` : 'Clearance pieces'}
          </h2>
          <p className="mt-3 text-white/75">Limited pieces. While stocks last.</p>
          <div className="mt-7">
            <Link to="/shop" search={{ c: 'offers' }} className="btn btn-light">
              Shop Offers <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 border-t border-white/15 pt-6">
            {SHORTCUTS.map((s) => (
              <Link
                key={s.label}
                to="/shop"
                search={{ price: s.price }}
                className="rounded-md border border-white/25 px-3.5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition hover:border-gold hover:text-gold"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
        {cover && (
          <div className="relative aspect-[4/3] md:aspect-auto">
            <img src={cdn(cover, 800)} srcSet={cdnSet(cover, [480, 800, 928])} sizes="(min-width: 768px) 45vw, 100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-top" />
          </div>
        )}
      </section>
    </Wrap>
  )
}

/* ---------------- Shop by budget ---------------- */

function Budget() {
  const { items } = useSite()
  return (
    <Wrap className="mt-16 md:mt-24">
      <SectionHeader title="Shop by Budget" subtitle="Beautiful pieces at every price." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {PRICE_RANGES.map((r, i) => {
          const count = items.filter((it) => inPriceRange(it.price, r.key)).length
          return (
            <Link
              key={r.key}
              to="/shop"
              search={{ price: r.key }}
              className={`group flex flex-col justify-between rounded-lg border border-sand bg-white p-4 transition hover:border-ink sm:p-5 ${i === PRICE_RANGES.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">
                {r.key === '5000' ? 'Premium' : r.key === 'u999' ? 'Under' : 'Rs.'}
              </span>
              <span className="mt-2 font-display text-2xl text-ink sm:text-[1.7rem]">
                {r.key === 'u999' ? 'Rs. 999' : r.key === '5000' ? 'Rs. 5,000+' : r.short}
              </span>
              <span className="mt-3 flex items-center gap-1 text-xs text-muted group-hover:text-ink">
                {count ? `${count} ${count === 1 ? 'style' : 'styles'}` : 'Browse'} <ArrowRight className="size-3" />
              </span>
            </Link>
          )
        })}
      </div>
    </Wrap>
  )
}

/* ---------------- Styling ---------------- */

function Styling() {
  const { items } = useSite()
  const used = new Set<string>()
  const tiles = OCCASIONS.map((o) => {
    const matches = items.filter((i) => i.occasions.includes(o) && i.images[0])
    const pick = matches.find((i) => !used.has(i.images[0])) ?? matches[0]
    if (pick) used.add(pick.images[0])
    return { occasion: o, count: matches.length, cover: pick?.images[0] }
  }).filter((t) => t.count > 0)
  if (tiles.length < 2) return null

  return (
    <Wrap className="mt-16 md:mt-24">
      <SectionHeader title="How would you wear it?" subtitle="Find your look by occasion." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-5">
        {tiles.slice(0, 4).map((t) => (
          <Link key={t.occasion} to="/shop" search={{ occasion: t.occasion }} className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-cream">
            {t.cover && (
              <img src={cdn(t.cover, 480)} srcSet={cdnSet(t.cover, [320, 480, 720])} sizes="(min-width: 768px) 23vw, 47vw" alt="" loading="lazy" decoding="async" className="size-full object-cover object-top transition duration-700 group-hover:scale-[1.04]" />
            )}
            <span className="absolute inset-0 bg-black/15 transition group-hover:bg-black/25" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="rounded-md bg-white/95 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-ink">{t.occasion}</span>
            </span>
          </Link>
        ))}
      </div>
    </Wrap>
  )
}

/* ---------------- Why Aura Luxe ---------------- */

const BENEFITS: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }[] = [
  { icon: Gem, title: 'Curated Fashion', text: 'Bridal, festive and everyday pieces, chosen one by one.' },
  { icon: MessageCircle, title: 'Personal Assistance', text: 'We answer with sizes, colours and fittings — altered or made to your measurements.' },
  { icon: Store, title: 'Physical Store', text: 'Visit the store to try pieces in person before you decide.' },
  { icon: WhatsAppIcon, title: 'Easy WhatsApp Ordering', text: 'Tap “Check availability” — your message is written for you.' },
]

function WhyAuraLuxe() {
  return (
    <section aria-labelledby="about-title" className="mt-16 border-y border-sand bg-white py-14 md:mt-24 md:py-20">
      <div id="about" className="-mt-32 pt-32" />
      <Wrap>
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">About Aura Luxe</p>
          <h2 id="about-title" className="section-title mt-3">Why shop Aura Luxe?</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            A women’s fashion boutique for bridal, festive and everyday wear — browse from home, then let us help you find the
            right piece and the right fit.
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full border border-sand text-gold-deep">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.1em] text-ink">{title}</p>
              <p className="mx-auto mt-2 max-w-60 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  )
}

/* ---------------- Social ---------------- */

function Social() {
  const { store, items } = useSite()
  const profile = store.instagram || store.tiktok || store.facebook
  if (!profile) return null
  const photos = [...new Set([STORE, ...items.flatMap((i) => i.images)])]
  const grid = photos.slice(0, Math.min(9, Math.floor(photos.length / 3) * 3))
  if (!grid.length) return null
  const network = store.instagram ? 'Instagram' : store.tiktok ? 'TikTok' : 'Facebook'

  return (
    <Wrap className="mt-16 md:mt-24">
      <SectionHeader
        title="Follow the Aura"
        subtitle={`New pieces and styling, first on ${network}.`}
        action={
          <a href={profile} target="_blank" rel="noreferrer" className={underlineLink}>
            Follow us <ArrowRight className="size-3.5" />
          </a>
        }
      />
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-1.5 sm:gap-2">
        {grid.map((src) => (
          <a key={src} href={profile} target="_blank" rel="noreferrer" aria-label={`Aura Luxe on ${network}`} className="group aspect-square overflow-hidden rounded-md bg-cream">
            <img src={cdn(src, 360)} srcSet={cdnSet(src, [240, 360, 480])} sizes="(min-width: 768px) 250px, 33vw" alt="" loading="lazy" decoding="async" className="size-full object-cover object-top transition duration-500 group-hover:scale-105" />
          </a>
        ))}
      </div>
    </Wrap>
  )
}

/* ---------------- Visit ---------------- */

function Visit() {
  const { store, whatsapp } = useSite()
  const directions =
    store.store_map_url || (store.store_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Aura Luxe, ${store.store_address}`)}` : '')
  const phoneDigits = store.store_phone.replace(/[^\d+]/g, '')

  return (
    <Wrap className="mt-16 md:mt-24">
      <div id="visit" className="-mt-24 pt-24" />
      <section aria-labelledby="visit-title" className="grid overflow-hidden rounded-xl border border-sand bg-white md:grid-cols-2">
        <div className="relative aspect-[16/10] md:aspect-auto">
          <img
            src={cdn(STORE, 900)}
            srcSet={cdnSet(STORE, [640, 900, 1200])}
            sizes="(min-width: 768px) 50vw, 100vw"
            alt="Inside the Aura Luxe boutique"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover object-[35%_center]"
          />
        </div>
        <div className="p-7 sm:p-10 lg:p-12">
          <p className="eyebrow">Our store</p>
          <h2 id="visit-title" className="section-title mt-3">Visit Aura Luxe</h2>
          <p className="mt-2 font-display text-xl italic text-muted">Try it. Feel it. Love it.</p>

          <ul className="mt-7 space-y-4 text-sm">
            {store.store_address ? (
              <VisitRow icon={<MapPin className="size-4" />} label="Address">
                <span className="whitespace-pre-line">{store.store_address}</span>
              </VisitRow>
            ) : (
              <VisitRow icon={<MapPin className="size-4" />} label="Find us">
                Message us on WhatsApp for directions and timings.
              </VisitRow>
            )}
            {store.store_hours && (
              <VisitRow icon={<Clock className="size-4" />} label="Opening hours">
                <span className="whitespace-pre-line">{store.store_hours}</span>
              </VisitRow>
            )}
            {store.store_phone && (
              <VisitRow icon={<Phone className="size-4" />} label="Phone">
                <a href={`tel:${phoneDigits}`} className="underline-offset-4 hover:underline">{store.store_phone}</a>
              </VisitRow>
            )}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={whatsappLink(whatsapp, GREETING)} target="_blank" rel="noreferrer" className="btn btn-whatsapp">
              <WhatsAppIcon className="size-4" /> WhatsApp us
            </a>
            {directions && (
              <a href={directions} target="_blank" rel="noreferrer" className="btn btn-outline">
                <MapPin className="size-4" /> Get directions
              </a>
            )}
          </div>
        </div>
      </section>
    </Wrap>
  )
}

function VisitRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 text-gold-deep">{icon}</span>
      <span>
        <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
        <span className="mt-0.5 block text-ink">{children}</span>
      </span>
    </li>
  )
}
