import { useEffect, useMemo, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import { measureLineM } from './geometry';
import { messages, type Locale } from './messages';
import type { WindbreakLine } from './types';

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

interface WindbreakDrawControlProps {
  /**
   * Feature group that holds the drawn lines. Owned by WindbreakMap so the
   * lines stay on the map while this control is unmounted (read-only step).
   */
  featureGroup: L.FeatureGroup;
  /** Report the drawn lines (GeoJSON + length) on every change. */
  onLinesChange: (lines: WindbreakLine[]) => void;
}

/**
 * Imperative leaflet-draw polyline control inside a react-leaflet map.
 * Only polyline drawing is enabled; edit/delete of the drawn lines is
 * allowed while the control is mounted.
 */
export function WindbreakDrawControl({
  featureGroup,
  onLinesChange,
}: WindbreakDrawControlProps) {
  const map = useMap();
  const intl = useIntl();
  const onLinesChangeRef = useRef(onLinesChange);
  onLinesChangeRef.current = onLinesChange;

  const drawLocal = useMemo(() => {
    const locale: Locale = intl.locale === 'is' ? 'is' : 'en';
    return messages[locale].drawLocal as unknown as Record<string, unknown>;
  }, [intl.locale]);

  useEffect(() => {
    const drawApi = L as unknown as LeafletDrawApi;
    // leaflet-draw's own UI strings, from the active locale's catalog.
    (L as unknown as { drawLocal: Record<string, unknown> }).drawLocal =
      drawLocal;

    const emit = () => {
      const lines: WindbreakLine[] = [];
      featureGroup.eachLayer((layer) => {
        const anyLayer = layer as unknown as {
          _leaflet_id?: number;
          toGeoJSON: () => import('geojson').Feature;
        };
        const feature = anyLayer.toGeoJSON() as import('geojson').Feature;
        if (!feature || feature.geometry?.type !== 'LineString') {
          return;
        }
        const lineFeature = feature as import('geojson').Feature<
          import('geojson').LineString,
          Record<string, unknown>
        >;
        lines.push({
          clientId: `line-${anyLayer._leaflet_id ?? lines.length + 1}`,
          feature: lineFeature,
          lengthM: measureLineM(lineFeature),
        });
      });
      onLinesChangeRef.current(lines);
    };

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
      edit: { featureGroup },
    });
    map.addControl(drawControl);

    map.on(drawApi.Draw.Event.CREATED, (event: unknown) => {
      const e = event as { layer: L.Layer };
      featureGroup.addLayer(e.layer);
      emit();
    });
    map.on(drawApi.Draw.Event.EDITED, () => emit());
    map.on(drawApi.Draw.Event.DELETED, () => emit());

    return () => {
      // The feature group is owned by WindbreakMap (DrawnLinesLayer) and
      // stays on the map, so the drawn lines survive read-only toggles.
      map.removeControl(drawControl);
      map.off(drawApi.Draw.Event.CREATED);
      map.off(drawApi.Draw.Event.EDITED);
      map.off(drawApi.Draw.Event.DELETED);
    };
  }, [map, drawLocal, featureGroup]);

  return null;
}
