import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).pages.aboutTitle, alternates: { canonical: '/about' } };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const strings = t(locale);
  return (
    <PageShell title={strings.pages.aboutTitle} locale={locale} placeholder>
      <p>{strings.home.storyText}</p>
    </PageShell>
  );
}
