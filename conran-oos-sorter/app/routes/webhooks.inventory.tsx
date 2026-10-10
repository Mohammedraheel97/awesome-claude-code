import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { queueCheck } from "../sorter/store.server";

// inventory_levels/update: queue the inventory item; the worker resolves it to its product
// and only re-sorts collections if the product moved between in stock and out of stock.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, payload } = await authenticate.webhook(request);
  const inventoryItemId = (payload as { inventory_item_id?: number | string }).inventory_item_id;

  if (session && inventoryItemId) {
    await queueCheck(shop, `inventory:gid://shopify/InventoryItem/${inventoryItemId}`);
  }
  return new Response();
};
