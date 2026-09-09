"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_LENGTH_M = void 0;
exports.landUnion = landUnion;
exports.measureLineM = measureLineM;
exports.totalLengthM = totalLengthM;
exports.lineContainedIn = lineContainedIn;
exports.linesConflict = linesConflict;
exports.validateLine = validateLine;
exports.validateWindbreakLines = validateWindbreakLines;
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const helpers_1 = require("@turf/helpers");
const length_1 = __importDefault(require("@turf/length"));
const line_intersect_1 = __importDefault(require("@turf/line-intersect"));
const line_overlap_1 = __importDefault(require("@turf/line-overlap"));
const union_1 = __importDefault(require("@turf/union"));
/** Minimum accepted windbreak length (metres). */
exports.MIN_LENGTH_M = 10;
/** Merge all of the farmer's parcels into one (multi)polygon. */
function landUnion(parcels) {
    if (parcels.length === 0) {
        return null;
    }
    let union = parcels[0];
    for (const parcel of parcels.slice(1)) {
        const merged = (0, union_1.default)(union, parcel);
        if (merged) {
            union = merged;
        }
    }
    return union;
}
/** Length of a GeoJSON line in metres. */
function measureLineM(line) {
    return (0, length_1.default)(line, { units: 'meters' });
}
function totalLengthM(lines) {
    return lines.reduce((sum, line) => sum + line.lengthM, 0);
}
/**
 * Whether the whole line lies within the (multi)polygon. Sampled via
 * vertices + segment midpoints because @turf/boolean-contains cannot handle
 * MultiPolygon containers (it throws).
 */
function lineContainedIn(container, line) {
    const coords = line.geometry.coordinates;
    const samples = [...coords];
    for (let i = 0; i < coords.length - 1; i += 1) {
        samples.push([
            (coords[i][0] + coords[i + 1][0]) / 2,
            (coords[i][1] + coords[i + 1][1]) / 2,
        ]);
    }
    return samples.every((coord) => (0, boolean_point_in_polygon_1.default)((0, helpers_1.point)(coord), container, { ignoreBoundary: false }));
}
/**
 * Whether two windbreaks conflict (cross, touch or overlap). lineB may be a
 * MultiLineString (skograekt.skjolbelti stores those); each part is checked.
 */
function linesConflict(lineA, lineB) {
    const parts = lineB.geometry.type === 'MultiLineString'
        ? lineB.geometry.coordinates
        : [lineB.geometry.coordinates];
    return parts.some((coordinates) => {
        const part = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates },
            properties: {},
        };
        return ((0, line_intersect_1.default)(lineA, part).features.length > 0 ||
            (0, line_overlap_1.default)(lineA, part).features.length > 0);
    });
}
/**
 * A windbreak is acceptable when it is long enough, lies entirely within the
 * farmer's land, and does not cross or touch any other windbreak
 * (established, pending, or drawn in the same application).
 */
function validateLine(line, union, context, otherLines) {
    const coordinates = line.feature.geometry.coordinates;
    if (coordinates.length < 2) {
        return { status: 'error', messageId: 'validation.minPoints' };
    }
    if (line.lengthM < exports.MIN_LENGTH_M) {
        return {
            status: 'error',
            messageId: 'validation.tooShort',
            values: { length: Math.round(line.lengthM), min: exports.MIN_LENGTH_M },
        };
    }
    if (!union || !lineContainedIn(union, line.feature)) {
        return { status: 'error', messageId: 'validation.outsideLand' };
    }
    const crossedExisting = context.existingWindbreaks.find((windbreak) => linesConflict(line.feature, windbreak));
    if (crossedExisting) {
        return crossedExisting.properties.status === 'established'
            ? {
                status: 'error',
                messageId: 'validation.crossesEstablished',
                values: { lineId: crossedExisting.properties.line_id },
            }
            : {
                status: 'error',
                messageId: 'validation.crossesPending',
                values: {
                    applicationId: crossedExisting.properties.application_id ?? '?',
                    lineId: crossedExisting.properties.line_id,
                },
            };
    }
    const crossedDrawn = otherLines.find((other) => linesConflict(line.feature, other.feature));
    if (crossedDrawn) {
        return { status: 'error', messageId: 'validation.crossesDrawn' };
    }
    const parcelId = context.parcels.find((parcel) => lineContainedIn(parcel, line.feature))
        ?.properties.parcel_id ?? null;
    return { status: 'ok', parcelId };
}
/** Validate a whole application: each line against the context + the others. */
function validateWindbreakLines(lines, context) {
    const union = landUnion(context.parcels);
    return lines.map((line) => ({
        line,
        validation: validateLine(line, union, context, lines.filter((other) => other.clientId !== line.clientId)),
    }));
}
