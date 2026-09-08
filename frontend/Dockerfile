# ---------- base ----------
# Built from the repo root (see docker-compose.yml): the frontend depends on
# the @island.is/map lib via "file:../../libs/map", so both are copied in.
# The root .dockerignore keeps host node_modules/dist out of the context.
FROM node:20-slim AS base
WORKDIR /workspace
ENV NODE_ENV=development

# ---------- develop: NestJS dev server (sources bind-mounted by compose) ----------
FROM base AS develop
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
EXPOSE 3000
# Dependencies are installed at container start into the node_modules
# volumes (compose mounts ./frontend and ./libs/map over /workspace, so a
# build-time install would be shadowed). The lib is built before the
# frontend because the frontend consumes its compiled dist/.
#
# npm's file: dependency link can be created with a wrong depth (scoped
# packages), so it is replaced with an explicit absolute symlink to the
# bind-mounted lib before the frontend starts.
CMD ["sh", "-c", "cd /workspace/libs/map && npm ci --no-audit --no-fund && npm run build && cd /workspace/frontend && npm ci --no-audit --no-fund && rm -rf node_modules/@island.is/map && ln -sfn /workspace/libs/map node_modules/@island.is/map && npm run start:dev"]

# ---------- build: compile lib + server + client bundle ----------
FROM node:20-slim AS build
WORKDIR /workspace
ENV NODE_ENV=production
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
# The lib installs its own toolchain (tsc); the frontend install also pulls
# in the lib's runtime deps (@turf, leaflet, ...) via the file: dependency.
RUN cd /workspace/libs/map && npm ci --no-audit --no-fund
RUN cd /workspace/frontend && npm ci --no-audit --no-fund
COPY libs/map ./libs/map
RUN cd /workspace/libs/map && npm run build
# Deterministic link to the built lib (replaces npm's file: symlink).
RUN rm -rf /workspace/frontend/node_modules/@island.is/map && \
    ln -sfn /workspace/libs/map /workspace/frontend/node_modules/@island.is/map
COPY frontend ./frontend
RUN cd /workspace/frontend && npm run build

# ---------- serve: run the compiled NestJS server ----------
FROM node:20-slim AS serve
WORKDIR /workspace
ENV NODE_ENV=production
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
# Runtime deps only. npm ci does NOT install the dependencies of a file:
# link, so the lib's own production deps (@turf for server-side validation)
# are installed here explicitly.
RUN cd /workspace/libs/map && npm ci --omit=dev --no-audit --no-fund
RUN cd /workspace/frontend && npm ci --omit=dev --no-audit --no-fund
# Replace npm's file: symlink with a REAL copy inside frontend/node_modules
# (carrying the lib's node_modules): Node resolves the lib's @turf imports
# relative to the lib's realpath, so the lib must sit inside the frontend's
# own node_modules tree.
RUN rm -rf /workspace/frontend/node_modules/@island.is/map && \
    cp -r /workspace/libs/map /workspace/frontend/node_modules/@island.is/map
COPY --from=build /workspace/libs/map/dist ./frontend/node_modules/@island.is/map/dist
COPY --from=build /workspace/frontend/dist ./frontend/dist
COPY --from=build /workspace/frontend/public ./frontend/public
COPY --from=build /workspace/frontend/views ./frontend/views
WORKDIR /workspace/frontend
EXPOSE 3000
CMD ["node", "dist/main.js"]
