# Windbreak Grant Application (prototype)

A prototype application form for farmers applying for a government grant to
plant a **windbreak** (shelterbelt) on their land.

The key idea: the farmer is **already logged in** to the government portal,
so the only things assumed about them are their **name and kennitala**
(Icelandic social number). When they press *"Apply for windbreak"*, the
system looks up the properties registered on that kennitala
(Fasteignir-Xroad), builds the unique list of **landeignarnumer** (land ids),
and loads those parcels and their existing windbreaks. The form therefore
asks for exactly one thing — **where** the windbreak should be. The farmer
draws lines on a map of their own land and submits.

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│  frontend (Docker)       │  HTTP  │  backend (Docker)            │
│  NestJS (TypeScript)     │───────▶│  pygeoapi 0.21 (OGC API)     │
│  server-rendered views   │  JSON  │  farm_parcels (GeoJSON)      │
│  + React client (esbuild)│        │  windbreak_applications      │
│  http://localhost:8000   │        │  (PostgreSQL provider, read) │
└──────────┬───────────────┘        └──────────────┬───────────────┘
           │ Fasteignir-Xroad (real by default)    │ PostGIS (shared):
           │ kennitala -> properties -> unique     │  skjólbelti registry
           │ landeignarnumer                       │  + windbreak_applications
           ▼                                       ▼
     https://api.fasteignaskra.is           PostgreSQL (EPSG:3057 + 4326)
     (needs island.is Bearer token)         db migrations own the schema
```

* The **frontend** is a [NestJS](https://nestjs.com/) application written in
  TypeScript. Pages are **server-rendered** with Handlebars (Nest MVC), and
  the Nest server performs the lookups, the schema check and the application
  submissions itself. The interactive map is a **React client**
  (`client/main.tsx`, compiled with esbuild) rendering the **application
  template** `@island.is/windbreak-application` (Phase 2), whose custom
  `windbreakLines` map field builds on the reusable `@island.is/map` lib
  (Phase 1). The template owns its zod `dataSchema`, states, declarative
  form and messages (`windbreak.*`).
* The **Fasteignir-Xroad** property lookup (`src/fasteignir/`) uses the
  **real client by default** (X-Road gateway, island.is Bearer token via
  `FASTEIGNIR_TOKEN`). Failures surface as typed `PropertiesLookupError`
  codes mapped to localized messages; `FASTEIGNIR_MOCK=true` selects the
  mock. The mock returns, for kennitala `2409693949`, two registered
  properties that both sit on the same land — so the unique
  `landeignarnumer` list step yields `[163368]`.
* The **backend** is [pygeoapi](https://pygeoapi.io/) serving an
  [OGC API - Features](https://ogcapi.ogc.org/features/) interface: parcels
  come from GeoJSON files, and the `windbreak_applications` collection is
  served **from PostGIS** (pygeoapi's PostgreSQL provider is read-only, so
  the OGC API is the agency-facing read interface for submitted lines).
* **PostGIS persistence**: submitted applications are written by the
  NestJS `WindbreakApplicationsStore` into the `windbreak_applications`
  table (WGS84), whose schema is owned by the migrations in
  `frontend/db/migrations` (`npm run db:migrate`, run automatically by the
  containers). Established windbreaks stay in the skógrækt registry
  (`skograekt.skjolbelti`, EPSG:3057).
* Both run in Docker via `docker-compose`.

## Quick start (development)

**First, configure the environment** (`.env` is gitignored — copy the
example and adjust; both compose files interpolate it):

```bash
cp .env.example .env
# .env: set WINDBREAK_DATABASE_URL to your PostGIS server (reachable from
# your machine/VPN), e.g. postgres://USER:PASS@server1.logs.is:5432/sde
```

```bash
docker compose up --build
```

* Frontend: <http://localhost:8000> (NestJS dev server with watch mode)
* Backend (OGC API): <http://localhost:5000>

> The real clients are the default: without `WINDBREAK_DATABASE_URL` in
> `.env`, the backend container previously fell back to a `localhost`
> PostgreSQL and failed to boot ("connection refused"); the entrypoint now
> boots without a database (the OpenAPI document is baked at build time,
> the PostgreSQL provider stays lazy) and logs a clear warning instead.
> The frontend still fails fast with a clear message when the registry is
> real but no database is configured.

Then, in the UI:

1. Click **Apply for windbreak** (the prototype assumes the demo user —
   `DEMO_FULL_NAME` / `DEMO_KENNITALA`, default Guðmundur Jónsson /
   2409693949 — is already signed in).
2. The NestJS server asks Fasteignir-Xroad for the properties on the
   kennitala (mock when `FASTEIGNIR_MOCK=true`), builds the unique
   `landeignarnumer` list (163368), and loads those parcels and their
   existing windbreaks, rendering the draw page with the GeoJSON embedded
   in it.
3. Use the line tool (top right of the map) to draw one or more windbreaks
   inside the parcels. Lines outside the farmer's land, or crossing an
   existing/pending windbreak, are rejected.
4. Review and submit — the answers (the drawn lines) are POSTed to the
   NestJS server, which checks them against the template's data schema
   (zod), re-validates each line against the land server side and stores
   them (with the applicant's kennitala) in **PostGIS** through the
   applications store. The confirmation page reads the lines back from the
   store as proof of persistence, and the same rows are visible through the
   OGC API:
   `GET /collections/windbreak_applications/items?application_id=WB-...`.

## Quick start (production-style build)

Uses the same `.env` (see above — `WINDBREAK_DATABASE_URL` required for the
real PostGIS clients):

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

* Frontend: <http://localhost:8080> (the compiled NestJS server)
* Backend: <http://localhost:5000>

## Running without Docker (development)

Backend (requires Python 3.10–3.11):

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install pygeoapi==0.21.0 flask-cors gunicorn psycopg2-binary geoalchemy2
# local config: absolute data dir + the GeoJSON windbreak_applications
# variant for OpenAPI generation (docgen-config.py swaps the PostgreSQL
# provider - openapi generate instantiates providers, so the pg one needs
# the database)
python3 backend/docgen-config.py /tmp/local.config.yml /absolute/path/to/backend/data
export PYGEOAPI_CONFIG=/tmp/local.config.yml
pygeoapi openapi generate $PYGEOAPI_CONFIG --output-file /tmp/local.openapi.yml
export PYGEOAPI_OPENAPI=/tmp/local.openapi.yml
cd backend
gunicorn --workers 1 --bind 127.0.0.1:5000 windbreak_app:APP
```

(With `WINDBREAK_DATABASE_URL` exported, `windbreak_app.py` splits it into
the per-part variables and expands the `${WINDBREAK_DB_*}` placeholders of
the committed `pygeoapi.config.yml`, so the OGC API serves
`windbreak_applications` from PostGIS.)

Frontend:

```bash
# build the libs first, in dependency order (the template needs @island.is/map)
cd libs/map && npm install && npm run build
cd ../libs/application/templates/windbreak && npm install && npm run build
cd ../../../frontend
npm install
npm run build          # nest build + esbuild client bundle
PYGEOAPI_URL=http://localhost:5000 PORT=8000 npm start
# or, with watch mode:
npm run start:dev
```

The frontend consumes the compiled libs (`@island.is/map`,
`@island.is/windbreak-application`, both `file:` dependencies), so a lib
must be rebuilt after its sources change. The Docker builds do this
automatically (monorepo build context).

Without a database or token, run with the prototype mocks:

```bash
FASTEIGNIR_MOCK=true WINDBREAK_REGISTRY_MOCK=true WINDBREAK_APPLICATIONS_MOCK=true npm start
```

Troubleshooting: if a `file:` lib fails to resolve after `npm install`
(npm can create the scoped symlink one level too deep), recreate the link,
e.g. `ln -sfn ../../../libs/map frontend/node_modules/@island.is/map` and
`ln -sfn ../../../libs/application/templates/windbreak frontend/node_modules/@island.is/windbreak-application`.
The template lib is deliberately resilient to this: its `tsconfig.json`
maps `@island.is/map` to the map lib's sources, and the client esbuild
build aliases `@island.is/map` to the frontend's own install, so a broken
link inside `libs/application/templates/windbreak/node_modules` cannot
break the builds. The Dockerfiles apply the same fixup explicitly
(`fix-lib-links`).

* `PYGEOAPI_URL` — base URL of the pygeoapi backend as seen **from the
  NestJS server** (default `http://localhost:5000`; in Docker it is
  `http://backend:80`).
* `DEMO_FULL_NAME` / `DEMO_KENNITALA` — the only assumed facts about the
  user (default `Guðmundur Jónsson` / `2409693949`).
* `FASTEIGNIR_MOCK` — **real by default**; `true` selects the mock
  Fasteignir-Xroad lookup. The real client needs `FASTEIGNIR_TOKEN` (an
  island.is Bearer JWT) and optionally `FASTEIGNIR_API_URL`.
* `WINDBREAK_REGISTRY_MOCK` — **real by default**; `true` selects the mock
  existing-windbreak registry. The real registry reads `skograekt.skjolbelti`
  from PostGIS.
* `WINDBREAK_APPLICATIONS_MOCK` — **real by default**; `true` selects the
  GeoJSON-file fallback for submitted applications. The real store reads and
  writes the `windbreak_applications` table (migrations in
  `frontend/db/migrations`, applied by `npm run db:migrate` or on container
  start).
* `WINDBREAK_DATABASE_URL` — the PostGIS DSN (or the standard `PGHOST`,
  `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`). Used by the registry, the
  applications store and the backend container, which splits it into the
  per-part connection variables the pygeoapi PostgreSQL provider config
  expands (`windbreak_app.py` also expands `${VAR}` placeholders in the
  pygeoapi config, so no credentials live in the committed YAML).
* `PORT` — server port (default `3000`; the compose files publish it as
  8000/8080).

## Internationalisation (is + en)

The app follows the island.is pattern: one flat **message catalog per
locale** with **ICU MessageFormat** strings. The catalogs are split by
ownership, exactly like island.is's `libs/localization` namespaces:

* `libs/map/src/messages/{en,is}.ts` — the map lib's namespaces:
  `map.*` (legend, popups, chips), `validation.*` (validation message ids
  returned by the lib's geometry code) and `drawLocal.*` (leaflet-draw's own
  UI strings).
* `frontend/src/messages/{en,is}.ts` — the app's chrome/stepper/apply/
  submitted/error keys.

Both sides merge them into one flat catalog (`flattenMessages` in the lib,
`frontend/src/i18n/index.ts` on the server, `client/main.tsx` in the
browser), so the server and the client format the exact same messages —
including the shared `validation.*` ids.

* The **locale** is resolved island.is-style: `?lang=is|en` query parameter
  → `lang` cookie → `Accept-Language` header → default Icelandic. The
  top-bar **Íslenska | English** switcher sets the cookie.
* **Server side** (`src/i18n/`): views receive the raw catalog (`{{t.key}}`)
  and pre-formatted ICU strings (lookup summary, plurals, validation
  errors); `createTranslator(locale)` formats everything else. The server
  imports the libs through the **React-free** entries
  (`@island.is/map/server`, `@island.is/windbreak-application/server`), so
  the NestJS process never loads react-leaflet.
* **Client side**: the apply page embeds the chosen locale; the application
  template's flow renderer (`ApplicationFlow` + the `windbreakLines` field)
  formats everything with `react-intl` (`IntlProvider` + `formatMessage`),
  and `WindbreakDrawControl` overrides leaflet-draw's own UI strings
  (`L.drawLocal`) from `drawLocal.*`.
* Shared validation messages are returned as **message ids** by the map
  lib's geometry code and formatted per locale on both sides.
* Adding a locale = adding `<locale>.ts` catalogs to
  `libs/map/src/messages`, `libs/application/templates/windbreak/src/messages`
  and `frontend/src/messages` with the same keys (parity is tested), and
  registering them in `frontend/src/i18n/index.ts` (plus a switcher link).

## OGC API backend

Collections:

| Collection               | Geometry | Purpose                                  | Backing            |
| ------------------------ | -------- | ---------------------------------------- | ------------------ |
| `farmers`                | Point    | Farmer registry (name, farm, contact)    | GeoJSON file       |
| `farm_parcels`           | Polygon  | Registered land parcels per farmer       | GeoJSON file       |
| `windbreak_applications` | Line     | Windbreak lines (grant applications)     | **PostGIS** (read) |

The NestJS server reads parcels through the OGC API; submitted applications
are read from the PostGIS-backed applications store (the `windbreak_applications`
collection serves the same rows read-only for agency/curl access):

```text
GET  /collections/farm_parcels/items?landeignarnumer=163368&f=json&limit=100
GET  /collections/windbreak_applications/items?parcel_id=IS-163368&f=json&limit=100
GET  /collections/windbreak_applications/items?application_id=WB-...&f=json
```

`landeignarnumer` and `parcel_id` are regular query parameters: pygeoapi
turns unknown query parameters into property filters. The `farmers`
collection is kept as a registry, but the application flow no longer
assumes a `farmer_id` — it joins through the `landeignarnumer` list from
the Fasteignir-Xroad lookup. pygeoapi 0.21's PostgreSQL provider is
read-only, so submissions go NestJS → the applications store → PostGIS
directly; the provider config (`backend/pygeoapi.config.yml`) takes
`${WINDBREAK_DB_*}` env placeholders that `windbreak_app.py` expands
(credentials never live in the committed YAML).

### PostGIS migrations (windbreak applications)

The `windbreak_applications` schema is owned by SQL migrations in
`frontend/db/migrations` (one row per drawn line: `line_id` PK,
`application_id`, `kennitala`, `parcel_id`, `status`, `length_m`,
`submitted_at` and the WGS84 `geometry`). The runner (`frontend/db/migrate.cjs`,
`npm run db:migrate`) tracks applied files in `schema_migrations` and is
idempotent; the containers run it before starting the server.

Note: `pygeoapi openapi generate` instantiates the providers, so generating
the OpenAPI document requires the database to be reachable. Generate it
against the GeoJSON variant instead (`backend/docgen-config.py`, which
swaps the PostgreSQL provider for the file provider in a config copy). The
running server itself loads providers lazily.

### Existing windbreaks (skógrækt PostGIS)

Established windbreaks are read from the skógrækt database
(`skograekt.skjolbelti`), not invented:

```sql
SELECT objectid, ST_AsGeoJSON(ST_Transform(geometry, 4326))::json AS geojson
FROM skograekt.skjolbelti
WHERE ST_Intersects(geometry,
                    ST_Transform(ST_GeomFromGeoJSON($1)::geometry, 3057))
```

The geometry is stored in **ISN93 (EPSG:3057)**; the query filters to the
windbreaks intersecting the farmer's land (passed as WGS84 GeoJSON) and
returns them transformed to **WGS84 (EPSG:4326)** for the map and
validation. The implementation lives in
`src/windbreaks/windbreak-registry.service.ts` (Postgres via `pg`, real by
default — see `WINDBREAK_REGISTRY_MOCK` above).

### Windbreak line attributes

Windbreak *applications* store: `line_id`, `application_id`, `kennitala`,
`parcel_id`, `status`, `length_m`, `submitted_at`, WGS84 `geometry`.
Statuses:

* `established` — windbreaks that already exist on the land, read from
  `skograekt.skjolbelti` (identified on the map as `skjolbelti-<objectid>`).
* `pending` — submitted but **not accepted yet** (e.g. the seeded
  `WB-2026-0042-1` on parcel `IS-163368`); new applications posted by the
  form also get `pending`.

The draw page shows the farmer's windbreaks on the map (dark green =
established, dashed orange = pending). **A new windbreak may not cross or
touch any other windbreak** — neither established ones nor pending
applications, nor the other lines drawn in the same application. The rule is
checked in the browser (immediate feedback) and again by the NestJS server
before storage, both using the same shared `libs/map/src/geometry.ts` module
(`@turf/line-intersect` + `@turf/line-overlap`) — the lib is the single
source of truth; the frontend only imports it.

## Repository layout

```text
backend/
  Dockerfile                 # extends geopython/pygeoapi:0.21.0
  pygeoapi.config.yml        # pygeoapi configuration (CORS on, editable apps)
  windbreak_app.py           # WSGI entry point with transaction body patch
  data/                      # seed GeoJSON (farmers, parcels, applications)
frontend/
  Dockerfile                 # multi-stage: develop / build / serve (monorepo context)
  nest-cli.json
  tsconfig.json / tsconfig.build.json
  db/
    migrations/*.sql         # PostGIS schema (windbreak_applications) + seed
    migrate.cjs              # SQL migration runner (npm run db:migrate)
  src/
    main.ts                  # Nest bootstrap: static assets + hbs views
    app.module.ts
    app.controller.ts        # GET / , GET /apply, POST /apply, GET /submitted/:id
    app.service.ts           # kennitala -> landeignarnumer -> parcels -> windbreaks
                             # schema check (zod) + submit via the applications store
    fasteignir/
      fasteignir.types.ts    # types mirroring the Fasteignir-Xroad OpenAPI spec
      fasteignir.service.ts  # abstract service + mock + real X-Road client (default)
                             # parseFasteignirResponse + typed PropertiesLookupError
      fasteignir.module.ts   # provider: real by default (FASTEIGNIR_MOCK=true escapes)
    windbreaks/
      windbreak-registry.service.ts  # skograekt.skjolbelti (PostGIS, ISN93->WGS84) + mock
      windbreak-applications.store.ts # applications: PostGIS store (default) + GeoJSON mock
      windbreaks.module.ts   # providers: real by default (WINDBREAK_*_MOCK=true escapes)
    i18n/
      index.ts               # locale resolution + ICU translator; merges the map
                             # lib and template catalogs (map.*/windbreak.* etc.)
    messages/
      en.ts / is.ts          # app chrome/confirmation/error catalogs (island.is style)
  views/
    index.hbs                # landing page (server-rendered, stepper from template labels)
    apply.hbs                # draw page shell + embedded parcels/windbreaks JSON
    submitted.hbs            # confirmation page (reads lines back)
  client/
    main.tsx                 # React bootstrap: IntlProvider + 3-way merged catalogs
    WindbreakApplyPage.tsx   # host: mounts the template flow, submits POST /apply
  public/
    styles.css / favicon.svg # static assets (app.js + app.css are built)
  test/                      # Jest: X-Road contract tests, stores (live PostGIS w/ env)
  e2e-draw-test.js           # headless-browser regression test
libs/map/                     # Phase 1: reusable React map lib (island.is style)
  src/
    index.ts                  # React entry: WindbreakMap + hooks + messages + types
    server.ts                 # React-free entry (@island.is/map/server) for the Nest server
    WindbreakMap.tsx          # Leaflet map + parcels + windbreaks (react-leaflet)
    WindbreakDrawControl.tsx  # leaflet-draw polyline control (L.drawLocal i18n)
    WindbreakLegend.tsx       # presentational legend (island-ui swap point)
    useWindbreakValidation.ts # validation hook (react-intl message ids)
    geometry.ts / types.ts    # shared turf.js validation
    messages/en.ts + is.ts    # react-intl ICU message namespaces
  WindbreakMap.stories.tsx    # Storybook stories (drawable / read-only / Icelandic)
  test/                       # Jest: geometry, locale parity, component smoke
libs/application/templates/windbreak/   # Phase 2: windbreak application template
  package.json                # @island.is/windbreak-application (file: dep of frontend)
  src/
    index.tsx                 # React entry: flow renderer + field registry + template
    server.ts                 # React-free entry (schema/states/form/messages)
    dataSchema.ts             # zod answers schema (validated client + server)
    states.ts                 # draft -> submitted state machine
    form.ts                   # declarative form: draw + review sections
    types.ts                  # application/template/field types
    ApplicationFlow.tsx       # step renderer (stepper + section fields via registry)
    fields/
      index.tsx               # field registry (type -> component)
      WindbreakLinesField.tsx # the custom map field (WindbreakMap + validation table)
    messages/en.ts + is.ts    # template catalog under the windbreak.* namespace
  WindbreakTemplate.stories.tsx  # Storybook stories (draw step / review step)
  test/                       # Jest: dataSchema, states/form, locale parity
docker-compose.yml           # development stack
docker-compose.prod.yml      # production stack
.dockerignore                # keeps host node_modules/dist out of the image contexts
```

## Testing

* `libs/map`: `npm run typecheck`, `npm test` (Jest — geometry rules,
  locale parity, component smoke), `npm run storybook` (stories on :6006).
* `libs/application/templates/windbreak`: `npm run typecheck`, `npm test`
  (Jest — dataSchema contract, states/form structure, locale parity),
  `npm run storybook` (stories on :6007).
* `frontend`: `npm run typecheck` — TypeScript check (server + client);
  `npm test` — Jest (X-Road client contract tests against the OpenAPI
  fixtures, applications store round-trips; the live PostGIS suite runs when
  `WINDBREAK_DATABASE_URL` is set); `npm run build` — `nest build` +
  esbuild client bundle.
* `frontend/e2e-draw-test.js` — headless-browser regression test covering
  the draw flow (inside/outside/crossing validation) and a full submission
  through the NestJS server to the confirmation page. Requires a running
  stack and Playwright's chromium:

  ```bash
  cd frontend
  npm install --no-save playwright-core
  npx playwright-core install chromium-headless-shell
  # with backend (:5000) and the NestJS server (:8000) running:
  node e2e-draw-test.js
  ```

  Note: the submission scenario appends a line to
  `backend/data/windbreak_applications.json` (file-backed mock mode);
  reset that file afterwards. In PostGIS mode, submitted lines land in the
  `windbreak_applications` table and can be cleaned with SQL.

## Prototype assumptions & limitations

* **Authentication is assumed to have happened** in the government portal,
  and the only facts assumed about the user are their **name and
  kennitala** (`DEMO_FULL_NAME` / `DEMO_KENNITALA`, default
  `Guðmundur Jónsson` / `2409693949`). No `farmer_id` is assumed.
* **The Fasteignir-Xroad client is real by default** but needs an island.is
  Bearer token (`FASTEIGNIR_TOKEN`) that this prototype does not ship with;
  set `FASTEIGNIR_MOCK=true` to run the mock, which returns two registered
  properties for kennitala `2409693949`, both on landeignarnumer `163368` —
  the app builds the unique landeignarnumer list (`[163368]`) exactly as it
  would with the real service. The real client's wire contract is pinned by
  fixture tests against the OpenAPI spec (`frontend/Fasteignir-Xroad.json`).
* **The windbreak registry and the applications store are real by
  default** (`src/windbreaks/`). The registry reads `skograekt.skjolbelti`
  from PostGIS (geometry in ISN93, transformed to WGS84); the applications
  store reads/writes the `windbreak_applications` table (schema owned by
  the `frontend/db` migrations). `WINDBREAK_REGISTRY_MOCK=true` /
  `WINDBREAK_APPLICATIONS_MOCK=true` select the prototype mocks.
* **pygeoapi 0.21's PostgreSQL provider is read-only**, so submitted lines
  are written by the NestJS applications store directly; the OGC API serves
  the same rows read-only. In the file-backed mock mode the GeoJSON seed at
  `backend/data/windbreak_applications.json` is appended instead.
* **Validation runs twice**: in the browser (immediate feedback) and again
  in the NestJS server before storage. A line must be ≥ 10 m, lie entirely
  inside the farmer's registered parcels, and not cross or touch any other
  windbreak. Containment is checked by sampling line vertices and segment
  midpoints against the parcel union with `@turf/boolean-point-in-polygon`
  — `@turf/boolean-contains` cannot handle MultiPolygon containers (it
  throws), which disjoint parcels always produce.
* The backend stores everything in **plain GeoJSON files** (bind-mounted
  `backend/data/`). Delete rows from
  `backend/data/windbreak_applications.json` to reset submitted data.
* **pygeoapi 0.21.0 transaction patch**: the stock Flask adapter passes raw
  request bytes to `provider.create()`, which breaks GeoJSON transactions.
  `backend/windbreak_app.py` patches `APIRequest.from_flask` to decode JSON
  bodies and is used as the gunicorn `WSGI_APP`. (The response `Location`
  header of a successful POST is therefore not meaningful; the app generates
  and uses its own `line_id`s.)
* **CORS**: the official pygeoapi 0.21 image does not ship `flask-cors`, so
  the backend image installs it. With NestJS the browser only talks to its
  own origin, so CORS is no longer strictly needed — but it is kept enabled
  so the backend also works when called directly.
* **`WSGI_WORKERS=1`**: the GeoJSON provider does no write locking and
  documents a single-process assumption.
* The OpenStreetMap basemap needs internet access. The farm/parcel data
  itself comes from pygeoapi.
* Demo data: farmer `farmer-123` is **Guðmundur Jónsson** of Jörð 163368
  (Skaftárhreppur, Iceland). His land parcel (`IS-163368`, ~6,868 ha of
  rangeland) is the geometry of Icelandic land registry property 163368 from
  <https://landeignaskra.hms.is/api/landeign/163368>, converted from ISN93
  (EPSG:3057) to WGS84. A second demo farmer (Maria Sørensen, Denmark) is
  kept for exercising the `farmer_id` filtering.
