// Everything the sorter needs from the Shopify Admin GraphQL API, behind a small interface
// so the sorting logic can be tested against an in-memory fake.

import {
  chunk,
  serializeTags,
  type CollectionSortOrder,
  type Move,
  type ProductSortSpec,
} from "./ordering";

export interface CollectionMeta {
  id: string;
  title: string;
  handle: string;
  sortOrder: CollectionSortOrder;
  productsCount: number;
}

export interface ProductRef {
  id: string;
  title: string;
}

export interface StockInfo {
  available: boolean;
  /** See serializeTags(). */
  tags: string;
}

export interface ShopifyGateway {
  listCollections(): Promise<CollectionMeta[]>;
  getCollection(collectionId: string): Promise<CollectionMeta | null>;
  getCollectionProducts(collectionId: string, spec: ProductSortSpec): Promise<ProductRef[]>;
  getProductsStock(productIds: string[]): Promise<Map<string, StockInfo>>;
  getProductCollections(productId: string): Promise<Omit<CollectionMeta, "sortOrder" | "productsCount">[]>;
  /** inventory item id -> product id */
  resolveInventoryItems(inventoryItemIds: string[]): Promise<Map<string, string>>;
  setManualSort(collectionId: string): Promise<void>;
  reorderProducts(collectionId: string, moves: Move[]): Promise<void>;
  fetchAllProductsStock(): Promise<Map<string, StockInfo>>;
}

export type GraphqlTransport = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

/** The part of the admin client returned by authenticate.admin() / unauthenticated.admin(). */
export type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown>; tries?: number },
) => Promise<Response>;

interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

interface CostExtensions {
  cost?: { requestedQueryCost?: number; throttleStatus?: ThrottleStatus };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wraps admin.graphql: returns `data`, waits and retries when Shopify throttles the query,
 * and slows down before the cost bucket runs dry.
 */
export function adminTransport(
  graphql: AdminGraphql,
  { maxAttempts = 8, wait = sleep }: { maxAttempts?: number; wait?: (ms: number) => Promise<unknown> } = {},
): GraphqlTransport {
  return async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await graphql(query, { variables, tries: 3 });
        const body = (await response.json()) as { data: T; extensions?: CostExtensions };
        const status = body.extensions?.cost?.throttleStatus;
        if (status && status.currentlyAvailable < status.maximumAvailable * 0.2) {
          const deficit = status.maximumAvailable * 0.2 - status.currentlyAvailable;
          await wait(Math.ceil((deficit / Math.max(status.restoreRate, 1)) * 1000));
        }
        return body.data;
      } catch (error) {
        const delay = throttleDelay(error);
        if (delay === null || attempt >= maxAttempts) throw error;
        await wait(delay);
      }
    }
  };
}

/** Milliseconds to wait before retrying a throttled request, or null for other errors. */
export function throttleDelay(error: unknown): number | null {
  const body = (error as { body?: { errors?: { graphQLErrors?: { extensions?: { code?: string } }[] }; extensions?: CostExtensions } })?.body;
  const throttled = body?.errors?.graphQLErrors?.some((e) => e.extensions?.code === "THROTTLED");
  if (throttled) {
    const cost = body?.extensions?.cost;
    const status = cost?.throttleStatus;
    if (status && cost?.requestedQueryCost) {
      const deficit = cost.requestedQueryCost - status.currentlyAvailable;
      return Math.max(1000, Math.ceil((deficit / Math.max(status.restoreRate, 1)) * 1000) + 250);
    }
    return 2000;
  }
  const retryAfter = (error as { retryAfter?: number })?.retryAfter;
  if (typeof retryAfter === "number") return Math.max(1000, retryAfter * 1000);
  return null;
}

class ShopifyUserError extends Error {}

function assertNoUserErrors(operation: string, errors: { field?: string[] | null; message: string }[] | undefined) {
  if (errors && errors.length > 0) {
    throw new ShopifyUserError(`${operation}: ${errors.map((e) => e.message).join("; ")}`);
  }
}

// --- GraphQL documents (validated against the 2026-10 Admin API schema) ---

const COLLECTION_FIELDS = `id title handle sortOrder productsCount { count }`;

const LIST_COLLECTIONS = `#graphql
  query OosSorterCollections($after: String) {
    collections(first: 250, after: $after, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes { ${COLLECTION_FIELDS} }
    }
  }`;

const GET_COLLECTION = `#graphql
  query OosSorterCollection($id: ID!) {
    collection(id: $id) { ${COLLECTION_FIELDS} }
  }`;

const COLLECTION_PRODUCTS = `#graphql
  query OosSorterCollectionProducts($id: ID!, $after: String, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean!) {
    collection(id: $id) {
      products(first: 250, after: $after, sortKey: $sortKey, reverse: $reverse) {
        pageInfo { hasNextPage endCursor }
        nodes { id title }
      }
    }
  }`;

const PRODUCTS_STOCK = `#graphql
  query OosSorterProductsStock($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on Product {
        id
        tags
        variantsCount { count }
        variants(first: 25) { nodes { availableForSale } }
      }
    }
  }`;

const PRODUCT_VARIANTS = `#graphql
  query OosSorterProductVariants($id: ID!, $after: String) {
    product(id: $id) {
      variants(first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { availableForSale }
      }
    }
  }`;

const PRODUCT_COLLECTIONS = `#graphql
  query OosSorterProductCollections($id: ID!, $after: String) {
    product(id: $id) {
      collections(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { id title handle }
      }
    }
  }`;

const INVENTORY_ITEMS = `#graphql
  query OosSorterInventoryItems($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on InventoryItem {
        id
        variants(first: 5) { nodes { product { id } } }
      }
    }
  }`;

const SET_MANUAL_SORT = `#graphql
  mutation OosSorterSetManualSort($input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection { id sortOrder }
      userErrors { field message }
    }
  }`;

const REORDER = `#graphql
  mutation OosSorterReorder($id: ID!, $moves: [MoveInput!]!) {
    collectionReorderProducts(id: $id, moves: $moves) {
      job { id done }
      userErrors { field message }
    }
  }`;

const JOB = `#graphql
  query OosSorterJob($id: ID!) {
    job(id: $id) { id done }
  }`;

const BULK_RUN = `#graphql
  mutation OosSorterBulkStock($query: String!) {
    bulkOperationRunQuery(query: $query, groupObjects: false) {
      bulkOperation { id status }
      userErrors { field message code }
    }
  }`;

const BULK_STATUS = `#graphql
  query OosSorterBulkStatus($id: ID!) {
    bulkOperation(id: $id) { id status errorCode objectCount url partialDataUrl }
  }`;

export const BULK_STOCK_QUERY = `{
  products {
    edges {
      node {
        id
        tags
        variants { edges { node { id availableForSale } } }
      }
    }
  }
}`;

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface RawCollection {
  id: string;
  title: string;
  handle: string;
  sortOrder: CollectionSortOrder;
  productsCount?: { count: number } | null;
}

const toMeta = (raw: RawCollection): CollectionMeta => ({
  id: raw.id,
  title: raw.title,
  handle: raw.handle,
  sortOrder: raw.sortOrder,
  productsCount: raw.productsCount?.count ?? 0,
});

export interface GatewayOptions {
  wait?: (ms: number) => Promise<unknown>;
  /** Fetches the bulk operation result file. */
  download?: (url: string) => Promise<string>;
  jobPollMs?: number;
  jobTimeoutMs?: number;
  bulkPollMs?: number;
  bulkTimeoutMs?: number;
}

export function createShopifyGateway(query: GraphqlTransport, options: GatewayOptions = {}): ShopifyGateway {
  const wait = options.wait ?? sleep;
  const download =
    options.download ??
    (async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Bulk result download failed: HTTP ${response.status}`);
      return response.text();
    });
  const jobPollMs = options.jobPollMs ?? 1000;
  const jobTimeoutMs = options.jobTimeoutMs ?? 5 * 60_000;
  const bulkPollMs = options.bulkPollMs ?? 3000;
  const bulkTimeoutMs = options.bulkTimeoutMs ?? 20 * 60_000;

  async function waitForJob(jobId: string) {
    const deadline = Date.now() + jobTimeoutMs;
    for (;;) {
      const data = await query<{ job: { done: boolean } | null }>(JOB, { id: jobId });
      if (!data.job || data.job.done) return;
      if (Date.now() > deadline) throw new Error(`Reorder job ${jobId} did not finish in time`);
      await wait(jobPollMs);
    }
  }

  async function anyVariantAvailable(productId: string): Promise<boolean> {
    let after: string | null = null;
    for (;;) {
      const data: {
        product: { variants: { pageInfo: PageInfo; nodes: { availableForSale: boolean }[] } } | null;
      } = await query(PRODUCT_VARIANTS, { id: productId, after });
      const variants = data.product?.variants;
      if (!variants) return false;
      if (variants.nodes.some((variant) => variant.availableForSale)) return true;
      if (!variants.pageInfo.hasNextPage) return false;
      after = variants.pageInfo.endCursor;
    }
  }

  return {
    async listCollections() {
      const collections: CollectionMeta[] = [];
      let after: string | null = null;
      for (;;) {
        const data: { collections: { pageInfo: PageInfo; nodes: RawCollection[] } } = await query(
          LIST_COLLECTIONS,
          { after },
        );
        collections.push(...data.collections.nodes.map(toMeta));
        if (!data.collections.pageInfo.hasNextPage) return collections;
        after = data.collections.pageInfo.endCursor;
      }
    },

    async getCollection(collectionId) {
      const data = await query<{ collection: RawCollection | null }>(GET_COLLECTION, { id: collectionId });
      return data.collection ? toMeta(data.collection) : null;
    },

    async getCollectionProducts(collectionId, spec) {
      const products: ProductRef[] = [];
      let after: string | null = null;
      for (;;) {
        const data: {
          collection: { products: { pageInfo: PageInfo; nodes: ProductRef[] } } | null;
        } = await query(COLLECTION_PRODUCTS, {
          id: collectionId,
          after,
          sortKey: spec.sortKey,
          reverse: spec.reverse,
        });
        if (!data.collection) return products;
        products.push(...data.collection.products.nodes);
        if (!data.collection.products.pageInfo.hasNextPage) return products;
        after = data.collection.products.pageInfo.endCursor;
      }
    },

    async getProductsStock(productIds) {
      const stock = new Map<string, StockInfo>();
      for (const ids of chunk([...new Set(productIds)], 30)) {
        const data = await query<{
          nodes: ({
            __typename: string;
            id?: string;
            tags?: string[];
            variantsCount?: { count: number } | null;
            variants?: { nodes: { availableForSale: boolean }[] };
          } | null)[];
        }>(PRODUCTS_STOCK, { ids });
        for (const node of data.nodes) {
          if (!node || node.__typename !== "Product" || !node.id) continue;
          const variants = node.variants?.nodes ?? [];
          let available = variants.some((variant) => variant.availableForSale);
          if (!available && (node.variantsCount?.count ?? 0) > variants.length) {
            available = await anyVariantAvailable(node.id);
          }
          stock.set(node.id, { available, tags: serializeTags(node.tags ?? []) });
        }
      }
      return stock;
    },

    async getProductCollections(productId) {
      const collections: { id: string; title: string; handle: string }[] = [];
      let after: string | null = null;
      for (;;) {
        const data: {
          product: {
            collections: { pageInfo: PageInfo; nodes: { id: string; title: string; handle: string }[] };
          } | null;
        } = await query(PRODUCT_COLLECTIONS, { id: productId, after });
        if (!data.product) return collections;
        collections.push(...data.product.collections.nodes);
        if (!data.product.collections.pageInfo.hasNextPage) return collections;
        after = data.product.collections.pageInfo.endCursor;
      }
    },

    async resolveInventoryItems(inventoryItemIds) {
      const products = new Map<string, string>();
      for (const ids of chunk([...new Set(inventoryItemIds)], 50)) {
        const data = await query<{
          nodes: ({ id?: string; variants?: { nodes: { product: { id: string } | null }[] } } | null)[];
        }>(INVENTORY_ITEMS, { ids });
        for (const node of data.nodes) {
          const productId = node?.variants?.nodes.find((variant) => variant.product)?.product?.id;
          if (node?.id && productId) products.set(node.id, productId);
        }
      }
      return products;
    },

    async setManualSort(collectionId) {
      const data = await query<{
        collectionUpdate: { userErrors: { field?: string[] | null; message: string }[] } | null;
      }>(SET_MANUAL_SORT, { input: { id: collectionId, sortOrder: "MANUAL" } });
      assertNoUserErrors("collectionUpdate", data.collectionUpdate?.userErrors);
    },

    async reorderProducts(collectionId, moves) {
      // Moves are relative to the list after the previous moves, so batches must run in order
      // and each job must finish before the next batch starts.
      for (const batch of chunk(moves, 250)) {
        const data = await query<{
          collectionReorderProducts: {
            job: { id: string; done: boolean } | null;
            userErrors: { field?: string[] | null; message: string }[];
          } | null;
        }>(REORDER, {
          id: collectionId,
          moves: batch.map((move) => ({ id: move.id, newPosition: String(move.newPosition) })),
        });
        const payload = data.collectionReorderProducts;
        assertNoUserErrors("collectionReorderProducts", payload?.userErrors);
        if (payload?.job && !payload.job.done) await waitForJob(payload.job.id);
      }
    },

    async fetchAllProductsStock() {
      const started = await query<{
        bulkOperationRunQuery: {
          bulkOperation: { id: string } | null;
          userErrors: { field?: string[] | null; message: string }[];
        } | null;
      }>(BULK_RUN, { query: BULK_STOCK_QUERY });
      assertNoUserErrors("bulkOperationRunQuery", started.bulkOperationRunQuery?.userErrors);
      const operationId = started.bulkOperationRunQuery?.bulkOperation?.id;
      if (!operationId) throw new Error("bulkOperationRunQuery returned no operation");

      const deadline = Date.now() + bulkTimeoutMs;
      for (;;) {
        const { bulkOperation } = await query<{
          bulkOperation: { status: string; errorCode: string | null; url: string | null } | null;
        }>(BULK_STATUS, { id: operationId });
        if (!bulkOperation) throw new Error(`Bulk operation ${operationId} not found`);
        if (bulkOperation.status === "COMPLETED") {
          return bulkOperation.url ? parseBulkStock(await download(bulkOperation.url)) : new Map();
        }
        if (!["CREATED", "RUNNING"].includes(bulkOperation.status)) {
          throw new Error(
            `Bulk stock export ${bulkOperation.status.toLowerCase()}${bulkOperation.errorCode ? ` (${bulkOperation.errorCode})` : ""}`,
          );
        }
        if (Date.now() > deadline) throw new Error("Bulk stock export did not finish in time");
        await wait(bulkPollMs);
      }
    },
  };
}

/** Parses the JSONL produced by BULK_STOCK_QUERY. Variant lines carry __parentId. */
export function parseBulkStock(jsonl: string): Map<string, StockInfo> {
  const stock = new Map<string, StockInfo>();
  const variantLines: { parent: string; available: boolean }[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as {
      id?: string;
      tags?: string[];
      availableForSale?: boolean;
      __parentId?: string;
    };
    if (row.__parentId) {
      variantLines.push({ parent: row.__parentId, available: Boolean(row.availableForSale) });
    } else if (row.id) {
      stock.set(row.id, { available: false, tags: serializeTags(row.tags ?? []) });
    }
  }
  for (const variant of variantLines) {
    const product = stock.get(variant.parent);
    if (product && variant.available) product.available = true;
  }
  return stock;
}
