import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { markCollectionsDirty, PRIORITY_STOCK_CHANGE } from "../sorter/store.server";

interface CollectionPayload {
  id?: number | string;
  title?: string;
  handle?: string;
  sort_order?: string;
}

// collections/create and collections/update. A new collection, or one whose sort order a
// merchandiser changed away from manual, is queued so the new order is adopted and applied.
// Plain updates (including the app's own reorders) only refresh the stored title.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, payload } = await authenticate.webhook(request);
  const { id, title = "", handle = "", sort_order: sortOrder } = payload as CollectionPayload;
  if (!session || !id) return new Response();

  const collectionId = `gid://shopify/Collection/${id}`;
  const known = await db.collectionState.findUnique({
    where: { shop_collectionId: { shop, collectionId } },
  });

  if (!known || (sortOrder && sortOrder !== "manual")) {
    await markCollectionsDirty(shop, [{ id: collectionId, title, handle }], PRIORITY_STOCK_CHANGE);
  }
  if (known && (title || handle)) {
    await db.collectionState.update({
      where: { shop_collectionId: { shop, collectionId } },
      data: { ...(title ? { title } : {}), ...(handle ? { handle } : {}) },
    });
  }
  return new Response();
};
