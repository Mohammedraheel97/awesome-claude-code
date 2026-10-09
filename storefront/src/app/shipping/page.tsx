import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { siteConfig } from '@/lib/config';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale).pages.shippingTitle, alternates: { canonical: '/shipping' } };
}

export default async function ShippingPage() {
  const locale = await getLocale();
  const strings = t(locale);
  return (
    <PageShell title={strings.pages.shippingTitle} locale={locale} placeholder>
      <h2>Free delivery</h2>
      <p>
        Orders over {formatNumber(siteConfig.freeShippingThreshold, locale)} KWD qualify for free delivery. Confirm this threshold before launch.
      </p>
      <h2>Delivery areas and fees</h2>
      <p className="muted">[To be confirmed]</p>
      <h2>Delivery times</h2>
      <p className="muted">[To be confirmed]</p>
    </PageShell>
  );
}
