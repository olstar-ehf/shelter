/**
 * Server-side client for the NestJS demo API: the Next.js host queries the
 * island.is-style GraphQL domain (web -> API separation, over GraphQL like
 * island.is apps) instead of the ad-hoc JSON endpoints.
 */

import { gqlRequest } from './graphql';

export interface ApplyContextPayload {
  locale: string;
  identity: { fullName: string; kennitala: string };
  error?: string;
  lookupSummary?: string;
  parcels?: unknown[];
  windbreaks?: unknown[];
  basemap?: { tileUrl: string; attribution: string; maxZoom?: number };
}

export interface TicketPayload {
  locale: string;
  error?: string;
  ticket?: {
    ticketId: string;
    ticketUrl: string | null;
    applicationId: string | null;
    submittedAt: string;
  };
}

interface ContextQueryResult {
  windbreakApplicationContext: {
    identity: { fullName: string; kennitala: string };
    landeignarnumer: number[];
    lookupSummary: string;
    parcels: unknown;
    windbreaks: unknown;
    basemap: { tileUrl: string; attribution: string; maxZoom: number | null };
  };
}

const CONTEXT_QUERY = `
  query WindbreakApplicationContext($locale: String!) {
    windbreakApplicationContext(locale: $locale) {
      identity { fullName kennitala }
      landeignarnumer
      lookupSummary
      parcels
      windbreaks
      basemap { tileUrl attribution maxZoom }
    }
  }
`;

const TICKET_QUERY = `
  query WindbreakSubmittedApplication($ticketId: String!, $locale: String!) {
    windbreakSubmittedApplication(ticketId: $ticketId, locale: $locale) {
      ticketId
      ticketUrl
      applicationId
      submittedAt
    }
  }
`;

const SUBMIT_MUTATION = `
  mutation SubmitWindbreakApplication($answers: JSON!, $locale: String!) {
    submitWindbreakApplication(answers: $answers, locale: $locale) {
      applicationId
      ticketId
      ticketUrl
    }
  }
`;

export async function fetchApplyContext(
  locale: string,
): Promise<ApplyContextPayload> {
  const data = await gqlRequest<ContextQueryResult>(CONTEXT_QUERY, { locale });
  const ctx = data.windbreakApplicationContext;
  return {
    locale,
    identity: ctx.identity,
    lookupSummary: ctx.lookupSummary,
    parcels: ctx.parcels as unknown[],
    windbreaks: ctx.windbreaks as unknown[],
    basemap: {
      tileUrl: ctx.basemap.tileUrl,
      attribution: ctx.basemap.attribution,
      ...(ctx.basemap.maxZoom !== null && ctx.basemap.maxZoom !== undefined
        ? { maxZoom: ctx.basemap.maxZoom }
        : {}),
    },
  };
}

export async function fetchTicket(
  ticketId: string,
  locale: string,
): Promise<TicketPayload> {
  const data = await gqlRequest<{
    windbreakSubmittedApplication: TicketPayload['ticket'];
  }>(TICKET_QUERY, { ticketId, locale });
  return { locale, ticket: data.windbreakSubmittedApplication };
}

/** Submit the drawn lines; throws the localized error message on failure. */
export async function submitApplication(
  answers: unknown,
  locale: string,
): Promise<{
  applicationId: string;
  ticketId: string;
  ticketUrl: string | null;
}> {
  const data = await gqlRequest<{
    submitWindbreakApplication: {
      applicationId: string;
      ticketId: string;
      ticketUrl: string | null;
    };
  }>(SUBMIT_MUTATION, { answers, locale });
  return data.submitWindbreakApplication;
}

export { API_BASE } from './graphql';
