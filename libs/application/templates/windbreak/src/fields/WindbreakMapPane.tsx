/**
 * Client-only map pane of the windbreak field: the WindbreakMap itself
 * (libs/map, built on Leaflet which cannot render on the server) plus the
 * interactive lines summary, review panel and step actions.
 *
 * This module is only ever loaded in the browser. WindbreakLinesField
 * imports it through React.lazy so the server-side render of the form
 * stops at the static skeleton and never pulls Leaflet into the SSR bundle.
 */
import { useIntl } from 'react-intl';
import {
  totalLengthM,
  useWindbreakValidation,
  WindbreakMap,
  type ParcelFeature,
  type WindbreakFeature,
  type ValidatedLine,
} from '@island.is/map';
import type { WindbreakLinesFieldValueProps } from '../types';

export default function WindbreakMapPane({
  field,
  lines,
  externalData,
  onChange,
  onReviewRequest,
  onBackRequest,
  onSubmitRequest,
  isSubmitting,
  submitError,
}: WindbreakLinesFieldValueProps) {
  const intl = useIntl();
  const f = (id: string, values?: Record<string, string | number>): string =>
    intl.formatMessage({ id }, values);

  const reviewing = field.mode === 'review';
  const parcels = externalData.parcels as ParcelFeature[];
  const windbreaks = externalData.existingWindbreaks as WindbreakFeature[];
  const validated = useWindbreakValidation(lines, parcels, windbreaks);
  const allValid =
    lines.length > 0 &&
    validated.every((entry) => entry.validation.status === 'ok');
  const validLines = validated.filter(
    (entry) => entry.validation.status === 'ok',
  );

  const parcelName = (parcelId: string | null): string => {
    if (!parcelId) {
      return f('map.spansSeveralParcels');
    }
    return (
      parcels.find((p) => p.properties.parcel_id === parcelId)?.properties
        .parcel_name ?? parcelId
    );
  };

  return (
    <>
      <div className="map-container">
        <WindbreakMap
          parcels={parcels}
          existingWindbreaks={windbreaks}
          basemap={externalData.basemap}
          readOnly={reviewing}
          legend={false}
          height="100%"
          onLinesChange={onChange}
        />
      </div>

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
          <span id="line-count">{lines.length}</span>)
        </h3>
        <p className="muted" id="no-lines" hidden={lines.length > 0}>
          {f('windbreak.lines.none')}
        </p>
        <table
          className="lines-table"
          id="lines-table"
          hidden={lines.length === 0}
        >
          <thead>
            <tr>
              <th>{f('windbreak.lines.colNumber')}</th>
              <th>{f('windbreak.lines.colLength')}</th>
              <th>{f('windbreak.lines.colParcel')}</th>
              <th>{f('windbreak.lines.colCheck')}</th>
            </tr>
          </thead>
          <tbody id="lines-body">
            {validated.map((entry: ValidatedLine, index: number) => {
              const validation = entry.validation;
              if (validation.status === 'error') {
                const message = f(validation.messageId, validation.values);
                return (
                  <tr key={entry.line.clientId}>
                    <td>{index + 1}</td>
                    <td>{Math.round(entry.line.lengthM)} m</td>
                    <td>—</td>
                    <td>
                      <span className="chip chip-error" title={message}>
                        {message}
                      </span>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={entry.line.clientId}>
                  <td>{index + 1}</td>
                  <td>{Math.round(entry.line.lengthM)} m</td>
                  <td>{parcelName(validation.parcelId)}</td>
                  <td>
                    <span className="chip chip-ok">{f('map.insideLand')}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="review-panel" id="review-panel" hidden={!reviewing}>
          <h3>{f('windbreak.review.heading')}</h3>
          <p className="muted">{f('windbreak.review.note')}</p>
          <table className="lines-table">
            <thead>
              <tr>
                <th>{f('windbreak.lines.colNumber')}</th>
                <th>{f('windbreak.lines.colLength')}</th>
                <th>{f('windbreak.lines.colParcel')}</th>
              </tr>
            </thead>
            <tbody id="review-body">
              {validLines.map((entry, index) => (
                <tr key={entry.line.clientId}>
                  <td>{index + 1}</td>
                  <td>{Math.round(entry.line.lengthM)} m</td>
                  <td>
                    {entry.validation.status === 'ok'
                      ? parcelName(entry.validation.parcelId)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            {f('windbreak.lines.totalLength')}{' '}
            <strong>
              <span id="review-total">
                {Math.round(totalLengthM(validLines.map((e) => e.line)))}
              </span>{' '}
              m
            </strong>
          </p>
          <p className="error-text" id="submit-error" hidden={!submitError}>
            {submitError}
          </p>
          <div className="step-actions">
            <button
              type="button"
              className="btn btn-secondary"
              id="back-btn"
              onClick={onBackRequest}
            >
              {f('windbreak.actions.backToMap')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              id="submit-btn"
              onClick={() => void onSubmitRequest()}
              disabled={isSubmitting}
            >
              {f('windbreak.actions.submit')}
            </button>
          </div>
        </div>

        <div className="step-actions">
          <span className="muted">
            {f('windbreak.lines.totalLength')}{' '}
            <strong>
              <span id="total-length">{Math.round(totalLengthM(lines))}</span>{' '}
              m
            </strong>
          </span>
          <button
            type="button"
            className="btn btn-primary"
            id="review-btn"
            disabled={!allValid}
            hidden={reviewing}
            onClick={onReviewRequest}
          >
            {f('windbreak.actions.review')}
          </button>
        </div>
      </div>
    </>
  );
}
