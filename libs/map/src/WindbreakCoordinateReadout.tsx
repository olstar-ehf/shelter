import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/** Decimal places: 1e-7 degrees is about 1.1 cm at Iceland's latitude, so the
 * readout is well within the required 0.1 m accuracy. */
const DECIMALS = 7;

/**
 * Live coordinate readout at the bottom of the map. In camera mode it shows
 * the crosshair position (the map centre, which the camera moves); in
 * pointer mode it follows the mouse over the map. Coordinates are WGS84
 * decimal degrees, matching the coordinate textarea input format.
 */
export function WindbreakCoordinateReadout({
  cameraMode = false,
}: {
  cameraMode?: boolean;
}) {
  const map = useMap();
  const intl = useIntl();
  const [coords, setCoords] = useState<L.LatLng | null>(null);
  const setCoordsIfChanged = (next: L.LatLng) => {
    setCoords((current) =>
      current && current.lat === next.lat && current.lng === next.lng
        ? current
        : next,
    );
  };
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  // Centre tracking: the map fires 'move' on every pan frame, so the
  // readout follows the crosshair while the camera glides.
  useEffect(() => {
    const updateCentre = () => setCoordsIfChanged(map.getCenter());
    updateCentre();
    map.on('move', updateCentre);
    map.on('zoom', updateCentre);
    return () => {
      map.off('move', updateCentre);
      map.off('zoom', updateCentre);
    };
  }, [map]);

  // Pointer tracking (only while the pointer controls are active).
  useEffect(() => {
    let frame: number | null = null;
    let pending: L.LatLng | null = null;
    const flush = () => {
      frame = null;
      if (pending) {
        setCoordsIfChanged(pending);
        pending = null;
      }
    };
    const onMouseMove = (event: L.LeafletMouseEvent) => {
      if (cameraModeRef.current) {
        return;
      }
      pending = event.latlng;
      if (frame === null) {
        frame = requestAnimationFrame(flush);
      }
    };
    const onMouseOut = () => {
      if (!cameraModeRef.current) {
        setCoordsIfChanged(map.getCenter());
      }
    };
    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);
    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseout', onMouseOut);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [map]);

  if (!coords) {
    return null;
  }

  return (
    <div
      className="map-coords"
      aria-label={intl.formatMessage({ id: 'map.coordsLabel' })}
    >
      <span className="map-coords-label">
        {intl.formatMessage({ id: 'map.coordsLabel' })}
      </span>{' '}
      <output className="map-coords-value">
        {coords.lat.toFixed(DECIMALS)}, {coords.lng.toFixed(DECIMALS)}
      </output>
    </div>
  );
}
