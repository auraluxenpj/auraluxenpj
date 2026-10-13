import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const categories = pgTable('categories', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const items = pgTable('items', {
  id: serial().primaryKey(),
  name: text().notNull(),
  categoryId: integer('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  price: integer(),
  // Optional original price, shown struck through next to the selling price
  comparePrice: integer('compare_price'),
  description: text().notNull().default(''),
  sizes: text().array().notNull().default([]),
  colors: text().array().notNull().default([]),
  // Image URLs: uploaded photos live at /api/images/<key>, samples at /img/<file>
  images: text().array().notNull().default([]),
  featured: boolean().notNull().default(false),
  published: boolean().notNull().default(true),
  // Stock-clearance pieces get their own storefront tab and a "Clearance" badge
  clearance: boolean().notNull().default(false),
  // Optional product details shown on the product page and used by storefront filters/search
  fabric: text().notNull().default(''),
  pattern: text().notNull().default(''),
  fit: text().notNull().default(''),
  setContents: text('set_contents').notNull().default(''),
  occasions: text().array().notNull().default([]),
  // Merchandising badge: 'new' | 'bestseller' | 'trending' ('' for none). SALE is derived from the prices.
  badge: text().notNull().default(''),
  // Units in stock per size ('Free Size' for unsized pieces); a missing size counts as 0
  stock: jsonb().$type<Record<string, number>>().notNull().default({}),
  // Legacy: kept in sync with sizes whose stock is 0 (stock is the source of truth)
  soldOutSizes: text('sold_out_sizes').array().notNull().default([]),
  // Item ids styled with this piece ("Complete the look")
  lookIds: integer('look_ids').array().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Key/value store for shop settings (WhatsApp number) and admin credentials
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
})

/*
 * Festive offers. kind 'automatic' applies itself to eligible bags; kind 'coupon' needs its code at checkout.
 * Live = active && now within [starts_at, ends_at) && under total_limit. See src/lib/promo.ts.
 */
export const offers = pgTable('offers', {
  id: serial().primaryKey(),
  name: text().notNull(),
  kind: text().notNull().default('automatic'),
  // Upper-cased coupon code, null for automatic offers
  code: text().unique(),
  // 'percent' | 'fixed' (whole rupees)
  discountType: text('discount_type').notNull().default('percent'),
  discountValue: integer('discount_value').notNull(),
  minPurchase: integer('min_purchase').notNull().default(0),
  // Cap for percentage discounts (null = no cap)
  maxDiscount: integer('max_discount'),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  active: boolean().notNull().default(true),
  // 'all' | 'products' | 'categories'
  scope: text().notNull().default('all'),
  productIds: integer('product_ids').array().notNull().default([]),
  categoryIds: integer('category_ids').array().notNull().default([]),
  excludeProductIds: integer('exclude_product_ids').array().notNull().default([]),
  // Skip pieces already on sale (crossed-out price) or in clearance
  excludeSale: boolean('exclude_sale').notNull().default(false),
  perCustomerLimit: integer('per_customer_limit'),
  totalLimit: integer('total_limit'),
  // Coupons only: may be used on top of an automatic offer
  stackable: boolean().notNull().default(false),
  // Marketing
  showBanner: boolean('show_banner').notNull().default(false),
  bannerTitle: text('banner_title').notNull().default(''),
  bannerText: text('banner_text').notNull().default(''),
  bannerImage: text('banner_image').notNull().default(''),
  ctaText: text('cta_text').notNull().default(''),
  announcement: text().notNull().default(''),
  showCountdown: boolean('show_countdown').notNull().default(false),
  cartMessage: text('cart_message').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/** Record of admin changes to promotions and delivery settings. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial().primaryKey(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: integer('entity_id'),
    summary: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_log_created_at_idx').on(t.createdAt)],
)

/*
 * Orders: created at checkout with prices and totals computed on the server.
 * status is the fulfilment pipeline (see ORDER_STATUSES in src/lib/orders.ts).
 */
export const orders = pgTable(
  'orders',
  {
    id: serial().primaryKey(),
    // Public order number, e.g. ALX-7K2Q9M
    number: text().notNull().unique(),
    // Secret for the customer's confirmation link (/order/<number>?t=<token>)
    accessToken: text('access_token').notNull(),
    // Client-generated per checkout attempt so retries/double taps never create two orders
    idempotencyKey: text('idempotency_key').notNull().unique(),
    customerName: text('customer_name').notNull(),
    phone: text().notNull(),
    email: text().notNull().default(''),
    address: text().notNull(),
    city: text().notNull(),
    area: text().notNull(),
    landmark: text().notNull().default(''),
    subtotal: integer().notNull(),
    deliveryCharge: integer('delivery_charge').notNull().default(0),
    discount: integer().notNull().default(0),
    total: integer().notNull(),
    paymentMethod: text('payment_method').notNull().default('bank_transfer'),
    // pending | submitted | verified | rejected — mirrors the latest payment
    paymentStatus: text('payment_status').notNull().default('submitted'),
    status: text().notNull().default('payment_verification'),
    // True while the ordered units are held back from stock (false once cancelled/rejected)
    stockReserved: boolean('stock_reserved').notNull().default(true),
    adminNotes: text('admin_notes').notNull().default(''),
    // Salted hash of the customer's IP, only used to rate-limit order spam
    clientHash: text('client_hash').notNull().default(''),
    // Promotions applied at checkout (snapshots, so history survives an offer being edited or deleted).
    // discount = sale-price savings + offer_discount + coupon_discount
    offerId: integer('offer_id').references(() => offers.id, { onDelete: 'set null' }),
    offerName: text('offer_name').notNull().default(''),
    offerDiscount: integer('offer_discount').notNull().default(0),
    couponId: integer('coupon_id').references(() => offers.id, { onDelete: 'set null' }),
    couponCode: text('coupon_code').notNull().default(''),
    couponDiscount: integer('coupon_discount').notNull().default(0),
    // Delivery charge the customer would have paid without the free-delivery promotion
    deliveryWaived: integer('delivery_waived').notNull().default(0),
    deliveryZone: text('delivery_zone').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('orders_created_at_idx').on(t.createdAt),
    index('orders_client_hash_idx').on(t.clientHash, t.createdAt),
    index('orders_phone_idx').on(t.phone, t.createdAt),
    index('orders_offer_idx').on(t.offerId),
    index('orders_coupon_idx').on(t.couponId),
  ],
)

export const orderItems = pgTable('order_items', {
  id: serial().primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  // Snapshot of the piece at purchase time; item_id is cleared if the piece is later deleted
  itemId: integer('item_id').references(() => items.id, { onDelete: 'set null' }),
  name: text().notNull(),
  image: text().notNull().default(''),
  size: text().notNull(),
  colour: text().notNull().default(''),
  quantity: integer().notNull(),
  unitPrice: integer('unit_price').notNull(),
  // Original (crossed-out) unit price used for the discount line; equals unit_price when not on sale
  listPrice: integer('list_price').notNull(),
  lineTotal: integer('line_total').notNull(),
})

/* One row per payment attempt, so new methods (or a re-submitted proof) don't change the orders table. */
export const payments = pgTable('payments', {
  id: serial().primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  method: text().notNull().default('bank_transfer'),
  amount: integer().notNull(),
  // pending | verified | rejected
  status: text().notNull().default('pending'),
  transactionId: text('transaction_id').notNull().default(''),
  paymentDate: text('payment_date').notNull().default(''),
  // Key in the private payment-proofs Blob store (never a public URL)
  proofKey: text('proof_key').notNull().default(''),
  proofType: text('proof_type').notNull().default(''),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type Category = typeof categories.$inferSelect
export type Item = typeof items.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Offer = typeof offers.$inferSelect
export type AuditEntry = typeof auditLog.$inferSelect
