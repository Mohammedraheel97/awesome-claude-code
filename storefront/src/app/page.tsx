import Link from 'next/link';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/ProductGrid';
import { GridSkeleton } from '@/components/Skeletons';
import { getCommerce } from '@/lib/commerce';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export default async function HomePage() {
  const locale = await getLocale();
  const strings = t(locale);
  const commerce = getCommerce();

  const collections = await commerce.listCollections(locale);
  const [firstCollection, secondCollection] = collections;
  const giftCollection = collections.find((c) => c.handle === 'eid-sweets');
  const heroSource = firstCollection
    ? await commerce.getCollection(firstCollection.handle, { locale, first: 1 }).catch(() => null)
    : null;
  const heroImage = heroSource?.products[0]?.featuredImage ?? null;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__inner">
          <div>
            <p className="eyebrow">{strings.home.heroEyebrow}</p>
            <h1 id="hero-title">{strings.home.heroTitle}</h1>
            <p className="lead">{strings.home.heroText}</p>
            <Link href="/collections" className="button">
              {strings.home.heroCta}
            </Link>
          </div>
          <div className="hero__media">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImage.url} alt={heroImage.altText ?? ''} width={800} height={800} fetchPriority="high" />
            ) : null}
          </div>
        </div>
      </section>

      {collections.length > 0 ? (
        <section className="section" aria-labelledby="collections-title">
          <div className="container">
            <div className="section-head">
              <h2 id="collections-title">{strings.home.collectionsTitle}</h2>
            </div>
            <ul className="grid grid--collections" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {collections.map((c) => (
                <li key={c.handle}>
                  <Link href={`/collections/${c.handle}`} className="collection-card">
                    <h3>{c.title}</h3>
                    {c.description ? <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{c.description}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {firstCollection ? (
        <section className="section section--surface" aria-labelledby="featured-title">
          <div className="container">
            <div className="section-head">
              <h2 id="featured-title">{strings.home.productsTitle}</h2>
              <Link href={`/collections/${firstCollection.handle}`} className="link-arrow">
                {strings.collection.allProducts}
              </Link>
            </div>
            <Suspense fallback={<GridSkeleton count={4} label={strings.home.productsTitle} />}>
              <FeaturedProducts handle={firstCollection.handle} locale={locale} label={strings.home.productsTitle} />
            </Suspense>
          </div>
        </section>
      ) : null}

      <section className="section" aria-label={strings.home.promoTitle}>
        <div className="container">
          <div className="promo">
            <div>
              <h2>{strings.home.promoTitle}</h2>
              <p style={{ margin: 0 }}>{strings.home.promoText}</p>
            </div>
            <Link href={giftCollection ? `/collections/${giftCollection.handle}` : '/collections'} className="button">
              {strings.home.promoCta}
            </Link>
          </div>
        </div>
      </section>

      {secondCollection ? (
        <section className="section" aria-labelledby="new-title">
          <div className="container">
            <div className="section-head">
              <h2 id="new-title">{strings.home.newArrivals}</h2>
              <Link href={`/collections/${secondCollection.handle}?sort=newest`} className="link-arrow">
                {strings.collection.allProducts}
              </Link>
            </div>
            <Suspense fallback={<GridSkeleton count={4} label={strings.home.newArrivals} />}>
              <NewArrivals handle={secondCollection.handle} locale={locale} label={strings.home.newArrivals} />
            </Suspense>
          </div>
        </section>
      ) : null}

      <section className="section section--dark" aria-labelledby="story-title">
        <div className="container story">
          <div>
            <h2 id="story-title">{strings.home.storyTitle}</h2>
            <p style={{ margin: 0, color: 'var(--color-on-dark)' }}>{strings.home.storyText}</p>
          </div>
          <div>
            <Link href="/about" className="button button--outline" style={{ color: 'var(--color-on-dark)', borderColor: 'var(--color-on-dark)', background: 'transparent' }}>
              {strings.home.storyCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

async function NewArrivals({ handle, locale, label }: { handle: string; locale: Locale; label: string }) {
  const result = await getCommerce().getCollection(handle, { locale, first: 4, sort: 'newest' });
  return <ProductGrid products={result?.products ?? []} locale={locale} label={label} />;
}

async function FeaturedProducts({ handle, locale, label }: { handle: string; locale: Locale; label: string }) {
  const result = await getCommerce().getCollection(handle, { locale, first: 4 });
  return <ProductGrid products={result?.products ?? []} locale={locale} label={label} />;
}
