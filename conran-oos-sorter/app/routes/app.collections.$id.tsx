import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { CollectionStatus } from "../components/CollectionStatus";
import { handleCollectionAction } from "../sorter/collection-actions.server";
import { sortCollection } from "../sorter/collection-sorter.server";
import { plural } from "../sorter/format";
import { COLLECTION_SORT_ORDERS, decodeMemory, isCollectionSortOrder, SORT_ORDER_LABELS } from "../sorter/ordering";
import { adminTransport, createShopifyGateway, type AdminGraphql } from "../sorter/shopify-gateway.server";
import { getSettings, getStock } from "../sorter/store.server";
import { processCollection } from "../sorter/worker.server";

const TOP_COUNT = 24;

type StockLabel = "out" | "pinned" | "restocked" | "in";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const collectionId = `gid://shopify/Collection/${params.id}`;
  const [settings, state] = await Promise.all([
    getSettings(shop),
    db.collectionState.findUnique({ where: { shop_collectionId: { shop, collectionId } } }),
  ]);

  // Always a dry run: shows what the next sort would do, using the same code as the worker.
  const gateway = createShopifyGateway(adminTransport(admin.graphql as unknown as AdminGraphql));
  const plan = await sortCollection({
    gateway,
    collectionId,
    storedBaseSort: isCollectionSortOrder(state?.baseSort) ? state.baseSort : null,
    memory: decodeMemory(state?.manualMemory),
    restoreManualPositions: settings.restoreManualPositions,
    pinTag: settings.pinTag,
    getStock: (ids) => getStock(shop, gateway, ids),
    live: false,
  });
  if (plan.status === "missing") throw new Response("Collection not found", { status: 404 });

  const titles = new Map(plan.current.map((product) => [product.id, product.title]));
  const currentPosition = new Map(plan.current.map((product, index) => [product.id, index + 1]));
  const targetPosition = new Map(plan.target.map((id, index) => [id, index + 1]));
  const outOfStock = new Set(plan.outOfStock);
  const pinned = new Set(plan.pinned);
  const restored = new Set(plan.restored);
  const stockLabel = (id: string): StockLabel =>
    outOfStock.has(id) ? "out" : pinned.has(id) ? "pinned" : restored.has(id) ? "restocked" : "in";

  return {
    now: new Date().toISOString(),
    id: params.id!,
    liveMode: settings.liveMode,
    pinTag: settings.pinTag,
    collection: {
      title: plan.collection.title,
      handle: plan.collection.handle,
      shopifySortOrder: plan.collection.sortOrder,
    },
    state: state && {
      excluded: state.excluded,
      restoreRequested: state.restoreRequested,
      dirty: state.dirty,
      lastError: state.lastError,
      lastSortedAt: state.lastSortedAt?.toISOString() ?? null,
      lastMoves: state.lastMoves,
      lastRunLive: state.lastRunLive,
    },
    plan: {
      baseSort: plan.baseSort,
      switchToManual: plan.switchedToManual,
      productCount: plan.current.length,
      outOfStockCount: plan.outOfStock.length,
      pinnedCount: plan.pinned.length,
      moveCount: plan.moves.length,
      moves: plan.moves.slice(0, 500).map((move) => ({
        id: move.id,
        title: titles.get(move.id) ?? move.id,
        stock: stockLabel(move.id),
        from: currentPosition.get(move.id)!,
        to: targetPosition.get(move.id)!,
      })),
      top: plan.target.slice(0, TOP_COUNT).map((id) => ({ id, title: titles.get(id) ?? id, stock: stockLabel(id) })),
    },
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();

  if (form.get("intent") === "apply-once") {
    // Lets merchandisers try the app on one collection while everything else stays in preview.
    const collectionId = `gid://shopify/Collection/${params.id}`;
    const state = await db.collectionState.findUnique({ where: { shop_collectionId: { shop, collectionId } } });
    if (!state) return { message: "Collection not found. Run a full check first." };
    const settings = await getSettings(shop);
    await processCollection(
      shop,
      createShopifyGateway(adminTransport(admin.graphql as unknown as AdminGraphql)),
      { ...settings, liveMode: true },
      { ...state, excluded: false },
    );
    const after = await db.collectionState.findUnique({ where: { shop_collectionId: { shop, collectionId } } });
    return {
      message: after?.lastError
        ? `Couldn't sort ${state.title}: ${after.lastError}`
        : `${state.title} sorted (${plural(after?.lastMoves ?? 0, "move")}).`,
    };
  }

  form.set("collectionId", params.id!);
  return handleCollectionAction(shop, form);
};

const STOCK_BADGES: Record<StockLabel, JSX.Element> = {
  out: <s-badge tone="critical">Out of stock</s-badge>,
  pinned: <s-badge tone="info">Out of stock · kept in place</s-badge>,
  restocked: <s-badge tone="success">Back in stock</s-badge>,
  in: <s-badge tone="success">In stock</s-badge>,
};

export default function CollectionDetail() {
  const { now, id, liveMode, pinTag, collection, state, plan } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.message) shopify.toast.show(fetcher.data.message);
  }, [fetcher.state, fetcher.data, shopify]);

  const submit = (data: Record<string, string>) => fetcher.submit(data, { method: "POST" });
  const excluded = state?.excluded ?? false;

  return (
    <s-page heading={collection.title}>
      <s-link slot="breadcrumb-actions" href="/app/collections">
        Collections
      </s-link>
      {liveMode && !excluded && (
        <s-button slot="primary-action" variant="primary" onClick={() => submit({ intent: "sort-now" })} {...(busy ? { loading: true } : {})}>
          Sort now
        </s-button>
      )}
      {!liveMode && !excluded && (
        <s-button slot="primary-action" variant="primary" onClick={() => submit({ intent: "apply-once" })} {...(busy ? { loading: true } : {})}>
          Apply to this collection only
        </s-button>
      )}
      <s-button slot="secondary-actions" onClick={() => submit({ intent: excluded ? "include" : "exclude" })}>
        {excluded ? "Include collection" : "Exclude collection"}
      </s-button>
      <s-button slot="secondary-actions" commandFor="restore-modal" command="--show">
        Restore original order
      </s-button>

      {excluded && (
        <s-banner tone="info" heading="This collection is excluded">
          <s-paragraph>The app leaves its order alone. Below is what including it would do.</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Next sort">
        <s-stack gap="base">
          <s-paragraph>
            {plan.moveCount === 0
              ? "The collection is already in order: every out-of-stock product is below the in-stock ones."
              : `${plural(plan.moveCount, "product")} ${liveMode && !excluded ? "will be" : "would be"} moved.`}{" "}
            {plan.outOfStockCount.toLocaleString("en-GB")} of {plural(plan.productCount, "product")} {plan.outOfStockCount === 1 ? "is" : "are"} out of stock
            {plan.pinnedCount > 0
              ? `, and ${plural(plan.pinnedCount, "out-of-stock product")} tagged “${pinTag}” ${plan.pinnedCount === 1 ? "stays" : "stay"} in place`
              : ""}
            .
          </s-paragraph>
          {plan.switchToManual && (
            <s-banner tone="info">
              <s-paragraph>
                This collection is sorted by “{SORT_ORDER_LABELS[collection.shopifySortOrder]}” in Shopify. The app keeps that order but switches the collection to manual so it can move products.
              </s-paragraph>
            </s-banner>
          )}
          <s-select
            label="Base order"
            details="Order of products before out-of-stock products are pushed down. Changing the sort order in Shopify admin updates this too."
            value={plan.baseSort}
            onChange={(event) => submit({ intent: "base-sort", baseSort: event.currentTarget.value })}
          >
            {COLLECTION_SORT_ORDERS.map((order) => (
              <s-option key={order} value={order}>
                {SORT_ORDER_LABELS[order]}
              </s-option>
            ))}
          </s-select>
        </s-stack>
      </s-section>

      {plan.moves.length > 0 && (
        <s-section heading="Products that move">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="secondary">Stock</s-table-header>
              <s-table-header listSlot="labeled" format="numeric">Now</s-table-header>
              <s-table-header listSlot="labeled" format="numeric">After</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {plan.moves.map((move) => (
                <s-table-row key={move.id}>
                  <s-table-cell>{move.title}</s-table-cell>
                  <s-table-cell>{STOCK_BADGES[move.stock]}</s-table-cell>
                  <s-table-cell>{move.from}</s-table-cell>
                  <s-table-cell>{move.to}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
          {plan.moveCount > plan.moves.length && (
            <s-paragraph color="subdued">Showing the first {plan.moves.length} of {plan.moveCount} moves.</s-paragraph>
          )}
        </s-section>
      )}

      <s-section heading={`First ${plan.top.length} products after sorting`}>
        <s-ordered-list>
          {plan.top.map((product) => (
            <s-list-item key={product.id}>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text>{product.title}</s-text>
                {product.stock !== "in" && STOCK_BADGES[product.stock]}
              </s-stack>
            </s-list-item>
          ))}
        </s-ordered-list>
      </s-section>

      <s-section slot="aside" heading="Status">
        <s-stack gap="small-200">
          {state ? <CollectionStatus collection={state} now={now} /> : <s-badge>Not checked yet</s-badge>}
          <s-text color="subdued">Mode: {liveMode ? "Live" : "Preview (nothing is changed)"}</s-text>
          <s-link href={`shopify://admin/collections/${id}`} target="_blank">
            Open in Shopify admin
          </s-link>
        </s-stack>
      </s-section>
      <s-modal id="restore-modal" heading={`Restore ${collection.title}?`}>
        <s-paragraph>
          {plan.baseSort === "MANUAL"
            ? "Products the app pushed down go back to their merchandised positions, in stock or not."
            : `The collection gets its "${SORT_ORDER_LABELS[plan.baseSort]}" sort order back, so Shopify orders it again.`}{" "}
          The app then stops managing this collection (it is excluded). You can include it again at any time.
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="restore-modal"
          command="--hide"
          onClick={() => submit({ intent: "restore" })}
        >
          Restore
        </s-button>
        <s-button slot="secondary-actions" commandFor="restore-modal" command="--hide">
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
