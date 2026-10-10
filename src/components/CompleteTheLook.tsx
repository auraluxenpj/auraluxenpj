import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Item } from '../../db/schema'
import { SectionHeader } from './Section'
import { WhatsAppIcon } from './WhatsAppIcon'
import { bagMessage, cdn, cdnSet, formatPrice, whatsappLink } from '@/lib/format'
import { useSite } from '@/lib/site'

/** The owner's hand-picked pairings for a piece, with one tap to enquire about the whole outfit. */
export function CompleteTheLook({ item, look, includeMain = true }: { item: Item; look: Item[]; includeMain?: boolean }) {
  const { whatsapp } = useSite()
  const pieces = includeMain ? [item, ...look] : look
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const message = bagMessage([item, ...look].map((i) => ({ name: i.name, price: i.price, url: origin && `${origin}/item/${i.id}` })))

  return (
    <section aria-labelledby={`look-${item.id}`}>
      <SectionHeader id={`look-${item.id}`} title="Complete the Look" subtitle={`Styled with the ${item.name}.`} />
      <div className="flex flex-wrap items-center gap-y-6">
        <ol className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:gap-4 sm:px-0">
          {pieces.map((p, i) => (
            <li key={p.id} className="flex shrink-0 items-center gap-2 sm:gap-4">
              {i > 0 && <Plus className="size-4 shrink-0 text-gold-deep" aria-label="plus" />}
              <Link to="/item/$itemId" params={{ itemId: String(p.id) }} className="group block w-32 sm:w-44">
                <span className="block aspect-[4/5] overflow-hidden rounded-lg bg-cream">
                  {p.images[0] && (
                    <img src={cdn(p.images[0], 360)} srcSet={cdnSet(p.images[0], [240, 360, 480])} sizes="176px" alt="" loading="lazy" decoding="async" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  )}
                </span>
                <span className="mt-2 line-clamp-1 block text-sm font-medium">{p.name}</span>
                <span className="block text-sm text-muted">{formatPrice(p.price)}</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="w-full sm:ml-auto sm:w-auto sm:pl-6">
          <a href={whatsappLink(whatsapp, message)} target="_blank" rel="noreferrer" className="btn btn-whatsapp w-full sm:w-auto">
            <WhatsAppIcon className="size-4" /> Ask about the full look
          </a>
        </div>
      </div>
    </section>
  )
}
