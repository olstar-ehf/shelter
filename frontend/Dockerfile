# ---------- base ----------
# Built from the repo root (see docker-compose.yml): the frontend depends on
# the @island.is libs via "file:" dependencies -
#   libs/map                                        -> @island.is/map
#   libs/application/templates/windbreak            -> @island.is/windbreak-application
# so the repo root is the build context. The root .dockerignore keeps host
# node_modules/dist out of the context.
FROM node:20-slim AS base
WORKDIR /workspace
ENV NODE_ENV=development

# Both libs, in dependency order (the template depends on the map lib).
# ENV (not ARG): the develop stage's runtime CMD also needs the list.
ENV LIB_DEPS="libs/map libs/application/templates/windbreak"

# Fix npm's file: link inside the template's own node_modules: npm can
# create it one level too deep for scoped packages ("Cannot find module
# '@island.is/map'"), so point it at the map lib explicitly before any
# template build or bundle step.
RUN echo '#!/bin/sh' > /usr/local/bin/fix-lib-links.sh \
 && echo 'set -e' >> /usr/local/bin/fix-lib-links.sh \
 && echo 'rm -rf /workspace/libs/application/templates/windbreak/node_modules/@island.is/map' >> /usr/local/bin/fix-lib-links.sh \
 && echo 'ln -sfn /workspace/libs/map /workspace/libs/application/templates/windbreak/node_modules/@island.is/map' >> /usr/local/bin/fix-lib-links.sh \
 && chmod +x /usr/local/bin/fix-lib-links.sh

# ---------- develop: NestJS dev server (sources bind-mounted by compose) ----------
FROM base AS develop
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
COPY libs/application/templates/windbreak/package.json \
     libs/application/templates/windbreak/package-lock.json \
     ./libs/application/templates/windbreak/
EXPOSE 3000
# Dependencies are installed at container start into the node_modules
# volumes (compose mounts ./frontend and ./libs over /workspace, so a
# build-time install would be shadowed). Libs are installed + built before
# the frontend, and npm's file: links are replaced with explicit absolute
# symlinks (npm can create them with the wrong depth for scoped packages).
CMD ["sh", "-c", "for d in $LIB_DEPS; do (cd /workspace/$d && npm ci --no-audit --no-fund) || exit 1; done && fix-lib-links && for d in $LIB_DEPS; do (cd /workspace/$d && npm run build) || exit 1; done && cd /workspace/frontend && npm ci --no-audit --no-fund && rm -rf node_modules/@island.is/map node_modules/@island.is/windbreak-application && ln -sfn /workspace/libs/map node_modules/@island.is/map && ln -sfn /workspace/libs/application/templates/windbreak node_modules/@island.is/windbreak-application && if [ \"$WINDBREAK_APPLICATIONS_MOCK\" != \"true\" ] && { [ -n \"$WINDBREAK_DATABASE_URL\" ] || [ -n \"$PGHOST\" ]; }; then node db/migrate.cjs || exit 1; fi && npm run start:dev"]

# ---------- build: compile libs + server + client bundle ----------
FROM base AS build
WORKDIR /workspace
ENV NODE_ENV=production
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
COPY libs/application/templates/windbreak/package.json \
     libs/application/templates/windbreak/package-lock.json \
     ./libs/application/templates/windbreak/
# Each lib installs its own toolchain; the frontend install also links them.
# The template's own @island.is/map link is fixed before its build.
RUN for d in $LIB_DEPS; do (cd /workspace/$d && npm ci --no-audit --no-fund) || exit 1; done
RUN cd /workspace/frontend && npm ci --no-audit --no-fund
COPY libs/map ./libs/map
COPY libs/application ./libs/application
RUN fix-lib-links && for d in $LIB_DEPS; do (cd /workspace/$d && npm run build) || exit 1; done
# Deterministic links to the built libs (replaces npm's file: symlinks).
RUN rm -rf /workspace/frontend/node_modules/@island.is/map \
           /workspace/frontend/node_modules/@island.is/windbreak-application && \
    ln -sfn /workspace/libs/map /workspace/frontend/node_modules/@island.is/map && \
    ln -sfn /workspace/libs/application/templates/windbreak \
            /workspace/frontend/node_modules/@island.is/windbreak-application
COPY frontend ./frontend
RUN cd /workspace/frontend && npm run build

# ---------- serve: run the compiled NestJS server ----------
FROM node:20-slim AS serve
WORKDIR /workspace
ENV NODE_ENV=production
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
COPY libs/application/templates/windbreak/package.json \
     libs/application/templates/windbreak/package-lock.json \
     ./libs/application/templates/windbreak/
# Runtime deps only. npm ci does NOT install the dependencies of file:
# links, so each lib's own production deps (zod, @turf for server-side
# validation) are installed here explicitly.
RUN for d in $LIB_DEPS; do (cd /workspace/$d && npm ci --omit=dev --no-audit --no-fund) || exit 1; done
RUN cd /workspace/frontend && npm ci --omit=dev --no-audit --no-fund
# Replace npm's file: symlinks with REAL copies inside frontend/node_modules
# (carrying each lib's node_modules): Node resolves the libs' imports
# relative to their realpath, so they must sit inside the frontend's own
# node_modules tree.
RUN rm -rf /workspace/frontend/node_modules/@island.is/map \
           /workspace/frontend/node_modules/@island.is/windbreak-application && \
    cp -r /workspace/libs/map /workspace/frontend/node_modules/@island.is/map && \
    mkdir -p /workspace/frontend/node_modules/@island.is/windbreak-application && \
    cp -r /workspace/libs/application/templates/windbreak/* \
          /workspace/frontend/node_modules/@island.is/windbreak-application/
COPY --from=build /workspace/libs/map/dist ./frontend/node_modules/@island.is/map/dist
COPY --from=build /workspace/libs/application/templates/windbreak/dist \
                  ./frontend/node_modules/@island.is/windbreak-application/dist
COPY --from=build /workspace/frontend/dist ./frontend/dist
COPY --from=build /workspace/frontend/public ./frontend/public
COPY --from=build /workspace/frontend/views ./frontend/views
# DB migrations + runner (idempotent; skipped in the file-backed mock mode)
COPY frontend/db ./frontend/db
WORKDIR /workspace/frontend
EXPOSE 3000
CMD ["sh", "-c", "if [ \"$WINDBREAK_APPLICATIONS_MOCK\" != \"true\" ]; then node db/migrate.cjs || exit 1; fi && node dist/main.js"]
