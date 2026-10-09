import { t, type Locale } from '@/lib/i18n';

/** Shared frame for informational pages (about, FAQs, policies). */
export function PageShell({
  title,
  lead,
  locale,
  placeholder = false,
  children,
}: {
  title: string;
  lead?: string;
  locale: Locale;
  placeholder?: boolean;
  children: React.ReactNode;
}) {
  const strings = t(locale);
  return (
    <div className="container">
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </header>
      {placeholder ? <p className="notice notice--warning">{strings.pages.placeholder}</p> : null}
      <div className="prose">{children}</div>
    </div>
  );
}
