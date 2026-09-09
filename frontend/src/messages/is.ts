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
    'Umsókn þín um skjólbeltisstyrk hefur verið móttekin og vistuð hjá stofnuninni.',
  labelApplicationNo: 'Umsóknarnúmer',
  labelSubmitted: 'Sent',
  labelWindbreaks: 'Skjólbelti',
  labelStatus: 'Staða',
  statusPending: 'í bið — ekki samþykkt enn',
  submittedNote:
    'Stofnunin fer nú yfir umsókn þína. Þar til hún hefur verið samþykkt telst umbeðið skjólbelti vera fyrirliggjandi skjólbelti: nýjar umsóknir mega ekki skerast það.',
  submittedStoredHeading: 'Vistað í bakvinnslu',
  colLineId: 'Línunúmer',
  colStatus: 'Staða',
  submittedLines:
    '{count, plural, one {# lína} other {# línur}}, {total} m samtals',
  btnApplyAgain: 'Sækja um annað skjólbelti',
  btnBackToApplication: 'Til baka í umsókn',

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
};
