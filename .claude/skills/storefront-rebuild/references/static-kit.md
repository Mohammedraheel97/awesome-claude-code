# The static storefront kit (`assets/static-kit/`)

A dependency-free, bilingual (Arabic RTL / English LTR) multi-page store generated from one data file. Proven on
alrayan-foods.vercel.app (250 pages, 227 products).

## Contents

```
tools/build.py            generator: data.js + templates -> index.html, collections/**, products/**, 404, sitemap, robots
tools/templates/*.html    layout (header, footer, drawers), home, collections, collection, product, 404
assets/js/core.js         shared: data access, i18n dictionary, cards, header live search, menu, cart, WhatsApp checkout
assets/js/home.js         hero slider, category circles, rails, explore tabs (+ its own strings)
assets/js/collection.js   sub-category chips, in-collection search, sort, paging, ?sub=&q=&sort= in the URL
assets/js/collections.js  all-collections grid
assets/js/product.js      option pickers + live price, add to cart, WhatsApp order, zoom, related, recently viewed, sticky bar
assets/css/styles.css     every style; tokens at the top
vercel.json, .vercelignore trailing-slash URLs, long image caching; keeps tools/ off the deployed site
```

## Start a project

```bash
mkdir -p <site> && cp -r <skill>/assets/static-kit/. <site>/
# put data in <site>/assets/data.js and images in <site>/assets/img/{products,categories,site}/
python3 <site>/tools/build.py --site-url https://<final-domain>
(cd <site> && python3 -m http.server 8123)
```

`build.py` adds stable `slug`s to `data.js` the first time (from English names; `all` is reserved) and rewrites
generated folders on every run. Re-run it after any data or template change and commit the output — deploys need no
build step.

## data.js schema

```js
window.SITE = { name_en, name_ar, phone, phone2, whatsapp /* intl, no + */, email, address_ar, address_en, branch_ar,
  lat, lng, facebook, instagram, tiktok, description /* ar */, banners: ['assets/img/site/banner1.webp', …],
  logo, favicon, payments: [{ en, ar, img }], voucher: { ar, en, code, min, pct } };
window.CATS = [{ id, en, ar, n /* product count */, img, slug, subs: [{ id, en, ar }], items: [productId, …] }];
window.PRODUCTS = [{ id, en, ar, slug, price /* lowest */, old /* compare-at or null */, cat, sub, img,
  den, dar /* plain-text descriptions */, stock /* 1|0 */, opts?: [{ en, ar, vals: [{ id, en, ar, p }] }] }];
```

Unit price for a selection = `price - sum(min of each group) + sum(selected p)` (`core.js: unitPrice`).

## What to change per client

Search for the old brand before shipping: `grep -rn "Alrayan\|الريان\|15OFF\|9228\|Hawally\|حولي" <site>/tools <site>/assets/js`.

| Where | What |
| --- | --- |
| `tools/build.py` | `BRAND`, `NAV_CATS`, `FOOTER_CATS` (category ids), schema.org store type, opening hours |
| `tools/templates/layout.html` | announcement text, phone numbers, footer text, fonts link |
| `tools/templates/home.html` | section copy, which category ids the promo/coffee blocks link to (`data-cat-link`) |
| `assets/js/core.js` | `T.ar` / `T.en` strings (brand, hours, payment note, announce text) |
| `assets/js/home.js` | `dict` strings, `heroes`, `HERO_LINKS`, `EXPLORE` category ids, featured rail ids |
| `assets/css/styles.css` | `:root` tokens, fonts |

Keep business rules exactly as the client runs them. In the Alrayan job the cart first auto-applied the 15% code at
6 KWD — that changed how the promotion works, so it was reverted to "code must be entered, show a hint when eligible".

## Pages and features you get

Home (announcement bar with copyable code, crimson header + desktop nav, swipeable hero with progress dots,
category circles, USP band, new-arrivals rail, 2 promo banners, explore tabs, coffee-style spotlight, offers rail,
values grid, store info + Google map, social band), `/collections/`, `/collections/all/` (doubles as search results
`?q=`), one page per category and per product, 404, cart drawer with progress bar, WhatsApp checkout, language toggle
remembered across pages, per-page title/description/OG/schema.org Product + BreadcrumbList, sitemap.xml.

## Gotchas met while building it

- Page scripts add their strings *after* core's first i18n pass → `AR.page()` re-runs the whole pass, and missing
  keys are skipped instead of written as "undefined".
- Grid children default to `min-width: auto`; a horizontally scrolling strip inside a grid column widened the page
  on mobile → `.shop-layout > * { min-width: 0 }`.
- A CSS `url()` inside a custom property resolves relative to the stylesheet that *uses* it, not the HTML → put
  image URLs in the stylesheet or use absolute paths.
- Pages use root-relative paths (`/assets/…`), so preview with a local server, not `file://`.
- Lazy images look blank in full-page screenshots — scroll the page first (the smoke test does).
