/**
 * Contract tests for the Zendesk submission path: the attachment builder
 * (GeoJSON FeatureCollection) and the real API client's two-step
 * upload -> ticket flow, pinned with mocked fetch.
 */
import {
  buildWindbreakAttachment,
  validatedToAttachmentLines,
  type AttachmentLine,
} from '../src/zendesk/windbreak-attachment';
import {
  MockZendeskService,
  ZendeskApiService,
  ZendeskError,
  zendeskBaseUrl,
} from '../src/zendesk/zendesk.service';
import type { Feature, LineString } from 'geojson';

function lineFeature(coords: number[][]): Feature<LineString> {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
}

describe('buildWindbreakAttachment', () => {
  const meta = {
    applicationId: 'WB-2026-TEST01',
    kennitala: '061050-4429',
    submittedAt: '2026-01-02T03:04:05Z',
    parcelNames: { 'IS-1': 'Jörð 1' },
  };
  const lines: AttachmentLine[] = [
    {
      lineId: 'WB-2026-TEST01-1',
      lengthM: 100.25,
      parcelId: 'IS-1',
      feature: lineFeature([
        [-18.55, 63.48],
        [-18.54, 63.48],
      ]),
    },
    {
      lineId: 'WB-2026-TEST01-2',
      lengthM: 50,
      parcelId: null,
      feature: lineFeature([
        [-18.53, 63.47],
        [-18.52, 63.47],
      ]),
    },
  ];

  it('builds a GeoJSON FeatureCollection with review properties', () => {
    const attachment = buildWindbreakAttachment(meta, lines);
    expect(attachment.filename).toBe('windbreaks-WB-2026-TEST01.geojson');
    expect(attachment.totalLengthM).toBeCloseTo(150.25);
    expect(attachment.parcelIds).toEqual(['IS-1']);

    const fc = JSON.parse(attachment.content) as {
      type: string;
      features: Array<{ geometry: { type: string }; properties: Record<string, unknown> }>;
    };
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry.type).toBe('LineString');
    expect(fc.features[0].properties).toMatchObject({
      line_id: 'WB-2026-TEST01-1',
      application_id: 'WB-2026-TEST01',
      kennitala: '061050-4429',
      parcel_id: 'IS-1',
      line_index: 1,
      length_m: 100.3,
      status: 'pending',
      submitted_at: '2026-01-02T03:04:05Z',
    });
  });

  it('is valid JSON with exact line coordinates', () => {
    const attachment = buildWindbreakAttachment(meta, lines);
    const fc = JSON.parse(attachment.content) as {
      features: Array<{ geometry: { coordinates: number[][] } }>;
    };
    expect(fc.features[1].geometry.coordinates).toEqual([
      [-18.53, 63.47],
      [-18.52, 63.47],
    ]);
  });
});

describe('zendeskBaseUrl', () => {
  it('normalizes subdomain input', () => {
    expect(zendeskBaseUrl('myagency')).toBe('https://myagency.zendesk.com');
    expect(zendeskBaseUrl('myagency.zendesk.com')).toBe(
      'https://myagency.zendesk.com',
    );
  });
});

describe('ZendeskApiService (transport contract)', () => {
  const original = {
    subdomain: process.env.ZENDESK_SUBDOMAIN,
    email: process.env.ZENDESK_EMAIL,
    token: process.env.ZENDESK_API_TOKEN,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(() => {
    process.env.ZENDESK_SUBDOMAIN = original.subdomain;
    process.env.ZENDESK_EMAIL = original.email;
    process.env.ZENDESK_API_TOKEN = original.token;
  });

  const mockFetch = (
    impl: (url: string, init: RequestInit) => Promise<unknown>,
  ) => {
    const fn = jest.fn(impl as never);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  };

  const input = {
    applicationId: 'WB-2026-TEST01',
    kennitala: '061050-4429',
    subject: 'Windbreak grant application WB-2026-TEST01',
    comment: '1 line (150 m)',
    attachment: { filename: 'windbreaks-WB-2026-TEST01.geojson', content: '{}' },
  };

  it('fails with CONFIG when credentials are missing', () => {
    delete process.env.ZENDESK_SUBDOMAIN;
    delete process.env.ZENDESK_EMAIL;
    delete process.env.ZENDESK_API_TOKEN;
    expect(() => new ZendeskApiService()).toThrow(ZendeskError);
    try {
      new ZendeskApiService();
    } catch (err) {
      expect((err as ZendeskError).code).toBe('CONFIG');
    }
  });

  it('uploads the attachment then creates the ticket with its token', async () => {
    process.env.ZENDESK_SUBDOMAIN = 'myagency';
    process.env.ZENDESK_EMAIL = 'agent@example.com';
    process.env.ZENDESK_API_TOKEN = 'secret';
    const fetchMock = mockFetch(async (url: string, init: RequestInit) => {
      if (url.includes('/uploads.json')) {
        expect(init.method).toBe('POST');
        expect(String(init.body)).toBe('{}');
        expect(url).toContain('filename=windbreaks-WB-2026-TEST01.geojson');
        return { ok: true, status: 201, json: async () => ({ upload: { token: 'tok-123' } }) };
      }
      if (url.endsWith('/api/v2/tickets.json')) {
        const body = JSON.parse(String(init.body)) as {
          ticket: { comment: { uploads: string[] }; subject: string };
        };
        expect(body.ticket.comment.uploads).toEqual(['tok-123']);
        expect(body.ticket.subject).toBe(input.subject);
        return { ok: true, status: 201, json: async () => ({ ticket: { id: 424242 } }) };
      }
      throw new Error(`unexpected url ${url}`);
    });
    const service = new ZendeskApiService();
    const result = await service.createWindbreakTicket(input);
    expect(result).toEqual({
      ticketId: '424242',
      ticketUrl: 'https://myagency.zendesk.com/agent/tickets/424242',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('https://myagency.zendesk.com/api/v2/uploads.json');
    const auth = ((init.headers as Record<string, string>).Authorization ?? '') as string;
    const expected = Buffer.from('agent@example.com/token:secret').toString('base64');
    expect(auth).toBe(`Basic ${expected}`);
  });

  it('maps HTTP failures to typed errors', async () => {
    process.env.ZENDESK_SUBDOMAIN = 'myagency';
    process.env.ZENDESK_EMAIL = 'agent@example.com';
    process.env.ZENDESK_API_TOKEN = 'secret';
    mockFetch(async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    }));
    const service = new ZendeskApiService();
    await expect(service.createWindbreakTicket(input)).rejects.toMatchObject({
      code: 'HTTP',
      status: 401,
    });
  });

  it('reads a ticket back for the confirmation page', async () => {
    process.env.ZENDESK_SUBDOMAIN = 'myagency';
    process.env.ZENDESK_EMAIL = 'agent@example.com';
    process.env.ZENDESK_API_TOKEN = 'secret';
    mockFetch(async (url: string) => {
      expect(url).toContain('/api/v2/tickets/424242.json');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ticket: {
            id: 424242,
            subject: 'Windbreak grant application WB-2026-TEST01 (kennitala 061050-4429)',
            status: 'new',
            created_at: '2026-01-02T03:04:05Z',
          },
        }),
      };
    });
    const service = new ZendeskApiService();
    const ticket = await service.getTicket('424242');
    expect(ticket).toMatchObject({
      ticketId: '424242',
      status: 'new',
      createdAt: '2026-01-02T03:04:05Z',
    });
    expect(ticket.subject).toContain('WB-2026-TEST01');
  });
});

describe('MockZendeskService', () => {
  it('round-trips a ticket and reports missing tickets', async () => {
    const service = new MockZendeskService();
    const created = await service.createWindbreakTicket({
      applicationId: 'WB-2026-MOCK01',
      kennitala: '061050-4429',
      subject: 'subject',
      comment: 'comment',
      attachment: { filename: 'a.geojson', content: '{}' },
    });
    expect(created.ticketUrl).toBeNull();
    const ticket = await service.getTicket(created.ticketId);
    expect(ticket.subject).toBe('subject');
    await expect(service.getTicket('999999')).rejects.toMatchObject({
      code: 'HTTP',
      status: 404,
    });
  });
});
