/**
 * The draw page as a React component (Phase 1 of the island.is monorepo
 * migration): server-rendered chrome + this client-rendered application.
 *
 * Renders the same DOM contract as the previous vanilla client so the e2e
 * regression test keeps passing: ids #stepper, #step-title, #draw-help,
 * #review-help, .map-container, #line-count, #lines-table, #lines-body,
 * #no-lines, #total-length, #review-btn, #review-panel, #review-body,
 * #review-total, #submit-error, #back-btn, #submit-btn.
 */
import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  totalLengthM,
  useWindbreakValidation,
  WindbreakMap,
  type ParcelFeature,
  type WindbreakFeature,
  type WindbreakLine,
} from '@island.is/map';

interface DrawApplicationProps {
  /** Resolved request locale (is | en), for POST /apply?lang=... */
  locale: string;
  parcels: ParcelFeature[];
  windbreaks: WindbreakFeature[];
}

export function DrawApplication({
  locale,
  parcels,
  windbreaks,
}: DrawApplicationProps) {
  const intl = useIntl();
  const f = (id: string, values?: Record<string, string | number>): string =>
    intl.formatMessage({ id }, values);

  const [lines, setLines] = useState<WindbreakLine[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validated = useWindbreakValidation(lines, parcels, windbreaks);
  const allValid =
    lines.length > 0 &&
    validated.every((entry) => entry.validation.status === 'ok');

  const establishedCount = windbreaks.filter(
    (w) => w.properties.status === 'established',
  ).length;
  const pendingCount = windbreaks.length - establishedCount;

  const parcelName = (parcelId: string | null): string => {
    if (!parcelId) {
      return f('map.spansSeveralParcels');
    }
    return (
      parcels.find((p) => p.properties.parcel_id === parcelId)?.properties
        .parcel_name ?? parcelId
    );
  };

  const goReview = () => {
    setSubmitError(null);
    setReviewing(true);
  };

  const goBackToMap = () => {
    setReviewing(false);
  };

  const submitApplication = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `/apply?lang=${encodeURIComponent(locale)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            lines: lines.map((line) => line.feature),
          }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { applicationId: string };
        window.location.href = `/submitted/${encodeURIComponent(data.applicationId)}?lang=${encodeURIComponent(locale)}`;
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      const message = Array.isArray(data?.message)
        ? data.message.join(' ')
        : (data?.message ??
          `${f('submitFailedGeneric')} (HTTP ${res.status}).`);
      setSubmitError(message);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : f('submitFailedGeneric'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentStep = reviewing ? 3 : 2;
  const validLines = validated.filter(
    (entry) => entry.validation.status === 'ok',
  );

  return (
    <>
      <ol className="stepper" id="stepper" aria-label="Application steps">
        <li data-step="1" className="active">
          <span className="step-no">1</span> {f('stepYourDetails')}
        </li>
        <li data-step="2" className="active">
          <span className="step-no">2</span> {f('stepDrawWindbreak')}
        </li>
        <li data-step="3" className={currentStep >= 3 ? 'active' : ''}>
          <span className="step-no">3</span> {f('stepReview')}
        </li>
        <li data-step="4">
          <span className="step-no">4</span> {f('stepSubmitted')}
        </li>
      </ol>

      <div className="card">
        <h2 id="step-title">
          {reviewing ? f('applyTitleReview') : f('applyTitleDraw')}
        </h2>
        <div id="draw-help" hidden={reviewing}>
          <p className="muted">{f('helpDrawParcels')}</p>
          <p className="muted">
            {f('helpDrawExisting', {
              established: f('countEstablished', {
                count: establishedCount,
              }),
              pending: f('countPending', { count: pendingCount }),
            })}
          </p>
        </div>
        <div id="review-help" hidden={!reviewing}>
          <p className="muted">{f('helpReview')}</p>
        </div>

        <div className="map-container">
          <WindbreakMap
            parcels={parcels}
            existingWindbreaks={windbreaks}
            readOnly={reviewing}
            legend={false}
            height="480px"
            onLinesChange={setLines}
          />
        </div>

        <div className="map-legend" aria-hidden="true">
          <span>
            <i className="legend-swatch legend-parcel" />{' '}
            {f('map.legendParcels')}
          </span>
          <span>
            <i className="legend-swatch legend-established" />{' '}
            {f('map.legendEstablished')}
          </span>
          <span>
            <i className="legend-swatch legend-pending" />{' '}
            {f('map.legendPending')}
          </span>
        </div>

        <div className="lines-summary">
          <h3>
            {f('drawnHeadingLabel')} (<span id="line-count">{lines.length}</span>)
          </h3>
          <p className="muted" id="no-lines" hidden={lines.length > 0}>
            {f('drawnNone')}
          </p>
          <table className="lines-table" id="lines-table" hidden={lines.length === 0}>
            <thead>
              <tr>
                <th>{f('colNumber')}</th>
                <th>{f('colLength')}</th>
                <th>{f('colParcel')}</th>
                <th>{f('colCheck')}</th>
              </tr>
            </thead>
            <tbody id="lines-body">
              {validated.map((entry, index) => {
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
                      <span className="chip chip-ok">
                        {f('map.insideLand')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="review-panel" id="review-panel" hidden={!reviewing}>
            <h3>{f('reviewPanelHeading')}</h3>
            <p className="muted">{f('reviewPanelNote')}</p>
            <table className="lines-table">
              <thead>
                <tr>
                  <th>{f('colNumber')}</th>
                  <th>{f('colLength')}</th>
                  <th>{f('colParcel')}</th>
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
              {f('totalLength')}{' '}
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
                onClick={goBackToMap}
              >
                {f('btnBackToMap')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                id="submit-btn"
                onClick={() => void submitApplication()}
                disabled={submitting}
              >
                {f('btnSubmitApplication')}
              </button>
            </div>
          </div>

          <div className="step-actions">
            <span className="muted">
              {f('totalLength')}{' '}
              <strong>
                <span id="total-length">
                  {Math.round(totalLengthM(lines))}
                </span>{' '}
                m
              </strong>
            </span>
            <button
              type="button"
              className="btn btn-primary"
              id="review-btn"
              disabled={!allValid}
              hidden={reviewing}
              onClick={goReview}
            >
              {f('btnReviewApplication')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
