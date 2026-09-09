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
"""

import json
import os
import re
import tempfile
from urllib.parse import unquote, urlsplit

_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")


def _db_url_to_env():
    """Split WINDBREAK_DATABASE_URL into WINDBREAK_DB_* so the config
    placeholders resolve without duplicating credentials: the NestJS side
    uses the DSN form, the pygeoapi config uses per-part parameters."""
    dsn = os.environ.get("WINDBREAK_DATABASE_URL")
    if not dsn or os.environ.get("WINDBREAK_DB_HOST"):
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
