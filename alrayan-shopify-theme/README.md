# Alrayan — Shopify theme

Online Store 2.0 theme built from the Alrayan Foods storefront: crimson & white colours from the Alrayan logo,
layout and type after almoallemmill.com, Arabic (RTL) and English (LTR) support. Every section has settings and
blocks you can edit in **Online Store → Themes → Customize**.

## Install

1. Shopify admin → **Online Store → Themes → Add theme → Upload zip file** → choose `alrayan-shopify-theme.zip`.
2. Click **Customize** on the uploaded theme to preview it, then **Publish** when ready.

The zip must contain the theme folders (`assets`, `config`, `layout`, `locales`, `sections`, `snippets`, `templates`)
at its top level — don't re-zip the parent folder.

## Setup checklist

| What | Where | Why |
| --- | --- | --- |
| Logo & favicon | Customize → Theme settings → Logo & favicon | Header, footer, password page |
| Main menu | Content → Menus → `main-menu` | Header navigation (sub-items become dropdowns) |
| Footer menu | Content → Menus → `footer` | Footer "Shop" column |
| Collections in sections | Customize → Home page → each section | Circles, "New arrivals", "Offers", tabs need a collection picked |
| Slide & banner images | Customize → Hero slideshow / Promo banners / Image with text | Images can't be shipped inside a theme |
| Weight options | Products → variants (e.g. option "الوزن": 250 جم, 500 جم, 1 كجم) | Shown as buttons with a price under each |
| Filters | Install **Shopify Search & Discovery** → Filters | Sidebar filters on collection & search pages |
| Category sidebar | Customize → Collection page → Category menu | Pick a menu that lists your collections |
| Arabic + English | Settings → Languages; translate content with **Translate & Adapt** | Theme strings are already translated (`locales/ar.json`, `locales/en.default.json`) |
| Discount code | Discounts → create `15OFF` (15%, minimum 6 KWD) | The theme only *shows* the code; Shopify applies it |
| WhatsApp | Customize → Theme settings → Social media & contact | Floating button, product "order on WhatsApp", cart WhatsApp checkout |

## What you can change

- **Theme settings:** 5 colour schemes (background, cards, text, accent, borders), badge colours, Latin fonts
  (Shopify font library) + Arabic fonts (Google Fonts), heading/body size, text direction (auto / RTL / LTR), page width,
  corner radii, shadows, animations, product-card style (image ratio, fit, padding, hover image, vendor, button style,
  title lines, badges), cart behaviour (drawer or page, note, progress bar goal & messages, WhatsApp checkout),
  social links, live search.
- **Sections** (each with colour scheme + top/bottom padding): Announcement bar (rotating messages, copyable code),
  Header (layout, sticky, menu, logo/name/tagline, search, account, language switcher), Hero slideshow (slides with
  desktop/mobile images, eyebrow, heading, text, 2 buttons, text position, darkening, autoplay speed, slow zoom,
  arrows, dots), Collection circles, Icon features, Featured collection (carousel or grid, columns), Promo banners,
  Collection tabs, Image with text, Values / multicolumn, Store info & map, Social links, Rich text, Newsletter,
  Contact form, Apps, Product recommendations, Recently viewed, Footer (brand, menus, text, newsletter blocks,
  payment icons).
- **Product page blocks** (drag to reorder): collection link, vendor, title, price, stock, variant picker
  (buttons/dropdown, per-option prices), quantity, buy buttons (+ dynamic checkout), WhatsApp order, perks list,
  description, collapsible tabs (text or a page), text, SKU, share, app blocks.

## Notes

- The Arabic fonts load from Google Fonts because Shopify's font library has no Arabic families; `theme-check`
  reports this as a `RemoteAsset` warning, which is expected. Set both Arabic font settings to "None" to remove it.
- Validated with Shopify's `theme-check` (0 errors) and a local render of the home, collection, product,
  collections-list, cart and 404 pages; test on a development store before publishing.
