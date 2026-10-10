import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { getCatalog } from '@/server/catalog.functions'

import '../styles.css'

const siteName = 'Aura Luxe — Fashion that feels like you'
const siteDescription =
  'Aura Luxe is a women’s fashion boutique for bridal, festive and everyday wear. Browse the collection and check availability instantly on WhatsApp.'

export const Route = createRootRoute({
  // Catalog + shop details power the header search, wishlist, bag and every storefront page
  loader: () => getCatalog(),
  staleTime: 60_000,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: siteName },
      { name: 'description', content: siteDescription },
      { name: 'theme-color', content: '#faf9f6' },
      { property: 'og:title', content: siteName },
      { property: 'og:description', content: siteDescription },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/.netlify/images?url=/img/hero.jpg&w=1200&fm=jpg' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'google-site-verification', content: '07Gf3VrXyRZrcUHhLFCdS4XPvifgA2z85rEl6jgJuBk' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
