import { Link, createFileRoute } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import type { Item } from '../../db/schema'
import { SiteLayout, TRENDING_SEARCHES } from '@/components/SiteChrome'
import { ItemGrid } from '@/components/ItemCard'
import { Wrap } from '@/components/Section'
import { RecentlyViewed } from '@/components/RecentlyViewed'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { bagMessage, whatsappLink } from '@/lib/format'
import { useSite } from '@/lib/site'
import { wishlist } from '@/lib/store'

export const Route = createFileRoute('/wishlist')({
  head: () => ({ meta: [{ title: 'Wishlist — Aura Luxe' }, { name: 'robots', content: 'noindex' }] }),
  component: WishlistPage,
})

function WishlistPage() {
  const { items, whatsapp } = useSite()
  const ids = wishlist.use()
  const byId = new Map(items.map((i) => [i.id, i]))
  const saved = ids.map((id) => byId.get(id)).filter((i): i is Item => i != null)
  const origin = typeof window === 'undefined' ? '' : window.location.origin

  return (
    <SiteLayout>
      <Wrap className="pt-8 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-[0.06em] uppercase sm:text-4xl">Wishlist</h1>
            <p className="mt-1 text-sm text-muted">
              {saved.length} saved {saved.length === 1 ? 'style' : 'styles'} · kept on this device, no account needed
            </p>
          </div>
          {saved.length > 0 && (
            <a
              href={whatsappLink(whatsapp, bagMessage(saved.map((i) => ({ name: i.name, price: i.price, url: `${origin}/item/${i.id}` }))))}
              target="_blank"
              rel="noreferrer"
              className="btn btn-whatsapp"
            >
              <WhatsAppIcon className="size-4" /> Ask about {saved.length === 1 ? 'this piece' : 'these pieces'}
            </a>
          )}
        </div>

        {saved.length ? (
          <ItemGrid items={saved} className="mt-8" />
        ) : (
          <div className="mt-8 grid place-items-center rounded-lg border border-dashed border-sand bg-white px-6 py-16 text-center">
            <Heart className="size-7 text-gold-deep" strokeWidth={1.5} />
            <p className="mt-4 font-display text-2xl">Your wishlist is empty</p>
            <p className="mt-2 max-w-sm text-sm text-muted">Tap the heart on any piece to save it here for later.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {TRENDING_SEARCHES.map((t) => (
                <Link key={t} to="/shop" search={{ q: t }} className="rounded-md border border-sand px-3.5 py-2 text-sm hover:border-ink">
                  {t}
                </Link>
              ))}
            </div>
            <Link to="/shop" search={{}} className="btn btn-dark mt-6">Start shopping</Link>
          </div>
        )}
      </Wrap>
      <RecentlyViewed />
    </SiteLayout>
  )
}
