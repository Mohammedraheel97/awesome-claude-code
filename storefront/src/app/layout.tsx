import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Cairo, Inter } from 'next/font/google';
import './globals.css';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { getCommerce } from '@/lib/commerce';
import { siteConfig } from '@/lib/config';
import { dirFor, t } from '@/lib/i18n';
import { getCartToken, getLocale } from '@/lib/session';

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'Almoallem | المعلم',
    template: '%s | Almoallem',
  },
  description: 'Sweets, snacks and chocolate, with clear prices and simple delivery.',
  openGraph: {
    type: 'website',
    siteName: 'Almoallem',
    locale: 'ar_KW',
    alternateLocale: ['en_KW'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#f5edd6',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const strings = t(locale);
  const commerce = getCommerce();

  // Header cart count is read per request; cart state lives in an httpOnly cookie.
  const cartToken = await getCartToken();
  const cart = await commerce.getCart(cartToken, locale).catch(() => null);
  const cartCount = cart?.cart.totalQuantity ?? 0;

  return (
    <html lang={locale} dir={dirFor(locale)} className={`${barlow.variable} ${inter.variable} ${cairo.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          {strings.skipToContent}
        </a>
        <AnnouncementBar locale={locale} />
        <Header locale={locale} cartCount={cartCount} />
        <main id="main">{children}</main>
        <Footer locale={locale} sampleMode={commerce.mode === 'sample'} />
      </body>
    </html>
  );
}
