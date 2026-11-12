/**
 * Íslensk skilaboð fyrir skjólbeltisumsóknarsniðmátið (ICU MessageFormat).
 * Sömu lyklar og í en.ts (locale parity er prófuð í test/messages.spec.ts).
 */
import type { WindbreakTemplateMessages } from './en';

export const windbreakIs: WindbreakTemplateMessages = {
  application: {
    name: 'Skjólbeltastyrkur',
  },
  step: {
    label: 'Skref umsóknar',
    yourDetails: 'Þínar upplýsingar',
    drawWindbreak: 'Teikna skjólbelti',
    review: 'Yfirfara',
    submitted: 'Sótt um',
  },
  draw: {
    title: 'Teiknaðu skjólbeltið',
    modeLabel: 'Teikniaðferð',
    modeMouse: 'Mús',
    modeCamera: 'Myndavélahamur',
    helpParcels:
      'Landspildur þínar eru sýndar á kortinu. Teiknaðu með músinni: veldu línutólið (efst til hægri), smelltu á kortið til að bæta við punktum og tvísmelltu (eða ýttu á Enter) til að ljúka. Til að teikna án músar skaltu velja Myndavélaham.',
    helpExisting:
      'Á landi þínu eru þegar {established} og {pending} (ekki samþykktar enn). Nýtt skjólbelti má ekki skerast eða snerta neitt þeirra, né annað skjólbelti í þessari umsókn.',
    countEstablished:
      '{count, plural, one {# skjólbelti} other {# skjólbelti}}',
    countPending:
      '{count, plural, one {# umsókn í bið} other {# umsóknir í bið}}',
  },
  review: {
    title: 'Yfirfarðu umsóknina',
    help:
      'Yfirfarðu skjólbeltin sem þú hefur teiknað hér að neðan og sendu umsóknina þegar þú ert sátt(ur). Í þessu skrefi er kortið skrifvarið: ýttu á Til baka á kortið til að bæta við, færa eða eyða línu.',
    heading: 'Skjólbelti í þessari umsókn',
    note: 'Stofnunin yfirfer þessi skjólbelti aftur þegar þú sendir umsóknina.',
    submitFailedGeneric: 'Sending tókst ekki.',
  },
  lines: {
    heading: 'Teiknuð skjólbelti',
    none: 'Engin skjólbelti teiknuð enn.',
    colNumber: '#',
    colLength: 'Lengd',
    colParcel: 'Á landspildu',
    colCheck: 'Athugun',
    colActions: 'Aðgerðir',
    removeAction: 'Fjarlægja',
    removeLine: 'Fjarlægja skjólbeltalínu {n}',
    selectHint:
      'Veldu línu í töflunni til að auðkenna hana á kortinu. Með lyklaborði: notaðu Tab til að fara á línu og ýttu á Enter eða bilstöng.',
    totalLength: 'Heildarlengd:',
  },
  actions: {
    review: 'Yfirfara umsókn',
    backToMap: 'Til baka á kortið',
    submit: 'Senda umsókn',
  },
};
