import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import type { Item } from '../../db/schema'
import { ItemCard } from './ItemCard'

export function SectionHeader({
  title,
  subtitle,
  action,
  id,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  id?: string
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
      <div>
        <h2 id={id} className="section-title">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Underlined "View all →" style used for section actions. */
export const underlineLink =
  'inline-flex shrink-0 items-center gap-1.5 border-b border-ink pb-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:border-gold hover:text-gold-deep'

export const Wrap = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
)

/** Horizontally scrolling product row (2 visible on phones, 4 on desktop) with arrow buttons on larger screens. */
export function ProductRail({ items, label }: { items: Item[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.9, behavior: 'smooth' })
  return (
    <div className="relative">
      <div
        ref={ref}
        role="list"
        aria-label={label}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 sm:-mx-6 sm:scroll-px-6 sm:gap-5 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {items.map((item) => (
          <div key={item.id} role="listitem" className="w-[calc(50%-0.4rem)] shrink-0 snap-start sm:w-[calc(33.333%-0.85rem)] lg:w-[calc(25%-0.95rem)]">
            <ItemCard item={item} />
          </div>
        ))}
      </div>
      {items.length > 4 && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] hidden justify-between lg:flex">
          <RailButton side="left" onClick={() => scroll(-1)} />
          <RailButton side="right" onClick={() => scroll(1)} />
        </div>
      )}
    </div>
  )
}

function RailButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Scroll back' : 'Scroll forward'}
      className={`pointer-events-auto grid size-10 place-items-center rounded-full border border-sand bg-white text-ink shadow-sm transition hover:border-ink ${side === 'left' ? '-ml-5' : '-mr-5'}`}
    >
      <Icon className="size-5" />
    </button>
  )
}
