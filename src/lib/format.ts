/** Serve images through the Netlify Image CDN so pages never ship full-size originals. */
export function cdn(src: string, width: number) {
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&fm=webp&q=78`
}

/** A responsive srcset for the given widths. */
export function cdnSet(src: string, widths: number[]) {
  return widths.map((w) => `${cdn(src, w)} ${w}w`).join(', ')
}

export function formatPrice(price: number | null) {
  if (price == null) return 'Price on request'
  return `Rs. ${price.toLocaleString('en-IN')}`
}

/** The original price to show struck through, only when it's genuinely higher than the selling price. */
export function crossedPrice(item: { price: number | null; comparePrice: number | null }) {
  return item.price != null && item.comparePrice != null && item.comparePrice > item.price ? item.comparePrice : null
}

export function discountPercent(price: number, was: number) {
  return Math.round((1 - price / was) * 100)
}

export function formatPhone(digits: string) {
  if (digits.startsWith('977') && digits.length === 13) {
    return `+977 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  return `+${digits}`
}

export function whatsappLink(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export const GREETING = 'Hi Aura Luxe 👋\nI would like to know more about your collection.'

type Enquiry = { name: string; price: number | null; size?: string | null; colour?: string | null; url?: string }

function enquiryLines({ name, price, size, colour }: Enquiry) {
  return [`Product: ${name}`, `Price: ${formatPrice(price)}`, size && `Size: ${size}`, colour && `Colour: ${colour}`].filter(
    Boolean,
  ) as string[]
}

/** The pre-filled WhatsApp message for a single piece, so customers never have to type product details. */
export function enquiryMessage(e: Enquiry) {
  return [
    'Hi Aura Luxe 👋',
    "I'm interested in this product:",
    '',
    ...enquiryLines(e),
    '',
    'Is this available?',
    ...(e.url ? [e.url] : []),
  ].join('\n')
}

/** One message covering every piece in the enquiry bag. */
export function bagMessage(entries: Enquiry[]) {
  if (entries.length === 1) return enquiryMessage(entries[0])
  const blocks = entries.map((e, i) => [`${i + 1}. ${e.name} — ${formatPrice(e.price)}`, ...enquiryLines(e).slice(2).map((l) => `   ${l}`), ...(e.url ? [`   ${e.url}`] : [])].join('\n'))
  return ['Hi Aura Luxe 👋', "I'd like to check availability for these pieces:", '', ...blocks, '', 'Are these available?'].join('\n')
}

export type Badge = { label: string; tone: 'sale' | 'dark' | 'light' }

/** At most one badge per piece keeps cards calm: SALE wins, then the owner's chosen badge. */
export function itemBadge(item: { price: number | null; comparePrice: number | null; clearance: boolean; badge: string }): Badge | null {
  if (crossedPrice(item) != null || item.clearance) return { label: item.clearance ? 'Clearance' : 'Sale', tone: 'sale' }
  if (item.badge === 'new') return { label: 'New', tone: 'dark' }
  if (item.badge === 'bestseller') return { label: 'Bestseller', tone: 'light' }
  if (item.badge === 'trending') return { label: 'Trending', tone: 'light' }
  return null
}

/** Short "Cotton • 3 piece" style line built only from real product details. */
export function descriptor(item: { fabric: string; setContents: string; pattern: string }) {
  return [item.fabric, item.setContents || item.pattern].filter(Boolean).join(' • ')
}

export const PRICE_RANGES = [
  { key: 'u999', label: 'Under Rs. 999', short: 'Under 999', min: 0, max: 998 },
  { key: '999-1499', label: 'Rs. 999 – 1,499', short: '999 – 1,499', min: 999, max: 1499 },
  { key: '1499-2499', label: 'Rs. 1,499 – 2,499', short: '1,499 – 2,499', min: 1500, max: 2499 },
  { key: '2499-4999', label: 'Rs. 2,499 – 4,999', short: '2,499 – 4,999', min: 2500, max: 4999 },
  { key: '5000', label: 'Rs. 5,000+', short: 'Premium 5,000+', min: 5000, max: Infinity },
] as const
