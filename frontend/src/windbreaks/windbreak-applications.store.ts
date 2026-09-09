import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type { Feature, LineString } from 'geojson';
import type { WindbreakFeature } from '@island.is/map/server';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * One windbreak line ready to persist as a submitted application
 * (status 'pending' until the grant authority accepts it).
 */
export interface NewWindbreakApplicationLine {
  lineId: string;
  applicationId: string;
  kennitala: string;
  parcelId: string | null;
  /** Length in metres (validated server side before this point). */
  lengthM: number;
  submittedAt: string;
  /** Bare GeoJSON LineString in WGS84 (EPSG:4326). */
  feature: Feature<LineString>;
}

export interface WindbreakApplicationQuery {
  parcelIds?: string[];
  applicationId?: string;
}

/**
 * Persistence for submitted windbreak applications (the pending lines the
 * draw page shows and the confirmation page reads back). Implementations:
 *
 *  - PostgresWindbreakApplicationsStore - the real store (default): the
 *    windbreak_applications table created by the db migrations
 *    (frontend/db/migrations), also served read-only by the OGC API via
 *    pygeoapi's PostgreSQL provider.
 *  - GeoJsonWindbreakApplicationsStore - mock/file-backed fallback for
 *    running the prototype without a database (WINDBREAK_APPLICATIONS_MOCK).
 */
export abstract class WindbreakApplicationsStore {
  abstract find(
    query: WindbreakApplicationQuery,
  ): Promise<WindbreakFeature[]>;

  abstract insertLines(lines: NewWindbreakApplicationLine[]): Promise<void>;
}

/** Geometry + properties read back from a windbreak_applications row. */
interface ApplicationRow {
  line_id: string;
  application_id: string;
  kennitala: string;
  parcel_id: string | null;
  status: string;
  length_m: number | null;
  submitted_at: Date | string;
  geojson: unknown;
}

function rowToFeature(row: ApplicationRow): WindbreakFeature {
  return {
    type: 'Feature',
    geometry: row.geojson as WindbreakFeature['geometry'],
    properties: {
      line_id: row.line_id,
      application_id: row.application_id,
      kennitala: row.kennitala,
      parcel_id: row.parcel_id,
      status: row.status,
      length_m: row.length_m ?? undefined,
      submitted_at:
        row.submitted_at instanceof Date
          ? row.submitted_at.toISOString()
          : String(row.submitted_at),
    },
  };
}

/**
 * PostGIS-backed implementation (default). Geometry is stored in WGS84
 * (EPSG:4326); the db migrations own the schema. Connect with
 * WINDBREAK_DATABASE_URL or the standard PG* variables.
 */
@Injectable()
export class PostgresWindbreakApplicationsStore extends WindbreakApplicationsStore {
  private readonly pool: Pool;

  constructor() {
    super();
    this.pool = new Pool(
      process.env.WINDBREAK_DATABASE_URL
        ? { connectionString: process.env.WINDBREAK_DATABASE_URL }
        : {},
    );
  }

  async find(
    query: WindbreakApplicationQuery,
  ): Promise<WindbreakFeature[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (query.parcelIds && query.parcelIds.length > 0) {
      params.push(query.parcelIds);
      conditions.push(`parcel_id = ANY($${params.length})`);
    }
    if (query.applicationId) {
      params.push(query.applicationId);
      conditions.push(`application_id = $${params.length}`);
    }
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT line_id, application_id, kennitala, parcel_id, status,
             length_m, submitted_at,
             ST_AsGeoJSON(geometry)::json AS geojson
      FROM windbreak_applications
      ${where}
      ORDER BY submitted_at, line_id
    `;
    const result = await this.pool.query(sql, params);
    return (result.rows as ApplicationRow[]).map(rowToFeature);
  }

  async insertLines(lines: NewWindbreakApplicationLine[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const line of lines) {
        // Bare geometry only: this PostGIS build's ST_GeomFromGeoJSON
        // rejects Feature/FeatureCollection envelopes.
        const geometryJson = JSON.stringify(line.feature.geometry);
        await client.query(
          `INSERT INTO windbreak_applications (
             line_id, application_id, kennitala, parcel_id, status,
             length_m, submitted_at, geometry
           ) VALUES ($1, $2, $3, $4, 'pending', $5, $6,
             ST_SetSRID(ST_GeomFromGeoJSON($7::json), 4326))
           ON CONFLICT (line_id) DO NOTHING`,
          [
            line.lineId,
            line.applicationId,
            line.kennitala,
            line.parcelId,
            Math.round(line.lengthM * 10) / 10,
            line.submittedAt,
            geometryJson,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

/**
 * Mock/file-backed implementation for running the prototype without a
 * database: reads and appends GeoJSON at WINDBREAK_APPLICATIONS_FILE
 * (default: backend/data/windbreak_applications.json, the seed file the
 * pygeoapi GeoJSON provider used to carry). Writes are appended in place.
 */
@Injectable()
export class GeoJsonWindbreakApplicationsStore extends WindbreakApplicationsStore {
  private readonly filePath: string;

  constructor() {
    super();
    this.filePath =
      process.env.WINDBREAK_APPLICATIONS_FILE ??
      path.resolve(__dirname, '..', '..', '..', 'backend', 'data',
        'windbreak_applications.json');
  }

  private async readAll(): Promise<WindbreakFeature[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw) as {
        type: string;
        features: WindbreakFeature[];
      };
      return Array.isArray(data.features) ? data.features : [];
    } catch {
      return [];
    }
  }

  private async writeAll(features: WindbreakFeature[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
      'utf8',
    );
  }

  async find(
    query: WindbreakApplicationQuery,
  ): Promise<WindbreakFeature[]> {
    const all = await this.readAll();
    const parcelSet = new Set(query.parcelIds ?? []);
    return all.filter((f) => {
      const p = f.properties;
      if (query.applicationId) {
        return p.application_id === query.applicationId;
      }
      return parcelSet.has(p.parcel_id ?? '');
    });
  }

  async insertLines(lines: NewWindbreakApplicationLine[]): Promise<void> {
    const all = await this.readAll();
    const existing = new Set(all.map((f) => f.properties.line_id));
    for (const line of lines) {
      if (existing.has(line.lineId)) {
        continue;
      }
      all.push({
        type: 'Feature',
        geometry: line.feature.geometry,
        properties: {
          line_id: line.lineId,
          application_id: line.applicationId,
          kennitala: line.kennitala,
          parcel_id: line.parcelId,
          status: 'pending',
          length_m: Math.round(line.lengthM * 10) / 10,
          submitted_at: line.submittedAt,
        },
      });
      existing.add(line.lineId);
    }
    await this.writeAll(all);
  }
}
