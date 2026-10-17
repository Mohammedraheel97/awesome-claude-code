# Getting the content out of the source site

Goal: a complete, structured copy of the client's catalogue and store details — every product, price, option,
image, category and contact fact — without guessing. Work from the most structured source available.

## 1. Look before scraping

```bash
curl -sSL -m 30 <url> -o raw.html -w "%{http_code} %{size_download}\n"
head -c 3000 raw.html
```

| What raw.html shows | Platform | Best source |
| --- | --- | --- |
| `flutter_bootstrap.js`, `<flt-…>`, "Power By MNASATI" | Flutter web app (canvas — no DOM text) | its JSON API, found with `capture_network.js` |
| `Shopify.theme`, `/cdn/shop/` | Shopify | `/products.json?limit=250&page=N`, `/collections.json`, `/products/<handle>.js` |
| `wp-content`, `woocommerce` | WooCommerce | `/wp-json/wc/store/v1/products?per_page=100&page=N`, `/wp-json/wc/store/v1/products/categories` |
| `__NEXT_DATA__` / `window.__NUXT__` script | Next / Nuxt | the embedded JSON blob, then its API routes |
| `Salla`, `Zid`, `Matjrah`, `Tlbaat` etc. | GCC SaaS stores | capture the network calls; most expose public JSON for the storefront |
| Plain server HTML | anything | `sitemap.xml` → product URLs → JSON-LD (`<script type="application/ld+json">`) per page |

## 2. Capture what a JS app loads

```bash
node <skill>/scripts/capture_network.js https://client-site.com work/capture
# then open the product page / a category in the app and capture those too, e.g. https://client-site.com/product/66
```

Read `requests.txt` for endpoints and `network.json` for bodies. Look for: an *initialize/settings* call (store
name, phones, address, colours, logo, banners, social links, payment methods), *categories*, a *home* listing,
and a *product detail* call (options/variants/weights live here, not in listings).

Endpoints that answer "Access denied" to GET often want POST with a form body — copy exactly what the app sent
(`requests.txt` shows POST bodies). Mnasati example from the Alrayan job:

```
GET  /api/v2/mobileapi/initialize/?v=2        -> settings: phones, address, colours, logo, banners, socials, description
GET  /api/v2/mobileapi/categories?v=2         -> categories + sub-categories with images
GET  /api/v2/mobileapi/home?v=2               -> categories[].products (+ sub_category[].products), vouchers, payment methods
GET  /api/v2/mobileapi/branches?v=2           -> branch address, lat/lng, working hours
POST /api/v2/mobileapi/product/?v=2  product_id=66   -> options (weights with prices), images, description
```

Check totals: the settings call reported 227 products while the home listing alone had 179 — the rest were nested
under sub-categories. Reconcile counts before moving on.

## 3. Products with price 0

A listing price of 0 almost always means "price depends on an option" (weight, size). Fetch each product's
detail and store options as `opts: [{en, ar, vals: [{id, en, ar, p}]}]` with `price` = cheapest combination,
shown as "From …". Never publish a 0.000 price.

## 4. Normalise into the kit's schema

Write `assets/data.js` with three globals (see `static-kit.md` for every field): `window.SITE`, `window.CATS`,
`window.PRODUCTS`. While normalising:

- Trim whitespace, fix obvious typos in *English* names only (e.g. "peanats"), title-case English names; keep the
  client's Arabic text as written.
- Keep category membership from the source (a product can appear in "New arrivals" and its own category).
- Download images with `fetch_images.py` (products 640px, categories 800px, banners 1920px, WebP q82) so the
  site doesn't depend on the old CDN. 250 images went from 26 MB to 6 MB this way.
- Record facts you could not verify (opening hours that conflict between two endpoints, delivery areas) and tell
  the user which value you used.

## 5. Permission

Only rebuild sites the user owns or is authorised to rebuild. Use the client's own content and images; from a
*reference* site take design direction (colours, type, layout patterns), not its code, copy text or images.
