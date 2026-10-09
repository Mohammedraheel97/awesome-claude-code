import { describe, expect, it } from 'vitest';
import { sampleProvider } from '@/lib/commerce/sample-provider';
import { CommerceError, MAX_LINE_QUANTITY } from '@/lib/commerce/types';

const chocolateBox250 = 'sample-belgian-dark-chocolate-box-0';
const chocolateBox500 = 'sample-belgian-dark-chocolate-box-1';
const soldOutSpread = 'sample-hazelnut-praline-spread-1';

describe('sample provider: catalog', () => {
  it('lists the chocolate collection with localized titles', async () => {
    const result = await sampleProvider.getCollection('chocolate', { locale: 'en', first: 50 });
    expect(result?.collection.title).toBe('Chocolate');
    expect(result?.products.length).toBeGreaterThan(0);
    expect(result?.products.every((p) => p.tags !== undefined)).toBe(true);
  });

  it('returns null for an unknown collection or product', async () => {
    expect(await sampleProvider.getCollection('nope', { locale: 'en' })).toBeNull();
    expect(await sampleProvider.getProduct('nope', 'en')).toBeNull();
  });

  it('paginates with a cursor and never repeats or drops items', async () => {
    const all = await sampleProvider.searchProducts('a', { locale: 'en', first: 50 });
    const seen: string[] = [];
    let after: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const res = await sampleProvider.searchProducts('a', { locale: 'en', first: 3, after });
      seen.push(...res.products.map((p) => p.handle));
      if (!res.pageInfo.hasNextPage) break;
      after = res.pageInfo.endCursor;
    }
    expect(seen).toEqual(all.products.map((p) => p.handle));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('sorts by price ascending and descending', async () => {
    const asc = await sampleProvider.getCollection('chocolate', { locale: 'en', first: 50, sort: 'price-asc' });
    const desc = await sampleProvider.getCollection('chocolate', { locale: 'en', first: 50, sort: 'price-desc' });
    const ascPrices = asc!.products.map((p) => Number(p.priceRange.min.amount));
    const descPrices = desc!.products.map((p) => Number(p.priceRange.min.amount));
    expect(ascPrices).toEqual([...ascPrices].sort((a, b) => a - b));
    expect(descPrices).toEqual([...descPrices].sort((a, b) => b - a));
  });

  it('filters to available products only', async () => {
    const res = await sampleProvider.getCollection('chocolate', { locale: 'en', first: 50, availableOnly: true });
    expect(res!.products.every((p) => p.availableForSale)).toBe(true);
  });

  it('empty search query returns no products', async () => {
    const res = await sampleProvider.searchProducts('   ', { locale: 'en' });
    expect(res.products).toEqual([]);
  });

  it('returns related products from the same collection, excluding the product itself', async () => {
    const product = await sampleProvider.getProduct('belgian-dark-chocolate-box', 'en');
    const related = await sampleProvider.getRelatedProducts(product!, 'en');
    expect(related.length).toBeGreaterThan(0);
    expect(related.some((p) => p.handle === product!.handle)).toBe(false);
  });
});

describe('sample provider: variants and cart', () => {
  it('marks sold-out variants as unavailable', async () => {
    const product = await sampleProvider.getProduct('hazelnut-praline-spread', 'en');
    expect(product!.variants.find((v) => v.id === soldOutSpread)?.availableForSale).toBe(false);
  });

  it('adds items, merges quantities and computes subtotal from catalog prices', async () => {
    const first = await sampleProvider.addToCart(null, chocolateBox250, 2, 'en');
    const second = await sampleProvider.addToCart(first.token, chocolateBox250, 1, 'en');
    expect(second.cart.lines).toHaveLength(1);
    expect(second.cart.lines[0].quantity).toBe(3);
    expect(second.cart.totalQuantity).toBe(3);
    expect(second.cart.subtotal.amount).toBe('10.500');
  });

  it('keeps line totals consistent with unit prices', async () => {
    const result = await sampleProvider.addToCart(null, chocolateBox500, 2, 'en');
    const line = result.cart.lines[0];
    expect(line.lineTotal.amount).toBe('12.000');
    expect(line.unitPrice.amount).toBe('6.000');
  });

  it('refuses to add a sold-out variant', async () => {
    await expect(sampleProvider.addToCart(null, soldOutSpread, 1, 'en')).rejects.toBeInstanceOf(CommerceError);
  });

  it('clamps the quantity to the line maximum', async () => {
    const result = await sampleProvider.addToCart(null, chocolateBox250, 99, 'en');
    expect(result.cart.lines[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('updates a line and removes it at quantity zero', async () => {
    const added = await sampleProvider.addToCart(null, chocolateBox250, 1, 'en');
    const lineId = added.cart.lines[0].id;
    const updated = await sampleProvider.updateCartLine(added.token, lineId, 4, 'en');
    expect(updated.cart.lines[0].quantity).toBe(4);
    const removed = await sampleProvider.updateCartLine(updated.token, lineId, 0, 'en');
    expect(removed.cart.lines).toHaveLength(0);
    expect(removed.token).toBeNull();
  });

  it('removes a single line', async () => {
    const a = await sampleProvider.addToCart(null, chocolateBox250, 1, 'en');
    const b = await sampleProvider.addToCart(a.token, chocolateBox500, 1, 'en');
    const lineToRemove = b.cart.lines[0].id;
    const after = await sampleProvider.removeCartLine(b.token, lineToRemove, 'en');
    expect(after.cart.lines.map((l) => l.variantId)).toEqual([chocolateBox500]);
  });

  it('rejects unknown cart line ids', async () => {
    const a = await sampleProvider.addToCart(null, chocolateBox250, 1, 'en');
    await expect(sampleProvider.removeCartLine(a.token, '99:nope', 'en')).rejects.toBeInstanceOf(CommerceError);
  });

  it('ignores cart tokens that reference unknown variants', async () => {
    const bogus = Buffer.from(JSON.stringify([{ variantId: 'sample-missing-0', quantity: 1 }]), 'utf8').toString('base64url');
    const result = await sampleProvider.getCart(bogus, 'en');
    expect(result.cart.lines).toEqual([]);
  });

  it('never provides a checkout URL in sample mode', async () => {
    const result = await sampleProvider.addToCart(null, chocolateBox250, 1, 'en');
    expect(result.cart.checkoutUrl).toBeNull();
  });
});
