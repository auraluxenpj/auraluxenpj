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
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('orders_created_at_idx').on(t.createdAt),
    index('orders_client_hash_idx').on(t.clientHash, t.createdAt),
    index('orders_phone_idx').on(t.phone, t.createdAt),
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
