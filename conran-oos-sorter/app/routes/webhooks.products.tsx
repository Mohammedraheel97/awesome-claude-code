import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { queueCheck } from "../sorter/store.server";

// products/create and products/update (variants added or removed, inventory policy or tags changed).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, payload } = await authenticate.webhook(request);
  const productId = (payload as { id?: number | string }).id;

  if (session && productId) {
    await queueCheck(shop, `product:gid://shopify/Product/${productId}`);
  }
  return new Response();
};
