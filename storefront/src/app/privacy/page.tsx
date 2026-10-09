import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).pages.privacyTitle, alternates: { canonical: '/privacy' } };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const strings = t(locale);
  return (
    <PageShell title={strings.pages.privacyTitle} locale={locale} placeholder>
      <p className="muted">
        [Privacy policy text to be provided by the business. Describe what personal data is collected, why, who processes it and how to request access or deletion.]
      </p>
    </PageShell>
  );
}
