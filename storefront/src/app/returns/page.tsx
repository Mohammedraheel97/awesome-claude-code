import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).pages.returnsTitle, alternates: { canonical: '/returns' } };
}

export default async function ReturnsPage() {
  const locale = await getLocale();
  const strings = t(locale);
  return (
    <PageShell title={strings.pages.returnsTitle} locale={locale} placeholder>
      <h2>Return window</h2>
      <p className="muted">[To be confirmed]</p>
      <h2>Conditions</h2>
      <p className="muted">[To be confirmed]</p>
      <h2>How to start a return</h2>
      <p className="muted">[To be confirmed]</p>
    </PageShell>
  );
}
