# AuraLuxe — Catalog

The online lookbook for **AuraLuxe**, a fashion boutique in Kathmandu. Customers browse every piece with photos, colours, sizes and prices, then tap **Enquire on WhatsApp** to start a chat that already names the piece, their chosen size/colour and a link back to it. The shop owner manages the catalog from a password-protected admin page.

## Features

- **Storefront (`/`)** — editorial hero, category filter chips, search by name, colour or fabric, and a responsive photo grid.
- **Piece page (`/item/:id`)** — up to 8 photos with thumbnails and a full-screen viewer, colour and size pickers, WhatsApp enquiry, share button and related pieces.
- **WhatsApp everywhere** — header button, floating chat bubble and footer all open a chat with the shop's number (default `+977 970 903 4988`, editable in admin).
- **Admin (`/admin`)** — first visit creates the admin password; afterwards log in to add, edit, hide, feature or delete pieces, upload and reorder photos, manage categories, change the WhatsApp number and change the password.

## Tech

- [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, server functions) on Vite 7
- Tailwind CSS 4
- **Netlify Database** (Postgres) via Drizzle ORM — pieces, categories and settings
- **Netlify Blobs** — uploaded photos
- **Netlify Image CDN** — every photo is resized and served as WebP on the fly

## Run locally

```bash
pnpm install
netlify dev        # runs Vite with Netlify Database, Blobs and Image CDN emulation
```

Open http://localhost:8888, then visit `/admin` to set your password.

## Database changes

Edit `db/schema.ts`, then generate a migration:

```bash
npx drizzle-kit generate --name <what_changed>
```

Migrations in `netlify/database/migrations/` are applied automatically on deploy.
