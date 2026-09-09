import type { ComponentType } from 'react';
import { WindbreakLinesField } from './WindbreakLinesField';
import type {
  WindbreakFieldDefinition,
  WindbreakLinesFieldValueProps,
} from '../types';

/**
 * The field registry (island.is style): field definitions in the declarative
 * form only carry a type id; rendering is resolved here. Adding a new field
 * type means adding an entry - the form definition and the schema can
 * reference it without importing React.
 */
export const windbreakFieldRegistry = {
  windbreakLines: WindbreakLinesField,
} satisfies Record<
  WindbreakFieldDefinition['type'],
  ComponentType<WindbreakLinesFieldValueProps>
>;

export type WindbreakFieldComponent =
  (typeof windbreakFieldRegistry)[WindbreakFieldDefinition['type']];

export { WindbreakLinesField };
