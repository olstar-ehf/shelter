"""
Windbreak backend - WSGI entry point.

This module wraps the stock pygeoapi Flask app with one small fix: the
pygeoapi 0.21.0 Flask adapter (`APIRequest.from_flask`) passes the raw
request body (bytes) to `provider.create()` for OGC API Features
transactions, while the GeoJSON provider expects a parsed feature dict.
The patch below decodes JSON bodies before pygeoapi handles them.
Everything else runs unmodified.

Used as the gunicorn WSGI_APP in the backend Docker image, e.g.
    WSGI_APP=windbreak_app:APP
"""

import json

from pygeoapi.api import APIRequest


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
