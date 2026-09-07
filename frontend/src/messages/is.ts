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

  // skref
  stepYourDetails: 'Þínar upplýsingar',
  stepDrawWindbreak: 'Teikna skjólbelti',
  stepReview: 'Yfirfara',
  stepSubmitted: 'Sótt um',

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

  // umsóknarsíða
  applyTitleDraw: 'Teiknaðu skjólbeltið',
  applyTitleReview: 'Yfirfarðu umsóknina',
  helpDrawParcels:
    'Landspildur þínar eru sýndar á kortinu. Notaðu línutólið (efst til hægri) til að teikna eitt eða fleiri skjólbelti innan lands þíns. Smelltu til að bæta við punktum, tvísmelltu (eða ýttu á Enter) til að ljúka. Notaðu breytingatól til að færa eða eyða línum.',
  helpDrawExisting:
    'Á landi þínu eru þegar {established} og {pending} (ekki samþykktar enn). Nýtt skjólbelti má ekki skerast eða snerta neitt þeirra, né annað skjólbelti í þessari umsókn.',
  countEstablished:
    '{count, plural, one {# skjólbelti} other {# skjólbelti}}',
  countPending:
    '{count, plural, one {# umsókn í bið} other {# umsóknir í bið}}',
  helpReview:
    'Yfirfarðu skjólbeltin sem þú hefur teiknað hér að neðan og sendu umsóknina þegar þú ert sátt(ur). Í þessu skrefi er kortið skrifvarið: ýttu á Til baka á kortið til að bæta við, færa eða eyða línu.',
  legendParcels: 'Land þitt',
  legendEstablished: 'Skjólbelti (eldri)',
  legendPending: 'Í bið (ekki samþykkt)',
  drawnHeadingLabel: 'Teiknuð skjólbelti',
  drawnNone: 'Engin skjólbelti teiknuð enn.',
  colNumber: '#',
  colLength: 'Lengd',
  colParcel: 'Á landspildu',
  colCheck: 'Athugun',
  reviewPanelHeading: 'Skjólbelti í þessari umsókn',
  reviewPanelNote:
    'Stofnunin yfirfer þessi skjólbelti aftur þegar þú sendir umsóknina.',
  totalLength: 'Heildarlengd:',
  btnBackToMap: 'Til baka á kortið',
  btnSubmitApplication: 'Senda umsókn',
  btnReviewApplication: 'Yfirfara umsókn',
  spansSeveralParcels: 'Nær yfir fleiri landspildur',

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

  // biðlari (kort og dýnamískur texti)
  chipInsideLand: 'Innan lands þíns',
  popupEstablished: 'Skjólbelti',
  popupEstablishedPlanted: 'Skjólbelti (gróðursett {year})',
  popupPending: 'Umsókn í bið {applicationId} — ekki samþykkt enn',
  submitFailedGeneric: 'Sending tókst ekki.',

  // staðfestingarskilaboð (lyklar frá sameiginlega geometry-einingunni)
  validationMinPoints: 'Skjólbelti þarf að minnsta kosti 2 punkta.',
  validationTooShort: 'Of stutt: {length} m (lágmark {min} m).',
  validationOutsideLand:
    'Fyrir utan land þitt: teiknaðu skjólbeltið innan landspildna þinna.',
  validationCrossesEstablished:
    'Sker eða snertir skjólbelti ({lineId}).',
  validationCrossesPending:
    'Sker eða snertir umsókn í bið {applicationId} ({lineId}).',
  validationCrossesDrawn:
    'Sker eða snertir annað skjólbelti sem þú ert að teikna í þessari umsókn.',

  // villuskilaboð þjónustu
  errorNoProperties:
    'Fasteignir-Xroad fann engar fasteignir á kennitölu {kennitala}.',
  errorNoParcels: 'Engar landspildur fundust fyrir landeignarnúmer {list}.',
  errorNoLines: 'Engar skjólbeltislínur bárust.',
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
  errorStoreFailed: 'Vista skjólbeltið tókst ekki (HTTP {status}): {detail}',
};

/** Íslenskir textar fyrir leaflet-draw (L.drawLocal override). */
export const drawLocalIs = {
  draw: {
    toolbar: {
      actions: { title: 'Hætta við teikningu', text: 'Hætta við' },
      finish: { title: 'Ljúka teikningu', text: 'Ljúka' },
      undo: { title: 'Eyða síðasta punkti', text: 'Eyða síðasta punkti' },
      buttons: {
        polyline: 'Teikna skjólbeltislínu',
        polygon: 'Teikna marghyrning',
        rectangle: 'Teikna rétthyrning',
        circle: 'Teikna hring',
        marker: 'Setja merki',
        circlemarker: 'Setja hringmerki',
      },
    },
    handlers: {
      circle: {
        tooltip: { start: 'Smelltu og dragðu til að teikna hring.' },
        radius: 'Radíus',
      },
      circlemarker: {
        tooltip: { start: 'Smelltu á kortið til að setja hringmerki.' },
      },
      marker: {
        tooltip: { start: 'Smelltu á kortið til að setja merki.' },
      },
      polygon: {
        tooltip: {
          start: 'Smelltu til að hefja teikningu.',
          cont: 'Smelltu til að halda áfram.',
          end: 'Smelltu á fyrsta punkt til að loka forminu.',
        },
      },
      polyline: {
        error: '<strong>Villa:</strong> brúnir mega ekki skerast!',
        tooltip: {
          start: 'Smelltu til að hefja teikningu.',
          cont: 'Smelltu til að halda áfram.',
          end: 'Smelltu á síðasta punkt til að ljúka.',
        },
      },
      rectangle: {
        tooltip: { start: 'Smelltu og dragðu til að teikna rétthyrning.' },
      },
      simpleshape: {
        tooltip: { end: 'Slepptu músinni til að ljúka teikningu.' },
      },
    },
  },
  edit: {
    toolbar: {
      actions: {
        save: { title: 'Vista breytingar', text: 'Vista' },
        cancel: {
          title: 'Hætta við breytingar, fleygir öllum breytingum',
          text: 'Hætta við',
        },
        clearAll: { title: 'Hreinsa alla laga', text: 'Hreinsa allt' },
      },
      buttons: {
        edit: 'Breyta lögum',
        editDisabled: 'Engin lög til að breyta',
        remove: 'Eyða lögum',
        removeDisabled: 'Engin lög til að eyða',
      },
    },
    handlers: {
      edit: {
        tooltip: {
          text: 'Dragðu handföng eða merki til að breyta.',
          subtext: 'Smelltu á hætta við til að afturkalla breytingar.',
        },
      },
      remove: {
        tooltip: { text: 'Smelltu á hlut til að fjarlægja.' },
      },
    },
  },
};
