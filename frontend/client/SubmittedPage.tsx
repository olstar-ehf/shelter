/**
 * Confirmation page (React): shows the Zendesk ticket the application
 * became (or the server-side error, localized by the server).
 */
import { useIntl } from 'react-intl';
import { Stepper } from './Stepper';

export interface SubmittedPageProps {
  error?: string;
  ticket?: {
    ticketId: string;
    ticketUrl: string | null;
    applicationId: string | null;
    submittedAt: string;
  };
}

export function SubmittedPage({ error, ticket }: SubmittedPageProps) {
  const intl = useIntl();
  const f = (id: string): string => intl.formatMessage({ id });

  if (error || !ticket) {
    return (
      <>
        <Stepper activeCount={4} />
        <div className="error-banner" role="alert">
          <strong>{f('errorSomethingWrong')}</strong> {error}
        </div>
        <p>
          <a className="btn btn-secondary" href="/apply">
            {f('btnBackToApplication')}
          </a>
        </p>
      </>
    );
  }

  return (
    <>
      <Stepper activeCount={4} />
      <div className="card card-success">
        <h2>{f('submittedTitle')}</h2>
        <p>{f('submittedLead')}</p>

        <h3>{f('submittedTicketHeading')}</h3>
        <dl className="details">
          {ticket.applicationId && (
            <>
              <dt>{f('labelApplicationNo')}</dt>
              <dd>
                <strong>{ticket.applicationId}</strong>
              </dd>
            </>
          )}
          <dt>{f('labelTicketNo')}</dt>
          <dd>
            <strong>{ticket.ticketId}</strong>
          </dd>
          <dt>{f('labelSubmitted')}</dt>
          <dd>{ticket.submittedAt}</dd>
        </dl>

        {ticket.ticketUrl ? (
          <div className="step-actions">
            <a
              className="btn btn-secondary"
              href={ticket.ticketUrl}
              target="_blank"
              rel="noopener"
            >
              {f('ticketOpenButton')}
            </a>
          </div>
        ) : (
          <p className="muted">{f('submittedNoTicketUrl')}</p>
        )}

        <p className="muted">{f('submittedNote')}</p>

        <div className="step-actions">
          <a className="btn btn-primary" href="/apply">
            {f('btnApplyAgain')}
          </a>
        </div>
      </div>
    </>
  );
}
