import type { Feature, LineString, MultiLineString, Polygon } from 'geojson';

/** Basemap tile source of the map (slippy-map XYZ tile template). */
export interface WindbreakBasemap {
  /** Tile URL template with {z}/{x}/{y} placeholders. */
  tileUrl: string;
  /** Attribution HTML rendered on the map. */
  attribution: string;
  /** Highest zoom the tile source serves (default 16). */
  maxZoom?: number;
}

/** Attributes of a land parcel. */
export interface ParcelProperties {
  parcel_id: string;
  farmer_id?: string;
  /** Icelandic property/land id from the Fasteignir-Xroad lookup. */
  landeignarnumer?: number;
  parcel_name: string;
  area_ha: number;
  land_use?: string;
  crop?: string;
}

export type ParcelFeature = Feature<Polygon, ParcelProperties>;

/** Attributes of an existing windbreak (skograekt.skjolbelti or application). */
export interface WindbreakProperties {
  line_id: string;
  application_id?: string;
  parcel_id?: string | null;
  /** Applicant (submitted windbreak applications). */
  kennitala?: string;
  /** For windbreaks read from skograekt.skjolbelti. */
  objectid?: number;
  source?: string;
  /** 'established' (existing) | 'pending' (submitted, not accepted) */
  status: string;
  length_m?: number;
  planted_year?: number;
  /** When the application was submitted (windbreak_applications). */
  submitted_at?: string;
}

/** skograekt.skjolbelti stores MultiLineStrings; applications are LineStrings. */
export type WindbreakFeature = Feature<
  LineString | MultiLineString,
  WindbreakProperties
>;

/** One windbreak line drawn by the farmer on the map. */
export interface WindbreakLine {
  /** Stable client-side id (Leaflet layer id). */
  clientId: string;
  feature: Feature<LineString, Record<string, unknown>>;
  lengthM: number;
}

/**
 * Result of validating a drawn line. Errors carry a message id from the
 * lib's locale catalogs (`src/messages/*`) and optional ICU values, so
 * consumers format them with react-intl: formatMessage({ id }, values).
 */
export type Validation =
  | { status: 'ok'; parcelId: string | null }
  | {
      status: 'error';
      messageId: string;
      values?: Record<string, string | number>;
    };

export interface ValidatedLine {
  line: WindbreakLine;
  validation: Validation;
}

export interface WindbreakValidationContext {
  parcels: ParcelFeature[];
  /** Windbreaks already on the land (established or pending acceptance). */
  existingWindbreaks: WindbreakFeature[];
}
