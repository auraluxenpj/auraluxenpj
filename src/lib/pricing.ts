import type { Item } from '../../db/schema'
import { FREE_SIZE, sizeKeys, stockOf } from './catalog'
import { formatPrice } from './format'
import type { CartLine } from './orders'
import { DEFAULT_ZONE, discountFor, offerCovers, zoneFor } from './promo'
import type { DeliveryRules, OfferRule } from './promo'

export type QuoteLine = {
  id: number
  size: string | null
  colour: string | null
  qty: number
  name: string
  image: string
  sizeLabel: string
  unitPrice: number
  listPrice: number
  lineTotal: number
  available: number
  error: string | null
}

export type AppliedPromo = { id: number; name: string; code: string; amount: number }

export type FreeDeliveryProgress = {
  min: number
  // Rupees still to add (0 once reached)
  remaining: number
  qualifies: boolean
  // Free delivery is limited to some delivery zones and this city isn't one of them (or no city yet)
  zoneBlocked: boolean
  // Free delivery only counts some products/categories
  limited: boolean
}

export type Quote = {
  lines: QuoteLine[]
  // At original (crossed-out) prices
  subtotal: number
  // Total of every discount: sale prices + offer + coupon
  discount: number
  saleDiscount: number
  offer: AppliedPromo | null
  coupon: AppliedPromo | null
  couponError: string | null
  // Pieces after all discounts, before delivery
  merchandise: number
  deliveryCharge: number
  deliveryWaived: number
  deliveryZone: string
  freeDelivery: FreeDeliveryProgress | null
  total: number
  ok: boolean
}

export type PricingContext = {
  delivery: DeliveryRules
  city?: string | null
  // Live automatic offers the customer is still allowed to use
  offers?: OfferRule[]
  // The coupon they entered, if it exists and passed the server's date/limit checks
  coupon?: OfferRule | null
  // Why the entered coupon can't be used (from the server lookup)
  couponError?: string | null
}

export const stockKey = (item: Item, size: string | null) => (item.sizes.length ? size : FREE_SIZE)

type Evaluated = { amount: number; base: number; short: number }

/**
 * Price and validate a cart against trusted product rows, then apply the best automatic offer, the
 * coupon, and delivery/free-delivery. Used by the server (authoritative) and the bag page (preview).
 */
export function priceCart(lines: CartLine[], rows: Item[], ctx: PricingContext): Quote {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const wanted = new Map<string, number>()
  for (const l of lines) {
    const item = byId.get(l.id)
    if (item) wanted.set(`${l.id}|${stockKey(item, l.size)}`, (wanted.get(`${l.id}|${stockKey(item, l.size)}`) ?? 0) + l.qty)
  }

  const out: QuoteLine[] = lines.map((l) => {
    const item = byId.get(l.id)
    const base = { id: l.id, size: l.size, colour: l.colour, qty: l.qty }
    if (!item || !item.published) {
      return { ...base, name: 'Unavailable piece', image: '', sizeLabel: '', unitPrice: 0, listPrice: 0, lineTotal: 0, available: 0, error: 'This piece is no longer available.' }
    }
    const key = stockKey(item, l.size)
    const unitPrice = item.price ?? 0
    const listPrice = item.comparePrice != null && item.price != null && item.comparePrice > item.price ? item.comparePrice : unitPrice
    const available = stockOf(item, key)
    let error: string | null = null
    if (item.price == null) error = 'Price on request — please enquire on WhatsApp.'
    else if (key == null) error = 'Choose a size.'
    else if (!sizeKeys(item).includes(key)) error = `Size ${key} is no longer offered.`
    else if (l.colour && item.colors.length && !item.colors.includes(l.colour)) error = `${l.colour} is no longer offered.`
    else if (item.colors.length > 1 && !l.colour) error = 'Choose a colour.'
    else if (available <= 0) error = `${key === FREE_SIZE ? 'This piece' : `Size ${key}`} is out of stock.`
    else if ((wanted.get(`${l.id}|${key}`) ?? 0) > available) error = `Only ${available} left in ${key === FREE_SIZE ? 'stock' : `size ${key}`}.`
    return {
      ...base,
      colour: l.colour ?? (item.colors.length === 1 ? item.colors[0] : null),
      name: item.name,
      image: item.images[0] ?? '',
      sizeLabel: key ?? '',
      unitPrice,
      listPrice,
      lineTotal: unitPrice * l.qty,
      available,
      error,
    }
  })

  const subtotal = out.reduce((s, l) => s + l.listPrice * l.qty, 0)
  const selling = out.reduce((s, l) => s + l.lineTotal, 0)
  const ok = out.length > 0 && out.every((l) => !l.error)

  /* ---- Offers & coupon: worked out on what's left of each line after earlier discounts ---- */
  const items = out.map((l) => byId.get(l.id))
  const covers = (rule: Parameters<typeof offerCovers>[0], i: number) => {
    const item = items[i]
    return item != null && !out[i].error && offerCovers(rule, item, out[i].listPrice > out[i].unitPrice)
  }
  let net = out.map((l) => (l.error ? 0 : l.lineTotal))

  const evaluate = (rule: OfferRule, amounts: number[]): Evaluated => {
    const base = amounts.reduce((s, a, i) => (covers(rule, i) ? s + a : s), 0)
    if (base < rule.minPurchase) return { amount: 0, base, short: rule.minPurchase - base }
    return { amount: discountFor(rule, base), base, short: 0 }
  }
  // Spread a discount over the lines it covers, in proportion to their value
  const allocate = (rule: OfferRule, amount: number, amounts: number[]) => {
    const idx = amounts.map((_, i) => i).filter((i) => covers(rule, i) && amounts[i] > 0)
    const base = idx.reduce((s, i) => s + amounts[i], 0)
    const next = [...amounts]
    let left = amount
    idx.forEach((i, n) => {
      const share = n === idx.length - 1 ? left : Math.min(left, Math.floor((amount * amounts[i]) / base))
      next[i] -= share
      left -= share
    })
    return next
  }
  const applied = (rule: OfferRule, amount: number): AppliedPromo => ({ id: rule.id, name: rule.name, code: rule.code ?? '', amount })

  let best: { rule: OfferRule; amount: number } | null = null
  for (const rule of ctx.offers ?? []) {
    if (rule.kind !== 'automatic') continue
    const { amount } = evaluate(rule, net)
    if (amount > 0 && (!best || amount > best.amount)) best = { rule, amount }
  }

  let offer: AppliedPromo | null = null
  let coupon: AppliedPromo | null = null
  let couponError = ctx.couponError ?? null
  const c = couponError ? null : ctx.coupon ?? null

  const couponProblem = (e: Evaluated) =>
    e.base === 0
      ? 'This coupon doesn’t apply to the pieces in your bag.'
      : e.short > 0
        ? `Add ${formatPrice(e.short)} more of eligible pieces to use this coupon (minimum ${formatPrice(e.base + e.short)}).`
        : null

  if (c && best && !c.stackable) {
    // Not combinable: the customer gets whichever is worth more
    const e = evaluate(c, net)
    couponError = couponProblem(e)
    if (!couponError && e.amount >= best.amount) {
      coupon = applied(c, e.amount)
      net = allocate(c, e.amount, net)
    } else {
      if (!couponError) couponError = `Your ${best.rule.name} discount is already bigger — this coupon can’t be combined with it.`
      offer = applied(best.rule, best.amount)
      net = allocate(best.rule, best.amount, net)
    }
  } else {
    if (best) {
      offer = applied(best.rule, best.amount)
      net = allocate(best.rule, best.amount, net)
    }
    if (c) {
      const e = evaluate(c, net)
      couponError = couponProblem(e)
      if (!couponError && e.amount > 0) {
        coupon = applied(c, e.amount)
        net = allocate(c, e.amount, net)
      }
    }
  }

  const merchandise = net.reduce((s, a) => s + a, 0) + out.reduce((s, l) => s + (l.error ? l.lineTotal : 0), 0)

  /* ---- Delivery ---- */
  const { baseCharge, zones, free } = ctx.delivery
  const zone = zoneFor(ctx.city, zones)
  const charge = zone ? zone.charge : baseCharge
  let freeDelivery: FreeDeliveryProgress | null = null
  let deliveryWaived = 0
  if (free && out.length) {
    const limited = free.scope !== 'all'
    const counted = limited
      ? net.reduce((s, a, i) => {
          const item = items[i]
          const inScope = item != null && (free.scope === 'products' ? free.productIds.includes(item.id) : item.categoryId != null && free.categoryIds.includes(item.categoryId))
          return inScope ? s + a : s
        }, 0)
      : merchandise
    const remaining = Math.max(0, free.min - counted)
    const zoneBlocked = free.zoneIds.length > 0 && !free.zoneIds.includes(zone?.id ?? DEFAULT_ZONE)
    const qualifies = remaining === 0 && !zoneBlocked && counted > 0
    if (qualifies) deliveryWaived = charge
    freeDelivery = { min: free.min, remaining, qualifies, zoneBlocked, limited }
  }
  const deliveryCharge = charge - deliveryWaived
  const saleDiscount = subtotal - selling
  const promo = (offer?.amount ?? 0) + (coupon?.amount ?? 0)

  return {
    lines: out,
    subtotal,
    discount: saleDiscount + promo,
    saleDiscount,
    offer,
    coupon,
    couponError: ctx.coupon || ctx.couponError ? couponError : null,
    merchandise,
    deliveryCharge,
    deliveryWaived,
    deliveryZone: zone?.name ?? '',
    freeDelivery,
    total: merchandise + deliveryCharge,
    ok,
  }
}

/** The best automatic offer for a single piece, for the product page. */
export function bestOfferFor(item: Item, offers: OfferRule[]) {
  if (item.price == null) return null
  const onSale = item.comparePrice != null && item.comparePrice > item.price
  let best: { rule: OfferRule; price: number; needsMore: boolean } | null = null
  for (const rule of offers) {
    if (rule.kind !== 'automatic' || !offerCovers(rule, item, onSale)) continue
    const needsMore = item.price < rule.minPurchase
    const price = item.price - discountFor(rule, item.price)
    if (!best || (best.needsMore && !needsMore) || (best.needsMore === needsMore && price < best.price)) best = { rule, price, needsMore }
  }
  return best
}
