"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useWindbreakValidation = useWindbreakValidation;
const react_1 = require("react");
const geometry_1 = require("./geometry");
/**
 * Validate all drawn lines against the farmer's land and existing
 * windbreaks (island.is-style: errors come back as message ids to format
 * with react-intl).
 */
function useWindbreakValidation(lines, parcels, existingWindbreaks) {
    return (0, react_1.useMemo)(() => (0, geometry_1.validateWindbreakLines)(lines, { parcels, existingWindbreaks }), [lines, parcels, existingWindbreaks]);
}
