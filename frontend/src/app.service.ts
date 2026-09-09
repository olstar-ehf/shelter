import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Feature, Geometry, LineString } from 'geojson';
import {
  landUnion,
  measureLineM,
  validateWindbreakLines,
  type ParcelFeature,
  type ParcelProperties,
  type WindbreakFeature,
  type WindbreakLine,
} from '@island.is/map/server';
import {
  FASTEIGNIR_DEFAULT_API_URL,
  FasteignirService,
  PropertiesLookupError,
} from './fasteignir/fasteignir.service';
import {
  windbreakAnswersSchema,
  type WindbreakAnswers,
} from '@island.is/windbreak-application/server';
import { uniqueLandeignarnumer } from './fasteignir/fasteignir.types';
import { createTranslator, type Locale, type Translator } from './i18n';
import { WindbreakRegistryService } from './windbreaks/windbreak-registry.service';
import {
  type NewWindbreakApplicationLine,
  WindbreakApplicationsStore,
} from './windbreaks/windbreak-applications.store';

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
  parcels: ParcelFeature[];
  windbreaks: WindbreakFeature[];
  parcelsJson: string;
  windbreaksJson: string;
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
    private readonly windbreakApplicationsStore: WindbreakApplicationsStore,
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

  /** Map a Fasteignir-Xroad failure to a localized HTTP error. */
  private propertiesError(
    err: unknown,
    t: Translator,
  ): ServiceUnavailableException {
    if (err instanceof PropertiesLookupError) {
      switch (err.code) {
        case 'NO_TOKEN':
          return new ServiceUnavailableException(t('errorFasteignirNoToken'));
        case 'UNREACHABLE':
          return new ServiceUnavailableException(
            t('errorFasteignirUnreachable', {
              url: process.env.FASTEIGNIR_API_URL || FASTEIGNIR_DEFAULT_API_URL,
            }),
          );
        case 'HTTP':
          return new ServiceUnavailableException(
            t('errorFasteignirHttp', {
              status: err.status ?? 0,
              detail: err.detail ?? '',
            }),
          );
        case 'PARSE':
          return new ServiceUnavailableException(
            t('errorFasteignirLookupFailed', { detail: err.message }),
          );
      }
    }
    return new ServiceUnavailableException(
      t('errorFasteignirLookupFailed', {
        detail: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  /**
   * Everything the draw page needs:
   *  1. look up the properties registered on the assumed kennitala
   *     (Fasteignir-Xroad; real client by default, mocked explicitly),
   *  2. build the unique list of landeignarnumer from them,
   *  3. load the land parcels and their windbreaks from the registries
   *     (skógrækt PostGIS registry + the submitted applications store),
   * all embedded as GeoJSON for the map.
   */
  async getApplyContext(locale: Locale): Promise<ApplyContext> {
    const t = createTranslator(locale);

    let properties;
    try {
      properties = await this.fasteignirService.getFasteignir(
        this.demoKennitala,
      );
    } catch (err) {
      throw this.propertiesError(err, t);
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
    //  - the applications store (submitted, not yet accepted).
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

    let pendingWindbreaks: WindbreakFeature[] = [];
    try {
      const parcelIds = [
        ...new Set(parcels.map((p) => p.properties.parcel_id)),
      ];
      pendingWindbreaks = await this.windbreakApplicationsStore.find({
        parcelIds,
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        t('errorApplicationsQuery', {
          detail: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    const windbreaks = [...registeredWindbreaks, ...pendingWindbreaks];

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
    };
  }

  /**
   * Validate the submitted answers against the template's data schema
   * (shape), re-validate each line against the land and the existing
   * windbreaks server side (the client-side check is only for immediate
   * feedback), and persist them in PostGIS through the applications store
   * (windbreak_applications, exposed read-only through the OGC API).
   *
   * Lengths are re-measured here - the client-provided lengthM is part of
   * the answers shape but never trusted for storage.
   */
  async submitApplication(
    answers: unknown,
    locale: Locale,
  ): Promise<{ applicationId: string }> {
    const t = createTranslator(locale);

    const parsed = windbreakAnswersSchema.safeParse(answers);
    if (!parsed.success) {
      throw new BadRequestException(t('errorInvalidAnswers'));
    }
    const validatedAnswers: WindbreakAnswers = parsed.data;
    if (validatedAnswers.lines.length === 0) {
      throw new BadRequestException(t('errorNoLines'));
    }

    const { parcels, windbreaks } = await this.getApplyContext(locale);

    // The zod feature shape is structurally the lib's WindbreakLine feature.
    const drawn: WindbreakLine[] = validatedAnswers.lines.map((answer) => ({
      clientId: answer.clientId,
      feature: answer.feature,
      // Re-measured server side: never trust the client's length.
      lengthM: measureLineM(answer.feature),
    }));

    const validated = validateWindbreakLines(drawn, {
      parcels,
      existingWindbreaks: windbreaks,
    });

    for (const entry of validated) {
      if (entry.validation.status === 'error') {
        throw new BadRequestException(
          t(entry.validation.messageId, entry.validation.values),
        );
      }
    }

    const applicationId = newApplicationId();
    const now = new Date().toISOString();
    const toStore: NewWindbreakApplicationLine[] = validated.map(
      (entry, index) => ({
        lineId: `${applicationId}-${index + 1}`,
        applicationId,
        kennitala: this.demoKennitala,
        parcelId:
          entry.validation.status === 'ok'
            ? entry.validation.parcelId
            : null,
        lengthM: entry.line.lengthM,
        submittedAt: now,
        feature: entry.line.feature,
      }),
    );

    try {
      await this.windbreakApplicationsStore.insertLines(toStore);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(t('errorApplicationsWrite', { detail }));
    }

    return { applicationId };
  }

  /** Read an application back from the store for the confirmation page. */
  async getSubmittedContext(
    applicationId: string,
    locale: Locale,
  ): Promise<SubmittedContext> {
    const t = createTranslator(locale);
    let features: WindbreakFeature[];
    try {
      features = await this.windbreakApplicationsStore.find({
        applicationId,
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        t('errorApplicationsQuery', {
          detail: err instanceof Error ? err.message : String(err),
        }),
      );
    }
    if (features.length === 0) {
      throw new BadRequestException(
        t('errorApplicationNotFound', { applicationId }),
      );
    }

    const lines = features.map((f) => {
      const p = f.properties;
      return {
        line_id: p.line_id,
        parcel_id: p.parcel_id,
        status: p.status,
        length_m: p.length_m,
        submitted_at: p.submitted_at,
      };
    });
    const totalLengthM = features.reduce(
      (sum, f) => sum + (f.properties.length_m ?? 0),
      0,
    );
    const submittedAt =
      features.map((f) => f.properties.submitted_at ?? '')
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
