/**
 * English message catalog (ICU MessageFormat), island.is-style:
 * one flat object per locale, camelCase ids, plural/select rules where
 * needed. Shared by the NestJS server (views + messages) and the
 * browser client.
 */
export const en: Record<string, string> = {
  // shared chrome
  agencyName: 'Land & Nature Agency',
  schemeName: 'Windbreak Grant Scheme',
  portalSession: 'Government portal session',
  signedIn: 'Signed in',
  langIs: 'Íslenska',
  langEn: 'English',
  footerPrototype:
    'Prototype — farmer authentication is assumed to have happened in the portal. Data is served by a pygeoapi OGC API and stored in local GeoJSON files.',
  errorSomethingWrong: 'Something went wrong:',

  // landing page
  indexTitle: 'Apply for a grant to plant a windbreak',
  indexLead:
    'A windbreak protects crops and livestock and improves nature on your farm. In this prototype you are already signed in to the government portal, so the service looks up your details and your registered land automatically.',
  indexWhere:
    'The only thing you have to provide is where you want the windbreak: draw the lines on the map of your land and submit.',
  indexCta: 'Apply for windbreak',
  indexIdentity:
    'Assumed session identity: {name} · kennitala {kennitala} (set via DEMO_FULL_NAME / DEMO_KENNITALA)',

  // lookup summary
  lookupSummary:
    'Fasteignir-Xroad found {propertyCount, plural, one {# property} other {# properties}} on kennitala {kennitala}, on {landCount, plural, one {# land parcel} other {# land parcels}}: landeignarnumer {list}.',

  // confirmation page
  submittedTitle: 'Application submitted',
  submittedLead:
    'Your windbreak grant application has been received and stored by the grant service.',
  labelApplicationNo: 'Application no.',
  labelSubmitted: 'Submitted',
  labelWindbreaks: 'Windbreaks',
  labelStatus: 'Status',
  statusPending: 'pending — not accepted yet',
  submittedNote:
    'The grant authority will now review your application. Until it is accepted, the requested windbreak counts as an existing windbreak: new applications cannot cross it.',
  submittedStoredHeading: 'Stored in the backend',
  colLineId: 'Line id',
  colStatus: 'Status',
  submittedLines:
    '{count, plural, one {# line} other {# lines}}, {total} m in total',
  btnApplyAgain: 'Apply for another windbreak',
  btnBackToApplication: 'Back to the application',

  // server-side error messages
  errorNoProperties:
    'Fasteignir-Xroad found no properties for kennitala {kennitala}.',
  errorNoParcels: 'No land parcels found for landeignarnumer {list}.',
  errorNoLines: 'No windbreak lines were received.',
  errorInvalidAnswers: 'The submitted application failed the schema check.',
  errorApplicationNotFound:
    'Application {applicationId} was not found in the backend.',
  errorBackendUnreachable: 'Cannot reach the OGC API backend at {url}.',
  errorBackendHttp: 'OGC API backend returned HTTP {status} for {path}.',
  errorRegistryQuery: 'Windbreak registry query failed: {detail}',
  errorFasteignirNoToken:
    'Fasteignir-Xroad requires FASTEIGNIR_TOKEN (island.is Bearer JWT).',
  errorFasteignirUnreachable: 'Cannot reach Fasteignir-Xroad at {url}.',
  errorFasteignirHttp: 'Fasteignir-Xroad returned HTTP {status} ({detail})',
  errorFasteignirLookupFailed: 'Fasteignir-Xroad lookup failed: {detail}',
  errorApplicationsQuery:
    'Could not load submitted windbreak applications: {detail}',
  errorApplicationsWrite: 'Storing the windbreak application failed: {detail}',
  errorStoreFailed: 'Storing the windbreak failed (HTTP {status}): {detail}',
};
