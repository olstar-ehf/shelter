import { useEffect, useMemo, useRef } from 'react';
import { useIntl } from 'react-intl';
import {
  AttributionControl,
  GeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import L from 'leaflet';
import { WindbreakDrawControl } from './WindbreakDrawControl';
import { WindbreakLegend } from './WindbreakLegend';
import type {
  ParcelFeature,
  WindbreakBasemap,
  WindbreakFeature,
  WindbreakLine,
} from './types';

export type { WindbreakBasemap } from './types';

export interface WindbreakMapProps {
  /** The farmer's registered parcels. */
  parcels: ParcelFeature[];
  /** Windbreaks already on the land (established or pending). */
  existingWindbreaks: WindbreakFeature[];
  /**
   * Basemap tile source. When omitted, the map falls back to OpenStreetMap
   * tiles (offline development). The demo supplies the national basemap
   * proxied through our own OGC API service.
   */
  basemap?: WindbreakBasemap;
  /**
   * Lines already drawn in this application. Render them read-only when the
   * draw control is not mounted (e.g. the review step), so the map keeps
   * showing what was drawn.
   */
  drawnLines?: WindbreakLine[];
  /**
   * Validation status per drawn line (by clientId). Lines with status
   * 'error' (outside the land, or crossing/touching an existing windbreak)
   * are drawn red on the map so good and bad lines are distinguishable at
   * a glance; everything else keeps the green drawn-line colour.
   */
  lineStatuses?: Record<string, 'ok' | 'error'>;
  /** Read-only mode hides the draw/edit controls (e.g. review step). */
  readOnly?: boolean;
  /** Fit the view to the parcels once the map is ready (default true). */
  fitToData?: boolean;
  /** Show the built-in legend below the map (default true). */
  legend?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Height of the map container (CSS value). */
  height?: string;
  onLinesChange?: (lines: WindbreakLine[]) => void;
}

/** Fits the map view to the farmer's parcels, like the prototype did. */
function FitBoundsToData({ parcels }: { parcels: ParcelFeature[] }) {
  const map = useMap();
  useEffect(() => {
    if (parcels.length === 0) {
      return;
    }
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: parcels as unknown as Feature[],
    };
    const bounds = L.geoJSON(collection).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [map, parcels]);
  return null;
}

/**
 * Adds the drawn-lines feature group to the map and removes it when the
 * whole map unmounts. The group is owned by WindbreakMap (not the draw
 * control), so the drawn lines stay on the map while the control is
 * unmounted during the read-only review step.
 */
function DrawnLinesLayer({ layer }: { layer: L.FeatureGroup }) {
  const map = useMap();
  useEffect(() => {
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, layer]);
  return null;
}

/**
 * Leaflet map with the farmer's parcels, the existing windbreaks and a
 * windbreak drawing tool.
 *
 * SSR note: this component renders `null` on the server. In a Next.js app,
 * wrap it with `dynamic(() => import('@island.is/map').then(m => m.WindbreakMap), { ssr: false })`
 * (Leaflet needs the browser DOM). The consumer must also import the
 * Leaflet CSS: `leaflet/dist/leaflet.css` and
 * `leaflet-draw/dist/leaflet.draw.css`.
 *
 * Requires an `IntlProvider` above it, configured with this lib's messages
 * (`messages[locale]` from `src/messages`).
 */
export function WindbreakMap({
  parcels,
  existingWindbreaks,
  basemap,
  drawnLines,
  lineStatuses,
  readOnly = false,
  fitToData = true,
  legend = true,
  initialCenter = [64.0, -19.0],
  initialZoom = 7,
  height = '480px',
  onLinesChange,
}: WindbreakMapProps) {
  const intl = useIntl();

  // Created once per mount; L.featureGroup() does not touch the DOM, so it
  // is safe to initialise lazily during render.
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  if (drawnItemsRef.current === null) {
    drawnItemsRef.current = L.featureGroup();
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const parcelsCollection = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: parcels as unknown as Feature[],
    }),
    [parcels],
  );
  const windbreaksCollection = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: existingWindbreaks as unknown as Feature[],
    }),
    [existingWindbreaks],
  );
  const drawnCollection = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: (drawnLines ?? []).map(
        (line) =>
          ({
            ...line.feature,
            // Carry the clientId into the rendered feature so the style
            // function can look the line's validation status up.
            properties: {
              ...(line.feature.properties ?? {}),
              clientId: line.clientId,
            },
          }) as unknown as Feature,
      ),
    }),
    [drawnLines],
  );

  // Valid lines keep the green drawn-line colour; invalid lines (outside
  // the land, or crossing/touching an existing windbreak) render red.
  const drawnStyle = (feature?: Feature) => {
    const clientId = (feature?.properties as { clientId?: string } | undefined)
      ?.clientId;
    if (clientId && lineStatuses?.[clientId] === 'error') {
      return { color: '#b3261e', weight: 4, opacity: 0.9 };
    }
    return { color: '#2e7d32', weight: 4, opacity: 0.9 };
  };

  // The live drawn lines are the leaflet-draw feature group's layers
  // (clientId = `line-<leaflet id>`): recolour them as validation statuses
  // change, so invalid lines turn red the moment the check runs.
  useEffect(() => {
    const group = drawnItemsRef.current;
    if (!group) {
      return;
    }
    group.eachLayer((layer) => {
      const anyLayer = layer as unknown as {
        _leaflet_id?: number;
        setStyle?: (style: { color: string; weight: number; opacity: number }) => unknown;
      };
      if (typeof anyLayer.setStyle !== 'function') {
        return;
      }
      const clientId = `line-${anyLayer._leaflet_id}`;
      anyLayer.setStyle(
        lineStatuses?.[clientId] === 'error'
          ? { color: '#b3261e', weight: 4, opacity: 0.9 }
          : { color: '#2e7d32', weight: 4, opacity: 0.9 },
      );
    });
  }, [lineStatuses, drawnLines]);

  return (
    <div className="windbreak-map">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height, width: '100%' }}
        // Finishing a line with a double-click must not also zoom the map.
        doubleClickZoom={false}
        // Leaflet's default attribution control adds its own "Leaflet" +
        // flag prefix. The BSD license does not require it in the UI (the
        // copyright notice stays in the bundled source), so the control
        // below shows only the map-data attribution.
        attributionControl={false}
      >
        <AttributionControl position="bottomright" prefix={false} />
        {basemap ? (
          <TileLayer
            url={basemap.tileUrl}
            attribution={basemap.attribution}
            maxZoom={basemap.maxZoom ?? 16}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <GeoJSON
          data={parcelsCollection}
          style={{
            color: '#1b5e20',
            weight: 2,
            fillColor: '#81c784',
            fillOpacity: 0.25,
          }}
          onEachFeature={(feature, layer) => {
            const p = (feature.properties ?? {}) as Record<string, unknown>;
            layer.bindPopup(
              `<strong>${String(p.parcel_name ?? '')}</strong><br/>${
                p.area_ha !== undefined ? `${p.area_ha} ha` : ''
              }${p.crop !== undefined ? ` &middot; ${String(p.crop)}` : ''}`,
            );
          }}
        />
        <GeoJSON
          data={windbreaksCollection}
          style={(feature) => {
            const status = (feature?.properties as { status?: string })
              ?.status;
            return status === 'established'
              ? { color: '#14532d', weight: 5, opacity: 0.9 }
              : { color: '#e65100', weight: 3, opacity: 0.9, dashArray: '8 6' };
          }}
          onEachFeature={(feature, layer) => {
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
                  ? intl.formatMessage(
                      { id: 'map.popupEstablishedPlanted' },
                      { year: String(p.planted_year) },
                    )
                  : intl.formatMessage({ id: 'map.popupEstablished' })
                : intl.formatMessage(
                    { id: 'map.popupPending' },
                    { applicationId: String(p.application_id ?? '?') },
                  );
            layer.bindPopup(
              `<strong>${label}</strong><br/>${String(p.line_id ?? '')}`,
            );
          }}
        />
        {drawnCollection.features.length > 0 && (
          <GeoJSON
            // Re-key when validation statuses change so the layer is
            // restyled immediately (red = invalid line, green = valid).
            key={(drawnLines ?? [])
              .map(
                (line) => `${line.clientId}:${lineStatuses?.[line.clientId] ?? 'ok'}`,
              )
              .join('|')}
            data={drawnCollection}
            style={drawnStyle}
          />
        )}
        <DrawnLinesLayer layer={drawnItemsRef.current} />
        {!readOnly && onLinesChange && (
          <WindbreakDrawControl
            featureGroup={drawnItemsRef.current}
            onLinesChange={onLinesChange}
          />
        )}
        {fitToData && <FitBoundsToData parcels={parcels} />}
      </MapContainer>
      {legend && <WindbreakLegend />}
    </div>
  );
}
