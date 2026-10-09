import { MAX_LINE_QUANTITY } from '@/lib/commerce/types';

export type SampleCartEntry = { variantId: string; quantity: number };

/**
 * Sample-mode cart tokens are a base64url-encoded list of { variantId, quantity }.
 * Prices and availability are always re-read from the catalog, so a tampered
 * token can change quantities but never prices.
 */
export function encodeSampleCart(entries: SampleCartEntry[]): string | null {
  if (entries.length === 0) return null;
  return Buffer.from(JSON.stringify(entries), 'utf8').toString('base64url');
}

export function decodeSampleCart(token: string | null | undefined): SampleCartEntry[] {
  if (!token) return [];
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is SampleCartEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as SampleCartEntry).variantId === 'string' &&
          Number.isInteger((e as SampleCartEntry).quantity) &&
          (e as SampleCartEntry).quantity > 0,
      )
      .map((e) => ({ variantId: e.variantId, quantity: Math.min(e.quantity, MAX_LINE_QUANTITY) }));
  } catch {
    return [];
  }
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.trunc(quantity)));
}
