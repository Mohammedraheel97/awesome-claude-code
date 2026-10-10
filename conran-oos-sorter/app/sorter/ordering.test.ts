import { describe, expect, it } from "vitest";
import {
  applyMoves,
  chunk,
  computeMoves,
  computeTargetOrder,
  hasTag,
  serializeTags,
  sortSpecFor,
  decodeMemory,
  EMPTY_MEMORY,
  encodeMemory,
  type ManualMemory,
} from "./ordering";

const outOf = (...ids: string[]) => {
  const set = new Set(ids);
  return (id: string) => !set.has(id);
};

/** Deterministic pseudo-random generator so failures are reproducible. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function shuffle<T>(items: T[], next: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

describe("applyMoves", () => {
  it("matches the example in Shopify's collectionReorderProducts docs", () => {
    const moves = [
      { id: "E", newPosition: 1 },
      { id: "C", newPosition: 4 },
    ];
    expect(applyMoves(["A", "B", "C", "D", "E"], moves)).toEqual(["A", "E", "B", "D", "C"]);
  });

  it("puts products at the end when the position is past the end", () => {
    expect(applyMoves(["A", "B", "C"], [{ id: "A", newPosition: 99 }])).toEqual(["B", "C", "A"]);
  });
});

describe("computeMoves", () => {
  it("returns no moves when the order is already right", () => {
    expect(computeMoves(["A", "B", "C"], ["A", "B", "C"])).toEqual([]);
  });

  it("moves a single out-of-stock product with one move", () => {
    const current = Array.from({ length: 2000 }, (_, index) => `P${index}`);
    const target = [...current.slice(1), current[0]];
    const moves = computeMoves(current, target);
    expect(moves).toEqual([{ id: "P0", newPosition: 1999 }]);
    expect(applyMoves(current, moves)).toEqual(target);
  });

  it("produces correct and minimal moves for random reorderings", () => {
    const next = random(42);
    for (let run = 0; run < 300; run += 1) {
      const size = 1 + Math.floor(next() * 60);
      const current = Array.from({ length: size }, (_, index) => `P${index}`);
      const target = shuffle(current, next);
      const moves = computeMoves(current, target);
      expect(applyMoves(current, moves)).toEqual(target);
      expect(moves.length).toBe(size - longestIncreasingLength(current, target));
    }
  });

  it("rejects lists that do not contain the same products", () => {
    expect(() => computeMoves(["A", "B"], ["A", "C"])).toThrow();
    expect(() => computeMoves(["A", "B"], ["A"])).toThrow();
  });
});

describe("computeTargetOrder", () => {
  it("pushes unavailable products to the bottom and keeps both groups in order", () => {
    const { target, unavailable } = computeTargetOrder({
      current: ["A", "X", "B", "Y", "C"],
      isAvailable: outOf("X", "Y"),
    });
    expect(target).toEqual(["A", "B", "C", "X", "Y"]);
    expect(unavailable).toEqual(["X", "Y"]);
  });

  it("follows the base order for automatically sorted collections", () => {
    const { target } = computeTargetOrder({
      current: ["A", "B", "C", "D"],
      base: ["D", "C", "B", "A"],
      isAvailable: outOf("C"),
    });
    expect(target).toEqual(["D", "B", "A", "C"]);
  });

  it("ignores base entries no longer in the collection and keeps unknown ones", () => {
    const { target } = computeTargetOrder({
      current: ["A", "B", "NEW"],
      base: ["GONE", "B", "A"],
      isAvailable: () => true,
    });
    expect(target).toEqual(["B", "A", "NEW"]);
  });

  describe("remembered order in manual collections", () => {
    /** Runs the sorter the way the worker does: apply the target, keep the returned memory. */
    function simulate(start: string[]) {
      let order = [...start];
      let memory: ManualMemory = EMPTY_MEMORY;
      return {
        get order() {
          return order;
        },
        run(outOfStock: string[]) {
          const result = computeTargetOrder({ current: order, isAvailable: outOf(...outOfStock), memory });
          order = applyMoves(order, computeMoves(order, result.target));
          memory = result.memory!;
          return result;
        },
        /** The merchandiser drags products around in the Shopify admin (or Shopify adds some). */
        setOrder(next: string[]) {
          order = next;
        },
      };
    }

    it("pushes out-of-stock products down and returns them to their exact place", () => {
      const shop = simulate(["A", "X", "B", "C", "Y", "D"]);
      shop.run(["X", "Y"]);
      expect(shop.order).toEqual(["A", "B", "C", "D", "X", "Y"]);

      const result = shop.run([]);
      expect(shop.order).toEqual(["A", "X", "B", "C", "Y", "D"]);
      expect(result.restored).toEqual(["X", "Y"]);
    });

    it("handles products selling out and restocking over several rounds", () => {
      const merchandised = ["P1", "P2", "P3", "P4", "P5", "P6"];
      const shop = simulate(merchandised);
      shop.run(["P2", "P3"]);
      shop.run(["P2", "P3", "P4", "P6"]);
      shop.run(["P4", "P1"]);
      shop.run(["P1"]);
      expect(shop.order).toEqual(["P2", "P3", "P4", "P5", "P6", "P1"]);

      shop.run([]);
      expect(shop.order).toEqual(merchandised);
    });

    it("always gets back to the merchandised order after random stock changes", () => {
      const next = random(7);
      for (let scenario = 0; scenario < 500; scenario += 1) {
        const size = 3 + Math.floor(next() * 15);
        const merchandised = Array.from({ length: size }, (_, index) => `P${index}`);
        const shop = simulate(merchandised);
        const out = new Set<string>();
        const rounds = 1 + Math.floor(next() * 8);
        for (let round = 0; round < rounds; round += 1) {
          for (let flip = Math.floor(next() * 4); flip >= 0; flip -= 1) {
            const product = merchandised[Math.floor(next() * size)];
            if (!out.delete(product)) out.add(product);
          }
          shop.run([...out]);
          const firstOut = shop.order.findIndex((id) => out.has(id));
          expect(firstOut === -1 || shop.order.slice(firstOut).every((id) => out.has(id))).toBe(true);
        }
        shop.run([]);
        expect(shop.order).toEqual(merchandised);
      }
    });

    it("respects products the merchandiser moves in the admin", () => {
      const shop = simulate(["A", "B", "X", "C"]);
      shop.run(["X"]);
      shop.setOrder(["C", "A", "B", "X"]);
      shop.run([]);
      expect(shop.order).toEqual(["C", "A", "B", "X"]);
    });

    it("remembers a new spot when an out-of-stock product is dragged up", () => {
      const shop = simulate(["A", "X", "B", "C"]);
      shop.run(["X"]);
      shop.setOrder(["X", "A", "B", "C"]);
      shop.run(["X"]);
      expect(shop.order).toEqual(["A", "B", "C", "X"]);
      shop.run([]);
      expect(shop.order).toEqual(["X", "A", "B", "C"]);
    });

    it("keeps products Shopify adds at the end with the in-stock products", () => {
      const shop = simulate(["A", "X", "B"]);
      shop.run(["X"]);
      shop.setOrder([...shop.order, "NEW"]);
      shop.run(["X"]);
      expect(shop.order).toEqual(["A", "B", "NEW", "X"]);
      shop.run([]);
      expect(shop.order).toEqual(["A", "X", "B", "NEW"]);
    });

    it("copes with products removed from the collection", () => {
      const shop = simulate(["A", "B", "X", "C"]);
      shop.run(["X"]);
      shop.setOrder(["A", "C", "X"]);
      shop.run([]);
      expect(shop.order).toEqual(["A", "X", "C"]);
    });

    it("starts from the current order the first time", () => {
      // Y was already at the bottom before the app was installed, so that's its place.
      const shop = simulate(["A", "B", "Y"]);
      shop.run(["Y"]);
      shop.run([]);
      expect(shop.order).toEqual(["A", "B", "Y"]);
    });

    it("never loses products when the memory is inconsistent", () => {
      const result = computeTargetOrder({
        current: ["A", "X"],
        isAvailable: () => true,
        memory: { order: ["A"], hidden: ["X"] },
      });
      expect(result.target).toEqual(["A", "X"]);
    });
  });
});

describe("memory encoding", () => {
  it("stores numeric ids and reads them back", () => {
    const memory = { order: ["gid://shopify/Product/1", "gid://shopify/Product/2"], hidden: ["gid://shopify/Product/2"] };
    expect(encodeMemory(memory)).toBe('{"order":["1","2"],"hidden":["2"]}');
    expect(decodeMemory(encodeMemory(memory))).toEqual(memory);
  });

  it("ignores missing or broken memory", () => {
    expect(encodeMemory(null)).toBeNull();
    expect(decodeMemory(null)).toBeNull();
    expect(decodeMemory("not json")).toBeNull();
    expect(decodeMemory('{"order":1}')).toBeNull();
  });
});

describe("sortSpecFor", () => {
  it("maps collection sort orders to product sort keys", () => {
    expect(sortSpecFor("MANUAL")).toEqual({ sortKey: "MANUAL", reverse: false });
    expect(sortSpecFor("CREATED_DESC")).toEqual({ sortKey: "CREATED", reverse: true });
    expect(sortSpecFor("PRICE_DESC")).toEqual({ sortKey: "PRICE", reverse: true });
    expect(sortSpecFor("ALPHA_ASC")).toEqual({ sortKey: "TITLE", reverse: false });
  });
});

describe("helpers", () => {
  it("chunks lists", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("matches tags case-insensitively", () => {
    const tags = serializeTags(["Sofas", " OOS-Keep-Position "]);
    expect(hasTag(tags, "oos-keep-position")).toBe(true);
    expect(hasTag(tags, "sofa")).toBe(false);
    expect(hasTag(tags, "")).toBe(false);
  });
});

function longestIncreasingLength(current: string[], target: string[]): number {
  const position = new Map(target.map((id, index) => [id, index]));
  const sequence = current.map((id) => position.get(id)!);
  const tails: number[] = [];
  for (const value of sequence) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < value) low = middle + 1;
      else high = middle;
    }
    tails[low] = value;
  }
  return tails.length;
}
