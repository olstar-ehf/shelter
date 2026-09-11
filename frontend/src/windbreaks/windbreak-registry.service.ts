import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { WindbreakFeature } from '@island.is/map/server';

/**
 * Registry of existing windbreaks on the land, read from the
 * skógrækt (forestry) database:
 *
 *   select objectid, geometry from skograekt.skjolbelti
 *
 * The geometry is stored in ISN93 (EPSG:3057) and is transformed to WGS84
 * (EPSG:4326) on the way out. A mock implementation is used when the
 * database is not configured (WINDBREAK_REGISTRY_MOCK, the default).
 */
export abstract class WindbreakRegistryService {
  /**
   * All windbreaks intersecting the given land (bare GeoJSON geometry,
   * WGS84 - no Feature wrapper, which this PostGIS build rejects).
   *
   * @param landGeoJson bare GeoJSON geometry of the farmer's land (WGS84)
   * @param landeignarnumer the land ids being looked up (used by the mock
   *        to keep its data land-specific; ignored by the PostGIS query)
   */
  abstract getWindbreaks(
    landGeoJson: string,
    landeignarnumer: number[],
  ): Promise<WindbreakFeature[]>;
}

/**
 * PostGIS-backed implementation. Connect with WINDBREAK_DATABASE_URL or the
 * standard PG* environment variables (PGHOST, PGPORT, PGDATABASE, PGUSER,
 * PGPASSWORD). The query filters windbreaks to those intersecting the
 * farmer's land and returns their geometry as WGS84 GeoJSON.
 */
@Injectable()
export class PostgresWindbreakRegistryService extends WindbreakRegistryService {
  private readonly pool: Pool;

  constructor() {
    super();
    // Fail fast when the real registry is selected but not configured.
    const hasConfig =
      !!process.env.WINDBREAK_DATABASE_URL ||
      !!process.env.PGHOST ||
      !!process.env.PGDATABASE;
    if (!hasConfig) {
      throw new Error(
        'PostgresWindbreakRegistryService requires WINDBREAK_DATABASE_URL ' +
          '(or PGHOST/PGDATABASE, see the PG* variables)',
      );
    }
    this.pool = new Pool(
      process.env.WINDBREAK_DATABASE_URL
        ? { connectionString: process.env.WINDBREAK_DATABASE_URL }
        : {},
    );
  }

  async getWindbreaks(
    landGeoJson: string,
    _landeignarnumer: number[],
  ): Promise<WindbreakFeature[]> {
    const sql = `
      SELECT objectid,
             ST_AsGeoJSON(ST_Transform(geometry, 4326))::json AS geojson
      FROM skograekt.skjolbelti
      WHERE ST_Intersects(
        geometry,
        ST_Transform(ST_GeomFromGeoJSON($1)::geometry, 3057)
      )
    `;

    let result;
    try {
      result = await this.pool.query(sql, [landGeoJson]);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === '42P01' || code === '42501') {
        // Read-only deployments may not grant access to the registry -
        // degrade to "no established windbreaks" instead of failing.
        console.warn(
          `skograekt.skjolbelti not readable (${code}); treating as empty:`,
          err instanceof Error ? err.message : String(err),
        );
        return [];
      }
      throw new ServiceUnavailableException(
        `Windbreak registry query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return (result.rows as Array<{ objectid: unknown; geojson: unknown }>).map(
      (row) => {
        const objectid = row.objectid;
        return {
          type: 'Feature',
          geometry: row.geojson,
          properties: {
            objectid,
            line_id: `skjolbelti-${objectid}`,
            status: 'established',
            source: 'skograekt.skjolbelti',
          },
        } as WindbreakFeature;
      },
    );
  }
}

/**
 * Mock implementation for running the prototype without a database: returns
 * one established windbreak on the demo land (landeignarnumer 139555,
 * Garpsdalur) - far from the e2e draw area so the crossing-test line is
 * unambiguous.
 */
@Injectable()
export class MockWindbreakRegistryService extends WindbreakRegistryService {
  async getWindbreaks(
    _landGeoJson: string,
    landeignarnumer: number[],
  ): Promise<WindbreakFeature[]> {
    if (!landeignarnumer.includes(139555)) {
      return [];
    }
    return [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-21.772957672641947, 65.4824855310306],
            [-21.763702885646996, 65.4824855310306],
          ],
        },
        properties: {
          objectid: 1,
          line_id: 'skjolbelti-1',
          status: 'established',
          source: 'skograekt.skjolbelti (mock)',
        },
      },
    ];
  }
}
