/**
 * Browser entry for the draw page: reads the GeoJSON (parcels + existing
 * windbreaks) and the locale embedded in the page by the NestJS server and
 * mounts the windbreak application template (Phase 2: the custom map field
 * and the flow renderer come from @island.is/windbreak-application, the map
 * itself from @island.is/map).
 */
import { createRoot } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { flattenMessages, messages as mapMessages } from '@island.is/map';
import { flattenMessages as flattenTemplate, messages as templateMessages } from '@island.is/windbreak-application';
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
import { WindbreakApplyPage } from './WindbreakApplyPage';
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

// One flat catalog per locale: app keys + the map lib's map/validation/
// drawLocal namespaces + the template's windbreak.* namespace (same merge
// the server does for locale parity).
const mapLocale = locale === 'is' ? 'is' : 'en';
const catalog: Record<string, string> = {
  ...(mapLocale === 'is' ? appIs : appEn),
  ...flattenMessages(mapMessages[mapLocale]),
  ...flattenTemplate(templateMessages[mapLocale]),
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
    <WindbreakApplyPage locale={locale} parcels={parcels} windbreaks={windbreaks} />
  </IntlProvider>,
);
