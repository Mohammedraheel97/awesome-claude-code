import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { CollectionStatus } from "../components/CollectionStatus";
import { handleCollectionAction } from "../sorter/collection-actions.server";
import { numericId } from "../sorter/format";
import { isCollectionSortOrder, SORT_ORDER_LABELS } from "../sorter/ordering";

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

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.message) shopify.toast.show(fetcher.data.message);
  }, [fetcher.state, fetcher.data, shopify]);

  const setParam = (key: string, value: string) =>
    setSearchParams(
      (params) => {
        if (value && value !== "all") params.set(key, value);
        else params.delete(key);
        return params;
      },
      { replace: true },
    );

  const submit = (data: Record<string, string>) => fetcher.submit(data, { method: "POST" });

  return (
    <s-page heading="Collections">
      <s-section padding="none" accessibilityLabel="Collections">
        <s-table>
          <s-grid slot="filters" gridTemplateColumns="1fr auto" gap="small-200">
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
          <s-table-header-row>
            <s-table-header listSlot="primary">Collection</s-table-header>
            <s-table-header listSlot="labeled">Base order</s-table-header>
            <s-table-header listSlot="labeled" format="numeric">Products</s-table-header>
            <s-table-header listSlot="labeled" format="numeric">Out of stock</s-table-header>
            <s-table-header listSlot="secondary">Status</s-table-header>
            <s-table-header listSlot="inline">Actions</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {collections.map((collection) => (
              <s-table-row key={collection.id}>
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
                <s-table-cell>
                  <s-stack direction="inline" gap="small-200">
                    {!collection.excluded && (
                      <s-button variant="tertiary" onClick={() => submit({ intent: "sort-now", collectionId: collection.id })}>
                        Sort now
                      </s-button>
                    )}
                    <s-button
                      variant="tertiary"
                      onClick={() =>
                        submit({ intent: collection.excluded ? "include" : "exclude", collectionId: collection.id })
                      }
                    >
                      {collection.excluded ? "Include" : "Exclude"}
                    </s-button>
                  </s-stack>
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
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
