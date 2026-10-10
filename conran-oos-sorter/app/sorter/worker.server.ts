// The background worker: turns webhooks and schedules into collection re-sorts.
//
// One "tick" (every minute by default) does, per installed shop:
//   1. undo requests (restore one collection, or all of them and turn the app off);
//   2. a full sweep when one is due: refresh the stock of every product and queue every collection;
//   3. stock re-checks queued by webhooks, queueing the collections of products whose
//      in-stock / out-of-stock state actually changed;
//   4. queued collections, highest priority first, until the time budget runs out.
// While the app is paused, steps 2 and 4 wait; while it is off, only step 1 runs.
// Work is stored in the database, so it carries over between ticks and restarts.

import { randomUUID } from "node:crypto";
import type { CollectionState, ShopSettings } from "@prisma/client";
import db from "../db.server";
import { restoreCollection, sortCollection } from "./collection-sorter.server";
import { decodeMemory, encodeMemory, hasTag, isCollectionSortOrder, SORT_ORDER_LABELS } from "./ordering";
import { adminTransport, createShopifyGateway, type AdminGraphql, type ShopifyGateway } from "./shopify-gateway.server";
import {
  acquireLock,
  addDailyMoves,
  clearDirty,
  getCachedStock,
  getSettings,
  getStock,
  isFullSweepDue,
  isPaused,
  logActivity,
  markCollectionsDirty,
  nextDirtyCollection,
  PRIORITY_STOCK_CHANGE,
  PRIORITY_SWEEP,
  pruneActivity,
  releaseLock,
  replaceStock,
  saveStock,
  snapshotStock,
  updateSettings,
} from "./store.server";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function gatewayForShop(shop: string): Promise<ShopifyGateway> {
  // Imported lazily so this module can be used without the Shopify app config (e.g. in tests).
  const { unauthenticated } = await import("../shopify.server");
  const { admin } = await unauthenticated.admin(shop);
  return createShopifyGateway(adminTransport(admin.graphql as unknown as AdminGraphql));
}

/** Sorts one queued collection and records the outcome. */
export async function processCollection(
  shop: string,
  gateway: ShopifyGateway,
  settings: ShopSettings,
  state: CollectionState,
) {
  // updateMany: the row may have been removed meanwhile (collection deleted, app uninstalled).
  const where = { shop, collectionId: state.collectionId };

  if (state.excluded) {
    await clearDirty(state);
    return;
  }

  let result;
  try {
    result = await sortCollection({
      gateway,
      collectionId: state.collectionId,
      storedBaseSort: isCollectionSortOrder(state.baseSort) ? state.baseSort : null,
      memory: decodeMemory(state.manualMemory),
      restoreManualPositions: settings.restoreManualPositions,
      pinTag: settings.pinTag,
      getStock: (ids) => getStock(shop, gateway, ids),
      live: settings.liveMode,
      saveMemory: async (memory) => {
        await db.collectionState.updateMany({ where, data: { manualMemory: encodeMemory(memory) } });
      },
    });
  } catch (error) {
    const message = errorMessage(error);
    await db.collectionState.updateMany({ where, data: { lastError: message, lastSortedAt: new Date() } });
    await clearDirty(state);
    await logActivity(shop, { kind: "error", collectionId: state.collectionId, title: state.title, message });
    return;
  }

  if (result.status === "missing") {
    await db.collectionState.deleteMany({ where });
    return;
  }

  const { collection, moves, applied } = result;
  const inCollection = result.current.map((product) => product.id);

  await db.collectionState.updateMany({
    where,
    data: {
      title: collection.title,
      handle: collection.handle,
      baseSort: result.baseSort,
      productCount: inCollection.length,
      outOfStockCount: result.outOfStock.length,
      lastMoves: moves.length,
      lastRunLive: applied,
      lastSortedAt: new Date(),
      lastError: null,
    },
  });
  await clearDirty(state);
  if (applied && moves.length > 0) await addDailyMoves(shop, moves.length);

  const details = [
    `${result.outOfStock.length} of ${inCollection.length} products out of stock`,
    result.restored.length ? `${result.restored.length} restocked returned to their place` : null,
    result.switchedToManual
      ? `${applied ? "switched" : "would switch"} to manual sort, keeping "${SORT_ORDER_LABELS[result.baseSort]}" as the base order`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (applied && (moves.length > 0 || result.switchedToManual)) {
    await logActivity(shop, {
      kind: "sorted",
      collectionId: collection.id,
      title: collection.title,
      moves: moves.length,
      message: `Moved ${moves.length} product${moves.length === 1 ? "" : "s"} · ${details}`,
    });
  } else if (!applied && moves.length > 0 && (state.lastMoves !== moves.length || state.lastRunLive !== false)) {
    // In preview, only log when the plan changes so repeated sweeps don't flood the log.
    await logActivity(shop, {
      kind: "preview",
      collectionId: collection.id,
      title: collection.title,
      moves: moves.length,
      message: `Would move ${moves.length} product${moves.length === 1 ? "" : "s"} · ${details}`,
    });
  }
}

/** Refreshes the stock of every product and queues every collection. */
export async function runFullSweep(shop: string, gateway: ShopifyGateway, settings: ShopSettings) {
  await updateSettings(shop, { lastFullSweepAt: new Date() });

  let stockNote = "";
  try {
    const stock = await gateway.fetchAllProductsStock();
    await replaceStock(shop, stock);
    const outOfStock = [...stock.values()].filter((info) => !info.available).length;
    stockNote = ` Stock refreshed for ${stock.size} products (${outOfStock} out of stock).`;
  } catch (error) {
    stockNote = ` Stock refresh failed, using cached stock: ${errorMessage(error)}`;
  }

  let collections;
  try {
    collections = await gateway.listCollections();
  } catch (error) {
    // Try again in 15 minutes rather than waiting for the next scheduled check.
    const retryAt = Date.now() - settings.fullSweepIntervalHours * 3_600_000 + 15 * 60_000;
    await updateSettings(shop, { lastFullSweepAt: new Date(retryAt) });
    throw error;
  }
  await db.collectionState.deleteMany({ where: { shop, collectionId: { notIn: collections.map((c) => c.id) } } });
  await markCollectionsDirty(shop, collections, PRIORITY_SWEEP);

  await logActivity(shop, {
    kind: "sweep",
    message: `Full check started: ${collections.length} collections queued.${stockNote}`,
  });
  await pruneActivity(shop);
}

/** Re-checks stock for products flagged by webhooks; queues collections whose products changed state. */
export async function processPendingChecks(shop: string, gateway: ShopifyGateway, settings: ShopSettings, deadline: number) {
  let processed = 0;
  while (Date.now() < deadline) {
    const rows = await db.pendingCheck.findMany({ where: { shop }, orderBy: { createdAt: "asc" }, take: 250 });
    if (rows.length === 0) break;

    const productIds = new Set<string>();
    const inventoryItemIds: string[] = [];
    for (const { key } of rows) {
      if (key.startsWith("product:")) productIds.add(key.slice("product:".length));
      else if (key.startsWith("inventory:")) inventoryItemIds.push(key.slice("inventory:".length));
    }
    if (inventoryItemIds.length > 0) {
      (await gateway.resolveInventoryItems(inventoryItemIds)).forEach((productId) => productIds.add(productId));
    }

    const ids = [...productIds];
    const [before, after] = await Promise.all([getCachedStock(shop, ids), gateway.getProductsStock(ids)]);
    const changed = ids.filter((id) => {
      const was = before.get(id);
      const now = after.get(id);
      if (!now) return false;
      return !was || was.available !== now.available || hasTag(was.tags, settings.pinTag) !== hasTag(now.tags, settings.pinTag);
    });
    await saveStock(shop, after);
    const deleted = ids.filter((id) => !after.has(id));
    if (deleted.length > 0) await db.productStock.deleteMany({ where: { shop, productId: { in: deleted } } });

    const collections = [];
    for (const productId of changed) collections.push(...(await gateway.getProductCollections(productId)));
    await markCollectionsDirty(shop, collections, PRIORITY_STOCK_CHANGE);

    // Rows re-queued while we worked have a newer createdAt and are kept for the next round.
    await db.pendingCheck.deleteMany({
      where: { shop, OR: rows.map(({ key, createdAt }) => ({ key, createdAt })) },
    });
    processed += rows.length;
  }
  return processed;
}

export interface TickSummary {
  status: "ok" | "busy";
  shops: number;
  checks: number;
  collections: number;
}

let runningInProcess = false;

export async function runTick({
  budgetMs = 4 * 60_000,
  gatewayFor = gatewayForShop,
}: {
  budgetMs?: number;
  gatewayFor?: (shop: string) => Promise<ShopifyGateway>;
} = {}): Promise<TickSummary> {
  const summary: TickSummary = { status: "busy", shops: 0, checks: 0, collections: 0 };
  if (runningInProcess) return summary;
  runningInProcess = true;
  const owner = randomUUID();
  try {
    // The lock outlives the budget because the last collection can run past the deadline.
    if (!(await acquireLock("worker", owner, budgetMs + 15 * 60_000))) return summary;
    summary.status = "ok";
    const deadline = Date.now() + budgetMs;
    try {
      const sessions = await db.session.findMany({
        where: { isOnline: false },
        select: { shop: true },
        distinct: ["shop"],
      });
      for (const { shop } of sessions) {
        if (Date.now() > deadline) break;
        const settings = await getSettings(shop);
        const undoPending =
          settings.restoreAllStatus !== null ||
          (await db.collectionState.count({ where: { shop, restoreRequested: true } })) > 0;
        if (!settings.enabled && !undoPending) continue;
        summary.shops += 1;
        try {
          const gateway = await gatewayFor(shop);
          await runShopTick(shop, gateway, deadline, summary);
        } catch (error) {
          console.error(`[oos-sorter] ${shop}:`, error);
          await logActivity(shop, { kind: "error", message: errorMessage(error) }).catch(() => {});
        }
      }
    } finally {
      await releaseLock("worker", owner);
    }
    return summary;
  } finally {
    runningInProcess = false;
  }
}

async function runShopTick(shop: string, gateway: ShopifyGateway, deadline: number, summary: TickSummary) {
  await updateSettings(shop, { lastTickAt: new Date() });
  summary.collections += await processRestores(shop, gateway, deadline);

  let settings = await getSettings(shop);
  if (!settings.enabled || settings.restoreAllStatus !== null) return;
  const paused = isPaused(settings);
  if (!paused && isFullSweepDue(settings)) {
    await runFullSweep(shop, gateway, settings);
    settings = await getSettings(shop);
  }
  // Stock changes are still recorded while paused, so nothing is missed on resume.
  summary.checks += await processPendingChecks(shop, gateway, settings, deadline);
  if (paused) {
    await snapshotStock(shop);
    return;
  }

  const runs = new Map<string, number>();
  while (Date.now() < deadline) {
    // A collection re-queued while it was being sorted runs again, but at most twice a tick.
    const skip = [...runs].filter(([, count]) => count >= 2).map(([id]) => id);
    const state = await nextDirtyCollection(shop, skip);
    if (!state) break;
    runs.set(state.collectionId, (runs.get(state.collectionId) ?? 0) + 1);
    await processCollection(shop, gateway, settings, state);
    summary.collections += 1;
    // Let fresh stock changes jump ahead of a long sweep.
    if (summary.collections % 10 === 0) summary.checks += await processPendingChecks(shop, gateway, settings, deadline);
  }
  await snapshotStock(shop);
}

/** Handles undo requests: single collections, or "restore all and turn off". */
export async function processRestores(shop: string, gateway: ShopifyGateway, deadline: number) {
  let settings = await getSettings(shop);
  if (settings.restoreAllStatus === "requested") {
    await db.collectionState.updateMany({ where: { shop }, data: { restoreRequested: true } });
    settings = await updateSettings(shop, { restoreAllStatus: "running", liveMode: false });
    await logActivity(shop, { kind: "info", message: "Restoring every collection to how it was before the app." });
  }
  const restoringAll = settings.restoreAllStatus === "running";

  let processed = 0;
  while (Date.now() < deadline) {
    const state = await db.collectionState.findFirst({
      where: { shop, restoreRequested: true },
      orderBy: { title: "asc" },
    });
    if (!state) break;
    // A single undo also stops the app managing the collection; "restore all" turns the app off instead.
    await restoreOne(shop, gateway, state, { exclude: !restoringAll });
    processed += 1;
  }

  if (restoringAll && (await db.collectionState.count({ where: { shop, restoreRequested: true } })) === 0) {
    await updateSettings(shop, { restoreAllStatus: null, enabled: false, liveMode: false });
    await logActivity(shop, { kind: "info", message: "All collections restored. The app is now off." });
  }
  return processed;
}

async function restoreOne(shop: string, gateway: ShopifyGateway, state: CollectionState, { exclude }: { exclude: boolean }) {
  const where = { shop, collectionId: state.collectionId };
  try {
    const result = await restoreCollection({
      gateway,
      collectionId: state.collectionId,
      baseSort: isCollectionSortOrder(state.baseSort) ? state.baseSort : null,
      memory: decodeMemory(state.manualMemory),
    });
    if (result.status === "missing") {
      await db.collectionState.deleteMany({ where });
      return;
    }
    await db.collectionState.updateMany({
      where,
      data: {
        restoreRequested: false,
        manualMemory: null,
        dirty: false,
        priority: PRIORITY_SWEEP,
        lastError: null,
        lastMoves: null,
        lastRunLive: null,
        lastSortedAt: null,
        ...(exclude ? { excluded: true } : {}),
      },
    });
    const what = result.sortOrder
      ? `Sort order set back to "${SORT_ORDER_LABELS[result.sortOrder]}"`
      : result.moves > 0
        ? `Moved ${result.moves} product${result.moves === 1 ? "" : "s"} back to their merchandised positions`
        : "Nothing to undo";
    if (exclude || result.sortOrder || result.moves > 0) {
      await logActivity(shop, {
        kind: "restored",
        collectionId: state.collectionId,
        title: result.collection.title,
        moves: result.moves,
        message: exclude ? `${what} · the app no longer manages this collection` : what,
      });
    }
  } catch (error) {
    const message = `Restore failed: ${errorMessage(error)}`;
    await db.collectionState.updateMany({ where, data: { restoreRequested: false, lastError: message } });
    await logActivity(shop, { kind: "error", collectionId: state.collectionId, title: state.title, message });
  }
}

/** Starts a tick in the background (no-op if one is already running). */
export function kickTick() {
  void runTick().catch((error) => console.error("[oos-sorter] tick failed:", error));
}

declare global {
  // eslint-disable-next-line no-var
  var oosSorterTimer: ReturnType<typeof setInterval> | undefined;
}

/** Runs the worker every OOS_SORTER_TICK_SECONDS (default 60) inside the web server process. */
export function startScheduler() {
  if (process.env.OOS_SORTER_SCHEDULER === "off" || global.oosSorterTimer) return;
  const seconds = Math.max(15, Number(process.env.OOS_SORTER_TICK_SECONDS) || 60);
  global.oosSorterTimer = setInterval(kickTick, seconds * 1000);
  setTimeout(kickTick, 5_000);
}

