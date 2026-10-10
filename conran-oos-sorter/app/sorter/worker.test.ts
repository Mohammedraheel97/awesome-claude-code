// End-to-end: real Prisma (SQLite) + the worker + the in-memory fake Shopify.
import { beforeEach, describe, expect, it } from "vitest";
import db from "../db.server";
import { createShopifyGateway } from "./shopify-gateway.server";
import { clearDirty, getSettings, markCollectionsDirty, queueCheck, updateSettings } from "./store.server";
import { collectionGid, FakeShopify, inventoryItemGid, productGid } from "./testing/fake-shopify";
import { runTick } from "./worker.server";

const SHOP = "conran-test.myshopify.com";
const label = (ids: string[]) => ids.map((id) => `P${id.split("/").pop()}`);

let shopify: FakeShopify;

async function tick() {
  const gateway = createShopifyGateway(shopify.transport, { wait: async () => {}, download: shopify.download });
  return runTick({ budgetMs: 30_000, gatewayFor: async () => gateway });
}

async function resetDatabase() {
  await db.$transaction([
    db.session.deleteMany(),
    db.shopSettings.deleteMany(),
    db.collectionState.deleteMany(),
    db.productStock.deleteMany(),
    db.pendingCheck.deleteMany(),
    db.activityLog.deleteMany(),
    db.workerLock.deleteMany(),
  ]);
  await db.session.create({
    data: { id: `offline_${SHOP}`, shop: SHOP, state: "", isOnline: false, accessToken: "test" },
  });
}

beforeEach(async () => {
  await resetDatabase();
  shopify = new FakeShopify();
  for (let n = 1; n <= 6; n += 1) {
    shopify.addProduct({ id: productGid(n), title: `Product ${n}`, sales: 100 - n, variants: [![1, 4].includes(n)] });
  }
  const ids = [1, 2, 3, 4, 5, 6].map(productGid);
  shopify.addCollection({ id: collectionGid(1), title: "Sofas", manual: ids });
  shopify.addCollection({ id: collectionGid(2), title: "Best sellers", sortOrder: "BEST_SELLING", manual: [...ids].reverse() });
  shopify.addCollection({ id: collectionGid(3), title: "Winter Sale", manual: [ids[0], ids[1]] });
});

const manual = (n: number) => label(shopify.collections.get(collectionGid(n))!.manual);

describe("worker", () => {
  it("starts in preview mode and changes nothing", async () => {
    const summary = await tick();

    expect(summary).toMatchObject({ status: "ok", shops: 1, collections: 3 });
    expect(shopify.mutationCount()).toBe(0);
    expect(shopify.count("OosSorterBulkStock")).toBe(1);

    const sofas = await db.collectionState.findUniqueOrThrow({
      where: { shop_collectionId: { shop: SHOP, collectionId: collectionGid(1) } },
    });
    expect(sofas).toMatchObject({ dirty: false, lastRunLive: false, lastMoves: 2, outOfStockCount: 2, baseSort: "MANUAL" });
    const logged = await db.activityLog.findMany({ where: { shop: SHOP } });
    expect(logged.map((entry) => entry.kind).sort()).toEqual(["preview", "preview", "preview", "sweep"]);

    // A second sweep in preview doesn't log the same plans again.
    await updateSettings(SHOP, { lastFullSweepAt: null });
    await tick();
    expect(await db.activityLog.count({ where: { shop: SHOP, kind: "preview" } })).toBe(3);
  });

  it("sorts every collection in live mode and keeps automatic sort orders", async () => {
    await updateSettings(SHOP, { liveMode: true });
    await tick();

    expect(manual(1)).toEqual(["P2", "P3", "P5", "P6", "P1", "P4"]);
    // Best selling: P1 sells most, but P1 and P4 are out of stock.
    expect(manual(2)).toEqual(["P2", "P3", "P5", "P6", "P1", "P4"]);
    expect(shopify.collections.get(collectionGid(2))!.sortOrder).toBe("MANUAL");
    expect(manual(3)).toEqual(["P2", "P1"]);

    const best = await db.collectionState.findUniqueOrThrow({
      where: { shop_collectionId: { shop: SHOP, collectionId: collectionGid(2) } },
    });
    expect(best.baseSort).toBe("BEST_SELLING");

    // Nothing left to do: another full sweep makes no changes.
    const before = shopify.mutationCount();
    await updateSettings(SHOP, { lastFullSweepAt: null });
    await tick();
    expect(shopify.mutationCount()).toBe(before);
  });

  it("reacts to stock webhooks: restocked products go back to their place", async () => {
    await updateSettings(SHOP, { liveMode: true });
    await tick();
    const sofas = await db.collectionState.findUniqueOrThrow({
      where: { shop_collectionId: { shop: SHOP, collectionId: collectionGid(1) } },
    });
    expect(JSON.parse(sofas.manualMemory!)).toEqual({ order: ["1", "2", "3", "4", "5", "6"], hidden: ["1", "4"] });

    // P1 is restocked (inventory webhook), P2 sells out (product webhook).
    shopify.setAvailable(productGid(1), true);
    shopify.setAvailable(productGid(2), false);
    await queueCheck(SHOP, `inventory:${inventoryItemGid(1)}`);
    await queueCheck(SHOP, `product:${productGid(2)}`);
    await tick();

    expect(manual(1)).toEqual(["P1", "P3", "P5", "P6", "P2", "P4"]);
    expect(manual(2)).toEqual(["P1", "P3", "P5", "P6", "P2", "P4"]);
    expect(manual(3)).toEqual(["P1", "P2"]);
    expect(await db.pendingCheck.count()).toBe(0);

    // P2 is back too: it returns right after P1, where the merchandiser had it.
    shopify.setAvailable(productGid(2), true);
    await queueCheck(SHOP, `product:${productGid(2)}`);
    await tick();
    expect(manual(1)).toEqual(["P1", "P2", "P3", "P5", "P6", "P4"]);
  });

  it("ignores webhooks that don't change whether a product is in stock", async () => {
    await updateSettings(SHOP, { liveMode: true });
    await tick();
    const before = shopify.mutationCount();

    await queueCheck(SHOP, `product:${productGid(3)}`);
    await queueCheck(SHOP, `inventory:${inventoryItemGid(5)}`);
    await tick();

    expect(shopify.mutationCount()).toBe(before);
    expect(await db.collectionState.count({ where: { shop: SHOP, dirty: true } })).toBe(0);
  });

  it("leaves excluded collections alone", async () => {
    await getSettings(SHOP);
    await tick();
    await db.collectionState.update({
      where: { shop_collectionId: { shop: SHOP, collectionId: collectionGid(3) } },
      data: { excluded: true },
    });
    await updateSettings(SHOP, { liveMode: true, lastFullSweepAt: null });
    await tick();

    expect(manual(3)).toEqual(["P1", "P2"]);
    expect(manual(1)).toEqual(["P2", "P3", "P5", "P6", "P1", "P4"]);
  });

  it("forgets collections deleted in Shopify", async () => {
    await tick();
    shopify.collections.delete(collectionGid(3));
    await updateSettings(SHOP, { lastFullSweepAt: null });
    await tick();
    expect(await db.collectionState.count({ where: { shop: SHOP } })).toBe(2);
  });

  it("does nothing when the app is turned off", async () => {
    await updateSettings(SHOP, { enabled: false, liveMode: true });
    const summary = await tick();
    expect(summary.shops).toBe(0);
    expect(shopify.calls).toEqual([]);
  });

  it("only lets one worker run at a time", async () => {
    const [first, second] = await Promise.all([tick(), tick()]);
    expect([first.status, second.status].sort()).toEqual(["busy", "ok"]);
  });

  it("keeps a collection queued if it was queued again while being sorted", async () => {
    await tick();
    const where = { shop_collectionId: { shop: SHOP, collectionId: collectionGid(1) } };
    await markCollectionsDirty(SHOP, [{ id: collectionGid(1), title: "Sofas", handle: "1" }], 1);
    const seen = await db.collectionState.findUniqueOrThrow({ where });
    await markCollectionsDirty(SHOP, [{ id: collectionGid(1), title: "Sofas", handle: "1" }], 1);

    await clearDirty(seen);
    expect((await db.collectionState.findUniqueOrThrow({ where })).dirty).toBe(true);
  });
});
