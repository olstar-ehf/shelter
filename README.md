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
│  server-rendered views   │  JSON  │  farm_parcels /              │
│  + Leaflet draw client   │        │  windbreak_applications      │
│  http://localhost:8000   │        │  http://localhost:5000       │
└──────────┬───────────────┘        └──────────────────────────────┘
           │ Fasteignir-Xroad lookup (MOCKED)
           │ kennitala -> properties -> unique landeignarnumer
           ▼
     https://api.fasteignaskra.is/business/fasteignir-xroad
     (needs island.is Bearer token in production)
```

* The **frontend** is a [NestJS](https://nestjs.com/) application written in
  TypeScript. Pages are **server-rendered** with Handlebars (Nest MVC), and
  the Nest server performs the lookups and the application submissions
  itself. The interactive map is a Leaflet client bundle
  (`client/main.ts`, compiled with esbuild) that Nest serves as a static
  asset.
* The **Fasteignir-Xroad** property lookup (`src/fasteignir/`) is **mocked**
  in this prototype because the real service requires an island.is Bearer
  token. The mock returns, for kennitala `2409693949`, two registered
  properties that both sit on the same land — so the unique
  `landeignarnumer` list step yields `[163368]`.
* The **backend** is [pygeoapi](https://pygeoapi.io/) serving an
  [OGC API - Features](https://ogcapi.ogc.org/features/) interface. The map
  layers and the submitted applications all travel through OGC API requests.
* Both run in Docker via `docker-compose`.

## Quick start (development)

```bash
docker compose up --build
```

* Frontend: <http://localhost:8000> (NestJS dev server with watch mode)
* Backend (OGC API): <http://localhost:5000>

Then, in the UI:

1. Click **Apply for windbreak** (the prototype assumes the demo user —
   `DEMO_FULL_NAME` / `DEMO_KENNITALA`, default Guðmundur Jónsson /
   2409693949 — is already signed in).
2. The NestJS server asks (mocked) Fasteignir-Xroad for the properties on
   the kennitala, builds the unique `landeignarnumer` list (163368), and
   loads those parcels and their existing windbreaks, rendering the draw
   page with the GeoJSON embedded in it.
3. Use the line tool (top right of the map) to draw one or more windbreaks
   inside the parcels. Lines outside the farmer's land, or crossing an
   existing/pending windbreak, are rejected.
4. Review and submit — the lines are POSTed to the NestJS server, which
   re-validates them server side and stores each one (with the applicant's
   kennitala) in the backend with
   `POST /collections/windbreak_applications/items`. The confirmation page
   reads the lines back from the backend as proof of storage.

## Quick start (production-style build)

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

* Frontend: <http://localhost:8080> (the compiled NestJS server)
* Backend: <http://localhost:5000>

## Running without Docker (development)

Backend (requires Python 3.10–3.11):

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install pygeoapi==0.21.0 flask-cors gunicorn
# point a config copy at the local data dir and generate the OpenAPI doc
sed 's#/pygeoapi/data#<absolute path>/backend/data#g' backend/pygeoapi.config.yml > /tmp/local.config.yml
export PYGEOAPI_CONFIG=/tmp/local.config.yml
pygeoapi openapi generate $PYGEOAPI_CONFIG --output-file /tmp/local.openapi.yml
export PYGEOAPI_OPENAPI=/tmp/local.openapi.yml
cd backend
gunicorn --workers 1 --bind 127.0.0.1:5000 windbreak_app:APP
```

Frontend:

```bash
cd frontend
npm install
npm run build          # nest build + esbuild client bundle
PYGEOAPI_URL=http://localhost:5000 PORT=8000 npm start
# or, with watch mode:
npm run start:dev
```

* `PYGEOAPI_URL` — base URL of the pygeoapi backend as seen **from the
  NestJS server** (default `http://localhost:5000`; in Docker it is
  `http://backend:80`).
* `DEMO_FULL_NAME` / `DEMO_KENNITALA` — the only assumed facts about the
  user (default `Guðmundur Jónsson` / `2409693949`).
* `FASTEIGNIR_MOCK` — use the mocked Fasteignir-Xroad lookup (default
  `true`). Set to `false` plus `FASTEIGNIR_API_URL` (default
  `https://api.fasteignaskra.is`) and `FASTEIGNIR_TOKEN` (an island.is
  Bearer JWT) to call the real X-Road service.
* `WINDBREAK_REGISTRY_MOCK` — use the mocked existing-windbreak registry
  (default `true`). Set to `false` and configure the skógrækt PostGIS
  database with `WINDBREAK_DATABASE_URL` (or the standard `PGHOST`,
  `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`) to read real windbreaks
  from `skograekt.skjolbelti`.
* `PORT` — server port (default `3000`; the compose files publish it as
  8000/8080).

## Internationalisation (is + en)

The app follows the island.is pattern: one flat **message catalog per
locale** with **ICU MessageFormat** strings (`src/messages/en.ts`,
`src/messages/is.ts`), formatted by `intl-messageformat` (the engine
underneath react-intl, adapted to this NestJS + Handlebars + vanilla
TypeScript stack).

* The **locale** is resolved island.is-style: `?lang=is|en` query parameter
  → `lang` cookie → `Accept-Language` header → default Icelandic. The
  top-bar **Íslenska | English** switcher sets the cookie.
* **Server side** (`src/i18n/`): views receive the raw catalog (`{{t.key}}`)
  and pre-formatted ICU strings (lookup summary, plurals, validation
  errors); `createTranslator(locale)` formats everything else.
* **Client side**: the apply page embeds the chosen locale; the Leaflet
  client formats validation chips, popups and step titles with the same
  catalogs, and overrides leaflet-draw's own UI strings (`L.drawLocal`,
  including tooltips and edit menus).
* Shared validation messages are returned as **message ids** by
  `src/geometry.ts` and formatted per locale on both sides.
* Adding a locale = adding `src/messages/<locale>.ts` with the same keys,
  registering it in `src/i18n/index.ts`, and adding a switcher link.

## OGC API backend

Collections (all backed by GeoJSON files under `backend/data/`):

| Collection               | Geometry | Purpose                                        | Editable |
| ------------------------ | -------- | ---------------------------------------------- | -------- |
| `farmers`                | Point    | Farmer registry (name, farm, contact)          | no       |
| `farm_parcels`           | Polygon  | Registered land parcels per farmer             | no       |
| `windbreak_applications` | Line     | Windbreak lines (grant applications)           | **yes**  |

The NestJS server uses plain OGC API Features requests:

```text
GET  /collections/farm_parcels/items?landeignarnumer=163368&f=json&limit=100
GET  /collections/windbreak_applications/items?parcel_id=IS-163368&f=json&limit=100
POST /collections/windbreak_applications/items      (application/geo+json)
GET  /collections/windbreak_applications/items?application_id=WB-...&f=json
```

`landeignarnumer` and `parcel_id` are regular query parameters: pygeoapi
turns unknown query parameters into property filters on the GeoJSON
provider. The `farmers` collection is kept as a registry, but the
application flow no longer assumes a `farmer_id` — it joins through the
`landeignarnumer` list from the (mocked) Fasteignir-Xroad lookup.

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
`src/windbreaks/windbreak-registry.service.ts` (Postgres via `pg`, mocked by
default — see `WINDBREAK_REGISTRY_MOCK` above).

### Windbreak line attributes

Windbreak *applications* store: `line_id`, `application_id`, `kennitala`,
`parcel_id`, `status`, `length_m`, `submitted_at`. Statuses:

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
before storage, both using the same shared `src/geometry.ts` module
(`@turf/line-intersect` + `@turf/line-overlap`).

## Repository layout

```text
backend/
  Dockerfile                 # extends geopython/pygeoapi:0.21.0
  pygeoapi.config.yml        # pygeoapi configuration (CORS on, editable apps)
  windbreak_app.py           # WSGI entry point with transaction body patch
  data/                      # seed GeoJSON (farmers, parcels, applications)
frontend/
  Dockerfile                 # multi-stage: develop / build / serve (node)
  nest-cli.json
  tsconfig.json / tsconfig.build.json
  src/
    main.ts                  # Nest bootstrap: static assets + hbs views
    app.module.ts
    app.controller.ts        # GET / , GET /apply, POST /apply, GET /submitted/:id
    app.service.ts           # kennitala -> landeignarnumer -> parcels -> windbreaks
    fasteignir/
      fasteignir.types.ts    # types mirroring the Fasteignir-Xroad OpenAPI spec
      fasteignir.service.ts  # abstract service + mock + real X-Road client
      fasteignir.module.ts   # provider: mock by default (FASTEIGNIR_MOCK)
    windbreaks/
      windbreak-registry.service.ts  # skograekt.skjolbelti (PostGIS, ISN93->WGS84) + mock
      windbreaks.module.ts   # provider: mock by default (WINDBREAK_REGISTRY_MOCK)
    i18n/
      index.ts               # locale resolution (query/cookie/header) + ICU translator
      drawLocal.ts           # leaflet-draw UI strings per locale
    messages/
      en.ts / is.ts          # ICU MessageFormat catalogs (island.is style)
    geometry.ts              # shared turf.js validation (inside parcels, no crossings)
    types.ts                 # shared domain types
  views/
    index.hbs                # landing page (server-rendered)
    apply.hbs                # draw page with embedded parcels/windbreaks JSON
    submitted.hbs            # confirmation page (reads lines back)
  client/
    main.ts                  # Leaflet map + leaflet-draw + submit (esbuild bundle)
  public/
    styles.css / favicon.svg # static assets (app.js + app.css are built)
  e2e-draw-test.js           # headless-browser regression test
docker-compose.yml           # development stack
docker-compose.prod.yml      # production stack
```

## Testing

* `npm run typecheck` — TypeScript check (server + client).
* `npm run build` — `nest build` + esbuild client bundle.
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
  `backend/data/windbreak_applications.json`; reset that file afterwards.

## Prototype assumptions & limitations

* **Authentication is assumed to have happened** in the government portal,
  and the only facts assumed about the user are their **name and
  kennitala** (`DEMO_FULL_NAME` / `DEMO_KENNITALA`, default
  `Guðmundur Jónsson` / `2409693949`). No `farmer_id` is assumed.
* **Fasteignir-Xroad is mocked** (`src/fasteignir/fasteignir.service.ts`)
  because the real service requires an island.is Bearer token. The mock
  returns two registered properties for kennitala `2409693949`, both on
  landeignarnumer `163368` — the app builds the unique landeignarnumer list
  (`[163368]`) exactly as it would with the real service. Set
  `FASTEIGNIR_MOCK=false` + `FASTEIGNIR_TOKEN` to switch to the real
  X-Road endpoint.
* **The windbreak registry is mocked** unless a database is configured
  (`src/windbreaks/windbreak-registry.service.ts`). The real implementation
  reads `skograekt.skjolbelti` from PostGIS (geometry in ISN93, transformed
  to WGS84). Set `WINDBREAK_REGISTRY_MOCK=false` +
  `WINDBREAK_DATABASE_URL` (or the `PG*` variables) to use it.
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
