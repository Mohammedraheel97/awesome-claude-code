import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n';
import { safeNextPath } from '@/lib/session';

export function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('lang'));
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
