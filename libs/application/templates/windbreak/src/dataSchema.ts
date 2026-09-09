import { z } from 'zod';

/**
 * Answers of the windbreak application (island.is style: answers are
 * validated by the template's dataSchema both client side and, again, on
 * the server before the application is stored).
 */

const positionSchema = z.array(z.number()).min(2);

/** One drawn line as stored in the answers. */
export const windbreakLineAnswerSchema = z.object({
  /** Stable client-side id (kept for React keys). */
  clientId: z.string().min(1),
  /** Length in metres as measured when drawn. */
  lengthM: z.number().finite().positive(),
  feature: z.object({
    type: z.literal('Feature'),
    geometry: z.object({
      type: z.literal('LineString'),
      coordinates: z.array(positionSchema).min(2),
    }),
    properties: z.record(z.unknown()).default({}),
  }),
});

export const windbreakAnswersSchema = z.object({
  /** The windbreak lines drawn on the map (at least one to submit). */
  lines: z.array(windbreakLineAnswerSchema),
});

export type WindbreakLineAnswer = z.infer<typeof windbreakLineAnswerSchema>;
export type WindbreakAnswers = z.infer<typeof windbreakAnswersSchema>;
