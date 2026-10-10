import { describe, expect, it } from "vitest";
import { sortCollection, type SortCollectionInput } from "./collection-sorter.server";
import type { ManualMemory } from "./ordering";
import { adminTransport, createShopifyGateway, throttleDelay } from "./shopify-gateway.server";
import { collectionGid, FakeShopify, inventoryItemGid, productGid } from "./testing/fake-shopify";

const noWait = async () => {};

function setup(pageSize = 250) {
  const shopify = new FakeShopify();
  shopify.pageSize = pageSize;
  const gateway = createShopifyGateway(shopify.transport, {
    wait: noWait,
    download: shopify.download,
  });
  const run = (overrides: Partial<SortCollectionInput> & { collectionId: string }) =>
    sortCollection({
      gateway,
      storedBaseSort: null,
      memory: null,
      restoreManualPositions: true,
      pinTag: "oos-keep-position",
      getStock: (ids) => gateway.getProductsStock(ids),
      live: true,
      ...overrides,
    });
  return { shopify, gateway, run };
}

/** Adds products P1..Pn; the listed numbers are out of stock. */
function addProducts(shopify: FakeShopify, count: number, outOfStock: number[] = []) {
  const ids: string[] = [];
  for (let n = 1; n <= count; n += 1) {
    const product = shopify.addProduct({
      id: productGid(n),
      title: `Product ${String(n).padStart(4, "0")}`,
      variants: [!outOfStock.includes(n)],
      sales: count - n,
      createdAt: n,
      price: n,
    });
    ids.push(product.id);
  }
  return ids;
}

const label = (ids: string[]) => ids.map((id) => `P${id.split("/").pop()}`);

describe("sortCollection", () => {
  it("pushes out-of-stock products to the bottom of a manual collection", async () => {
    const { shopify, run } = setup(3);
    const ids = addProducts(shopify, 6, [1, 4]);
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });

    const result = await run({ collectionId: collection.id });

    expect(label(collection.manual)).toEqual(["P2", "P3", "P5", "P6", "P1", "P4"]);
    expect(result.status === "done" && result.moves.length).toBe(2);
    expect(result.status === "done" && label(result.outOfStock)).toEqual(["P1", "P4"]);
  });

  it("changes nothing in preview mode", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 5, [1]);
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });

    const result = await run({ collectionId: collection.id, live: false });

    expect(collection.manual).toEqual(ids);
    expect(shopify.mutationCount()).toBe(0);
    expect(result.status === "done" && result.moves).toEqual([{ id: ids[0], newPosition: 4 }]);
  });

  it("does nothing when the order is already right", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 5, [5]);
    shopify.addCollection({ id: collectionGid(1), manual: ids });

    await run({ collectionId: collectionGid(1) });

    expect(shopify.mutationCount()).toBe(0);
  });

  it("splits large reorders into batches of 250 and waits for each job", async () => {
    const { shopify, run } = setup();
    const outOfStock = Array.from({ length: 600 }, (_, i) => i * 2 + 1); // every other product
    const ids = addProducts(shopify, 1200, outOfStock);
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });

    const result = await run({ collectionId: collection.id });

    const expected = [...ids.filter((_, i) => i % 2 === 1), ...ids.filter((_, i) => i % 2 === 0)];
    expect(collection.manual).toEqual(expected);
    expect(result.status === "done" && result.moves.length).toBe(600);
    expect(shopify.count("OosSorterReorder")).toBe(3);
    expect(shopify.count("OosSorterJob")).toBeGreaterThanOrEqual(3);
  });

  it("adopts an automatic sort order, switches to manual and keeps that order", async () => {
    const { shopify, run } = setup(4);
    const ids = addProducts(shopify, 8, [2, 7]);
    // Manual positions are scrambled; best selling order is P1, P2, ... P8.
    const collection = shopify.addCollection({
      id: collectionGid(1),
      sortOrder: "BEST_SELLING",
      manual: [...ids].reverse(),
    });

    const result = await run({ collectionId: collection.id });

    expect(collection.sortOrder).toBe("MANUAL");
    expect(label(collection.manual)).toEqual(["P1", "P3", "P4", "P5", "P6", "P8", "P2", "P7"]);
    expect(result.status === "done" && result.baseSort).toBe("BEST_SELLING");
    expect(result.status === "done" && result.switchedToManual).toBe(true);
  });

  it("keeps re-applying a stored automatic base sort after the switch", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 5);
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });
    // P5 became the best seller since the last run and P1 sold out.
    shopify.products.get(ids[4])!.sales = 1000;
    shopify.setAvailable(ids[0], false);

    await run({ collectionId: collection.id, storedBaseSort: "BEST_SELLING" });

    expect(label(collection.manual)).toEqual(["P5", "P2", "P3", "P4", "P1"]);
  });

  it("previews an automatic collection without switching it", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 4, [1]);
    const collection = shopify.addCollection({ id: collectionGid(1), sortOrder: "CREATED_DESC", manual: ids });

    const result = await run({ collectionId: collection.id, live: false });

    expect(collection.sortOrder).toBe("CREATED_DESC");
    expect(shopify.mutationCount()).toBe(0);
    expect(result.status === "done" && label(result.target)).toEqual(["P4", "P3", "P2", "P1"]);
  });

  it("never moves products tagged with the pin tag", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 4, [1, 2]);
    shopify.products.get(ids[0])!.tags = ["OOS-Keep-Position"];
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });

    await run({ collectionId: collection.id });

    expect(label(collection.manual)).toEqual(["P1", "P3", "P4", "P2"]);
  });

  it("treats a product as in stock when any variant, even past the 25th, can be sold", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 3);
    shopify.products.get(ids[0])!.variants = [...Array(30).fill(false), true];
    shopify.setAvailable(ids[1], false);
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });

    await run({ collectionId: collection.id });

    expect(label(collection.manual)).toEqual(["P1", "P3", "P2"]);
  });

  it("puts restocked products back where the merchandiser had them", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 6, [2, 4]);
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });
    let memory: ManualMemory | null = null;
    const saveMemory = async (next: ManualMemory | null) => {
      memory = next;
    };

    await run({ collectionId: collection.id, memory, saveMemory });
    expect(label(collection.manual)).toEqual(["P1", "P3", "P5", "P6", "P2", "P4"]);

    shopify.setAvailable(ids[1], true);
    shopify.setAvailable(ids[3], true);
    const second = await run({ collectionId: collection.id, memory, saveMemory });

    expect(collection.manual).toEqual(ids);
    expect(second.status === "done" && label(second.restored)).toEqual(["P2", "P4"]);
  });

  it("saves the memory before moving products", async () => {
    const { shopify, run } = setup();
    const ids = addProducts(shopify, 3, [1]);
    const collection = shopify.addCollection({ id: collectionGid(1), manual: ids });
    const callsWhenSaved: string[][] = [];

    await run({
      collectionId: collection.id,
      saveMemory: async () => {
        callsWhenSaved.push([...shopify.calls]);
      },
    });

    expect(callsWhenSaved).toHaveLength(1);
    expect(callsWhenSaved[0]).not.toContain("OosSorterReorder");
    expect(shopify.calls).toContain("OosSorterReorder");
  });

  it("reports collections that no longer exist", async () => {
    const { run } = setup();
    expect(await run({ collectionId: collectionGid(404) })).toEqual({ status: "missing" });
  });
});

describe("Shopify gateway", () => {
  it("lists collections across pages", async () => {
    const { shopify, gateway } = setup(2);
    for (let n = 1; n <= 5; n += 1) shopify.addCollection({ id: collectionGid(n), manual: [] });
    const collections = await gateway.listCollections();
    expect(collections.map((c) => c.id)).toEqual([1, 2, 3, 4, 5].map(collectionGid));
  });

  it("finds the collections a product belongs to", async () => {
    const { shopify, gateway } = setup(1);
    const [p1, p2] = addProducts(shopify, 2);
    shopify.addCollection({ id: collectionGid(1), manual: [p1, p2] });
    shopify.addCollection({ id: collectionGid(2), manual: [p2] });
    shopify.addCollection({ id: collectionGid(3), manual: [p1] });
    const collections = await gateway.getProductCollections(p1);
    expect(collections.map((c) => c.id)).toEqual([collectionGid(1), collectionGid(3)]);
  });

  it("maps inventory items to products", async () => {
    const { shopify, gateway } = setup();
    addProducts(shopify, 3);
    const map = await gateway.resolveInventoryItems([inventoryItemGid(2, 1), inventoryItemGid(99)]);
    expect([...map]).toEqual([[inventoryItemGid(2, 1), productGid(2)]]);
  });

  it("reads stock for the whole catalog with a bulk operation", async () => {
    const { shopify, gateway } = setup();
    addProducts(shopify, 3, [2]);
    shopify.products.get(productGid(3))!.variants = [false, true];
    shopify.products.get(productGid(1))!.tags = ["Sofas"];
    const stock = await gateway.fetchAllProductsStock();
    expect(stock.get(productGid(1))).toEqual({ available: true, tags: "sofas" });
    expect(stock.get(productGid(2))?.available).toBe(false);
    expect(stock.get(productGid(3))?.available).toBe(true);
  });
});

describe("adminTransport", () => {
  const throttled = () =>
    Object.assign(new Error("Throttled"), {
      body: {
        errors: { graphQLErrors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] },
        extensions: {
          cost: {
            requestedQueryCost: 500,
            throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 100, restoreRate: 100 },
          },
        },
      },
    });

  it("waits and retries when Shopify throttles the query", async () => {
    let calls = 0;
    const waits: number[] = [];
    const transport = adminTransport(
      async () => {
        calls += 1;
        if (calls === 1) throw throttled();
        return new Response(JSON.stringify({ data: { ok: true } }));
      },
      { wait: async (ms) => waits.push(ms) },
    );
    await expect(transport("query { shop { id } }")).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(waits).toEqual([4250]);
  });

  it("does not retry other errors", async () => {
    const transport = adminTransport(async () => {
      throw new Error("boom");
    });
    await expect(transport("query { shop { id } }")).rejects.toThrow("boom");
    expect(throttleDelay(new Error("boom"))).toBeNull();
  });

  it("slows down when the cost bucket is nearly empty", async () => {
    const waits: number[] = [];
    const transport = adminTransport(
      async () =>
        new Response(
          JSON.stringify({
            data: {},
            extensions: { cost: { throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 200, restoreRate: 100 } } },
          }),
        ),
      { wait: async (ms) => waits.push(ms) },
    );
    await transport("query { shop { id } }");
    expect(waits).toEqual([2000]);
  });
});
