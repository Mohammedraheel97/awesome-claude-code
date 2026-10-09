import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getCommerce } from '@/lib/commerce';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).collection.allProducts, alternates: { canonical: '/collections' } };
}

export default async function CollectionsIndexPage() {
  const locale = await getLocale();
  const strings = t(locale);
  const collections = await getCommerce().listCollections(locale);

  return (
    <div className="container">
      <Breadcrumbs locale={locale} items={[{ label: strings.nav.collections }]} />
      <h1 style={{ marginBottom: 'var(--space-8)' }}>{strings.nav.collections}</h1>
      {collections.length === 0 ? (
        <div className="empty-state">
          <p>{strings.collection.emptyCollection}</p>
        </div>
      ) : (
        <ul className="grid grid--collections" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {collections.map((c) => (
            <li key={c.handle}>
              <Link href={`/collections/${c.handle}`} className="collection-card">
                <h2 style={{ fontSize: 'var(--text-xl)' }}>{c.title}</h2>
                {c.description ? <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{c.description}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
