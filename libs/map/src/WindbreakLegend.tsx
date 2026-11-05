import { FormattedMessage } from 'react-intl';

/**
 * Map legend: what the three layer styles mean. The legend text is the
 * map's text alternative, so it must stay visible to assistive tech (the
 * colour swatches themselves are decorative).
 */
export function WindbreakLegend() {
  return (
    <div className="windbreak-legend">
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
