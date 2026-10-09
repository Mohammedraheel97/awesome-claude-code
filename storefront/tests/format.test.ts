import { describe, expect, it } from 'vitest';
import { formatMoney, slugifyFragment } from '@/lib/format';

describe('formatMoney', () => {
  it('formats KWD with three decimals in English', () => {
    const out = formatMoney({ amount: '3.500', currencyCode: 'KWD' }, 'en');
    expect(out).toContain('3.500');
    expect(out).toMatch(/KWD|KD|د\.ك/);
  });

  it('formats in Arabic locale without throwing', () => {
    expect(formatMoney({ amount: '10.000', currencyCode: 'KWD' }, 'ar').length).toBeGreaterThan(0);
  });
});

describe('slugifyFragment', () => {
  it('keeps Arabic letters and removes punctuation', () => {
    expect(slugifyFragment('  Eid Sweets! ')).toBe('eid-sweets');
    expect(slugifyFragment('حلويات العيد')).toBe('حلويات-العيد');
  });
});
