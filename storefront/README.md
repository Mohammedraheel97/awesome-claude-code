# Almoallem storefront

A Next.js (TypeScript) storefront that keeps the design language of the
Almoallem Shopify theme (Arabic, RTL, KWD). It is designed for Vercel.

Read [`docs/AUDIT.md`](docs/AUDIT.md) first. It records what was inspected, what
was not possible to inspect, and what is still outstanding.

## Quick start

```bash
cd storefront
npm install
cp .env.example .env.local   # optional; without Shopify credentials the sample catalog is used
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (type-checks and compiles all routes) |
| `npm start` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js core-web-vitals and TypeScript rules) |
| `npm test` | Unit tests (Vitest): commerce logic, cart tokens, i18n, query helpers, Shopify mapping |
| `npx playwright test` | End-to-end tests against the production build (set `PLAYWRIGHT_CHROMIUM_PATH` to use a local Chromium) |

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `SHOPIFY_STORE_DOMAIN` | For live data | e.g. `your-store.myshopify.com` |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | For live data | **Public** Storefront API token. Never an Admin token. It is read on the server only |
| `SHOPIFY_API_VERSION` | No | Defaults to `2025-07` |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical URL for sitemap, canonical links and structured data |
| `CONTACT_EMAIL`, `CONTACT_PHONE` | No | Shown on the contact page and footer when set |

## Architecture

```
src/
  app/                 Routes (App Router), server actions, metadata, sitemap, robots
  components/          Header, Footer, ProductCard, VariantPicker, AddToCartForm, ...
  lib/
    commerce/
      types.ts         Provider interface and domain types (single source of truth)
      index.ts         getCommerce(): Shopify when configured, otherwise sample
      shopify-provider.ts   Storefront API (GraphQL) implementation
      sample-provider.ts    Clearly labelled sample catalog implementation
      sample-catalog.ts     Sample data (not real inventory)
      cart-token.ts         Cookie token for the sample cart
    i18n.ts            AR/EN strings, direction, locale cookie
    session.ts         Cookies: locale, cart token, safe redirect helper
    variants.ts        Variant resolution from URL options
  styles → app/globals.css   Design tokens (colours, type, radius, spacing)
tests/
  *.test.ts            Unit tests
  e2e/                 Playwright specs
docs/AUDIT.md          Audit, theme mapping, design system, outstanding items
```

Design notes:

- **No client data fetching.** Pages are server components. Client code is
  limited to the gallery, add-to-cart, newsletter form and submit buttons.
- **Shareable state in the URL.** Sorting, filters, pagination cursors and
  product options are query parameters. They work without JavaScript.
- **Cart in an httpOnly cookie.** Sample mode stores only variant IDs and
  quantities. Prices always come from the catalog.
- **Real HTTP 404s.** Missing products and collections return 404. Loading
  skeletons are placed inside Suspense boundaries that do not stream the whole
  page, so status codes stay correct.
- **Checkout is Shopify's hosted checkout.** Card data never touches this app.

## Connecting Shopify

1. In the Shopify admin, create a headless / custom app with the **Storefront
   API** scopes you need (read products, collections and inventory, and
   manage carts). Copy the **public Storefront access token**.
2. Set `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_ACCESS_TOKEN` locally
   (`.env.local`) and in Vercel (Project → Settings → Environment Variables).
3. Restart the server. The header and listings now come from Shopify.
   The footer notice about the sample catalog disappears.
4. Verify on your own store: a collection with products, a product with
   variants, add to cart, quantity change, remove, and checkout redirect.

The Shopify provider has been **tested against a mocked Storefront API only**.
Run the checklist above before relying on it.

## Deploying to Vercel

- Framework preset: Next.js. Root directory: `storefront`.
- Build command: `next build` (default). Node 22 is used locally.
- Set the environment variables above for Production and Preview.
- The Hobby plan is for personal, non-commercial use. A live commercial store
  needs an appropriate Vercel plan.
