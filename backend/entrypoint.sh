#!/bin/sh
# Windbreak backend entrypoint.
#
# The stock pygeoapi entrypoint regenerates the OpenAPI document on every
# container start with `pygeoapi openapi generate`, which instantiates every
# provider - including the PostgreSQL provider for windbreak_applications.
# That made the backend require a live database just to boot (and fail with
# a confusing psycopg2 "localhost:5432 connection refused" when the
# WINDBREAK_DATABASE_URL env is missing).
#
# This entrypoint only generates the document when it does not exist yet,
# and generates it from the GeoJSON docgen variant of the config
# (backend/docgen-config.py), which needs no database. The document is
# baked into the image at build time anyway, so in practice generation only
# runs as a fallback. The PostgreSQL provider stays lazy: it connects on
# the first request to the windbreak_applications collection.

set -e

export PYGEOAPI_HOME=/pygeoapi
export PYGEOAPI_CONFIG="${PYGEOAPI_CONFIG:-${PYGEOAPI_HOME}/local.config.yml}"
export PYGEOAPI_OPENAPI="${PYGEOAPI_OPENAPI:-${PYGEOAPI_HOME}/local.openapi.yml}"

# gunicorn settings with the same defaults/env contract as the stock image
SCRIPT_NAME=${SCRIPT_NAME:=/}
CONTAINER_NAME=${CONTAINER_NAME:=pygeoapi}
CONTAINER_HOST=${CONTAINER_HOST:=0.0.0.0}
CONTAINER_PORT=${CONTAINER_PORT:=80}
WSGI_APP=${WSGI_APP:=pygeoapi.flask_app:APP}
WSGI_WORKERS=${WSGI_WORKERS:=4}
WSGI_WORKER_TIMEOUT=${WSGI_WORKER_TIMEOUT:=6000}
WSGI_WORKER_CLASS=${WSGI_WORKER_CLASS:=gevent}

cd "${PYGEOAPI_HOME}"

if [ ! -f "${PYGEOAPI_OPENAPI}" ]; then
    echo "openapi.yml missing - generating from the GeoJSON docgen variant (no database needed)"
    python3 /pygeoapi/docgen-config.py /tmp/docgen.config.yml /pygeoapi/data
    pygeoapi openapi generate /tmp/docgen.config.yml --output-file "${PYGEOAPI_OPENAPI}"
fi

[ "${SCRIPT_NAME}" = '/' ] && SCRIPT_NAME=""

echo "Starting gunicorn name=${CONTAINER_NAME} on ${CONTAINER_HOST}:${CONTAINER_PORT} with ${WSGI_WORKERS} workers and SCRIPT_NAME=${SCRIPT_NAME}"
exec gunicorn --workers "${WSGI_WORKERS}" \
    --worker-class="${WSGI_WORKER_CLASS}" \
    --timeout "${WSGI_WORKER_TIMEOUT}" \
    --name="${CONTAINER_NAME}" \
    --bind "${CONTAINER_HOST}:${CONTAINER_PORT}" \
    "${WSGI_APP}"
