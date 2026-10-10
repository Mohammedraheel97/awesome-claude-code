import db from "../db.server";
import { plural } from "./format";
import { isCollectionSortOrder, SORT_ORDER_LABELS } from "./ordering";
import { markCollectionsDirty, PRIORITY_REQUESTED } from "./store.server";
import { kickTick } from "./worker.server";

/**
 * Form actions shared by the Collections list (one or many selected collections) and the
 * collection page. Collections are passed as numeric ids in `collectionIds` (comma-separated)
 * or `collectionId`.
 */
export async function handleCollectionAction(shop: string, form: FormData) {
  const ids = String(form.get("collectionIds") ?? form.get("collectionId") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `gid://shopify/Collection/${id}`);
  const states = await db.collectionState.findMany({ where: { shop, collectionId: { in: ids } } });
  if (states.length === 0) return { message: "Collection not found. Run a full check first." };

  const where = { shop, collectionId: { in: states.map((state) => state.collectionId) } };
  const name = states.length === 1 ? states[0].title : plural(states.length, "collection");
  const queueNow = async () => {
    await markCollectionsDirty(
      shop,
      states.map((state) => ({ id: state.collectionId, title: state.title, handle: state.handle })),
      PRIORITY_REQUESTED,
    );
    kickTick();
  };

  switch (form.get("intent")) {
    case "exclude":
      await db.collectionState.updateMany({ where, data: { excluded: true } });
      return { message: `${name} excluded. The current order stays as it is.` };
    case "include":
      await db.collectionState.updateMany({ where, data: { excluded: false } });
      await queueNow();
      return { message: `${name} included and queued.` };
    case "sort-now":
      await queueNow();
      return { message: `${name} queued. Sorting starts within a minute.` };
    case "base-sort": {
      const baseSort = form.get("baseSort");
      if (!isCollectionSortOrder(baseSort)) return { message: "Unknown sort order." };
      await db.collectionState.updateMany({ where, data: { baseSort } });
      await queueNow();
      return { message: `${name} will follow "${SORT_ORDER_LABELS[baseSort]}".` };
    }
    case "restore":
      await db.collectionState.updateMany({ where, data: { restoreRequested: true } });
      kickTick();
      return { message: `Restoring ${name}. The app stops managing ${states.length === 1 ? "it" : "them"} afterwards.` };
    default:
      return { message: "Unknown action." };
  }
}
