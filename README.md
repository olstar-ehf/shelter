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

* **Two hosts share one React UI** (`libs/`): the NestJS demo serves a
  minimal HTML shell + JSON and mounts the shared pages with an esbuild
  client, while the **Next.js host** (`web/`) server-renders the same
  pages (SSR + hydration; only the Leaflet map pane is client-only) and
  talks to the API over **GraphQL** (`/graphql`).
* The flow is an island.is-style **application template**
  (`@island.is/windbreak-application`: zod data schema, states, declarative
  form, custom map field) built on the reusable **`@island.is/map`** lib —
  the farmer draws the windbreak lines on a map of their own land.
* All external services are **real by default** with mock escape hatches:
  Fasteignir-Xroad (kennitala → landeignarnumer), the skógrækt windbreak
  registry and the applications read (PostGIS), and Zendesk. The grant
  authority's database is **read-only**, so submissions create a **Zendesk
  ticket with the drawn lines as a GeoJSON attachment** — nothing is
  written to PostGIS.
* The **basemap** is the national basemap (Náttúrustofa's `grunnkort` +
  `Ornefni`, the Örnefnasjá sources), assembled by our backend and exposed
  as a standard **OGC API - Tiles** tileset — the browser only ever talks
  to our own origins.
* All three services run in Docker via `docker-compose` (frontend :8000,
  web :8009, backend :5000).

## Quick start (development)

Run everything in Docker — **no database needed**: the demo runs fully on
mocks.

**1. Create the environment file** (`.env` is gitignored):

```bash
cp .env.example .env
```

**2. Select the mock clients** (each client is real by default; these
flags swap in the prototype mocks):

```env
FASTEIGNIR_MOCK=true
WINDBREAK_REGISTRY_MOCK=true
WINDBREAK_APPLICATIONS_MOCK=true
ZENDESK_MOCK=true
```

A real PostGIS can be pointed at with
`WINDBREAK_DATABASE_URL=postgres://USER:PASS@<POSTGIS-HOST>:5432/<DB>` —
see [DEVELOPMENT.md](DEVELOPMENT.md) for the real clients' requirements.

**3. Build and start:**

```bash
docker compose up --build
```

**4. Open the demo:**

* Frontend: <http://localhost:8000> (NestJS demo host)
* Next.js web app: <http://localhost:8009> (SSR React host, island.is-style)
* Backend (OGC API): <http://localhost:5000>

Then, in the UI:

1. Click **Apply for windbreak** (the prototype assumes the demo user —
   `DEMO_FULL_NAME` / `DEMO_KENNITALA`, default Hafliði Viðar Ólafsson /
   061050-4429 — is already signed in).
2. The server looks up the demo user's land (mocked Fasteignir-Xroad →
   landeignarnumer 139555, Garpsdalur) and loads the parcels and existing
   windbreaks; the draw page opens on that land.
3. Use the line tool (top right of the map) to draw one or more windbreaks
   inside the parcels. Lines outside the farmer's land, or crossing or
   touching an existing windbreak, are rejected and turn red on the map.
4. Review and submit — the server re-validates the lines and creates a
   **Zendesk ticket** with the drawn lines attached as GeoJSON (the grant
   authority's database is read-only). The confirmation page reads the
   ticket back.

> The real clients are the default: with `WINDBREAK_DATABASE_URL` set but
> unreachable, the registry fails fast with a clear message while the
> submitted-applications read degrades to "no pending lines" (best-effort).
> Without the mock flags you also need `FASTEIGNIR_TOKEN`, Zendesk
> credentials and so on — all documented in
> [DEVELOPMENT.md](DEVELOPMENT.md).

## More documentation

The deeper development notes live in [DEVELOPMENT.md](DEVELOPMENT.md):
production-style builds, running without Docker, the full environment
variable list, security headers, internationalisation, the OGC API
backend details, the repository layout and the test suites.

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
