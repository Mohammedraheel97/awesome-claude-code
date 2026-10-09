import { cookies } from 'next/headers';
import { LOCALE_COOKIE, parseLocale, type Locale } from '@/lib/i18n';

export const CART_COOKIE = 'cart';
const ONE_MONTH = 60 * 60 * 24 * 30;

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocale(store.get(LOCALE_COOKIE)?.value);
}

export async function getCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function setCartToken(token: string | null): Promise<void> {
  const store = await cookies();
  if (token === null) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_MONTH,
  });
}

/** Only allow same-site relative paths, to prevent open redirects. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}
