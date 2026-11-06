/**
 * Íslensk skilaboð fyrir kortasafnið (ICU MessageFormat). Sami lyklar og í
 * en.ts. Icelandic messages for the map lib - same keys as en.ts.
 */
import type { MapMessages } from './en';

export const is: MapMessages = {
  map: {
    ariaLabel:
      'Kort af landi þínu til að teikna skjólbeltalínur. Notaðu teiknitakka til að bæta við línu.',
    legendParcels: 'Land þitt',
    legendEstablished: 'Skjólbelti (eldri)',
    legendPending: 'Í bið (ekki samþykkt)',
    popupEstablished: 'Skjólbelti',
    popupEstablishedPlanted: 'Skjólbelti (gróðursett {year})',
    popupPending: 'Umsókn í bið {applicationId} — ekki samþykkt enn',
    insideLand: 'Innan lands þíns',

    aimToggle: 'Teikna með lyklaborði',
    aimToggleOff: 'Hætta að teikna með lyklaborði',
    aimInstructions:
      'Nákvæmnisteikning: krossinn stendur kyrr í miðjunni - örvar færa kortið undir honum (Shift gefur fína skref). Enter setur punkt, Backspace fjarlægir síðasta punkt, Escape hættir.',
    aimPointPlaced: 'Punktur {n} settur á {lat}, {lon}.',
    aimUndone: 'Síðasti punktur fjarlægður.',
    aimFinish: 'Ljúka línu',
    aimFinished: 'Línu bætt við.',
    aimCancelled: 'Nákvæmnisteikning aflétt.',
    aimNeedPoints: 'Settu að minnsta kosti tvo punkta áður en línunni er lokað.',
    coordsSummary: 'Sláðu inn hnit í staðinn',
    coordsHelp:
      'Límdu WKT LINESTRING (lon lat, lon lat, ...) eða eitt "lon,lat" hnit par í hverri línu. Tóma lína skilur að skjólbeltalínur. Hnit eru í WGS84 (EPSG:4326).',
    coordsPlaceholder: 'LINESTRING (-21.80 65.48, -21.79 65.48)',
    coordsAdd: 'Bæta við línu',
    coordsInvalid:
      'Tókst ekki að lesa hnitin. Notaðu WKT LINESTRING eða eitt "lon,lat" par í hverri línu.',
    coordsTooFew: 'Lína þarf að minnsta kosti tvo punkta.',
    coordsAdded: '{count, plural, one {# lína bætt við} other {# línur bætt við}}',
    spansSeveralParcels: 'Nær yfir fleiri landspildur',
  },
  validation: {
    minPoints: 'Skjólbelti þarf að minnsta kosti 2 punkta.',
    tooShort: 'Of stutt: {length} m (lágmark {min} m).',
    outsideLand:
      'Fyrir utan land þitt: teiknaðu skjólbeltið innan landspildna þinna.',
    crossesEstablished: 'Sker eða snertir skjólbelti ({lineId}).',
    crossesPending:
      'Sker eða snertir umsókn í bið {applicationId} ({lineId}).',
    crossesDrawn:
      'Sker eða snertir annað skjólbelti sem þú ert að teikna í þessari umsókn.',
  },
  drawLocal: {
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
        remove: { tooltip: { text: 'Smelltu á hlut til að fjarlægja.' } },
      },
    },
  },
};
