import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { siteConfig } from '@/lib/config';
import { t, type Locale } from '@/lib/i18n';

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, locale }: { items: Crumb[]; locale: Locale }) {
  const strings = t(locale);
  const all: Crumb[] = [{ label: strings.collection.breadcrumbHome, href: '/' }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <ol>
          {all.map((item, i) => (
            <li key={`${item.label}-${i}`} aria-current={i === all.length - 1 ? 'page' : undefined}>
              {item.href && i < all.length - 1 ? <Link href={item.href}>{item.label}</Link> : item.label}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.label,
            ...(item.href ? { item: `${siteConfig.url}${item.href}` } : {}),
          })),
        }}
      />
    </>
  );
}
