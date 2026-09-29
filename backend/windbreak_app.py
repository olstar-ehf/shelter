"""
Windbreak backend - WSGI entry point.

This module wraps the stock pygeoapi Flask app with two small fixes:

1. Environment expansion in the pygeoapi config: the PostgreSQL provider
   takes its connection parameters from the config file, so ${VAR}
   placeholders (with optional :-defaults, e.g. ${WINDBREAK_DB_HOST:-localhost})
   are expanded from the environment before pygeoapi reads the config.
   Credentials therefore never live in the committed config file.

2. The pygeoapi 0.21.0 Flask adapter (`APIRequest.from_flask`) passes the raw
   request body (bytes) to `provider.create()` for OGC API Features
   transactions, while the GeoJSON provider expects a parsed feature dict.
   The patch below decodes JSON bodies before pygeoapi handles them.
   (Transactions are only used by the file-backed mock fallback; the
   PostgreSQL provider is read-only and submissions go through the NestJS
   applications store instead.)

Used as the gunicorn WSGI_APP in the backend Docker image, e.g.
    WSGI_APP=windbreak_app:APP

3. A basemap tile proxy: GET /tiles/basemap/{z}/{x}/{y}.png serves one
   256px Web-Mercator tile assembled from the national basemap (the same
   sources the Örnefnasjá viewer uses: `grunnkort` tiles from the MapCache
   tile service + the `Ornefni` place-name layer rendered as 3x3 metatiles
   with a margin so labels are never clipped at tile edges). The browser
   therefore never talks to a third party - every map pixel comes from our
   own OGC API origin (attribution stays in the map). Configure with
   WINDBREAK_BASEMAP_TILE_WMS / WINDBREAK_BASEMAP_TILE_LAYERS /
   WINDBREAK_BASEMAP_WMS / WINDBREAK_BASEMAP_LAYERS /
   WINDBREAK_BASEMAP_MAX_ZOOM / WINDBREAK_BASEMAP_METATILE /
   WINDBREAK_BASEMAP_BUFFER.
"""

import json
import math
import os
import re
import tempfile
from functools import lru_cache
from io import BytesIO
from urllib.parse import unquote, urlsplit

import requests
from PIL import Image

_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")


def _db_url_to_env():
    """Split WINDBREAK_DATABASE_URL into WINDBREAK_DB_* so the config
    placeholders resolve without duplicating credentials: the NestJS side
    uses the DSN form, the pygeoapi config uses per-part parameters."""
    dsn = os.environ.get("WINDBREAK_DATABASE_URL")
    if not dsn or os.environ.get("WINDBREAK_DB_HOST"):
        if not dsn and not any(
            os.environ.get(k)
            for k in ("WINDBREAK_DB_HOST", "WINDBREAK_DB_NAME", "PGHOST")
        ):
            print(
                "WARNING windbreak_app: WINDBREAK_DATABASE_URL is not set; "
                "windbreak_applications will try the config defaults "
                "(localhost). Set WINDBREAK_DATABASE_URL in .env (e.g. "
                "postgres://USER:PASS@HOST:5432/DB) to serve applications "
                "from PostGIS.",
                flush=True,
            )
        return
    parts = urlsplit(dsn)
    os.environ.setdefault("WINDBREAK_DB_HOST", parts.hostname or "")
    os.environ.setdefault("WINDBREAK_DB_PORT", str(parts.port or 5432))
    os.environ.setdefault("WINDBREAK_DB_USER", unquote(parts.username or ""))
    os.environ.setdefault("WINDBREAK_DB_PASSWORD", unquote(parts.password or ""))
    os.environ.setdefault(
        "WINDBREAK_DB_NAME", (parts.path or "/sde").lstrip("/")
    )


_db_url_to_env()


def _expand_env(value: str) -> str:
    def replace(match: re.Match) -> str:
        name, default = match.group(1), match.group(2)
        return os.environ.get(name, default if default is not None else "")

    return _ENV_PATTERN.sub(replace, value)


def _expand_config_env():
    """Expand ${VAR} placeholders in PYGEOAPI_CONFIG into a temp file."""
    path = os.environ.get("PYGEOAPI_CONFIG")
    if not path:
        return
    try:
        with open(path, "r", encoding="utf-8") as fh:
            original = fh.read()
    except OSError:
        return
    rendered = _expand_env(original)
    # Write whenever anything changed: pygeoapi reads the config file, so a
    # file that still contains ${...} placeholders would pass them through
    # as literal provider parameters.
    if rendered == original:
        return
    with tempfile.NamedTemporaryFile(
        "w", suffix=".config.yml", delete=False, encoding="utf-8"
    ) as fh:
        fh.write(rendered)
        os.environ["PYGEOAPI_CONFIG"] = fh.name


_expand_config_env()

from pygeoapi.api import APIRequest  # noqa: E402


@classmethod
def from_flask(cls, request, supported_locales):
    """APIRequest.from_flask, with JSON request bodies decoded."""
    api_request = cls(request, supported_locales)
    data = request.data
    if data:
        try:
            api_request._data = json.loads(data)
        except (ValueError, TypeError):
            # Not JSON (e.g. binary upload): keep the raw bytes.
            api_request._data = data
    return api_request


APIRequest.from_flask = from_flask

# Import only after patching, so the Flask app and its blueprints use it.
from pygeoapi.flask_app import APP  # noqa: E402,F401

# ---- Basemap tile proxy ------------------------------------------------------
# The national basemap (Náttúrustofa Íslands / former Landmælingar Íslands)
# is served from ogc.gis.is. The app maps through this OGC API service so
# the browser only ever contacts our own origin.

# Basemap source, matching the national Örnefnasjá viewer
# (https://ornefnasja.gis.is): the pre-rendered `grunnkort` tiles come from
# the MapCache tile service (which renders them seam-free with its own
# meta-tiling), and the `Ornefni` place-name layer is rendered per request
# by the GeoServer WMS - the metatile window below draws it complete, so
# labels are never clipped at tile boundaries.
BASEMAP_TILE_WMS = os.environ.get(
    "WINDBREAK_BASEMAP_TILE_WMS", "https://gis.natt.is/mapcache/web-mercator/wms"
)
BASEMAP_TILE_LAYERS = os.environ.get("WINDBREAK_BASEMAP_TILE_LAYERS", "grunnkort")
BASEMAP_WMS = os.environ.get(
    "WINDBREAK_BASEMAP_WMS", "https://gis.natt.is/geoserver/wms"
)
BASEMAP_LAYERS = os.environ.get("WINDBREAK_BASEMAP_LAYERS", "Ornefni")
BASEMAP_MAX_ZOOM = int(os.environ.get("WINDBREAK_BASEMAP_MAX_ZOOM", "16"))
# Public upstreams can be slow on label-dense metatiles; give them room and
# one retry before falling back to a transparent tile.
BASEMAP_TIMEOUT = float(os.environ.get("WINDBREAK_BASEMAP_TIMEOUT", "60"))
BASEMAP_TILE_SIZE = 256
# Metatile rendering of the label layer, mirroring GeoWebCache: the upstream
# renders a whole MTxMT-tile window in one request, so a place-name label
# anchored anywhere inside the window is drawn once and complete - text that
# crosses tile boundaries is never clipped. Each 256px slice is composited
# over the cached base tile (WINDBREAK_BASEMAP_METATILE).
BASEMAP_METATILE = int(os.environ.get("WINDBREAK_BASEMAP_METATILE", "3"))
# Extra margin around the metatile window: labels anchored just outside the
# metatile edge still render there, keeping neighbouring metatiles seamless
# (WINDBREAK_BASEMAP_BUFFER). 512px covers labels up to ~1024px wide.
BASEMAP_BUFFER = int(os.environ.get("WINDBREAK_BASEMAP_BUFFER", "512"))

# One pooled session for the upstream WMS (one retry on transient server
# errors); the lru_cache keeps hot metatiles in memory (~48 x 1280px PNG)
# so a zoom/pan never hits the upstream twice.
_session = requests.Session()
_adapter = requests.adapters.HTTPAdapter(
    pool_connections=4, pool_maxsize=8, max_retries=requests.adapters.Retry(
        total=1,
        status_forcelist=[500, 502, 503, 504],
        backoff_factor=0.5,
        allowed_methods=["GET"],
    )
)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)


def _tile_lon(z: int, tx: float) -> float:
    return tx / (1 << z) * 360.0 - 180.0


def _tile_lat(z: int, ty: float) -> float:
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / (1 << z)))))


def _basemap_metatile(z: int, x: int, y: int):
    """The metatile window containing tile (z,x,y) and its offset in it."""
    n = 1 << z
    mt = min(BASEMAP_METATILE, n)
    ox = min((x // mt) * mt, n - mt)
    oy = min((y // mt) * mt, n - mt)
    return ox, oy, mt, x - ox, y - oy


def _basemap_params(z: int, ox: int, oy: int, mt: int) -> dict:
    """GetMap request for one metatile window (WGS84 bbox + margin)."""
    bbox = (
        _tile_lon(z, ox),
        _tile_lat(z, oy + mt),
        _tile_lon(z, ox + mt),
        _tile_lat(z, oy),
    )
    size = mt * BASEMAP_TILE_SIZE + 2 * BASEMAP_BUFFER
    dx = (bbox[2] - bbox[0]) * BASEMAP_BUFFER / (mt * BASEMAP_TILE_SIZE)
    dy = (bbox[3] - bbox[1]) * BASEMAP_BUFFER / (mt * BASEMAP_TILE_SIZE)
    return {
        "service": "WMS",
        "version": "1.1.1",
        "request": "GetMap",
        "layers": BASEMAP_LAYERS,
        "styles": "",
        "srs": "EPSG:4326",
        "bbox": ",".join(
            f"{v:.7f}" for v in (bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy)
        ),
        "width": size,
        "height": size,
        "format": "image/png",
        "transparent": "true",
        "tiled": "true",  # hint for the upstream GeoWebCache integration
    }


@lru_cache(maxsize=16)
def _fetch_basemap_metatile(z: int, ox: int, oy: int, mt: int) -> bytes:
    resp = _session.get(
        BASEMAP_WMS, params=_basemap_params(z, ox, oy, mt), timeout=BASEMAP_TIMEOUT
    )
    resp.raise_for_status()
    return resp.content


def _slice_tile(metatile: bytes, mt: int, dx: int, dy: int) -> bytes:
    left = BASEMAP_BUFFER + dx * BASEMAP_TILE_SIZE
    top = BASEMAP_BUFFER + dy * BASEMAP_TILE_SIZE
    with Image.open(BytesIO(metatile)) as img:
        tile = img.crop(
            (left, top, left + BASEMAP_TILE_SIZE, top + BASEMAP_TILE_SIZE)
        )
        out = BytesIO()
        tile.save(out, format="PNG")
        return out.getvalue()


@lru_cache(maxsize=1)
def _blank_tile() -> bytes:
    """One transparent 256px PNG served while the upstream is unreachable."""
    out = BytesIO()
    Image.new("RGBA", (BASEMAP_TILE_SIZE, BASEMAP_TILE_SIZE), (0, 0, 0, 0)).save(
        out, format="PNG"
    )
    return out.getvalue()


@lru_cache(maxsize=512)
def _fetch_basemap_base(z: int, x: int, y: int) -> bytes:
    """One 256px base tile from the MapCache tile service (grunnkort)."""
    n = 1 << z
    res = 2 * math.pi * 6378137.0 / (BASEMAP_TILE_SIZE * n)
    x0 = -math.pi * 6378137.0 + x * BASEMAP_TILE_SIZE * res
    y0 = math.pi * 6378137.0 - (y + 1) * BASEMAP_TILE_SIZE * res
    params = {
        "REQUEST": "GetMap",
        "SERVICE": "WMS",
        "VERSION": "1.3.0",
        "FORMAT": "image/png",
        "STYLES": "",
        "TRANSPARENT": "TRUE",
        "LAYERS": BASEMAP_TILE_LAYERS,
        "TILED": "true",
        "WIDTH": BASEMAP_TILE_SIZE,
        "HEIGHT": BASEMAP_TILE_SIZE,
        "CRS": "EPSG:3857",
        "BBOX": ",".join(
            (f"{x0:.6f}", f"{y0:.6f}", f"{x0 + 256 * res:.6f}", f"{y0 + 256 * res:.6f}")
        ),
    }
    resp = _session.get(
        BASEMAP_TILE_WMS, params=params, timeout=BASEMAP_TIMEOUT
    )
    resp.raise_for_status()
    return resp.content


def _basemap_tile(z: int, x: int, y: int):
    """GET /tiles/basemap/{z}/{x}/{y}.png - one 256px basemap tile."""
    size = 1 << z
    if not (0 <= z <= BASEMAP_MAX_ZOOM and 0 <= x < size and 0 <= y < size):
        return (
            f"tile {z}/{x}/{y} out of range (0..{BASEMAP_MAX_ZOOM})",
            400,
            {"Cache-Control": "no-store"},
        )
    header = (
        f"grunnkort-tiles + metatile-{BASEMAP_METATILE}x{BASEMAP_METATILE} "
        f"buffer-{BASEMAP_BUFFER} labels-{BASEMAP_LAYERS}"
    )
    try:
        base = _fetch_basemap_base(z, x, y)
    except Exception as exc:  # upstream errors and malformed renders alike
        # A missing basemap patch is better than a broken draw page: serve a
        # transparent tile (not cached) and let the next request retry.
        print(f"WARNING windbreak_app basemap base {z}/{x}/{y}: {exc}", flush=True)
        return _blank_tile(), 200, {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
            "X-Basemap-Proxy": f"{header} error-fallback",
        }
    try:
        ox, oy, mt, dx, dy = _basemap_metatile(z, x, y)
        metatile = _fetch_basemap_metatile(z, ox, oy, mt)
        labels = _slice_tile(metatile, mt, dx, dy)
        with Image.open(BytesIO(base)) as bimg, Image.open(BytesIO(labels)) as limg:
            composed = Image.alpha_composite(
                bimg.convert("RGBA"), limg.convert("RGBA")
            )
            out = BytesIO()
            composed.save(out, format="PNG")
            body = out.getvalue()
    except Exception as exc:
        # Labels are best-effort: if the label layer fails, serve the base
        # tile alone instead of breaking the whole patch.
        print(f"WARNING windbreak_app basemap labels {z}/{x}/{y}: {exc}", flush=True)
        body = base
    return body, 200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        # Lets operators confirm the deployed image runs the tile proxy.
        "X-Basemap-Proxy": header,
    }


APP.add_url_rule(
    "/tiles/basemap/<int:z>/<int:x>/<int:y>.png",
    "windbreak_basemap_proxy",
    _basemap_tile,
    methods=["GET"],
)

# ---- OGC API - Tiles (standard-conformant basemap) --------------------------
# The same assembled tiles are exposed through the OGC API - Tiles building
# block (OGC 20-057): a `basemap` tileset under /collections, a
# WebMercatorQuad TileMatrixSet definition, and the tiles themselves at the
# standard {tileMatrix}/{tileRow}/{tileCol} path. The conformance classes
# and the OpenAPI paths are registered below so the standard surface is
# discoverable end to end. The plain /tiles/basemap/... route above remains
# as a backward-compatible alias.
from flask import jsonify, request  # noqa: E402

TILE_MATRIX_SET_ID = "WebMercatorQuad"
TILESET_COLLECTION = "basemap"
# Well-known WebMercatorQuad constants (OGC 2DTMS / GoogleMapsCompatible).
_WM_ORIGIN = -20037508.342789244
_WM_SCALE_DENOMINATOR = 559082264.0287178
_WM_CELL_SIZE = 156543.03392804097

TILES_CONFORMANCE = [
    "http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/core",
    "http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/tileset",
    "http://www.opengis.net/spec/2dtms/1.0/conf/core",
]


def _tiles_url(path: str = "") -> str:
    """Absolute URL of the tiles surface on this server."""
    return f"{request.url_root.rstrip('/')}{path}"


def _tile_matrices() -> list:
    matrices = []
    for z in range(0, BASEMAP_MAX_ZOOM + 1):
        matrices.append(
            {
                "id": str(z),
                "scaleDenominator": _WM_SCALE_DENOMINATOR / (2 ** z),
                "cellSize": _WM_CELL_SIZE / (2 ** z),
                "cornerOfOrigin": "topLeft",
                "pointOfOrigin": [_WM_ORIGIN, -_WM_ORIGIN],
                "tileWidth": BASEMAP_TILE_SIZE,
                "tileHeight": BASEMAP_TILE_SIZE,
                "matrixWidth": 2 ** z,
                "matrixHeight": 2 ** z,
            }
        )
    return matrices


def _tileset_list():
    """GET /collections/basemap/tiles - the available tilesets."""
    tileset_url = _tiles_url(f"/collections/{TILESET_COLLECTION}/tiles/{TILE_MATRIX_SET_ID}")
    tms_url = _tiles_url(f"/tileMatrixSets/{TILE_MATRIX_SET_ID}")
    return jsonify(
        {
            "links": [
                {
                    "rel": "self",
                    "type": "application/json",
                    "title": "Tilesets of the windbreak basemap",
                    "href": _tiles_url(f"/collections/{TILESET_COLLECTION}/tiles"),
                }
            ],
            "tilesets": [
                {
                    "title": "Windbreak basemap",
                    "dataType": "map",
                    "crs": "http://www.opengis.net/def/crs/EPSG/0/3857",
                    "tileMatrixSetURI": (
                        "http://www.opengis.net/def/tilematrixset/OGC/1.0/"
                        f"{TILE_MATRIX_SET_ID}"
                    ),
                    "links": [
                        {
                            "rel": "self",
                            "type": "application/json",
                            "href": tileset_url,
                        },
                        {
                            "rel": "http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme",
                            "type": "application/json",
                            "href": tms_url,
                        },
                    ],
                }
            ],
        }
    )


def _tileset_metadata():
    """GET /collections/basemap/tiles/WebMercatorQuad - tileset metadata."""
    return jsonify(
        {
            "title": "Windbreak basemap",
            "description": (
                "The national basemap assembled by the windbreak backend: "
                "Náttúrustofa grunnkort tiles composited with the Ornefni "
                "place-name layer, rendered as seamless metatiles."
            ),
            "crs": "http://www.opengis.net/def/crs/EPSG/0/3857",
            "tileMatrixSetURI": (
                "http://www.opengis.net/def/tilematrixset/OGC/1.0/"
                f"{TILE_MATRIX_SET_ID}"
            ),
            "itemType": "image/png",
            "links": [
                {
                    "rel": "self",
                    "type": "application/json",
                    "title": "This document",
                    "href": _tiles_url(
                        f"/collections/{TILESET_COLLECTION}/tiles/{TILE_MATRIX_SET_ID}"
                    ),
                },
                {
                    "rel": "http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme",
                    "type": "application/json",
                    "title": "TileMatrixSet definition",
                    "href": _tiles_url(f"/tileMatrixSets/{TILE_MATRIX_SET_ID}"),
                },
                {
                    "rel": "item",
                    "type": "image/png",
                    "templated": True,
                    "title": "Windbreak basemap tiles",
                    "href": _tiles_url(
                        f"/collections/{TILESET_COLLECTION}/tiles/{TILE_MATRIX_SET_ID}"
                        "/{tileMatrix}/{tileRow}/{tileCol}?f=png"
                    ),
                },
            ],
        }
    )


def _tile_matrix_set_definition():
    """GET /tileMatrixSets/WebMercatorQuad - the OGC 2DTMS definition."""
    return jsonify(
        {
            "title": TILE_MATRIX_SET_ID,
            "id": TILE_MATRIX_SET_ID,
            "uri": (
                "http://www.opengis.net/def/tilematrixset/OGC/1.0/"
                f"{TILE_MATRIX_SET_ID}"
            ),
            "crs": "http://www.opengis.net/def/crs/EPSG/0/3857",
            "orderedAxes": ["X", "Y"],
            "wellKnownScaleSet": (
                "http://www.opengis.net/def/wkss/OGC/1.0/GoogleMapsCompatible"
            ),
            "tileMatrices": _tile_matrices(),
        }
    )


def _ogc_tiles_tile(tileMatrix: int, tileRow: int, tileCol: int):
    """GET /collections/basemap/tiles/WebMercatorQuad/{z}/{y}/{x} - the tile."""
    # OGC API - Tiles order is tileMatrix/tileRow/tileCol = z/y/x; the
    # assembler speaks z/x/y (slippy order), so map the arguments over.
    return _basemap_tile(tileMatrix, tileCol, tileRow)


APP.add_url_rule(
    f"/collections/{TILESET_COLLECTION}/tiles",
    "windbreak_tilesets",
    _tileset_list,
    methods=["GET"],
)
APP.add_url_rule(
    f"/collections/{TILESET_COLLECTION}/tiles/{TILE_MATRIX_SET_ID}",
    "windbreak_tileset_metadata",
    _tileset_metadata,
    methods=["GET"],
)
APP.add_url_rule(
    f"/collections/{TILESET_COLLECTION}/tiles/{TILE_MATRIX_SET_ID}/<int:tileMatrix>/<int:tileRow>/<int:tileCol>",
    "windbreak_tileset_tile",
    _ogc_tiles_tile,
    methods=["GET"],
)
APP.add_url_rule(
    f"/collections/{TILESET_COLLECTION}/tiles/{TILE_MATRIX_SET_ID}/<int:tileMatrix>/<int:tileRow>/<int:tileCol>.png",
    "windbreak_tileset_tile_png",
    _ogc_tiles_tile,
    methods=["GET"],
)
APP.add_url_rule(
    f"/tileMatrixSets/{TILE_MATRIX_SET_ID}",
    "windbreak_tilematrixset",
    _tile_matrix_set_definition,
    methods=["GET"],
)

# ---- Register the tiles surface in conformance + OpenAPI --------------------
import pygeoapi.flask_app as _pygeoapi_flask  # noqa: E402

_orig_conformance = APP.view_functions["pygeoapi.conformance"]


def _conformance_with_tiles(*args, **kwargs):
    resp = _orig_conformance(*args, **kwargs)
    # pygeoapi replaces the response headers wholesale, which breaks
    # Flask's mimetype detection - parse the raw body instead of get_json().
    raw = resp.get_data()
    try:
        data = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return resp
    if isinstance(data, dict) and isinstance(data.get("conformsTo"), list):
        changed = False
        for uri in TILES_CONFORMANCE:
            if uri not in data["conformsTo"]:
                data["conformsTo"].append(uri)
                changed = True
        if changed:
            body = json.dumps(data).encode("utf-8")
            resp.set_data(body)
            resp.headers["Content-Length"] = str(len(body))
    return resp


APP.view_functions["pygeoapi.conformance"] = _conformance_with_tiles


def _register_openapi_paths():
    """Add the OGC API - Tiles paths to the served OpenAPI 3 document."""
    doc = getattr(_pygeoapi_flask, "OPENAPI", None)
    if not isinstance(doc, dict):
        return
    base = f"/collections/{TILESET_COLLECTION}/tiles"
    paths = {
        base: {
            "get": {
                "summary": "List the windbreak basemap tilesets",
                "operationId": "getWindbreakTilesets",
                "tags": ["tiles"],
                "responses": {
                    "200": {
                        "description": "The available tilesets",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
        f"{base}/{TILE_MATRIX_SET_ID}": {
            "get": {
                "summary": "Windbreak basemap tileset metadata",
                "operationId": "getWindbreakTileset",
                "tags": ["tiles"],
                "responses": {
                    "200": {
                        "description": "Tileset metadata",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
        f"{base}/{TILE_MATRIX_SET_ID}/{{tileMatrix}}/{{tileRow}}/{{tileCol}}": {
            "get": {
                "summary": "One windbreak basemap tile",
                "operationId": "getWindbreakTile",
                "tags": ["tiles"],
                "parameters": [
                    {
                        "name": "tileMatrix",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer", "minimum": 0},
                    },
                    {
                        "name": "tileRow",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer", "minimum": 0},
                    },
                    {
                        "name": "tileCol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer", "minimum": 0},
                    },
                ],
                "responses": {
                    "200": {
                        "description": "A 256px PNG basemap tile",
                        "content": {
                            "image/png": {
                                "schema": {"type": "string", "format": "binary"}
                            }
                        },
                    },
                    "400": {"description": "Tile out of range"},
                },
            }
        },
        f"/tileMatrixSets/{TILE_MATRIX_SET_ID}": {
            "get": {
                "summary": "WebMercatorQuad TileMatrixSet definition",
                "operationId": "getWindbreakTileMatrixSet",
                "tags": ["tiles"],
                "responses": {
                    "200": {
                        "description": "The OGC 2DTMS definition",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
    }
    doc.setdefault("paths", {})
    for path, spec in paths.items():
        doc["paths"].setdefault(path, spec)


_register_openapi_paths()
