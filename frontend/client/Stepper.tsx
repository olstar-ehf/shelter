/**
 * The 4-step application stepper, rendered by React on the landing and
 * confirmation pages (the draw page renders its own inside ApplicationFlow).
 */
import { useIntl } from 'react-intl';

const STEP_LABELS = [
  'windbreak.step.yourDetails',
  'windbreak.step.drawWindbreak',
  'windbreak.step.review',
  'windbreak.step.submitted',
];

export function Stepper({ activeCount }: { activeCount: number }) {
  const intl = useIntl();
  return (
    <ol className="stepper" aria-label="Application steps">
      {STEP_LABELS.map((labelId, index) => (
        <li
          key={labelId}
          data-step={index + 1}
          className={index + 1 <= activeCount ? 'active' : ''}
        >
          <span className="step-no">{index + 1}</span>{' '}
          {intl.formatMessage({ id: labelId })}
        </li>
      ))}
    </ol>
  );
}
