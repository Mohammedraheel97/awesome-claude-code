import Link from 'next/link';
import { CartIcon, MenuIcon, SearchIcon } from '@/components/Icons';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { getCommerce } from '@/lib/commerce';
import { t, type Locale } from '@/lib/i18n';

export async function Header({ locale, cartCount }: { locale: Locale; cartCount: number }) {
  const strings = t(locale);
  const collections = await getCommerce()
    .listCollections(locale)
    .catch(() => []);

  const links = [
    ...collections.map((c) => ({ href: `/collections/${c.handle}`, label: c.title })),
    { href: '/about', label: strings.nav.about },
    { href: '/contact', label: strings.nav.contact },
  ];

  return (
    <header className="site-header">
      <div className="container header-row">
        <div className="header-actions">
          <details className="mobile-menu">
            <summary className="icon-button" aria-label={strings.menu}>
              <MenuIcon />
            </summary>
            <div className="mobile-menu__panel">
              <nav aria-label={strings.menu}>
                <ul>
                  <li>
                    <Link href="/collections">{strings.nav.collections}</Link>
                  </li>
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <form action="/search" method="get" role="search">
                <label className="visually-hidden" htmlFor="mobile-search">
                  {strings.search.label}
                </label>
                <div className="search-form">
                  <input id="mobile-search" className="field" type="search" name="q" placeholder={strings.searchPlaceholder} />
                  <button className="button button--small" type="submit">
                    {strings.search.submit}
                  </button>
                </div>
              </form>
            </div>
          </details>
        </div>

        <Link href="/" className="wordmark" aria-label={strings.brandName}>
          <span>{locale === 'ar' ? strings.brandName : 'Almoallem'}</span>
          {locale === 'en' ? <span className="wordmark__ar">المعلم</span> : null}
        </Link>

        <nav className="main-nav" aria-label="Primary">
          <ul>
            <li>
              <Link href="/collections">{strings.nav.collections}</Link>
            </li>
            {collections.slice(0, 4).map((c) => (
              <li key={c.handle}>
                <Link href={`/collections/${c.handle}`}>{c.title}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <Link href="/search" className="icon-button" aria-label={strings.search.title}>
            <SearchIcon />
          </Link>
          <LocaleSwitch locale={locale} />
          <Link href="/cart" className="icon-button" aria-label={strings.cartCount(cartCount)}>
            <CartIcon />
            {cartCount > 0 ? <span className="cart-count" aria-hidden="true">{cartCount}</span> : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
