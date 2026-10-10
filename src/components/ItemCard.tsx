import { Link } from '@tanstack/react-router'
import { ImageOff } from 'lucide-react'
import type { Item } from '../../db/schema'
import { WhatsAppIcon } from './WhatsAppIcon'
import { WishlistButton } from './WishlistButton'
import { cdn, cdnSet, crossedPrice, descriptor, discountPercent, enquiryMessage, formatPrice, itemBadge, whatsappLink } from '@/lib/format'
import { isSoldOut } from '@/lib/catalog'
import { categoryLabel, useSite } from '@/lib/site'

const BADGE_TONE = {
  sale: 'bg-sale text-white',
  dark: 'bg-ink text-white',
  light: 'bg-white text-ink',
}

export function ItemCard({ item, eager = false }: { item: Item; eager?: boolean }) {
  const { whatsapp, categoryName } = useSite()
  const [cover, second] = item.images
  const was = crossedPrice(item)
  const badge = itemBadge(item)
  const soldOut = isSoldOut(item)
  const detail = descriptor(item) || categoryLabel(categoryName, item.categoryId)
  const params = { itemId: String(item.id) }

  return (
    <article className="group flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-cream">
        <Link to="/item/$itemId" params={params} className="block size-full" tabIndex={-1} aria-hidden="true">
          {cover ? (
            <>
              <img
                src={cdn(cover, 480)}
                srcSet={cdnSet(cover, [320, 480, 720])}
                sizes="(min-width: 1280px) 22vw, (min-width: 640px) 31vw, 47vw"
                alt=""
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
                width={480}
                height={600}
                className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
              />
              {/* Second photo on hover — display:none on touch devices so it is never downloaded there */}
              {second && (
                <img
                  src={cdn(second, 480)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 hidden size-full object-cover opacity-0 transition duration-500 group-hover:opacity-100 [@media(hover:hover)]:block"
                />
              )}
            </>
          ) : (
            <span className="grid size-full place-items-center text-muted">
              <ImageOff className="size-7" />
            </span>
          )}
        </Link>
        {badge && (
          <span className={`pointer-events-none absolute top-2.5 left-2.5 rounded-sm px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${BADGE_TONE[badge.tone]}`}>
            {badge.label}
          </span>
        )}
        <WishlistButton id={item.id} name={item.name} className="absolute top-2 right-2" />
        {soldOut && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-white/85 py-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
            Currently sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <h3 className="line-clamp-1 text-[0.9rem] font-medium text-ink">
          <Link to="/item/$itemId" params={params} className="hover:underline hover:underline-offset-4">
            {item.name}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">{detail}</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-semibold text-ink">{formatPrice(item.price)}</span>
          {was != null && item.price != null && (
            <>
              <s className="text-xs text-muted">{formatPrice(was)}</s>
              <span className="text-xs font-semibold text-sale">{discountPercent(item.price, was)}% OFF</span>
            </>
          )}
        </p>
        <div className="mt-auto pt-3">
        <a
          href={whatsappLink(whatsapp, enquiryMessage(item))}
          target="_blank"
          rel="noreferrer"
          aria-label={`Check availability of ${item.name} on WhatsApp`}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-sand bg-white text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink transition hover:border-ink"
        >
          <WhatsAppIcon className="size-3.5 text-whatsapp-ink" /> Check availability
        </a>
        </div>
      </div>
    </article>
  )
}

/** Responsive product grid: 2 per row on phones, 3 on tablets, 4 on desktop. */
export function ItemGrid({ items, className = '' }: { items: Item[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 ${className}`}>
      {items.map((item, i) => (
        <ItemCard key={item.id} item={item} eager={i < 2} />
      ))}
    </div>
  )
}
