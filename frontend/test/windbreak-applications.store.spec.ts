/**
 * Tests for the windbreak applications store: the GeoJSON mock round-trips
 * the same way the PostGIS store does (same find() contract), and the
 * PostGIS store is exercised against a real database when
 * WINDBREAK_DATABASE_URL is configured (skipped otherwise).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Feature, LineString } from 'geojson';
import {
  GeoJsonWindbreakApplicationsStore,
  PostgresWindbreakApplicationsStore,
  type NewWindbreakApplicationLine,
} from '../src/windbreaks/windbreak-applications.store';

function line(
  lineId: string,
  applicationId: string,
  parcelId: string | null,
  coords: number[][],
): NewWindbreakApplicationLine {
  const feature: Feature<LineString> = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
  return {
    lineId,
    applicationId,
    kennitala: '061050-4429',
    parcelId,
    lengthM: 500.25,
    submittedAt: '2026-01-02T03:04:05Z',
    feature,
  };
}

describe('GeoJsonWindbreakApplicationsStore', () => {
  let dir: string;
  let store: GeoJsonWindbreakApplicationsStore;

  beforeEach(async () => {
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'windbreaks-store-'));
    const file = path.join(dir, 'windbreak_applications.json');
    await fs.promises.writeFile(
      file,
      JSON.stringify({ type: 'FeatureCollection', features: [] }),
    );
    process.env.WINDBREAK_APPLICATIONS_FILE = file;
    store = new GeoJsonWindbreakApplicationsStore();
  });

  afterEach(async () => {
    delete process.env.WINDBREAK_APPLICATIONS_FILE;
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('inserts lines and finds them by parcel id', async () => {
    await store.insertLines([
      line('A-1', 'A', 'IS-1', [
        [-18.55, 63.48],
        [-18.54, 63.48],
      ]),
      line('A-2', 'A', 'IS-2', [
        [-18.53, 63.47],
        [-18.52, 63.47],
      ]),
    ]);
    const found = await store.find({ parcelIds: ['IS-1'] });
    expect(found).toHaveLength(1);
    expect(found[0].properties).toMatchObject({
      line_id: 'A-1',
      application_id: 'A',
      parcel_id: 'IS-1',
      kennitala: '061050-4429',
      status: 'pending',
      length_m: 500.3,
    });
  });

  it('finds lines by application id', async () => {
    await store.insertLines([line('B-1', 'B', null, [[0, 0], [1, 1]])]);
    const found = await store.find({ applicationId: 'B' });
    expect(found).toHaveLength(1);
    expect(found[0].properties.line_id).toBe('B-1');
  });

  it('is idempotent for the same line id', async () => {
    const l = line('C-1', 'C', 'IS-1', [[0, 0], [1, 1]]);
    await store.insertLines([l]);
    await store.insertLines([l]);
    const found = await store.find({ applicationId: 'C' });
    expect(found).toHaveLength(1);
  });

  it('persists a valid GeoJSON FeatureCollection file', async () => {
    await store.insertLines([line('D-1', 'D', null, [[0, 0], [1, 1]])]);
    const raw = JSON.parse(
      await fs.promises.readFile(process.env.WINDBREAK_APPLICATIONS_FILE!, 'utf8'),
    );
    expect(raw.type).toBe('FeatureCollection');
    expect(raw.features).toHaveLength(1);
    expect(raw.features[0].geometry.type).toBe('LineString');
  });
});

// Same connection resolution as the windbreak services: WINDBREAK_DATABASE_URL
// or the PG* variables.
const hasDb =
  !!process.env.WINDBREAK_DATABASE_URL ||
  !!process.env.PGHOST ||
  !!process.env.PGDATABASE;
const maybeDescribe = hasDb ? describe : describe.skip;

describe('PostgresWindbreakApplicationsStore (unreachable database)', () => {
  const prevUrl = process.env.WINDBREAK_DATABASE_URL;

  afterEach(() => {
    if (prevUrl === undefined) {
      delete process.env.WINDBREAK_DATABASE_URL;
    } else {
      process.env.WINDBREAK_DATABASE_URL = prevUrl;
    }
  });

  it('degrades to an empty list instead of throwing on connection refusal', async () => {
    // Port 1 refuses connections immediately - pending lines are a
    // best-effort overlay and must never block the draw page.
    process.env.WINDBREAK_DATABASE_URL = 'postgres://u:p@127.0.0.1:1/db';
    const store = new PostgresWindbreakApplicationsStore();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(store.find({})).resolves.toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('ECONNREFUSED'),
        expect.any(String),
      );
    } finally {
      warn.mockRestore();
      await (store as unknown as { pool: { end: () => Promise<void> } }).pool.end();
    }
  });

  it('still throws on genuine query errors (syntax)', async () => {
    process.env.WINDBREAK_DATABASE_URL = 'postgres://u:p@127.0.0.1:1/db';
    const store = new PostgresWindbreakApplicationsStore();
    const pool = (store as unknown as { pool: { query: unknown } }).pool;
    const query = jest.spyOn(pool, 'query' as never).mockImplementation(() =>
      Promise.reject(
        Object.assign(new Error('syntax error'), { code: '42601' }),
      ) as never,
    );
    await expect(store.find({})).rejects.toMatchObject({ code: '42601' });
    query.mockRestore();
  });
});

maybeDescribe('PostgresWindbreakApplicationsStore (live)', () => {
  const store = new PostgresWindbreakApplicationsStore();
  const applicationId = `TEST-${Date.now()}`;

  afterAll(async () => {
    // Self-cleaning: remove the rows this test inserted.
    const { Pool } = require('pg') as typeof import('pg');
    const pool = new Pool(
      process.env.WINDBREAK_DATABASE_URL
        ? { connectionString: process.env.WINDBREAK_DATABASE_URL }
        : {},
    );
    await pool.query('DELETE FROM windbreak_applications WHERE application_id = $1', [
      applicationId,
    ]);
    await pool.end();
    await (store as unknown as { pool: { end: () => Promise<void> } }).pool.end();
  });

  it('inserts lines and reads them back with WGS84 geometry', async () => {
    await store.insertLines([
      line(`${applicationId}-1`, applicationId, 'IS-139555', [
        [-21.830402087733127, 65.45004213049053],
        [-21.82040208773313, 65.45004213049053],
      ]),
    ]);
    const found = await store.find({ applicationId });
    expect(found).toHaveLength(1);
    expect(found[0].properties).toMatchObject({
      application_id: applicationId,
      status: 'pending',
    });
    const coords = (
      found[0].geometry as { coordinates: number[][] }
    ).coordinates;
    expect(coords[0][0]).toBeCloseTo(-21.830402, 5);
    expect(coords[1][1]).toBeCloseTo(65.450042, 5);
  });
});
