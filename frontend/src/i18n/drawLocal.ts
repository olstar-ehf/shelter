import { drawLocalEn } from '../messages/en';
import { drawLocalIs } from '../messages/is';
import type { Locale } from './index';

/** leaflet-draw UI strings per locale (applied to L.drawLocal client side). */
export function drawLocalByLocale(locale: Locale): Record<string, unknown> {
  return locale === 'is' ? drawLocalIs : drawLocalEn;
}
