import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/session';
import { listingHref, parseSort } from '@/lib/query';

describe('safeNextPath', () => {
  it('allows same-site relative paths', () => {
    expect(safeNextPath('/cart')).toBe('/cart');
    expect(safeNextPath('/collections/sweets?sort=price-asc')).toBe('/collections/sweets?sort=price-asc');
  });

  it('rejects open-redirect style values', () => {
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('listing helpers', () => {
  it('parses only known sort keys and defaults to featured', () => {
    expect(parseSort('price-desc')).toBe('price-desc');
    expect(parseSort('drop table')).toBe('featured');
    expect(parseSort(undefined)).toBe('featured');
  });

  it('builds hrefs and omits empty params', () => {
    expect(listingHref('/search', { q: 'date', sort: null, after: '12' })).toBe('/search?q=date&after=12');
    expect(listingHref('/collections/sweets', {})).toBe('/collections/sweets');
  });
});
