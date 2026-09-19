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

3. A basemap tile proxy: GET /tiles/basemap/{z}/{x}/{y}.png renders one
   256px Web-Mercator tile from the national basemap WMS (Náttúrustofa
   Íslands, ogc.gis.is) and caches it in memory. The browser therefore
   never talks to a third party - every map pixel comes from our own OGC
   API origin (attribution stays in the map). Tiles are rendered upstream
   with a gutter (WINDBREAK_BASEMAP_BUFFER pixels) and cropped back to
   256px, so place-name labels that straddle a tile edge are drawn whole
   instead of being clipped at the boundary. Configure with
   WINDBREAK_BASEMAP_WMS / WINDBREAK_BASEMAP_LAYERS /
   WINDBREAK_BASEMAP_MAX_ZOOM / WINDBREAK_BASEMAP_BUFFER.
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

BASEMAP_WMS = os.environ.get(
    "WINDBREAK_BASEMAP_WMS", "https://ogc.gis.is/geoserver/ows"
)
BASEMAP_LAYERS = os.environ.get(
    "WINDBREAK_BASEMAP_LAYERS",
    "nytt_grunnkort_samsett_naer_fjaer,LMI_vektor:kort_ornefni_3857",
)
BASEMAP_MAX_ZOOM = int(os.environ.get("WINDBREAK_BASEMAP_MAX_ZOOM", "16"))
BASEMAP_TIMEOUT = float(os.environ.get("WINDBREAK_BASEMAP_TIMEOUT", "10"))
BASEMAP_TILE_SIZE = 256
# Gutter around each tile so labels are not clipped at tile edges (the
# upstream renders with this many extra pixels on every side; we crop the
# centre back to 256px). GeoServer draws text that straddles the bbox
# boundary in the gutter region, which is exactly how its GeoWebCache
# renders seamless label tiles.
BASEMAP_BUFFER = int(os.environ.get("WINDBREAK_BASEMAP_BUFFER", "64"))

# One pooled session for the upstream WMS; the lru_cache keeps hot tiles in
# memory (~512 x 40KB) so a zoom/pan never hits the upstream twice.
_session = requests.Session()
_adapter = requests.adapters.HTTPAdapter(pool_connections=4, pool_maxsize=8)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)


def _basemap_bbox(z: int, x: int, y: int):
    """WGS84 bbox of a Web-Mercator slippy tile (minx, miny, maxx, maxy)."""
    n = 2.0 ** z
    lon0 = x / n * 360.0 - 180.0
    lon1 = (x + 1) / n * 360.0 - 180.0
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat0 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return lon0, lat0, lon1, lat1


def _basemap_params(z: int, x: int, y: int) -> dict:
    bbox = _basemap_bbox(z, x, y)
    size = BASEMAP_TILE_SIZE + 2 * BASEMAP_BUFFER
    dx = (bbox[2] - bbox[0]) * BASEMAP_BUFFER / BASEMAP_TILE_SIZE
    dy = (bbox[3] - bbox[1]) * BASEMAP_BUFFER / BASEMAP_TILE_SIZE
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


@lru_cache(maxsize=512)
def _fetch_basemap_tile(z: int, x: int, y: int) -> bytes:
    resp = _session.get(
        BASEMAP_WMS, params=_basemap_params(z, x, y), timeout=BASEMAP_TIMEOUT
    )
    resp.raise_for_status()
    if BASEMAP_BUFFER <= 0:
        return resp.content
    # Crop the centre tile out of the buffered render.
    with Image.open(BytesIO(resp.content)) as img:
        cropped = img.crop(
            (
                BASEMAP_BUFFER,
                BASEMAP_BUFFER,
                BASEMAP_BUFFER + BASEMAP_TILE_SIZE,
                BASEMAP_BUFFER + BASEMAP_TILE_SIZE,
            )
        )
        out = BytesIO()
        cropped.save(out, format="PNG")
        return out.getvalue()


def _basemap_tile(z: int, x: int, y: int):
    """GET /tiles/basemap/{z}/{x}/{y}.png - one 256px basemap tile."""
    size = 1 << z
    if not (0 <= z <= BASEMAP_MAX_ZOOM and 0 <= x < size and 0 <= y < size):
        return (
            f"tile {z}/{x}/{y} out of range (0..{BASEMAP_MAX_ZOOM})",
            400,
            {"Cache-Control": "no-store"},
        )
    try:
        body = _fetch_basemap_tile(z, x, y)
    except requests.RequestException as exc:
        return (
            f"basemap upstream error: {exc}",
            502,
            {"Cache-Control": "no-store"},
        )
    return body, 200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
    }


APP.add_url_rule(
    "/tiles/basemap/<int:z>/<int:x>/<int:y>.png",
    "windbreak_basemap_proxy",
    _basemap_tile,
    methods=["GET"],
)
