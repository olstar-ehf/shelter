import type { GetServerSideProps } from 'next';
import { SubmittedPage } from '@island.is/application-ui-shell/components/SubmittedPage';
import { Shell } from '@island.is/application-ui-shell/components/Shell';
import { fetchTicket } from '../../lib/api';
import { localeString } from '../../lib/locale';
import Head from 'next/head';
import { messages as appMessages } from '@island.is/application-ui-shell/server';
import type { AppLocale } from '@island.is/application-ui-shell';

interface Props {
  locale: string;
  error?: string;
  ticket?: {
    ticketId: string;
    ticketUrl: string | null;
    applicationId: string | null;
    submittedAt: string;
  };
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const locale = localeString(ctx);
  const ticketId = String(ctx.params?.ticketId ?? '');
  const payload = await fetchTicket(ticketId, locale).catch((err: Error) => ({
    locale,
    error: err.message,
  }));
  return { props: { ...payload, locale } };
};

export default function Submitted(props: Props) {
  return (
    <>
      <Head>
        <title>{appMessages[props.locale as AppLocale].pageTitleSubmitted}</title>
      </Head>
      <Shell session="none" titleId="pageTitleSubmitted">
        <SubmittedPage error={props.error} ticket={props.ticket} />
      </Shell>
    </>
  );
}
