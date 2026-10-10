import type { Item } from '../../db/schema'
import { FREE_SIZE, sizeKeys, stockOf } from './catalog'
import type { CartLine } from './orders'

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

export type Quote = {
  lines: QuoteLine[]
  subtotal: number
  discount: number
  deliveryCharge: number
  total: number
  ok: boolean
}

export const stockKey = (item: Item, size: string | null) => (item.sizes.length ? size : FREE_SIZE)

/** Price and validate a cart against trusted product rows. Quantities of the same size are checked together. */
export function priceCart(lines: CartLine[], rows: Item[], deliveryCharge: number): Quote {
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
  return { lines: out, subtotal, discount: subtotal - selling, deliveryCharge, total: selling + deliveryCharge, ok }
}

