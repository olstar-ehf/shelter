/**
 * The step renderer of the windbreak application: renders the stepper, the
 * active section (from the template's declarative form) and its fields
 * (resolved through the field registry). The DOM ids/classes match the
 * prototype's markup so the e2e regression test keeps passing.
 *
 * This component is template-agnostic in shape (any form definition with
 * registered field types could be rendered the same way) but ships with the
 * windbreak template - the only consumer in this monorepo so far.
 */
import { useState } from 'react';
import { useIntl } from 'react-intl';
import type { WindbreakFeature, WindbreakLine } from '@island.is/map';
import { windbreakAnswersSchema, type WindbreakAnswers } from './dataSchema';
import { windbreakTemplate } from './form';
import { windbreakFieldRegistry } from './fields';
import type { WindbreakExternalData } from './types';

export interface WindbreakApplicationFlowProps {
  locale: string;
  /** Parcels + existing windbreaks looked up by the server (external data). */
  externalData: WindbreakExternalData;
  /**
   * Submit the answers. The host owns the transport (POST /apply) and the
   * redirect to the confirmation page; rejecting with an Error shows its
   * message in the review panel.
   */
  onSubmitApplication: (answers: WindbreakAnswers) => Promise<void>;
}

type SectionId = 'draw' | 'review';

export function WindbreakApplicationFlow({
  externalData,
  onSubmitApplication,
}: WindbreakApplicationFlowProps) {
  const intl = useIntl();
  const f = (id: string, values?: Record<string, string | number>): string =>
    intl.formatMessage({ id }, values);

  const [lines, setLines] = useState<WindbreakLine[]>([]);
  const [sectionId, setSectionId] = useState<SectionId>('draw');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reviewing = sectionId === 'review';
  const section = windbreakTemplate.form.sections.find(
    (s) => s.id === sectionId,
  );
  if (!section) {
    return null;
  }
  const currentStep = reviewing ? 3 : 2;

  const establishedCount = externalData.existingWindbreaks.filter(
    (w: WindbreakFeature) => w.properties.status === 'established',
  ).length;
  const pendingCount = externalData.existingWindbreaks.length - establishedCount;

  const goReview = () => {
    setSubmitError(null);
    setSectionId('review');
  };
  const goBackToMap = () => {
    setSubmitError(null);
    setSectionId('draw');
  };
  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const parsed = windbreakAnswersSchema.safeParse({ lines });
      if (!parsed.success) {
        throw new Error(f('windbreak.review.submitFailedGeneric'));
      }
      await onSubmitApplication(parsed.data as WindbreakAnswers);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : f('windbreak.review.submitFailedGeneric'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ol className="stepper" id="stepper" aria-label="Application steps">
        {windbreakTemplate.steps.map((step, index) => (
          <li
            key={step.id}
            data-step={index + 1}
            className={index + 1 <= currentStep ? 'active' : ''}
          >
            <span className="step-no">{index + 1}</span>{' '}
            {f(step.labelId)}
          </li>
        ))}
      </ol>

      <div className="card">
        <h2 id="step-title">{f(section.titleId)}</h2>

        <div id="draw-help" hidden={reviewing}>
          <p className="muted">{f('windbreak.draw.helpParcels')}</p>
          <p className="muted">
            {f('windbreak.draw.helpExisting', {
              established: f('windbreak.draw.countEstablished', {
                count: establishedCount,
              }),
              pending: f('windbreak.draw.countPending', {
                count: pendingCount,
              }),
            })}
          </p>
        </div>
        <div id="review-help" hidden={!reviewing}>
          <p className="muted">{f('windbreak.review.help')}</p>
        </div>

        {section.fields.map((field) => {
          const Component = windbreakFieldRegistry[field.type];
          return (
            <Component
              key={field.id}
              field={field}
              locale={intl.locale}
              lines={lines}
              externalData={externalData}
              onChange={setLines}
              onReviewRequest={goReview}
              onBackRequest={goBackToMap}
              onSubmitRequest={submit}
              isSubmitting={submitting}
              submitError={submitError}
            />
          );
        })}
      </div>
    </>
  );
}
