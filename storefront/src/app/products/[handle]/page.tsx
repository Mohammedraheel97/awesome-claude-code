import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCartForm } from '@/components/AddToCartForm';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { Price } from '@/components/Price';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductGrid } from '@/components/ProductGrid';
import { GridSkeleton } from '@/components/Skeletons';
import { VariantPicker } from '@/components/VariantPicker';
import { getCommerce, type Product } from '@/lib/commerce';
import { siteConfig } from '@/lib/config';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/session';
import { readParams, type SearchParams } from '@/lib/query';
import { resolveVariant } from '@/lib/variants';

type Props = { params: Promise<{ handle: string }>; searchParams: SearchParams };

function absolute(url: string): string {
  return url.startsWith('http') ? url : `${siteConfig.url}${url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const locale = await getLocale();
  const product = await getCommerce().getProduct(handle, locale);
  // Resolved before streaming starts, so a missing product gets a real 404 status.
  if (!product) notFound();
  const image = product.featuredImage;
  return {
    title: product.title,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 160),
      type: 'website',
      url: `/products/${product.handle}`,
      images: image ? [{ url: absolute(image.url), alt: image.altText ?? product.title }] : [],
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const locale = await getLocale();
  const strings = t(locale);
  const commerce = getCommerce();
  const product = await commerce.getProduct(handle, locale);
  if (!product) notFound();

  const query = await readParams(searchParams);
  const selected = resolveVariant(product, query);
  const basePath = `/products/${product.handle}`;
  const multiPrice = product.priceRange.min.amount !== product.priceRange.max.amount;
  const price = selected?.price ?? product.priceRange.min;
  const compareAt = selected?.compareAtPrice ?? product.compareAtPriceMin;
  const available = selected ? selected.availableForSale : product.availableForSale;
  const images = product.images.length ? product.images : product.featuredImage ? [product.featuredImage] : [];

  return (
    <div className="container">
      <Breadcrumbs
        locale={locale}
        items={[
          { label: strings.collection.allProducts, href: '/collections' },
          { label: product.title },
        ]}
      />

      <div className="product-layout">
        <ProductGallery
          images={images}
          title={product.title}
          label={strings.product.gallery}
          thumbLabel={strings.product.thumbnail}
        />

        <section className="product-info" aria-labelledby="product-title">
          {product.vendor ? <p className="eyebrow">{product.vendor}</p> : null}
          <h1 id="product-title" className="product-title">
            {product.title}
          </h1>

          {selected ? (
            <Price locale={locale} price={price} compareAt={compareAt} from={false} />
          ) : (
            <Price locale={locale} price={product.priceRange.min} compareAt={compareAt} from={multiPrice} />
          )}

          <p className={`availability${available ? '' : ' availability--out'}`}>
            {available ? strings.product.inStock : strings.product.outOfStock}
          </p>

          <VariantPicker
            product={product}
            selected={selected ?? product.variants[0]}
            params={query}
            basePath={basePath}
            label={strings.product.selectOption}
            unavailableLabel={strings.product.unavailableOption}
          />

          <AddToCartForm
            variantId={selected?.id ?? null}
            available={available}
            labels={{
              addToCart: strings.product.addToCart,
              adding: strings.product.adding,
              soldOut: strings.product.soldOut,
              unavailable: strings.product.outOfStock,
              quantity: strings.product.quantity,
              decrease: strings.product.decrease,
              increase: strings.product.increase,
            }}
          />

          <div className="accordion">
            <details open>
              <summary>{strings.product.description}</summary>
              <div className="accordion__body">
                <p>{product.description}</p>
              </div>
            </details>
            <details>
              <summary>{strings.product.details}</summary>
              <div className="accordion__body">
                <dl className="spec-list">
                  {product.vendor ? (
                    <>
                      <dt>{strings.product.vendor}</dt>
                      <dd>{product.vendor}</dd>
                    </>
                  ) : null}
                  {selected?.selectedOptions.map((so) => (
                    <div key={so.name} style={{ display: 'contents' }}>
                      <dt>{so.name}</dt>
                      <dd>{so.value}</dd>
                    </div>
                  ))}
                  {product.tags.length ? (
                    <>
                      <dt>{strings.product.tags}</dt>
                      <dd>{product.tags.join(', ')}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            </details>
            <details>
              <summary>{strings.product.delivery}</summary>
              <div className="accordion__body">
                <p>{strings.product.deliveryText}</p>
                <Link href="/shipping" className="link-arrow">
                  {strings.footer.shipping}
                </Link>
              </div>
            </details>
            <details>
              <summary>{strings.product.returns}</summary>
              <div className="accordion__body">
                <p>{strings.product.returnsText}</p>
                <Link href="/returns" className="link-arrow">
                  {strings.footer.returns}
                </Link>
              </div>
            </details>
          </div>
        </section>
      </div>

      <Suspense fallback={<GridSkeleton count={4} label={strings.product.related} />}>
        <RelatedProducts product={product} locale={locale} title={strings.product.related} />
      </Suspense>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.title,
          description: product.description,
          image: images.map((i) => absolute(i.url)),
          brand: product.vendor ? { '@type': 'Brand', name: product.vendor } : undefined,
          sku: selected?.id,
          offers: selected
            ? {
                '@type': 'Offer',
                url: `${siteConfig.url}${basePath}`,
                priceCurrency: price.currencyCode,
                price: price.amount,
                availability: selected.availableForSale
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
                itemCondition: 'https://schema.org/NewCondition',
              }
            : undefined,
        }}
      />
    </div>
  );
}

async function RelatedProducts({ product, locale, title }: { product: Product; locale: Locale; title: string }) {
  const related = await getCommerce().getRelatedProducts(product, locale).catch(() => []);
  if (related.length === 0) return null;
  return (
    <section className="section" aria-labelledby="related-title" style={{ paddingBottom: 0 }}>
      <div className="section-head">
        <h2 id="related-title">{title}</h2>
      </div>
      <ProductGrid products={related} locale={locale} label={title} />
    </section>
  );
}
