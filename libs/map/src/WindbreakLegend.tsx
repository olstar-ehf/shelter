import { FormattedMessage } from 'react-intl';

/**
 * Map legend: what the three layer styles mean.
 * (In the island.is monorepo this would be built from island-ui's
 * Box/Text/Tag components; here it is plain semantic markup.)
 */
export function WindbreakLegend() {
  return (
    <div className="windbreak-legend" aria-hidden="true">
      <span>
        <i className="windbreak-swatch windbreak-swatch-parcel" />
        <FormattedMessage id="map.legendParcels" />
      </span>
      <span>
        <i className="windbreak-swatch windbreak-swatch-established" />
        <FormattedMessage id="map.legendEstablished" />
      </span>
      <span>
        <i className="windbreak-swatch windbreak-swatch-pending" />
        <FormattedMessage id="map.legendPending" />
      </span>
    </div>
  );
}
