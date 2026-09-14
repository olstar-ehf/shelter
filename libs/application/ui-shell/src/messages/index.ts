/**
 * App chrome messages (flat ids, as the NestJS server and both hosts use
 * them): the app's chrome/landing/confirmation/error keys. The map lib owns
 * the map, validation and drawLocal namespaces; the template owns windbreak.
 */
import { en } from './en';
import { is } from './is';

export type AppLocale = 'is' | 'en';

/** Per-locale catalogs (flat ids). */
export const messages: Record<AppLocale, Record<string, string>> = { en, is };

/** These catalogs are already flat - merge them into IntlProvider directly. */
export function flattenMessages(ns: Record<string, string>): Record<string, string> {
  return { ...ns };
}

export { en, is };
