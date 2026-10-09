import { describe, expect, it } from 'vitest';
import { dictionaries, interpolate, parseLocale, dirFor, type Strings } from '@/lib/i18n';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n dictionaries', () => {
  it('Arabic and English define the same keys', () => {
    const en = keysOf(dictionaries.en as Strings).sort();
    const ar = keysOf(dictionaries.ar as Strings).sort();
    expect(ar).toEqual(en);
  });

  it('defaults to Arabic and right-to-left for unknown values', () => {
    expect(parseLocale(undefined)).toBe('ar');
    expect(parseLocale('fr')).toBe('ar');
    expect(parseLocale('en')).toBe('en');
    expect(dirFor('ar')).toBe('rtl');
    expect(dirFor('en')).toBe('ltr');
  });

  it('interpolates named placeholders', () => {
    expect(interpolate('Add {amount} KWD', { amount: '5' })).toBe('Add 5 KWD');
    expect(interpolate('Missing {x}', {})).toBe('Missing ');
  });
});
