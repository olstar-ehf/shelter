import type { AppProps } from 'next/app';
import { IntlProvider } from 'react-intl';
import {
  flattenMessages as flattenMap,
  messages as mapMessages,
} from '@island.is/map/server';
import {
  flattenMessages as flattenTemplate,
  messages as templateMessages,
} from '@island.is/windbreak-application/server';
import { messages as appMessages } from '@island.is/application-ui-shell/server';
import type { AppLocale } from '@island.is/application-ui-shell';

/**
 * Global IntlProvider for the Next.js host: the same three-catalog merge
 * the NestJS client performs, so SSR and hydration format identical
 * messages in both hosts.
 */
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  const locale: AppLocale =
    typeof pageProps.locale === 'string' && pageProps.locale === 'is'
      ? 'is'
      : 'en';
  const catalog: Record<string, string> = {
    ...appMessages[locale],
    ...flattenMap(mapMessages[locale]),
    ...flattenTemplate(templateMessages[locale]),
  };
  return (
    <IntlProvider
      locale={locale}
      defaultLocale="is"
      messages={catalog}
      onError={(_err) => {
        // Missing ids fall back to the id itself.
      }}
    >
      <Component {...pageProps} />
    </IntlProvider>
  );
}
