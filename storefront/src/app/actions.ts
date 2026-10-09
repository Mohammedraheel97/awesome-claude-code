'use server';

import { revalidatePath } from 'next/cache';
import { getCommerce, CommerceError, MAX_LINE_QUANTITY } from '@/lib/commerce';
import { getCartToken, getLocale, setCartToken } from '@/lib/session';
import { t } from '@/lib/i18n';

export type CartActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export type NewsletterState = {
  status: 'idle' | 'invalid' | 'not-connected';
  message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseQuantity(value: FormDataEntryValue | null, fallback = 1): number | null {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_LINE_QUANTITY) return null;
  return n;
}

function refreshCartViews(): void {
  revalidatePath('/', 'layout');
  revalidatePath('/cart');
}

export async function addToCartAction(
  _previous: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const locale = await getLocale();
  const strings = t(locale);
  const variantId = formData.get('variantId');
  const quantity = parseQuantity(formData.get('quantity'));

  if (typeof variantId !== 'string' || variantId.length === 0 || quantity === null || quantity < 1) {
    return { status: 'error', message: strings.product.addError };
  }

  try {
    const result = await getCommerce().addToCart(await getCartToken(), variantId, quantity, locale);
    await setCartToken(result.token);
    refreshCartViews();
    return { status: 'success', message: strings.product.addedToCart };
  } catch (error) {
    const message = error instanceof CommerceError ? error.message : strings.product.addError;
    return { status: 'error', message };
  }
}

export async function updateCartLineAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const lineId = formData.get('lineId');
  const quantity = parseQuantity(formData.get('quantity'), 0);
  if (typeof lineId !== 'string' || quantity === null) return;

  const token = await getCartToken();
  if (!token) return;
  try {
    const result = await getCommerce().updateCartLine(token, lineId, quantity, locale);
    await setCartToken(result.token);
  } finally {
    refreshCartViews();
  }
}

export async function removeCartLineAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const lineId = formData.get('lineId');
  if (typeof lineId !== 'string') return;

  const token = await getCartToken();
  if (!token) return;
  try {
    const result = await getCommerce().removeCartLine(token, lineId, locale);
    await setCartToken(result.token);
  } finally {
    refreshCartViews();
  }
}

/**
 * Newsletter sign-up. No marketing-list backend is wired up yet, so a valid
 * address is NOT stored or claimed as subscribed; the user is told so.
 */
export async function subscribeNewsletterAction(
  _previous: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const locale = await getLocale();
  const strings = t(locale);
  const email = formData.get('email');
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    return { status: 'invalid', message: strings.footer.newsletterInvalid };
  }
  return { status: 'not-connected', message: strings.footer.newsletterNotConnected };
}
