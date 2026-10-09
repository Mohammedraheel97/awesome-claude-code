function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}

export const siteConfig = {
  url: siteUrl(),
  currency: 'KWD',
  /** Free-delivery threshold carried over from the theme's shipping-bar setting (free_shipping_threshold). */
  freeShippingThreshold: 10,
  contactEmail: process.env.CONTACT_EMAIL ?? '',
  contactPhone: process.env.CONTACT_PHONE ?? '',
  /** Number of products per page on collection and search listings. */
  pageSize: 12,
} as const;

export function isShopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN);
}
