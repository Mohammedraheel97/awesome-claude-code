import Link from 'next/link';
import { NewsletterForm } from '@/components/NewsletterForm';
import { siteConfig } from '@/lib/config';
import { t, type Locale } from '@/lib/i18n';

export function Footer({ locale, sampleMode }: { locale: Locale; sampleMode: boolean }) {
  const strings = t(locale);
  const year = new Date().getFullYear();
  const hasContact = Boolean(siteConfig.contactEmail || siteConfig.contactPhone);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h2>{strings.footer.newsletter}</h2>
            <p>{strings.footer.newsletterText}</p>
            <NewsletterForm />
          </div>

          <nav aria-label={strings.footer.shop}>
            <h2>{strings.footer.shop}</h2>
            <ul className="footer-list">
              <li>
                <Link href="/collections">{strings.collection.allProducts}</Link>
              </li>
              <li>
                <Link href="/search">{strings.search.title}</Link>
              </li>
              <li>
                <Link href="/cart">{strings.cart.title}</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={strings.footer.help}>
            <h2>{strings.footer.help}</h2>
            <ul className="footer-list">
              <li>
                <Link href="/faqs">{strings.footer.faqs}</Link>
              </li>
              <li>
                <Link href="/shipping">{strings.footer.shipping}</Link>
              </li>
              <li>
                <Link href="/returns">{strings.footer.returns}</Link>
              </li>
              <li>
                <Link href="/contact">{strings.footer.contact}</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={strings.footer.company}>
            <h2>{strings.footer.company}</h2>
            <ul className="footer-list">
              <li>
                <Link href="/about">{strings.footer.about}</Link>
              </li>
              <li>
                <Link href="/privacy">{strings.footer.privacy}</Link>
              </li>
              <li>
                <Link href="/terms">{strings.footer.terms}</Link>
              </li>
            </ul>
            {hasContact ? (
              <ul className="footer-list" style={{ marginTop: 'var(--space-4)' }}>
                {siteConfig.contactEmail ? (
                  <li>
                    <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
                  </li>
                ) : null}
                {siteConfig.contactPhone ? (
                  <li>
                    <a href={`tel:${siteConfig.contactPhone.replace(/\s+/g, '')}`}>{siteConfig.contactPhone}</a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </nav>
        </div>

        {sampleMode ? <p className="sample-banner" style={{ marginTop: 'var(--space-8)' }}>{strings.footer.sampleNotice}</p> : null}

        <div className="footer-bottom">
          <span>
            © {year} {strings.brandName}. {strings.footer.rights}
          </span>
        </div>
      </div>
    </footer>
  );
}
