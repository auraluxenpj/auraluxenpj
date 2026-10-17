import { createFileRoute } from '@tanstack/react-router'
import { loadCatalog } from '@/server/catalog.server'
import { isOnOffer } from '@/lib/catalog'
import { SITE_URL as SITE } from '@/lib/seo'
import { COLLECTIONS, collectionItems } from '@/lib/collections'

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/**
 * XML sitemap of the public storefront, built from the live catalogue so new pieces appear automatically.
 * Only published pieces and collections that currently have pieces are listed; admin, bag, wishlist,
 * checkout and order pages are noindex and left out.
 */
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const { categories, items } = await loadCatalog()

        const paths = ['/', '/shop', '/help']
        for (const col of COLLECTIONS) if (collectionItems(col, items, categories).length) paths.push(`/collections/${col.slug}`)
        for (const c of categories) if (items.some((i) => i.categoryId === c.id)) paths.push(`/shop?c=${c.id}`)
        if (items.some((i) => i.categoryId == null)) paths.push('/shop?c=other')
        if (items.some((i) => i.clearance)) paths.push('/shop?c=clearance')
        if (items.some(isOnOffer)) paths.push('/shop?c=offers')
        for (const i of items) paths.push(`/item/${i.id}`)

        const urls = [...new Set(paths)].map((p) => `  <url>\n    <loc>${xmlEscape(SITE + p)}</loc>\n  </url>`)
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

        return new Response(body, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Netlify-CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        })
      },
    },
  },
})
