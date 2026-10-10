// An in-memory stand-in for the Admin GraphQL API, implementing only the operations the
// gateway sends, with Shopify's semantics (pagination, manual ordering, async reorder jobs).

import { applyMoves, type CollectionSortOrder, type ProductSortKey } from "../ordering";
import type { GraphqlTransport } from "../shopify-gateway.server";

export interface FakeProduct {
  id: string;
  title: string;
  tags: string[];
  /** availableForSale per variant */
  variants: boolean[];
  createdAt: number;
  price: number;
  sales: number;
}

export interface FakeCollection {
  id: string;
  title: string;
  handle: string;
  sortOrder: CollectionSortOrder;
  /** Product ids in manual order. */
  manual: string[];
}

type Vars = Record<string, unknown>;

export const productGid = (n: number | string) => `gid://shopify/Product/${n}`;
export const collectionGid = (n: number | string) => `gid://shopify/Collection/${n}`;
export const inventoryItemGid = (productNumber: number | string, variant = 0) =>
  `gid://shopify/InventoryItem/${productNumber}${String(variant).padStart(3, "0")}`;

export class FakeShopify {
  products = new Map<string, FakeProduct>();
  collections = new Map<string, FakeCollection>();
  /** Operation names in call order. */
  calls: string[] = [];
  pageSize = 250;
  private jobs = new Map<string, { collectionId: string; pollsLeft: number }>();
  private jobCounter = 0;
  private bulkJsonl = "";

  addProduct(product: Partial<FakeProduct> & { id: string }): FakeProduct {
    const full: FakeProduct = {
      title: product.id,
      tags: [],
      variants: [true],
      createdAt: this.products.size,
      price: 10,
      sales: 0,
      ...product,
    };
    this.products.set(full.id, full);
    return full;
  }

  addCollection(collection: Partial<FakeCollection> & { id: string; manual: string[] }): FakeCollection {
    const full: FakeCollection = {
      title: collection.id,
      handle: collection.id.split("/").pop()!,
      sortOrder: "MANUAL",
      ...collection,
    };
    this.collections.set(full.id, full);
    return full;
  }

  setAvailable(productId: string, available: boolean) {
    const product = this.products.get(productId)!;
    product.variants = product.variants.map(() => available);
  }

  count(operation: string) {
    return this.calls.filter((call) => call === operation).length;
  }

  mutationCount() {
    return this.calls.filter((call) =>
      ["OosSorterSetSortOrder", "OosSorterReorder"].includes(call),
    ).length;
  }

  download = async () => this.bulkJsonl;

  transport: GraphqlTransport = async <T>(query: string, variables: Vars = {}): Promise<T> => {
    const name = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1];
    if (!name) throw new Error(`Unnamed operation: ${query}`);
    this.calls.push(name);
    return this.handle(name, variables) as T;
  };

  private handle(name: string, v: Vars): unknown {
    switch (name) {
      case "OosSorterCollections": {
        const all = [...this.collections.values()].sort((a, b) => a.id.localeCompare(b.id));
        const { nodes, pageInfo } = this.page(all, v.after as string | null);
        return { collections: { nodes: nodes.map((c) => this.collectionNode(c)), pageInfo } };
      }
      case "OosSorterCollection": {
        const collection = this.collections.get(v.id as string);
        return { collection: collection ? this.collectionNode(collection) : null };
      }
      case "OosSorterCollectionProducts": {
        const collection = this.collections.get(v.id as string);
        if (!collection) return { collection: null };
        const ordered = this.orderProducts(collection, v.sortKey as ProductSortKey, v.reverse as boolean);
        const { nodes, pageInfo } = this.page(ordered, v.after as string | null);
        return { collection: { products: { nodes: nodes.map((p) => ({ id: p.id, title: p.title })), pageInfo } } };
      }
      case "OosSorterProductsStock": {
        return {
          nodes: (v.ids as string[]).map((id) => {
            const product = this.products.get(id);
            if (!product) return null;
            return {
              __typename: "Product",
              id,
              tags: product.tags,
              variantsCount: { count: product.variants.length },
              variants: { nodes: product.variants.slice(0, 25).map((availableForSale) => ({ availableForSale })) },
            };
          }),
        };
      }
      case "OosSorterProductVariants": {
        const product = this.products.get(v.id as string);
        if (!product) return { product: null };
        const { nodes, pageInfo } = this.page(product.variants, v.after as string | null);
        return { product: { variants: { nodes: nodes.map((availableForSale) => ({ availableForSale })), pageInfo } } };
      }
      case "OosSorterProductCollections": {
        const product = this.products.get(v.id as string);
        if (!product) return { product: null };
        const containing = [...this.collections.values()].filter((c) => c.manual.includes(product.id));
        const { nodes, pageInfo } = this.page(containing, v.after as string | null);
        return {
          product: {
            collections: { nodes: nodes.map(({ id, title, handle }) => ({ id, title, handle })), pageInfo },
          },
        };
      }
      case "OosSorterInventoryItems": {
        return {
          nodes: (v.ids as string[]).map((id) => {
            const match = /InventoryItem\/(\d+)(\d{3})$/.exec(id);
            const product = match ? this.products.get(productGid(match[1])) : undefined;
            return product ? { id, variants: { nodes: [{ product: { id: product.id } }] } } : null;
          }),
        };
      }
      case "OosSorterSetSortOrder": {
        const input = v.input as { id: string; sortOrder: CollectionSortOrder };
        const collection = this.collections.get(input.id);
        if (!collection) return { collectionUpdate: { collection: null, userErrors: [{ field: ["id"], message: "Collection does not exist" }] } };
        collection.sortOrder = input.sortOrder;
        return { collectionUpdate: { collection: { id: collection.id, sortOrder: collection.sortOrder }, userErrors: [] } };
      }
      case "OosSorterReorder": {
        const collection = this.collections.get(v.id as string)!;
        const moves = v.moves as { id: string; newPosition: string }[];
        if (collection.sortOrder !== "MANUAL") {
          return { collectionReorderProducts: { job: null, userErrors: [{ field: ["id"], message: "Can't reorder products unless collection is manually sorted" }] } };
        }
        if (moves.length > 250) {
          return { collectionReorderProducts: { job: null, userErrors: [{ field: ["moves"], message: "Too many moves" }] } };
        }
        if ([...this.jobs.values()].some((job) => job.collectionId === collection.id && job.pollsLeft > 0)) {
          throw new Error("Reorder started while a previous reorder job was still running");
        }
        collection.manual = applyMoves(
          collection.manual,
          moves.map((move) => ({ id: move.id, newPosition: Number(move.newPosition) })),
        );
        const jobId = `gid://shopify/Job/${++this.jobCounter}`;
        this.jobs.set(jobId, { collectionId: collection.id, pollsLeft: 2 });
        return { collectionReorderProducts: { job: { id: jobId, done: false }, userErrors: [] } };
      }
      case "OosSorterJob": {
        const job = this.jobs.get(v.id as string);
        if (!job) return { job: null };
        job.pollsLeft = Math.max(0, job.pollsLeft - 1);
        return { job: { id: v.id, done: job.pollsLeft === 0 } };
      }
      case "OosSorterBulkStock": {
        const lines: string[] = [];
        for (const product of this.products.values()) {
          lines.push(JSON.stringify({ id: product.id, tags: product.tags }));
          product.variants.forEach((availableForSale, index) =>
            lines.push(
              JSON.stringify({
                id: `gid://shopify/ProductVariant/${product.id.split("/").pop()}${index}`,
                availableForSale,
                __parentId: product.id,
              }),
            ),
          );
        }
        this.bulkJsonl = lines.join("\n") + "\n";
        return { bulkOperationRunQuery: { bulkOperation: { id: "gid://shopify/BulkOperation/1", status: "CREATED" }, userErrors: [] } };
      }
      case "OosSorterBulkStatus":
        return { bulkOperation: { id: v.id, status: "COMPLETED", errorCode: null, objectCount: "0", url: "https://example.test/bulk.jsonl", partialDataUrl: null } };
      default:
        throw new Error(`FakeShopify: unsupported operation ${name}`);
    }
  }

  private collectionNode(collection: FakeCollection) {
    return {
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      sortOrder: collection.sortOrder,
      productsCount: { count: collection.manual.length },
    };
  }

  private orderProducts(collection: FakeCollection, sortKey: ProductSortKey, reverse: boolean) {
    const products = collection.manual.map((id) => this.products.get(id)!);
    const compare: Record<ProductSortKey, ((a: FakeProduct, b: FakeProduct) => number) | null> = {
      MANUAL: null,
      BEST_SELLING: (a, b) => b.sales - a.sales,
      CREATED: (a, b) => a.createdAt - b.createdAt,
      PRICE: (a, b) => a.price - b.price,
      TITLE: (a, b) => a.title.localeCompare(b.title),
    };
    const comparator = compare[sortKey];
    const ordered = comparator ? [...products].sort(comparator) : products;
    return reverse ? [...ordered].reverse() : ordered;
  }

  private page<T>(items: T[], after: string | null) {
    const start = after ? Number(after) : 0;
    const nodes = items.slice(start, start + this.pageSize);
    const end = start + nodes.length;
    return { nodes, pageInfo: { hasNextPage: end < items.length, endCursor: String(end) } };
  }
}
