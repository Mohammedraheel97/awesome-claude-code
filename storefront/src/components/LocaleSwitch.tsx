'use client';

import { usePathname } from 'next/navigation';
import { type Locale, t } from '@/lib/i18n';

/** Switches the language cookie and returns the user to the page they were on. */
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const target: Locale = locale === 'ar' ? 'en' : 'ar';
  const href = `/api/locale?lang=${target}&next=${encodeURIComponent(pathname || '/')}`;
  return (
    <a href={href} className="lang-switch" hrefLang={target} lang={target}>
      {t(locale).switchLanguage}
    </a>
  );
}
