import type { Meta, StoryObj } from '@storybook/react';
import { IntlProvider } from 'react-intl';
import { messages as mapMessages, flattenMessages as flattenMap } from '@island.is/map';
import { WindbreakLinesField } from './src/fields/WindbreakLinesField';
import { messages, flattenMessages } from './src/messages';
import type { WindbreakLinesFieldValueProps } from './src/types';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

/** The field formats map lib ids too (map.* and validation.*) - merge both. */
function catalogFor(locale: 'is' | 'en'): Record<string, string> {
  return {
    ...flattenMap(mapMessages[locale]),
    ...flattenMessages(messages[locale]),
  };
}

const parcels = [
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
] as never;

const existingWindbreaks = [
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
      status: 'established',
      planted_year: 1998,
      source: 'skograekt.skjolbelti',
    },
  },
] as never;

const baseArgs: Pick<
  WindbreakLinesFieldValueProps,
  'externalData' | 'onChange' | 'onReviewRequest' | 'onBackRequest' | 'onSubmitRequest' | 'isSubmitting' | 'submitError' | 'lines'
> = {
  externalData: { parcels, existingWindbreaks },
  lines: [],
  onChange: () => undefined,
  onReviewRequest: () => undefined,
  onBackRequest: () => undefined,
  onSubmitRequest: async () => undefined,
  isSubmitting: false,
  submitError: null,
};

const meta: Meta<typeof WindbreakLinesField> = {
  title: 'Application/WindbreakLinesField',
  component: WindbreakLinesField,
  parameters: { layout: 'padded' },
  decorators: [
    (Story, context) => {
      const locale = (context.globals.locale ?? 'en') === 'is' ? 'is' : 'en';
      return (
        <IntlProvider
          locale={locale}
          messages={catalogFor(locale)}
          onError={() => undefined}
        >
          <Story />
        </IntlProvider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof WindbreakLinesField>;

export const DrawStep: Story = {
  args: {
    ...baseArgs,
    field: { id: 'lines', type: 'windbreakLines', mode: 'draw' },
    locale: 'en',
  },
};

export const ReviewStep: Story = {
  args: {
    ...baseArgs,
    field: { id: 'lines', type: 'windbreakLines', mode: 'review' },
    locale: 'en',
  },
};

export const Icelandic: Story = {
  ...DrawStep,
  globals: { locale: 'is' },
};
