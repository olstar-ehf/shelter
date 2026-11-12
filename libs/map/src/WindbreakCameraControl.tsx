import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { linesFromFeatureGroup } from './lines';
import { formatWktLine } from './wkt';
import type { WindbreakLine } from './types';

/** A single key press nudges the map by this many pixels. */
const NUDGE_PX = 14;
const FINE_NUDGE_PX = 2;
/** Camera panning speed while an arrow key is held (pixels per second). */
const PAN_SPEED_PX_PER_S = 320;
/** Fine panning speed with Shift held. */
const FINE_SPEED_PX_PER_S = 90;
/** How often tiles are refreshed during a long held pan (ms). */
const TILE_REFRESH_MS = 250;

interface WindbreakCameraControlProps {
  /** Whether camera mode is active (owned by the host UI). */
  cameraMode: boolean;
  /** The drawn-lines group shared with the pointer draw control. */
  featureGroup: L.FeatureGroup;
  onLinesChange: (lines: WindbreakLine[]) => void;
  /** Ask the host to leave camera mode (Escape). */
  onExit: () => void;
  /** Reports the in-progress line as WKT (null when none). */
  onDraftChange?: (wkt: string | null) => void;
}

/**
 * Keyboard-only line input ("camera mode"), controlled by the host UI's
 * button outside the map. While in camera mode, the map's pointer controls are
 * hidden and its mouse handlers disabled: the crosshair is fixed at the
 * map centre, arrow keys pan the world under it, +/- zoom, and Enter/Space
 * places a point. Placed lines are written into the same feature group as
 * pointer drawing, so validation and the red/green styling are unchanged.
 */
export function WindbreakCameraControl({
  cameraMode,
  featureGroup,
  onLinesChange,
  onExit,
  onDraftChange,
}: WindbreakCameraControlProps) {
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
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const lastDraftAtRef = useRef(0);
  const DRAFT_THROTTLE_MS = 120;
  // Hold-to-zoom (z/x) drives its own timer; the browser's key auto-repeat
  // is ignored so the speed is consistent. Double-tapping space finishes
  // the line (like a double-click with the pointer).
  const zoomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoomTargetRef = useRef(0);
  // Holding an arrow key keeps panning until keyup. The movement runs in a
  // requestAnimationFrame loop with small, time-based steps (like Leaflet's
  // own drag panning), so it glides instead of jumping. Fractional pixels
  // are carried over between frames so the speed is exact.
  const panRafRef = useRef<number | null>(null);
  const heldDirsRef = useRef<Set<string>>(new Set());
  const panSpeedRef = useRef(PAN_SPEED_PX_PER_S);
  const panAccumRef = useRef({ x: 0, y: 0 });
  const lastFrameAtRef = useRef(0);
  const lastTileRefreshRef = useRef(0);
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
    onDraftChangeRef.current?.(null);
  }, []);

  /**
   * Reports the line being drawn (placed points + the crosshair end) as
   * WKT, throttled so the textarea updates without re-rendering the page on
   * every pan frame.
   */
  const emitDraft = useCallback(
    (immediate = false) => {
      const cb = onDraftChangeRef.current;
      if (!cb) {
        return;
      }
      const now = performance.now();
      if (!immediate && now - lastDraftAtRef.current < DRAFT_THROTTLE_MS) {
        return;
      }
      lastDraftAtRef.current = now;
      const placed = pointsRef.current;
      cb(
        placed.length === 0
          ? null
          : formatWktLine([...placed, map.getCenter()]),
      );
    },
    [map],
  );

  /**
   * The provisional (dashed) line: the placed points plus the crosshair
   * position as the current end, so the farmer always sees the segment
   * from the last placed point to where the next point would land.
   */
  const updatePreview = useCallback(() => {
    const placed = pointsRef.current;
    if (placed.length === 0) {
      previewRef.current?.remove();
      previewRef.current = null;
      emitDraft(true);
      return;
    }
    emitDraft();
    const latlngs = [...placed, map.getCenter()];
    if (!previewRef.current) {
      previewRef.current = L.polyline(latlngs, {
        color: '#2e7d32',
        weight: 3,
        dashArray: '6 6',
        opacity: 0.9,
        interactive: false,
      }).addTo(map);
    } else {
      previewRef.current.setLatLngs(latlngs);
    }
  }, [map]);

  const placePoint = useCallback(() => {
    // The crosshair is fixed at the map centre; "firing" places a point
    // there while the map is panned underneath it.
    const latlng = map.getCenter();
    const next = [...pointsRef.current, latlng];
    pointsRef.current = next;
    setPoints(next);
    updatePreview();
    setStatus(
      f('map.cameraPointPlaced', {
        n: next.length,
        // Same 7 decimals as the coordinate readout (about 1 cm), so the
        // spoken coordinate and the visible one cannot disagree.
        lat: latlng.lat.toFixed(7),
        lon: latlng.lng.toFixed(7),
      }),
    );
  }, [map, f, updatePreview]);

  const undo = useCallback(() => {
    const next = pointsRef.current.slice(0, -1);
    pointsRef.current = next;
    setPoints(next);
    updatePreview();
    setStatus(f('map.cameraUndone'));
  }, [f, updatePreview]);

  const finish = useCallback(() => {
    if (pointsRef.current.length < 2) {
      setStatus(f('map.cameraNeedPoints'));
      return;
    }
    const line = L.polyline(pointsRef.current, {
      color: '#2e7d32',
      weight: 4,
      opacity: 0.9,
    });
    featureGroup.addLayer(line);
    onLinesChange(linesFromFeatureGroup(featureGroup));
    setStatus(f('map.cameraFinished'));
    clearPreview();
    // Stay in camera mode so the next line can be drawn immediately.
  }, [featureGroup, onLinesChange, f, clearPreview]);

  // Entering camera mode: disable the map's pointer/keyboard handlers (the
  // pointer controls are also hidden by CSS while `.camera-mode`), put focus on
  // the map and announce the key map.
  useEffect(() => {
    if (!cameraMode) {
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
    stopPan();
    zoomTargetRef.current = map.getZoom();
    lastSpaceAtRef.current = 0;
    // Short announcement: the full key map is the map region's description
    // (and the visible help), so it is not read out twice.
    setStatus(f('map.cameraModeOn'));
    // Do not scroll the page to the map: the switch is right above it and a
    // scroll would look like a page jump.
    container.focus({ preventScroll: true });
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
  }, [cameraMode, map, f]);

  // Clear a half-drawn preview whenever camera mode ends or on unmount.
  useEffect(() => {
    if (!cameraMode) {
      clearPreview();
      return;
    }
    return () => {
      clearPreview();
    };
  }, [cameraMode, clearPreview]);

  /** Moves the map without firing a full moveend on every frame. */
  const rawPan = useCallback(
    (dx: number, dy: number) => {
      const internals = map as unknown as {
        _rawPanBy?: (offset: L.Point) => void;
      };
      if (typeof internals._rawPanBy === 'function') {
        internals._rawPanBy(L.point(dx, dy));
        map.fire('move');
      } else {
        map.panBy([dx, dy], { animate: false });
      }
    },
    [map],
  );

  const stopPan = useCallback(() => {
    if (panRafRef.current !== null) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = null;
      // Let the tile layer catch up with the final position.
      map.fire('moveend');
    }
    heldDirsRef.current.clear();
    panAccumRef.current = { x: 0, y: 0 };
  }, [map]);

  const panFrame = useCallback(
    (now: number) => {
      const last = lastFrameAtRef.current || now;
      const dt = Math.min((now - last) / 1000, 0.1);
      lastFrameAtRef.current = now;

      const dirX =
        (heldDirsRef.current.has('ArrowRight') ? 1 : 0) -
        (heldDirsRef.current.has('ArrowLeft') ? 1 : 0);
      const dirY =
        (heldDirsRef.current.has('ArrowDown') ? 1 : 0) -
        (heldDirsRef.current.has('ArrowUp') ? 1 : 0);

      if (dirX === 0 && dirY === 0) {
        stopPan();
        return;
      }

      // Diagonal movement must not be faster than straight movement.
      const normalise = dirX !== 0 && dirY !== 0 ? Math.SQRT1_2 : 1;
      const distance = panSpeedRef.current * dt * normalise;
      panAccumRef.current.x += dirX * distance;
      panAccumRef.current.y += dirY * distance;
      const stepX = Math.trunc(panAccumRef.current.x);
      const stepY = Math.trunc(panAccumRef.current.y);
      panAccumRef.current.x -= stepX;
      panAccumRef.current.y -= stepY;

      if (stepX !== 0 || stepY !== 0) {
        rawPan(stepX, stepY);
        if (pointsRef.current.length > 0) {
          updatePreview();
        }
      }

      // Refresh the tiles a few times per second during long pans; firing
      // moveend on every frame would churn the tile layer.
      if (now - lastTileRefreshRef.current > TILE_REFRESH_MS) {
        lastTileRefreshRef.current = now;
        map.fire('moveend');
      }
      panRafRef.current = requestAnimationFrame(panFrame);
    },
    [map, rawPan, stopPan, updatePreview],
  );

  const startPan = useCallback(
    (key: string, speed: number, fine: boolean) => {
      heldDirsRef.current.add(key);
      panSpeedRef.current = speed;
      // The first press moves immediately, so a quick tap is still a nudge
      // (a key released before the next animation frame would not move at
      // all otherwise).
      const nudge = fine ? FINE_NUDGE_PX : NUDGE_PX;
      const dx =
        key === 'ArrowRight' ? nudge : key === 'ArrowLeft' ? -nudge : 0;
      const dy = key === 'ArrowDown' ? nudge : key === 'ArrowUp' ? -nudge : 0;
      if (dx !== 0 || dy !== 0) {
        map.panBy([dx, dy], { animate: false });
        if (pointsRef.current.length > 0) {
          updatePreview();
        }
      }
      if (panRafRef.current === null) {
        lastFrameAtRef.current = 0;
        lastTileRefreshRef.current = 0;
        panAccumRef.current = { x: 0, y: 0 };
        panRafRef.current = requestAnimationFrame(panFrame);
      }
    },
    [panFrame, updatePreview],
  );

  const stopZoomHold = useCallback(() => {
    if (zoomTimerRef.current !== null) {
      clearInterval(zoomTimerRef.current);
      zoomTimerRef.current = null;
      setStatus(f('map.cameraZoom', { zoom: zoomTargetRef.current }));
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

  // Keyboard handling while cameraMode: arrows pan the map under the fixed
  // crosshair, z/x zoom (hold to keep zooming), space places a point and a
  // double-tap of space finishes the line, Enter places a point, Backspace
  // undoes, Escape cancels.
  useEffect(() => {
    if (!cameraMode) {
      return;
    }
    const container = map.getContainer();
    const onKey = (event: KeyboardEvent) => {
      // Escape always leaves camera mode, whatever has focus.
      if (event.key === 'Escape') {
        setStatus(f('map.cameraCancelled'));
        exitRef.current();
        event.preventDefault();
        return;
      }
      // Keys go to the camera wherever focus is - except when the user is
      // typing in a field or activating another control (coordinate box,
      // table rows, buttons, links, the camera toggle itself).
      const target = event.target as HTMLElement | null;
      const otherControl = target?.closest(
        'button, a, input, textarea, select, summary, [contenteditable="true"], [role="button"], tr[tabindex]',
      );
      if (otherControl) {
        return;
      }
      panSpeedRef.current = event.shiftKey
        ? FINE_SPEED_PX_PER_S
        : PAN_SPEED_PX_PER_S;
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
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          startPan(
            event.key,
            event.shiftKey ? FINE_SPEED_PX_PER_S : PAN_SPEED_PX_PER_S,
            event.shiftKey,
          );
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
      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
      ) {
        heldDirsRef.current.delete(event.key);
        if (heldDirsRef.current.size === 0) {
          stopPan();
        }
      }
    };
    // Re-focus the map when the pointer comes back to it (e.g. after using
    // the coordinate box), so drawing can continue without a click.
    const focusMap = () => container.focus({ preventScroll: true });
    container.addEventListener('mouseenter', focusMap);
    container.addEventListener('pointerdown', focusMap);
    // Listen on the document: after scrolling or using another control,
    // focus may no longer be inside the map, but camera mode is still on.
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      container.removeEventListener('mouseenter', focusMap);
      container.removeEventListener('pointerdown', focusMap);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKeyUp);
      stopZoomHold();
      stopPan();
    };
  }, [
    cameraMode,
    map,
    placePoint,
    undo,
    f,
    startZoomHold,
    stopZoomHold,
    stopPan,
    handleSpace,
  ]);

  return (
    <>
      {cameraMode && <div className="camera-reticle" aria-hidden="true" />}
      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
