/**
 * Landing page (React): scheme intro + start button + assumed identity.
 */
import { useIntl } from 'react-intl';
import { Stepper } from './Stepper';

export interface IndexPageProps {
  identity: { fullName: string; kennitala: string };
}

export function IndexPage({ identity }: IndexPageProps) {
  const intl = useIntl();
  const f = (id: string, values?: Record<string, string | number>): string =>
    intl.formatMessage({ id }, values);

  return (
    <>
      <Stepper activeCount={1} />
      <div className="card card-center">
        <h1>{f('indexTitle')}</h1>
        <p>{f('indexLead')}</p>
        <p className="muted">{f('indexWhere')}</p>
        <a className="btn btn-primary btn-large" href="/apply">
          {f('indexCta')}
        </a>
        <p className="muted small">
          {f('indexIdentity', {
            name: identity.fullName,
            kennitala: identity.kennitala,
          })}
        </p>
      </div>
    </>
  );
}
