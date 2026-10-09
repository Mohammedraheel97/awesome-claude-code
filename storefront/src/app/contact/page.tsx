import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { siteConfig } from '@/lib/config';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).pages.contactTitle, alternates: { canonical: '/contact' } };
}

export default async function ContactPage() {
  const locale = await getLocale();
  const strings = t(locale);
  const configured = Boolean(siteConfig.contactEmail || siteConfig.contactPhone);

  return (
    <PageShell title={strings.pages.contactTitle} lead={strings.pages.contactText} locale={locale}>
      {configured ? (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
          {siteConfig.contactEmail ? (
            <li>
              <strong>{strings.pages.contactEmail}: </strong>
              <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            </li>
          ) : null}
          {siteConfig.contactPhone ? (
            <li>
              <strong>{strings.pages.contactPhone}: </strong>
              <a href={`tel:${siteConfig.contactPhone.replace(/\s+/g, '')}`}>{siteConfig.contactPhone}</a>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="notice">{strings.pages.contactNotConfigured}</p>
      )}
    </PageShell>
  );
}
