/**
 * Locale parity: en and is must define the same keys (the island.is rule),
 * and every key must compile as ICU MessageFormat.
 */
import IntlMessageFormat from 'intl-messageformat';
import { flattenMessages, messages, windbreakEn, windbreakIs } from '../src/messages';

describe('template messages', () => {
  it('defines the same keys in both locales', () => {
    const enKeys = Object.keys(flattenMessages(windbreakEn)).sort();
    const isKeys = Object.keys(flattenMessages(windbreakIs)).sort();
    expect(isKeys).toEqual(enKeys);
  });

  it('flattens under the windbreak namespace', () => {
    const flat = flattenMessages(messages.en);
    expect(flat['windbreak.draw.title']).toBe('Draw your windbreak');
    expect(Object.keys(flat).every((k) => k.startsWith('windbreak.'))).toBe(
      true,
    );
  });

  it('compiles as ICU MessageFormat in both locales', () => {
    for (const locale of ['is', 'en'] as const) {
      for (const [key, pattern] of Object.entries(
        flattenMessages(messages[locale]),
      )) {
        expect(() => new IntlMessageFormat(pattern, locale)).not.toThrow();
        void key;
      }
    }
  });

  it('formats the plural help text', () => {
    const format = (locale: 'is' | 'en') => {
      const t = new (class {
        cache = new Map<string, IntlMessageFormat>();
        f(key: string, values?: Record<string, string | number>): string {
          const flat = flattenMessages(messages[locale]);
          let fmt = this.cache.get(key);
          if (!fmt) {
            fmt = new IntlMessageFormat(flat[key], locale);
            this.cache.set(key, fmt);
          }
          return fmt.format(values) as string;
        }
      })();
      return t.f('windbreak.draw.helpExisting', {
        established: t.f('windbreak.draw.countEstablished', { count: 5 }),
        pending: t.f('windbreak.draw.countPending', { count: 1 }),
      });
    };
    expect(format('en')).toContain('5 established windbreaks');
    expect(format('is')).toContain('5 skjólbelti');
  });
});
