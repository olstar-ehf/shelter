"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.is = void 0;
exports.is = {
    map: {
        legendParcels: 'Land þitt',
        legendEstablished: 'Skjólbelti (eldri)',
        legendPending: 'Í bið (ekki samþykkt)',
        popupEstablished: 'Skjólbelti',
        popupEstablishedPlanted: 'Skjólbelti (gróðursett {year})',
        popupPending: 'Umsókn í bið {applicationId} — ekki samþykkt enn',
        insideLand: 'Innan lands þíns',
        spansSeveralParcels: 'Nær yfir fleiri landspildur',
    },
    validation: {
        minPoints: 'Skjólbelti þarf að minnsta kosti 2 punkta.',
        tooShort: 'Of stutt: {length} m (lágmark {min} m).',
        outsideLand: 'Fyrir utan land þitt: teiknaðu skjólbeltið innan landspildna þinna.',
        crossesEstablished: 'Sker eða snertir skjólbelti ({lineId}).',
        crossesPending: 'Sker eða snertir umsókn í bið {applicationId} ({lineId}).',
        crossesDrawn: 'Sker eða snertir annað skjólbelti sem þú ert að teikna í þessari umsókn.',
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
