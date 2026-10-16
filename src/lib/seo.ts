/** Canonical production origin. Canonical links, social URLs and the sitemap always point here, whichever host served the page. */
export const SITE_URL = 'https://auraluxe.com.np'

export const SITE_NAME = 'Aura Luxe'
export const SITE_TITLE = 'Aura Luxe — Fashion that feels like you'
export const SITE_DESCRIPTION =
  'Aura Luxe is a women’s fashion boutique for bridal, festive and everyday wear. Browse the collection and check availability instantly on WhatsApp.'

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`)

/** Page-level title, description, canonical and Open Graph / Twitter tags for a public, indexable page. */
export function seo({
  title,
  description,
  path,
  image,
  type = 'website',
}: {
  title: string
  description: string
  path: string
  image?: string
  type?: 'website' | 'product'
}) {
  const url = absoluteUrl(path)
  const meta = [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:type', content: type },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(image
      ? [
          { property: 'og:image', content: absoluteUrl(image) },
          { name: 'twitter:image', content: absoluteUrl(image) },
        ]
      : []),
  ]
  return { meta, links: [{ rel: 'canonical', href: url }] }
}
