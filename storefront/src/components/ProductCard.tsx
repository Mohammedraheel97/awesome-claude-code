import Link from 'next/link';
import { Price } from '@/components/Price';
import type { Product } from '@/lib/commerce/types';
import { t, type Locale } from '@/lib/i18n';

export function ProductCard({ product, locale }: { product: Product; locale: Locale }) {
  const strings = t(locale);
  const image = product.featuredImage;
  const onSale = Boolean(product.compareAtPriceMin && Number(product.compareAtPriceMin.amount) > Number(product.priceRange.min.amount));
  const multiPrice = product.priceRange.min.amount !== product.priceRange.max.amount;

  return (
    <Link href={`/products/${product.handle}`} className="product-card">
      <div className="product-card__media">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.altText ?? product.title}
            width={image.width ?? 800}
            height={image.height ?? 800}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {!product.availableForSale ? <span className="badge">{strings.product.soldOut}</span> : null}
        {product.availableForSale && onSale ? <span className="badge badge--sale">{strings.product.sale}</span> : null}
      </div>
      <h3 className="product-card__title">{product.title}</h3>
      <Price locale={locale} price={product.priceRange.min} compareAt={onSale ? product.compareAtPriceMin : null} from={multiPrice} />
    </Link>
  );
}
