import L from 'leaflet';
import {
  linesFromFeatureGroup,
  removeLineFromFeatureGroup,
} from '../src/lines';

/** A feature group with one drawn windbreak line (as leaflet-draw leaves it). */
const makeGroup = () => {
  const group = L.featureGroup();
  const line = L.polyline([
    [65.48, -21.8],
    [65.48, -21.79],
  ]);
  group.addLayer(line);
  return { group, line };
};

describe('drawn-lines feature group helpers', () => {
  it('derives one WindbreakLine per line layer, with a clientId and length', () => {
    const { group } = makeGroup();
    const lines = linesFromFeatureGroup(group);
    expect(lines).toHaveLength(1);
    expect(lines[0].clientId).toMatch(/^line-\d+$/);
    expect(lines[0].feature.geometry.type).toBe('LineString');
    expect(lines[0].lengthM).toBeGreaterThan(0);
  });

  it('removes a line by clientId', () => {
    const { group } = makeGroup();
    const [line] = linesFromFeatureGroup(group);
    expect(removeLineFromFeatureGroup(group, line.clientId)).toBe(true);
    expect(linesFromFeatureGroup(group)).toHaveLength(0);
  });

  it('leaves the group untouched for an unknown clientId', () => {
    const { group } = makeGroup();
    expect(removeLineFromFeatureGroup(group, 'line-999')).toBe(false);
    expect(linesFromFeatureGroup(group)).toHaveLength(1);
  });
});
