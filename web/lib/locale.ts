/**
 * Server-side i18n for the Next.js host: resolves the request locale the
 * island.is way (?lang -> cookie -> Accept-Language -> Icelandic) and
 * merges the same catalogs the NestJS client uses, so SSR and hydration
 * format identical messages.
 */
import type { GetServerSidePropsContext } from 'next';

export type Locale = 'is' | 'en';

export function resolveLocaleFrom(ctx: GetServerSidePropsContext): Locale {
  const fromQuery = typeof ctx.query.lang === 'string' ? ctx.query.lang : undefined;
  const cookieLang = ctx.req.cookies?.lang;
  const acceptLanguage = ctx.req.headers['accept-language'];
  const fromHeader =
    typeof acceptLanguage === 'string' && acceptLanguage.toLowerCase().startsWith('is')
      ? 'is'
      : typeof acceptLanguage === 'string' && acceptLanguage.toLowerCase().startsWith('en')
        ? 'en'
        : undefined;
  const candidate = fromQuery ?? cookieLang ?? fromHeader;
  return candidate === 'is' || candidate === 'en' ? candidate : 'is';
}

/** Persist an explicit language choice (same as the NestJS host). */
export function persistLocale(
  ctx: GetServerSidePropsContext,
  locale: Locale,
): void {
  if (typeof ctx.query.lang === 'string') {
    ctx.res.setHeader(
      'Set-Cookie',
      `lang=${locale}; Max-Age=31536000; Path=/; SameSite=Lax`,
    );
  }
}

/** The locale normalized for react-intl + URLs. */
export function localeString(ctx: GetServerSidePropsContext): string {
  const locale = resolveLocaleFrom(ctx);
  persistLocale(ctx, locale);
  return locale;
}
