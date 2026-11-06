import type { Feature, LineString } from 'geojson';
import type { FeatureGroup } from 'leaflet';
import { measureLineM } from './geometry';
import type { WindbreakLine } from './types';

/**
 * The drawn windbreak lines are the layers of the leaflet-draw feature
 * group. Every input method (pointer drawing, keyboard pointing, the
 * coordinate textarea) writes into that same group, so the line model is
 * always derived from it the same way: one WindbreakLine per LineString
 * layer, with the layer's Leaflet id as the clientId.
 */
export function linesFromFeatureGroup(
  featureGroup: FeatureGroup,
): WindbreakLine[] {
  const lines: WindbreakLine[] = [];
  featureGroup.eachLayer((layer) => {
    const anyLayer = layer as unknown as {
      _leaflet_id?: number;
      toGeoJSON: () => Feature;
    };
    const feature = anyLayer.toGeoJSON() as Feature;
    if (!feature || feature.geometry?.type !== 'LineString') {
      return;
    }
    const lineFeature = feature as Feature<LineString, Record<string, unknown>>;
    lines.push({
      clientId: `line-${anyLayer._leaflet_id ?? lines.length + 1}`,
      feature: lineFeature,
      lengthM: measureLineM(lineFeature),
    });
  });
  return lines;
}
