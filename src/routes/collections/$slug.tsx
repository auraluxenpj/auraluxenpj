import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { SiteLayout } from '@/components/SiteChrome'
import { ItemGrid } from '@/components/ItemCard'
import { Wrap, underlineLink } from '@/components/Section'
import { COLLECTIONS, collectionBySlug, collectionCategories, collectionItems } from '@/lib/collections'
import { cdn } from '@/lib/format'
import { useSite } from '@/lib/site'
import { absoluteUrl, jsonLd, seo } from '@/lib/seo'
import type { Category, Item } from '../../../db/schema'

export const Route = createFileRoute('/collections/$slug')({
  beforeLoad: ({ params }) => {
    if (!collectionBySlug(params.slug)) throw notFound()
  },
  head: ({ params, matches }) => {
    const collection = collectionBySlug(params.slug)
    if (!collection) return { meta: [{ title: 'Collection not found — Aura Luxe' }, { name: 'robots', content: 'noindex' }] }
    const root = matches[0]?.loaderData as { items?: Item[]; categories?: Category[] } | undefined
    const list = collectionItems(collection, root?.items ?? [], root?.categories ?? [])
    const cover = list.find((i) => i.images[0])?.images[0]
    const page = seo({
      title: collection.title,
      description: collection.description,
      path: `/collections/${collection.slug}`,
      image: cover ? cdn(cover, 1200).replace('fm=webp', 'fm=jpg') : undefined,
    })
    const breadcrumbs = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: collection.heading, item: absoluteUrl(`/collections/${collection.slug}`) },
      ],
    }
    return {
      meta: list.length ? page.meta : [...page.meta, { name: 'robots', content: 'noindex' }],
      links: page.links,
      scripts: [jsonLd(breadcrumbs)],
    }
  },
  component: CollectionPage,
})

function CollectionPage() {
  const { slug } = Route.useParams()
  const { items, categories } = useSite()
  const collection = collectionBySlug(slug)!
  const list = collectionItems(collection, items, categories)
  const related = collectionCategories(collection, categories).filter((c) => items.some((i) => i.categoryId === c.id))
  const others = COLLECTIONS.filter((c) => c.slug !== slug && collectionItems(c, items, categories).length)

  return (
    <SiteLayout>
      <Wrap className="pt-6 md:pt-10">
        <nav aria-label="Breadcrumb" className="text-xs text-muted">
          <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span className="text-ink">{collection.heading}</span>
        </nav>
        <h1 className="mt-3 font-display text-3xl tracking-[0.06em] uppercase sm:text-4xl">{collection.heading}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">{collection.intro}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-sm text-muted">
            {list.length} {list.length === 1 ? 'style' : 'styles'}
          </span>
          {related.map((c) => (
            <Link key={c.id} to="/shop" search={{ c: String(c.id) }} className={underlineLink}>
              Filter {c.name}
            </Link>
          ))}
        </div>

        {list.length ? (
          <ItemGrid items={list} className="mt-8" />
        ) : (
          <p className="mt-10 text-muted">
            New pieces are on their way.{' '}
            <Link to="/shop" search={{}} className="underline underline-offset-4">Browse the full collection</Link>.
          </p>
        )}

        {others.length > 0 && (
          <nav aria-label="More collections" className="mt-14 border-t border-sand pt-8 pb-4">
            <p className="eyebrow">More collections</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((c) => (
                <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }} className="rounded-full border border-sand bg-white px-4 py-2 text-sm transition hover:border-ink">
                  {c.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </Wrap>
    </SiteLayout>
  )
}
