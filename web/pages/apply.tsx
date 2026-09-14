import dynamic from 'next/dynamic';
import type { GetServerSideProps } from 'next';
import { Shell } from '@island.is/application-ui-shell/components/Shell';
import { fetchApplyContext } from '../lib/api';
import { localeString } from '../lib/locale';

interface Props {
  locale: string;
  identity?: { fullName: string; kennitala: string };
  error?: string;
  lookupSummary?: string;
  parcels?: unknown[];
  windbreaks?: unknown[];
}

// The map field pulls in Leaflet (browser-only): the application flow is
// client-rendered, everything else on this page is server-rendered React.
const ApplyPage = dynamic(
  () =>
    import('@island.is/application-ui-shell/components/ApplyPage').then(
      (m) => ({ default: m.ApplyPage }),
    ),
  { ssr: false },
);

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const locale = localeString(ctx);
  const context = await fetchApplyContext(locale).catch((err: Error) => ({
    locale,
    identity: {
      fullName:
        process.env.DEMO_FULL_NAME || 'Hafliði Viðar Ólafsson',
      kennitala: process.env.DEMO_KENNITALA || '061050-4429',
    },
    error: err.message,
  }));
  return { props: { ...context, locale } };
};

export default function Apply(props: Props) {
  const { locale, identity } = props;
  return (
    <Shell session="identity" identity={identity}>
      <ApplyPage
        locale={locale}
        error={props.error}
        lookupSummary={props.lookupSummary}
        parcels={(props.parcels ?? []) as never[]}
        windbreaks={(props.windbreaks ?? []) as never[]}
        submitPath="/api/apply"
      />
    </Shell>
  );
}
