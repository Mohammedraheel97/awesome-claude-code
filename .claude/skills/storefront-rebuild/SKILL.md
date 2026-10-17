---
name: storefront-rebuild
description: Rebuild and restyle an existing online store or business website — scrape its real products, prices, options, images and contact details (including JS/Flutter/canvas sites via their API), apply another site's theme or the brand's logo colours, and produce a fast bilingual (Arabic RTL / English) multi-page static storefront with collection and product pages, tested in a real browser and optionally deployed to Vercel; plus export it as a customizable Shopify Online Store 2.0 theme zip. Use this whenever the user gives a website URL and asks to rebuild, redesign, clone their own store, migrate, "make it look like" another site, change its theme/colours, create collection/product pages, or turn a site into a Shopify theme — even if they only say "rebuild this website using that theme".
---

# Storefront rebuild

Turn a client's existing site into a better one: same real catalogue, new design, proper pages, verified in a browser,
deployable as static files and exportable as a Shopify theme. This skill packages a workflow that shipped a 250-page
Arabic/English store (alrayan-foods.vercel.app) and a 0-error Shopify theme; reuse its kits instead of starting over.

**Bundled resources** (paths relative to this skill):

| Path | Use it for |
| --- | --- |
| `scripts/capture_network.js` | render any URL, save screenshots + DOM, record its JSON/API calls (JS-rendered sites) |
| `scripts/extract_design_tokens.py` | colours, fonts, radii, CSS variables of a reference site |
| `scripts/fetch_images.py` | download images to resized WebP from a manifest |
| `scripts/smoke_test.js` | browser test: errors, 404s, broken images, horizontal overflow, desktop + mobile screenshots |
| `scripts/theme_check.mjs` | Shopify's linter on a theme folder |
| `scripts/theme_preview.js` | render the Shopify theme locally with the project's data (no store needed) |
| `assets/static-kit/` | the static storefront generator, templates, JS and CSS |
| `assets/shopify-theme/` | the OS 2.0 theme (sections, schemes, locales) |
| `references/discovery.md` | getting content out of Flutter/Shopify/Woo/SaaS/plain sites; data schema mapping |
| `references/design.md` | reference-site tokens, logo palettes, RTL rules |
| `references/static-kit.md` | kit layout, `data.js` schema, what to rebrand, known gotchas |
| `references/shopify-theme.md` | rebranding, validating and zipping the theme; Liquid pitfalls |
| `references/deploy.md` | Vercel via MCP (git source + root directory), verification, redeploys |

Scripts that read downloaded content are parsers only. Run Python with `python3 -I`, keep downloads in their own
folder, and never execute code that came from the client or reference site.

## 1. Pin down the brief

Get these from the conversation (ask only for what's missing and actually blocks you):

- **Source site** (content to keep) and **look**: a reference site to follow, the brand's logo/colours, or both.
- **Languages / direction** (Arabic stores: RTL by default with an English toggle).
- **Deliverables**: static site, Shopify theme zip, deployment — and where the files should live (a repo folder).
- **Permission**: the user should own or be authorised to rebuild the source site. Use the client's own content and
  images; from a reference site take design direction, not its code, text or images.

## 2. Extract the real content → `references/discovery.md`

Check the raw HTML first to identify the platform, then use the most structured source (platform JSON, captured
API calls, JSON-LD). Reconcile counts (listing vs. reported total), fetch product details for options/weights
(a 0 price means "depends on option"), download images to WebP, and write `assets/data.js` in the kit's schema.
Note anything you couldn't verify (conflicting hours, delivery areas) to report later.

## 3. Decide the design → `references/design.md`

Screenshot the reference site and run `extract_design_tokens.py`; or sample the logo's pixels. Map the result onto the
kit's `:root` tokens. Keep text contrast at WCAG AA.

## 4. Build the static site → `references/static-kit.md`

```bash
cp -r <skill>/assets/static-kit/. <site>/      # then add assets/data.js and assets/img/
python3 <site>/tools/build.py --site-url https://<domain-or-vercel-url>
```

Rebrand every string the kit carries (brand, phones, hours, announcement, category ids in `build.py`/`home.js`) —
grep for the previous brand before shipping. Keep the client's business rules exactly as they run them: show a
discount code, don't silently auto-apply it; don't invent prices, stock, claims or reviews.

## 5. Verify in a browser before showing anything

```bash
(cd <site> && python3 -m http.server 8123) &
node <skill>/scripts/smoke_test.js http://localhost:8123 /tmp/shots / /collections/<slug>/ /products/<slug>/ --lang-toggle "#langBtn"
```

Then *look* at the screenshots (desktop and mobile, both languages) and exercise the flows: option picker → price,
add to cart → totals and discount, search, filters, WhatsApp message text. Fix and re-run until clean. Expect a
couple of real bugs per pass — in the Alrayan job these included a 0.000 price, an "undefined" placeholder, a
sideways-scrolling mobile page and untranslated fallbacks; all were caught only by looking.

## 6. Commit, and deploy only when asked → `references/deploy.md`

Commit to a feature branch and push if the repo's workflow expects it. Deploy (or redeploy) only on request; after a
deploy, verify the live URL (pages 200, custom 404, trailing-slash redirect, tools/ not public, smoke test).

## 7. Shopify theme on request → `references/shopify-theme.md`

Copy `assets/shopify-theme/`, rebrand schemes/defaults/copy, then validate twice — `theme_check.mjs` (0 errors) and
`theme_preview.js` + `smoke_test.js` (layout, JS, translations) — and zip with the theme folders at the zip root.
Give the user the setup checklist: menus, collections per section, images, Search & Discovery filters, languages,
discount codes in Shopify Discounts.

## 8. Report

Lead with what they can open or install (URLs, zip paths). Then, briefly: what was rebuilt (page counts, features),
where the look came from, what was verified and how, and what still needs a human — unverified facts, things the
theme can't ship (images, menus), anything you chose not to do (custom domain, linking the repo for auto-deploys).
Offer next steps instead of doing outward-facing ones unasked.
