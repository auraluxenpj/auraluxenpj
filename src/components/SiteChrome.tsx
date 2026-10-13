import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Heart, Home, Menu, Search, ShoppingBag, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { WhatsAppIcon } from './WhatsAppIcon'
import { AnnouncementBar } from './Promo'
import { GREETING, cdn, formatPhone, formatPrice, whatsappLink } from '@/lib/format'
import { searchItems } from '@/lib/catalog'
import { useSite } from '@/lib/site'
import { bag, searchOpen, wishlist } from '@/lib/store'

export const TRENDING_SEARCHES = ['Kurti', 'Saree', 'Party Wear', 'Co-ord Set', 'Festive']

/**
 * Storefront shell shared by every customer-facing page: header, search, footer,
 * mobile bottom navigation and the floating WhatsApp button.
 */
export function SiteLayout({
  children,
  chatHref,
  hideFloatingOnMobile = false,
}: {
  children: React.ReactNode
  chatHref?: string
  hideFloatingOnMobile?: boolean
}) {
  const { whatsapp } = useSite()
  const href = chatHref ?? whatsappLink(whatsapp, GREETING)
  return (
    <div className="flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <a href="#main" className="sr-only z-[80] rounded-md bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <AnnouncementBar />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
      <FloatingWhatsApp href={href} hideOnMobile={hideFloatingOnMobile} />
      <SearchOverlay />
    </div>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" aria-label="Aura Luxe home" className={`font-display text-[1.2rem] leading-none font-medium tracking-[0.3em] whitespace-nowrap text-ink sm:text-[1.35rem] ${className}`}>
      AURA<span className="text-gold">·</span>LUXE
    </Link>
  )
}

const navClass =
  'relative py-1 text-[0.74rem] font-medium uppercase tracking-[0.16em] text-ink/85 transition hover:text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-gold after:transition hover:after:scale-x-100'

function NavLinks({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  return (
    <>
      <Link to="/shop" search={{}} className={className} onClick={onNavigate}>Women</Link>
      <Link to="/shop" search={{ c: 'new', sort: 'new' }} className={className} onClick={onNavigate}>New Arrivals</Link>
      <Link to="/" hash="categories" className={className} onClick={onNavigate}>Collections</Link>
      <Link to="/shop" search={{ c: 'offers' }} className={className} onClick={onNavigate}>Offers</Link>
      <Link to="/" hash="about" className={className} onClick={onNavigate}>About</Link>
      <Link to="/" hash="visit" className={className} onClick={onNavigate}>Contact</Link>
    </>
  )
}

function CountBadge({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="absolute -top-0.5 -right-0.5 grid min-w-[1.05rem] place-items-center rounded-full bg-ink px-1 text-[0.6rem] leading-[1.05rem] font-semibold text-white">
      {n > 9 ? '9+' : n}
    </span>
  )
}

const iconBtn = 'relative grid size-11 place-items-center rounded-full text-ink transition hover:bg-cream'

export function SiteHeader() {
  const { whatsapp } = useSite()
  const saved = wishlist.use().length
  const inBag = bag.use().length
  const [menu, setMenu] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-sand bg-ivory/95 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-2 sm:px-4 lg:h-16 lg:grid-cols-[auto_1fr_auto] lg:gap-8 lg:px-8">
          {/* Mobile: menu · logo · wishlist · bag */}
          <button onClick={() => setMenu(true)} className={`${iconBtn} lg:hidden`} aria-label="Open menu" aria-expanded={menu}>
            <Menu className="size-[22px]" strokeWidth={1.6} />
          </button>
          <Logo className="justify-self-center lg:justify-self-start" />
          <nav aria-label="Main" className="hidden items-center justify-center gap-7 lg:flex xl:gap-9">
            <NavLinks className={navClass} />
          </nav>
          <div className="flex items-center justify-self-end">
            <button onClick={() => searchOpen.set(true)} className={`${iconBtn} hidden lg:grid`} aria-label="Search">
              <Search className="size-5" strokeWidth={1.6} />
            </button>
            <Link to="/wishlist" className={iconBtn} aria-label={`Wishlist${saved ? `, ${saved} saved` : ''}`}>
              <Heart className="size-5" strokeWidth={1.6} />
              <CountBadge n={saved} />
            </Link>
            <Link to="/bag" className={iconBtn} aria-label={`Bag${inBag ? `, ${inBag} pieces` : ''}`}>
              <ShoppingBag className="size-5" strokeWidth={1.6} />
              <CountBadge n={inBag} />
            </Link>
            <a
              href={whatsappLink(whatsapp, GREETING)}
              target="_blank"
              rel="noreferrer"
              className="ml-2 hidden h-9 items-center gap-2 rounded-md bg-whatsapp px-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink transition hover:brightness-105 lg:inline-flex"
            >
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Prominent search field under the mobile header */}
      <div className="border-b border-sand bg-ivory px-4 py-2.5 sm:px-6 lg:hidden">
        <button
          onClick={() => searchOpen.set(true)}
          className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-sand bg-white px-3.5 text-left text-sm text-muted"
        >
          <Search className="size-[18px] text-ink" strokeWidth={1.6} />
          Search products, styles, colours...
        </button>
      </div>

      {menu && <MobileMenu onClose={() => setMenu(false)} />}
    </>
  )
}

function useOverlay(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { categories, items, whatsapp } = useSite()
  useOverlay(onClose)
  const used = new Set(items.map((i) => i.categoryId))
  const link = 'flex min-h-12 items-center border-b border-sand text-sm font-medium uppercase tracking-[0.14em] text-ink'
  return (
    <div className="fade fixed inset-0 z-[70] bg-ink/40 lg:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onClick={(e) => e.stopPropagation()}
        className="drawer flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-ivory"
      >
        <div className="flex h-14 items-center justify-between border-b border-sand px-4">
          <Logo />
          <button onClick={onClose} className={iconBtn} aria-label="Close menu" autoFocus>
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Menu" className="flex flex-col px-5 pt-2">
          <NavLinks className={link} onNavigate={onClose} />
        </nav>
        {categories.some((c) => used.has(c.id)) && (
          <div className="px-5 pt-7">
            <p className="eyebrow">Shop by category</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories
                .filter((c) => used.has(c.id))
                .map((c) => (
                  <Link key={c.id} to="/shop" search={{ c: String(c.id) }} onClick={onClose} className="rounded-md border border-sand bg-white px-3.5 py-2 text-sm">
                    {c.name}
                  </Link>
                ))}
            </div>
          </div>
        )}
        <div className="mt-auto p-5">
          <a href={whatsappLink(whatsapp, GREETING)} target="_blank" rel="noreferrer" className="btn btn-whatsapp w-full">
            <WhatsAppIcon className="size-4" /> Chat with Aura Luxe
          </a>
        </div>
      </div>
    </div>
  )
}

export function SearchOverlay() {
  const open = searchOpen.use()
  if (!open) return null
  return <SearchPanel onClose={() => searchOpen.set(false)} />
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { index } = useSite()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useOverlay(onClose)
  useEffect(() => input.current?.focus(), [])

  const results = useMemo(() => (query.trim() ? searchItems(index, query) : []), [index, query])

  const go = (q: string) => {
    onClose()
    navigate({ to: '/shop', search: { q } })
  }

  return (
    <div className="fade fixed inset-0 z-[70] bg-ink/40 lg:pt-16" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-full max-w-2xl flex-col bg-ivory shadow-2xl lg:h-auto lg:max-h-[80vh] lg:rounded-xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (query.trim()) go(query.trim())
          }}
          className="flex items-center gap-2 border-b border-sand px-3 py-2.5"
        >
          <Search className="ml-1 size-5 shrink-0 text-muted" strokeWidth={1.6} />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            enterKeyHint="search"
            aria-label="Search products, styles, colours"
            placeholder="Search products, styles, colours..."
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <button type="button" onClick={onClose} className={iconBtn} aria-label="Close search">
            <X className="size-5" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {!query.trim() ? (
            <div>
              <p className="eyebrow">Trending searches</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TRENDING_SEARCHES.map((t) => (
                  <button key={t} onClick={() => go(t)} className="rounded-md border border-sand bg-white px-3.5 py-2 text-sm transition hover:border-ink">
                    {t}
                  </button>
                ))}
                <Link to="/shop" search={{ c: 'new', sort: 'new' }} onClick={onClose} className="rounded-md border border-sand bg-white px-3.5 py-2 text-sm transition hover:border-ink">
                  New Arrivals
                </Link>
              </div>
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Nothing matches “{query}”. Try another colour or style — or ask us on WhatsApp.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted" aria-live="polite">
                {results.length} {results.length === 1 ? 'style' : 'styles'}
              </p>
              <ul className="mt-2 divide-y divide-sand">
                {results.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <Link to="/item/$itemId" params={{ itemId: String(item.id) }} onClick={onClose} className="flex items-center gap-3 py-2.5 transition hover:bg-cream/60">
                      <span className="aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-md bg-cream">
                        {item.images[0] && <img src={cdn(item.images[0], 120)} alt="" loading="lazy" className="size-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="mt-0.5 block text-sm text-muted">{formatPrice(item.price)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {results.length > 0 && (
                <button onClick={() => go(query.trim())} className="btn btn-outline mt-4 w-full">
                  See all {results.length} results <ArrowRight className="size-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BottomNav() {
  const path = useLocation({ select: (l) => l.pathname })
  const saved = wishlist.use().length
  const inBag = bag.use().length
  const item = (active: boolean) =>
    `relative flex flex-1 flex-col items-center justify-center gap-1 text-[0.64rem] font-medium uppercase tracking-[0.1em] ${active ? 'text-ink' : 'text-muted'}`
  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-sand bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <Link to="/" className={item(path === '/')}>
        <Home className="size-[21px]" strokeWidth={1.6} /> Home
      </Link>
      <button onClick={() => searchOpen.set(true)} className={item(false)}>
        <Search className="size-[21px]" strokeWidth={1.6} /> Search
      </button>
      <Link to="/wishlist" className={item(path === '/wishlist')}>
        <span className="relative">
          <Heart className="size-[21px]" strokeWidth={1.6} />
          <CountBadge n={saved} />
        </span>
        Wishlist
      </Link>
      <Link to="/bag" className={item(path === '/bag')}>
        <span className="relative">
          <ShoppingBag className="size-[21px]" strokeWidth={1.6} />
          <CountBadge n={inBag} />
        </span>
        Bag
      </Link>
    </nav>
  )
}

export function FloatingWhatsApp({ href, hideOnMobile = false }: { href: string; hideOnMobile?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Aura Luxe on WhatsApp"
      className={`fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 items-center gap-2 rounded-full bg-whatsapp text-ink shadow-[0_8px_24px_-8px_rgba(17,17,17,0.45)] transition hover:brightness-105 active:scale-95 lg:right-6 lg:bottom-6 lg:flex lg:h-12 lg:px-5 ${
        hideOnMobile ? 'hidden' : 'grid size-13 place-items-center lg:size-auto'
      }`}
    >
      <WhatsAppIcon className="size-6 lg:size-5" />
      <span className="hidden text-sm font-semibold lg:inline">Chat with Aura Luxe</span>
    </a>
  )
}

export function SiteFooter() {
  const { whatsapp, store, categories } = useSite()
  const catId = (name: string) => categories.find((c) => c.name.toLowerCase().startsWith(name.toLowerCase()))?.id
  const shopLink = (label: string, term: string) => {
    const id = catId(term)
    return id != null ? (
      <Link to="/shop" search={{ c: String(id) }}>{label}</Link>
    ) : (
      <Link to="/shop" search={{ q: term }}>{label}</Link>
    )
  }
  const socials = [
    ['Instagram', store.instagram],
    ['TikTok', store.tiktok],
    ['Facebook', store.facebook],
  ].filter(([, url]) => url)

  return (
    <footer className="mt-20 bg-ink text-white/90 md:mt-28">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
        <div className="col-span-2 md:col-span-1">
          <p className="font-display text-2xl tracking-[0.3em] text-white">
            AURA<span className="text-gold">·</span>LUXE
          </p>
          <p className="mt-3 font-display text-lg text-white/75 italic">Fashion that feels like you.</p>
          <a
            href={whatsappLink(whatsapp, GREETING)}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-md border border-white/25 px-4 text-sm transition hover:border-whatsapp hover:text-whatsapp"
          >
            <WhatsAppIcon className="size-4" /> {formatPhone(whatsapp)}
          </a>
        </div>
        <FooterColumn title="Shop">
          <Link to="/shop" search={{ c: 'new', sort: 'new' }}>New Arrivals</Link>
          <Link to="/shop" search={{}}>Women</Link>
          {shopLink('Kurtis', 'kurti')}
          {shopLink('Sarees', 'saree')}
          {shopLink('Western', 'western')}
          {shopLink('Ethnic', 'ethnic')}
          <Link to="/shop" search={{ c: 'offers' }}>Offers</Link>
        </FooterColumn>
        <FooterColumn title="Help">
          <Link to="/" hash="visit">Contact</Link>
          <a href={whatsappLink(whatsapp, GREETING)} target="_blank" rel="noreferrer">WhatsApp</a>
          <Link to="/help" hash="size-guide">Size Guide</Link>
          {store.store_map_url ? (
            <a href={store.store_map_url} target="_blank" rel="noreferrer">Store Location</a>
          ) : (
            <Link to="/" hash="visit">Store Location</Link>
          )}
          <Link to="/help" hash="faqs">FAQs</Link>
        </FooterColumn>
        <FooterColumn title="Follow">
          {socials.length ? (
            socials.map(([label, url]) => (
              <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>
            ))
          ) : (
            <a href={whatsappLink(whatsapp, GREETING)} target="_blank" rel="noreferrer">Message us on WhatsApp</a>
          )}
        </FooterColumn>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-white/60 sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Aura Luxe · All prices in Nepali Rupees (Rs.)</span>
          <span className="flex gap-5">
            <Link to="/help" hash="privacy" className="hover:text-white">Privacy Policy</Link>
            <Link to="/help" hash="terms" className="hover:text-white">Terms &amp; Conditions</Link>
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold">{title}</p>
      <div className="mt-4 flex flex-col items-start gap-2.5 text-sm text-white/75 [&>a]:transition [&>a:hover]:text-white">{children}</div>
    </div>
  )
}
