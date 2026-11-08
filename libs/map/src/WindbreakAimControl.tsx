import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { linesFromFeatureGroup } from './lines';
import type { WindbreakLine } from './types';

const COARSE_STEP_PX = 14;
const FINE_STEP_PX = 2;

interface WindbreakAimControlProps {
  /** Whether keyboard aim mode is active (owned by the host UI). */
  aiming: boolean;
  /** The drawn-lines group shared with the pointer draw control. */
  featureGroup: L.FeatureGroup;
  onLinesChange: (lines: WindbreakLine[]) => void;
  /** Ask the host to leave aim mode (Escape or after finishing a line). */
  onExit: () => void;
  /** Exposes the "finish line" action to the host's external button. */
  finishRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Keyboard-only line input ("aim and shoot"), controlled by the host UI's
 * button outside the map. While aiming, the map's pointer controls are
 * hidden and its mouse handlers disabled: the crosshair is fixed at the
 * map centre, arrow keys pan the world under it, +/- zoom, and Enter/Space
 * places a point. Placed lines are written into the same feature group as
 * pointer drawing, so validation and the red/green styling are unchanged.
 */
export function WindbreakAimControl({
  aiming,
  featureGroup,
  onLinesChange,
  onExit,
  finishRef,
}: WindbreakAimControlProps) {
  const map = useMap();
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;

  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [status, setStatus] = useState('');
  const pointsRef = useRef<L.LatLng[]>(points);
  pointsRef.current = points;
  const previewRef = useRef<L.Polyline | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  // Hold-to-zoom (z/x) drives its own timer; the browser's key auto-repeat
  // is ignored so the speed is consistent. Double-tapping space finishes
  // the line (like a double-click with the pointer).
  const zoomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoomTargetRef = useRef(0);
  const lastSpaceAtRef = useRef(0);
  const DOUBLE_SPACE_MS = 400;

  const f = useCallback(
    (id: string, values?: Record<string, string | number>): string =>
      intlRef.current.formatMessage({ id }, values),
    [],
  );

  const clearPreview = useCallback(() => {
    previewRef.current?.remove();
    previewRef.current = null;
    pointsRef.current = [];
    setPoints([]);
  }, []);

  const placePoint = useCallback(() => {
    // The crosshair is fixed at the map centre; "firing" places a point
    // there while the map is panned underneath it.
    const latlng = map.getCenter();
    const next = [...pointsRef.current, latlng];
    pointsRef.current = next;
    setPoints(next);
    if (!previewRef.current) {
      previewRef.current = L.polyline(next, {
        color: '#2e7d32',
        weight: 3,
        dashArray: '6 6',
        opacity: 0.9,
        interactive: false,
      }).addTo(map);
    } else {
      previewRef.current.setLatLngs(next);
    }
    setStatus(
      f('map.aimPointPlaced', {
        n: next.length,
        lat: latlng.lat.toFixed(4),
        lon: latlng.lng.toFixed(4),
      }),
    );
  }, [map, f]);

  const undo = useCallback(() => {
    const next = pointsRef.current.slice(0, -1);
    pointsRef.current = next;
    setPoints(next);
    previewRef.current?.setLatLngs(next);
    setStatus(f('map.aimUndone'));
  }, [f]);

  const finish = useCallback(() => {
    if (pointsRef.current.length < 2) {
      setStatus(f('map.aimNeedPoints'));
      return;
    }
    const line = L.polyline(pointsRef.current, {
      color: '#2e7d32',
      weight: 4,
      opacity: 0.9,
    });
    featureGroup.addLayer(line);
    onLinesChange(linesFromFeatureGroup(featureGroup));
    setStatus(f('map.aimFinished'));
    clearPreview();
    exitRef.current();
  }, [featureGroup, onLinesChange, f, clearPreview]);
  if (finishRef) {
    finishRef.current = finish;
  }

  // Entering aim mode: disable the map's pointer/keyboard handlers (the
  // pointer controls are also hidden by CSS while `.aiming`), put focus on
  // the map and announce the key map.
  useEffect(() => {
    if (!aiming) {
      return;
    }
    const container = map.getContainer();
    // Leaflet's tap handler exists only on touch devices and is not in the
    // Map typings.
    const tap = (
      map as unknown as {
        tap?: { enable: () => void; disable: () => void };
      }
    ).tap;
    map.keyboard.disable();
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    tap?.disable();
    container.style.cursor = 'crosshair';
    zoomTargetRef.current = map.getZoom();
    lastSpaceAtRef.current = 0;
    setStatus(f('map.aimInstructions'));
    container.focus();
    return () => {
      container.style.cursor = '';
      map.keyboard.enable();
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      tap?.enable();
      // Keep double-click zoom off (finishing a line must not zoom).
      map.doubleClickZoom.disable();
    };
  }, [aiming, map, f]);

  // Clear a half-drawn preview whenever aim mode ends or on unmount.
  useEffect(() => {
    if (!aiming) {
      clearPreview();
      return;
    }
    return () => {
      clearPreview();
    };
  }, [aiming, clearPreview]);

  const stopZoomHold = useCallback(() => {
    if (zoomTimerRef.current !== null) {
      clearInterval(zoomTimerRef.current);
      zoomTimerRef.current = null;
      setStatus(f('map.aimZoom', { zoom: zoomTargetRef.current }));
    }
  }, [f]);

  const startZoomHold = useCallback(
    (delta: number) => {
      if (zoomTimerRef.current !== null) {
        return;
      }
      const stepZoom = () => {
        const min = map.getMinZoom();
        const max = map.getMaxZoom();
        const next = Math.min(
          Number.isFinite(max) ? max : Infinity,
          Math.max(
            Number.isFinite(min) ? min : -Infinity,
            zoomTargetRef.current + delta,
          ),
        );
        zoomTargetRef.current = next;
        map.setZoom(next);
      };
      stepZoom();
      zoomTimerRef.current = setInterval(stepZoom, 180);
    },
    [map],
  );

  const handleSpace = useCallback(() => {
    const now = Date.now();
    if (now - lastSpaceAtRef.current <= DOUBLE_SPACE_MS) {
      // The second tap of a double-tap: finish at the last placed point.
      lastSpaceAtRef.current = 0;
      finish();
      return;
    }
    lastSpaceAtRef.current = now;
    placePoint();
  }, [finish, placePoint]);

  // Keyboard handling while aiming: arrows pan the map under the fixed
  // crosshair, z/x zoom (hold to keep zooming), space places a point and a
  // double-tap of space finishes the line, Enter places a point, Backspace
  // undoes, Escape cancels.
  useEffect(() => {
    if (!aiming) {
      return;
    }
    const container = map.getContainer();
    const onKey = (event: KeyboardEvent) => {
      // Escape always leaves aim mode, whatever has focus.
      if (event.key === 'Escape') {
        setStatus(f('map.aimCancelled'));
        exitRef.current();
        event.preventDefault();
        return;
      }
      if (event.target !== container) {
        return;
      }
      const step = event.shiftKey ? FINE_STEP_PX : COARSE_STEP_PX;
      // Pan the map under the fixed crosshair (scope metaphor): the
      // crosshair never moves, the world does.
      const pan = (dx: number, dy: number) =>
        map.panBy([dx, dy], { animate: false });
      if (event.repeat) {
        // Holding z/x is driven by the zoom timer; holding space/enter must
        // not place a stream of points (and must not scroll the page).
        event.preventDefault();
        return;
      }
      switch (event.key) {
        case 'z':
        case 'Z':
          startZoomHold(1);
          break;
        case 'x':
        case 'X':
          startZoomHold(-1);
          break;
        case 'ArrowUp':
          // panBy moves the view opposite to the offset: +y pans south.
          pan(0, -step);
          break;
        case 'ArrowDown':
          pan(0, step);
          break;
        case 'ArrowLeft':
          pan(-step, 0);
          break;
        case 'ArrowRight':
          pan(step, 0);
          break;
        case ' ':
          handleSpace();
          break;
        case 'Enter':
          placePoint();
          break;
        case 'Backspace':
          undo();
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === 'z' ||
        event.key === 'Z' ||
        event.key === 'x' ||
        event.key === 'X'
      ) {
        stopZoomHold();
      }
    };
    container.addEventListener('keydown', onKey);
    container.addEventListener('keyup', onKeyUp);
    return () => {
      container.removeEventListener('keydown', onKey);
      container.removeEventListener('keyup', onKeyUp);
      stopZoomHold();
    };
  }, [aiming, map, placePoint, undo, f, startZoomHold, stopZoomHold, handleSpace]);

  return (
    <>
      {aiming && <div className="aim-reticle" aria-hidden="true" />}
      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
