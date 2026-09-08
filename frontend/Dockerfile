# ---------- base ----------
# Built from the repo root (see docker-compose.yml): the frontend depends on
# the @island.is/map lib via "file:../../libs/map", so both are copied in.
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
CMD ["sh", "-c", "cd /workspace/libs/map && npm ci --no-audit --no-fund && npm run build && cd /workspace/frontend && npm ci --no-audit --no-fund && npm run start:dev"]

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
# Replace npm's file: symlink with a real copy of the built lib so the
# frontend build is immune to npm link-path quirks.
RUN rm -rf /workspace/frontend/node_modules/@island.is/map && \
    cp -r /workspace/libs/map /workspace/frontend/node_modules/@island.is/map
COPY frontend ./frontend
RUN cd /workspace/frontend && npm run build

# ---------- serve: run the compiled NestJS server ----------
FROM node:20-slim AS serve
WORKDIR /workspace
ENV NODE_ENV=production
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY libs/map/package.json ./libs/map/package.json
# Runtime deps only; the lib's geometry/messages code for server-side
# validation comes from its compiled dist via the file: dependency.
RUN cd /workspace/frontend && npm ci --omit=dev --no-audit --no-fund
# Replace npm's file: symlink with a real copy of the built lib (same as in
# the build stage) and make sure its compiled dist is in place.
RUN rm -rf /workspace/frontend/node_modules/@island.is/map && \
    cp -r /workspace/libs/map /workspace/frontend/node_modules/@island.is/map
COPY --from=build /workspace/libs/map/dist ./frontend/node_modules/@island.is/map/dist
COPY --from=build /workspace/frontend/dist ./frontend/dist
COPY --from=build /workspace/frontend/public ./frontend/public
COPY --from=build /workspace/frontend/views ./frontend/views
WORKDIR /workspace/frontend
EXPOSE 3000
CMD ["node", "dist/main.js"]
