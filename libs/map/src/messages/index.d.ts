import { en, type MapMessages } from './en';
import { is } from './is';
export type Locale = 'is' | 'en';
/** All locales in one object - feed the active one to IntlProvider. */
export declare const messages: Record<Locale, MapMessages>;
/**
 * Flatten the nested namespace object into the flat map IntlProvider
 * expects (island.is's libs/localization does the same when loading
 * namespaces).
 */
export declare function flattenMessages(ns: MapMessages): Record<string, string>;
export { en, is };
export type { MapMessages };
