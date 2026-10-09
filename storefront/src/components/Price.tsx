import { formatMoney } from '@/lib/format';
import type { Money } from '@/lib/commerce/types';
import { t, type Locale } from '@/lib/i18n';

type Props = {
  locale: Locale;
  price: Money;
  compareAt?: Money | null;
  /** Shows "From" before the price when the product has several prices. */
  from?: boolean;
};

export function Price({ locale, price, compareAt, from = false }: Props) {
  const strings = t(locale);
  const onSale = Boolean(compareAt && Number(compareAt.amount) > Number(price.amount));
  return (
    <p className={`price${onSale ? ' price--sale' : ''}`} style={{ margin: 0 }}>
      {from ? <span className="price__from">{strings.product.from}</span> : null}
      <span>{formatMoney(price, locale)}</span>
      {onSale && compareAt ? (
        <>
          <span className="visually-hidden">{strings.product.compareAt}</span>
          <s className="price__compare">{formatMoney(compareAt, locale)}</s>
        </>
      ) : null}
    </p>
  );
}
