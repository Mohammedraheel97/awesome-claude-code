// Pure ordering logic: no Shopify or database access, so it is fully unit-tested.

export const COLLECTION_SORT_ORDERS = [
  "MANUAL",
  "BEST_SELLING",
  "CREATED_DESC",
  "CREATED",
  "PRICE_DESC",
  "PRICE_ASC",
  "ALPHA_ASC",
  "ALPHA_DESC",
] as const;

export type CollectionSortOrder = (typeof COLLECTION_SORT_ORDERS)[number];

export const SORT_ORDER_LABELS: Record<CollectionSortOrder, string> = {
  MANUAL: "Manual (keep merchandised order)",
  BEST_SELLING: "Best selling",
  CREATED_DESC: "Newest first",
  CREATED: "Oldest first",
  PRICE_DESC: "Price, high to low",
  PRICE_ASC: "Price, low to high",
  ALPHA_ASC: "Title, A–Z",
  ALPHA_DESC: "Title, Z–A",
};

export function isCollectionSortOrder(value: unknown): value is CollectionSortOrder {
  return (
    typeof value === "string" &&
    (COLLECTION_SORT_ORDERS as readonly string[]).includes(value)
  );
}

/** Values of the Admin API `ProductCollectionSortKeys` enum that we use. */
export type ProductSortKey = "MANUAL" | "BEST_SELLING" | "CREATED" | "PRICE" | "TITLE";

export interface ProductSortSpec {
  sortKey: ProductSortKey;
  reverse: boolean;
}

/** How to read a collection's products in the order a given collection sort order shows them. */
export function sortSpecFor(order: CollectionSortOrder): ProductSortSpec {
  switch (order) {
    case "MANUAL":
      return { sortKey: "MANUAL", reverse: false };
    case "BEST_SELLING":
      return { sortKey: "BEST_SELLING", reverse: false };
    case "CREATED":
      return { sortKey: "CREATED", reverse: false };
    case "CREATED_DESC":
      return { sortKey: "CREATED", reverse: true };
    case "PRICE_ASC":
      return { sortKey: "PRICE", reverse: false };
    case "PRICE_DESC":
      return { sortKey: "PRICE", reverse: true };
    case "ALPHA_ASC":
      return { sortKey: "TITLE", reverse: false };
    case "ALPHA_DESC":
      return { sortKey: "TITLE", reverse: true };
  }
}

/**
 * What the app remembers about a manually sorted collection between runs, so restocked
 * products can go back exactly where the merchandiser had them.
 */
export interface ManualMemory {
  /** The merchandised order, including the products currently pushed down. */
  order: string[];
  /** Products the app has put in the out-of-stock block. */
  hidden: string[];
}

export const EMPTY_MEMORY: ManualMemory = { order: [], hidden: [] };

const PRODUCT_GID = "gid://shopify/Product/";

/** Stored as numeric ids to keep large collections small. */
export function encodeMemory(memory: ManualMemory | null): string | null {
  if (!memory) return null;
  const short = (id: string) => (id.startsWith(PRODUCT_GID) ? id.slice(PRODUCT_GID.length) : id);
  return JSON.stringify({ order: memory.order.map(short), hidden: memory.hidden.map(short) });
}

export function decodeMemory(json: string | null | undefined): ManualMemory | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as { order?: unknown; hidden?: unknown };
    if (!Array.isArray(raw.order) || !Array.isArray(raw.hidden)) return null;
    const full = (id: unknown) => (String(id).startsWith("gid://") ? String(id) : PRODUCT_GID + String(id));
    return { order: raw.order.map(full), hidden: raw.hidden.map(full) };
  } catch {
    return null;
  }
}

export interface TargetOrderInput {
  /** Every product in the collection, in its current (manual) order. */
  current: readonly string[];
  /**
   * The order to follow before pushing unavailable products down, for collections whose
   * base sort is automatic (best selling, newest…). Omit for manually sorted collections.
   */
  base?: readonly string[];
  /** True when the product should stay among the in-stock products (in stock or pinned). */
  isAvailable: (productId: string) => boolean;
  /**
   * Manually sorted collections only: the memory from the last applied run (EMPTY_MEMORY the
   * first time). When given, restocked products go back to their merchandised position and
   * the updated memory is returned. Without it, restocked products join the end of the
   * in-stock products.
   */
  memory?: ManualMemory;
}

export interface TargetOrderResult {
  target: string[];
  unavailable: string[];
  /** Restocked products put back at their merchandised position. */
  restored: string[];
  /** Memory to store once `target` has been applied (only when memory was given). */
  memory?: ManualMemory;
}

/**
 * Builds the desired order: available products first, unavailable products last.
 * Both groups keep their relative order (the base order when one is given, otherwise the
 * merchandised order), so merchandising is preserved apart from the out-of-stock push-down.
 */
export function computeTargetOrder({ current, base, isAvailable, memory }: TargetOrderInput): TargetOrderResult {
  if (!memory) {
    const ordered = base ? mergeBaseOrder(base, current) : unique(current);
    const unavailable = ordered.filter((id) => !isAvailable(id));
    return { target: [...ordered.filter(isAvailable), ...unavailable], unavailable, restored: [] };
  }

  const { order, floating } = merchandisedOrder(unique(current), memory, isAvailable);
  const unavailable = order.filter((id) => !isAvailable(id));
  return {
    target: [...order.filter(isAvailable), ...unavailable],
    unavailable,
    restored: order.filter((id) => floating.has(id) && isAvailable(id)),
    memory: { order, hidden: unavailable },
  };
}

/**
 * The merchandised order of a manual collection: the current order, except that products
 * sitting in the out-of-stock block because of the app are put back at their remembered place
 * (right after whatever preceded them in the remembered order).
 *
 * Everything else keeps its current position, so moves the merchandiser makes in the Shopify
 * admin are respected, including dragging a pushed-down product back up among in-stock ones.
 */
function merchandisedOrder(
  current: string[],
  memory: ManualMemory,
  isAvailable: (productId: string) => boolean,
): { order: string[]; floating: Set<string> } {
  const known = new Set(memory.order);
  const hidden = new Set(memory.hidden);

  // Hidden products below the last known in-stock product are still where the app put them.
  // (Products new to the collection don't count: Shopify adds them at the end.)
  let lastVisible = -1;
  current.forEach((id, index) => {
    if (known.has(id) && !hidden.has(id) && isAvailable(id)) lastVisible = index;
  });
  const floating = new Set(current.filter((id, index) => hidden.has(id) && index > lastVisible));
  const order = current.filter((id) => !floating.has(id));

  const inCollection = new Set(current);
  const unplaced = new Set(floating);
  let previous: string | null = null;
  for (const id of memory.order) {
    if (!inCollection.has(id)) continue;
    if (unplaced.delete(id)) {
      order.splice(previous === null ? 0 : order.indexOf(previous) + 1, 0, id);
    }
    previous = id;
  }
  // Only possible with inconsistent memory; keep these products rather than lose them.
  order.push(...unplaced);
  return { order, floating };
}

/** Base order restricted to products still in the collection, plus any it doesn't know yet. */
function mergeBaseOrder(base: readonly string[], current: readonly string[]): string[] {
  const currentSet = new Set(current);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...base, ...current]) {
    if (currentSet.has(id) && !seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export interface Move {
  id: string;
  newPosition: number;
}

/**
 * The fewest `collectionReorderProducts` moves that turn `current` into `target`.
 *
 * Products on a longest increasing subsequence of target positions stay put; every other
 * product is moved, in target order, to just after its target predecessor. Moves use
 * Shopify's semantics: applied one after another, `newPosition` is the index once the product
 * has been taken out of the list.
 */
export function computeMoves(current: readonly string[], target: readonly string[]): Move[] {
  const targetIndex = new Map(target.map((id, index) => [id, index]));
  if (targetIndex.size !== target.length || current.length !== target.length) {
    throw new Error("computeMoves: current and target must contain the same unique products");
  }
  const positions = current.map((id) => {
    const index = targetIndex.get(id);
    if (index === undefined) {
      throw new Error(`computeMoves: ${id} is missing from the target order`);
    }
    return index;
  });

  const staying = new Set(longestIncreasingSubsequence(positions));
  const working = [...current];
  const moves: Move[] = [];

  target.forEach((id, index) => {
    if (staying.has(index)) return;
    working.splice(working.indexOf(id), 1);
    const newPosition = index === 0 ? 0 : working.indexOf(target[index - 1]) + 1;
    working.splice(newPosition, 0, id);
    moves.push({ id, newPosition });
  });

  if (working.some((id, index) => id !== target[index])) {
    throw new Error("computeMoves: simulated moves did not produce the target order");
  }
  return moves;
}

/** Applies moves exactly the way Shopify does. Used to verify plans. */
export function applyMoves(order: readonly string[], moves: readonly Move[]): string[] {
  const result = [...order];
  for (const { id, newPosition } of moves) {
    const from = result.indexOf(id);
    if (from === -1) throw new Error(`applyMoves: ${id} is not in the list`);
    result.splice(from, 1);
    result.splice(Math.min(newPosition, result.length), 0, id);
  }
  return result;
}

/** Values (not indexes) of one longest strictly increasing subsequence. O(n log n). */
function longestIncreasingSubsequence(values: readonly number[]): number[] {
  const tailIndexes: number[] = [];
  const previous = new Array<number>(values.length).fill(-1);

  values.forEach((value, index) => {
    let low = 0;
    let high = tailIndexes.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[tailIndexes[middle]] < value) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[index] = tailIndexes[low - 1];
    tailIndexes[low] = index;
  });

  const result: number[] = [];
  let cursor = tailIndexes.length ? tailIndexes[tailIndexes.length - 1] : -1;
  while (cursor !== -1) {
    result.push(values[cursor]);
    cursor = previous[cursor];
  }
  return result.reverse();
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Tags are stored lower-cased, one per line. */
export function serializeTags(tags: readonly string[]): string {
  return tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).join("\n");
}

export function hasTag(serializedTags: string, tag: string | null | undefined): boolean {
  const wanted = tag?.trim().toLowerCase();
  if (!wanted) return false;
  return serializedTags.split("\n").includes(wanted);
}
