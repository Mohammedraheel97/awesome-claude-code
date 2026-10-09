import { ProductCard } from '@/components/ProductCard';
import type { Product } from '@/lib/commerce/types';
import type { Locale } from '@/lib/i18n';

export function ProductGrid({ products, locale, label }: { products: Product[]; locale: Locale; label: string }) {
  return (
    <ul className="grid" aria-label={label} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
