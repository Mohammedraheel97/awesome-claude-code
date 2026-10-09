import type { Product, Variant } from '@/lib/commerce/types';

/** Picks the variant that matches the most selected options, preferring available ones. */
export function resolveVariant(product: Product, params: Record<string, string>): Variant | null {
  if (product.variants.length === 0) return null;
  let best: Variant | null = null;
  let bestScore = -1;
  for (const variant of product.variants) {
    const score = variant.selectedOptions.reduce(
      (sum, so) => sum + (params[so.name] === so.value ? 1 : 0),
      0,
    );
    const ranked = score + (variant.availableForSale ? 0.5 : 0);
    if (ranked > bestScore) {
      best = variant;
      bestScore = ranked;
    }
  }
  return best;
}

