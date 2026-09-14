/**
 * WindbreakLinesField - the registered component for the 'windbreakLines'
 * field type (draw and review steps of the declarative form).
 *
 * Split for server-side rendering: this module renders the static field
 * skeleton (map placeholder, legend, empty lines summary with the initial
 * "no lines" state) both on the server and during the client's first render.
 * The interactive map pane - Leaflet cannot run on the server - is loaded
 * afterwards through React.lazy and replaces the skeleton in the browser.
 *
 * The server markup and the client's first render are identical, so React
 * hydrates cleanly and the draw step is never blank while the map chunk
 * downloads.
 */
import { Suspense, lazy, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import type { WindbreakLinesFieldValueProps } from '../types';

const WindbreakMapPane = lazy(() => import('./WindbreakMapPane'));

/** Initial-state markup shared by the SSR render and the Suspense fallback. */
function FieldSkeleton() {
  const intl = useIntl();
  const f = (id: string): string => intl.formatMessage({ id });
  return (
    <>
      <div className="map-container map-container--loading" style={{ height: '480px' }} />

      <div className="map-legend" aria-hidden="true">
        <span>
          <i className="legend-swatch legend-parcel" /> {f('map.legendParcels')}
        </span>
        <span>
          <i className="legend-swatch legend-established" />{' '}
          {f('map.legendEstablished')}
        </span>
        <span>
          <i className="legend-swatch legend-pending" /> {f('map.legendPending')}
        </span>
      </div>

      <div className="lines-summary">
        <h3>
          {f('windbreak.lines.heading')} (
          <span id="line-count">0</span>)
        </h3>
        <p className="muted" id="no-lines">
          {f('windbreak.lines.none')}
        </p>
        <table className="lines-table" id="lines-table" hidden>
          <thead>
            <tr>
              <th>{f('windbreak.lines.colNumber')}</th>
              <th>{f('windbreak.lines.colLength')}</th>
              <th>{f('windbreak.lines.colParcel')}</th>
              <th>{f('windbreak.lines.colCheck')}</th>
            </tr>
          </thead>
          <tbody id="lines-body" />
        </table>

        <div className="review-panel" id="review-panel" hidden>
          <h3>{f('windbreak.review.heading')}</h3>
          <p className="muted">{f('windbreak.review.note')}</p>
        </div>

        <div className="step-actions">
          <span className="muted">
            {f('windbreak.lines.totalLength')}{' '}
            <strong>
              <span id="total-length">0</span> m
            </strong>
          </span>
          <button
            type="button"
            className="btn btn-primary"
            id="review-btn"
            disabled
          >
            {f('windbreak.actions.review')}
          </button>
        </div>
      </div>
    </>
  );
}

export function WindbreakLinesField(props: WindbreakLinesFieldValueProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <FieldSkeleton />;
  }
  return (
    <Suspense fallback={<FieldSkeleton />}>
      <WindbreakMapPane {...props} />
    </Suspense>
  );
}
