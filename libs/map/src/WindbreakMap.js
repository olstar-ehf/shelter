"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindbreakMap = WindbreakMap;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_intl_1 = require("react-intl");
const react_leaflet_1 = require("react-leaflet");
const leaflet_1 = __importDefault(require("leaflet"));
const WindbreakDrawControl_1 = require("./WindbreakDrawControl");
const WindbreakLegend_1 = require("./WindbreakLegend");
/** Fits the map view to the farmer's parcels, like the prototype did. */
function FitBoundsToData({ parcels }) {
    const map = (0, react_leaflet_1.useMap)();
    (0, react_1.useEffect)(() => {
        if (parcels.length === 0) {
            return;
        }
        const collection = {
            type: 'FeatureCollection',
            features: parcels,
        };
        const bounds = leaflet_1.default.geoJSON(collection).getBounds();
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
function DrawnLinesLayer({ layer }) {
    const map = (0, react_leaflet_1.useMap)();
    (0, react_1.useEffect)(() => {
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
function WindbreakMap({ parcels, existingWindbreaks, drawnLines, readOnly = false, fitToData = true, legend = true, initialCenter = [64.0, -19.0], initialZoom = 7, height = '480px', onLinesChange, }) {
    const intl = (0, react_intl_1.useIntl)();
    // Created once per mount; L.featureGroup() does not touch the DOM, so it
    // is safe to initialise lazily during render.
    const drawnItemsRef = (0, react_1.useRef)(null);
    if (drawnItemsRef.current === null) {
        drawnItemsRef.current = leaflet_1.default.featureGroup();
    }
    if (typeof window === 'undefined') {
        return null;
    }
    const parcelsCollection = (0, react_1.useMemo)(() => ({
        type: 'FeatureCollection',
        features: parcels,
    }), [parcels]);
    const windbreaksCollection = (0, react_1.useMemo)(() => ({
        type: 'FeatureCollection',
        features: existingWindbreaks,
    }), [existingWindbreaks]);
    const drawnCollection = (0, react_1.useMemo)(() => ({
        type: 'FeatureCollection',
        features: (drawnLines ?? []).map((line) => line.feature),
    }), [drawnLines]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "windbreak-map", children: [(0, jsx_runtime_1.jsxs)(react_leaflet_1.MapContainer, { center: initialCenter, zoom: initialZoom, style: { height, width: '100%' }, 
                // Finishing a line with a double-click must not also zoom the map.
                doubleClickZoom: false, children: [(0, jsx_runtime_1.jsx)(react_leaflet_1.TileLayer, { attribution: '\u00A9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }), (0, jsx_runtime_1.jsx)(react_leaflet_1.GeoJSON, { data: parcelsCollection, style: {
                            color: '#1b5e20',
                            weight: 2,
                            fillColor: '#81c784',
                            fillOpacity: 0.25,
                        }, onEachFeature: (feature, layer) => {
                            const p = (feature.properties ?? {});
                            layer.bindPopup(`<strong>${String(p.parcel_name ?? '')}</strong><br/>${p.area_ha !== undefined ? `${p.area_ha} ha` : ''}${p.crop !== undefined ? ` &middot; ${String(p.crop)}` : ''}`);
                        } }), (0, jsx_runtime_1.jsx)(react_leaflet_1.GeoJSON, { data: windbreaksCollection, style: (feature) => {
                            const status = feature?.properties
                                ?.status;
                            return status === 'established'
                                ? { color: '#14532d', weight: 5, opacity: 0.9 }
                                : { color: '#e65100', weight: 3, opacity: 0.9, dashArray: '8 6' };
                        }, onEachFeature: (feature, layer) => {
                            const p = (feature.properties ?? {});
                            const status = String(p.status ?? '');
                            const label = status === 'established'
                                ? p.planted_year !== undefined
                                    ? intl.formatMessage({ id: 'map.popupEstablishedPlanted' }, { year: String(p.planted_year) })
                                    : intl.formatMessage({ id: 'map.popupEstablished' })
                                : intl.formatMessage({ id: 'map.popupPending' }, { applicationId: String(p.application_id ?? '?') });
                            layer.bindPopup(`<strong>${label}</strong><br/>${String(p.line_id ?? '')}`);
                        } }), drawnCollection.features.length > 0 && ((0, jsx_runtime_1.jsx)(react_leaflet_1.GeoJSON, { data: drawnCollection, style: { color: '#2e7d32', weight: 4, opacity: 0.9 } })), (0, jsx_runtime_1.jsx)(DrawnLinesLayer, { layer: drawnItemsRef.current }), !readOnly && onLinesChange && ((0, jsx_runtime_1.jsx)(WindbreakDrawControl_1.WindbreakDrawControl, { featureGroup: drawnItemsRef.current, onLinesChange: onLinesChange })), fitToData && (0, jsx_runtime_1.jsx)(FitBoundsToData, { parcels: parcels })] }), legend && (0, jsx_runtime_1.jsx)(WindbreakLegend_1.WindbreakLegend, {})] }));
}
