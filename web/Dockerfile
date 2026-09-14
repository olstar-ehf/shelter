# ---------- base ----------
# Next.js host for the windbreak application: the same shared React pages
# (libs/application/ui-shell + map/template libs) server-rendered. Built
# from the repo root (file: deps to the libs).
FROM node:20-slim AS base
WORKDIR /workspace
ENV NODE_ENV=development
ENV LIB_DEPS="libs/map libs/application/templates/windbreak libs/application/ui-shell"

# ---------- develop: next dev (sources bind-mounted by compose) ----------
FROM base AS develop
COPY web/package.json web/package-lock.json ./web/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
COPY libs/application/templates/windbreak/package.json \
     libs/application/templates/windbreak/package-lock.json \
     ./libs/application/templates/windbreak/
COPY libs/application/ui-shell/package.json \
     libs/application/ui-shell/package-lock.json \
     ./libs/application/ui-shell/
EXPOSE 3000
CMD ["sh", "-c", "for d in $LIB_DEPS; do (cd /workspace/$d && npm ci --no-audit --no-fund && npm run build) || exit 1; done && cd /workspace/web && npm ci --no-audit --no-fund && npm run fix:links && npm run dev"]

# ---------- build: compile the libs + the Next app ----------
FROM node:20-slim AS build
WORKDIR /workspace
ENV NODE_ENV=production
COPY web/package.json web/package-lock.json ./web/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
COPY libs/application/templates/windbreak/package.json \
     libs/application/templates/windbreak/package-lock.json \
     ./libs/application/templates/windbreak/
COPY libs/application/ui-shell/package.json \
     libs/application/ui-shell/package-lock.json \
     ./libs/application/ui-shell/
RUN for d in $LIB_DEPS; do (cd /workspace/$d && npm ci --no-audit --no-fund) || exit 1; done
RUN cd /workspace/web && npm ci --no-audit --no-fund
COPY libs/map ./libs/map
COPY libs/application ./libs/application
RUN for d in $LIB_DEPS; do (cd /workspace/$d && npm run build) || exit 1; done
COPY web ./web
RUN cd /workspace/web && npm run fix:links && NEXT_TELEMETRY_DISABLED=1 npm run build

# ---------- serve: run the compiled Next app ----------
FROM node:20-slim AS serve
WORKDIR /workspace
ENV NODE_ENV=production
COPY web/package.json web/package-lock.json ./web/
COPY libs/map/package.json libs/map/package-lock.json ./libs/map/
COPY libs/application/templates/windbreak/package.json \
     libs/application/templates/windbreak/package-lock.json \
     ./libs/application/templates/windbreak/
COPY libs/application/ui-shell/package.json \
     libs/application/ui-shell/package-lock.json \
     ./libs/application/ui-shell/
RUN for d in $LIB_DEPS; do (cd /workspace/$d && npm ci --omit=dev --no-audit --no-fund) || exit 1; done
RUN cd /workspace/web && npm ci --omit=dev --no-audit --no-fund
# Real copies of the libs inside web/node_modules (npm ci does not install
# file: links' dependencies; Node resolves relative to the libs' realpath).
RUN cd /workspace/web && mkdir -p node_modules/@island.is && \
    rm -rf node_modules/@island.is/map \
           node_modules/@island.is/windbreak-application \
           node_modules/@island.is/application-ui-shell && \
    cp -r /workspace/libs/map node_modules/@island.is/map && \
    cp -r /workspace/libs/application/templates/windbreak \
          node_modules/@island.is/windbreak-application && \
    cp -r /workspace/libs/application/ui-shell \
          node_modules/@island.is/application-ui-shell
COPY --from=build /workspace/libs/map/dist ./web/node_modules/@island.is/map/dist
COPY --from=build /workspace/libs/application/templates/windbreak/dist \
                  ./web/node_modules/@island.is/windbreak-application/dist
COPY --from=build /workspace/libs/application/ui-shell/dist \
                  ./web/node_modules/@island.is/application-ui-shell/dist
COPY --from=build /workspace/web/.next ./web/.next
COPY --from=build /workspace/web/public ./web/public
WORKDIR /workspace/web
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
