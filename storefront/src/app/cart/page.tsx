import type { Metadata } from 'next';
import Link from 'next/link';
import { removeCartLineAction, updateCartLineAction } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { Price } from '@/components/Price';
import { getCommerce, MAX_LINE_QUANTITY } from '@/lib/commerce';
import { siteConfig } from '@/lib/config';
import { formatMoney, formatNumber } from '@/lib/format';
import { interpolate, t } from '@/lib/i18n';
import { getCartToken, getLocale } from '@/lib/session';

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const locale = await getLocale();
  const strings = t(locale);
  const token = await getCartToken();
  const { cart } = await getCommerce().getCart(token, locale);

  if (cart.lines.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <h1>{strings.cart.empty}</h1>
          <p className="lead">{strings.cart.emptyText}</p>
          <Link href="/collections" className="button">
            {strings.cart.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = Number(cart.subtotal.amount);
  const remaining = siteConfig.freeShippingThreshold - subtotal;
  const freeShippingMessage =
    remaining > 0
      ? interpolate(strings.cart.freeShippingRemaining, {
          amount: formatNumber(Number(remaining.toFixed(3)), locale),
        })
      : strings.cart.freeShippingReached;

  return (
    <div className="container">
      <h1 style={{ marginBottom: 'var(--space-8)' }}>{strings.cart.title}</h1>

      <div className="cart-layout">
        <section aria-label={strings.cart.title}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {cart.lines.map((line) => (
              <li key={line.id} className="cart-line">
                <Link href={`/products/${line.productHandle}`} className="cart-line__image" tabIndex={-1} aria-hidden="true">
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.image.url} alt="" width={88} height={88} loading="lazy" />
                  ) : null}
                </Link>

                <div>
                  <h2 className="cart-line__title">
                    <Link href={`/products/${line.productHandle}`}>{line.productTitle}</Link>
                  </h2>
                  {line.variantTitle && line.variantTitle !== 'Default Title' && line.variantTitle !== 'Default' ? (
                    <p className="muted" style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
                      {line.variantTitle}
                    </p>
                  ) : null}
                  <p className="muted" style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
                    {formatMoney(line.unitPrice, locale)} {strings.cart.each}
                  </p>
                  {!line.availableForSale ? (
                    <p className="form-status form-status--error">{strings.cart.soldOutLine}</p>
                  ) : null}

                  <div className="cart-line__controls">
                    <form action={updateCartLineAction} className="quantity-form">
                      <input type="hidden" name="lineId" value={line.id} />
                      <div className="quantity" role="group" aria-label={strings.cart.quantity}>
                        <button type="submit" name="quantity" value={line.quantity - 1} aria-label={strings.cart.decrease}>
                          −
                        </button>
                        <span
                          aria-live="polite"
                          style={{ minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                        >
                          {line.quantity}
                        </span>
                        <button
                          type="submit"
                          name="quantity"
                          value={line.quantity + 1}
                          aria-label={strings.cart.increase}
                          disabled={line.quantity >= MAX_LINE_QUANTITY}
                        >
                          +
                        </button>
                      </div>
                      <SubmitButton className="link-button" pendingLabel="…">
                        {strings.cart.update}
                      </SubmitButton>
                    </form>

                    <form action={removeCartLineAction}>
                      <input type="hidden" name="lineId" value={line.id} />
                      <SubmitButton className="link-button" pendingLabel="…">
                        {strings.cart.remove}
                      </SubmitButton>
                    </form>
                  </div>
                </div>

                <p className="cart-line__total" style={{ fontWeight: 700, margin: 0 }}>
                  {formatMoney(line.lineTotal, locale)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="cart-summary" aria-labelledby="summary-title">
          <h2 id="summary-title" style={{ fontSize: 'var(--text-xl)' }}>
            {strings.cart.subtotal}
          </h2>
          <div className="cart-summary__row">
            <span>{strings.cart.subtotal}</span>
            <Price locale={locale} price={cart.subtotal} />
          </div>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {freeShippingMessage}
          </p>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {strings.cart.shippingNote}
          </p>

          {cart.checkoutUrl ? (
            <a className="button" href={cart.checkoutUrl} style={{ width: '100%' }}>
              {strings.cart.checkout}
            </a>
          ) : (
            <>
              <button className="button" type="button" disabled style={{ width: '100%' }}>
                {strings.cart.checkout}
              </button>
              <p className="notice" style={{ marginTop: 'var(--space-3)' }}>
                {strings.cart.checkoutUnavailable}
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
