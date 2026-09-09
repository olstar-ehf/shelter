import IntlMessageFormat from 'intl-messageformat';
import { flattenMessages, messages as mapMessages } from '@island.is/map/server';
import {
  flattenMessages as flattenTemplateMessages,
  messages as templateMessages,
} from '@island.is/windbreak-application/server';
import { en } from '../messages/en';
import { is } from '../messages/is';

export type Locale = 'is' | 'en';

/**
 * One flat catalog per locale: the app's chrome/error keys, the map lib's
 * `map.*`, `validation.*` and `drawLocal.*` namespaces and the windbreak
 * template's `windbreak.*` namespace - the same merge the client performs,
 * so the server and the client render the exact same messages (locale
 * parity). The libs win on collisions - they own their keyspaces.
 */
const enFlat: Record<string, string> = {
  ...en,
  ...flattenMessages(mapMessages.en),
  ...flattenTemplateMessages(templateMessages.en),
};
const isFlat: Record<string, string> = {
  ...is,
  ...flattenMessages(mapMessages.is),
  ...flattenTemplateMessages(templateMessages.is),
};

export const messages: Record<Locale, Record<string, string>> = {
  en: enFlat,
  is: isFlat,
};

const FALLBACK_LOCALE: Locale = 'en';

/**
 * Resolve the request locale, island.is-style:
 *  1. `lang` query parameter (?lang=is),
 *  2. `lang` cookie,
 *  3. Accept-Language header,
 *  4. default (Icelandic).
 */
export function resolveLocale(
  query: unknown,
  cookies: Record<string, string | undefined>,
  acceptLanguage: string | undefined,
): Locale {
  const fromQuery = typeof (query as Record<string, unknown>)?.lang === 'string'
    ? ((query as Record<string, string>).lang as string)
    : undefined;
  const fromCookie = cookies.lang;
  const fromHeader = acceptLanguage?.toLowerCase().startsWith('is')
    ? 'is'
    : acceptLanguage?.toLowerCase().startsWith('en')
      ? 'en'
      : undefined;
  const candidate = fromQuery ?? fromCookie ?? fromHeader;
  return candidate === 'is' || candidate === 'en' ? candidate : 'is';
}

/** A typed format function for one locale. */
export interface Translator {
  (key: string, values?: Record<string, unknown>): string;
}

/**
 * Create a `t` function backed by the locale's ICU MessageFormat catalog.
 * Falls back to English for missing keys and keeps a per-key formatter
 * cache.
 */
export function createTranslator(locale: Locale): Translator {
  const catalog =
    messages[locale] ?? messages[FALLBACK_LOCALE];
  const cache = new Map<string, IntlMessageFormat>();

  return (key: string, values?: Record<string, unknown>): string => {
    const pattern =
      catalog[key] ?? messages[FALLBACK_LOCALE][key];
    if (pattern === undefined) {
      return key;
    }
    let formatter = cache.get(key);
    if (!formatter) {
      formatter = new IntlMessageFormat(pattern, locale);
      cache.set(key, formatter);
    }
    return formatter.format(values) as string;
  };
}

export function isLocale(value: unknown): value is Locale {
  return value === 'is' || value === 'en';
}
