import db from "../db.server";
import { isCollectionSortOrder, SORT_ORDER_LABELS } from "./ordering";
import { markCollectionsDirty, PRIORITY_REQUESTED } from "./store.server";
import { kickTick } from "./worker.server";

/** Form actions shared by the Collections list and the collection detail page. */
export async function handleCollectionAction(shop: string, form: FormData) {
  const collectionId = `gid://shopify/Collection/${String(form.get("collectionId"))}`;
  const where = { shop_collectionId: { shop, collectionId } };
  const state = await db.collectionState.findUnique({ where });
  if (!state) return { message: "Collection not found. Run a full check first." };
  const queueNow = async () => {
    await markCollectionsDirty(shop, [{ id: collectionId, title: state.title, handle: state.handle }], PRIORITY_REQUESTED);
    kickTick();
  };

  switch (form.get("intent")) {
    case "exclude":
      await db.collectionState.update({ where, data: { excluded: true } });
      return { message: `${state.title} excluded. Its current order stays as it is.` };
    case "include":
      await db.collectionState.update({ where, data: { excluded: false } });
      await queueNow();
      return { message: `${state.title} included and queued.` };
    case "sort-now":
      await queueNow();
      return { message: `${state.title} queued. It will be sorted within a minute.` };
    case "base-sort": {
      const baseSort = form.get("baseSort");
      if (!isCollectionSortOrder(baseSort)) return { message: "Unknown sort order." };
      await db.collectionState.update({ where, data: { baseSort } });
      await queueNow();
      return { message: `${state.title} will follow "${SORT_ORDER_LABELS[baseSort]}".` };
    }
    default:
      return { message: "Unknown action." };
  }
}
