import { z } from 'zod'
import type { Offer } from '../../db/schema'
import { formatPrice } from './format'

/*
 * Festive offers, coupons and delivery rules shared by the server (authoritative) and the
 * storefront (previews). Pricing itself lives in priceCart (src/lib/pricing.ts).
 */

export const DEFAULT_DELIVERY = 100
/** Zone id used for cities that don't match any delivery zone. */
export const DEFAULT_ZONE = 'default'

export type OfferRule = Pick<
  Offer,
  | 'id'
  | 'name'
  | 'kind'
  | 'code'
  | 'discountType'
  | 'discountValue'
  | 'minPurchase'
  | 'maxDiscount'
  | 'scope'
  | 'productIds'
  | 'categoryIds'
  | 'excludeProductIds'
  | 'excludeSale'
  | 'stackable'
>

/** What the storefront receives about a live (or upcoming) offer. Private coupon codes are never included. */
export type PublicOffer = OfferRule &
  Pick<Offer, 'showBanner' | 'bannerTitle' | 'bannerText' | 'bannerImage' | 'ctaText' | 'announcement' | 'showCountdown' | 'cartMessage'> & {
    startsAt: string | null
    endsAt: string | null
  }

export type DeliveryZone = { id: string; name: string; cities: string[]; charge: number }

export type FreeDelivery = {
  enabled: boolean
  min: number
  startsAt: string | null
  endsAt: string | null
  scope: 'all' | 'products' | 'categories'
  productIds: number[]
  categoryIds: number[]
  // Zone ids that qualify ('default' = every other city); empty = everywhere
  zoneIds: string[]
  // Mention free delivery in the announcement bar
  announce: boolean
}

export const FREE_DELIVERY_OFF: FreeDelivery = {
  enabled: false,
  min: 2000,
  startsAt: null,
  endsAt: null,
  scope: 'all',
  productIds: [],
  categoryIds: [],
  zoneIds: [],
  announce: true,
}

/** Delivery charges plus the free-delivery promotion — `free` is null unless it is live right now. */
export type DeliveryRules = { baseCharge: number; zones: DeliveryZone[]; free: FreeDelivery | null }

export type OfferState = 'active' | 'scheduled' | 'expired' | 'paused' | 'used_up'

export const OFFER_STATE_LABEL: Record<OfferState, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  paused: 'Paused',
  used_up: 'Limit reached',
}

const time = (d: Date | string | null) => (d == null ? null : new Date(d).getTime())

export function offerState(
  o: { active: boolean; startsAt: Date | string | null; endsAt: Date | string | null; totalLimit?: number | null },
  now = Date.now(),
  used = 0,
): OfferState {
  if (!o.active) return 'paused'
  const end = time(o.endsAt)
  if (end != null && end <= now) return 'expired'
  const start = time(o.startsAt)
  if (start != null && start > now) return 'scheduled'
  if (o.totalLimit != null && used >= o.totalLimit) return 'used_up'
  return 'active'
}

export function freeDeliveryLive(f: FreeDelivery, now = Date.now()) {
  if (!f.enabled) return false
  const start = time(f.startsAt)
  const end = time(f.endsAt)
  return (start == null || start <= now) && (end == null || end > now)
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** The zone whose city list contains the customer's city (case-insensitive), if any. */
export function zoneFor(city: string | null | undefined, zones: DeliveryZone[]) {
  if (!city?.trim()) return null
  const c = norm(city)
  return zones.find((z) => z.cities.some((x) => norm(x) === c)) ?? null
}

export const discountLabel = (o: Pick<OfferRule, 'discountType' | 'discountValue'>) =>
  o.discountType === 'percent' ? `${o.discountValue}% OFF` : `${formatPrice(o.discountValue)} OFF`

/** Discount for an eligible amount — percentage (optionally capped) or a fixed amount, never more than the amount. */
export function discountFor(o: Pick<OfferRule, 'discountType' | 'discountValue' | 'maxDiscount'>, amount: number) {
  if (amount <= 0) return 0
  let d = o.discountType === 'percent' ? Math.round((amount * o.discountValue) / 100) : o.discountValue
  if (o.discountType === 'percent' && o.maxDiscount != null) d = Math.min(d, o.maxDiscount)
  return Math.max(0, Math.min(d, amount))
}

/** Whether a piece counts towards an offer (scope, exclusions, already-discounted pieces). */
export function offerCovers(
  o: Pick<OfferRule, 'scope' | 'productIds' | 'categoryIds' | 'excludeProductIds' | 'excludeSale'>,
  item: { id: number; categoryId: number | null; clearance: boolean },
  onSale: boolean,
) {
  if (o.excludeProductIds.includes(item.id)) return false
  if (o.excludeSale && (onSale || item.clearance)) return false
  if (o.scope === 'products') return o.productIds.includes(item.id)
  if (o.scope === 'categories') return item.categoryId != null && o.categoryIds.includes(item.categoryId)
  return true
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' }) : ''

/**
 * Fill the owner's banner/announcement text with live values, so numbers always match the offer:
 * {discount} {code} {min} {max} {ends} {free_delivery_min}
 */
export function fillTemplate(text: string, o: PublicOffer, free: FreeDelivery | null) {
  return text
    .replaceAll('{discount}', discountLabel(o))
    .replaceAll('{code}', o.code ?? '')
    .replaceAll('{min}', formatPrice(o.minPurchase))
    .replaceAll('{max}', o.maxDiscount != null ? formatPrice(o.maxDiscount) : '')
    .replaceAll('{ends}', fmtDate(o.endsAt))
    .replaceAll('{free_delivery_min}', free ? formatPrice(free.min) : '')
}

/** Banner copy — the owner's text when given, otherwise generated from the offer's settings. */
export function bannerCopy(o: PublicOffer, free: FreeDelivery | null) {
  const title = o.bannerTitle.trim() ? fillTemplate(o.bannerTitle, o, free) : `${o.name} at Aura Luxe!`
  const conditions = [
    o.minPurchase > 0 ? `on orders above ${formatPrice(o.minPurchase)}` : 'on eligible styles',
    o.code && `with code ${o.code}`,
  ].filter(Boolean)
  const delivery = free ? `, plus FREE DELIVERY on orders over ${formatPrice(free.min)}` : ''
  const auto = `Enjoy ${discountLabel(o)} ${conditions.join(' ')}${delivery}. Shop your favourite styles today!`
  const text = o.bannerText.trim() ? fillTemplate(o.bannerText, o, free) : auto
  return { title, text, cta: o.ctaText.trim() || 'Shop the Festive Collection' }
}

/* ---------- Admin input ---------- */

const rupees = (label: string) => z.number({ error: `${label} must be a number` }).int(`${label} must be whole rupees`).min(0).max(10_000_000)
const ids = z.array(z.number().int().positive()).max(500)
const isoOrNull = z.union([z.null(), z.iso.datetime({ offset: true, error: 'Invalid date' })])
const short = (max: number) => z.string().trim().max(max)

export const offerInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    name: short(80).min(2, 'Give the offer a name, e.g. Dashain Sale'),
    kind: z.enum(['automatic', 'coupon']),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .max(30)
      .refine((v) => v === '' || /^[A-Z0-9_-]{3,30}$/.test(v), 'Coupon codes use 3–30 letters, numbers, - or _'),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.number().int('Discount must be a whole number').positive('Enter a discount above 0'),
    minPurchase: rupees('Minimum purchase'),
    maxDiscount: rupees('Maximum discount').nullable(),
    startsAt: isoOrNull,
    endsAt: isoOrNull,
    active: z.boolean(),
    scope: z.enum(['all', 'products', 'categories']),
    productIds: ids,
    categoryIds: ids,
    excludeProductIds: ids,
    excludeSale: z.boolean(),
    perCustomerLimit: z.number().int().positive('Per-customer limit must be at least 1').max(1000).nullable(),
    totalLimit: z.number().int().positive('Total limit must be at least 1').max(1_000_000).nullable(),
    stackable: z.boolean(),
    showBanner: z.boolean(),
    bannerTitle: short(120),
    bannerText: short(400),
    bannerImage: z.string().trim().max(300).refine((v) => v === '' || v.startsWith('/api/images/') || v.startsWith('/img/'), 'Upload the banner image'),
    ctaText: short(40),
    announcement: short(200),
    showCountdown: z.boolean(),
    cartMessage: short(300),
  })
  .superRefine((o, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (o.kind === 'coupon' && !o.code) issue('code', 'Enter the coupon code customers will type, e.g. TIHAR15')
    if (o.discountType === 'percent' && o.discountValue > 90) issue('discountValue', 'Percentage discounts can be at most 90%')
    if (o.startsAt && o.endsAt && new Date(o.endsAt) <= new Date(o.startsAt)) issue('endsAt', 'The end date must be after the start date')
    if (o.scope === 'products' && !o.productIds.length) issue('productIds', 'Choose at least one product')
    if (o.scope === 'categories' && !o.categoryIds.length) issue('categoryIds', 'Choose at least one category')
  })
export type OfferInput = z.infer<typeof offerInputSchema>

export const zoneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: short(60).min(1, 'Name every delivery zone'),
  cities: z.array(short(60).min(1)).max(100),
  charge: rupees('Delivery charge').max(100_000),
})

export const deliveryInputSchema = z
  .object({
    baseCharge: rupees('Delivery charge').max(100_000),
    zones: z.array(zoneSchema).max(20),
    free: z.object({
      enabled: z.boolean(),
      min: rupees('Free delivery minimum'),
      startsAt: isoOrNull,
      endsAt: isoOrNull,
      scope: z.enum(['all', 'products', 'categories']),
      productIds: ids,
      categoryIds: ids,
      zoneIds: z.array(z.string().max(40)).max(21),
      announce: z.boolean(),
    }),
  })
  .superRefine((d, ctx) => {
    const f = d.free
    if (f.startsAt && f.endsAt && new Date(f.endsAt) <= new Date(f.startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['free', 'endsAt'], message: 'Free delivery must end after it starts' })
    }
    if (f.scope === 'products' && !f.productIds.length) ctx.addIssue({ code: 'custom', path: ['free', 'productIds'], message: 'Choose at least one product for free delivery' })
    if (f.scope === 'categories' && !f.categoryIds.length) ctx.addIssue({ code: 'custom', path: ['free', 'categoryIds'], message: 'Choose at least one category for free delivery' })
    if (new Set(d.zones.map((z) => z.id)).size !== d.zones.length) ctx.addIssue({ code: 'custom', path: ['zones'], message: 'Duplicate delivery zone' })
  })
export type DeliveryInput = z.infer<typeof deliveryInputSchema>
