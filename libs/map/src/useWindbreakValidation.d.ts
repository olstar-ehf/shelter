import type { ValidatedLine, WindbreakFeature, WindbreakLine, ParcelFeature } from './types';
/**
 * Validate all drawn lines against the farmer's land and existing
 * windbreaks (island.is-style: errors come back as message ids to format
 * with react-intl).
 */
export declare function useWindbreakValidation(lines: WindbreakLine[], parcels: ParcelFeature[], existingWindbreaks: WindbreakFeature[]): ValidatedLine[];
