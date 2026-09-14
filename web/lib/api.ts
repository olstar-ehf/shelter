/**
 * Server-side client for the NestJS demo API: the Next.js host fetches the
 * page context from the API (island.is-style web -> API separation) instead
 * of re-implementing the domain services.
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export interface ApplyContextPayload {
  locale: string;
  identity: { fullName: string; kennitala: string };
  error?: string;
  lookupSummary?: string;
  parcels?: unknown[];
  windbreaks?: unknown[];
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

export async function fetchApplyContext(
  locale: string,
): Promise<ApplyContextPayload> {
  const res = await fetch(
    `${API_BASE}/api/context?lang=${encodeURIComponent(locale)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(`API returned HTTP ${res.status} for /api/context`);
  }
  return (await res.json()) as ApplyContextPayload;
}

export async function fetchTicket(
  ticketId: string,
  locale: string,
): Promise<TicketPayload> {
  const res = await fetch(
    `${API_BASE}/api/ticket/${encodeURIComponent(ticketId)}?lang=${encodeURIComponent(locale)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(`API returned HTTP ${res.status} for /api/ticket`);
  }
  return (await res.json()) as TicketPayload;
}

export { API_BASE };
