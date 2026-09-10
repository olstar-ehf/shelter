import type { Feature, LineString } from 'geojson';
import type { ValidatedLine } from '@island.is/map/server';

/**
 * Builds the GeoJSON attachment for a Zendesk ticket: one FeatureCollection
 * holding every validated (accepted) windbreak line with the properties the
 * grant authority needs to review it. Pure function - unit tested.
 */

export interface WindbreakAttachmentMeta {
  applicationId: string;
  kennitala: string;
  submittedAt: string;
  /** parcel_id -> display name (for the comment, not the attachment). */
  parcelNames?: Record<string, string | undefined>;
}

export interface WindbreakAttachment {
  filename: string;
  content: string;
  totalLengthM: number;
  parcelIds: string[];
}

/** Lines that passed validation, each already bound to a line_id. */
export interface AttachmentLine {
  lineId: string;
  lengthM: number;
  parcelId: string | null;
  feature: Feature<LineString>;
}

export function buildWindbreakAttachment(
  meta: WindbreakAttachmentMeta,
  lines: AttachmentLine[],
): WindbreakAttachment {
  const features = lines.map((line, index) => ({
    type: 'Feature' as const,
    geometry: line.feature.geometry,
    properties: {
      line_id: line.lineId,
      application_id: meta.applicationId,
      kennitala: meta.kennitala,
      parcel_id: line.parcelId,
      line_index: index + 1,
      length_m: Math.round(line.lengthM * 10) / 10,
      // Submitted for review: not accepted yet.
      status: 'pending',
      submitted_at: meta.submittedAt,
    },
  }));

  return {
    filename: `windbreaks-${meta.applicationId}.geojson`,
    content: JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    totalLengthM: lines.reduce((sum, line) => sum + line.lengthM, 0),
    parcelIds: [
      ...new Set(lines.map((line) => line.parcelId).filter((p) => p !== null)),
    ] as string[],
  };
}

/** Maps validated entries (lib) to attachment lines with server line ids. */
export function validatedToAttachmentLines(
  validated: ValidatedLine[],
  applicationId: string,
): AttachmentLine[] {
  return validated.flatMap((entry, index) => {
    if (entry.validation.status !== 'ok') {
      return [];
    }
    return [
      {
        lineId: `${applicationId}-${index + 1}`,
        lengthM: entry.line.lengthM,
        parcelId: entry.validation.parcelId,
        feature: entry.line.feature as Feature<LineString>,
      },
    ];
  });
}
