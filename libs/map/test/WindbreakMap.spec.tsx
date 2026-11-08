import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { WindbreakMap } from '../src/WindbreakMap';
import { en, is, flattenMessages } from '../src/messages';

// The real Leaflet pieces are exercised by the app-level browser e2e; here
// react-leaflet is stubbed so the component can render in jsdom. The map
// instance must be stable across renders: hooks depend on its identity.
const mockMapElement = document.createElement('div');
const mockMap = {
  addLayer: jest.fn(),
  removeLayer: jest.fn(),
  fitBounds: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  fire: jest.fn(),
  getContainer: () => mockMapElement,
  getCenter: () => ({ lat: 65.48, lng: -21.79 }),
  getZoom: () => 13,
  getMinZoom: () => 0,
  getMaxZoom: () => 16,
  getSize: () => ({ x: 800, y: 480 }),
  panBy: jest.fn(),
  setZoom: jest.fn(),
  keyboard: { enable: jest.fn(), disable: jest.fn() },
  dragging: { enable: jest.fn(), disable: jest.fn() },
  scrollWheelZoom: { enable: jest.fn(), disable: jest.fn() },
  doubleClickZoom: { enable: jest.fn(), disable: jest.fn() },
  boxZoom: { enable: jest.fn(), disable: jest.fn() },
};
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
    <div data-testid="map-container" style={style}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  GeoJSON: () => <div data-testid="geojson-layer" />,
  AttributionControl: () => null,
  ScaleControl: () => null,
  useMap: () => mockMap,
}));

jest.mock('../src/WindbreakDrawControl', () => ({
  WindbreakDrawControl: () => <div data-testid="draw-control" />,
}));

const parcels = [
  {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[-1, 1], [1, 1], [1, -1], [-1, -1], [-1, 1]]],
    },
    properties: { parcel_id: 'P-1', parcel_name: 'Square field', area_ha: 1 },
  },
] as never;

const renderMap = (locale: 'is' | 'en', props: Record<string, unknown> = {}) =>
  render(
    <IntlProvider
      locale={locale}
      messages={flattenMessages(locale === 'is' ? is : en)}
    >
      <WindbreakMap
        parcels={parcels}
        existingWindbreaks={[]}
        onLinesChange={() => undefined}
        {...props}
      />
    </IntlProvider>,
  );

describe('WindbreakMap', () => {
  it('renders the map container with the configured height', () => {
    renderMap('en', { height: '320px' });
    expect(screen.getByTestId('map-container')).toHaveStyle('height: 320px');
  });

  it('shows the draw control unless read-only', () => {
    renderMap('en');
    expect(screen.getByTestId('draw-control')).toBeInTheDocument();
  });

  it('hides the draw control in read-only mode', () => {
    renderMap('en', { readOnly: true });
    expect(screen.queryByTestId('draw-control')).not.toBeInTheDocument();
  });

  it('renders the legend in English', () => {
    renderMap('en');
    expect(screen.getByText('Your parcels')).toBeInTheDocument();
    expect(screen.getByText('Established windbreak')).toBeInTheDocument();
    expect(screen.getByText('Pending (not accepted)')).toBeInTheDocument();
  });

  it('renders the legend in Icelandic', () => {
    renderMap('is');
    expect(screen.getByText('Land þitt')).toBeInTheDocument();
    expect(screen.getByText('Skjólbelti (eldri)')).toBeInTheDocument();
    expect(screen.getByText('Í bið (ekki samþykkt)')).toBeInTheDocument();
  });
});
