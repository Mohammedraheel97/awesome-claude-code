import { isShopifyConfigured } from '@/lib/config';
import { sampleProvider } from '@/lib/commerce/sample-provider';
import { shopifyProvider } from '@/lib/commerce/shopify-provider';
import type { CommerceProvider } from '@/lib/commerce/types';

export * from '@/lib/commerce/types';

/**
 * Returns the Shopify Storefront provider when credentials are configured,
 * otherwise the clearly-labelled sample catalog. Server-side only.
 */
export function getCommerce(): CommerceProvider {
  return isShopifyConfigured() ? shopifyProvider : sampleProvider;
}
