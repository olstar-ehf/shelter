import L from 'leaflet';
import 'leaflet-draw';
import type { WindbreakLine } from './types';
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
export declare function WindbreakDrawControl({ featureGroup, onLinesChange, }: WindbreakDrawControlProps): null;
export {};
