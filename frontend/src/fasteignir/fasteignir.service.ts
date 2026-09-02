import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { FasteignSimpleWrapper } from './fasteignir.types';

/**
 * Fasteignir-Xroad: look up the properties ("fasteignir") registered on a
 * kennitala. The real service is reached through Iceland's X-Road and
 * requires a Bearer token from island.is login - because we cannot obtain
 * one in this prototype, a mock implementation is used instead
 * (FASTEIGNIR_MOCK, enabled by default).
 */
export abstract class FasteignirService {
  abstract getFasteignir(kennitala: string): Promise<FasteignSimpleWrapper>;
}

/**
 * Mock implementation for the prototype.
 *
 * Demo data: kennitala 2409693949 owns two registered properties (a house
 * and an outbuilding) that both sit on the same land,
 * landeignarnumer 163368. The two entries deliberately share the
 * landeignarnumer so the "unique landeignarnumer list" step is exercised.
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

/**
 * Real X-Road client. Used when FASTEIGNIR_MOCK=false with
 * FASTEIGNIR_API_URL and a FASTEIGNIR_TOKEN (island.is Bearer JWT).
 */
@Injectable()
export class XroadFasteignirService extends FasteignirService {
  private readonly baseUrl = (
    process.env.FASTEIGNIR_API_URL || 'https://api.fasteignaskra.is'
  ).replace(/\/+$/, '');

  async getFasteignir(kennitala: string): Promise<FasteignSimpleWrapper> {
    const token = process.env.FASTEIGNIR_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException(
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
      });
    } catch {
      throw new ServiceUnavailableException(
        `Cannot reach Fasteignir-Xroad at ${this.baseUrl}.`,
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Fasteignir-Xroad returned HTTP ${res.status} (${await res.text().catch(() => '')})`,
      );
    }
    return (await res.json()) as FasteignSimpleWrapper;
  }
}
