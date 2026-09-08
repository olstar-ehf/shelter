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
  ValidatedLine,
  Validation,
  WindbreakFeature,
  WindbreakLine,
  WindbreakValidationContext,
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
 * Whether the whole line lies within the (multi)polygon. Sampled via
 * vertices + segment midpoints because @turf/boolean-contains cannot handle
 * MultiPolygon containers (it throws).
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
 * Whether two windbreaks conflict (cross, touch or overlap). lineB may be a
 * MultiLineString (skograekt.skjolbelti stores those); each part is checked.
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

/**
 * A windbreak is acceptable when it is long enough, lies entirely within the
 * farmer's land, and does not cross or touch any other windbreak
 * (established, pending, or drawn in the same application).
 */
export function validateLine(
  line: WindbreakLine,
  union: Feature<Polygon | MultiPolygon> | null,
  context: WindbreakValidationContext,
  otherLines: WindbreakLine[],
): Validation {
  const coordinates = line.feature.geometry.coordinates;
  if (coordinates.length < 2) {
    return { status: 'error', messageId: 'validation.minPoints' };
  }
  if (line.lengthM < MIN_LENGTH_M) {
    return {
      status: 'error',
      messageId: 'validation.tooShort',
      values: { length: Math.round(line.lengthM), min: MIN_LENGTH_M },
    };
  }
  if (!union || !lineContainedIn(union, line.feature)) {
    return { status: 'error', messageId: 'validation.outsideLand' };
  }

  const crossedExisting = context.existingWindbreaks.find((windbreak) =>
    linesConflict(line.feature, windbreak),
  );
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

  const crossedDrawn = otherLines.find((other) =>
    linesConflict(line.feature, other.feature),
  );
  if (crossedDrawn) {
    return { status: 'error', messageId: 'validation.crossesDrawn' };
  }

  const parcelId =
    context.parcels.find((parcel) => lineContainedIn(parcel, line.feature))
      ?.properties.parcel_id ?? null;
  return { status: 'ok', parcelId };
}

/** Validate a whole application: each line against the context + the others. */
export function validateWindbreakLines(
  lines: WindbreakLine[],
  context: WindbreakValidationContext,
): ValidatedLine[] {
  const union = landUnion(context.parcels);
  return lines.map((line) => ({
    line,
    validation: validateLine(
      line,
      union,
      context,
      lines.filter((other) => other.clientId !== line.clientId),
    ),
  }));
}
