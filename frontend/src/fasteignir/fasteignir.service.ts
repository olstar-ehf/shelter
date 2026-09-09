import { Injectable } from '@nestjs/common';
import type { FasteignSimpleWrapper } from './fasteignir.types';

/**
 * Typed domain error for the Fasteignir-Xroad lookup, so callers can map
 * failures to localized messages without depending on HTTP exceptions:
 *
 *  - 'NO_TOKEN'    - FASTEIGNIR_TOKEN is not configured
 *  - 'UNREACHABLE' - network failure talking to the X-Road endpoint
 *  - 'HTTP'        - the endpoint answered with a non-2xx status
 *  - 'PARSE'       - the response body is not a valid Fasteignir payload
 */
export class PropertiesLookupError extends Error {
  readonly code: 'NO_TOKEN' | 'UNREACHABLE' | 'HTTP' | 'PARSE';
  readonly status?: number;
  readonly detail?: string;

  constructor(
    code: PropertiesLookupError['code'],
    message: string,
    extra?: { status?: number; detail?: string },
  ) {
    super(message);
    this.name = 'PropertiesLookupError';
    this.code = code;
    this.status = extra?.status;
    this.detail = extra?.detail;
  }
}

/**
 * Fasteignir-Xroad: look up the properties ("fasteignir") registered on a
 * kennitala. The real service is reached through Iceland's X-Road and
 * requires a Bearer token from island.is login.
 */
export abstract class FasteignirService {
  abstract getFasteignir(kennitala: string): Promise<FasteignSimpleWrapper>;
}

/**
 * Validate the shape of a Fasteignir-Xroad response and normalize it.
 * Pure function - unit tested against recorded fixtures (the real client
 * only adds transport).
 */
export function parseFasteignirResponse(body: unknown): FasteignSimpleWrapper {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new PropertiesLookupError('PARSE', 'Fasteignir response is not an object');
  }
  const wrapper = body as Record<string, unknown>;
  const fasteignir = wrapper.fasteignir;
  if (fasteignir !== undefined && fasteignir !== null && !Array.isArray(fasteignir)) {
    throw new PropertiesLookupError('PARSE', 'Fasteignir "fasteignir" is not an array');
  }
  for (const entry of (fasteignir as unknown[]) ?? []) {
    if (typeof entry !== 'object' || entry === null) {
      throw new PropertiesLookupError('PARSE', 'Fasteignir entry is not an object');
    }
    const e = entry as Record<string, unknown>;
    const stadfang = e.sjalfgefidStadfang;
    if (
      stadfang !== undefined &&
      stadfang !== null &&
      (typeof stadfang !== 'object' ||
        typeof (stadfang as Record<string, unknown>).landeignarnumer !== 'number')
    ) {
      throw new PropertiesLookupError(
        'PARSE',
        'Fasteignir sjalfgefidStadfang.landeignarnumer is not a number',
      );
    }
  }
  return body as FasteignSimpleWrapper;
}

/**
 * Mock implementation for the prototype.
 *
 * Demo data: kennitala 2409693949 owns two registered properties (a house
 * and an outbuilding) that both sit on the same land,
 * landeignarnumer 163368. The two entries deliberately share the
 * landeignarnumer so the "unique landeignarnumer list" step is exercised.
 * 061050-4429 (Garpsdalur, landeignarnumer 139555) is also known.
 */
@Injectable()
export class MockFasteignirService extends FasteignirService {
  private readonly data: Record<string, FasteignSimpleWrapper> = {
    '2409693949': {
      fasteignir: [
        {
          fasteignanumer: 'F2620115',
          sjalfgefidStadfang: {
            stadfanganumer: 2341005,
            landeignarnumer: 163368,
            postnumer: 880,
            sveitarfelagBirting: 'Skaftárhreppur',
            birting: 'Jörð 163368, 880 Kirkjubæjarklaustur',
            birtingStutt: 'Jörð 163368',
          },
        },
        {
          fasteignanumer: 'F2620116',
          sjalfgefidStadfang: {
            stadfanganumer: 2341006,
            landeignarnumer: 163368,
            postnumer: 880,
            sveitarfelagBirting: 'Skaftárhreppur',
            birting: 'Jörð 163368 - útihús, 880 Kirkjubæjarklaustur',
            birtingStutt: 'Jörð 163368 - útihús',
          },
        },
      ],
      paging: {
        page: 1,
        pageSize: 25,
        total: 2,
        totalPages: 1,
        offset: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    },
    '061050-4429': {
      fasteignir: [
        {
          fasteignanumer: 'F13955501',
          sjalfgefidStadfang: {
            stadfanganumer: 2100555,
            landeignarnumer: 139555,
            postnumer: 381,
            sveitarfelagBirting: 'Reykhólahreppur',
            birting: 'Garpsdalur, 381 Reykhólahreppur',
            birtingStutt: 'Garpsdalur',
          },
        },
      ],
      paging: {
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
        offset: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    },
  };

  async getFasteignir(kennitala: string): Promise<FasteignSimpleWrapper> {
    return (
      this.data[kennitala] ?? {
        fasteignir: [],
        paging: {
          page: 1,
          pageSize: 25,
          total: 0,
          totalPages: 0,
          offset: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      }
    );
  }
}

/** Default base URL of the Fasteignir-Xroad gateway (overridable via env). */
export const FASTEIGNIR_DEFAULT_API_URL = 'https://api.fasteignaskra.is';

/**
 * Real X-Road client (default). Configure with FASTEIGNIR_API_URL (default
 * https://api.fasteignaskra.is) and FASTEIGNIR_TOKEN, an island.is Bearer
 * JWT. Failures are reported as typed PropertiesLookupError codes so the
 * caller can localize them.
 */
@Injectable()
export class XroadFasteignirService extends FasteignirService {
  private readonly baseUrl = (
    process.env.FASTEIGNIR_API_URL || FASTEIGNIR_DEFAULT_API_URL
  ).replace(/\/+$/, '');

  async getFasteignir(kennitala: string): Promise<FasteignSimpleWrapper> {
    const token = process.env.FASTEIGNIR_TOKEN;
    if (!token) {
      throw new PropertiesLookupError(
        'NO_TOKEN',
        'Fasteignir-Xroad requires FASTEIGNIR_TOKEN (island.is Bearer JWT).',
      );
    }
    const url = `${this.baseUrl}/business/fasteignir-xroad/api/v1/fasteignir?kennitala=${encodeURIComponent(kennitala)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        // X-Road backends can be slow; give the lookup a hard bound.
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new PropertiesLookupError(
        'UNREACHABLE',
        `Cannot reach Fasteignir-Xroad at ${this.baseUrl}.`,
      );
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      throw new PropertiesLookupError('HTTP', `Fasteignir-Xroad returned HTTP ${res.status}`, {
        status: res.status,
        detail,
      });
    }
    const body: unknown = await res.json().catch(() => undefined);
    return parseFasteignirResponse(body);
  }
}
