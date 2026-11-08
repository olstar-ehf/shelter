import { useEffect, useMemo, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import { linesFromFeatureGroup } from './lines';
import { formatWktLine } from './wkt';
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
      DRAWSTART: string;
      DRAWVERTEX: string;
      DRAWSTOP: string;
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
  /** Reports the line being drawn as WKT (null when no line is in progress). */
  onDraftChange?: (wkt: string | null) => void;
}

/**
 * Imperative leaflet-draw polyline control inside a react-leaflet map.
 * Only polyline drawing is enabled - there is no edit/delete toolbar
 * (the trash-can and edit-layer buttons are intentionally absent).
 */
export function WindbreakDrawControl({
  featureGroup,
  onLinesChange,
  onDraftChange,
}: WindbreakDrawControlProps) {
  const map = useMap();
  const intl = useIntl();
  const onLinesChangeRef = useRef(onLinesChange);
  onLinesChangeRef.current = onLinesChange;
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

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
      onLinesChangeRef.current(linesFromFeatureGroup(featureGroup));
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
    });
    map.addControl(drawControl);

    map.on(drawApi.Draw.Event.CREATED, (event: unknown) => {
      const e = event as { layer: L.Layer };
      featureGroup.addLayer(e.layer);
      emit();
    });

    // Live draft of the line being drawn with the mouse: the vertices
    // placed so far plus the current pointer position, as WKT.
    let drawing = false;
    let vertices: L.LatLng[] = [];
    let lastDraftAt = 0;
    const DRAFT_THROTTLE_MS = 120;
    const emitDraft = (pointer?: L.LatLng, immediate = false) => {
      const cb = onDraftChangeRef.current;
      if (!cb) {
        return;
      }
      const now = performance.now();
      if (!immediate && now - lastDraftAt < DRAFT_THROTTLE_MS) {
        return;
      }
      lastDraftAt = now;
      if (!drawing || vertices.length === 0) {
        cb(null);
        return;
      }
      cb(formatWktLine(pointer ? [...vertices, pointer] : vertices));
    };
    const readVertices = (event: unknown): L.LatLng[] => {
      const layers = (event as { layers?: L.LayerGroup }).layers;
      const points: L.LatLng[] = [];
      layers?.eachLayer((layer) => {
        const marker = layer as L.Marker;
        if (typeof marker.getLatLng === 'function') {
          points.push(marker.getLatLng());
        }
      });
      return points;
    };
    const onDrawStart = () => {
      drawing = true;
      vertices = [];
      emitDraft(undefined, true);
    };
    const onDrawVertex = (event: unknown) => {
      vertices = readVertices(event);
      emitDraft();
    };
    const onDrawStop = () => {
      drawing = false;
      vertices = [];
      emitDraft(undefined, true);
    };
    const onMouseMoveDraft = (event: L.LeafletMouseEvent) => {
      if (drawing && vertices.length > 0) {
        emitDraft(event.latlng);
      }
    };
    map.on(drawApi.Draw.Event.DRAWSTART, onDrawStart);
    map.on(drawApi.Draw.Event.DRAWVERTEX, onDrawVertex);
    map.on(drawApi.Draw.Event.DRAWSTOP, onDrawStop);
    map.on(drawApi.Draw.Event.CREATED, onDrawStop);
    map.on('mousemove', onMouseMoveDraft);

    return () => {
      // The feature group is owned by WindbreakMap (DrawnLinesLayer) and
      // stays on the map, so the drawn lines survive read-only toggles.
      map.removeControl(drawControl);
      map.off(drawApi.Draw.Event.CREATED);
      map.off(drawApi.Draw.Event.DRAWSTART, onDrawStart);
      map.off(drawApi.Draw.Event.DRAWVERTEX, onDrawVertex);
      map.off(drawApi.Draw.Event.DRAWSTOP, onDrawStop);
      map.off('mousemove', onMouseMoveDraft);
    };
  }, [map, drawLocal, featureGroup]);

  return null;
}
