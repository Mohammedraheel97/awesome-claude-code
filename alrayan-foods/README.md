# Alrayan Foods — rebuilt storefront

Static, dependency-free rebuild of https://alrayan-foods.com/ using the visual theme of https://almoallemmill.com/
(cream `#F5EDD6` background, brown `#3B2314` text, red `#C0392B` buttons, Barlow Condensed headings, 5px-radius buttons,
centered-logo header, full-bleed hero, white product cards with red "add to cart" buttons, mosaic collection tiles, dark-brown footer).

## Run

    python3 -m http.server 8000   # then open http://localhost:8000

No build step. Deploy the folder as-is to any static host (Vercel, Netlify, GitHub Pages, S3…).

## What is included

- Arabic (RTL, default) and English (LTR) with a language toggle
- Hero slider, 15OFF promo, featured rows, 19 category tiles, searchable/filterable catalogue (227 products)
- Weight/option selection with real per-weight prices, product modal, cart drawer, discount code
- Checkout hands the order to WhatsApp (+965 9228 6229) as a ready-made message — there is no payment backend

## Files

- `index.html`, `assets/styles.css`, `assets/app.js` — the site
- `assets/data.js` — products, categories and store details captured from the original store's public API
- `assets/img/` — all images, converted to WebP and stored locally

To change prices, names or contact details, edit `assets/data.js`.
