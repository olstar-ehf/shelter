import { Injectable } from '@nestjs/common';

/**
 * Zendesk Support API v2 integration (real client) + mock.
 *
 * The grant authority has read-only database access, so submitted windbreak
 * lines are NOT written to PostGIS anymore: submitting an application
 * creates a Zendesk ticket and uploads the drawn lines as a GeoJSON
 * attachment (classic two-step flow: POST /api/v2/uploads.json -> token,
 * then POST /api/v2/tickets.json with comment.uploads = [token]).
 *
 * Configuration (real client, used unless ZENDESK_MOCK=true):
 *   ZENDESK_SUBDOMAIN  e.g. "myagency"  -> https://myagency.zendesk.com
 *   ZENDESK_EMAIL      agent login email
 *   ZENDESK_API_TOKEN  API token (basic auth: {email}/token:{token})
 */

export interface ZendeskTicketResult {
  /** Numeric Zendesk ticket id (as shown in the agent UI). */
  ticketId: string;
  /** Agent-facing URL, when the subdomain is configured. */
  ticketUrl: string | null;
}

export interface ZendeskTicket extends ZendeskTicketResult {
  subject: string;
  status: string;
  createdAt: string;
}

/** Payload for a new windbreak application ticket. */
export interface CreateWindbreakTicketInput {
  applicationId: string;
  kennitala: string;
  subject: string;
  /** Comment body (shown to the support agent). */
  comment: string;
  /** GeoJSON attachment (the drawn windbreak lines). */
  attachment: { filename: string; content: string };
}

/** Typed failures so callers can map to localized messages. */
export class ZendeskError extends Error {
  readonly code: 'CONFIG' | 'UNREACHABLE' | 'HTTP' | 'PARSE';
  readonly status?: number;
  readonly detail?: string;

  constructor(
    code: ZendeskError['code'],
    message: string,
    extra?: { status?: number; detail?: string },
  ) {
    super(message);
    this.name = 'ZendeskError';
    this.code = code;
    this.status = extra?.status;
    this.detail = extra?.detail;
  }
}

export abstract class ZendeskService {
  abstract createWindbreakTicket(
    input: CreateWindbreakTicketInput,
  ): Promise<ZendeskTicketResult>;

  /** Read a ticket back for the confirmation page. */
  abstract getTicket(ticketId: string): Promise<ZendeskTicket>;
}

/** Zendesk Support API base URL for a subdomain. */
export function zendeskBaseUrl(subdomain: string): string {
  return `https://${subdomain.replace(/\.zendesk\.com$/, '')}.zendesk.com`;
}

/**
 * Real Zendesk Support API client (default). Configure with
 * ZENDESK_SUBDOMAIN, ZENDESK_EMAIL and ZENDESK_API_TOKEN.
 */
@Injectable()
export class ZendeskApiService extends ZendeskService {
  private readonly subdomain: string;
  private readonly email: string;
  private readonly token: string;

  constructor() {
    super();
    this.subdomain = process.env.ZENDESK_SUBDOMAIN || '';
    this.email = process.env.ZENDESK_EMAIL || '';
    this.token = process.env.ZENDESK_API_TOKEN || '';
    const missing = [
      !this.subdomain && 'ZENDESK_SUBDOMAIN',
      !this.email && 'ZENDESK_EMAIL',
      !this.token && 'ZENDESK_API_TOKEN',
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new ZendeskError(
        'CONFIG',
        `Zendesk is not configured: ${missing.join(', ')} (or ZENDESK_MOCK=true)`,
      );
    }
  }

  private get baseUrl(): string {
    return zendeskBaseUrl(this.subdomain);
  }

  private authHeaders(): Record<string, string> {
    const credentials = Buffer.from(
      `${this.email}/token:${this.token}`,
      'utf8',
    ).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
    };
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...this.authHeaders(),
          ...((init.headers as Record<string, string>) ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ZendeskError(
        'UNREACHABLE',
        `Cannot reach Zendesk at ${this.baseUrl}.`,
      );
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      throw new ZendeskError('HTTP', `Zendesk returned HTTP ${res.status}`, {
        status: res.status,
        detail,
      });
    }
    const body: unknown = await res.json().catch(() => undefined);
    if (typeof body !== 'object' || body === null) {
      throw new ZendeskError('PARSE', 'Zendesk response could not be parsed.');
    }
    return body as T;
  }

  async createWindbreakTicket(
    input: CreateWindbreakTicketInput,
  ): Promise<ZendeskTicketResult> {
    // 1) Upload the GeoJSON attachment.
    const uploadBody = await this.requestJson<{
      upload: { token?: string };
    }>(
      `/api/v2/uploads.json?filename=${encodeURIComponent(input.attachment.filename)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input.attachment.content,
      },
    );
    const uploadToken = uploadBody?.upload?.token;
    if (!uploadToken) {
      throw new ZendeskError(
        'PARSE',
        'Zendesk upload response did not include a token.',
      );
    }

    // 2) Create the ticket with the attachment referenced in the comment.
    const ticketBody = await this.requestJson<{ ticket?: { id?: number } }>(
      '/api/v2/tickets.json',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: {
            subject: input.subject,
            comment: {
              body: input.comment,
              uploads: [uploadToken],
            },
            tags: ['skjolbelti', 'windbreak'],
          },
        }),
      },
    );
    const ticketId = ticketBody?.ticket?.id;
    if (typeof ticketId !== 'number') {
      throw new ZendeskError(
        'PARSE',
        'Zendesk ticket response did not include an id.',
      );
    }
    return { ticketId: String(ticketId), ticketUrl: this.ticketUrl(ticketId) };
  }

  async getTicket(ticketId: string): Promise<ZendeskTicket> {
    const body = await this.requestJson<{
      ticket?: { id?: number; subject?: string; status?: string; created_at?: string };
    }>(`/api/v2/tickets/${encodeURIComponent(ticketId)}.json`, {
      method: 'GET',
    });
    const ticket = body?.ticket;
    if (!ticket || typeof ticket.id !== 'number') {
      throw new ZendeskError('PARSE', 'Zendesk ticket could not be parsed.');
    }
    return {
      ticketId: String(ticket.id),
      ticketUrl: this.ticketUrl(ticket.id),
      subject: ticket.subject ?? '',
      status: ticket.status ?? '',
      createdAt: ticket.created_at ?? new Date().toISOString(),
    };
  }

  private ticketUrl(ticketId: number): string {
    return `${this.baseUrl}/agent/tickets/${ticketId}`;
  }
}

/**
 * Mock implementation for running the prototype without Zendesk
 * credentials (ZENDESK_MOCK=true): tickets live in memory for the lifetime
 * of the server, so the confirmation page round-trip works.
 */
@Injectable()
export class MockZendeskService extends ZendeskService {
  private readonly tickets = new Map<
    string,
    ZendeskTicket & { applicationId: string }
  >();
  private nextId = 1000;

  async createWindbreakTicket(
    input: CreateWindbreakTicketInput,
  ): Promise<ZendeskTicketResult> {
    this.nextId += 1;
    const id = String(this.nextId);
    this.tickets.set(id, {
      ticketId: id,
      ticketUrl: null,
      applicationId: input.applicationId,
      subject: input.subject,
      status: 'new',
      createdAt: new Date().toISOString(),
    });
    return { ticketId: id, ticketUrl: null };
  }

  async getTicket(ticketId: string): Promise<ZendeskTicket> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new ZendeskError('HTTP', `Ticket ${ticketId} not found`, {
        status: 404,
        detail: ticketId,
      });
    }
    return ticket;
  }
}
