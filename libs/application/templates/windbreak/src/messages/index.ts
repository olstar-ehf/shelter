import { windbreakEn, type WindbreakTemplateMessages } from './en';
import { windbreakIs } from './is';

export type TemplateLocale = 'is' | 'en';

/** Messages per locale, already namespaced under 'windbreak.*'. */
export const messages: Record<TemplateLocale, WindbreakTemplateMessages> = {
  en: windbreakEn,
  is: windbreakIs,
};

/** Flatten the nested namespace into the flat map IntlProvider expects. */
export function flattenMessages(ns: WindbreakTemplateMessages): Record<string, string> {
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
  walk({ windbreak: ns } as unknown as Record<string, unknown>, '');
  return result;
}

export { windbreakEn, windbreakIs };
export type { WindbreakTemplateMessages };
