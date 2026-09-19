/**
 * React-free entry point for server-side consumers (e.g. the NestJS API).
 *
 * Node require()s the whole module graph of whatever it imports, so the
 * server must not pull in react-leaflet (ESM-only). This entry re-exports
 * only the pure parts of the lib: geometry, validation, types and messages.
 *
 *   import { validateWindbreakLines, flattenMessages } from '@island.is/map/server';
 */
export {
  landUnion,
  lineContainedIn,
  linesConflict,
  measureLineM,
  totalLengthM,
  validateLine,
  validateWindbreakLines,
  MIN_LENGTH_M,
} from './geometry';
export { en, is, messages, flattenMessages } from './messages';
export type { Locale, MapMessages } from './messages';
export type {
  ParcelFeature,
  ParcelProperties,
  ValidatedLine,
  Validation,
  WindbreakBasemap,
  WindbreakFeature,
  WindbreakLine,
  WindbreakProperties,
  WindbreakValidationContext,
} from './types';
