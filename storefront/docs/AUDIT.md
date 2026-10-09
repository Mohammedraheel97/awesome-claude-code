# Almoallem storefront: audit, theme analysis and handoff

This document records what was inspected, what was built from it, and what was
and was not verified. Anything marked **not verified** was not tested against a
live system.

## 1. Reference website audit (laraalhuwail.com)

**Status: not performed. The reference site could not be reached.**

- Direct fetch of `https://laraalhuwail.com/products/mocha` fails. The agent
  egress proxy returns `403 CONNECT tunnel failed`, which is an organization
  network-policy denial. The policy was not bypassed.
- A web search for the domain returned no pages from it.
- No browser tool was available in this session, so no screenshots or
  interactive inspection were possible.

Because of this, nothing below claims to reflect the reference store's pages,
product layouts, mega menus, typography or copy. The design direction comes from
the user's own theme (which the brief names as the foundation) rather than from
the reference store.

**To complete the audit:** run the session from an environment that can reach
`laraalhuwail.com` (or allow that host in the egress policy), or provide page
captures. The audit can then be added to this file.

## 2. Existing theme analysis

Source: `theme_export__almoallemmill-com-copy-of-v5__09OCT2026-0631am.zip`
(kept untouched in the uploads folder; extracted only to a scratch directory).

| Item | Finding |
|---|---|
| Platform | Shopify Online Store 2.0 Liquid theme, Dawn-derived structure |
| Size | 460 files: 150+ sections/snippets/blocks, JSON templates, 40+ locales, JS and CSS assets |
| Store identity | Almoallem (المعلم), Kuwait market (`country: Kuwait`), KWD, Arabic-first (RTL) |
| Content | Snacks, sweets, Belgian chocolate, Eid sweets (Arabic collection titles) |
| Binary assets | None in the ZIP. The logo (`alhaffar_logo_white_transparent.svg`, `IMG_8323_…png`) and fonts are Shopify-hosted references |
| Fonts | Headings and accent: Barlow Condensed (500/600/700, uppercase). Body: Inter 400 |
| Settings | Button and card radius 5px; narrow page width; free-delivery threshold 10 KWD; sold-out badge in scheme-2 |
| Cart | Drawer with auto-open, free-shipping tracker, cart note, upsell |
| Apps and integrations | WhatsApp multi-chat section, bundle builder (Pro), volume pricing, product hotspots, quick-order list, countdown bars |

**Architecture decision:** Shopify Liquid cannot be deployed to Vercel as a
theme. The storefront was rebuilt as a Next.js (TypeScript) app that keeps the
theme's design language and copy structure. Shopify remains the intended
commerce backend through the Storefront API. The theme ZIP itself was not
modified.

### Component mapping (theme → new storefront)

| Theme component | New component / route | Notes |
|---|---|---|
| `sections/header.liquid`, `snippets/header-drawer.liquid`, `mega-menu-list` | `components/Header.tsx` | Sticky header, collection links, `<details>` mobile drawer (no JS) |
| `sections/header-announcements.liquid` | `components/AnnouncementBar.tsx` | Free-delivery message from the threshold setting |
| `sections/hero.liquid`, `slideshow.liquid` | Hero in `app/page.tsx` | Single static hero; no slideshow |
| `sections/collection-list.liquid`, `universal-collection-showcase` | Collection cards on `/` and `/collections` | |
| `sections/featured-products.liquid`, `product-list.liquid`, `snippets/product-card.liquid` | `components/ProductCard.tsx`, `ProductGrid.tsx` | Scale-on-hover image preserved (honours reduced motion) |
| `sections/main-collection.liquid`, `snippets/sorting.liquid`, `filter-remove-buttons` | `/collections/[handle]` with `ListToolbar` | Sort and "in stock only" filter; cursor "Load more" |
| `sections/product-information.liquid`, `variant-picker`, `snippets/quantity-selector.liquid` | `/products/[handle]`, `VariantPicker`, `AddToCartForm` | Options are URL links, so they work without JS |
| `sections/product-recommendations.liquid` | Related products block | Storefront `productRecommendations` in Shopify mode |
| `sections/search-results.liquid`, `search-header.liquid` | `/search` | |
| `sections/main-cart.liquid`, `snippets/cart-summary.liquid` | `/cart` | Cart page instead of drawer |
| `sections/dynamic-shipping-bar.liquid`, `free-shipping-tracker` | Cart summary note | |
| `sections/footer.liquid`, `footer-utilities.liquid`, `secure-payments.liquid` | `components/Footer.tsx` | Newsletter form, nav columns |
| `sections/main-page.liquid`, `main-404.liquid` | About, FAQs, Shipping, Returns, Privacy, Terms, Contact, 404 | Policy bodies are placeholders |
| `snippets/fonts.liquid`, `config/settings_data.json` | `app/layout.tsx` (`next/font`), `app/globals.css` tokens | |

**Not carried over:** WhatsApp multi-chat, bundle builder, volume pricing,
countdown bars, product hotspots, gift cards, blogs, password page, the
drawer-style cart, and Shopify apps. These need real backend data or product
configuration first.

## 3. Brand identity and design system

Colours come from `config/settings_data.json` (`color_schemes`).

| Token | Value | Source |
|---|---|---|
| `--color-background` | `#f5edd6` | scheme-1 background |
| `--color-surface` | `#ede0c4` | variant background / input hover |
| `--color-text` | `#3b2314` | foreground / heading |
| `--color-text-muted` | `#6b5443` | derived; intended >4.5:1 on background (**not measured**) |
| `--color-primary` | `#c0392b` | primary / primary button |
| `--color-primary-hover` | `#a02d23` | primary hover |
| `--color-on-primary` | `#f5edd6` | primary button text |
| `--color-secondary` | `#4a6741` | secondary button |
| `--color-accent` | `#d4704f` | scheme-3 primary, dark surfaces |
| `--color-border` | `#8b5e3c` | border |
| `--color-dark` | `#3b2314` | scheme-3 background (footer, announcement) |

Typography: Barlow Condensed for headings (uppercase, 600), Inter for Latin body
text, and Cairo for Arabic text (Barlow has no Arabic glyphs). The three fonts
load through `next/font/google`. The build fetched them successfully.

**Logo:** the real logo file is Shopify-hosted and was not in the ZIP. A
text-based placeholder wordmark (`public/brand/logo.svg`, and the header text
"المعلم" / "ALMOALLEM") stands in for it. Replace it with the real asset.

## 4. Pages and features

| Route | Status |
|---|---|
| `/` home: announcement, hero, collection cards, featured products, promo band, new arrivals, story, footer | Built, tested |
| `/collections`, `/collections/[handle]` | Built: sort, in-stock filter, load more, empty state, 404 |
| `/products/[handle]` | Built: gallery with thumbnails, variant picker, quantity, add to cart, sold-out state, accordions, related products, JSON-LD |
| `/search?q=` | Built: sort and filter, prompt and no-results states |
| `/cart` | Built: quantity change, remove, subtotal, free-delivery note, checkout (disabled unless connected) |
| `/about`, `/faqs`, `/shipping`, `/returns`, `/privacy`, `/terms`, `/contact` | Built. Bodies are placeholders (see section 6) |
| `/api/locale` | Switches language (AR/EN, RTL/LTR) and returns to the same page |
| 404 | Real HTTP 404 for unknown products and collections |
| `robots.txt`, `sitemap.xml` | Generated |
| Newsletter | Validates the email and reports that sign-up is not connected. It does **not** store or claim a subscription |
| Contact form | Not built. A form with no backend would be fake. Contact details appear only when `CONTACT_EMAIL` / `CONTACT_PHONE` are set |

Behaviour details:

- Cart state is an httpOnly cookie, and quantities are capped at 10 per line.
- In sample mode, prices come from the catalog. A tampered cookie can change
  quantities, not prices.
- Shopify mode uses `cartCreate`, `cartLinesAdd`, `cartLinesUpdate` and
  `cartLinesRemove`, and sends the buyer to Shopify's hosted checkout URL.

## 5. Integration status

- **Shopify is not connected.** No Storefront API token was supplied. The
  connected Shopify MCP session points at **The Conran Shop**
  (`www.theconranshop.com.kw`, Shopify Plus, KWD). That is a different brand from
  the theme's store (Almoallem). Its catalog was deliberately **not** used, and
  nothing was written to it.
- Without credentials, the storefront runs on a **sample catalog** of 12
  invented products. The footer says so. Prices, descriptions and product
  images are placeholders.
- **Checkout is disabled** and shows a message. No fake checkout exists.
- The Shopify provider has been tested against a mocked Storefront API only
  (request shape, headers, user errors). **Not verified against a live store.**

## 6. Outstanding items

1. Decide which store this storefront serves (Almoallem or The Conran Shop).
2. Create a **public** Storefront API token for that store, and set
   `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_ACCESS_TOKEN` in Vercel.
   Then verify live catalog, cart and checkout.
3. Supply the logo file (`public/brand/logo.svg` or the Shopify asset), the
   contact email and phone, and approved copy for About, FAQs, Shipping,
   Returns, Privacy and Terms. These are bracketed placeholders now. Policy
   text is needed before launch, and the free-delivery threshold (10 KWD, from
   the theme) must be confirmed.
4. Decide whether the newsletter should use a provider (Shopify customer
   consent, Klaviyo, or similar). Until then it stays disabled.
5. Reference-site audit: see section 1.
6. Arabic copy in the policy pages is not written. Body placeholders are in
   English only.
7. Vercel Hobby plan terms restrict commercial use. A commercial store probably
   needs a paid team plan.
