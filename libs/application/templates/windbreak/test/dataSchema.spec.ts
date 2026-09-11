/**
 * The zod data schema is the contract between the client and the server:
 * answers that validate here may be submitted. Shape-level only - geometry
 * rules (inside the land, no crossings) are the map lib's job.
 */
import { windbreakAnswersSchema } from '../src/dataSchema';
import type { WindbreakAnswers } from '../src/dataSchema';

function validAnswers(overrides: Partial<WindbreakAnswers> = {}): WindbreakAnswers {
  return {
    lines: [
      {
        clientId: 'line-1',
        lengthM: 150.5,
        feature: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-21.830402, 65.450042],
              [-21.820402, 65.450042],
            ],
          },
          properties: {},
        },
      },
    ],
    ...overrides,
  };
}

describe('windbreakAnswersSchema', () => {
  it('accepts drawn lines with lengths and features', () => {
    const result = windbreakAnswersSchema.safeParse(validAnswers());
    expect(result.success).toBe(true);
  });

  it('accepts an application without lines (draft is allowed)', () => {
    const result = windbreakAnswersSchema.safeParse({ lines: [] });
    expect(result.success).toBe(true);
  });

  it.each([
    ['lines missing', {}],
    ['lines not an array', { lines: 'nope' }],
    ['line without clientId', { lines: [validAnswers().lines[0].feature] }],
    ['negative length', {
      lines: [{ ...validAnswers().lines[0], lengthM: -5 }],
    }],
    ['line with <2 positions', {
      lines: [
        {
          ...validAnswers().lines[0],
          feature: {
            ...validAnswers().lines[0].feature,
            geometry: {
              type: 'LineString',
              coordinates: [[-21.830402, 65.450042]],
            },
          },
        },
      ],
    }],
    ['point geometry instead of a line', {
      lines: [
        {
          ...validAnswers().lines[0],
          feature: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-21.830402, 65.450042] },
            properties: {},
          },
        },
      ],
    }],
  ])('rejects %s', (_label, answers) => {
    const result = windbreakAnswersSchema.safeParse(answers);
    expect(result.success).toBe(false);
  });

  it('defaults missing feature properties to an empty object', () => {
    const { feature } = validAnswers().lines[0];
    const noProps = { ...feature, properties: undefined };
    const result = windbreakAnswersSchema.safeParse({
      lines: [{ ...validAnswers().lines[0], feature: noProps }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines[0].feature.properties).toEqual({});
    }
  });
});
