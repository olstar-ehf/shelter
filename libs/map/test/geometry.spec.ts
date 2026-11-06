import type { Feature, LineString, MultiLineString, Polygon } from 'geojson';
import {
  landUnion,
  linesConflict,
  parseCoordinateLines,
  validateWindbreakLines,
  MIN_LENGTH_M,
} from '../src/geometry';
import type {
  ParcelFeature,
  WindbreakFeature,
  WindbreakLine,
} from '../src/types';

// A small square parcel around (0, 0).
const squareParcel: ParcelFeature = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
        [-1, 1],
      ],
    ],
  },
  properties: {
    parcel_id: 'P-1',
    parcel_name: 'Square field',
    area_ha: 1,
    land_use: 'arable',
  },
};

const makeLine = (
  coordinates: number[][],
  lengthM: number,
  clientId = 'test',
): WindbreakLine => ({
  clientId,
  feature: {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: {},
  },
  lengthM,
});

const establishedWindbreak: WindbreakFeature = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-0.5, 0.5],
      [0.5, 0.5],
    ],
  },
  properties: { line_id: 'skjolbelti-1', status: 'established' },
};

const pendingWindbreak: WindbreakFeature = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-0.5, -0.8],
      [0.5, -0.8],
    ],
  },
  properties: {
    line_id: 'WB-1',
    application_id: 'WB-APP',
    status: 'pending',
  },
};

describe('landUnion', () => {
  it('returns the parcel itself for a single parcel', () => {
    const union = landUnion([squareParcel]);
    expect(union?.geometry.type).toBe('Polygon');
  });

  it('produces a MultiPolygon for disjoint parcels', () => {
    const other: ParcelFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 1],
            [11, 1],
            [11, 0],
            [10, 0],
            [10, 1],
          ],
        ],
      },
      properties: {
        parcel_id: 'P-2',
        parcel_name: 'Other',
        area_ha: 1,
        land_use: 'arable',
      },
    };
    const union = landUnion([squareParcel, other]);
    expect(union?.geometry.type).toBe('MultiPolygon');
  });
});

describe('linesConflict', () => {
  const drawn: Feature<LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, -0.2],
        [0, 0.8],
      ],
    },
    properties: {},
  };

  it('detects a crossing with a LineString windbreak', () => {
    expect(linesConflict(drawn, establishedWindbreak)).toBe(true);
  });

  it('detects a crossing with a MultiLineString windbreak', () => {
    const multi: WindbreakFeature = {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-0.5, 0.5],
            [0.5, 0.5],
          ],
          [
            [-0.9, -0.9],
            [-0.8, -0.8],
          ],
        ],
      },
      properties: { line_id: 'skjolbelti-2', status: 'established' },
    };
    expect(linesConflict(drawn, multi)).toBe(true);
  });

  it('does not conflict with a distant line', () => {
    expect(linesConflict(drawn, pendingWindbreak)).toBe(false);
  });
});

describe('validateWindbreakLines', () => {
  const context = {
    parcels: [squareParcel],
    existingWindbreaks: [establishedWindbreak, pendingWindbreak],
  };

  it('accepts a line inside the land, clear of windbreaks', () => {
    const result = validateWindbreakLines(
      [makeLine([[-0.4, -0.2], [0.4, -0.2]], 100)],
      context,
    );
    expect(result[0].validation.status).toBe('ok');
    if (result[0].validation.status === 'ok') {
      expect(result[0].validation.parcelId).toBe('P-1');
    }
  });

  it('rejects a line outside the land', () => {
    const result = validateWindbreakLines(
      [makeLine([[2, 2], [3, 3]], 100)],
      context,
    );
    expect(result[0].validation).toEqual({
      status: 'error',
      messageId: 'validation.outsideLand',
    });
  });

  it('rejects a too-short line', () => {
    const result = validateWindbreakLines(
      [makeLine([[-0.4, -0.2], [0.4, -0.2]], MIN_LENGTH_M - 1)],
      context,
    );
    expect(result[0].validation).toMatchObject({
      status: 'error',
      messageId: 'validation.tooShort',
      values: { length: MIN_LENGTH_M - 1, min: MIN_LENGTH_M },
    });
  });

  it('rejects a line crossing the established windbreak', () => {
    const result = validateWindbreakLines(
      [makeLine([[-0.2, 0.2], [0.2, 0.8]], 100)],
      context,
    );
    expect(result[0].validation).toEqual({
      status: 'error',
      messageId: 'validation.crossesEstablished',
      values: { lineId: 'skjolbelti-1' },
    });
  });

  it('rejects a line crossing the pending windbreak', () => {
    const result = validateWindbreakLines(
      [makeLine([[-0.2, -0.6], [0.2, -0.95]], 100)],
      context,
    );
    expect(result[0].validation).toEqual({
      status: 'error',
      messageId: 'validation.crossesPending',
      values: { applicationId: 'WB-APP', lineId: 'WB-1' },
    });
  });

  it('rejects two drawn lines crossing each other', () => {
    const a = makeLine([[-0.4, 0], [0.4, 0]], 100, 'line-a');
    const b = makeLine([[0, -0.4], [0, 0.4]], 100, 'line-b');
    const result = validateWindbreakLines([a, b], {
      parcels: [squareParcel],
      existingWindbreaks: [],
    });
    expect(result[0].validation).toEqual({
      status: 'error',
      messageId: 'validation.crossesDrawn',
    });
    expect(result[1].validation).toEqual({
      status: 'error',
      messageId: 'validation.crossesDrawn',
    });
  });
});

describe('parseCoordinateLines (non-pointer input)', () => {
  it('parses a WKT LINESTRING in WGS84', () => {
    const result = parseCoordinateLines(
      'LINESTRING (-21.80 65.48, -21.79 65.48)',
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].points).toEqual([
      { lon: -21.8, lat: 65.48 },
      { lon: -21.79, lat: 65.48 },
    ]);
  });

  it('parses each part of a MULTILINESTRING as its own line', () => {
    const result = parseCoordinateLines(
      'MULTILINESTRING ((-21.80 65.48, -21.79 65.48), (-21.78 65.47, -21.77 65.47))',
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toHaveLength(2);
    expect(result.lines[1].points[0]).toEqual({ lon: -21.78, lat: 65.47 });
  });

  it('parses one "lon,lat" pair per line, blank line separating lines', () => {
    const result = parseCoordinateLines(
      '-21.80,65.48\n-21.79,65.48\n\n-21.78,65.47\n-21.77,65.47',
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].points).toHaveLength(2);
    expect(result.lines[1].points).toHaveLength(2);
  });

  it('rejects unreadable input', () => {
    expect(parseCoordinateLines('not coordinates').error).toBe(
      'map.coordsInvalid',
    );
    expect(parseCoordinateLines('').error).toBe('map.coordsInvalid');
    expect(parseCoordinateLines('LINESTRING (garbage)').error).toBe(
      'map.coordsInvalid',
    );
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseCoordinateLines('LINESTRING (-200 65, -190 65)').error).toBe(
      'map.coordsInvalid',
    );
  });

  it('rejects a line with fewer than two points', () => {
    expect(parseCoordinateLines('-21.80,65.48').error).toBe('map.coordsTooFew');
    expect(parseCoordinateLines('LINESTRING (-21.80 65.48)').error).toBe(
      'map.coordsTooFew',
    );
  });
});
