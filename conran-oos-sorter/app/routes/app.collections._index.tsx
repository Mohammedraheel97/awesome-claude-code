import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { CollectionStatus } from "../components/CollectionStatus";
import { handleCollectionAction } from "../sorter/collection-actions.server";
import { numericId, plural } from "../sorter/format";
import { COLLECTION_SORT_ORDERS, isCollectionSortOrder, SORT_ORDER_LABELS } from "../sorter/ordering";

const FILTERS = {
  all: "All",
  changes: "Needs changes",
  queued: "Waiting",
  errors: "Errors",
  excluded: "Excluded",
} as const;
type Filter = keyof typeof FILTERS;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const filterParam = url.searchParams.get("filter") ?? "all";
  const filter: Filter = filterParam in FILTERS ? (filterParam as Filter) : "all";

  const where: Prisma.CollectionStateWhereInput = { shop };
  if (query) where.OR = [{ title: { contains: query } }, { handle: { contains: query } }];
  if (filter === "changes") Object.assign(where, { excluded: false, lastRunLive: false, lastMoves: { gt: 0 } });
  if (filter === "queued") Object.assign(where, { excluded: false, dirty: true });
  if (filter === "errors") Object.assign(where, { excluded: false, lastError: { not: null } });
  if (filter === "excluded") Object.assign(where, { excluded: true });

  const collections = await db.collectionState.findMany({ where, orderBy: { title: "asc" } });

  return {
    now: new Date().toISOString(),
    query,
    filter,
    collections: collections.map((c) => ({
      id: numericId(c.collectionId),
      title: c.title,
      handle: c.handle,
      baseSort: c.baseSort,
      excluded: c.excluded,
      restoreRequested: c.restoreRequested,
      dirty: c.dirty,
      productCount: c.productCount,
      outOfStockCount: c.outOfStockCount,
      lastMoves: c.lastMoves,
      lastRunLive: c.lastRunLive,
      lastSortedAt: c.lastSortedAt?.toISOString() ?? null,
      lastError: c.lastError,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return handleCollectionAction(session.shop, await request.formData());
};

export default function Collections() {
  const { now, query, filter, collections } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.message) shopify.toast.show(fetcher.data.message);
  }, [fetcher.state, fetcher.data, shopify]);

  // Only collections still shown can stay selected.
  const shownIds = useMemo(() => new Set(collections.map((c) => c.id)), [collections]);
  const selection = [...selected].filter((id) => shownIds.has(id));
  const allSelected = collections.length > 0 && selection.length === collections.length;

  const setParam = (key: string, value: string) =>
    setSearchParams(
      (params) => {
        if (value && value !== "all") params.set(key, value);
        else params.delete(key);
        return params;
      },
      { replace: true },
    );

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = (data: Record<string, string>) => fetcher.submit(data, { method: "POST" });
  const bulk = (intent: string, extra: Record<string, string> = {}) => {
    submit({ intent, collectionIds: selection.join(","), ...extra });
    setSelected(new Set());
  };

  return (
    <s-page heading="Collections" inlineSize="large">
      <s-section padding="none" accessibilityLabel="Collections">
        <s-table>
          <s-stack slot="filters" gap="small-200">
            <s-grid gridTemplateColumns="1fr auto" gap="small-200">
              <s-search-field
                label="Search collections"
                labelAccessibilityVisibility="exclusive"
                placeholder="Search by title or handle"
                defaultValue={query}
                onChange={(event) => setParam("q", event.currentTarget.value)}
              />
              <s-select
                label="Show"
                labelAccessibilityVisibility="exclusive"
                value={filter}
                onChange={(event) => setParam("filter", event.currentTarget.value)}
              >
                {Object.entries(FILTERS).map(([value, label]) => (
                  <s-option key={value} value={value}>
                    {label}
                  </s-option>
                ))}
              </s-select>
            </s-grid>
            {selection.length > 0 && (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text type="strong">{plural(selection.length, "collection")} selected</s-text>
                <s-button onClick={() => bulk("sort-now")}>Sort now</s-button>
                <s-button onClick={() => bulk("exclude")}>Exclude</s-button>
                <s-button onClick={() => bulk("include")}>Include</s-button>
                <s-box inlineSize="220px">
                  <s-select
                    label="Set base order"
                    labelAccessibilityVisibility="exclusive"
                    placeholder="Set base order…"
                    value=""
                    onChange={(event) => event.currentTarget.value && bulk("base-sort", { baseSort: event.currentTarget.value })}
                  >
                    {COLLECTION_SORT_ORDERS.map((order) => (
                      <s-option key={order} value={order}>
                        {SORT_ORDER_LABELS[order]}
                      </s-option>
                    ))}
                  </s-select>
                </s-box>
                <s-button tone="critical" commandFor="restore-selected-modal" command="--show">
                  Restore order
                </s-button>
                <s-button variant="tertiary" onClick={() => setSelected(new Set())}>
                  Clear
                </s-button>
              </s-stack>
            )}
          </s-stack>
          <s-table-header-row>
            <s-table-header>
              <s-checkbox
                accessibilityLabel="Select all shown collections"
                checked={allSelected}
                indeterminate={selection.length > 0 && !allSelected}
                onChange={(event) => setSelected(event.currentTarget.checked ? new Set(shownIds) : new Set())}
              />
            </s-table-header>
            <s-table-header listSlot="primary">Collection</s-table-header>
            <s-table-header listSlot="labeled">Base order</s-table-header>
            <s-table-header listSlot="labeled" format="numeric">Products</s-table-header>
            <s-table-header listSlot="labeled" format="numeric">Out of stock</s-table-header>
            <s-table-header listSlot="secondary">Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {collections.map((collection) => (
              <s-table-row key={collection.id}>
                <s-table-cell>
                  <s-checkbox
                    accessibilityLabel={`Select ${collection.title}`}
                    checked={selected.has(collection.id)}
                    onChange={(event) => toggle(collection.id, event.currentTarget.checked)}
                  />
                </s-table-cell>
                <s-table-cell>
                  <s-link href={`/app/collections/${collection.id}`}>{collection.title}</s-link>
                </s-table-cell>
                <s-table-cell>
                  {isCollectionSortOrder(collection.baseSort) ? SORT_ORDER_LABELS[collection.baseSort] : "Not checked yet"}
                </s-table-cell>
                <s-table-cell>{collection.productCount ?? "–"}</s-table-cell>
                <s-table-cell>{collection.outOfStockCount ?? "–"}</s-table-cell>
                <s-table-cell>
                  <CollectionStatus collection={collection} now={now} />
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
        {collections.length === 0 && (
          <s-box padding="base">
            <s-paragraph color="subdued">
              {query || filter !== "all"
                ? "No collections match."
                : "No collections yet. They appear after the first full check, which starts within a minute of installing."}
            </s-paragraph>
          </s-box>
        )}
      </s-section>

      <s-modal id="restore-selected-modal" heading={`Restore ${plural(selection.length, "collection")}?`}>
        <s-paragraph>
          Pushed-down products go back to their merchandised positions and automatic sort orders are switched back on.
          The app then stops managing these collections (they are excluded).
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="restore-selected-modal"
          command="--hide"
          onClick={() => bulk("restore")}
        >
          Restore
        </s-button>
        <s-button slot="secondary-actions" commandFor="restore-selected-modal" command="--hide">
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
