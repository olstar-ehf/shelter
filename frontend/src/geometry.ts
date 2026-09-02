import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import turfLength from '@turf/length';
import lineIntersect from '@turf/line-intersect';
import lineOverlap from '@turf/line-overlap';
import turfUnion from '@turf/union';
import type {
  Feature,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';
import type {
  ParcelFeature,
  Validation,
  WindbreakFeature,
  WindbreakLine,
} from './types';

/** Minimum accepted windbreak length (metres). */
export const MIN_LENGTH_M = 10;

/** Merge all of the farmer's parcels into one (multi)polygon. */
export function landUnion(
  parcels: ParcelFeature[],
): Feature<Polygon | MultiPolygon> | null {
  if (parcels.length === 0) {
    return null;
  }
  let union: Feature<Polygon | MultiPolygon> = parcels[0];
  for (const parcel of parcels.slice(1)) {
    const merged = turfUnion(union, parcel);
    if (merged) {
      union = merged;
    }
  }
  return union;
}

/** Length of a GeoJSON line in metres. */
export function measureLineM(line: Feature<LineString>): number {
  return turfLength(line, { units: 'meters' });
}

export function totalLengthM(lines: WindbreakLine[]): number {
  return lines.reduce((sum, line) => sum + line.lengthM, 0);
}

/**
 * Whether the whole line lies within the (multi)polygon.
 *
 * Note: @turf/boolean-contains throws "feature1 MultiPolygon geometry not
 * supported" when the container is a MultiPolygon (which is what landUnion
 * produces for disjoint parcels), so containment is checked by sampling the
 * line's vertices and segment midpoints with booleanPointInPolygon, which
 * supports both Polygon and MultiPolygon containers.
 */
export function lineContainedIn(
  container: Feature<Polygon | MultiPolygon>,
  line: Feature<LineString>,
): boolean {
  const coords = line.geometry.coordinates;
  const samples: Position[] = [...coords];
  for (let i = 0; i < coords.length - 1; i += 1) {
    samples.push([
      (coords[i][0] + coords[i + 1][0]) / 2,
      (coords[i][1] + coords[i + 1][1]) / 2,
    ]);
  }
  return samples.every((coord) =>
    booleanPointInPolygon(point(coord), container, { ignoreBoundary: false }),
  );
}

/**
 * Whether two windbreaks conflict, i.e. they cross, touch or overlap.
 * Pure crossings and touches are found with line-intersect; collinear
 * overlaps need line-overlap (line-intersect returns nothing for those).
 * lineB may be a MultiLineString (skograekt.skjolbelti stores those): each
 * part is checked separately.
 */
export function linesConflict(
  lineA: Feature<LineString>,
  lineB: Feature<LineString | MultiLineString>,
): boolean {
  const parts =
    lineB.geometry.type === 'MultiLineString'
      ? lineB.geometry.coordinates
      : [lineB.geometry.coordinates];
  return parts.some((coordinates) => {
    const part: Feature<LineString> = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {},
    };
    return (
      lineIntersect(lineA, part).features.length > 0 ||
      lineOverlap(lineA, part).features.length > 0
    );
  });
}

export interface ValidationContext {
  union: Feature<Polygon | MultiPolygon> | null;
  parcels: ParcelFeature[];
  /** Windbreaks already on the land (established or pending acceptance). */
  existingWindbreaks: WindbreakFeature[];
  /** Other lines drawn in the current application. */
  otherLines: WindbreakLine[];
}

/**
 * A windbreak is acceptable when it is long enough, lies entirely within the
 * farmer's land (the union of their registered parcels), and does not cross
 * or touch any other windbreak (established, pending, or drawn in this
 * application).
 */
export function validateLine(
  line: WindbreakLine,
  context: ValidationContext,
): Validation {
  const coordinates = line.feature.geometry.coordinates;
  if (coordinates.length < 2) {
    return { status: 'error', reason: 'A windbreak needs at least 2 points.' };
  }
  if (line.lengthM < MIN_LENGTH_M) {
    return {
      status: 'error',
      reason: `Too short: ${Math.round(line.lengthM)} m (minimum ${MIN_LENGTH_M} m).`,
    };
  }
  if (!context.union || !lineContainedIn(context.union, line.feature)) {
    return {
      status: 'error',
      reason: 'Outside your land: draw the windbreak inside your parcels.',
    };
  }

  const crossedExisting = context.existingWindbreaks.find((windbreak) =>
    linesConflict(line.feature, windbreak),
  );
  if (crossedExisting) {
    const statusLabel =
      crossedExisting.properties.status === 'established'
        ? 'established windbreak'
        : `pending application ${crossedExisting.properties.application_id}`;
    return {
      status: 'error',
      reason: `Crosses or touches ${statusLabel} (${crossedExisting.properties.line_id}).`,
    };
  }

  const crossedDrawn = context.otherLines.find((other) =>
    linesConflict(line.feature, other.feature),
  );
  if (crossedDrawn) {
    return {
      status: 'error',
      reason:
        'Crosses or touches another windbreak you are drawing in this application.',
    };
  }

  const parcelId =
    context.parcels.find((parcel) => lineContainedIn(parcel, line.feature))
      ?.properties.parcel_id ?? null;
  return { status: 'ok', parcelId };
}
