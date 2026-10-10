import { Heart } from 'lucide-react'
import { toggleWishlist, wishlist } from '@/lib/store'

export function WishlistButton({ id, name, className = '' }: { id: number; name: string; className?: string }) {
  const saved = wishlist.use().includes(id)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleWishlist(id)
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      className={`grid size-10 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition hover:bg-white active:scale-90 ${className}`}
    >
      <Heart className={`size-[18px] transition ${saved ? 'fill-sale text-sale' : ''}`} strokeWidth={1.6} />
    </button>
  )
}
