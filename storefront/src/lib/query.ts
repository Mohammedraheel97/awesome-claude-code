import { SORT_OPTIONS, type SortOption } from '@/lib/commerce/types';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Keeps only single string values from Next.js search params. */
export async function readParams(input: SearchParams): Promise<Record<string, string>> {
  const raw = await input;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export function parseSort(value: string | undefined): SortOption {
  return SORT_OPTIONS.find((s) => s === value) ?? 'featured';
}

export function listingHref(base: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}
