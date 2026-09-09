/**
 * English messages of the windbreak application template (ICU MessageFormat),
 * island.is style: a nested namespace per locale, flattened for react-intl.
 * The template's keys live under the 'windbreak' namespace; server error
 * messages and portal chrome stay in the app catalogs, and the map lib owns
 * map.* / validation.* / drawLocal.*.
 */
export const windbreakEn = {
  application: {
    name: 'Windbreak grant',
  },
  step: {
    yourDetails: 'Your details',
    drawWindbreak: 'Draw windbreak',
    review: 'Review',
    submitted: 'Submitted',
  },
  draw: {
    title: 'Draw your windbreak',
    helpParcels:
      'Your registered parcels are shown on the map. Use the line tool (top right) to draw one or more windbreaks inside your land. Click to add points, double-click (or press Enter) to finish. Use the edit tools to move or delete lines.',
    helpExisting:
      'Your land already has {established} and {pending} (not accepted yet). A new windbreak may not cross or touch any of them, or another windbreak in this application.',
    countEstablished:
      '{count, plural, one {# established windbreak} other {# established windbreaks}}',
    countPending:
      '{count, plural, one {# pending application} other {# pending applications}}',
  },
  review: {
    title: 'Review your application',
    help:
      'Check the windbreaks you have drawn below and submit the application when you are satisfied. In this step the map is read-only: press Back to map to add, move or delete a line.',
    heading: 'Windbreaks in this application',
    note: 'The grant service checks these windbreaks again when you submit.',
    submitFailedGeneric: 'Submission failed.',
  },
  lines: {
    heading: 'Drawn windbreaks',
    none: 'No windbreaks drawn yet.',
    colNumber: '#',
    colLength: 'Length',
    colParcel: 'On parcel',
    colCheck: 'Check',
    totalLength: 'Total length:',
  },
  actions: {
    review: 'Review application',
    backToMap: 'Back to map',
    submit: 'Submit application',
  },
};

export type WindbreakTemplateMessages = typeof windbreakEn;
