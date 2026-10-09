import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ListToolbar } from '@/components/ListToolbar';
import { ProductGrid } from '@/components/ProductGrid';
import { getCommerce } from '@/lib/commerce';
import { siteConfig } from '@/lib/config';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';
import { listingHref, parseSort, readParams, type SearchParams } from '@/lib/query';

type Props = { params: Promise<{ handle: string }>; searchParams: SearchParams };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const locale = await getLocale();
  const result = await getCommerce().getCollection(handle, { locale, first: 1 });
  // Resolved before streaming starts, so a missing collection gets a real 404 status.
  if (!result) notFound();
  const { collection } = result;
  return {
    title: collection.title,
    description: collection.description || undefined,
    alternates: { canonical: `/collections/${collection.handle}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const query = await readParams(searchParams);
  const locale = await getLocale();
  const strings = t(locale);
  const sort = parseSort(query.sort);
  const availableOnly = query.available === '1';

  const result = await getCommerce().getCollection(handle, {
    locale,
    first: siteConfig.pageSize,
    after: query.after ?? null,
    sort,
    availableOnly,
  });
  if (!result) notFound();

  const { collection, products, pageInfo } = result;
  const filtered = sort !== 'featured' || availableOnly;
  const nextHref = pageInfo.hasNextPage
    ? listingHref(`/collections/${collection.handle}`, {
        sort: sort === 'featured' ? null : sort,
        available: availableOnly ? '1' : null,
        after: pageInfo.endCursor,
      })
    : null;

  return (
    <div className="container">
      <Breadcrumbs
        locale={locale}
        items={[{ label: strings.collection.allProducts, href: '/collections' }, { label: collection.title }]}
      />

      <header style={{ marginBottom: 'var(--space-8)' }}>
        <h1>{collection.title}</h1>
        {collection.description ? <p className="lead">{collection.description}</p> : null}
      </header>

      <ListToolbar
        locale={locale}
        action={`/collections/${collection.handle}`}
        sort={sort}
        availableOnly={availableOnly}
        count={products.length}
      />

      {products.length > 0 ? (
        <ProductGrid products={products} locale={locale} label={collection.title} />
      ) : (
        <div className="empty-state">
          <h2>{filtered ? strings.collection.empty : strings.collection.emptyCollection}</h2>
          <Link href="/collections" className="button button--outline">
            {strings.collection.browseAll}
          </Link>
        </div>
      )}

      {nextHref ? (
        <div className="load-more">
          <Link href={nextHref} className="button button--outline" scroll={false}>
            {strings.collection.loadMore}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
