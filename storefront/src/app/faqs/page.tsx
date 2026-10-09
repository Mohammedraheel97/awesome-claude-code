import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).pages.faqsTitle, alternates: { canonical: '/faqs' } };
}

const TOPICS = ['Ordering', 'Payment', 'Delivery', 'Returns & exchanges', 'Products & allergens'];

export default async function FaqsPage() {
  const locale = await getLocale();
  const strings = t(locale);
  return (
    <PageShell title={strings.pages.faqsTitle} locale={locale} placeholder>
      {TOPICS.map((topic) => (
        <section key={topic} aria-label={topic}>
          <h2>{topic}</h2>
          <p className="muted">[Answer to be provided]</p>
        </section>
      ))}
    </PageShell>
  );
}
