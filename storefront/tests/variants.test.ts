import { describe, expect, it } from 'vitest';
import { sampleProvider } from '@/lib/commerce/sample-provider';
import { resolveVariant } from '@/lib/variants';

describe('resolveVariant', () => {
  it('selects the variant matching URL options', async () => {
    const product = (await sampleProvider.getProduct('belgian-dark-chocolate-box', 'en'))!;
    expect(resolveVariant(product, { Size: '500 g' })?.title).toBe('500 g');
    expect(resolveVariant(product, { Size: '250 g' })?.title).toBe('250 g');
  });

  it('falls back to the first variant when no options are given', async () => {
    const product = (await sampleProvider.getProduct('belgian-dark-chocolate-box', 'en'))!;
    expect(resolveVariant(product, {})?.title).toBe('250 g');
  });

  it('ignores unknown option values', async () => {
    const product = (await sampleProvider.getProduct('belgian-dark-chocolate-box', 'en'))!;
    expect(resolveVariant(product, { Size: 'huge' })).not.toBeNull();
  });

  it('returns null for a product with no variants in listing form', async () => {
    const listing = (await sampleProvider.getCollection('chocolate', { locale: 'en' }))!.products[0];
    expect(resolveVariant(listing, {})).toBeNull();
  });
});
