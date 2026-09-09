import type { Feature, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { ParcelFeature, ValidatedLine, Validation, WindbreakLine, WindbreakValidationContext } from './types';
/** Minimum accepted windbreak length (metres). */
export declare const MIN_LENGTH_M = 10;
/** Merge all of the farmer's parcels into one (multi)polygon. */
export declare function landUnion(parcels: ParcelFeature[]): Feature<Polygon | MultiPolygon> | null;
/** Length of a GeoJSON line in metres. */
export declare function measureLineM(line: Feature<LineString>): number;
export declare function totalLengthM(lines: WindbreakLine[]): number;
/**
 * Whether the whole line lies within the (multi)polygon. Sampled via
 * vertices + segment midpoints because @turf/boolean-contains cannot handle
 * MultiPolygon containers (it throws).
 */
export declare function lineContainedIn(container: Feature<Polygon | MultiPolygon>, line: Feature<LineString>): boolean;
/**
 * Whether two windbreaks conflict (cross, touch or overlap). lineB may be a
 * MultiLineString (skograekt.skjolbelti stores those); each part is checked.
 */
export declare function linesConflict(lineA: Feature<LineString>, lineB: Feature<LineString | MultiLineString>): boolean;
/**
 * A windbreak is acceptable when it is long enough, lies entirely within the
 * farmer's land, and does not cross or touch any other windbreak
 * (established, pending, or drawn in the same application).
 */
export declare function validateLine(line: WindbreakLine, union: Feature<Polygon | MultiPolygon> | null, context: WindbreakValidationContext, otherLines: WindbreakLine[]): Validation;
/** Validate a whole application: each line against the context + the others. */
export declare function validateWindbreakLines(lines: WindbreakLine[], context: WindbreakValidationContext): ValidatedLine[];
