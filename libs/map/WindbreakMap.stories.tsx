import type { Meta, StoryObj } from '@storybook/react';
import { IntlProvider } from 'react-intl';
import { WindbreakMap } from './src/WindbreakMap';
import { messages, flattenMessages } from './src/messages';
import type {
  ParcelFeature,
  WindbreakFeature,
  WindbreakLine,
} from './src/types';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const parcels: ParcelFeature[] = [
  {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-21.54308, 64.305496],
          [-21.542834, 64.304437],
          [-21.542508, 64.304606],
          [-21.541871, 64.304936],
          [-21.54308, 64.305496],
        ],
      ],
    },
    properties: {
      parcel_id: 'IS-230963',
      farmer_id: 'farmer-123',
      landeignarnumer: 230963,
      parcel_name: 'Svölukot',
      area_ha: 0.31,
      land_use: 'homestead',
    },
  },
];

const windbreaks: WindbreakFeature[] = [
  {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-21.542928, 64.305144],
        [-21.54288, 64.304786],
      ],
    },
    properties: {
      line_id: 'skjolbelti-1',
      objectid: 1,
      status: 'established',
      planted_year: 1998,
      source: 'skograekt.skjolbelti',
    },
  },
  {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-21.542676, 64.304762],
        [-21.542423, 64.304713],
      ],
    },
    properties: {
      line_id: 'WB-2026-0042-1',
      application_id: 'WB-2026-0042',
      status: 'pending',
    },
  },
];

const meta: Meta<typeof WindbreakMap> = {
  title: 'Map/WindbreakMap',
  component: WindbreakMap,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story, context) => {
      const locale = (context.globals.locale ?? 'en') === 'is' ? 'is' : 'en';
      return (
        <IntlProvider locale={locale} messages={flattenMessages(messages[locale])}>
          <Story />
        </IntlProvider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof WindbreakMap>;

export const Drawable: Story = {
  args: {
    parcels,
    existingWindbreaks: windbreaks,
    initialCenter: [64.305, -21.5426],
    initialZoom: 16,
    height: '480px',
    onLinesChange: (lines: WindbreakLine[]) => {
      // Storybook action placeholder
      // eslint-disable-next-line no-console
      console.log('lines changed', lines.length);
    },
  },
};

export const ReadOnly: Story = {
  args: {
    ...Drawable.args,
    readOnly: true,
  },
};

export const Icelandic: Story = {
  args: {
    ...Drawable.args,
  },
  globals: { locale: 'is' },
};
