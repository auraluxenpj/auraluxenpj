import { useSyncExternalStore } from 'react'

/**
 * Tiny device-local stores (wishlist, enquiry bag, recently viewed) persisted in localStorage,
 * so shoppers never need an account. The server snapshot is always empty to keep hydration stable.
 */
function createStore<T>(key: string | null, initial: T) {
  let value = initial
  let loaded = key == null
  const listeners = new Set<() => void>()

  const load = () => {
    if (loaded || typeof window === 'undefined') return
    loaded = true
    try {
      const raw = localStorage.getItem(key!)
      if (raw) value = JSON.parse(raw)
    } catch {}
  }

  const set = (next: T | ((prev: T) => T)) => {
    load()
    value = typeof next === 'function' ? (next as (p: T) => T)(value) : next
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {}
    }
    listeners.forEach((l) => l())
  }

  const subscribe = (l: () => void) => {
    listeners.add(l)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !key) return
      loaded = false
      load()
      l()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(l)
      window.removeEventListener('storage', onStorage)
    }
  }

  const get = () => {
    load()
    return value
  }

  const use = () => useSyncExternalStore(subscribe, get, () => initial)
  return { use, get, set }
}

export type BagEntry = { id: number; size: string | null; colour: string | null; qty: number }
export type PlacedOrder = { number: string; token: string; at: string }

const EMPTY_IDS: number[] = []
const EMPTY_BAG: BagEntry[] = []

export const wishlist = createStore<number[]>('auraluxe:wishlist', EMPTY_IDS)
export const bag = createStore<BagEntry[]>('auraluxe:bag', EMPTY_BAG)
export const recent = createStore<number[]>('auraluxe:recent', EMPTY_IDS)
// Confirmation links for orders placed on this device
export const placedOrders = createStore<PlacedOrder[]>('auraluxe:orders', [])

// Session-only UI state shared between the header, bottom nav and overlays
export const searchOpen = createStore<boolean>(null, false)

export function toggleWishlist(id: number) {
  wishlist.set((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids]))
}

// Bags saved before quantities existed have no qty — treat those as one piece
export const qtyOf = (e: BagEntry) => (Number.isInteger(e.qty) && e.qty > 0 ? e.qty : 1)

const sameLine = (a: BagEntry, b: BagEntry) => a.id === b.id && a.size === b.size && a.colour === b.colour

/** Adds the piece, or raises the quantity of the identical line (capped at max). */
export function addToBag(entry: BagEntry, max = Infinity) {
  bag.set((list) => {
    const existing = list.find((e) => sameLine(e, entry))
    const qty = Math.min(max, (existing ? qtyOf(existing) : 0) + entry.qty)
    return [{ ...entry, qty }, ...list.filter((e) => !sameLine(e, entry))]
  })
}

export function setBagQty(index: number, qty: number) {
  bag.set((list) => list.map((e, i) => (i === index ? { ...e, qty: Math.max(1, qty) } : e)))
}

/** Change a line's size or colour, merging it into an identical line if one exists. */
export function setBagOption(index: number, key: 'size' | 'colour', value: string | null) {
  bag.set((list) => {
    const next = { ...list[index], [key]: value }
    const twin = list.findIndex((e, i) => i !== index && sameLine(e, next))
    if (twin === -1) return list.map((e, i) => (i === index ? next : e))
    return list
      .map((e, i) => (i === twin ? { ...e, qty: qtyOf(e) + qtyOf(next) } : e))
      .filter((_, i) => i !== index)
  })
}

export function removeFromBag(index: number) {
  bag.set((list) => list.filter((_, i) => i !== index))
}

export function markViewed(id: number) {
  recent.set((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, 12))
}
