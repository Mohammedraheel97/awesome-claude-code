// Database access for the sorter.

import type { CollectionState, ShopSettings } from "@prisma/client";
import db from "../db.server";
import { chunk } from "./ordering";
import type { ShopifyGateway, StockInfo } from "./shopify-gateway.server";

export const PRIORITY_SWEEP = 0;
export const PRIORITY_STOCK_CHANGE = 1;
export const PRIORITY_REQUESTED = 2;

export function getSettings(shop: string): Promise<ShopSettings> {
  return db.shopSettings.upsert({ where: { shop }, create: { shop }, update: {} });
}

export function updateSettings(
  shop: string,
  data: Partial<Omit<ShopSettings, "shop" | "createdAt" | "updatedAt">>,
): Promise<ShopSettings> {
  return db.shopSettings.upsert({ where: { shop }, create: { shop, ...data }, update: data });
}

/** Forces a full re-check of every collection on the next worker run. */
export function requestFullSweep(shop: string) {
  return updateSettings(shop, { lastFullSweepAt: null });
}

export function isFullSweepDue(settings: ShopSettings, now = Date.now()): boolean {
  if (!settings.lastFullSweepAt) return true;
  return now - settings.lastFullSweepAt.getTime() >= settings.fullSweepIntervalHours * 3_600_000;
}

// --- Stock cache ---

export async function getCachedStock(shop: string, productIds: string[]): Promise<Map<string, StockInfo>> {
  const stock = new Map<string, StockInfo>();
  for (const ids of chunk(productIds, 500)) {
    const rows = await db.productStock.findMany({ where: { shop, productId: { in: ids } } });
    rows.forEach((row) => stock.set(row.productId, { available: row.available, tags: row.tags }));
  }
  return stock;
}

/** Cached stock, fetching (and caching) any products the cache doesn't know yet. */
export async function getStock(
  shop: string,
  gateway: ShopifyGateway,
  productIds: string[],
): Promise<Map<string, StockInfo>> {
  const stock = await getCachedStock(shop, productIds);
  const missing = productIds.filter((id) => !stock.has(id));
  if (missing.length > 0) {
    const fetched = await gateway.getProductsStock(missing);
    await saveStock(shop, fetched);
    fetched.forEach((info, id) => stock.set(id, info));
  }
  return stock;
}

export async function saveStock(shop: string, stock: Map<string, StockInfo>) {
  const checkedAt = new Date();
  for (const entries of chunk([...stock], 200)) {
    await db.$transaction(
      entries.map(([productId, info]) =>
        db.productStock.upsert({
          where: { shop_productId: { shop, productId } },
          create: { shop, productId, available: info.available, tags: info.tags, checkedAt },
          update: { available: info.available, tags: info.tags, checkedAt },
        }),
      ),
    );
  }
}

export async function replaceStock(shop: string, stock: Map<string, StockInfo>) {
  const checkedAt = new Date();
  const rows = [...stock].map(([productId, info]) => ({
    shop,
    productId,
    available: info.available,
    tags: info.tags,
    checkedAt,
  }));
  await db.$transaction([
    db.productStock.deleteMany({ where: { shop } }),
    ...chunk(rows, 500).map((data) => db.productStock.createMany({ data })),
  ]);
}

// --- Work queues ---

/** Queues a stock re-check. Repeated webhooks for the same product collapse into one row. */
export function queueCheck(shop: string, key: `product:${string}` | `inventory:${string}`) {
  return db.pendingCheck.upsert({
    where: { shop_key: { shop, key } },
    create: { shop, key },
    update: { createdAt: new Date() },
  });
}

export async function markCollectionsDirty(
  shop: string,
  collections: { id: string; title: string; handle: string }[],
  priority: number,
) {
  const unique = [...new Map(collections.map((c) => [c.id, c])).values()];
  for (const batch of chunk(unique, 200)) {
    const ids = batch.map((c) => c.id);
    const known = new Set(
      (
        await db.collectionState.findMany({
          where: { shop, collectionId: { in: ids } },
          select: { collectionId: true },
        })
      ).map((row) => row.collectionId),
    );
    const fresh = batch.filter((c) => !known.has(c.id));
    if (fresh.length > 0) {
      // upsert, not createMany: a webhook may create the same row at the same moment.
      await db.$transaction(
        fresh.map((c) =>
          db.collectionState.upsert({
            where: { shop_collectionId: { shop, collectionId: c.id } },
            create: { shop, collectionId: c.id, title: c.title, handle: c.handle, priority },
            update: {},
          }),
        ),
      );
    }
    const where = { shop, collectionId: { in: ids } };
    await db.$transaction([
      db.collectionState.updateMany({ where: { ...where, dirty: false }, data: { dirty: true, dirtySince: new Date() } }),
      db.collectionState.updateMany({ where: { ...where, priority: { lt: priority } }, data: { priority } }),
      // Lets the worker notice a collection was re-queued while it was being sorted.
      db.collectionState.updateMany({ where, data: { dirtyVersion: { increment: 1 } } }),
    ]);
  }
}

export function nextDirtyCollection(shop: string, skip: string[]): Promise<CollectionState | null> {
  return db.collectionState.findFirst({
    where: { shop, dirty: true, collectionId: { notIn: skip } },
    orderBy: [{ priority: "desc" }, { dirtySince: "asc" }],
  });
}

/** Clears the dirty flag unless the collection was queued again since `state` was read. */
export function clearDirty(state: CollectionState) {
  return db.collectionState.updateMany({
    where: { shop: state.shop, collectionId: state.collectionId, dirtyVersion: state.dirtyVersion },
    data: { dirty: false, priority: PRIORITY_SWEEP },
  });
}

// --- Activity log ---

export function logActivity(
  shop: string,
  entry: { kind: "sorted" | "preview" | "sweep" | "error" | "info"; message: string; collectionId?: string; title?: string; moves?: number },
) {
  return db.activityLog.create({ data: { shop, ...entry } });
}

export async function pruneActivity(shop: string, keep = 1000) {
  const cutoff = await db.activityLog.findFirst({
    where: { shop },
    orderBy: { id: "desc" },
    skip: keep,
    select: { id: true },
  });
  if (cutoff) await db.activityLog.deleteMany({ where: { shop, id: { lte: cutoff.id } } });
}

// --- Locking ---

export async function acquireLock(name: string, owner: string, ttlMs: number): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlMs);
  try {
    await db.workerLock.create({ data: { name, owner, expiresAt } });
    return true;
  } catch {
    const { count } = await db.workerLock.updateMany({
      where: { name, expiresAt: { lt: new Date() } },
      data: { owner, expiresAt },
    });
    return count === 1;
  }
}

export async function releaseLock(name: string, owner: string) {
  await db.workerLock.deleteMany({ where: { name, owner } });
}

export async function deleteShopData(shop: string) {
  await db.$transaction([
    db.shopSettings.deleteMany({ where: { shop } }),
    db.collectionState.deleteMany({ where: { shop } }),
    db.productStock.deleteMany({ where: { shop } }),
    db.pendingCheck.deleteMany({ where: { shop } }),
    db.activityLog.deleteMany({ where: { shop } }),
  ]);
}
