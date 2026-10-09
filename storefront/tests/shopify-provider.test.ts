import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The Shopify provider is exercised against a mocked Storefront API. This checks
 * request shape (in-context language, headers, no secret in the body) and the
 * mapping of responses and user errors. It does not prove the live store accepts
 * these operations; that requires a real Storefront access token.
 */

const RAW_PRODUCT = {
  id: 'gid://shopify/Product/1',
  handle: 'demo',
  title: 'Demo',
  description: 'Desc',
  vendor: 'V',
  tags: ['t'],
  availableForSale: true,
  priceRange: {
    minVariantPrice: { amount: '1.000', currencyCode: 'KWD' },
    maxVariantPrice: { amount: '2.000', currencyCode: 'KWD' },
  },
  compareAtPriceRange: null,
  featuredImage: null,
  images: { nodes: [] },
  options: [{ name: 'Title', values: ['Default Title'] }],
  variants: { nodes: [] },
};

describe('shopify provider', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SHOPIFY_STORE_DOMAIN = 'https://demo-store.myshopify.com/';
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'public-token-for-test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SHOPIFY_STORE_DOMAIN;
    delete process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  });

  it('calls the Storefront endpoint with the public token and in-context language', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { product: RAW_PRODUCT } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { shopifyProvider } = await import('@/lib/commerce/shopify-provider');

    const product = await shopifyProvider.getProduct('demo', 'ar');

    expect(product?.handle).toBe('demo');
    expect(product?.priceRange.max.amount).toBe('2.000');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/demo-store\.myshopify\.com\/api\/2025-07\/graphql\.json$/);
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Shopify-Storefront-Access-Token']).toBe('public-token-for-test');
    const body = JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> };
    expect(body.variables).toMatchObject({ handle: 'demo', language: 'AR', country: 'KW' });
    expect(body.query).toContain('@inContext');
    expect(JSON.stringify(body)).not.toContain('public-token-for-test');
  });

  it('surfaces cart user errors as CommerceError messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: { cartCreate: { cart: null, userErrors: [{ field: null, message: 'Not enough stock' }] } },
          }),
          { status: 200 },
        ),
      ),
    );
    const { shopifyProvider } = await import('@/lib/commerce/shopify-provider');
    const { CommerceError } = await import('@/lib/commerce/types');
    await expect(shopifyProvider.addToCart(null, 'gid://shopify/ProductVariant/1', 1, 'en')).rejects.toBeInstanceOf(
      CommerceError,
    );
  });

  it('reports HTTP failures without leaking response bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('secret body', { status: 401 })));
    const { shopifyProvider } = await import('@/lib/commerce/shopify-provider');
    await expect(shopifyProvider.getProduct('demo', 'en')).rejects.toThrow('401');
  });
});
