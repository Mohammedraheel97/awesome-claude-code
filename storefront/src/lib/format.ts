import { intlLocale, type Locale } from '@/lib/i18n';
import type { Money } from '@/lib/commerce/types';

export function formatMoney(money: Money, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: money.currencyCode,
  }).format(Number(money.amount));
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function moneyToNumber(money: Money): number {
  return Number(money.amount);
}

export function slugifyFragment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
