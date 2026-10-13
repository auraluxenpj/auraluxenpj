import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Item } from '../../db/schema'
import { SiteLayout } from '@/components/SiteChrome'
import { ItemGrid } from '@/components/ItemCard'
import { Wrap } from '@/components/Section'
import { RecentlyViewed } from '@/components/RecentlyViewed'
import { PromoBanner, usePromo } from '@/components/Promo'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { PRICE_RANGES, whatsappLink } from '@/lib/format'
import {
  FILTER_KEYS,
  OCCASIONS,
  inCollection,
  inPriceRange,
  isOnOffer,
  isSoldOut,
  matchesFilter,
  searchItems,
  sortItems,
  sortSizes,
  splitParam,
} from '@/lib/catalog'
import type { FilterKey, ShopSearch } from '@/lib/catalog'
import { useSite } from '@/lib/site'

const SORTS = [
  { value: '', label: 'Recommended' },
  { value: 'new', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest discount' },
] as const

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : typeof v === 'number' ? String(v) : undefined)

export const Route = createFileRoute('/shop')({
  validateSearch: (s: Record<string, unknown>): ShopSearch => ({
    c: str(s.c),
    q: str(s.q),
    size: str(s.size),
    price: str(s.price),
    colour: str(s.colour),
    fabric: str(s.fabric),
    occasion: str(s.occasion),
    avail: s.avail === 'in' ? 'in' : undefined,
    sort: SORTS.some((o) => o.value && o.value === s.sort) ? (s.sort as ShopSearch['sort']) : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Shop women’s fashion — Aura Luxe' },
      { name: 'description', content: 'Browse Aura Luxe kurtas, sarees, lehengas and western wear. Filter by size, price, colour and occasion, then check availability on WhatsApp.' },
    ],
  }),
  component: Shop,
})

const LABELS: Record<FilterKey, string> = { size: 'Size', price: 'Price', colour: 'Colour', fabric: 'Fabric', occasion: 'Occasion' }

const uniqueCi = (values: string[]) => {
  const seen = new Map<string, string>()
  for (const v of values) if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
  return [...seen.values()]
}

function Shop() {
  const { items, categories, index, categoryName, whatsapp } = useSite()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/shop' })
  const [sheet, setSheet] = useState(false)
  const promo = usePromo()
  const hasBanner = Boolean(promo.banner || promo.upcoming[0]?.startsAt)

  const update = (patch: Partial<ShopSearch>) =>
    navigate({
      search: (prev) => {
        const next: Record<string, string | undefined> = { ...prev, ...patch }
        for (const k of Object.keys(next)) if (!next[k]) delete next[k]
        return next as ShopSearch
      },
      replace: true,
      resetScroll: false,
    })

  const { c, q } = search
  const title = q
    ? `“${q}”`
    : c === 'new'
      ? 'New Arrivals'
      : c === 'offers'
        ? 'Offers'
        : c === 'clearance'
          ? 'Clearance'
          : c === 'other'
            ? 'Other'
            : c
              ? categoryName.get(Number(c)) ?? 'Women'
              : 'Women'

  // Pieces in the chosen collection that match the search text — the base for facet options
  const base = useMemo(() => {
    const ids = new Set(items.filter((i) => inCollection(i, c)).map((i) => i.id))
    const found = q ? searchItems(index, q) : items
    return found.filter((i) => ids.has(i.id))
  }, [items, index, c, q])

  const selected = Object.fromEntries(FILTER_KEYS.map((k) => [k, splitParam(search[k])])) as Record<FilterKey, string[]>

  const visible = useMemo(() => {
    const list = base.filter((i) => FILTER_KEYS.every((k) => matchesFilter(i, k, selected[k])) && (search.avail !== 'in' || !isSoldOut(i)))
    return sortItems(list, search.sort ?? (c === 'new' ? 'new' : undefined))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, search.size, search.price, search.colour, search.fabric, search.occasion, search.avail, search.sort, c])

  const facets = useMemo(() => {
    const occ = uniqueCi(base.flatMap((i) => i.occasions))
    return {
      size: sortSizes(uniqueCi(base.flatMap((i) => i.sizes))),
      price: PRICE_RANGES.filter((r) => base.some((i) => inPriceRange(i.price, r.key))).map((r) => r.key as string),
      colour: uniqueCi(base.flatMap((i) => i.colors)).sort(),
      fabric: uniqueCi(base.map((i) => i.fabric)).sort(),
      occasion: [...OCCASIONS.filter((o) => occ.some((x) => x.toLowerCase() === o.toLowerCase())), ...occ.filter((o) => !OCCASIONS.includes(o))],
    } satisfies Record<FilterKey, string[]>
  }, [base])

  const toggle = (key: FilterKey, value: string) => {
    const cur = selected[key]
    const next = cur.some((v) => v.toLowerCase() === value.toLowerCase()) ? cur.filter((v) => v.toLowerCase() !== value.toLowerCase()) : [...cur, value]
    update({ [key]: next.join(',') || undefined })
  }
  const activeCount = FILTER_KEYS.reduce((n, k) => n + selected[k].length, 0) + (search.avail ? 1 : 0)
  const clearAll = () => update({ size: undefined, price: undefined, colour: undefined, fabric: undefined, occasion: undefined, avail: undefined })

  const collections = [
    { id: undefined, label: 'All' },
    { id: 'new', label: 'New Arrivals' },
    ...(items.some(isOnOffer) ? [{ id: 'offers', label: 'Offers' }] : []),
    ...categories.filter((cat) => items.some((i) => i.categoryId === cat.id)).map((cat) => ({ id: String(cat.id), label: cat.name })),
    ...(items.some((i) => i.categoryId == null) ? [{ id: 'other', label: 'Other' }] : []),
  ]

  const panel = (
    <FilterPanel
      collections={collections}
      active={c}
      facets={facets}
      selected={selected}
      base={base}
      avail={search.avail === 'in'}
      onToggle={toggle}
      onAvail={() => update({ avail: search.avail ? undefined : 'in' })}
      onCollection={(id) => update({ c: id })}
    />
  )

  const wanted = [q, ...FILTER_KEYS.flatMap((k) => (k === 'price' ? selected.price.map(priceLabel) : selected[k])), c && title !== `“${q}”` ? title : '']
    .filter(Boolean)
    .join(', ')
  const askHref = whatsappLink(whatsapp, `Hi Aura Luxe 👋\nI'm looking for${wanted ? `: ${wanted}` : ' something special'}.\nDo you have anything similar in store?`)

  return (
    <SiteLayout>
      <Wrap className="pt-6 md:pt-10">
        <nav aria-label="Breadcrumb" className="text-xs text-muted">
          <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span className="text-ink">{q ? 'Search' : title}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {q && <p className="eyebrow">Search results</p>}
            <h1 className="font-display text-3xl tracking-[0.06em] uppercase sm:text-4xl">{title}</h1>
            <p className="mt-1 text-sm text-muted" aria-live="polite">
              {visible.length} {visible.length === 1 ? 'style' : 'styles'}
            </p>
          </div>
          {q && (
            <button onClick={() => update({ q: undefined })} className="inline-flex items-center gap-1 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              <X className="size-3.5" /> Clear search
            </button>
          )}
        </div>

        {hasBanner && !q && (
          <div className="mt-5">
            <PromoBanner compact />
          </div>
        )}

        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:hidden lg:px-0">
          {collections.map((col) => (
            <button
              key={col.label}
              onClick={() => update({ c: col.id })}
              aria-pressed={c === col.id}
              className={`h-9 shrink-0 rounded-md border px-3.5 text-sm transition ${c === col.id ? 'border-ink bg-ink text-white' : 'border-sand bg-white text-ink hover:border-ink'}`}
            >
              {col.label}
            </button>
          ))}
        </div>
      </Wrap>

      {/* Filter / sort bar */}
      <div className="sticky top-14 z-30 mt-4 border-y border-sand bg-ivory/95 backdrop-blur lg:top-16 lg:mt-6">
        <Wrap className="flex h-13 items-center justify-between gap-3">
          <button onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] lg:hidden">
            <SlidersHorizontal className="size-4" /> Filter {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-ink text-[0.6rem] text-white">{activeCount}</span>}
          </button>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.14em] lg:block">Filter</p>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <span>Sort</span>
            <select
              value={search.sort ?? ''}
              onChange={(e) => update({ sort: (e.target.value || undefined) as ShopSearch['sort'] })}
              className="h-10 cursor-pointer rounded-md border border-sand bg-white px-2 text-sm font-normal tracking-normal normal-case"
            >
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </Wrap>
      </div>

      <Wrap className="pt-5 lg:grid lg:grid-cols-[14.5rem_1fr] lg:gap-10 lg:pt-8">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2 pb-6">{panel}</div>
        </aside>

        <div className="min-w-0">
          {activeCount > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {FILTER_KEYS.flatMap((k) =>
                selected[k].map((v) => (
                  <button key={k + v} onClick={() => toggle(k, v)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sand bg-white px-2.5 text-xs" aria-label={`Remove ${LABELS[k]} ${v}`}>
                    {k === 'price' ? priceLabel(v) : v} <X className="size-3" />
                  </button>
                )),
              )}
              {search.avail && (
                <button onClick={() => update({ avail: undefined })} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sand bg-white px-2.5 text-xs">
                  In stock <X className="size-3" />
                </button>
              )}
              <button onClick={clearAll} className="px-1 text-xs text-muted underline underline-offset-4 hover:text-ink">
                Clear all
              </button>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed border-sand bg-white px-6 py-16 text-center">
              <Sparkles className="size-6 text-gold-deep" />
              <p className="mt-4 font-display text-2xl">{items.length ? 'Nothing matches just yet' : 'New pieces arriving soon'}</p>
              <p className="mt-2 max-w-sm text-sm text-muted">Try another size, colour or collection — or ask us, we may have it in store.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {(activeCount > 0 || q || c) && (
                  <Link to="/shop" search={{}} className="btn btn-outline">Show everything</Link>
                )}
                <a href={askHref} target="_blank" rel="noreferrer" className="btn btn-whatsapp">
                  <WhatsAppIcon className="size-4" /> Ask on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <ItemGrid items={visible} className="lg:grid-cols-3 xl:grid-cols-4" />
          )}
        </div>
      </Wrap>

      <RecentlyViewed />

      {sheet && (
        <FilterSheet count={visible.length} activeCount={activeCount} onClear={clearAll} onClose={() => setSheet(false)}>
          {panel}
        </FilterSheet>
      )}
    </SiteLayout>
  )
}

const priceLabel = (key: string) => PRICE_RANGES.find((r) => r.key === key)?.label ?? key

function FilterPanel({
  collections,
  active,
  facets,
  selected,
  base,
  avail,
  onToggle,
  onAvail,
  onCollection,
}: {
  collections: { id: string | undefined; label: string }[]
  active: string | undefined
  facets: Record<FilterKey, string[]>
  selected: Record<FilterKey, string[]>
  base: Item[]
  avail: boolean
  onToggle: (k: FilterKey, v: string) => void
  onAvail: () => void
  onCollection: (id: string | undefined) => void
}) {
  const count = (k: FilterKey, v: string) => base.filter((i) => matchesFilter(i, k, [v])).length
  const isOn = (k: FilterKey, v: string) => selected[k].some((x) => x.toLowerCase() === v.toLowerCase())

  return (
    <div className="divide-y divide-sand">
      <Group title="Category">
        <ul className="space-y-0.5">
          {collections.map((col) => (
            <li key={col.label}>
              <button
                onClick={() => onCollection(col.id)}
                aria-pressed={active === col.id}
                className={`flex min-h-9 w-full items-center justify-between text-left text-sm ${active === col.id ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
              >
                {col.label} {active === col.id && <Check className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      </Group>

      {facets.size.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.size.map((s) => {
              const on = isOn('size', s)
              const n = count('size', s)
              return (
                <button
                  key={s}
                  onClick={() => onToggle('size', s)}
                  aria-pressed={on}
                  disabled={!n && !on}
                  className={`h-10 min-w-11 rounded-md border px-2.5 text-sm transition disabled:cursor-not-allowed disabled:text-muted/50 disabled:line-through ${
                    on ? 'border-ink bg-ink text-white' : 'border-sand bg-white hover:border-ink'
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </Group>
      )}

      <CheckGroup title="Price" k="price" options={facets.price} label={priceLabel} isOn={isOn} count={count} onToggle={onToggle} />
      <CheckGroup title="Colour" k="colour" options={facets.colour} isOn={isOn} count={count} onToggle={onToggle} />
      <CheckGroup title="Fabric" k="fabric" options={facets.fabric} isOn={isOn} count={count} onToggle={onToggle} />
      <CheckGroup title="Occasion" k="occasion" options={facets.occasion} isOn={isOn} count={count} onToggle={onToggle} />

      <Group title="Availability">
        <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm">
          In stock only
          <input type="checkbox" checked={avail} onChange={onAvail} className="peer sr-only" />
          <span aria-hidden className="relative h-6 w-10 rounded-full bg-sand transition peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-gold-deep after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
        </label>
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="py-5 first:pt-0">
      <legend className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

function CheckGroup({
  title,
  k,
  options,
  label = (v) => v,
  isOn,
  count,
  onToggle,
}: {
  title: string
  k: FilterKey
  options: string[]
  label?: (v: string) => string
  isOn: (k: FilterKey, v: string) => boolean
  count: (k: FilterKey, v: string) => number
  onToggle: (k: FilterKey, v: string) => void
}) {
  if (!options.length) return null
  return (
    <Group title={title}>
      <ul className="space-y-0.5">
        {options.map((v) => (
          <li key={v}>
            <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={isOn(k, v)} onChange={() => onToggle(k, v)} className="size-4 accent-ink" />
              <span className="flex-1">{label(v)}</span>
              <span className="text-xs text-muted">{count(k, v)}</span>
            </label>
          </li>
        ))}
      </ul>
    </Group>
  )
}

function FilterSheet({
  count,
  activeCount,
  onClear,
  onClose,
  children,
}: {
  count: number
  activeCount: number
  onClear: () => void
  onClose: () => void
  children: React.ReactNode
}) {
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

  return (
    <div className="fade fixed inset-0 z-[70] flex items-end bg-ink/40 lg:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        onClick={(e) => e.stopPropagation()}
        className="sheet flex max-h-[88vh] w-full flex-col rounded-t-xl bg-ivory"
      >
        <div className="flex items-center justify-between border-b border-sand px-5 py-3">
          <p className="text-sm font-semibold uppercase tracking-[0.14em]">Filters</p>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-cream" aria-label="Close filters" autoFocus>
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex gap-3 border-t border-sand px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button onClick={onClear} disabled={!activeCount} className="btn btn-outline flex-1 disabled:opacity-40">
            Clear all
          </button>
          <button onClick={onClose} className="btn btn-dark flex-[1.4]">
            Show {count} {count === 1 ? 'style' : 'styles'}
          </button>
        </div>
      </div>
    </div>
  )
}
