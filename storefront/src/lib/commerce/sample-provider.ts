import { sampleCollections, sampleProducts, type Localized, type SampleProduct } from '@/lib/commerce/sample-catalog';
import { clampQuantity, decodeSampleCart, encodeSampleCart, type SampleCartEntry } from '@/lib/commerce/cart-token';
import {
  CommerceError,
  MAX_LINE_QUANTITY,
  type Cart,
  type CartLine,
  type CartResult,
  type Collection,
  type CommerceProvider,
  type ListOptions,
  type ListResult,
  type Money,
  type Product,
  type SortOption,
  type Variant,
} from '@/lib/commerce/types';
import type { Locale } from '@/lib/i18n';

const CURRENCY = 'KWD';
const DEFAULT_FIRST = 12;

function money(amount: string): Money {
  return { amount, currencyCode: CURRENCY };
}

function pick(value: Localized, locale: Locale): string {
  return value[locale];
}

function imageFor(handle: string, alt: string) {
  return { url: `/demo/${handle}.svg`, altText: alt, width: 800, height: 800 };
}

function variantId(handle: string, index: number): string {
  return `sample-${handle}-${index}`;
}

function buildVariants(seed: SampleProduct, locale: Locale): Variant[] {
  return seed.variants.map((v, index) => {
    const selectedOptions = v.values.map((value, i) => ({
      name: seed.optionNames[i] ? pick(seed.optionNames[i], locale) : 'Title',
      value,
    }));
    return {
      id: variantId(seed.handle, index),
      title: v.values.join(' / '),
      availableForSale: v.available ?? true,
      price: money(v.price),
      compareAtPrice: v.compareAt ? money(v.compareAt) : null,
      selectedOptions,
      image: imageFor(seed.handle, pick(seed.title, locale)),
    };
  });
}

function buildProduct(seed: SampleProduct, locale: Locale, withVariants: boolean): Product {
  const variants = buildVariants(seed, locale);
  const prices = variants.map((v) => Number(v.price.amount));
  const minIndex = prices.indexOf(Math.min(...prices));
  const maxIndex = prices.indexOf(Math.max(...prices));
  const optionNames = seed.optionNames.map((n) => pick(n, locale));
  const options = optionNames.map((name, i) => ({
    name,
    values: [...new Set(seed.variants.map((v) => v.values[i]))],
  }));
  // Compare-at price belongs to the same variant as the displayed minimum price.
  const compareAtMin = variants[minIndex].compareAtPrice;
  const image = imageFor(seed.handle, pick(seed.title, locale));

  return {
    id: `sample-product-${seed.handle}`,
    handle: seed.handle,
    title: pick(seed.title, locale),
    description: pick(seed.description, locale),
    vendor: seed.vendor,
    tags: seed.tags,
    availableForSale: variants.some((v) => v.availableForSale),
    priceRange: { min: variants[minIndex].price, max: variants[maxIndex].price },
    compareAtPriceMin: compareAtMin,
    featuredImage: image,
    images: [image],
    options,
    variants: withVariants ? variants : [],
  };
}

function buildCollection(handle: string, locale: Locale): Collection {
  const seed = sampleCollections.find((c) => c.handle === handle);
  if (!seed) throw new Error(`Unknown sample collection ${handle}`);
  return {
    id: `sample-collection-${handle}`,
    handle,
    title: pick(seed.title, locale),
    description: pick(seed.description, locale),
    image: null,
  };
}

function findVariant(variantIdValue: string): { seed: SampleProduct; index: number } | null {
  for (const seed of sampleProducts) {
    const index = seed.variants.findIndex((_, i) => variantId(seed.handle, i) === variantIdValue);
    if (index !== -1) return { seed, index };
  }
  return null;
}

function sortProducts(products: Product[], sort: SortOption = 'featured'): Product[] {
  const list = [...products];
  const price = (p: Product) => Number(p.priceRange.min.amount);
  switch (sort) {
    case 'price-asc':
      return list.sort((a, b) => price(a) - price(b));
    case 'price-desc':
      return list.sort((a, b) => price(b) - price(a));
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case 'newest':
      // Sample data has no timestamps; the seed order is treated as newest-first.
      return list.reverse();
    case 'featured':
    case 'best-selling':
      // Sample data has no sales or merchandising rank; seed order is used.
      return list;
  }
}

function paginate(products: Product[], first: number, after: string | null | undefined): ListResult {
  const start = after ? Number.parseInt(after, 10) : 0;
  const offset = Number.isFinite(start) && start > 0 ? start : 0;
  const slice = products.slice(offset, offset + first);
  const nextOffset = offset + first;
  const hasNextPage = nextOffset < products.length;
  return {
    products: slice,
    pageInfo: { hasNextPage, endCursor: hasNextPage ? String(nextOffset) : null },
  };
}

function toCart(entries: SampleCartEntry[], locale: Locale): Cart {
  const lines: CartLine[] = [];
  let subtotal = 0;
  let totalQuantity = 0;

  entries.forEach((entry, index) => {
    const found = findVariant(entry.variantId);
    if (!found) return;
    const product = buildProduct(found.seed, locale, true);
    const variant = product.variants[found.index];
    const quantity = Math.min(entry.quantity, MAX_LINE_QUANTITY);
    const lineTotal = Number(variant.price.amount) * quantity;
    subtotal += lineTotal;
    totalQuantity += quantity;
    lines.push({
      id: `${index}:${entry.variantId}`,
      quantity,
      variantId: variant.id,
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: variant.title,
      image: variant.image ?? product.featuredImage,
      unitPrice: variant.price,
      lineTotal: money(lineTotal.toFixed(3)),
      availableForSale: variant.availableForSale,
    });
  });

  return {
    checkoutUrl: null,
    totalQuantity,
    subtotal: money(subtotal.toFixed(3)),
    lines,
  };
}

function entriesFromToken(token: string | null): SampleCartEntry[] {
  return decodeSampleCart(token).filter((e) => findVariant(e.variantId) !== null);
}

function resultFor(entries: SampleCartEntry[], locale: Locale): CartResult {
  return { cart: toCart(entries, locale), token: encodeSampleCart(entries) };
}

function lineIndexFromId(lineId: string, entries: SampleCartEntry[]): number {
  const index = Number.parseInt(lineId.split(':')[0], 10);
  if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
    throw new CommerceError('Cart line not found.');
  }
  return index;
}

export const sampleProvider: CommerceProvider = {
  mode: 'sample',

  async listCollections(locale) {
    return sampleCollections.map((c) => buildCollection(c.handle, locale));
  },

  async getCollection(handle, options: ListOptions) {
    const seed = sampleCollections.find((c) => c.handle === handle);
    if (!seed) return null;
    const collection = buildCollection(handle, options.locale);
    let products = sampleProducts
      .filter((p) => p.collections.includes(handle))
      .map((p) => buildProduct(p, options.locale, false));
    if (options.availableOnly) products = products.filter((p) => p.availableForSale);
    products = sortProducts(products, options.sort);
    return { collection, ...paginate(products, options.first ?? DEFAULT_FIRST, options.after) };
  },

  async getProduct(handle, locale) {
    const seed = sampleProducts.find((p) => p.handle === handle);
    return seed ? buildProduct(seed, locale, true) : null;
  },

  async getRelatedProducts(product, locale) {
    const seed = sampleProducts.find((p) => p.handle === product.handle);
    if (!seed) return [];
    return sampleProducts
      .filter((p) => p.handle !== seed.handle && p.collections.some((c) => seed.collections.includes(c)))
      .slice(0, 4)
      .map((p) => buildProduct(p, locale, false));
  },

  async searchProducts(query, options) {
    const q = query.trim().toLowerCase();
    if (!q) return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
    let products = sampleProducts
      .filter((p) => {
        const haystack = [p.title.ar, p.title.en, p.description.ar, p.description.en, ...p.tags]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .map((p) => buildProduct(p, options.locale, false));
    if (options.availableOnly) products = products.filter((p) => p.availableForSale);
    products = sortProducts(products, options.sort);
    return paginate(products, options.first ?? DEFAULT_FIRST, options.after);
  },

  async listProductHandles() {
    return sampleProducts.map((p) => p.handle);
  },

  async listCollectionHandles() {
    return sampleCollections.map((c) => c.handle);
  },

  async getCart(token, locale) {
    return resultFor(entriesFromToken(token), locale);
  },

  async addToCart(token, variantIdValue, quantity, locale) {
    const found = findVariant(variantIdValue);
    if (!found) throw new CommerceError('Product not found.');
    const variant = buildVariants(found.seed, locale)[found.index];
    if (!variant.availableForSale) throw new CommerceError('This option is sold out.');

    const entries = entriesFromToken(token);
    const existing = entries.find((e) => e.variantId === variantIdValue);
    const next = clampQuantity((existing?.quantity ?? 0) + clampQuantity(quantity));
    if (existing) existing.quantity = next;
    else entries.push({ variantId: variantIdValue, quantity: next });
    return resultFor(entries, locale);
  },

  async updateCartLine(token, lineId, quantity, locale) {
    const entries = entriesFromToken(token);
    const index = lineIndexFromId(lineId, entries);
    const next = clampQuantity(quantity);
    if (next === 0) entries.splice(index, 1);
    else entries[index].quantity = next;
    return resultFor(entries, locale);
  },

  async removeCartLine(token, lineId, locale) {
    const entries = entriesFromToken(token);
    const index = lineIndexFromId(lineId, entries);
    entries.splice(index, 1);
    return resultFor(entries, locale);
  },
};



