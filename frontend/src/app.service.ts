import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Feature, Geometry, LineString } from 'geojson';
import { FasteignirService } from './fasteignir/fasteignir.service';
import { uniqueLandeignarnumer } from './fasteignir/fasteignir.types';
import { landUnion, measureLineM, validateLine } from './geometry';
import { createTranslator, type Locale, type Translator } from './i18n';
import { WindbreakRegistryService } from './windbreaks/windbreak-registry.service';
import type {
  ParcelFeature,
  ParcelProperties,
  ValidatedLine,
  WindbreakFeature,
  WindbreakLine,
  WindbreakProperties,
} from './types';

interface OgcFeatureCollection<P> {
  type: 'FeatureCollection';
  features: Array<Feature<Geometry, P>>;
  numberMatched?: number;
  numberReturned?: number;
}

export interface ApplyContext {
  identity: { fullName: string; kennitala: string };
  landeignarnumer: number[];
  lookupSummary: string;
  helpDrawExisting: string;
  parcels: ParcelFeature[];
  windbreaks: WindbreakFeature[];
  parcelsJson: string;
  windbreaksJson: string;
  establishedLabel: string;
  pendingLabel: string;
}

export interface SubmittedContext {
  applicationId: string;
  submittedAt: string;
  totalLengthM: number;
  linesLabel: string;
  lines: Array<Record<string, unknown>>;
}

@Injectable()
export class AppService {
  /** Base URL of the pygeoapi OGC API backend (server side). */
  readonly pygeoapiUrl = (
    process.env.PYGEOAPI_URL || 'http://localhost:5000'
  ).replace(/\/+$/, '');

  /**
   * The only facts assumed about the user: their name and kennitala, as
   * known by the portal session. Everything else - which land they own, its
   * parcels and windbreaks - is looked up from the registries.
   */
  readonly demoKennitala = process.env.DEMO_KENNITALA || '2409693949';
  readonly demoFullName =
    process.env.DEMO_FULL_NAME || 'Guðmundur Jónsson';

  constructor(
    private readonly fasteignirService: FasteignirService,
    private readonly windbreakRegistryService: WindbreakRegistryService,
  ) {}

  private async getOgc<P>(
    path: string,
    t: Translator,
  ): Promise<OgcFeatureCollection<P>> {
    let res: Response;
    try {
      res = await fetch(`${this.pygeoapiUrl}${path}`, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new ServiceUnavailableException(
        t('errorBackendUnreachable', { url: this.pygeoapiUrl }),
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        t('errorBackendHttp', { status: res.status, path }),
      );
    }
    return (await res.json()) as OgcFeatureCollection<P>;
  }

  /** Land parcels for one landeignarnumer (property/land id). */
  private async fetchParcelsByLandeignarnumer(
    landeignarnumer: number,
    t: Translator,
  ): Promise<ParcelFeature[]> {
    const data = await this.getOgc<ParcelProperties>(
      `/collections/farm_parcels/items?landeignarnumer=${encodeURIComponent(landeignarnumer)}&f=json&limit=100`,
      t,
    );
    return data.features as ParcelFeature[];
  }

  /** Existing windbreaks on the given parcels. */
  private async fetchWindbreaksForParcels(
    parcels: ParcelFeature[],
    t: Translator,
  ): Promise<WindbreakFeature[]> {
    const parcelIds = [
      ...new Set(parcels.map((p) => p.properties.parcel_id)),
    ];
    const batches = await Promise.all(
      parcelIds.map((id) =>
        this.getOgc<WindbreakProperties>(
          `/collections/windbreak_applications/items?parcel_id=${encodeURIComponent(id)}&f=json&limit=100`,
          t,
        ),
      ),
    );
    return batches.flatMap((b) => b.features as WindbreakFeature[]);
  }

  /**
   * Everything the draw page needs:
   *  1. look up the properties registered on the assumed kennitala
   *     (Fasteignir-Xroad, mocked in this prototype),
   *  2. build the unique list of landeignarnumer from them,
   *  3. load the land parcels and their windbreaks from the registries,
   * all embedded as GeoJSON for the Leaflet map.
   */
  async getApplyContext(locale: Locale): Promise<ApplyContext> {
    const t = createTranslator(locale);

    let properties;
    try {
      properties = await this.fasteignirService.getFasteignir(
        this.demoKennitala,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(
        t('errorFasteignirLookupFailed', { detail }),
      );
    }
    const propertyCount = properties.fasteignir?.length ?? 0;
    const landeignarnumer = uniqueLandeignarnumer(properties);

    if (landeignarnumer.length === 0) {
      throw new BadRequestException(
        t('errorNoProperties', { kennitala: this.demoKennitala }),
      );
    }

    const parcels = (
      await Promise.all(
        landeignarnumer.map((num) =>
          this.fetchParcelsByLandeignarnumer(num, t),
        ),
      )
    ).flat();

    if (parcels.length === 0) {
      throw new BadRequestException(
        t('errorNoParcels', { list: landeignarnumer.join(', ') }),
      );
    }

    // Existing windbreaks come from two places:
    //  - the skógrækt PostGIS registry (established windbreaks on the land,
    //    ISN93 -> WGS84), and
    //  - the application collection (submitted, not yet accepted).
    const union = landUnion(parcels);
    let registeredWindbreaks: WindbreakFeature[] = [];
    if (union) {
      try {
        registeredWindbreaks =
          await this.windbreakRegistryService.getWindbreaks(
            // Bare geometry: this PostGIS build's ST_GeomFromGeoJSON rejects
            // Feature/FeatureCollection envelopes ("invalid GeoJson
            // representation").
            JSON.stringify(union.geometry),
            landeignarnumer,
          );
      } catch (err) {
        const detail =
          err instanceof Error ? err.message : String(err);
        throw new ServiceUnavailableException(
          t('errorRegistryQuery', { detail }),
        );
      }
    }
    const pendingWindbreaks = await this.fetchWindbreaksForParcels(
      parcels,
      t,
    );

    const windbreaks = [...registeredWindbreaks, ...pendingWindbreaks];

    const establishedCount = windbreaks.filter(
      (w) => w.properties.status === 'established',
    ).length;
    const pendingCount = windbreaks.length - establishedCount;

    const establishedLabel = t('countEstablished', {
      count: establishedCount,
    });
    const pendingLabel = t('countPending', { count: pendingCount });

    const lookupSummary = t('lookupSummary', {
      propertyCount,
      landCount: landeignarnumer.length,
      kennitala: this.demoKennitala,
      list: landeignarnumer.join(', '),
    });

    return {
      identity: { fullName: this.demoFullName, kennitala: this.demoKennitala },
      landeignarnumer,
      lookupSummary,
      helpDrawExisting: t('helpDrawExisting', {
        established: `<strong>${establishedLabel}</strong>`,
        pending: `<strong>${pendingLabel}</strong>`,
      }),
      parcels,
      windbreaks,
      parcelsJson: JSON.stringify({
        type: 'FeatureCollection',
        features: parcels,
      }),
      windbreaksJson: JSON.stringify({
        type: 'FeatureCollection',
        features: windbreaks,
      }),
      establishedLabel,
      pendingLabel,
    };
  }

  /**
   * Store one windbreak line in the backend via an OGC API Features
   * transaction (POST /collections/windbreak_applications/items).
   */
  private async postLine(
    input: {
      line: Feature<LineString, Record<string, unknown>>;
      lineId: string;
      applicationId: string;
      kennitala: string;
      parcelId: string | null;
      lengthM: number;
    },
    t: Translator,
  ): Promise<void> {
    const feature: Feature<LineString> = {
      type: 'Feature',
      geometry: input.line.geometry,
      properties: {
        line_id: input.lineId,
        application_id: input.applicationId,
        kennitala: input.kennitala,
        parcel_id: input.parcelId,
        // Submitted for review: the windbreak is not accepted yet.
        status: 'pending',
        length_m: Math.round(input.lengthM * 10) / 10,
        submitted_at: new Date().toISOString(),
      },
    };

    const res = await fetch(
      `${this.pygeoapiUrl}/collections/windbreak_applications/items?f=json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/geo+json',
          Accept: 'application/json',
        },
        body: JSON.stringify(feature),
      },
    );
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      throw new BadGatewayException(
        t('errorStoreFailed', { status: res.status, detail }),
      );
    }
  }

  /**
   * Validate the submitted lines server side (the client-side check is only
   * for immediate feedback) and store them in the OGC API backend.
   */
  async submitApplication(
    lines: Feature<LineString, Record<string, unknown>>[],
    locale: Locale,
  ): Promise<{ applicationId: string }> {
    const t = createTranslator(locale);
    const { parcels, windbreaks } = await this.getApplyContext(locale);
    const union = landUnion(parcels);

    const drawn: WindbreakLine[] = lines.map((feature, index) => ({
      clientId: `server-${index}`,
      feature,
      lengthM: measureLineM(feature),
    }));

    const validated: ValidatedLine[] = drawn.map((line) => ({
      line,
      validation: validateLine(line, {
        union,
        parcels,
        existingWindbreaks: windbreaks,
        otherLines: drawn.filter((other) => other !== line),
      }),
    }));

    for (const entry of validated) {
      if (entry.validation.status === 'error') {
        throw new BadRequestException(
          t(entry.validation.messageId, entry.validation.values),
        );
      }
    }

    const applicationId = newApplicationId();
    for (let i = 0; i < validated.length; i += 1) {
      const entry = validated[i];
      await this.postLine(
        {
          line: entry.line.feature,
          lineId: `${applicationId}-${i + 1}`,
          applicationId,
          kennitala: this.demoKennitala,
          parcelId:
            entry.validation.status === 'ok'
              ? entry.validation.parcelId
              : null,
          lengthM: entry.line.lengthM,
        },
        t,
      );
    }

    return { applicationId };
  }

  /** Read an application back from the backend for the confirmation page. */
  async getSubmittedContext(
    applicationId: string,
    locale: Locale,
  ): Promise<SubmittedContext> {
    const t = createTranslator(locale);
    const data = await this.getOgc<WindbreakProperties>(
      `/collections/windbreak_applications/items?application_id=${encodeURIComponent(applicationId)}&f=json&limit=100`,
      t,
    );
    if (data.features.length === 0) {
      throw new BadRequestException(
        t('errorApplicationNotFound', { applicationId }),
      );
    }

    const lines = data.features.map((f) => {
      const p = f.properties;
      return {
        line_id: p.line_id,
        parcel_id: p.parcel_id,
        status: p.status,
        length_m: p.length_m,
        submitted_at: p.submitted_at,
      };
    });
    const totalLengthM = data.features.reduce(
      (sum, f) => sum + (f.properties.length_m ?? 0),
      0,
    );
    const submittedAt =
      data.features.map((f) => f.properties.submitted_at ?? '')
        .filter((v) => v.length > 0)
        .sort()
        .pop() ?? new Date().toISOString();

    return {
      applicationId,
      submittedAt,
      totalLengthM,
      linesLabel: t('submittedLines', {
        count: lines.length,
        total: Math.round(totalLengthM),
      }),
      lines,
    };
  }
}

/** Generate a human friendly application id, e.g. WB-2026-K3F9XA. */
export function newApplicationId(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WB-${year}-${rand}`;
}
