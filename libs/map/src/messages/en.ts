/**
 * English messages for the map lib (ICU MessageFormat), island.is-style:
 * a nested namespace object per locale; consumers feed it to react-intl.
 */
export const en = {
  map: {
    ariaLabel:
      'Map of your land for drawing windbreak lines. Use the draw button to add a line.',
    legendParcels: 'Your parcels',
    legendEstablished: 'Established windbreak',
    legendPending: 'Pending (not accepted)',
    popupEstablished: 'Established windbreak',
    popupEstablishedPlanted: 'Established windbreak (planted {year})',
    popupPending: 'Pending application {applicationId} — not accepted yet',
    insideLand: 'Inside your land',

    coordsLabel: 'Coordinates (WGS84)',
    cameraToggle: 'Camera mode',
    cameraToggleOff: 'Leave camera mode',
    cameraInstructions:
      'Camera mode: the crosshair stays at the centre - the arrow keys move the map underneath it (hold to keep moving; Shift for fine steps). Hold Z to zoom in and X to zoom out. Space places a point; double-tap space finishes the line and camera mode stays on for the next one. Backspace removes the last point, Escape leaves camera mode. Screen reader: if the arrow keys do not move the map, press NVDA+Space to switch to focus mode.',
    cameraZoom: 'Zoom level {zoom}.',
    cameraPointPlaced: 'Point {n} placed at {lat}, {lon}.',
    cameraUndone: 'Last point removed.',
    cameraFinished: 'Line added. Camera mode stays on.',
    cameraCancelled: 'Camera mode off.',
    cameraNeedPoints: 'Place at least two points before finishing.',
    coordsDraftHint: 'The windbreak you are drawing appears here as WKT.',
    coordsSummary: 'Enter coordinates instead',
    coordsHelp:
      'Paste a WKT LINESTRING (lon lat, lon lat, ...) or one "lon,lat" pair per line. Separate multiple lines with a blank line. Coordinates are WGS84 (EPSG:4326).',
    coordsPlaceholder: 'LINESTRING (-21.80 65.48, -21.79 65.48)',
    coordsAdd: 'Add line',
    coordsInvalid:
      'Could not read the coordinates. Use a WKT LINESTRING or one "lon,lat" pair per line.',
    coordsTooFew: 'A line needs at least two points.',
    coordsAdded: '{count, plural, one {# line added} other {# lines added}}',
    spansSeveralParcels: 'Spans several parcels',
  },
  validation: {
    minPoints: 'A windbreak needs at least 2 points.',
    tooShort: 'Too short: {length} m (minimum {min} m).',
    outsideLand: 'Outside your land: draw the windbreak inside your parcels.',
    crossesEstablished: 'Crosses or touches established windbreak ({lineId}).',
    crossesPending:
      'Crosses or touches pending application {applicationId} ({lineId}).',
    crossesDrawn:
      'Crosses or touches another windbreak you are drawing in this application.',
  },
  drawLocal: {
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
        marker: { tooltip: { start: 'Click map to place marker.' } },
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
          cancel: {
            title: 'Cancel editing, discards all changes',
            text: 'Cancel',
          },
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
        remove: { tooltip: { text: 'Click on a feature to remove.' } },
      },
    },
  },
};

export type MapMessages = typeof en;
