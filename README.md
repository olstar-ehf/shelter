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
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Shared React UI (libs/, island.is-style)                                                 │
│   @island.is/application-ui-shell   pages (landing / apply / submitted)                  │
│   @island.is/windbreak-application  flow, zod schema, map field                          │
│   @island.is/map                    Leaflet map (client-only)                            │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ rendered by both hosts
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ web (Docker) — Next.js host (the island.is web stack)                                    │
│ SSR + hydration of the same shared pages; the draw step renders its                      │
│ static skeleton on the server, only the Leaflet pane mounts client-side                  │
│ http://localhost:8009                                                                    │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ HTTP: GraphQL /graphql (context,
                                             │ submit, ticket) for the web host
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ frontend (Docker) — NestJS demo host + JSON API                                          │
│ minimal HTML shell with page data as JSON (no template engine) +                         │
│ React client (esbuild); runs the lookups, schema check, submissions                      │
│ http://localhost:8000                                                                    │
└───────────────┬───────────────────────────────┬────────────────────────────┬─────────────┘
                │                               │                            │
                │ kennitala lookup              │ parcels + existing/pending │ POST /apply
                                                │ windbreaks (OGC API)
                ▼                               ▼                            ▼
 ┌──────────────────────────────┐ ┌────────────────────────────┐ ┌────────────────────────┐
 │ Fasteignir-Xroad             │ │ backend (Docker)           │ │ Zendesk Support        │
 │ api.fasteignaskra.is         │ │ pygeoapi 0.21              │ │ API (v2): ticket +     │
 │ real by default (Bearer      │ │ http://localhost:5000      │ │ drawn lines as a       │
 │ token); FASTEIGNIR_MOCK=true │ │ farm_parcels → GeoJSON     │ │ GeoJSON attachment     │
 │ kennitala → landeignarnumer  │ │ skjólbelti + applications  │ │ (DB read-only → no     │
 │                              │ │ → PostgreSQL (read-only)   │ │ PostGIS writes;        │
 │                              │ │                            │ │ ZENDESK_MOCK=true)     │
 └──────────────────────────────┘ └──────────────┬─────────────┘ └────────────────────────┘
                                                │
                                                ▼
                                 PostgreSQL (EPSG:3057 + 4326)
                                read at runtime; db/ migrations
                                      optional local dev only
```

* The **frontend** is a [NestJS](https://nestjs.com/) application written in
  TypeScript. **Every page is React**: the NestJS server returns only a
  minimal HTML shell with the page data embedded as JSON (no template
  engine), and `client/main.tsx` mounts the right React page (landing,
  apply, confirmation). The client renders the **application template**
  `@island.is/windbreak-application` (Phase 2), whose custom
  `windbreakLines` map field builds on the reusable `@island.is/map` lib
  (Phase 1); the template owns its zod `dataSchema`, states, declarative
  form and messages (`windbreak.*`). The server itself performs the
  lookups, the schema check and the application submissions.
* There is also a **Next.js host** (`web/`, the island.is web stack): the
  same shared pages (`libs/application/ui-shell`) are **server-rendered by
  React** (SSR + hydration) and route like island.is (`/`, `/apply`,
  `/submitted/[ticketId]`, `/api/apply`). It talks to the NestJS demo over
  **GraphQL** (`/graphql` — `windbreakApplicationContext`,
  `windbreakSubmittedApplication`, `submitWindbreakApplication`) - web/API
  separation like island.is; the JSON endpoints (`/api/context`,
  `/api/ticket`, `POST /apply`) stay for the no-framework demo host and
  curl access. The interactive map stays client-only (Leaflet cannot
  SSR): the draw step is split so the server renders the full static
  skeleton (step title, help texts, legend, empty lines table, disabled
  review button) and only the Leaflet map pane is lazy-loaded after
  hydration (`React.lazy` inside `WindbreakLinesField`; the skeleton is
  the Suspense fallback, so the page is never blank).
* The **Fasteignir-Xroad** property lookup (`src/fasteignir/`) uses the
  **real client by default** (X-Road gateway, island.is Bearer token via
  `FASTEIGNIR_TOKEN`). Failures surface as typed `PropertiesLookupError`
  codes mapped to localized messages; `FASTEIGNIR_MOCK=true` selects the
  mock. The mock returns, for kennitala `061050-4429` (the only demo user),
  one registered property on landeignarnumer `139555` (Garpsdalur).
* The **backend** is [pygeoapi](https://pygeoapi.io/) serving an
  [OGC API - Features](https://ogcapi.ogc.org/features/) interface: parcels
  come from GeoJSON files, and the `windbreak_applications` collection is
  served **from PostGIS** (pygeoapi's PostgreSQL provider is read-only, so
  the OGC API is the agency-facing read interface for submitted lines).
* **Basemap**: the map draws over the **national basemap** - the same
  sources the national Örnefnasjá viewer uses: pre-rendered `grunnkort`
  tiles from the Náttúrustofa MapCache tile service, composited with the
  `Ornefni` place-name layer rendered as seamless metatiles. The browser
  never talks to the national service: the backend assembles each 256px
  Web-Mercator tile (`WINDBREAK_BASEMAP_TILE_WMS` /
  `WINDBREAK_BASEMAP_TILE_LAYERS` / `WINDBREAK_BASEMAP_WMS` /
  `WINDBREAK_BASEMAP_LAYERS`, in-memory cached) and exposes it through the
  standard **OGC API - Tiles** surface - a `basemap` tileset at
  `GET /collections/basemap/tiles/WebMercatorQuad/{z}/{y}/{x}.png` with a
  WebMercatorQuad TileMatrixSet definition (`/tileMatrixSets/...`),
  conformance classes and OpenAPI paths (a plain `/tiles/basemap/...` route
  remains as an alias). The apply context hands the browser that standard
  URL. The frontend can override the tile URL and attribution
  (`WINDBREAK_BASEMAP_TILE_URL` / `WINDBREAK_BASEMAP_ATTRIBUTION`, e.g.
  plain OSM tiles for offline development). The production upgrade path
  for the same endpoint is an nginx `proxy_cache` in front of the backend
  (see README discussion).
* **Read-only database + Zendesk submissions**: the grant authority only
  has read access to the database, so submitted applications are NOT
  written to PostGIS. Submitting creates a **Zendesk ticket** (Support API
  v2) and uploads the drawn windbreak lines as a **GeoJSON attachment**
  (`src/zendesk/`): upload → `POST /api/v2/uploads.json`, then
  `POST /api/v2/tickets.json` with the upload token in the comment. The
  confirmation page shows the ticket number + agent link. Established
  windbreaks keep coming from the read-only skógrækt registry
  (`skograekt.skjolbelti`, EPSG:3057); pending lines come from the
  `windbreak_applications` table when it is readable and degrade to an
  empty list otherwise (missing table, denied access, or an unreachable
  database). The migrations in `frontend/db/migrations` remain
  for optional local development; the containers no longer run them.
* All three services run in Docker via `docker-compose` (frontend :8000,
  web :8009, backend :5000).

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
* Next.js web app: <http://localhost:8009> (SSR React host, island.is-style)
* Backend (OGC API): <http://localhost:5000>

> The real clients are the default: without `WINDBREAK_DATABASE_URL` in
> `.env`, the backend container previously fell back to a `localhost`
> PostgreSQL and failed to boot ("connection refused"); the entrypoint now
> boots without a database (the OpenAPI document is baked at build time,
> the PostgreSQL provider stays lazy) and logs a clear warning instead.
> The frontend still fails fast with a clear message when the registry is
> real but the database is unreachable; the submitted-applications read is
> best-effort and degrades to "no pending lines" with a warning instead.

Then, in the UI:

1. Click **Apply for windbreak** (the prototype assumes the demo user —
   `DEMO_FULL_NAME` / `DEMO_KENNITALA`, default Hafliði Viðar Ólafsson /
   061050-4429 — is already signed in).
2. The NestJS server asks Fasteignir-Xroad for the properties on the
   kennitala (mock when `FASTEIGNIR_MOCK=true`), builds the unique
   `landeignarnumer` list (139555, Garpsdalur), and loads those parcels and
   their existing windbreaks, rendering the draw page with the GeoJSON
   embedded in it.
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
FASTEIGNIR_MOCK=true WINDBREAK_REGISTRY_MOCK=true \
WINDBREAK_APPLICATIONS_MOCK=true ZENDESK_MOCK=true npm start
```

Troubleshooting: if a `file:` lib fails to resolve after `npm install`
(npm can create the scoped symlink one level too deep, e.g. "Cannot find
module '@island.is/map'"), the template lib fixes its own link
automatically: its `prebuild`/`pretypecheck`/`pretest` hooks run
`npm run fix:link` (`libs/application/templates/windbreak/scripts/
fix-lib-link.cjs`), which repoints `node_modules/@island.is/map` at
`libs/map`. The frontend's links can be recreated manually with
`ln -sfn ../../../libs/map frontend/node_modules/@island.is/map` and
`ln -sfn ../../../libs/application/templates/windbreak frontend/node_modules/@island.is/windbreak-application`,
and the client esbuild build aliases `@island.is/map` to the frontend's own
install as an extra guard. The Dockerfiles apply the same fixup via those
npm hooks.

* `PYGEOAPI_URL` — base URL of the pygeoapi backend as seen **from the
  NestJS server** (default `http://localhost:5000`; in Docker it is
  `http://backend:80`).
* `DEMO_FULL_NAME` / `DEMO_KENNITALA` — the only assumed facts about the
  user (default `Hafliði Viðar Ólafsson` / `061050-4429`).
* `FASTEIGNIR_MOCK` — **real by default**; `true` selects the mock
  Fasteignir-Xroad lookup. The real client needs `FASTEIGNIR_TOKEN` (an
  island.is Bearer JWT) and optionally `FASTEIGNIR_API_URL`.
* `WINDBREAK_REGISTRY_MOCK` — **real by default**; `true` selects the mock
  existing-windbreak registry. The real registry reads `skograekt.skjolbelti`
  from PostGIS. Note this flag only mocks the registry — the submitted-
  applications read below has its own flag.
* `WINDBREAK_APPLICATIONS_MOCK` — **real by default**; `true` selects the
  GeoJSON-file fallback for **reading** previously submitted (pending)
  applications. The real read store queries the `windbreak_applications`
  table and degrades to an empty list when the table is missing or not
  readable, or when the database is unreachable (connection refused,
  timeouts, server shutdown) — the deployed database is read-only and
  pending lines are best-effort. Submissions no longer write here — they
  go to Zendesk.
* `WINDBREAK_DATABASE_URL` — the PostGIS DSN (or the standard `PGHOST`,
  `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`). Used by the registry, the
  applications read store and the backend container, which splits it into
  the per-part connection variables the pygeoapi PostgreSQL provider config
  expands (`windbreak_app.py` also expands `${VAR}` placeholders in the
  pygeoapi config, so no credentials live in the committed YAML).
* `WINDBREAK_BASEMAP_TILE_WMS` / `WINDBREAK_BASEMAP_TILE_LAYERS` /
  `WINDBREAK_BASEMAP_WMS` / `WINDBREAK_BASEMAP_LAYERS` /
  `WINDBREAK_BASEMAP_MAX_ZOOM` / `WINDBREAK_BASEMAP_METATILE` /
  `WINDBREAK_BASEMAP_BUFFER` — the basemap tile proxy on the backend,
  assembled from the same sources the national Örnefnasjá viewer uses:
  pre-rendered `grunnkort` tiles from the MapCache tile service
  (`https://gis.natt.is/mapcache/web-mercator/wms`, seam-free by the
  national tile pipeline) composited with the `Ornefni` place-name layer
  from `https://gis.natt.is/geoserver/wms`, which the proxy renders as
  3×3 metatiles with a 512px margin so labels are never clipped at tile
  edges. Served tiles carry an `X-Basemap-Proxy` header naming the
  running configuration. Earlier iterations discovered the national
  composite `nytt_grunnkort_samsett_naer_fjaer` has its labels baked into
  pre-rendered rasters with seams at its own tile grid (single large
  renders and stitched per-tile renders are pixel-identical, so the seams
  are in the data) — that is why the composite is not the default.
* `WINDBREAK_BASEMAP_TILE_URL` / `WINDBREAK_BASEMAP_ATTRIBUTION` /
  `WINDBREAK_BASEMAP_MAX_ZOOM` — the basemap the apply context hands to the
  browser. Defaults to our own OGC API - Tiles tileset
  (`{PYGEOAPI_URL}/collections/basemap/tiles/WebMercatorQuad/{z}/{y}/{x}.png`,
  or the published `http://localhost:5000/...` in compose) with attribution
  `Kortagögn: Náttúrustofa Íslands`. Override with e.g. plain OSM tiles for
  fully-offline development.
* `ZENDESK_MOCK` — **real by default**; `true` selects the in-memory mock
  (tickets live for the server lifetime). The real client needs
  `ZENDESK_SUBDOMAIN` (e.g. `myagency` → `https://myagency.zendesk.com`),
  `ZENDESK_EMAIL` and `ZENDESK_API_TOKEN` (Support API basic auth). If the
  configuration is missing, the server fails fast with a clear message.
* `PORT` — server port (default `3000`; the compose files publish it as
  8000/8080).

## Security headers (island.is parity)

Both hosts send the same security headers island.is sends in production,
**enforced by default** — there is no opt-out flag, because the browser only
ever talks to our own origins (the e2e run asserts this with an origin
guard) and the policy is small enough to lock from day one:

* `Content-Security-Policy`: `default-src 'self'`; `script-src 'self'`
  (Next dev adds `'unsafe-eval'` for HMR automatically); `style-src 'self'
  'unsafe-inline'` (Leaflet/React inline styles — island.is does the same);
  `img-src 'self' data: blob:` + the basemap tile origin (derived from the
  context on the Nest host; `CSP_IMG_ORIGIN` on the Next host, baked into
  the production build, empty when the basemap is same-origin);
  `connect-src 'self'`; `object-src 'none'`; `frame-ancestors 'self'`; …
* A `Content-Security-Policy-Report-Only` copy with `report-uri` is added
  when `CSP_REPORT_URI` is configured — island.is reports violations to
  Datadog the same way; telemetry is optional, enforcement is not.
* `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `Permissions-Policy: interest-cohort=()`, and
  `Strict-Transport-Security` (browsers ignore it on plain-HTTP dev).

The e2e asserts the CSP header is present on every page (alongside the
origin guard), so both guarantees regress loudly.

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
* **Server side** (`src/i18n/`): `createTranslator(locale)` formats the
  server's own strings - the Fasteignir lookup summary and error messages
  (validation and integration failures are localized before they reach the
  client). The server imports the libs through the **React-free** entries
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
GET  /collections/farm_parcels/items?landeignarnumer=139555&f=json&limit=100
GET  /collections/windbreak_applications/items?parcel_id=IS-139555&f=json&limit=100
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

### PostGIS migrations (optional, local development)

The `windbreak_applications` schema is owned by SQL migrations in
`frontend/db/migrations` (one row per drawn line: `line_id` PK,
`application_id`, `kennitala`, `parcel_id`, `status`, `length_m`,
`submitted_at` and the WGS84 `geometry`). The runner (`frontend/db/migrate.cjs`,
`npm run db:migrate`) tracks applied files in `schema_migrations` and is
idempotent. The deployed database is **read-only** and submissions go to
Zendesk, so the containers no longer run the migrations; apply them only
for local development against a database you can write to.

**Database privileges (PostgreSQL 15+).** The public schema is no longer
writable by default, so the role in `WINDBREAK_DATABASE_URL` must own the
database or be granted rights once (as a superuser/database owner):

```sql
CREATE EXTENSION IF NOT EXISTS postgis;       -- if not installed already
GRANT CREATE, USAGE ON SCHEMA public TO <role>;  -- the role from the DSN
```

`db:migrate` explains this in its error output when it hits a permission
denial.

Note: `pygeoapi openapi generate` instantiates the providers, so generating
the OpenAPI document requires the database to be reachable. Generate it
against the GeoJSON variant instead (`backend/docgen-config.py`, which
swaps the PostgreSQL provider for the file provider in a config copy; it
also writes a placeholder applications GeoJSON next to the config, since
pygeoapi 0.21's GeoJSON provider crashes on an empty seed
FeatureCollection). The running server itself loads providers lazily.

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
* `pending` — submitted but **not accepted yet** (now logged as Zendesk
  tickets with a GeoJSON attachment instead of DB rows).

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
    main.ts                  # Nest bootstrap: static assets only (no view engine)
    app.module.ts
    app.controller.ts        # GET / , GET /apply, POST /apply, GET /submitted/:id
                             # renders the HTML shell + embedded page-data JSON
    app.service.ts           # kennitala -> landeignarnumer -> parcels -> windbreaks
                             # schema check (zod) + Zendesk ticket submission
    fasteignir/
      fasteignir.types.ts    # types mirroring the Fasteignir-Xroad OpenAPI spec
      fasteignir.service.ts  # abstract service + mock + real X-Road client (default)
                             # parseFasteignirResponse + typed PropertiesLookupError
      fasteignir.module.ts   # provider: real by default (FASTEIGNIR_MOCK=true escapes)
    windbreaks/
      windbreak-registry.service.ts  # skograekt.skjolbelti (PostGIS, ISN93->WGS84) + mock
      windbreak-applications.store.ts # pending apps read store: PostGIS (default) + GeoJSON mock
      windbreaks.module.ts   # providers: real by default (WINDBREAK_*_MOCK=true escapes)
    zendesk/
      zendesk.service.ts     # Zendesk Support API client (ticket + attachment) + mock
      windbreak-attachment.ts # GeoJSON attachment builder for the ticket
      zendesk.module.ts      # provider: real by default (ZENDESK_MOCK=true escapes)
    i18n/
      index.ts               # locale resolution + ICU translator; merges the map
                             # lib and template catalogs (map.*/windbreak.* etc.)
    messages/
      en.ts / is.ts          # app chrome/confirmation/error catalogs (island.is style)
  client/
    main.tsx                 # React bootstrap for every page: IntlProvider + page-data
    Shell.tsx                # topbar/footer/language switcher (shared chrome)
    IndexPage.tsx            # landing page (React)
    SubmittedPage.tsx        # confirmation page with the Zendesk ticket (React)
    Stepper.tsx              # the 4-step stepper for index/submitted
    WindbreakApplyPage.tsx   # apply page: template flow + submit via POST /apply
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
libs/application/ui-shell/       # shared React pages + chrome (both hosts import them)
  src/
    components/             # Shell, Stepper, IndexPage, SubmittedPage, ApplyPage
    messages/               # app chrome/confirmation/error catalogs (flat ids)
    index.ts / server.ts    # React entry + React-free server entry (messages)
web/                          # Next.js host (island.is web stack)
  pages/                      # / , /apply, /submitted/[ticketId], /api/apply
  lib/                        # locale resolution + NestJS API client
  Dockerfile                  # develop / build / serve (monorepo context)
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
  fixtures, applications store round-trips, Zendesk attachment builder +
  Support API transport contract with mocked fetch; the live PostGIS suite
  runs when `WINDBREAK_DATABASE_URL` is set); `npm run build` — `nest build`
  + esbuild client bundle.
* `frontend/e2e-draw-test.js` — headless-browser regression test covering
  the draw flow (inside/outside/crossing validation) and a full submission
  through the NestJS server to the Zendesk-ticket confirmation page.
  Requires a running stack and Playwright's chromium:

  ```bash
  cd frontend
  npm install --no-save playwright-core
  npx playwright-core install chromium-headless-shell
  # with backend (:5000) and the NestJS server (:8000) running (mocks incl.
  # ZENDESK_MOCK=true for the submission step):
  node e2e-draw-test.js
  ```

  Note: submissions create an in-memory Zendesk mock ticket
  (`ZENDESK_MOCK=true`) — no files or databases are written.

## How this demo compares to island.is

This prototype is built **the island.is way on purpose**: it speaks the same
language — TypeScript, React, OpenAPI, NestJS, react-intl, zod, X-Road,
Storybook/Jest, Docker, open source — so that it reads as a working preview
of the windbreak grant flow *as it would exist inside island.is*, not as a
foreign stack that would need rewriting.

**The parts that already exist, in island.is form:**

| island.is building block | Already in this demo |
| --- | --- |
| TypeScript end to end (apps, libs, tests) | Server, both libs, client, tests — all TypeScript |
| React + react-intl web apps | The pages are React apps rendering an application template through react-intl; the Next.js host server-renders them (static draw-step skeleton + client-only Leaflet pane) |
| Application templates: zod `dataSchema`, state machine, declarative form | `@island.is/windbreak-application`: the same three pieces, plus its own states (`draft → submitted`) |
| `libs/ui-fields` registry + custom field components | A fields registry whose custom `windbreakLines` field renders the map (`@island.is/map`) |
| Reusable `libs/` packages with stories + tests + clean entries | `libs/map` and the template lib: Storybook stories, Jest suites, React-free `/server` entries for the API |
| NestJS modules with typed, real-by-default clients | Fasteignir-Xroad (Bearer token, typed error codes), windbreaks (PostGIS registry), Zendesk — each with an explicit mock escape hatch |
| `libs/localization` namespaces merged into react-intl | `map.*`, `validation.*`, `drawLocal.*`, `windbreak.*` + app catalogs, ICU plurals, is/en parity tests, island.is-style locale resolution |
| OpenAPI contracts | The X-Road spec (`Fasteignir-Xroad.json`) is pinned by contract tests; the OGC API backend publishes OpenAPI 3 |
| GraphQL domain consumed by the web host | Code-first Nest GraphQL domain at `/graphql` (context query, ticket query, submit mutation) — the Next.js host runs entirely on it |
| X-Road integration | Property lookup through the X-Road gateway with an island.is Bearer JWT |
| Security headers (CSP + companions) | Enforced `Content-Security-Policy` plus `X-Content-Type-Options`, `Referrer-Policy` and HSTS on both hosts, mirroring island.is's production headers — with a report-only copy when a `CSP_REPORT_URI` is configured |
| National basemap behind an own OGC API - Tiles tileset | The backend exposes a standard **OGC API - Tiles** `basemap` tileset: `/collections/basemap/tiles` (tilesets), `/collections/basemap/tiles/WebMercatorQuad/{z}/{y}/{x}` (the 256px tiles), a WebMercatorQuad TileMatrixSet definition at `/tileMatrixSets/WebMercatorQuad`, the tiles conformance classes, and the OpenAPI paths — assembling each tile from Náttúrustofa's pre-rendered `grunnkort` tiles + the `Ornefni` place-name layer (seamless metatiles) so the browser only ever talks to our own origins. |
| Storybook + Jest + browser e2e | Both libs have stories; unit/contract/locale suites; Playwright regression over the whole draw → review → submit flow, asserting the enforced CSP and that the browser never contacts an outside origin |
| Docker, multi-stage monorepo builds | Backend + frontend + web images, dependency-ordered lib builds, clean build contexts |
| Open solution | Everything here is open — configuration via env, no black boxes |

**Where the demo deliberately stops** — each of these is a *host swap*, not
a rewrite: the components, schema, validation and copy carry over as-is.

* **Web shell**: the demo already ships a Next.js host (`web/`) that
  server-renders the same shared pages (SSR + hydration, island.is-style
  routing) — hosting them inside island.is's Next app is a move, not a
  rewrite. The NestJS demo remains as the JSON API + the no-framework
  host.
* **Authentication**: island.is uses IDS login and the nationalId from the
  session; here the portal session is assumed (name + kennitala) — the
  application itself never touches credentials.
* **API surface**: island.is exposes GraphQL domains; the demo now does
  too — a code-first Nest domain at `/graphql` (`windbreakApplicationContext`,
  `windbreakSubmittedApplication`, `submitWindbreakApplication`) that the
  Next.js host consumes. The JSON REST routes remain for the no-framework
  demo host and curl access; the module services are shaped like
  `libs/api/domains` already.
* **Submission action**: island.is would run this through a
  `template-api-module` action; the prototype performs it directly in the
  server and logs a Zendesk ticket with the GeoJSON attachment (the grant
  authority's database is read-only).
* **Workspaces**: island.is builds with Nx; here npm `file:` dependencies
  link the same `libs/` layout (with the documented scoped-link workaround).

In short: the parts that make the grant flow work — the map field, the zod
schema and state machine, the geometry validation, the localization, the
client modules and the regression suite — are **already island.is-shaped**.
Graduating into the monorepo is mostly a matter of hosting them in
island.is's shell, not rebuilding them.

## Prototype assumptions & limitations

* **Authentication is assumed to have happened** in the government portal,
  and the only facts assumed about the user are their **name and
  kennitala** (`DEMO_FULL_NAME` / `DEMO_KENNITALA`, default
  `Hafliði Viðar Ólafsson` / `061050-4429`). No `farmer_id` is assumed.
* **The Fasteignir-Xroad client is real by default** but needs an island.is
  Bearer token (`FASTEIGNIR_TOKEN`) that this prototype does not ship with;
  set `FASTEIGNIR_MOCK=true` to run the mock, which returns one registered
  property for kennitala `061050-4429` on landeignarnumer `139555`
  (Garpsdalur) — the app builds the unique landeignarnumer list (`[139555]`)
  exactly as it would with the real service. The real client's wire contract
  is pinned by fixture tests against the OpenAPI spec
  (`frontend/Fasteignir-Xroad.json`).
* **The windbreak registry and the applications read store are real by
  default** (`src/windbreaks/`). The registry reads `skograekt.skjolbelti`
  from PostGIS (geometry in ISN93, transformed to WGS84); the applications
  store reads the `windbreak_applications` table and degrades to an empty
  list when the table is missing, not readable, or the database is
  unreachable (pending lines are best-effort). Neither writes to the
  database: **submissions create a Zendesk ticket** (`src/zendesk/`) with
  the drawn lines attached as GeoJSON, and the confirmation page reads the
  ticket back. `WINDBREAK_REGISTRY_MOCK=true` /
  `WINDBREAK_APPLICATIONS_MOCK=true` / `ZENDESK_MOCK=true` select the
  prototype mocks.
* **pygeoapi 0.21's PostgreSQL provider is read-only**; the OGC API serves
  the `windbreak_applications` rows for agency/curl access when the table
  exists. In the file-backed mock mode the GeoJSON seed at
  `backend/data/windbreak_applications.json` is the pending-lines source —
  a read-only seed, since submissions go to Zendesk and are never written
  back into it.
* **Validation runs twice**: in the browser (immediate feedback) and again
  in the NestJS server before storage. A line must be ≥ 10 m, lie entirely
  inside the farmer's registered parcels, and not cross or touch any other
  windbreak. Containment is checked by sampling line vertices and segment
  midpoints against the parcel union with `@turf/boolean-point-in-polygon`
  — `@turf/boolean-contains` cannot handle MultiPolygon containers (it
  throws), which disjoint parcels always produce. Invalid lines also render
  red on the map, so good and bad lines are distinguishable at a glance.
* The backend's parcel/farmer layers come from **plain GeoJSON files**
  (bind-mounted `backend/data/`); submitted applications live in the
  Zendesk mock (in memory — restart the server to reset) and, in a real
  deployment, as Zendesk tickets with GeoJSON attachments.
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
* The basemap is the **national basemap** — Náttúrustofa Íslands'
  pre-rendered `grunnkort` tiles plus the `Ornefni` place-name layer (the
  same sources the Örnefnasjá viewer uses) — assembled by our own backend
  and exposed as a standard OGC API - Tiles tileset
  (`/collections/basemap/tiles/WebMercatorQuad/{z}/{y}/{x}.png`), so the
  **backend** needs internet access to `gis.natt.is` while the browser
  only ever talks to our own origins. OpenStreetMap tiles remain only as
  the client-side fallback when the server sends no basemap
  configuration.
* Demo data: the only demo user is farmer `farmer-007`, **Hafliði Viðar
  Ólafsson** of Garpsdalur (Reykhólahreppur, kennitala `061050-4429`). His
  land (`IS-139555`, ~2,990 ha, landeignarnumer 139555) is the geometry of
  Icelandic land registry property 139555, converted from ISN93 (EPSG:3057)
  to WGS84 (source WKT kept in `backend/data/wkt_geom_farmer-007.txt`).
