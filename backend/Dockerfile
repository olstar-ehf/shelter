# Windbreak Grant Service - backend image
#
# Extends the official pygeoapi image with:
#   * flask-cors, required by pygeoapi's `server.cors: true` option
#     (not bundled with geopython/pygeoapi:0.21.0)
#   * the PostgreSQL provider's SQLAlchemy deps (psycopg2 + geoalchemy2) -
#     windbreak_applications is served from PostGIS (read-only OGC API)
#   * windbreak_app.py, a WSGI entry point that expands ${VAR} env
#     placeholders in the pygeoapi config and patches APIRequest.from_flask
#     so OGC API Features transaction (POST) bodies are decoded to JSON
#     before reaching the GeoJSON provider (file-backed mock fallback)
#   * a replacement entrypoint (entrypoint.sh): the stock one regenerates
#     the OpenAPI document on every start, which instantiates the
#     PostgreSQL provider and therefore requires a live database just to
#     boot. Here the document is baked at build time from the GeoJSON
#     docgen variant (no database needed); the DB provider stays lazy.
FROM geopython/pygeoapi:0.21.0

RUN python3 -m pip install --no-cache-dir flask-cors psycopg2-binary geoalchemy2

COPY windbreak_app.py pygeoapi.config.yml docgen-config.py entrypoint.sh \
     /pygeoapi/
# Self-contained default data (the compose files overlay ./backend/data).
COPY data /pygeoapi/data

# Bake the OpenAPI document (GeoJSON docgen variant - no DB connection).
RUN python3 /pygeoapi/docgen-config.py /tmp/docgen.config.yml /pygeoapi/data \
    && pygeoapi openapi generate /tmp/docgen.config.yml \
       --output-file /pygeoapi/local.openapi.yml

# docker-compose.yml mounts ./backend/pygeoapi.config.yml over
# /pygeoapi/local.config.yml and sets WSGI_APP=windbreak_app:APP.
ENTRYPOINT ["/bin/sh", "/pygeoapi/entrypoint.sh"]
