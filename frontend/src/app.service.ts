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
import { WindbreakApplicationsStore } from './windbreaks/windbreak-applications.store';
import {
  buildWindbreakAttachment,
  validatedToAttachmentLines,
} from './zendesk/windbreak-attachment';
import { ZendeskError, ZendeskService } from './zendesk/zendesk.service';

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
  /** Zendesk ticket id the application was logged as. */
  ticketId: string;
  /** Agent-facing ticket URL (null when not configured, e.g. mocks). */
  ticketUrl: string | null;
  /** The WB-... reference from the ticket subject, when present. */
  applicationId: string | null;
  submittedAt: string;
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
  readonly demoKennitala = process.env.DEMO_KENNITALA || '061050-4429';
  readonly demoFullName =
    process.env.DEMO_FULL_NAME || 'Hafliði Viðar Ólafsson';

  constructor(
    private readonly fasteignirService: FasteignirService,
    private readonly windbreakRegistryService: WindbreakRegistryService,
    private readonly windbreakApplicationsStore: WindbreakApplicationsStore,
    private readonly zendeskService: ZendeskService,
  ) {}

  /** Map a Zendesk failure to a localized HTTP error. */
  private zendeskError(
    err: unknown,
    t: Translator,
  ): BadGatewayException | ServiceUnavailableException {
    const fallback = t('errorZendeskFailed', {
      detail: err instanceof Error ? err.message : String(err),
    });
    if (!(err instanceof ZendeskError)) {
      return new BadGatewayException(fallback);
    }
    switch (err.code) {
      case 'CONFIG':
        return new ServiceUnavailableException(
          t('errorZendeskConfig', { detail: err.message }),
        );
      case 'HTTP':
        if (err.status === 404) {
          return new BadRequestException(
            t('errorTicketNotFound', { ticketId: err.detail ?? '' }),
          );
        }
        return new BadGatewayException(
          t('errorZendeskHttp', {
            status: err.status ?? 0,
            detail: err.detail ?? '',
          }),
        );
      case 'UNREACHABLE':
      case 'PARSE':
        return new ServiceUnavailableException(fallback);
    }
  }

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
  ): Promise<{ applicationId: string; ticketId: string; ticketUrl: string | null }> {
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

    // The grant authority's database is read-only: the lines go to a
    // Zendesk ticket as a GeoJSON attachment instead of PostGIS.
    const attachmentLines = validatedToAttachmentLines(validated, applicationId);
    const parcelNames = Object.fromEntries(
      parcels
        .filter((p) => p.properties.parcel_name)
        .map((p) => [p.properties.parcel_id, p.properties.parcel_name]),
    );
    const attachment = buildWindbreakAttachment(
      {
        applicationId,
        kennitala: this.demoKennitala,
        submittedAt: now,
        parcelNames,
      },
      attachmentLines,
    );
    const parcelLabel =
      attachment.parcelIds.map((id) => parcelNames[id] ?? id).join(', ') ||
      t('ticketNoParcels');

    let ticket;
    try {
      ticket = await this.zendeskService.createWindbreakTicket({
        applicationId,
        kennitala: this.demoKennitala,
        subject: t('ticketSubject', {
          applicationId,
          kennitala: this.demoKennitala,
        }),
        comment: t('ticketBody', {
          count: attachmentLines.length,
          total: Math.round(attachment.totalLengthM),
          parcels: parcelLabel,
          kennitala: this.demoKennitala,
        }),
        attachment: {
          filename: attachment.filename,
          content: attachment.content,
        },
      });
    } catch (err) {
      throw this.zendeskError(err, t);
    }

    return {
      applicationId,
      ticketId: ticket.ticketId,
      ticketUrl: ticket.ticketUrl,
    };
  }

  /** Read the Zendesk ticket back for the confirmation page. */
  async getSubmittedContext(
    ticketId: string,
    locale: Locale,
  ): Promise<SubmittedContext> {
    const t = createTranslator(locale);
    let ticket;
    try {
      ticket = await this.zendeskService.getTicket(ticketId);
    } catch (err) {
      throw this.zendeskError(err, t);
    }
    // The WB-... reference lives in the ticket subject.
    const match = /(WB-\d{4}-[A-Z0-9]+)/.exec(ticket.subject ?? '');
    return {
      ticketId: ticket.ticketId,
      ticketUrl: ticket.ticketUrl,
      applicationId: match ? match[1] : null,
      submittedAt: ticket.createdAt,
    };
  }
}

/** Generate a human friendly application id, e.g. WB-2026-K3F9XA. */
export function newApplicationId(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WB-${year}-${rand}`;
}
