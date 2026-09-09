/**
 * Contract tests for the Fasteignir-Xroad integration.
 *
 * The wire shape is pinned by frontend/Fasteignir-Xroad.json (the OpenAPI
 * specification of GET /api/v1/fasteignir, components.schemas
 * FasteignSimpleWrapper). These tests lock the real client to that shape
 * with recorded fixtures, so the X-Road client can be swapped/upgraded
 * without silently breaking the landeignarnumer lookup.
 */
import {
  parseFasteignirResponse,
  PropertiesLookupError,
  XroadFasteignirService,
} from '../src/fasteignir/fasteignir.service';
import { uniqueLandeignarnumer } from '../src/fasteignir/fasteignir.types';
import type { FasteignSimpleWrapper } from '../src/fasteignir/fasteignir.types';

/** Fixture recorded from the real API shape (schema-conformant). */
const recordedResponse: FasteignSimpleWrapper = {
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
    {
      // A property without an address/land association must be tolerated.
      fasteignanumer: 'F2620999',
      sjalfgefidStadfang: null,
    },
  ],
  paging: {
    page: 1,
    pageSize: 25,
    total: 3,
    totalPages: 1,
    offset: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  },
};

describe('parseFasteignirResponse (schema contract)', () => {
  it('parses a schema-conformant response', () => {
    const parsed = parseFasteignirResponse(recordedResponse);
    expect(parsed.fasteignir).toHaveLength(3);
  });

  it('tolerates null fasteignir (empty result set)', () => {
    expect(parseFasteignirResponse({ fasteignir: null })).toEqual({
      fasteignir: null,
    });
  });

  it.each([
    ['a non-object body', 'nope'],
    ['an array body', [1, 2]],
    ['fasteignir not an array', { fasteignir: {} }],
    ['a non-object entry', { fasteignir: [42] }],
    [
      'a non-numeric landeignarnumer',
      {
        fasteignir: [
          { sjalfgefidStadfang: { landeignarnumer: '163368' } },
        ],
      },
    ],
  ])('rejects %s with PARSE', (_label, body) => {
    expect(() => parseFasteignirResponse(body)).toThrow(PropertiesLookupError);
    try {
      parseFasteignirResponse(body);
    } catch (err) {
      expect((err as PropertiesLookupError).code).toBe('PARSE');
    }
  });
});

describe('uniqueLandeignarnumer', () => {
  it('deduplicates lands shared by several properties and keeps order', () => {
    expect(uniqueLandeignarnumer(recordedResponse)).toEqual([163368]);
  });

  it('collects several lands in first-seen order', () => {
    const wrapper: FasteignSimpleWrapper = {
      fasteignir: [
        { sjalfgefidStadfang: { landeignarnumer: 2 } },
        { sjalfgefidStadfang: { landeignarnumer: 1 } },
        { sjalfgefidStadfang: { landeignarnumer: 2 } },
        {},
      ],
    };
    expect(uniqueLandeignarnumer(wrapper)).toEqual([2, 1]);
  });

  it('returns an empty list for an empty response', () => {
    expect(uniqueLandeignarnumer({ fasteignir: [] })).toEqual([]);
  });
});

describe('XroadFasteignirService (transport contract)', () => {
  const originalToken = process.env.FASTEIGNIR_TOKEN;
  const originalUrl = process.env.FASTEIGNIR_API_URL;

  afterEach(() => {
    delete process.env.FASTEIGNIR_TOKEN;
    delete process.env.FASTEIGNIR_API_URL;
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (originalToken) {
      process.env.FASTEIGNIR_TOKEN = originalToken;
    }
    if (originalUrl) {
      process.env.FASTEIGNIR_API_URL = originalUrl;
    }
  });

  const mockFetch = (impl: (url: string, init: RequestInit) => Promise<unknown>) => {
    const fn = jest.fn(impl as never);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  };

  it('fails with NO_TOKEN when the Bearer token is missing', async () => {
    const service = new XroadFasteignirService();
    await expect(service.getFasteignir('2409693949')).rejects.toMatchObject({
      code: 'NO_TOKEN',
    });
  });

  it('calls the OpenAPI path with kennitala + Bearer auth and parses', async () => {
    process.env.FASTEIGNIR_TOKEN = 'test-jwt';
    const fetchMock = mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => recordedResponse,
    }));
    const service = new XroadFasteignirService();
    const result = await service.getFasteignir('2409693949');
    expect(result.fasteignir).toHaveLength(3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      '/business/fasteignir-xroad/api/v1/fasteignir?kennitala=2409693949',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-jwt',
    );
  });

  it('maps HTTP failures to typed errors with status + detail', async () => {
    process.env.FASTEIGNIR_TOKEN = 'test-jwt';
    mockFetch(async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    }));
    const service = new XroadFasteignirService();
    await expect(service.getFasteignir('2409693949')).rejects.toMatchObject({
      code: 'HTTP',
      status: 401,
      detail: 'unauthorized',
    });
  });

  it('maps network failures to UNREACHABLE', async () => {
    process.env.FASTEIGNIR_TOKEN = 'test-jwt';
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const service = new XroadFasteignirService();
    await expect(service.getFasteignir('2409693949')).rejects.toMatchObject({
      code: 'UNREACHABLE',
    });
  });

  it('maps a malformed 200 body to PARSE', async () => {
    process.env.FASTEIGNIR_TOKEN = 'test-jwt';
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ fasteignir: 'not-an-array' }),
    }));
    const service = new XroadFasteignirService();
    await expect(service.getFasteignir('2409693949')).rejects.toMatchObject({
      code: 'PARSE',
    });
  });
});
