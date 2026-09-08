import { en, type MapMessages } from './en';
import { is } from './is';

export type Locale = 'is' | 'en';

/** All locales in one object - feed the active one to IntlProvider. */
export const messages: Record<Locale, MapMessages> = { is, en };

/**
 * Flatten the nested namespace object into the flat map IntlProvider
 * expects (island.is's libs/localization does the same when loading
 * namespaces).
 */
export function flattenMessages(ns: MapMessages): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      const id = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        walk(value as Record<string, unknown>, id);
      } else {
        result[id] = value as string;
      }
    }
  };
  walk(ns, '');
  return result;
}

export { en, is };
export type { MapMessages };
