import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { buildIndex } from './catalog'

const rootApi = getRouteApi('__root__')

/** Catalog, WhatsApp number and store details, loaded once by the root route for the whole storefront. */
export function useSite() {
  const data = rootApi.useLoaderData()
  const categoryName = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories])
  const index = useMemo(() => buildIndex(data.items, data.categories), [data.items, data.categories])
  return { ...data, categoryName, index }
}

export const categoryLabel = (names: Map<number, string>, id: number | null) => (id == null ? 'Other' : names.get(id) ?? 'Other')
