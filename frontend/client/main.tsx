/**
 * Browser entry for the draw page: reads the GeoJSON (parcels + existing
 * windbreaks) and the locale embedded in the page by the NestJS server and
 * mounts the React draw application (Phase 1: client rendered by
 * @island.is/map's WindbreakMap).
 */
import { createRoot } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import {
  flattenMessages,
  messages as mapMessages,
} from '@island.is/map';
import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Polygon,
} from 'geojson';
import type {
  ParcelFeature,
  ParcelProperties,
  WindbreakFeature,
  WindbreakProperties,
} from '@island.is/map';
import { DrawApplication } from './DrawApplication';
import { en as appEn } from '../src/messages/en';
import { is as appIs } from '../src/messages/is';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../public/styles.css';

function readEmbeddedJson<T>(id: string): T {
  const el = document.getElementById(id);
  if (!el || !el.textContent) {
    throw new Error(`Missing embedded data block: ${id}`);
  }
  return JSON.parse(el.textContent) as T;
}

// Locale chosen server side (query param / cookie / Accept-Language).
const { locale } = readEmbeddedJson<{ locale: string }>('locale-data');
const parcels = readEmbeddedJson<
  FeatureCollection<Polygon, ParcelProperties>
>('parcels-data').features as ParcelFeature[];
const windbreaks = readEmbeddedJson<
  FeatureCollection<LineString | MultiLineString, WindbreakProperties>
>('windbreaks-data').features as WindbreakFeature[];

// One flat catalog per locale: app keys + the lib's map/validation/drawLocal
// namespaces (same merge the server uses for locale parity).
const mapLocale = locale === 'is' ? 'is' : 'en';
const catalog: Record<string, string> = {
  ...(mapLocale === 'is' ? appIs : appEn),
  ...flattenMessages(mapMessages[mapLocale]),
};

const rootEl = document.getElementById('app-root');
if (!rootEl) {
  throw new Error('Draw page root (#app-root) not found');
}

createRoot(rootEl).render(
  <IntlProvider
    locale={locale}
    defaultLocale="is"
    messages={catalog}
    onError={(_err) => {
      // Missing message ids fall back to the id itself; keep the console
      // clean in the prototype.
    }}
  >
    <DrawApplication locale={locale} parcels={parcels} windbreaks={windbreaks} />
  </IntlProvider>,
);
