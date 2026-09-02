import type { Feature, LineString, MultiLineString, Polygon } from 'geojson';

/** A farmer record as returned by the `farmers` collection. */
export interface Farmer {
  farmer_id: string;
  full_name: string;
  farm_name: string;
  kennitala?: string;
  cvr?: string;
  address: string;
  phone: string;
  email: string;
}

/** Attributes of a land parcel in the `farm_parcels` collection. */
export interface ParcelProperties {
  parcel_id: string;
  farmer_id: string;
  /** Icelandic property/land id from the Fasteignir-Xroad lookup. */
  landeignarnumer?: number;
  parcel_name: string;
  area_ha: number;
  land_use: string;
  crop?: string;
  source?: string;
}

export type ParcelFeature = Feature<Polygon, ParcelProperties>;

/** Attributes of a windbreak line stored in `windbreak_applications`. */
export interface WindbreakProperties {
  line_id: string;
  application_id?: string;
  farmer_id?: string;
  /** Kennitala of the applicant (the assumed identity). */
  kennitala?: string;
  parcel_id?: string | null;
  /** For windbreaks read from skograekt.skjolbelti. */
  objectid?: number;
  source?: string;
  /** 'established' (old windbreak) | 'pending' (submitted, not accepted) */
  status: string;
  length_m?: number;
  submitted_at?: string;
  planted_year?: number;
}

/** skograekt.skjolbelti stores MultiLineStrings; applications are LineStrings. */
export type WindbreakFeature = Feature<
  LineString | MultiLineString,
  WindbreakProperties
>;

/** One windbreak line drawn by the farmer on the map. */
export interface WindbreakLine {
  /** Stable client-side id (Leaflet layer id), used as React key. */
  clientId: string;
  feature: Feature<LineString, Record<string, unknown>>;
  lengthM: number;
}

/** Result of validating a drawn line against the farmer's parcels. */
export type Validation =
  | { status: 'ok'; parcelId: string | null }
  | { status: 'error'; reason: string };

export interface ValidatedLine {
  line: WindbreakLine;
  validation: Validation;
}
