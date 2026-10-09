import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).pages.termsTitle, alternates: { canonical: '/terms' } };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const strings = t(locale);
  return (
    <PageShell title={strings.pages.termsTitle} locale={locale} placeholder>
      <p className="muted">[Terms of service text to be provided by the business.]</p>
    </PageShell>
  );
}
