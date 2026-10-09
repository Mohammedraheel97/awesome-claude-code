import {
  CommerceError,
  type Cart,
  type CartLine,
  type CartResult,
  type Collection,
  type CommerceProvider,
  type Image,
  type ListOptions,
  type ListResult,
  type Money,
  type Product,
  type SortOption,
  type Variant,
} from '@/lib/commerce/types';
import type { Locale } from '@/lib/i18n';

/*
 * Shopify Storefront API (GraphQL) provider.
 *
 * Active only when SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN are set.
 * Only the public Storefront access token is used here; it is read from the
 * environment and never sent to the browser. Checkout is Shopify's hosted
 * checkout (cart.checkoutUrl), so no payment data touches this app.
 */

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? '2025-07';

const PRODUCT_FIELDS = /* GraphQL */ `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    vendor
    tags
    availableForSale
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
    }
    featuredImage { url altText width height }
    images(first: 10) { nodes { url altText width height } }
    options { name values }
  }
`;

const VARIANT_FIELDS = /* GraphQL */ `
  fragment VariantFields on ProductVariant {
    id
    title
    availableForSale
    price { amount currencyCode }
    compareAtPrice { amount currencyCode }
    selectedOptions { name value }
    image { url altText width height }
  }
`;

const CART_FIELDS = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            id
            title
            availableForSale
            price { amount currencyCode }
            image { url altText width height }
            product { handle title }
          }
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = /* GraphQL */ `
  query Collections($first: Int!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    collections(first: $first) {
      nodes { id handle title description image { url altText width height } }
    }
  }
`;

const COLLECTION_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  query CollectionByHandle(
    $handle: String!
    $first: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys!
    $reverse: Boolean!
    $filters: [ProductFilter!]
    $language: LanguageCode!
    $country: CountryCode!
  ) @inContext(language: $language, country: $country) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText width height }
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
        nodes { ...ProductFields }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const PRODUCT_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  ${VARIANT_FIELDS}
  query ProductByHandle($handle: String!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    product(handle: $handle) {
      ...ProductFields
      variants(first: 100) { nodes { ...VariantFields } }
    }
  }
`;

const RECOMMENDATIONS_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  query Recommendations($productId: ID!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    productRecommendations(productId: $productId) { ...ProductFields }
  }
`;

const SEARCH_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  query SearchProducts(
    $query: String!
    $first: Int!
    $after: String
    $sortKey: ProductSortKeys!
    $reverse: Boolean!
    $filters: [ProductFilter!]
    $language: LanguageCode!
    $country: CountryCode!
  ) @inContext(language: $language, country: $country) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
      nodes { ...ProductFields }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const HANDLES_QUERY = /* GraphQL */ `
  query Handles($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes { handle }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COLLECTION_HANDLES_QUERY = /* GraphQL */ `
  query CollectionHandles($first: Int!) {
    collections(first: $first) { nodes { handle } }
  }
`;

const CART_QUERY = /* GraphQL */ `
  ${CART_FIELDS}
  query GetCart($id: ID!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    cart(id: $id) { ...CartFields }
  }
`;

const CART_CREATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartCreate($input: CartInput!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

const CART_LINES_ADD = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

const CART_LINES_UPDATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

const CART_LINES_REMOVE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!, $language: LanguageCode!, $country: CountryCode!)
  @inContext(language: $language, country: $country) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

type Gql<T> = { data?: T; errors?: { message: string }[] };

type RawMoney = { amount: string; currencyCode: string };
type RawImage = { url: string; altText: string | null; width: number | null; height: number | null };
type RawVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: RawMoney;
  compareAtPrice: RawMoney | null;
  selectedOptions: { name: string; value: string }[];
  image: RawImage | null;
};
type RawProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  vendor: string;
  tags: string[];
  availableForSale: boolean;
  priceRange: { minVariantPrice: RawMoney; maxVariantPrice: RawMoney };
  compareAtPriceRange: { minVariantPrice: RawMoney } | null;
  featuredImage: RawImage | null;
  images: { nodes: RawImage[] };
  options: { name: string; values: string[] }[];
  variants?: { nodes: RawVariant[] };
};
type RawCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: RawMoney };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      cost: { totalAmount: RawMoney };
      merchandise: {
        id?: string;
        title?: string;
        availableForSale?: boolean;
        price?: RawMoney;
        image?: RawImage | null;
        product?: { handle: string; title: string };
      };
    }[];
  };
};
type UserError = { field: string[] | null; message: string };

function domain(): string {
  const raw = process.env.SHOPIFY_STORE_DOMAIN ?? '';
  return raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function languageFor(locale: Locale): { language: string; country: string } {
  return { language: locale === 'ar' ? 'AR' : 'EN', country: 'KW' };
}

async function storefront<T>(
  query: string,
  variables: Record<string, unknown>,
  options: { revalidate?: number } = {},
): Promise<T> {
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain() || !token) throw new CommerceError('Shopify is not configured.');

  let response: Response;
  try {
    response = await fetch(`https://${domain()}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      ...(options.revalidate !== undefined
        ? { next: { revalidate: options.revalidate } }
        : { cache: 'no-store' as const }),
    });
  } catch {
    throw new CommerceError('Could not reach the Shopify Storefront API.');
  }

  if (!response.ok) throw new CommerceError(`Shopify Storefront API responded with ${response.status}.`);
  const body = (await response.json()) as Gql<T>;
  if (body.errors?.length) throw new CommerceError(body.errors[0].message);
  if (!body.data) throw new CommerceError('Shopify Storefront API returned no data.');
  return body.data;
}

function money(m: RawMoney): Money {
  return { amount: m.amount, currencyCode: m.currencyCode };
}

function image(i: RawImage | null | undefined): Image | null {
  return i ? { url: i.url, altText: i.altText, width: i.width, height: i.height } : null;
}

function mapVariant(v: RawVariant): Variant {
  return {
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    price: money(v.price),
    compareAtPrice: v.compareAtPrice ? money(v.compareAtPrice) : null,
    selectedOptions: v.selectedOptions,
    image: image(v.image),
  };
}

function mapProduct(p: RawProduct): Product {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    vendor: p.vendor,
    tags: p.tags,
    availableForSale: p.availableForSale,
    priceRange: {
      min: money(p.priceRange.minVariantPrice),
      max: money(p.priceRange.maxVariantPrice),
    },
    compareAtPriceMin: p.compareAtPriceRange ? money(p.compareAtPriceRange.minVariantPrice) : null,
    featuredImage: image(p.featuredImage),
    images: p.images.nodes.map((i) => image(i) as Image),
    options: p.options.filter((o) => o.values.length > 0 && !(o.name === 'Title' && o.values[0] === 'Default Title')),
    variants: (p.variants?.nodes ?? []).map(mapVariant),
  };
}

function mapCart(c: RawCart): Cart {
  const lines: CartLine[] = c.lines.nodes.map((l) => {
    const m = l.merchandise;
    return {
      id: l.id,
      quantity: l.quantity,
      variantId: m.id ?? '',
      productHandle: m.product?.handle ?? '',
      productTitle: m.product?.title ?? '',
      variantTitle: m.title ?? '',
      image: image(m.image),
      unitPrice: money(m.price ?? l.cost.totalAmount),
      lineTotal: money(l.cost.totalAmount),
      availableForSale: m.availableForSale ?? true,
    };
  });
  return {
    checkoutUrl: c.checkoutUrl,
    totalQuantity: c.totalQuantity,
    subtotal: money(c.cost.subtotalAmount),
    lines,
  };
}

function sortArgs(sort: SortOption | undefined): { sortKey: string; reverse: boolean } {
  switch (sort) {
    case 'best-selling':
      return { sortKey: 'BEST_SELLING', reverse: false };
    case 'price-asc':
      return { sortKey: 'PRICE', reverse: false };
    case 'price-desc':
      return { sortKey: 'PRICE', reverse: true };
    case 'newest':
      return { sortKey: 'CREATED', reverse: true };
    case 'title':
      return { sortKey: 'TITLE', reverse: false };
    default:
      return { sortKey: 'COLLECTION_DEFAULT', reverse: false };
  }
}

function searchSortArgs(sort: SortOption | undefined): { sortKey: string; reverse: boolean } {
  switch (sort) {
    case 'best-selling':
      return { sortKey: 'BEST_SELLING', reverse: false };
    case 'price-asc':
      return { sortKey: 'PRICE', reverse: false };
    case 'price-desc':
      return { sortKey: 'PRICE', reverse: true };
    case 'newest':
      return { sortKey: 'CREATED_AT', reverse: true };
    case 'title':
      return { sortKey: 'TITLE', reverse: false };
    default:
      return { sortKey: 'RELEVANCE', reverse: false };
  }
}

function availabilityFilter(availableOnly: boolean | undefined): { available: boolean }[] | null {
  return availableOnly ? [{ available: true }] : null;
}

function throwUserErrors(errors: UserError[] | undefined): void {
  if (errors && errors.length > 0) throw new CommerceError(errors[0].message);
}

async function fetchAllHandles(): Promise<string[]> {
  const handles: string[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const data: { products: { nodes: { handle: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } =
      await storefront(HANDLES_QUERY, { first: 250, after }, { revalidate: 3600 });
    handles.push(...data.products.nodes.map((n) => n.handle));
    if (!data.products.pageInfo.hasNextPage || !data.products.pageInfo.endCursor) break;
    after = data.products.pageInfo.endCursor;
  }
  return handles;
}

export const shopifyProvider: CommerceProvider = {
  mode: 'shopify',

  async listCollections(locale) {
    const data = await storefront<{ collections: { nodes: Collection[] } }>(
      COLLECTIONS_QUERY,
      { first: 50, ...languageFor(locale) },
      { revalidate: 300 },
    );
    return data.collections.nodes.map((c) => ({ ...c, image: c.image ? image(c.image) : null }));
  },

  async getCollection(handle, options: ListOptions) {
    const { sortKey, reverse } = sortArgs(options.sort);
    const data = await storefront<{
      collection: null | (Omit<Collection, 'image'> & { image: RawImage | null; products: { nodes: RawProduct[]; pageInfo: ListResult['pageInfo'] } });
    }>(
      COLLECTION_QUERY,
      {
        handle,
        first: options.first ?? 12,
        after: options.after ?? null,
        sortKey,
        reverse,
        filters: availabilityFilter(options.availableOnly),
        ...languageFor(options.locale),
      },
      { revalidate: 60 },
    );
    if (!data.collection) return null;
    const { products, ...rest } = data.collection;
    return {
      collection: { ...rest, image: image(rest.image) },
      products: products.nodes.map(mapProduct),
      pageInfo: products.pageInfo,
    };
  },

  async getProduct(handle, locale) {
    const data = await storefront<{ product: RawProduct | null }>(
      PRODUCT_QUERY,
      { handle, ...languageFor(locale) },
      { revalidate: 60 },
    );
    return data.product ? mapProduct(data.product) : null;
  },

  async getRelatedProducts(product, locale) {
    const data = await storefront<{ productRecommendations: RawProduct[] | null }>(
      RECOMMENDATIONS_QUERY,
      { productId: product.id, ...languageFor(locale) },
      { revalidate: 300 },
    );
    return (data.productRecommendations ?? []).map(mapProduct).slice(0, 4);
  },

  async searchProducts(query, options) {
    const { sortKey, reverse } = searchSortArgs(options.sort);
    const data = await storefront<{ products: { nodes: RawProduct[]; pageInfo: ListResult['pageInfo'] } }>(
      SEARCH_QUERY,
      {
        query: query.trim(),
        first: options.first ?? 12,
        after: options.after ?? null,
        sortKey,
        reverse,
        filters: availabilityFilter(options.availableOnly),
        ...languageFor(options.locale),
      },
      { revalidate: 30 },
    );
    return { products: data.products.nodes.map(mapProduct), pageInfo: data.products.pageInfo };
  },

  async listProductHandles() {
    return fetchAllHandles();
  },

  async listCollectionHandles() {
    const data = await storefront<{ collections: { nodes: { handle: string }[] } }>(
      COLLECTION_HANDLES_QUERY,
      { first: 250 },
      { revalidate: 3600 },
    );
    return data.collections.nodes.map((n) => n.handle);
  },

  async getCart(token, locale) {
    if (!token) return emptyResult();
    const data = await storefront<{ cart: RawCart | null }>(CART_QUERY, { id: token, ...languageFor(locale) });
    if (!data.cart) return emptyResult();
    return { cart: mapCart(data.cart), token };
  },

  async addToCart(token, variantId, quantity, locale) {
    const lang = languageFor(locale);
    if (!token) {
      const data = await storefront<{ cartCreate: { cart: RawCart; userErrors: UserError[] } }>(CART_CREATE, {
        input: { lines: [{ merchandiseId: variantId, quantity }] },
        ...lang,
      });
      throwUserErrors(data.cartCreate.userErrors);
      return { cart: mapCart(data.cartCreate.cart), token: data.cartCreate.cart.id };
    }
    const data = await storefront<{ cartLinesAdd: { cart: RawCart | null; userErrors: UserError[] } }>(CART_LINES_ADD, {
      cartId: token,
      lines: [{ merchandiseId: variantId, quantity }],
      ...lang,
    });
    throwUserErrors(data.cartLinesAdd.userErrors);
    if (!data.cartLinesAdd.cart) throw new CommerceError('Cart not found.');
    return { cart: mapCart(data.cartLinesAdd.cart), token };
  },

  async updateCartLine(token, lineId, quantity, locale) {
    if (!token) throw new CommerceError('Cart not found.');
    const lang = languageFor(locale);
    if (quantity <= 0) return removeFromShopify(token, lineId, lang);
    const data = await storefront<{ cartLinesUpdate: { cart: RawCart | null; userErrors: UserError[] } }>(CART_LINES_UPDATE, {
      cartId: token,
      lines: [{ id: lineId, quantity }],
      ...lang,
    });
    throwUserErrors(data.cartLinesUpdate.userErrors);
    if (!data.cartLinesUpdate.cart) throw new CommerceError('Cart not found.');
    return { cart: mapCart(data.cartLinesUpdate.cart), token };
  },

  async removeCartLine(token, lineId, locale) {
    if (!token) throw new CommerceError('Cart not found.');
    return removeFromShopify(token, lineId, languageFor(locale));
  },
};

async function removeFromShopify(token: string, lineId: string, lang: { language: string; country: string }): Promise<CartResult> {
  const data = await storefront<{ cartLinesRemove: { cart: RawCart | null; userErrors: UserError[] } }>(CART_LINES_REMOVE, {
    cartId: token,
    lineIds: [lineId],
    ...lang,
  });
  throwUserErrors(data.cartLinesRemove.userErrors);
  if (!data.cartLinesRemove.cart) return emptyResult();
  return { cart: mapCart(data.cartLinesRemove.cart), token };
}

function emptyResult(): CartResult {
  return {
    cart: {
      checkoutUrl: null,
      totalQuantity: 0,
      subtotal: { amount: '0.000', currencyCode: 'KWD' },
      lines: [],
    },
    token: null,
  };
}
