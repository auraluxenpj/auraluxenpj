import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { categories, items, settings } from '../../db/schema.js'
import { getSetting } from './auth.server'

export const DEFAULT_WHATSAPP = '9779709039488'

// Public store details the owner fills in from /admin; storefront sections stay hidden while empty
export const STORE_KEYS = ['store_address', 'store_hours', 'store_phone', 'store_map_url', 'instagram', 'tiktok', 'facebook'] as const
export type StoreKey = (typeof STORE_KEYS)[number]
export type StoreInfo = Record<StoreKey, string>

export async function loadStoreInfo(): Promise<StoreInfo> {
  const rows = await db.select().from(settings).where(inArray(settings.key, [...STORE_KEYS]))
  const found = new Map(rows.map((r) => [r.key, r.value]))
  return Object.fromEntries(STORE_KEYS.map((k) => [k, found.get(k) ?? ''])) as StoreInfo
}

export async function loadCatalog({ includeHidden = false } = {}) {
  const [cats, rows, whatsapp, store] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(items).orderBy(desc(items.featured), desc(items.createdAt)),
    getSetting('whatsapp'),
    loadStoreInfo(),
  ])
  return {
    categories: cats,
    items: includeHidden ? rows : rows.filter((i) => i.published),
    whatsapp: whatsapp ?? DEFAULT_WHATSAPP,
    store,
  }
}

export async function loadItem(id: number) {
  const [item] = await db.select().from(items).where(eq(items.id, id))
  if (!item || !item.published) return null
  return { item }
}
