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
   256px Web-Mercator tile from the national basemap WMS (Náttúrustofa
   Íslands, ogc.gis.is), cached in memory. The browser therefore never
   talks to a third party - every map pixel comes from our own OGC API
   origin (attribution stays in the map). Tiles are rendered upstream as
   3x3 metatiles with a margin and sliced here, so place-name labels that
   straddle tile boundaries render whole instead of being clipped.
   Configure with WINDBREAK_BASEMAP_WMS / WINDBREAK_BASEMAP_LAYERS /
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

BASEMAP_WMS = os.environ.get(
    "WINDBREAK_BASEMAP_WMS", "https://ogc.gis.is/geoserver/ows"
)
BASEMAP_LAYERS = os.environ.get(
    "WINDBREAK_BASEMAP_LAYERS",
    "nytt_grunnkort_samsett_naer_fjaer,LMI_vektor:kort_ornefni_3857",
)
BASEMAP_MAX_ZOOM = int(os.environ.get("WINDBREAK_BASEMAP_MAX_ZOOM", "16"))
# Public upstreams can be slow on label-dense metatiles; give them room and
# one retry before falling back to a transparent tile.
BASEMAP_TIMEOUT = float(os.environ.get("WINDBREAK_BASEMAP_TIMEOUT", "30"))
BASEMAP_TILE_SIZE = 256
# Metatile rendering, mirroring GeoWebCache: the upstream renders a whole
# MTxMT-tile window in one request, so a place-name label anchored anywhere
# inside the window is drawn once and complete - text that crosses tile
# boundaries is never clipped. Each 256px tile is sliced out of the cached
# metatile image (WINDBREAK_BASEMAP_METATILE).
BASEMAP_METATILE = int(os.environ.get("WINDBREAK_BASEMAP_METATILE", "3"))
# Extra margin around the metatile window: labels anchored just outside the
# metatile edge still render there, keeping neighbouring metatiles seamless
# (WINDBREAK_BASEMAP_BUFFER).
BASEMAP_BUFFER = int(os.environ.get("WINDBREAK_BASEMAP_BUFFER", "128"))

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


@lru_cache(maxsize=48)
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


def _basemap_tile(z: int, x: int, y: int):
    """GET /tiles/basemap/{z}/{x}/{y}.png - one 256px basemap tile."""
    size = 1 << z
    if not (0 <= z <= BASEMAP_MAX_ZOOM and 0 <= x < size and 0 <= y < size):
        return (
            f"tile {z}/{x}/{y} out of range (0..{BASEMAP_MAX_ZOOM})",
            400,
            {"Cache-Control": "no-store"},
        )
    ox, oy, mt, dx, dy = _basemap_metatile(z, x, y)
    try:
        metatile = _fetch_basemap_metatile(z, ox, oy, mt)
        body = _slice_tile(metatile, mt, dx, dy)
    except Exception as exc:  # upstream errors and malformed renders alike
        # A missing basemap patch is better than a broken draw page: serve a
        # transparent tile (not cached) and let the next request retry.
        print(f"WARNING windbreak_app basemap {z}/{x}/{y}: {exc}", flush=True)
        return _blank_tile(), 200, {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
            "X-Basemap-Proxy": f"metatile-{mt}x{mt} buffer-{BASEMAP_BUFFER} error-fallback",
        }
    return body, 200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        # Lets operators confirm the deployed image runs the metatile proxy.
        "X-Basemap-Proxy": f"metatile-{mt}x{mt} buffer-{BASEMAP_BUFFER}",
    }


APP.add_url_rule(
    "/tiles/basemap/<int:z>/<int:x>/<int:y>.png",
    "windbreak_basemap_proxy",
    _basemap_tile,
    methods=["GET"],
)
