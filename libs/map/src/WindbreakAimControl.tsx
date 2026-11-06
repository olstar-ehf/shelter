import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { linesFromFeatureGroup } from './lines';
import type { WindbreakLine } from './types';

const COARSE_STEP_PX = 14;
const FINE_STEP_PX = 2;

interface WindbreakAimControlProps {
  /** The drawn-lines group shared with the pointer draw control. */
  featureGroup: L.FeatureGroup;
  onLinesChange: (lines: WindbreakLine[]) => void;
}

/**
 * Keyboard-only line input ("aim and shoot"): a crosshair that is moved
 * with the arrow keys over the map and placed with Enter/Space, so the
 * windbreak can be drawn without a pointer. The crosshair is a neutral
 * reticle; all feedback is also announced through a live region for screen
 * readers. Placed lines are written into the same feature group as pointer
 * drawing, so validation and the red/green styling work unchanged.
 */
export function WindbreakAimControl({
  featureGroup,
  onLinesChange,
}: WindbreakAimControlProps) {
  const map = useMap();
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;

  const [aiming, setAiming] = useState(false);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [status, setStatus] = useState('');
  const pointsRef = useRef<L.LatLng[]>(points);
  pointsRef.current = points;
  const previewRef = useRef<L.Polyline | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const finishRef = useRef<() => void>(() => undefined);

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

  const exitAim = useCallback(
    (messageId: string) => {
      clearPreview();
      setAiming(false);
      setStatus(f(messageId));
      toggleRef.current?.focus();
    },
    [clearPreview, f],
  );

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
    exitAim('map.aimFinished');
  }, [featureGroup, onLinesChange, exitAim, f]);
  finishRef.current = finish;

  // Entering aim mode: remember the crosshair start (map centre), disable
  // Leaflet's arrow-key panning and put focus on the map so keys arrive.
  useEffect(() => {
    if (!aiming) {
      return;
    }
    const container = map.getContainer();
    map.keyboard.disable();
    setStatus(f('map.aimInstructions'));
    container.focus();
    return () => {
      map.keyboard.enable();
    };
  }, [aiming, map, f]);

  // Keyboard handling while aiming: arrows pan the map under the fixed
  // crosshair, + / - zoom, Enter/Space places a point, Backspace undoes,
  // Escape cancels.
  useEffect(() => {
    if (!aiming) {
      return;
    }
    const container = map.getContainer();
    const onKey = (event: KeyboardEvent) => {
      // Escape always leaves aim mode, whatever has focus.
      if (event.key === 'Escape') {
        exitAim('map.aimCancelled');
        event.preventDefault();
        return;
      }
      // Let focused map controls (zoom buttons, draw toolbar) handle their
      // own keys - otherwise Enter/Space would fire a point instead.
      if (event.target !== container) {
        return;
      }
      const step = event.shiftKey ? FINE_STEP_PX : COARSE_STEP_PX;
      // Pan the map under the fixed crosshair (scope metaphor): the
      // crosshair never moves, the world does.
      const pan = (dx: number, dy: number) =>
        map.panBy([dx, dy], { animate: false });
      // getZoom() updates only after the zoom animation; announce the
      // clamped target level instead of the current one.
      const nextZoom = (delta: number): number => {
        const min = map.getMinZoom();
        const max = map.getMaxZoom();
        return Math.min(
          Number.isFinite(max) ? max : Infinity,
          Math.max(
            Number.isFinite(min) ? min : -Infinity,
            map.getZoom() + delta,
          ),
        );
      };
      switch (event.key) {
        case '+':
        case '=':
        case 'Add': {
          const target = nextZoom(1);
          map.setZoom(target);
          setStatus(f('map.aimZoom', { zoom: target }));
          break;
        }
        case '-':
        case '_':
        case 'Subtract': {
          const target = nextZoom(-1);
          map.setZoom(target);
          setStatus(f('map.aimZoom', { zoom: target }));
          break;
        }
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
        case 'Enter':
        case ' ':
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
    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
    };
  }, [aiming, map, placePoint, undo, exitAim]);

  // Clean up a half-drawn preview when the control unmounts.
  useEffect(
    () => () => {
      previewRef.current?.remove();
      previewRef.current = null;
    },
    [],
  );

  const toggle = () => {
    if (aiming) {
      exitAim('map.aimCancelled');
    } else {
      setAiming(true);
    }
  };

  return (
    <>
      <div className="leaflet-top leaflet-left aim-control">
        <div className="leaflet-control">
          <button
            ref={toggleRef}
            type="button"
            className="aim-toggle"
            aria-pressed={aiming}
            onClick={toggle}
          >
            {f(aiming ? 'map.aimToggleOff' : 'map.aimToggle')}
          </button>
          {aiming && (
            <button
              type="button"
              className="aim-finish"
              onClick={() => finishRef.current()}
            >
              {f('map.aimFinish')}
            </button>
          )}
        </div>
      </div>

      {aiming && (
        <>
          <div className="aim-instructions" aria-hidden="true">
            {f('map.aimInstructions')}
          </div>
          <div className="aim-reticle" aria-hidden="true" />
        </>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
