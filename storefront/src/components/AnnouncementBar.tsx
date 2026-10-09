import { siteConfig } from '@/lib/config';
import { formatNumber } from '@/lib/format';
import { interpolate, t, type Locale } from '@/lib/i18n';

export function AnnouncementBar({ locale }: { locale: Locale }) {
  const strings = t(locale);
  const message = interpolate(strings.announcement, {
    amount: formatNumber(siteConfig.freeShippingThreshold, locale),
  });
  return (
    <div className="announcement" role="region" aria-label="Announcement">
      {message}
    </div>
  );
}
