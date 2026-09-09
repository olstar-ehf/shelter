import type { ParcelFeature, WindbreakFeature, WindbreakLine } from './types';
export interface WindbreakMapProps {
    /** The farmer's registered parcels. */
    parcels: ParcelFeature[];
    /** Windbreaks already on the land (established or pending). */
    existingWindbreaks: WindbreakFeature[];
    /**
     * Lines already drawn in this application. Render them read-only when the
     * draw control is not mounted (e.g. the review step), so the map keeps
     * showing what was drawn.
     */
    drawnLines?: WindbreakLine[];
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
export declare function WindbreakMap({ parcels, existingWindbreaks, drawnLines, readOnly, fitToData, legend, initialCenter, initialZoom, height, onLinesChange, }: WindbreakMapProps): import("node_modules/@types/react").JSX.Element | null;
