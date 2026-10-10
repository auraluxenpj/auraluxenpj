import type { Category, Item } from '../../db/schema'
import { PRICE_RANGES, crossedPrice, discountPercent } from './format'

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
export const OCCASIONS = ['Casual', 'Office', 'Festive', 'Party', 'Wedding']

export const isOnOffer = (i: Item) => i.clearance || crossedPrice(i) != null

/** Stock key for pieces without listed sizes. */
export const FREE_SIZE = 'Free Size'

/** The sizes a piece is stocked in — its listed sizes, or just "Free Size". */
export const sizeKeys = (i: Pick<Item, 'sizes'>) => (i.sizes.length ? sortSizes(i.sizes) : [FREE_SIZE])

/** Units in stock for one size (null size = Free Size). Unknown sizes have no stock. */
export function stockOf(i: Pick<Item, 'sizes' | 'stock'>, size: string | null) {
  const key = i.sizes.length ? size : FREE_SIZE
  if (key == null || !sizeKeys(i).includes(key)) return 0
  const n = Number(i.stock?.[key])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export const isSoldOut = (i: Item) => sizeKeys(i).every((s) => stockOf(i, s) <= 0)

export function sortSizes(sizes: string[]) {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase())
    return i === -1 ? 100 : i
  }
  return [...sizes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

export function inPriceRange(price: number | null, key: string) {
  const r = PRICE_RANGES.find((x) => x.key === key)
  return r != null && price != null && price >= r.min && price <= r.max
}

/* ---------- Search ---------- */

const STOP = new Set(['wear', 'for', 'the', 'and', 'with', 'a', 'an', 'in', 'of', 'dress', 'dresses', 'outfit', 'outfits'])
const SIZES = new Set(SIZE_ORDER.map((s) => s.toLowerCase()).concat(['xxxl']))
// Words customers type → words that appear in product data
const ALIASES: Record<string, string[]> = {
  kurti: ['kurta', 'kurti'],
  kurta: ['kurta', 'kurti'],
  sari: ['saree', 'sari'],
  lehnga: ['lehenga'],
  coord: ['coord', 'co ord'],
  bridal: ['bridal', 'wedding', 'lehenga'],
  wedding: ['wedding', 'bridal'],
  ethnic: ['ethnic', 'kurta', 'saree', 'lehenga', 'anarkali'],
  red: ['red', 'maroon', 'wine', 'crimson', 'ruby', 'cherry'],
  pink: ['pink', 'blush', 'rose', 'peach'],
  green: ['green', 'emerald', 'mint', 'olive', 'sage'],
  blue: ['blue', 'navy', 'midnight', 'teal', 'sky'],
  white: ['white', 'ivory', 'cream'],
  brown: ['brown', 'beige', 'tan', 'camel'],
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/co-ord/g, 'coord')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const singular = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)

type Indexed = { item: Item; words: string[]; name: string; sizes: string[] }

export function buildIndex(items: Item[], categories: Category[]): Indexed[] {
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  return items.map((item) => {
    const text = [
      item.name,
      cat.get(item.categoryId ?? -1) ?? 'Other',
      item.description,
      item.fabric,
      item.pattern,
      item.fit,
      item.setContents,
      item.badge,
      ...item.colors,
      ...item.occasions,
      item.clearance ? 'clearance sale offer' : '',
      crossedPrice(item) != null ? 'sale offer' : '',
    ].join(' ')
    return { item, words: norm(text).split(' ').map(singular), name: norm(item.name), sizes: item.sizes.map((s) => s.toLowerCase()) }
  })
}

/** Every meaningful query word must match the piece's name, category, colours, fabric, occasion or sizes. */
export function searchItems(index: Indexed[], query: string) {
  const tokens = norm(query).split(' ').filter((t) => t && !STOP.has(t))
  if (!tokens.length) return index.map((x) => x.item)
  const scored: { item: Item; score: number }[] = []
  for (const entry of index) {
    let score = 0
    const ok = tokens.every((t) => {
      if (SIZES.has(t)) return entry.sizes.includes(t === 'xxxl' ? '3xl' : t)
      const alts = (ALIASES[singular(t)] ?? [singular(t)]).map(norm)
      const hit = alts.some((a) => (a.includes(' ') ? entry.words.join(' ').includes(a) : entry.words.some((w) => w.startsWith(a))))
      if (hit && alts.some((a) => entry.name.includes(a))) score += 2
      return hit
    })
    if (ok) scored.push({ item: entry.item, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.item)
}

/* ---------- Listing filters ---------- */

export type ShopSearch = {
  c?: string
  q?: string
  size?: string
  price?: string
  colour?: string
  fabric?: string
  occasion?: string
  avail?: 'in'
  sort?: 'new' | 'price-asc' | 'price-desc' | 'discount'
}

export const FILTER_KEYS = ['size', 'price', 'colour', 'fabric', 'occasion'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

export const splitParam = (v?: string) => (v ? v.split(',').filter(Boolean) : [])

export function inCollection(i: Item, c?: string) {
  if (!c) return true
  if (c === 'clearance') return i.clearance
  if (c === 'offers') return isOnOffer(i)
  if (c === 'new') return true
  if (c === 'other') return i.categoryId == null
  return String(i.categoryId) === c
}

const ci = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase())

export function matchesFilter(i: Item, key: FilterKey, values: string[]) {
  if (!values.length) return true
  switch (key) {
    case 'size':
      return values.some((v) => i.sizes.some((s) => s.toLowerCase() === v.toLowerCase() && stockOf(i, s) > 0))
    case 'price':
      return values.some((v) => inPriceRange(i.price, v))
    case 'colour':
      return values.some((v) => ci(i.colors, v))
    case 'fabric':
      return values.some((v) => i.fabric.toLowerCase() === v.toLowerCase())
    case 'occasion':
      return values.some((v) => ci(i.occasions, v))
  }
}

export function sortItems(list: Item[], sort: ShopSearch['sort']) {
  const out = [...list]
  const time = (i: Item) => new Date(i.createdAt).getTime()
  const off = (i: Item) => {
    const was = crossedPrice(i)
    return was != null && i.price != null ? discountPercent(i.price, was) : 0
  }
  if (sort === 'new') out.sort((a, b) => time(b) - time(a))
  if (sort === 'price-asc') out.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  if (sort === 'price-desc') out.sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
  if (sort === 'discount') out.sort((a, b) => off(b) - off(a))
  return out
}

export const newestFirst = (items: Item[]) => sortItems(items, 'new')

/* ---------- Recommendations ---------- */

export function lookFor(item: Item, items: Item[]) {
  const byId = new Map(items.map((i) => [i.id, i]))
  return item.lookIds.map((id) => byId.get(id)).filter((i): i is Item => i != null)
}

/** "You may also like": same category first, then shared occasion, similar price and colour. */
export function similarItems(item: Item, items: Item[], exclude: number[] = [], count = 4) {
  const skip = new Set([item.id, ...exclude])
  const score = (o: Item) => {
    let s = 0
    if (o.categoryId === item.categoryId) s += 3
    if (o.occasions.some((x) => item.occasions.includes(x))) s += 2
    if (item.price && o.price && Math.abs(o.price - item.price) / item.price < 0.4) s += 1
    if (o.colors.some((x) => ci(item.colors, x))) s += 1
    return s
  }
  return items
    .filter((o) => !skip.has(o.id))
    .map((o) => ({ o, s: score(o) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map((x) => x.o)
}

/** Standard disclaimer shown under every product description. It is rendered by the product page, never stored. */
export const PRODUCT_DISCLAIMER =
  'Product images shown on this website may be AI-generated for presentation purposes. While we make every effort to represent the product accurately, the actual product may vary slightly from the images due to photography, camera resolution, lighting, screen/display settings, fabric texture, colour reproduction, and other visual factors. Please consider the product details, available colours, sizes, fabric information, and measurements provided on the product page as the primary reference.'

// Matches a copy of the disclaimer pasted into a description (optionally with a "Disclaimer:" label and markdown bold).
const DISCLAIMER_RE = new RegExp(
  String.raw`(?:\**\s*disclaimer\s*:?\s*\**\s*)?` +
    PRODUCT_DISCLAIMER.split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join(String.raw`\s+`),
  'gi',
)

/** The description as entered, minus any pasted copy of the standard disclaimer, so it is only ever shown once. */
export const descriptionText = (description: string) => description.replace(DISCLAIMER_RE, '').trim()
