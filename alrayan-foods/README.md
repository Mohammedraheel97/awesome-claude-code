# Alrayan Foods — storefront

Static, bilingual (Arabic RTL / English) rebuild of https://alrayan-foods.com/. Layout and typography follow
https://almoallemmill.com/; colours come from the Alrayan logo (crimson `#BD2932` and white). All colours are CSS
variables at the top of `assets/css/styles.css`.

## Pages

| URL | What it is |
| --- | --- |
| `/` | Home: hero slider, category circles, new arrivals, promo banners, explore tabs, coffee spotlight, offers, store info + map |
| `/collections/` | All collections |
| `/collections/all/` | All 227 products; also the search results page (`?q=`) |
| `/collections/<slug>/` | One page per category, with sub-category chips, in-category search and sorting (`?sub=&q=&sort=`) |
| `/products/<slug>/` | One page per product: weight/option pickers with live price, add to cart, WhatsApp order, related & recently viewed |
| `404.html` | Not-found page (served automatically by Vercel) |

Checkout hands the cart to WhatsApp (+965 9228 6229) as a ready-made message — there is no payment backend.

## Run locally

    python3 -m http.server 8000   # from this folder, then open http://localhost:8000

Pages use root-relative paths (`/assets/...`), so serve the folder rather than opening files directly.

## Editing content

Products, prices, categories and store details live in `assets/data.js`. After editing it (or the templates in
`tools/templates/`), regenerate the pages:

    python3 tools/build.py            # --site-url https://your-domain for canonical/OG links and the sitemap

The generator writes `index.html`, `404.html`, `collections/`, `products/`, `sitemap.xml` and `robots.txt`, adding
per-page titles, descriptions, Open Graph tags and schema.org data. Product and collection URL slugs are stored in
`data.js` the first time and then kept stable. Commit the generated files — the site needs no build step to deploy.

## Code

- `assets/js/core.js` — shared: data, translations, product cards, header search, menu, cart and checkout
- `assets/js/home.js`, `collections.js`, `collection.js`, `product.js` — one script per page type
- `assets/css/styles.css` — all styles
- `vercel.json` — trailing-slash URLs and long caching for images
