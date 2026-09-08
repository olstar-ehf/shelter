# @island.is/map (Phase 1)

A reusable **Leaflet map + windbreak drawing** component library, built in
island.is conventions as Phase 1 of moving the windbreak grant prototype
into the island.is monorepo:

- **React + TypeScript** components (`WindbreakMap`, `WindbreakDrawControl`,
  `WindbreakLegend`).
- **react-intl** with per-locale ICU message namespaces
  (`src/messages/en.ts`, `src/messages/is.ts`) — the island.is
  `libs/localization` pattern, ready to be lifted into a `libs/map` project
  with Nx.
- **Shared validation** (`src/geometry.ts`, `useWindbreakValidation`):
  inside-own-land, minimum length, and no crossing/touching of existing
  windbreaks (established from `skograekt.skjolbelti` or pending
  applications), returning **message ids** for react-intl formatting.
- **Storybook** stories for drawable / read-only / Icelandic variants.
- **Jest** unit tests including the island.is **locale parity test**
  (all locales must have identical message ids).

## Usage

```tsx
import { IntlProvider } from 'react-intl';
import dynamic from 'next/dynamic';
import { messages } from '@island.is/map';

const WindbreakMap = dynamic(
  () => import('@island.is/map').then((m) => m.WindbreakMap),
  { ssr: false }, // Leaflet needs the browser DOM
);

<IntlProvider locale={locale} messages={messages[locale]}>
  <WindbreakMap
    parcels={parcels}
    existingWindbreaks={windbreaks}
    readOnly={false}
    onLinesChange={setLines}
  />
</IntlProvider>;
```

Also import the CSS once, in the consuming app:

```ts
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
```

Validation results come back as `{ messageId, values }`, e.g.:

```tsx
const validated = useWindbreakValidation(lines, parcels, windbreaks);
// formatMessage({ id: validation.messageId }, validation.values)
```

## island.is adoption notes

- The package layout (`src/`, stories at the lib root, Jest, `package.json`
  with peers) mirrors an Nx library; add `project.json` targets
  (`lint`, `test`, `storybook`) when dropping it into the monorepo.
- `WindbreakLegend` and the map shell use plain semantic markup on purpose;
  swap them for **island-ui** components (`Box`, `Text`, `Tag`, `Button`)
  at adoption time — `@island.is/island-ui` is not published to public npm.
- In the monorepo, messages would be loaded via `libs/localization`
  (`useLocale` + `useNamespaces('is.map')`) instead of the local
  `messages[locale]` object; the catalog content transfers 1:1.
- The draw control overrides leaflet-draw's own UI strings (`L.drawLocal`)
  from the catalogs, so the toolbar/tooltips follow the active locale.

## Development

```bash
npm install
npm run typecheck
npm test
npm run storybook          # http://localhost:6006
```
