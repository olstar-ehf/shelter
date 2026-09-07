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

  // stepper
  stepYourDetails: 'Your details',
  stepDrawWindbreak: 'Draw windbreak',
  stepReview: 'Review',
  stepSubmitted: 'Submitted',

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

  // apply page
  applyTitleDraw: 'Draw your windbreak',
  applyTitleReview: 'Review your application',
  helpDrawParcels:
    'Your registered parcels are shown on the map. Use the line tool (top right) to draw one or more windbreaks inside your land. Click to add points, double-click (or press Enter) to finish. Use the edit tools to move or delete lines.',
  helpDrawExisting:
    'Your land already has {established} and {pending} (not accepted yet). A new windbreak may not cross or touch any of them, or another windbreak in this application.',
  countEstablished:
    '{count, plural, one {# established windbreak} other {# established windbreaks}}',
  countPending:
    '{count, plural, one {# pending application} other {# pending applications}}',
  helpReview:
    'Check the windbreaks you have drawn below and submit the application when you are satisfied. In this step the map is read-only: press Back to map to add, move or delete a line.',
  legendParcels: 'Your parcels',
  legendEstablished: 'Established windbreak',
  legendPending: 'Pending (not accepted)',
  drawnHeadingLabel: 'Drawn windbreaks',
  drawnNone: 'No windbreaks drawn yet.',
  colNumber: '#',
  colLength: 'Length',
  colParcel: 'On parcel',
  colCheck: 'Check',
  reviewPanelHeading: 'Windbreaks in this application',
  reviewPanelNote:
    'The grant service checks these windbreaks again when you submit.',
  totalLength: 'Total length:',
  btnBackToMap: 'Back to map',
  btnSubmitApplication: 'Submit application',
  btnReviewApplication: 'Review application',
  spansSeveralParcels: 'Spans several parcels',

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

  // client (map + dynamic UI)
  chipInsideLand: 'Inside your land',
  popupEstablished: 'Established windbreak',
  popupEstablishedPlanted: 'Established windbreak (planted {year})',
  popupPending: 'Pending application {applicationId} — not accepted yet',
  submitFailedGeneric: 'Submission failed.',

  // validation messages (keys returned by the shared geometry module)
  validationMinPoints: 'A windbreak needs at least 2 points.',
  validationTooShort: 'Too short: {length} m (minimum {min} m).',
  validationOutsideLand:
    'Outside your land: draw the windbreak inside your parcels.',
  validationCrossesEstablished:
    'Crosses or touches established windbreak ({lineId}).',
  validationCrossesPending:
    'Crosses or touches pending application {applicationId} ({lineId}).',
  validationCrossesDrawn:
    'Crosses or touches another windbreak you are drawing in this application.',

  // server-side error messages
  errorNoProperties:
    'Fasteignir-Xroad found no properties for kennitala {kennitala}.',
  errorNoParcels: 'No land parcels found for landeignarnumer {list}.',
  errorNoLines: 'No windbreak lines were received.',
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
  errorStoreFailed: 'Storing the windbreak failed (HTTP {status}): {detail}',
};

/** leaflet-draw's own UI strings (L.drawLocal override). */
export const drawLocalEn = {
  draw: {
    toolbar: {
      actions: { title: 'Cancel drawing', text: 'Cancel' },
      finish: { title: 'Finish drawing', text: 'Finish' },
      undo: { title: 'Delete last point drawn', text: 'Delete last point' },
      buttons: {
        polyline: 'Draw a windbreak line',
        polygon: 'Draw a polygon',
        rectangle: 'Draw a rectangle',
        circle: 'Draw a circle',
        marker: 'Draw a marker',
        circlemarker: 'Draw a circlemarker',
      },
    },
    handlers: {
      circle: {
        tooltip: { start: 'Click and drag to draw circle.' },
        radius: 'Radius',
      },
      circlemarker: {
        tooltip: { start: 'Click map to place circle marker.' },
      },
      marker: {
        tooltip: { start: 'Click map to place marker.' },
      },
      polygon: {
        tooltip: {
          start: 'Click to start drawing shape.',
          cont: 'Click to continue drawing shape.',
          end: 'Click first point to close this shape.',
        },
      },
      polyline: {
        error: '<strong>Error:</strong> shape edges cannot cross!',
        tooltip: {
          start: 'Click to start drawing line.',
          cont: 'Click to continue drawing line.',
          end: 'Click last point to finish line.',
        },
      },
      rectangle: {
        tooltip: { start: 'Click and drag to draw rectangle.' },
      },
      simpleshape: {
        tooltip: { end: 'Release mouse to finish drawing.' },
      },
    },
  },
  edit: {
    toolbar: {
      actions: {
        save: { title: 'Save changes', text: 'Save' },
        cancel: { title: 'Cancel editing, discards all changes', text: 'Cancel' },
        clearAll: { title: 'Clear all layers', text: 'Clear All' },
      },
      buttons: {
        edit: 'Edit layers',
        editDisabled: 'No layers to edit',
        remove: 'Delete layers',
        removeDisabled: 'No layers to delete',
      },
    },
    handlers: {
      edit: {
        tooltip: {
          text: 'Drag handles or markers to edit features.',
          subtext: 'Click cancel to undo changes.',
        },
      },
      remove: {
        tooltip: { text: 'Click on a feature to remove.' },
      },
    },
  },
};
