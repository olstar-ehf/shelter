import type { GetServerSideProps } from 'next';
import { IndexPage } from '@island.is/application-ui-shell/components/IndexPage';
import { Shell } from '@island.is/application-ui-shell/components/Shell';
import { localeString } from '../lib/locale';

interface Props {
  locale: string;
  identity: { fullName: string; kennitala: string };
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const locale = localeString(ctx);
  return {
    props: {
      locale,
      identity: {
        fullName:
          process.env.DEMO_FULL_NAME || 'Hafliði Viðar Ólafsson',
        kennitala: process.env.DEMO_KENNITALA || '061050-4429',
      },
    },
  };
};

export default function Index({ locale, identity }: Props) {
  return (
    <Shell session="portal" title={locale === 'is' ? 'Skjólbeltastyrkir' : 'Windbreak Grant Scheme'}>
      <IndexPage identity={identity} />
    </Shell>
  );
}
