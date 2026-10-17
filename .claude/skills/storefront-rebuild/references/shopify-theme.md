# Exporting a Shopify theme (`assets/shopify-theme/`)

An Online Store 2.0 theme with the same design as the static kit: colour schemes, a setting for nearly everything,
Arabic + English locales, 0 errors in `theme-check`. Copy it, rebrand it, validate it, zip it.

## Structure

```
layout/theme.liquid, password.liquid   direction (auto RTL for ar/he/fa/ur), fonts, window.theme strings/routes
config/settings_schema.json            logo, colour_scheme_group (9 roles incl. card text/accent), badges, typography
                                       (Shopify fonts + Arabic Google fonts), layout radii, product cards, cart, WhatsApp,
                                       socials, search
config/settings_data.json              5 schemes: page, white, accent, dark, soft
sections/header-group.json             announcement-bar + header;  footer-group.json: footer
sections/*.liquid                      hero-slideshow, collection-circles, icon-features, featured-collection,
                                       promo-banners, collection-tabs, image-with-text, values-grid, store-info, social-band,
                                       rich-text, newsletter, contact-form, apps, product-recommendations, recently-viewed,
                                       main-* (collection with filters/sort, list-collections, product with blocks, cart,
                                       search, page, blog, article, 404, password, customer pages), cart-drawer,
                                       predictive-search, product-card-render
snippets/                              product-card, price, icon, facets, active-filters, pagination, social-icons,
                                       section-heading, css-variables, meta-tags, address-form, whatsapp-float
templates/*.json                       index (pre-filled home), product, collection, … + customers/*, gift_card.liquid
locales/en.default.json, ar.json       every string the theme prints (Arabic plural forms included)
assets/theme.css, theme.js             no dependencies
```

Every content section has `color_scheme`, `padding_top`, `padding_bottom` and its own options; the product page is
built from reorderable blocks (title, price, variant picker with per-option prices, quantity, buy buttons + dynamic
checkout, WhatsApp order, perks, description, collapsible tabs, share, SKU, app blocks).

## Rebrand

1. `cp -r <skill>/assets/shopify-theme <project>/<name>-shopify-theme`
2. `config/settings_schema.json`: `theme_info` name/author; colour defaults; social & WhatsApp defaults.
3. `config/settings_data.json`: the 5 schemes (accent = brand colour; derive the rest as in `design.md`).
4. `templates/index.json`, `sections/*-group.json`, section `default`/`presets`: replace copy, phones, address, map
   coordinates, social handles. `grep -rn "الريان\|Alrayan\|15OFF\|9228\|29.375" <theme>` to find them.
5. Locales: add a `locales/<lang>.json` for other languages; keep keys identical to `en.default.json`.

## Validate (both steps — they catch different bugs)

```bash
npm i --prefix /tmp/tc @shopify/theme-check-node liquidjs@10
NODE_PATH=/tmp/tc/node_modules node <skill>/scripts/theme_check.mjs <theme>          # must report 0 errors
NODE_PATH=/tmp/tc/node_modules node <skill>/scripts/theme_preview.js <theme> <static-site> /tmp/preview
(cd /tmp/preview && python3 -m http.server 8124) &
node <skill>/scripts/smoke_test.js http://localhost:8124 /tmp/shots / /collections/<handle>/ /products/<handle>/
```

`theme_preview.js` renders with the static site's `data.js`; "[missing key]" in its output = untranslated string.
It is not Shopify: the "Buy it now" button, recommendations and recently viewed fetches are stubs there.

## Liquid pitfalls found in review (check new code for these)

- **Filter order:** `'key' | t: amount: x | money` applies `money` to the translated string. Compute first:
  `{% assign saving = x | money %}{{ 'key' | t: amount: saving }}`. Same for `| date`.
- **No interpolation inside string literals:** `style: 'width: {{ n }}px'` and `id: 'Form-{{ section.id }}'` are
  literal text. Build with `append` into a variable first.
- **`default:` with a translation key** (`| default: 'search.placeholder'`) prints the key. Translate first.
- **Opening a tag in one `if` branch and closing it in another** (`{% if carousel %}<div class="rail">{% else %}<div class="grid">{% endif %}`)
  is a theme-check parse error — `capture` the cards and render each wrapper whole.
- `form` only exists inside `{% form %}`; `script_tag` is parser-blocking — use `<script src defer>`.
- `settings` is global inside snippets on Shopify (liquidjs needs `globals` to mimic this — already handled).
- **Visually-hidden text inside a scroll container**: an `position:absolute` label (e.g. "Regular price" inside the
  strike-through price) attaches to the nearest positioned ancestor; if that is outside the scrolling rail it escapes
  and makes the whole page scroll sideways on phones. Give `.card` and `.rail` `position: relative`.
- Section-rendering API powers the drawer (`sections=cart-drawer`), predictive search
  (`/search/suggest?section_id=predictive-search`), recommendations and recently viewed (`?section_id=product-card-render`).

## Package

Shopify needs the theme folders at the zip root:

```bash
cd <theme> && zip -qr ../<name>-shopify-theme.zip assets config layout locales sections snippets templates
```

Install: Online Store → Themes → Add theme → Upload zip file → Customize → Publish. Hand the user the setup checklist
from the theme README (menus, collections per section, images, Search & Discovery filters, languages, discount code
in Discounts — the theme only displays it).
