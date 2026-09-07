/**
 * Browser client for the draw page. Loads the GeoJSON (parcels + existing
 * windbreaks) embedded in the page by the NestJS server, shows the Leaflet
 * map with a polyline draw control, validates each drawn line with the same
 * geometry code the server uses, and submits the result to POST /apply.
 */
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../public/styles.css';
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Polygon,
} from 'geojson';
import {
  landUnion,
  measureLineM,
  totalLengthM,
  validateLine,
} from '../src/geometry';
import { createTranslator, type Locale } from '../src/i18n';
import { drawLocalByLocale } from '../src/i18n/drawLocal';
import type {
  ParcelFeature,
  ParcelProperties,
  ValidatedLine,
  WindbreakFeature,
  WindbreakLine,
  WindbreakProperties,
} from '../src/types';

type LeafletDrawApi = typeof import('leaflet') & {
  Control: {
    Draw: new (
      options: Record<string, unknown>,
    ) => import('leaflet').Control;
  };
  Draw: {
    Event: {
      CREATED: string;
      EDITED: string;
      DELETED: string;
    };
  };
};

function readEmbeddedJson<T>(id: string): T {
  const el = document.getElementById(id);
  if (!el || !el.textContent) {
    throw new Error(`Missing embedded data block: ${id}`);
  }
  return JSON.parse(el.textContent) as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Locale chosen server side (query param / cookie / Accept-Language).
const { locale } = readEmbeddedJson<{ locale: Locale }>('locale-data');
const t = createTranslator(locale);

// Translate leaflet-draw's own UI (toolbar buttons, tooltips, edit menus).
(L as unknown as { drawLocal: Record<string, unknown> }).drawLocal =
  drawLocalByLocale(locale);

const parcels = readEmbeddedJson<
  FeatureCollection<Polygon, ParcelProperties>
>('parcels-data').features as ParcelFeature[];
const windbreaks = readEmbeddedJson<
  FeatureCollection<LineString | MultiLineString, WindbreakProperties>
>('windbreaks-data').features as WindbreakFeature[];

const mapContainer = document.getElementById('map');
if (!mapContainer) {
  throw new Error('Map container not found');
}

const union = landUnion(parcels);

const map = L.map(mapContainer, {
  zoomControl: true,
  // Finishing a line with a double-click must not also zoom the map.
  doubleClickZoom: false,
}).setView([63.483055, -18.560724], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// The farmer's registered parcels (read from the OGC API backend).
const parcelLayer = L.geoJSON(
  { type: 'FeatureCollection', features: parcels } as unknown as FeatureCollection,
  {
    style: {
      color: '#1b5e20',
      weight: 2,
      fillColor: '#81c784',
      fillOpacity: 0.25,
    },
    onEachFeature: (feature, layer) => {
      const p = (feature.properties ?? {}) as Record<string, unknown>;
      layer.bindPopup(
        `<strong>${escapeHtml(String(p.parcel_name ?? 'Parcel'))}</strong><br/>${
          p.area_ha !== undefined ? `${p.area_ha} ha` : ''
        }${p.crop !== undefined ? ` &middot; ${escapeHtml(String(p.crop))}` : ''}`,
      );
    },
  },
).addTo(map);

map.fitBounds(parcelLayer.getBounds(), { padding: [24, 24] });

// Windbreaks that already exist on the land. New windbreaks may not cross
// them, so they are shown with a distinct style per status.
L.geoJSON(
  { type: 'FeatureCollection', features: windbreaks } as unknown as FeatureCollection,
  {
    style: (feature) => {
      const status = (feature?.properties as { status?: string } | undefined)
        ?.status;
      return status === 'established'
        ? { color: '#14532d', weight: 5, opacity: 0.9 }
        : { color: '#e65100', weight: 3, opacity: 0.9, dashArray: '8 6' };
    },
    onEachFeature: (feature, layer) => {
      const p = (feature.properties ?? {}) as {
        status?: unknown;
        application_id?: unknown;
        line_id?: unknown;
        planted_year?: unknown;
      };
      const status = String(p.status ?? '');
      const label =
        status === 'established'
          ? p.planted_year !== undefined
            ? t('popupEstablishedPlanted', { year: String(p.planted_year) })
            : t('popupEstablished')
          : t('popupPending', {
              applicationId: String(p.application_id ?? '?'),
            });
      layer.bindPopup(
        `<strong>${escapeHtml(label)}</strong><br/>${escapeHtml(String(p.line_id ?? ''))}`,
      );
    },
  },
).addTo(map);

// Group holding the drawn windbreak lines.
const drawnItems = L.featureGroup().addTo(map);

const drawApi = L as unknown as LeafletDrawApi;

// Only polyline drawing is enabled: the grant application consists of one or
// more windbreak lines.
const drawControl = new drawApi.Control.Draw({
  position: 'topright',
  draw: {
    polygon: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false,
    polyline: {
      shapeOptions: { color: '#2e7d32', weight: 4, opacity: 0.9 },
      metric: true,
      feet: false,
      showLength: true,
    },
  },
  edit: { featureGroup: drawnItems },
});
map.addControl(drawControl);

// ---- state + rendering ----
let currentLines: WindbreakLine[] = [];
let validated: ValidatedLine[] = [];

const collectLines = (): WindbreakLine[] => {
  const lines: WindbreakLine[] = [];
  drawnItems.eachLayer((layer) => {
    const anyLayer = layer as unknown as {
      _leaflet_id?: number;
      toGeoJSON: () => Feature;
    };
    const feature = anyLayer.toGeoJSON() as Feature;
    if (!feature || feature.geometry?.type !== 'LineString') {
      return;
    }
    const lineFeature = feature as Feature<LineString, Record<string, unknown>>;
    lines.push({
      clientId: `line-${anyLayer._leaflet_id ?? lines.length + 1}`,
      feature: lineFeature,
      lengthM: measureLineM(lineFeature),
    });
  });
  return lines;
};

const parcelNameFor = (parcelId: string | null): string => {
  if (!parcelId) {
    return t('spansSeveralParcels');
  }
  return (
    parcels.find((p) => p.properties.parcel_id === parcelId)?.properties
      .parcel_name ?? parcelId
  );
};

const lineCountEl = document.getElementById('line-count');
const linesTableEl = document.getElementById('lines-table');
const linesBodyEl = document.getElementById('lines-body');
const noLinesEl = document.getElementById('no-lines');
const totalLengthEl = document.getElementById('total-length');
const reviewBtn = document.getElementById('review-btn') as HTMLButtonElement;
const reviewPanelEl = document.getElementById('review-panel');
const reviewBodyEl = document.getElementById('review-body');
const reviewTotalEl = document.getElementById('review-total');
const submitErrorEl = document.getElementById('submit-error');
const backBtn = document.getElementById('back-btn');
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

if (
  !lineCountEl || !linesTableEl || !linesBodyEl || !noLinesEl ||
  !totalLengthEl || !reviewBtn || !reviewPanelEl || !reviewBodyEl ||
  !reviewTotalEl || !submitErrorEl || !backBtn || !submitBtn
) {
  throw new Error('Draw page markup is incomplete');
}

function renderSummary(): void {
  validated = currentLines.map((line) => ({
    line,
    validation: validateLine(line, {
      union,
      parcels,
      existingWindbreaks: windbreaks,
      otherLines: currentLines.filter((o) => o.clientId !== line.clientId),
    }),
  }));

  lineCountEl!.textContent = String(currentLines.length);
  linesTableEl!.hidden = currentLines.length === 0;
  noLinesEl!.hidden = currentLines.length > 0;
  totalLengthEl!.textContent = String(Math.round(totalLengthM(currentLines)));

  linesBodyEl!.innerHTML = '';
  validated.forEach((entry, index) => {
    const parcelCell =
      entry.validation.status === 'ok'
        ? escapeHtml(parcelNameFor(entry.validation.parcelId))
        : '—';
    const checkCell =
      entry.validation.status === 'ok'
        ? `<span class="chip chip-ok">${escapeHtml(t('chipInsideLand'))}</span>`
        : `<span class="chip chip-error" title="${escapeHtml(
            t(entry.validation.messageId, entry.validation.values),
          )}">${escapeHtml(
            t(entry.validation.messageId, entry.validation.values),
          )}</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${Math.round(entry.line.lengthM)} m</td>
      <td>${parcelCell}</td>
      <td>${checkCell}</td>`;
    linesBodyEl!.appendChild(tr);
  });

  const allValid =
    validated.length > 0 &&
    validated.every((entry) => entry.validation.status === 'ok');
  reviewBtn.disabled = !allValid;
}

const stepperEl = document.getElementById('stepper');
const stepTitleEl = document.getElementById('step-title');
const drawHelpEl = document.getElementById('draw-help');
const reviewHelpEl = document.getElementById('review-help');

/**
 * Move between steps 2 (draw) and 3 (review): highlight the stepper and
 * swap the heading/help text so it reflects the step the user is on.
 */
function setStep(current: number): void {
  if (stepperEl) {
    stepperEl.querySelectorAll('li[data-step]').forEach((li) => {
      const step = Number(li.getAttribute('data-step'));
      li.classList.toggle('active', step <= current);
    });
  }
  const reviewing = current >= 3;
  if (stepTitleEl) {
    stepTitleEl.textContent = reviewing
      ? t('applyTitleReview')
      : t('applyTitleDraw');
  }
  if (drawHelpEl) {
    drawHelpEl.hidden = reviewing;
  }
  if (reviewHelpEl) {
    reviewHelpEl.hidden = !reviewing;
  }
}

type DrawControlInternal = import('leaflet').Control & {
  _toolbars?: Record<string, { disable: () => void }>;
};

/**
 * In the review step the map is read-only: any active draw/edit session is
 * ended and the draw toolbar is removed. "Back to map" restores it.
 */
function setMapReadOnly(readOnly: boolean): void {
  if (readOnly) {
    const internal = drawControl as DrawControlInternal;
    if (internal._toolbars) {
      Object.values(internal._toolbars).forEach((toolbar) => toolbar.disable());
    }
    map.removeControl(drawControl);
  } else {
    map.addControl(drawControl);
  }
}

reviewBtn.addEventListener('click', () => {
  const validLines = validated.filter(
    (entry) => entry.validation.status === 'ok',
  );
  reviewBodyEl!.innerHTML = '';
  validLines.forEach((entry, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${index + 1}</td><td>${Math.round(entry.line.lengthM)} m</td><td>${
      entry.validation.status === 'ok'
        ? escapeHtml(parcelNameFor(entry.validation.parcelId))
        : '—'
    }</td>`;
    reviewBodyEl!.appendChild(tr);
  });
  reviewTotalEl!.textContent = String(
    Math.round(totalLengthM(validLines.map((entry) => entry.line))),
  );
  submitErrorEl!.hidden = true;
  setStep(3);
  reviewBtn.hidden = true;
  setMapReadOnly(true);
  reviewPanelEl!.hidden = false;
  reviewPanelEl!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

backBtn.addEventListener('click', () => {
  setStep(2);
  reviewBtn.hidden = false;
  setMapReadOnly(false);
  reviewPanelEl!.hidden = true;
});

async function submitApplication(): Promise<void> {
  submitBtn.disabled = true;
  submitErrorEl!.hidden = true;
  try {
    const res = await fetch(`/apply?lang=${encodeURIComponent(locale)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        lines: currentLines.map((line) => line.feature),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { applicationId: string };
      window.location.href = `/submitted/${encodeURIComponent(data.applicationId)}?lang=${encodeURIComponent(locale)}`;
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(data?.message)
      ? data.message.join(' ')
      : (data?.message ?? `${t('submitFailedGeneric')} (HTTP ${res.status}).`);
    submitErrorEl!.textContent = message;
    submitErrorEl!.hidden = false;
  } catch (err) {
    submitErrorEl!.textContent =
      err instanceof Error ? err.message : t('submitFailedGeneric');
    submitErrorEl!.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
}

submitBtn.addEventListener('click', () => {
  void submitApplication();
});

map.on(drawApi.Draw.Event.CREATED, (event: unknown) => {
  const e = event as { layer: L.Layer };
  drawnItems.addLayer(e.layer);
  currentLines = collectLines();
  renderSummary();
});
map.on(drawApi.Draw.Event.EDITED, () => {
  currentLines = collectLines();
  renderSummary();
});
map.on(drawApi.Draw.Event.DELETED, () => {
  currentLines = collectLines();
  renderSummary();
});
