import type {
  WindbreakBasemap,
  WindbreakFeature,
  WindbreakLine,
} from '@island.is/map/server';
import type { WindbreakAnswers } from './dataSchema';

/**
 * The application system's core types, island.is style: an application is a
 * type id + answers + state; a template is a data schema + states + a
 * declarative form. Field components are plugged in through the field
 * registry (fields/index.tsx) keyed by field type.
 *
 * This module must stay React-free: it is shared with the NestJS server
 * through @island.is/application/templates/windbreak/server.
 */

/** Application states of the windbreak template. */
export type WindbreakApplicationState = 'draft' | 'submitted';

/** Events that move the application between states. */
export type WindbreakApplicationEvent = { type: 'SUBMIT' };

/** Metadata of the template, per locale. */
export interface LocalizedText {
  en: string;
  is: string;
}

/** A windbreak application, as the application system would persist it. */
export interface WindbreakApplication {
  id: string;
  typeId: 'windbreak';
  state: WindbreakApplicationState;
  answers: WindbreakAnswers;
  /** Application number of the stored submission, when submitted. */
  applicationNumber?: string;
  createdAt: string;
  modifiedAt: string;
}

/** External data the draw step needs (looked up by the host, not answers). */
export interface WindbreakExternalData {
  parcels: WindbreakParcelFeature[];
  existingWindbreaks: WindbreakFeature[];
  /**
   * Basemap tile source for the map (the demo proxies the national basemap
   * through its own OGC API service). Optional - the map falls back to
   * OpenStreetMap tiles.
   */
  basemap?: WindbreakBasemap;
}

// Keep the template free of @island.is/map in its public types would be
// nice, but the map lib already owns the shared GeoJSON domain types - the
// template builds on them like island.is builds on shared libs.
export type WindbreakParcelFeature = import('@island.is/map/server').ParcelFeature;

/** How the windbreak-lines field is rendered in a given section. */
export type WindbreakLinesMode = 'draw' | 'review';

/** The custom map field definition (type 'windbreakLines'). */
export interface WindbreakLinesFieldDefinition {
  id: string;
  type: 'windbreakLines';
  mode: WindbreakLinesMode;
}

export type WindbreakFieldDefinition = WindbreakLinesFieldDefinition;

/** A fillable section/step of the application form. */
export interface WindbreakSectionDefinition {
  id: 'draw' | 'review';
  /** Message ids (template catalog) for the step heading and help text. */
  titleId: string;
  helpId: string;
  fields: WindbreakFieldDefinition[];
}

/** The declarative application form of the windbreak template. */
export interface WindbreakFormDefinition {
  sections: WindbreakSectionDefinition[];
}

/** The 4 steps shown in the stepper (chrome labels live in the template). */
export interface WindbreakStepDefinition {
  id: 'details' | 'draw' | 'review' | 'submitted';
  labelId: string;
}

/** The template definition (React-free; see application.ts). */
export interface WindbreakTemplateDefinition {
  id: 'windbreak';
  typeId: 'windbreak';
  name: LocalizedText;
  dataSchema: { safeParse: (a: unknown) => { success: boolean } };
  states: WindbreakApplicationState[];
  steps: WindbreakStepDefinition[];
  form: WindbreakFormDefinition;
}

/**
 * Props shared by every registered field component (generic registry
 * contract; typed per field via the component's own props).
 */
export interface WindbreakFieldProps {
  field: WindbreakFieldDefinition;
  locale: string;
}

/**
 * Props of the custom windbreak-lines (map) field. The map data comes from
 * the external data (parcels, existing windbreaks); the drawn lines are the
 * field value.
 */
export interface WindbreakLinesFieldValueProps extends WindbreakFieldProps {
  field: WindbreakLinesFieldDefinition;
  lines: WindbreakLine[];
  externalData: WindbreakExternalData;
  onChange: (lines: WindbreakLine[]) => void;
  /** Ask the flow to move to the review step (draw mode only). */
  onReviewRequest: () => void;
  /** Ask the flow to move back to the draw step (review mode only). */
  onBackRequest: () => void;
  /** Submit the application (review mode only). May reject with a message. */
  onSubmitRequest: () => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}
