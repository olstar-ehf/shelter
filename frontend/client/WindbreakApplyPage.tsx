/**
 * Apply-page (React): server-looked-up context (identity + parcels +
 * windbreaks) is passed in; the application itself is the windbreak
 * template's flow renderer. Submission goes to POST /apply with the
 * template's answers; success redirects to the ticket confirmation page.
 */
import { useIntl } from 'react-intl';
import {
  WindbreakApplicationFlow,
  type WindbreakAnswers,
} from '@island.is/windbreak-application';
import type { ParcelFeature, WindbreakFeature } from '@island.is/map';

export interface WindbreakApplyPageProps {
  locale: string;
  error?: string;
  lookupSummary?: string;
  parcels: ParcelFeature[];
  windbreaks: WindbreakFeature[];
}

export function WindbreakApplyPage({
  locale,
  error,
  lookupSummary,
  parcels,
  windbreaks,
}: WindbreakApplyPageProps) {
  const intl = useIntl();
  const f = (id: string): string => intl.formatMessage({ id });

  if (error) {
    return (
      <div className="error-banner" role="alert">
        <strong>{f('errorSomethingWrong')}</strong> {error}
      </div>
    );
  }

  const submitApplication = async (answers: WindbreakAnswers) => {
    const fallback = intl.formatMessage({
      id: 'windbreak.review.submitFailedGeneric',
    });
    let res: Response;
    try {
      res = await fetch(`/apply?lang=${encodeURIComponent(locale)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ answers }),
      });
    } catch {
      throw new Error(fallback);
    }
    if (res.ok) {
      const data = (await res.json()) as {
        applicationId: string;
        ticketId: string;
      };
      window.location.href = `/submitted/${encodeURIComponent(data.ticketId)}?lang=${encodeURIComponent(locale)}`;
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(data?.message)
      ? data.message.join(' ')
      : (data?.message ?? `${fallback} (HTTP ${res.status}).`);
    throw new Error(message);
  };

  return (
    <>
      {lookupSummary && <p className="muted lookup-info">{lookupSummary}</p>}
      <WindbreakApplicationFlow
        locale={locale}
        externalData={{ parcels, existingWindbreaks: windbreaks }}
        onSubmitApplication={submitApplication}
      />
    </>
  );
}
