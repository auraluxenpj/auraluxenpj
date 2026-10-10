# AGENTS.md

AuraLuxe catalog: a boutique lookbook where customers browse pieces and enquire via WhatsApp, plus a password-protected admin for the owner. TanStack Start app deployed on Netlify.

## Architecture

| Concern | Where |
|---|---|
| DB schema (Drizzle, Netlify Database) | `db/schema.ts`, client in `db/index.ts` |
| Migrations (auto-applied on deploy) | `netlify/database/migrations/` — the 2nd migration seeds sample categories/pieces and the default WhatsApp number |
| Server functions (public + admin RPC) | `src/server/catalog.functions.ts`, orders/checkout in `src/server/orders.functions.ts` |
| Orders, stock, payment settings (server) | `src/server/orders.server.ts` |
| Shared cart pricing + order statuses/validation | `src/lib/pricing.ts` (`priceCart`, used by bag page and server), `src/lib/orders.ts` |
| Checkout / order confirmation | `src/routes/checkout.tsx`, `src/routes/order/$number.tsx`; order POST `src/routes/api/orders.ts`; admin-only proof viewer `src/routes/api/payment-proof/$paymentId.ts` |
| Server-only helpers | `src/server/*.server.ts` (auth/settings, catalog queries, Blobs image store) |
| Photo upload / serving (raw HTTP) | `src/routes/api/upload.ts` (POST, admin only), `src/routes/api/images/$key.ts` (GET) |
| Storefront | `src/routes/index.tsx`, `src/routes/item/$itemId.tsx` |
| Admin | `src/routes/admin.tsx` |
| Shared UI | `src/components/` (`SiteChrome` header/footer/floating button, `ItemCard`, `WhatsAppIcon`) |
| Formatting, WhatsApp links, Image CDN URLs | `src/lib/format.ts`; client-side photo downscale + upload in `src/lib/upload.ts` |
| Theme tokens (colours, fonts) | `@theme` block in `src/styles.css` |

## Key decisions

- **Images**: `items.images` is an ordered array of URL paths. Uploads live in the `catalog-images` Blob store and are referenced as `/api/images/<uuid>.<ext>`; bundled sample photos are `/img/*.jpg` in `public/`. Always render through `cdn(src, width)` (Netlify Image CDN, WebP) — never the raw path. The first image is the cover. Uploaded blobs are deleted when removed from a piece or when the piece is deleted; `/img/*` files are never deleted.
- **Admin auth**: single shared password, no user accounts. The first visitor to `/admin` sets it (scrypt hash in `settings.admin_password`). Sessions are an HMAC-signed expiry in the httpOnly `auraluxe_admin` cookie, signed with `settings.session_secret`; changing the password rotates the secret, signing out every device. Every admin server function calls `requireAdmin()`; the upload route uses `isAdminRequest(request)`.
- **Password recovery**: "Forgot password?" emails a one-time, 30-minute reset link (`/admin?reset=<token>`) to `settings.recovery_email` via the Resend API (`RESEND_API_KEY`, optional `RESEND_FROM`); only a SHA-256 of the token is stored in `settings.reset_token`. Logic in `src/server/recovery.server.ts`.
- **Settings** are key/value rows in `settings` (`whatsapp`, `admin_password`, `session_secret`, `recovery_email`, `reset_token`). WhatsApp is stored as digits only (e.g. `9779709034988`) for `wa.me` links.
- **Categories**: deleting one sets its items' `category_id` to NULL (FK `ON DELETE SET NULL`); the UI shows those as "Other".
- **Prices** are whole Nepali Rupees (`integer`, nullable → "Price on request"), formatted `Rs. 24,500`.
- **Crossed-out price**: optional `items.compare_price`, shown struck through (with % saved) only when higher than `price`; the server rejects it otherwise. Use `crossedPrice(item)` from `src/lib/format.ts`.
- **Clearance**: `items.clearance` pieces get a "Clearance" badge and their own storefront tab (`/?c=clearance`), shown only when at least one clearance piece is published. They still appear in their normal category.
- **Stock**: `items.stock` (jsonb) maps size → units; pieces with no sizes use the `'Free Size'` key. A missing size is 0 (Out of Stock). Use `stockOf`/`sizeKeys`/`isSoldOut` from `src/lib/catalog.ts`; `sold_out_sizes` is legacy and only kept in sync. Admin stock edits are applied as a delta against the stock the editor loaded, so concurrent sales aren't overwritten.
- **Checkout** (bank transfer / QR only, no gateways): the browser sends cart lines (id, size, colour, qty) + customer details + the proof file in one multipart POST to `/api/orders`; the server re-prices from locked item rows (`SELECT … FOR UPDATE`), deducts stock, and inserts `orders`, `order_items`, `payments` in one transaction. Never accept prices/totals from the browser. `idempotency_key` (per checkout attempt, sessionStorage) prevents duplicates; orders are rate-limited per IP hash and phone.
- **Order statuses** are in `ORDER_STATUSES` (`src/lib/orders.ts`). New orders start at `payment_verification`. Moving to `cancelled`/`payment_rejected` returns units to stock (`orders.stock_reserved`); moving back re-reserves them. Customers can only view an order with its secret link `/order/<number>?t=<access_token>`.
- **Payment proofs** live in the private `payment-proofs` Blob store (JPG/PNG/PDF, checked by magic bytes, max `settings.proof_max_mb` ≤ 5 MB because of the 6 MB function body limit) and are only served to admins via `/api/payment-proof/<paymentId>`.
- **Payment settings** (`bank_name`, `bank_account_name`, `bank_account_number`, `bank_branch`, `payment_qr`, `payment_instructions`, `payment_confirmation_message`, `delivery_charge`, `proof_max_mb`) are `settings` rows edited in Admin → Orders. Checkout stays closed until a QR or bank name + account number is set. The QR is uploaded with `uploadImage(file, { crop: false })`.
- Items with `published = false` are hidden from the storefront but visible in admin; `featured` items sort first and show a "Signature" badge.

## Conventions

- Import server-only code only from `*.server.ts` files, and call it from inside `createServerFn` handlers or API route handlers.
- Validate server function input with `.inputValidator(zod)` (there is no `.validator`).
- After a mutation in the admin UI, call `router.invalidate()` to reload loader data.
- Any schema change needs a new migration via `npx drizzle-kit generate --name ...`; never edit applied migrations.
- Visual language: ivory/plum/gold palette, Cormorant Garamond display + Jost body, rounded-full buttons, WhatsApp green (`bg-whatsapp`) reserved for WhatsApp actions.
