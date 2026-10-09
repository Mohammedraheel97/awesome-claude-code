import { describe, expect, it } from 'vitest';
import { clampQuantity, decodeSampleCart, encodeSampleCart } from '@/lib/commerce/cart-token';
import { MAX_LINE_QUANTITY } from '@/lib/commerce/types';

describe('sample cart token', () => {
  it('round-trips entries', () => {
    const token = encodeSampleCart([{ variantId: 'sample-a-0', quantity: 2 }]);
    expect(token).toBeTruthy();
    expect(decodeSampleCart(token)).toEqual([{ variantId: 'sample-a-0', quantity: 2 }]);
  });

  it('encodes an empty cart as null so the cookie is cleared', () => {
    expect(encodeSampleCart([])).toBeNull();
  });

  it('ignores malformed tokens instead of throwing', () => {
    expect(decodeSampleCart('not-base64-json')).toEqual([]);
    expect(decodeSampleCart(null)).toEqual([]);
    const bogus = Buffer.from(JSON.stringify([{ variantId: 5, quantity: 'x' }]), 'utf8').toString('base64url');
    expect(decodeSampleCart(bogus)).toEqual([]);
  });

  it('caps quantities at the per-line maximum', () => {
    const token = Buffer.from(JSON.stringify([{ variantId: 'v', quantity: 999 }]), 'utf8').toString('base64url');
    expect(decodeSampleCart(token)[0].quantity).toBe(MAX_LINE_QUANTITY);
    expect(clampQuantity(-3)).toBe(0);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });
});
