import { windbreakAnswersSchema } from './dataSchema';
import type {
  WindbreakFormDefinition,
  WindbreakStepDefinition,
  WindbreakTemplateDefinition,
} from './types';
import { windbreakStates } from './states';

/**
 * The declarative form of the windbreak application.
 *
 * Section ids double as UI modes for the custom map field: 'draw' shows the
 * map with the drawing tools and the live validation table, 'review' shows
 * the same field read-only with the review panel and the submit actions.
 */
export const windbreakForm: WindbreakFormDefinition = {
  sections: [
    {
      id: 'draw',
      titleId: 'windbreak.draw.title',
      helpId: 'windbreak.draw.helpParcels',
      fields: [{ id: 'lines', type: 'windbreakLines', mode: 'draw' }],
    },
    {
      id: 'review',
      titleId: 'windbreak.review.title',
      helpId: 'windbreak.review.help',
      fields: [{ id: 'lines', type: 'windbreakLines', mode: 'review' }],
    },
  ],
};

/** The 4 steps shown in the stepper. */
export const windbreakSteps: WindbreakStepDefinition[] = [
  { id: 'details', labelId: 'windbreak.step.yourDetails' },
  { id: 'draw', labelId: 'windbreak.step.drawWindbreak' },
  { id: 'review', labelId: 'windbreak.step.review' },
  { id: 'submitted', labelId: 'windbreak.step.submitted' },
];

/**
 * The windbreak grant application template (island.is style): id + name,
 * the zod data schema validating the answers, the allowed states and the
 * declarative form. The React renderer (ApplicationFlow + field registry)
 * lives in index.tsx/fields - this definition is what the application
 * system and the server act on.
 */
export const windbreakTemplate: WindbreakTemplateDefinition = {
  id: 'windbreak',
  typeId: 'windbreak',
  name: { en: 'Windbreak grant', is: 'Skjólbeltastyrkur' },
  dataSchema: windbreakAnswersSchema,
  states: windbreakStates,
  steps: windbreakSteps,
  form: windbreakForm,
};
