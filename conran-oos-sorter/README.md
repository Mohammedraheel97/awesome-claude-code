# Out-of-Stock Sorter for The Conran Shop

A custom Shopify app that keeps out-of-stock products at the bottom of **every collection**,
automatically, without undoing the merchandising team's work.

- Products that sell out move below the in-stock products within about a minute.
- Restocked products go back to **exactly** where the merchandiser had them.
- Manual collections keep their curated order. Collections on an automatic sort (best selling,
  newest, price…) keep that order too.
- It starts in **preview mode** and changes nothing until you press **Go live**.

## Read this before going live

The store already has **ST Product Collection Sort** (SearchTap) installed. Collections are
being re-sorted daily (most were last updated around 11:15 UTC). The two collections spot-checked,
*Sofas* and *Ceiling & Pendant Lights*, already have out-of-stock products at the bottom.

Two apps reordering the same collections will keep undoing each other. Before you press
**Go live**, turn off ST Product Collection Sort's sorting (or uninstall it) for the collections
this app manages. If ST is also applying other rules you rely on, such as boosting new arrivals,
note them first. This app only does out-of-stock-to-bottom on top of a base order.

## How it decides

| Question | Answer |
| --- | --- |
| When is a product out of stock? | When **none** of its variants can be sold (Shopify's `availableForSale`). Variants that keep selling when out of stock, or don't track inventory, count as in stock. |
| What order do in-stock products follow? | The collection's **base order**. For manual collections that's the merchandiser's order. For automatic sorts, it's that sort. Out-of-stock products follow the same order among themselves. |
| What if a collection uses best selling, newest, etc.? | Shopify can only reorder manual collections. The app remembers the chosen sort as the base order, switches the collection to manual, and re-applies the sort on every full check (every 6 hours by default). To change it, pick a new sort in Shopify admin as usual, or on the app's collection page. |
| Where do restocked products go? | In manual collections, back to their exact merchandised position. The app remembers the full curated order, including pushed-down products. Products that were already at the bottom before the app was installed have no earlier position, so they join the end of the in-stock products. |
| What if a merchandiser drags products in Shopify admin? | It's respected. In-stock products keep the new order. An out-of-stock product dragged up among in-stock ones is pushed down again, but that spot becomes its new home for when it restocks. |
| Can a product stay put even when out of stock? | Yes. Tag it `oos-keep-position` (you can change the tag in Settings). Useful for pre-orders and hero pieces. |
| Can a collection be left alone? | Yes. Click **Exclude** on the Collections page. |

## What's in the app

**Dashboard** (the control center)

- **Mode**: *Off* (nothing is read or changed), *Preview* (plans only), or *Live*. Going live asks
  for confirmation and shows how many products the current plan would move.
- **Pause** for 1 hour, 4 hours or 1 day, e.g. while merchandising a campaign. Stock changes are
  still recorded and applied on resume.
- **Run full check now** and **Process waiting work** buttons.
- **Overview**: products out of stock, collections managed, products moved today (or moves
  waiting for go-live in preview), and background-worker health. A progress bar shows the current
  full check.
- **Charts** for products moved per day and products out of stock over the last 14 days, with
  hover tooltips and a table view.
- **Needs attention**: collections that failed, and those with the most out-of-stock products.
- **Restore all and turn off**: puts every collection back the way it was before the app,
  then turns the app off.
- **Recent activity** log.

**Collections**: every collection with its base order, product and out-of-stock counts, and
status. Search, filter (*Needs changes*, *Waiting*, *Errors*, *Excluded*), and select several to
**Sort now**, **Exclude**, **Include**, **Set base order** or **Restore order** in one go.

**Collection page**: a dry run of the next sort. It shows which products would move and from
which position to which, plus the first 24 products afterwards. From here you can **Apply to this
collection only** (in preview), change the base order, exclude the collection, or
**Restore original order**. Restoring puts pushed-down products back in their merchandised
positions (or gives an automatic sort order back) and stops managing the collection.

**Settings**: keep-in-place tag, restock behaviour, and full-check interval.

## Set up

### 1. Create the app

In the [Shopify Dev Dashboard](https://dev.shopify.com/), create an app in The Conran Shop's
organization, or in a Partner organization with **Custom distribution**. Then:

```sh
cd conran-oos-sorter
npm install
cp .env.example .env
npm run config:link     # links shopify.app.toml to the app you just created
```

### 2. Try it on a development store

```sh
npm run dev             # Shopify CLI: tunnel, auth, installs on your dev store
npm test                # 58 tests: ordering logic, Shopify API layer, worker end to end
```

### 3. Deploy

The app needs an **always-on Node 22 server** with a persistent database. The background worker
runs inside the web process. The `Dockerfile` works on Fly.io, Render, Railway, Google Cloud Run
(with min instances = 1) and similar hosts.

| Variable | Value |
| --- | --- |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` | From the Dev Dashboard (`npm run env show`) |
| `SHOPIFY_APP_URL` | Public URL of the deployment |
| `SCOPES` | `write_products,read_inventory` |
| `DATABASE_URL` | e.g. `file:/data/prod.sqlite` on a persistent volume (see Database below) |
| `NODE_ENV` | `production` |

Set `application_url` in `shopify.app.toml` to the same URL, then push the app configuration
(scopes and webhooks) to Shopify:

```sh
npm run deploy
```

### 4. Install on the store

- App in a **Partner organization**: Dev Dashboard → app → *Distribution* → **Custom distribution**
  → enter the store's `myshopify.com` domain → **Generate link**, then open the link as a store
  owner or staff with app permissions. Leave *Allow multi-store installs* on to add the other
  Conran Shop stores in the same Plus organization later.
- App in the **store's own organization**: install it from the app's *Installs* card.

The app asks for `write_products` (to set collections to manual and reorder them) and
`read_inventory` (for inventory webhooks).

### 5. Roll out safely

1. Open the app. The first full check starts within a minute. It reads every collection and
   records what it **would** do, without changing anything.
2. On **Collections**, filter by *Needs changes* and open a few collections to review the planned
   moves.
3. Try one collection: open it, click **Apply to this collection only**, then check it on the
   storefront.
4. Turn off ST Product Collection Sort's sorting (see above).
5. On the Dashboard, click **Go live**. All collections are sorted over the next few minutes.
   Afterwards, only collections with stock changes are touched.

You can switch back to preview, pause, exclude a collection, or turn the app off at any time. To
undo everything, use **Restore all and turn off** on the Dashboard.

## How it runs

```
webhooks ──► queue (database) ──► worker tick (every 60 s) ──► Shopify Admin API
             inventory_levels/update     1. full check when due (bulk stock export + queue all)
             products/create|update      2. re-check queued products: did any switch between
             collections/create|update      in stock and out of stock?
                                         3. sort affected collections, highest priority first
```

- A product's collections are re-sorted only when it actually switches between in stock and out
  of stock. The constant inventory updates from the NetSuite/NodeRed sync cost one cheap check
  each and nothing more.
- Sorting uses the fewest possible moves. Products that don't need to move aren't touched, and
  large changes are sent in batches of 250 with each batch finished before the next starts.
- API rate limits are respected automatically: the app slows down when the budget runs low and
  retries throttled requests.
- A database lock keeps two workers from ever running at once.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OOS_SORTER_TICK_SECONDS` | `60` | How often the in-process worker runs |
| `OOS_SORTER_SCHEDULER` | on | Set to `off` to disable the in-process worker, e.g. on serverless hosts |
| `CRON_SECRET` | unset | Enables `POST /api/worker` with `Authorization: Bearer <CRON_SECRET>` so an external scheduler can run the worker (`?budget=50` sets the seconds per run) |

## Database

SQLite is the default and suits a single always-on instance. Put the file on a persistent volume.
To run more than one instance, switch to PostgreSQL:

1. In `prisma/schema.prisma`, set `provider = "postgresql"`.
2. Delete `prisma/migrations`, then run `npx prisma migrate dev --name init` against a
   PostgreSQL `DATABASE_URL`.
3. Turn off the in-process scheduler on all but one instance (`OOS_SORTER_SCHEDULER=off`), or
   drive the worker with `POST /api/worker`.

## Code map

| Path | What it does |
| --- | --- |
| `app/sorter/ordering.ts` | Pure logic: desired order, remembered merchandised order, and the fewest moves to get there |
| `app/sorter/shopify-gateway.server.ts` | Every Admin GraphQL call (validated against API 2026-10), plus pagination, throttling, reorder jobs and bulk export |
| `app/sorter/collection-sorter.server.ts` | Sorts one collection (or dry-runs it) |
| `app/sorter/worker.server.ts` | The background worker: full checks, webhook queue, scheduling and locking |
| `app/sorter/store.server.ts` | Database helpers |
| `app/routes/app._index.tsx` | Dashboard: controls, overview, charts, activity, undo |
| `app/routes/app.settings.tsx` | Settings |
| `app/components/charts.tsx` | Dependency-free SVG charts (columns, line, progress meter) |
| `app/routes/app.collections._index.tsx`, `app/routes/app.collections.$id.tsx` | Collections list and per-collection preview |
| `app/routes/webhooks.*.tsx` | Webhook endpoints |
| `app/sorter/testing/fake-shopify.ts` | In-memory Shopify used by the tests, with the same reorder semantics as the real API |

Built on Shopify's official React Router app template (MIT, see `LICENSE.md`).
