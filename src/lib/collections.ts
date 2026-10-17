import type { Category, Item } from '../../db/schema'

/**
 * Search-friendly landing pages at /collections/<slug>. Each one gathers existing published pieces by
 * category name or product name, so nothing here is invented: a collection with no matching pieces is
 * left out of navigation and the sitemap and served noindex.
 */
export type Collection = {
  slug: string
  label: string
  title: string
  description: string
  heading: string
  intro: string
  /** Matched against category names */
  category?: RegExp
  /** Matched against product names */
  name: RegExp
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'pakistani-suits',
    label: 'Pakistani Suits',
    title: 'Pakistani Suits for Women in Nepal | AURALUXE Nepalgunj',
    description:
      'Shop Pakistani suits, sharara, farshi salwar and palazzo suit sets with embroidered dupattas at AURALUXE. Check sizes and availability on WhatsApp.',
    heading: 'Pakistani Suits',
    intro:
      'Pakistani-style suits from our collection — sharara and farshi salwar sets, palazzo suits and salwar kameez, many with an embroidered dupatta. Pick a piece to see its fabric, sizes and stock, then message us on WhatsApp to order.',
    name: /pakistani|salwar|shalwar|sharara|farshi|farsi/i,
  },
  {
    slug: 'co-ord-sets',
    label: 'Co-ord Sets',
    title: 'Co-ord Sets for Women | AURALUXE Nepalgunj',
    description:
      'Matching co-ord sets for women — printed cotton, linen and embroidered top-and-pant sets for daily, casual and festive wear at AURALUXE.',
    heading: 'Co-ord Sets',
    intro:
      'Easy matching sets for everyday and occasion wear: printed cotton and linen co-ords, embroidered top-and-palazzo sets and ethnic fusion outfits. Open any piece for sizes and stock, or ask us on WhatsApp.',
    category: /co-?\s?ord/i,
    name: /co-?\s?ord|cord set|coord/i,
  },
  {
    slug: 'kurtis',
    label: 'Kurtis & Kurti Sets',
    title: 'Kurtis & Kurti Sets for Women | AURALUXE Nepalgunj',
    description:
      'Shop kurtis, short kurtis and 3-piece kurti sets with pants, palazzos and dupattas — cotton, silk and embroidered styles at AURALUXE.',
    heading: 'Kurtis & Kurti Sets',
    intro:
      'Short kurtis, kurta sets and 3-piece kurti sets with pant or palazzo and dupatta — from breathable printed cotton for daily wear to embroidered silk for festivals and parties.',
    category: /kurt[ai]/i,
    name: /kurt[ai]/i,
  },
  {
    slug: 'sarees',
    label: 'Sarees',
    title: 'Sarees for Women | AURALUXE Nepalgunj',
    description:
      'Shop sarees at AURALUXE — georgette, silk, chiffon and embroidered party, festive and bridal sarees. Check availability on WhatsApp.',
    heading: 'Sarees',
    intro:
      'Georgette, silk, chiffon and printed sarees for parties, festivals and weddings, many with a rich pallu and blouse piece. Open a saree for its details and stock, or message us on WhatsApp.',
    category: /saree|sari\b/i,
    name: /saree/i,
  },
  {
    slug: 'lehengas',
    label: 'Lehengas',
    title: 'Bridal & Party Lehengas | AURALUXE Nepalgunj',
    description:
      'Bridal and wedding lehenga choli sets with embroidery, sequins and dupattas at AURALUXE. See the details and check availability on WhatsApp.',
    heading: 'Lehengas',
    intro:
      'Lehenga choli sets for brides, weddings and receptions — net, silk and georgette lehengas with embroidery and sequin work, paired with a matching dupatta. Open a piece for details, or ask us on WhatsApp.',
    category: /lehenga/i,
    name: /lehenga/i,
  },
]

export const collectionBySlug = (slug: string) => COLLECTIONS.find((c) => c.slug === slug)

export function collectionItems<T extends Pick<Item, 'name' | 'categoryId'>>(
  collection: Collection,
  items: T[],
  categories: Pick<Category, 'id' | 'name'>[],
) {
  const cats = new Set(collection.category ? categories.filter((c) => collection.category!.test(c.name)).map((c) => c.id) : [])
  return items.filter((i) => (i.categoryId != null && cats.has(i.categoryId)) || collection.name.test(i.name))
}

/** Existing /shop?c=<id> category pages related to a collection, for the "browse with filters" links. */
export const collectionCategories = (collection: Collection, categories: Pick<Category, 'id' | 'name'>[]) =>
  collection.category ? categories.filter((c) => collection.category!.test(c.name)) : []
