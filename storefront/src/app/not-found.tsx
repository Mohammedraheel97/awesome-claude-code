import Link from 'next/link';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, parseLocale, t } from '@/lib/i18n';

export default async function NotFound() {
  const store = await cookies();
  const locale = parseLocale(store.get(LOCALE_COOKIE)?.value);
  const strings = t(locale);
  return (
    <div className="container">
      <div className="empty-state">
        <h1>{strings.errors.notFoundTitle}</h1>
        <p className="lead">{strings.errors.notFoundText}</p>
        <Link href="/" className="button">
          {strings.errors.backHome}
        </Link>
      </div>
    </div>
  );
}
