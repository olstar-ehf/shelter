/**
 * React-free entry of the windbreak application template
 * (@island.is/application/templates/windbreak/server): everything the
 * NestJS server needs - the zod data schema, states, the form definition
 * and the message catalogs - without pulling React into the server bundle.
 */
export { windbreakAnswersSchema } from './dataSchema';
export type {
  WindbreakAnswers,
  WindbreakLineAnswer,
} from './dataSchema';
export { windbreakTemplate, windbreakForm, windbreakSteps } from './form';
export {
  canTransition,
  transition,
  windbreakStates,
} from './states';
export {
  messages,
  flattenMessages,
  windbreakEn,
  windbreakIs,
} from './messages';
export type {
  TemplateLocale,
  WindbreakTemplateMessages,
} from './messages';
export type {
  WindbreakApplication,
  WindbreakApplicationState,
  WindbreakApplicationEvent,
  WindbreakExternalData,
  WindbreakFieldDefinition,
  WindbreakFormDefinition,
  WindbreakLinesFieldDefinition,
  WindbreakLinesMode,
  WindbreakSectionDefinition,
  WindbreakStepDefinition,
  WindbreakTemplateDefinition,
} from './types';
