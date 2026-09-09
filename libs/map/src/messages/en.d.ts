/**
 * English messages for the map lib (ICU MessageFormat), island.is-style:
 * a nested namespace object per locale; consumers feed it to react-intl.
 */
export declare const en: {
    map: {
        legendParcels: string;
        legendEstablished: string;
        legendPending: string;
        popupEstablished: string;
        popupEstablishedPlanted: string;
        popupPending: string;
        insideLand: string;
        spansSeveralParcels: string;
    };
    validation: {
        minPoints: string;
        tooShort: string;
        outsideLand: string;
        crossesEstablished: string;
        crossesPending: string;
        crossesDrawn: string;
    };
    drawLocal: {
        draw: {
            toolbar: {
                actions: {
                    title: string;
                    text: string;
                };
                finish: {
                    title: string;
                    text: string;
                };
                undo: {
                    title: string;
                    text: string;
                };
                buttons: {
                    polyline: string;
                    polygon: string;
                    rectangle: string;
                    circle: string;
                    marker: string;
                    circlemarker: string;
                };
            };
            handlers: {
                circle: {
                    tooltip: {
                        start: string;
                    };
                    radius: string;
                };
                circlemarker: {
                    tooltip: {
                        start: string;
                    };
                };
                marker: {
                    tooltip: {
                        start: string;
                    };
                };
                polygon: {
                    tooltip: {
                        start: string;
                        cont: string;
                        end: string;
                    };
                };
                polyline: {
                    error: string;
                    tooltip: {
                        start: string;
                        cont: string;
                        end: string;
                    };
                };
                rectangle: {
                    tooltip: {
                        start: string;
                    };
                };
                simpleshape: {
                    tooltip: {
                        end: string;
                    };
                };
            };
        };
        edit: {
            toolbar: {
                actions: {
                    save: {
                        title: string;
                        text: string;
                    };
                    cancel: {
                        title: string;
                        text: string;
                    };
                    clearAll: {
                        title: string;
                        text: string;
                    };
                };
                buttons: {
                    edit: string;
                    editDisabled: string;
                    remove: string;
                    removeDisabled: string;
                };
            };
            handlers: {
                edit: {
                    tooltip: {
                        text: string;
                        subtext: string;
                    };
                };
                remove: {
                    tooltip: {
                        text: string;
                    };
                };
            };
        };
    };
};
export type MapMessages = typeof en;
