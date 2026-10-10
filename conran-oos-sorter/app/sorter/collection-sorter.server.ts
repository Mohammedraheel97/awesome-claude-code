// Sorts one collection. Talks to Shopify only through the gateway and takes everything it
// needs from the database as arguments, so it can be tested end to end with a fake gateway.

import {
  computeMoves,
  computeTargetOrder,
  hasTag,
  EMPTY_MEMORY,
  sortSpecFor,
  type CollectionSortOrder,
  type ManualMemory,
  type Move,
} from "./ordering";
import type { CollectionMeta, ProductRef, ShopifyGateway, StockInfo } from "./shopify-gateway.server";

export interface SortCollectionInput {
  gateway: ShopifyGateway;
  collectionId: string;
  /** Remembered base sort; null when the collection hasn't been seen before. */
  storedBaseSort: CollectionSortOrder | null;
  /** What was remembered about the collection's merchandised order after the last applied run. */
  memory: ManualMemory | null;
  restoreManualPositions: boolean;
  pinTag: string | null;
  /** Stock lookup; normally served from the cache and filled from Shopify on a miss. */
  getStock: (productIds: string[]) => Promise<Map<string, StockInfo>>;
  /** false = preview: work out the moves but change nothing in Shopify. */
  live: boolean;
  /**
   * Live runs only: called with the new memory before products are moved, so an interrupted
   * reorder still leaves the merchandised order on record.
   */
  saveMemory?: (memory: ManualMemory | null) => Promise<void>;
}

export type SortCollectionResult =
  | { status: "missing" }
  | {
      status: "done";
      collection: CollectionMeta;
      baseSort: CollectionSortOrder;
      /** The collection used another sort order; it was (or, in preview, would be) set to manual. */
      switchedToManual: boolean;
      current: ProductRef[];
      target: string[];
      moves: Move[];
      /** Products that are out of stock and not pinned. */
      outOfStock: string[];
      /** Products that are out of stock but stay in place because of the pin tag. */
      pinned: string[];
      restored: string[];
      /** Memory to store once applied; null when the base order isn't manual. */
      memory: ManualMemory | null;
      applied: boolean;
    };

export async function sortCollection(input: SortCollectionInput): Promise<SortCollectionResult> {
  const { gateway, collectionId, live } = input;

  const collection = await gateway.getCollection(collectionId);
  if (!collection) return { status: "missing" };

  // Merchandisers keep choosing the sort order in the Shopify admin as usual: when the
  // collection isn't manual, that order becomes its base sort and the collection is switched
  // to manual so out-of-stock products can be moved.
  const adoptedSort = collection.sortOrder !== "MANUAL" ? collection.sortOrder : null;
  const baseSort: CollectionSortOrder = adoptedSort ?? input.storedBaseSort ?? "MANUAL";

  if (adoptedSort && live) await gateway.setManualSort(collectionId);
  // In preview the collection keeps its sort order, so plan against what shoppers see today.
  const currentSort: CollectionSortOrder = adoptedSort && !live ? adoptedSort : "MANUAL";

  const current = await gateway.getCollectionProducts(collectionId, sortSpecFor(currentSort));
  const currentIds = current.map((product) => product.id);
  const baseIds =
    baseSort === currentSort
      ? undefined
      : (await gateway.getCollectionProducts(collectionId, sortSpecFor(baseSort))).map((p) => p.id);

  const stock = await input.getStock(currentIds);
  const isPinned = (id: string) => hasTag(stock.get(id)?.tags ?? "", input.pinTag);
  // Products we know nothing about (e.g. deleted mid-run) are left where they are.
  const isAvailable = (id: string) => {
    const info = stock.get(id);
    return !info || info.available || isPinned(id);
  };

  const remember = baseSort === "MANUAL" && input.restoreManualPositions;
  const { target, restored, unavailable, memory } = computeTargetOrder({
    current: currentIds,
    base: baseIds,
    isAvailable,
    memory: remember ? (input.memory ?? EMPTY_MEMORY) : undefined,
  });
  const moves = computeMoves(currentIds, target);

  if (live) {
    await input.saveMemory?.(memory ?? null);
    if (moves.length > 0) await gateway.reorderProducts(collectionId, moves);
  }

  return {
    status: "done",
    collection,
    baseSort,
    switchedToManual: adoptedSort !== null,
    current,
    target,
    moves,
    outOfStock: unavailable,
    pinned: currentIds.filter((id) => stock.get(id)?.available === false && isPinned(id)),
    restored,
    memory: memory ?? null,
    applied: live,
  };
}
