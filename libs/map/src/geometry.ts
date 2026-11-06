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

/* ------------------------------------------------------------------ */
/* Coordinate input (the non-pointer fallback for the draw step)      */
/* ------------------------------------------------------------------ */

export interface CoordinatePoint {
  /** Longitude in WGS84 (EPSG:4326). */
  lon: number;
  /** Latitude in WGS84 (EPSG:4326). */
  lat: number;
}

export type CoordinateParseError = 'map.coordsInvalid' | 'map.coordsTooFew';

export interface CoordinateParseResult {
  /** One entry per windbreak line, in input order. */
  lines: Array<{ points: CoordinatePoint[] }>;
  /** Message id of the failure, when the input could not be used. */
  error?: CoordinateParseError;
}

const PAIR_TOKEN = /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/;
const PAIR_LINE = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

function inRange(point: CoordinatePoint): boolean {
  return Math.abs(point.lon) <= 180 && Math.abs(point.lat) <= 90;
}

/**
 * Parse coordinates typed or pasted by the farmer. Two formats are
 * accepted (WGS84):
 *
 *   LINESTRING (-21.80 65.48, -21.79 65.48)     (WKT; MULTILINESTRING too)
 *   -21.80,65.48                                (one "lon,lat" pair per
 *   -21.79,65.48                                 line; a blank line starts
 *                                                a new windbreak)
 *
 * Returns the parsed lines, or the message id of the error.
 */
export function parseCoordinateLines(text: string): CoordinateParseResult {
  const input = (text ?? '').trim();
  if (input === '') {
    return { lines: [], error: 'map.coordsInvalid' };
  }

  const parsed: Array<{ points: CoordinatePoint[] }> = [];

  const parsePairTokens = (body: string): CoordinatePoint[] | null => {
    const points: CoordinatePoint[] = [];
    for (const token of body.split(',')) {
      const pair = token.trim().match(PAIR_TOKEN);
      if (!pair) {
        return null;
      }
      const point = { lon: Number(pair[1]), lat: Number(pair[2]) };
      if (!inRange(point)) {
        return null;
      }
      points.push(point);
    }
    return points;
  };

  if (/MULTILINESTRING/i.test(input)) {
    // Each part of the multi-geometry is one windbreak line; split the
    // parts on the parenthesis separators, then parse the pairs.
    const multi = /MULTILINESTRING\s*\(\(([\s\S]*?)\)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = multi.exec(input)) !== null) {
      for (const part of match[1].split(/\)\s*,\s*\(/)) {
        const points = parsePairTokens(part);
        if (!points) {
          return { lines: [], error: 'map.coordsInvalid' };
        }
        parsed.push({ points });
      }
    }
    if (parsed.length === 0) {
      return { lines: [], error: 'map.coordsInvalid' };
    }
  } else if (/LINESTRING/i.test(input)) {
    const wkt = /LINESTRING\s*\(([^)]*)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = wkt.exec(input)) !== null) {
      const points = parsePairTokens(match[1]);
      if (!points) {
        return { lines: [], error: 'map.coordsInvalid' };
      }
      parsed.push({ points });
    }
    if (parsed.length === 0) {
      return { lines: [], error: 'map.coordsInvalid' };
    }
  } else {
    // Blank lines separate windbreak lines; each other line is one point.
    for (const block of input.split(/\n\s*\n/)) {
      const points: CoordinatePoint[] = [];
      for (const rawLine of block.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === '') {
          continue;
        }
        const pair = line.match(PAIR_LINE);
        if (!pair) {
          return { lines: [], error: 'map.coordsInvalid' };
        }
        const point = { lon: Number(pair[1]), lat: Number(pair[2]) };
        if (!inRange(point)) {
          return { lines: [], error: 'map.coordsInvalid' };
        }
        points.push(point);
      }
      if (points.length > 0) {
        parsed.push({ points });
      }
    }
    if (parsed.length === 0) {
      return { lines: [], error: 'map.coordsInvalid' };
    }
  }

  if (parsed.some((line) => line.points.length < 2)) {
    return { lines: [], error: 'map.coordsTooFew' };
  }
  return { lines: parsed };
}
