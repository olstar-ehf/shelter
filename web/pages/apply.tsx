import type { GetServerSideProps } from 'next';
import { Shell } from '@island.is/application-ui-shell/components/Shell';
import { ApplyPage } from '@island.is/application-ui-shell/components/ApplyPage';
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

// The whole flow is server-rendered now. The draw step renders its static
// skeleton (help texts, legend, empty lines table, disabled review button)
// during SSR; only the Leaflet map pane itself is client-only - the field
// lazy-loads it after hydration (React.lazy in WindbreakLinesField).

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

export default function ApplyRoute(props: Props) {
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
