import { en } from '../src/messages/en';
import { is } from '../src/messages/is';

/**
 * island.is-style locale parity test: every locale must contain exactly the
 * same message ids (otherwise untranslated keys would surface in the UI).
 */
describe('locale message parity', () => {
  function keysOf(value: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, child]) =>
      typeof child === 'object' && child !== null
        ? keysOf(child as Record<string, unknown>, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );
  }

  it('is.ts and en.ts have identical message ids', () => {
    const enKeys = keysOf(en).sort();
    const isKeys = keysOf(is).sort();
    expect(isKeys).toEqual(enKeys);
  });
});
