/**
 * Browser entry for every page: reads the page-data JSON embedded by the
 * NestJS shell, merges the three message catalogs (app chrome, map lib,
 * windbreak template) and mounts the matching React page inside the shared
 * Shell. Every visible element is React - the server only ships data.
 */
import { createRoot } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { flattenMessages, messages as mapMessages } from '@island.is/map';
import {
  flattenMessages as flattenTemplate,
  messages as templateMessages,
} from '@island.is/windbreak-application';
import type { ParcelFeature, WindbreakFeature } from '@island.is/map';
import { IndexPage } from './IndexPage';
import { Shell } from './Shell';
import { SubmittedPage } from './SubmittedPage';
import { WindbreakApplyPage } from './WindbreakApplyPage';
import { en as appEn } from '../src/messages/en';
import { is as appIs } from '../src/messages/is';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../public/styles.css';

interface PageData {
  page: 'index' | 'apply' | 'submitted';
  locale: string;
  identity?: { fullName: string; kennitala: string };
  error?: string;
  lookupSummary?: string;
  parcels?: unknown[];
  windbreaks?: unknown[];
  ticket?: {
    ticketId: string;
    ticketUrl: string | null;
    applicationId: string | null;
    submittedAt: string;
  };
}

function readPageData(): PageData {
  const el = document.getElementById('page-data');
  if (!el || !el.textContent) {
    throw new Error('Missing embedded page data');
  }
  return JSON.parse(el.textContent) as PageData;
}

const pageData = readPageData();
const locale = pageData.locale === 'is' ? 'is' : 'en';

// One flat catalog per locale: app keys + the map lib's map/validation/
// drawLocal namespaces + the template's windbreak.* namespace (the same
// merge the server uses for its error messages).
const catalog: Record<string, string> = {
  ...(locale === 'is' ? appIs : appEn),
  ...flattenMessages(mapMessages[locale]),
  ...flattenTemplate(templateMessages[locale]),
};

function PageContent({ data }: { data: PageData }) {
  if (data.page === 'index') {
    return (
      <Shell session="portal">
        <IndexPage identity={data.identity ?? { fullName: '', kennitala: '' }} />
      </Shell>
    );
  }
  if (data.page === 'apply') {
    return (
      <Shell
        session="identity"
        identity={data.identity}
        title={locale === 'is' ? 'Skjólbeltastyrkir' : 'Windbreak Grant Scheme'}
      >
        <WindbreakApplyPage
          locale={locale}
          error={data.error}
          lookupSummary={data.lookupSummary}
          parcels={(data.parcels ?? []) as ParcelFeature[]}
          windbreaks={(data.windbreaks ?? []) as WindbreakFeature[]}
        />
      </Shell>
    );
  }
  return (
    <Shell session="none">
      <SubmittedPage error={data.error} ticket={data.ticket} />
    </Shell>
  );
}

const rootEl = document.getElementById('app-root');
if (!rootEl) {
  throw new Error('Page root (#app-root) not found');
}

createRoot(rootEl).render(
  <IntlProvider
    locale={locale}
    defaultLocale="is"
    messages={catalog}
    onError={(_err) => {
      // Missing message ids fall back to the id itself; keep the console
      // clean in the prototype.
    }}
  >
    <PageContent data={pageData} />
  </IntlProvider>,
);
