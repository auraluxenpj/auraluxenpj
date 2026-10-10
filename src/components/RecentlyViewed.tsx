import type { Item } from '../../db/schema'
import { ProductRail, SectionHeader, Wrap } from './Section'
import { useSite } from '@/lib/site'
import { recent } from '@/lib/store'

/** Pieces this device has opened recently (stored locally); renders nothing until something was viewed. */
export function RecentlyViewed({ exclude }: { exclude?: number }) {
  const { items } = useSite()
  const ids = recent.use()
  const byId = new Map(items.map((i) => [i.id, i]))
  const list = ids
    .filter((id) => id !== exclude)
    .map((id) => byId.get(id))
    .filter((i): i is Item => i != null)
    .slice(0, 8)
  if (!list.length) return null
  return (
    <Wrap className="mt-16 md:mt-24">
      <SectionHeader title="Recently Viewed" />
      <ProductRail items={list} label="Recently viewed" />
    </Wrap>
  )
}
