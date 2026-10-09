import type { Metadata } from 'next';
import Link from 'next/link';
import { ListToolbar } from '@/components/ListToolbar';
import { ProductGrid } from '@/components/ProductGrid';
import { getCommerce } from '@/lib/commerce';
import { siteConfig } from '@/lib/config';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/session';
import { listingHref, parseSort, readParams, type SearchParams } from '@/lib/query';
import type { SortOption } from '@/lib/commerce';

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await readParams(searchParams);
  const locale = await getLocale();
  const strings = t(locale);
  const term = (query.q ?? '').trim().slice(0, 120);
  const sort = parseSort(query.sort);
  const availableOnly = query.available === '1';

  const result = term
    ? await getCommerce().searchProducts(term, {
        locale,
        first: siteConfig.pageSize,
        after: query.after ?? null,
        sort,
        availableOnly,
      })
    : null;

  const nextHref =
    result?.pageInfo.hasNextPage
      ? listingHref('/search', {
          q: term,
          sort: sort === 'featured' ? null : sort,
          available: availableOnly ? '1' : null,
          after: result.pageInfo.endCursor,
        })
      : null;

  return (
    <div className="container">
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1>{strings.search.title}</h1>
        <form action="/search" method="get" role="search" className="search-form" style={{ maxWidth: '640px' }}>
          <label className="visually-hidden" htmlFor="search-q">
            {strings.search.label}
          </label>
          <input
            id="search-q"
            className="field"
            type="search"
            name="q"
            defaultValue={term}
            placeholder={strings.searchPlaceholder}
            maxLength={120}
          />
          <button className="button" type="submit">
            {strings.search.submit}
          </button>
        </form>
      </header>

      {!result ? (
        <p className="lead">{strings.search.prompt}</p>
      ) : (
        <>
          <ToolbarAndResults
            term={term}
            locale={locale}
            sort={sort}
            availableOnly={availableOnly}
            products={result.products}
            label={strings.search.results(result.products.length, term)}
            emptyText={strings.search.none}
          />
          {nextHref ? (
            <div className="load-more">
              <Link href={nextHref} className="button button--outline" scroll={false}>
                {strings.collection.loadMore}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ToolbarAndResults({
  term,
  locale,
  sort,
  availableOnly,
  products,
  label,
  emptyText,
}: {
  term: string;
  locale: Locale;
  sort: SortOption;
  availableOnly: boolean;
  products: Parameters<typeof ProductGrid>[0]['products'];
  label: string;
  emptyText: string;
}) {
  return (
    <>
      <p className="lead" role="status" style={{ marginBottom: 'var(--space-4)' }}>
        {label}
      </p>
      <ListToolbar
        locale={locale}
        action="/search"
        hidden={{ q: term }}
        sort={sort}
        availableOnly={availableOnly}
        count={products.length}
      />
      {products.length > 0 ? (
        <ProductGrid products={products} locale={locale} label={label} />
      ) : (
        <div className="empty-state">
          <p>{emptyText}</p>
          <Link href="/collections" className="button button--outline">
            {t(locale).collection.browseAll}
          </Link>
        </div>
      )}
    </>
  );
}
