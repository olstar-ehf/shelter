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
FROM geopython/pygeoapi:0.21.0

RUN python3 -m pip install --no-cache-dir flask-cors psycopg2-binary geoalchemy2

COPY windbreak_app.py /pygeoapi/windbreak_app.py

# The image entrypoint (/entrypoint.sh) starts gunicorn with the app module
# from $WSGI_APP; docker-compose.yml sets it to windbreak_app:APP.
