"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindbreakDrawControl = WindbreakDrawControl;
const react_1 = require("react");
const react_intl_1 = require("react-intl");
const react_leaflet_1 = require("react-leaflet");
const leaflet_1 = __importDefault(require("leaflet"));
require("leaflet-draw");
const geometry_1 = require("./geometry");
const messages_1 = require("./messages");
/**
 * Imperative leaflet-draw polyline control inside a react-leaflet map.
 * Only polyline drawing is enabled; edit/delete of the drawn lines is
 * allowed while the control is mounted.
 */
function WindbreakDrawControl({ featureGroup, onLinesChange, }) {
    const map = (0, react_leaflet_1.useMap)();
    const intl = (0, react_intl_1.useIntl)();
    const onLinesChangeRef = (0, react_1.useRef)(onLinesChange);
    onLinesChangeRef.current = onLinesChange;
    const drawLocal = (0, react_1.useMemo)(() => {
        const locale = intl.locale === 'is' ? 'is' : 'en';
        return messages_1.messages[locale].drawLocal;
    }, [intl.locale]);
    (0, react_1.useEffect)(() => {
        const drawApi = leaflet_1.default;
        // leaflet-draw's own UI strings, from the active locale's catalog.
        leaflet_1.default.drawLocal =
            drawLocal;
        const emit = () => {
            const lines = [];
            featureGroup.eachLayer((layer) => {
                const anyLayer = layer;
                const feature = anyLayer.toGeoJSON();
                if (!feature || feature.geometry?.type !== 'LineString') {
                    return;
                }
                const lineFeature = feature;
                lines.push({
                    clientId: `line-${anyLayer._leaflet_id ?? lines.length + 1}`,
                    feature: lineFeature,
                    lengthM: (0, geometry_1.measureLineM)(lineFeature),
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
        map.on(drawApi.Draw.Event.CREATED, (event) => {
            const e = event;
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
