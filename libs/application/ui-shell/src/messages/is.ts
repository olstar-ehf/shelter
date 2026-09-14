/**
 * Íslensk skilaboð (ICU MessageFormat). Sami lykill og í en.ts.
 * Icelandic message catalog - same keys as en.ts.
 */
export const is: Record<string, string> = {
  // sameiginlegt
  agencyName: 'Land- og náttúrustofa',
  schemeName: 'Skjólbeltastyrkir',
  portalSession: 'Innskráning í ríkisgátt',
  signedIn: 'Innskráður',
  langIs: 'Íslenska',
  langEn: 'English',
  footerPrototype:
    'Frumgerð — gert er ráð fyrir að innskráning bónda hafi þegar farið fram í gáttinni. Gögn koma frá pygeoapi OGC API og eru geymd í GeoJSON-skrám.',
  errorSomethingWrong: 'Eitthvað fór úrskeiðis:',

  // forsíða
  indexTitle: 'Sækja um styrk til að gróðursetja skjólbelti',
  indexLead:
    'Skjólbelti verndar ræktun og búfé og bætir náttúru á jörðinni þinni. Í þessari frumgerð ert þú þegar innskráð(ur) í ríkisgáttina, þannig að kerfið sækir upplýsingar um þig og land þitt sjálfkrafa.',
  indexWhere:
    'Það eina sem þú þarft að gefa upp er hvar þú vilt skjólbeltið: teiknaðu línurnar inn á kort af landi þínu og sendu umsóknina.',
  indexCta: 'Sækja um skjólbelti',
  indexIdentity:
    'Gert er ráð fyrir: {name} · kennitala {kennitala} (stillt með DEMO_FULL_NAME / DEMO_KENNITALA)',

  // uppfletting
  lookupSummary:
    'Fasteignir-Xroad fann {propertyCount, plural, one {# fasteign} other {# fasteignir}} á kennitölu {kennitala}, á {landCount, plural, one {# landspildu} other {# landspildum}}: landeignarnúmer {list}.',

  // staðfestingarsíða
  submittedTitle: 'Umsókn móttekin',
  submittedLead:
    'Umsókn þín um skjólbeltisstyrk hefur verið skráð sem þjónustumiði. Stofnunin fer nú yfir hana; teiknuðu skjólbeltislínurnar fylgja miðanum.',
  labelApplicationNo: 'Umsóknarnúmer',
  labelSubmitted: 'Sent',
  submittedTicketHeading: 'Zendesk-miði',
  labelTicketNo: 'Miðanúmer',
  labelTicketStatus: 'Staða',
  ticketStatusNew: 'ný',
  ticketStatusOpen: 'opin',
  ticketStatusPending: 'í bið',
  ticketStatusSolved: 'leyst',
  ticketStatusClosed: 'lokað',
  ticketOpenButton: 'Opna miða í Zendesk',
  submittedNote:
    'Teiknuðu skjólbeltislínurnar fylgja miðanum sem GeoJSON-viðhengi. Þar til umsóknin er samþykkt telst umbeðið skjólbelti vera fyrirliggjandi skjólbelti: nýjar umsóknir mega ekki skerast það.',
  submittedNoTicketUrl:
    'Miðinn er aðeins sýnilegur inni í Zendesk (enginn opinber hlekkur er stilltur í þessari frumgerð).',
  btnApplyAgain: 'Sækja um annað skjólbelti',
  btnBackToApplication: 'Til baka í umsókn',

  // Zendesk-miði (skráningarstaður umsókna; gagnagrunnur er lesaðgengi)
  ticketSubject:
    'Skjólbeltisumsókn {applicationId} (kt. {kennitala})',
  ticketBody:
    '{count, plural, one {# skjólbeltislína} other {# skjólbeltislínur}} ' +
    '({total} m) send af kennitölu {kennitala}. Landspildur: {parcels}. ' +
    'Línurnar fylgja sem GeoJSON.',
  ticketNoParcels: '—',

  // villuskilaboð þjónustu
  errorNoProperties:
    'Fasteignir-Xroad fann engar fasteignir á kennitölu {kennitala}.',
  errorNoParcels: 'Engar landspildur fundust fyrir landeignarnúmer {list}.',
  errorNoLines: 'Engar skjólbeltislínur bárust.',
  errorInvalidAnswers: 'Innsend umsókn stóðst ekki gagnaþrýf (schema).',
  errorApplicationNotFound:
    'Umsókn {applicationId} fannst ekki í bakvinnslu.',
  errorBackendUnreachable: 'Næ ekki sambandi við OGC API bakvinnsluna ({url}).',
  errorBackendHttp: 'OGC API bakvinnslan skilaði HTTP {status} fyrir {path}.',
  errorRegistryQuery: 'Fyrirspurn í skjólbeltaskrá mistókst: {detail}',
  errorFasteignirNoToken:
    'Fasteignir-Xroad krefst FASTEIGNIR_TOKEN (island.is Bearer JWT).',
  errorFasteignirUnreachable: 'Næ ekki sambandi við Fasteignir-Xroad ({url}).',
  errorFasteignirHttp: 'Fasteignir-Xroad skilaði HTTP {status} ({detail})',
  errorFasteignirLookupFailed: 'Fasteignir-Xroad uppfletting mistókst: {detail}',
  errorApplicationsQuery:
    'Ekki tókst að sækja innsendar skjólbeltisumsóknir: {detail}',
  errorApplicationsWrite: 'Vistun skjólbeltisumsóknar mistókst: {detail}',
  errorStoreFailed: 'Vista skjólbeltið tókst ekki (HTTP {status}): {detail}',
  errorZendeskConfig:
    'Zendesk er ekki stillt: {detail}. Stilltu ZENDESK_SUBDOMAIN, ZENDESK_EMAIL og ZENDESK_API_TOKEN, eða ZENDESK_MOCK=true.',
  errorZendeskFailed: 'Stofnun Zendesk-miða mistókst: {detail}',
  errorZendeskHttp: 'Zendesk skilaði HTTP {status}: {detail}',
  errorTicketNotFound: 'Zendesk-miði {ticketId} fannst ekki.',
};
