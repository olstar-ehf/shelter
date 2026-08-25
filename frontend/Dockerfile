# ---------- base ----------
FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=development

# ---------- develop: NestJS dev server (source bind-mounted by compose) ----------
FROM base AS develop
COPY package.json package-lock.json ./
EXPOSE 3000
# Dependencies are installed at container start into the node_modules volume
# (docker-compose mounts ./frontend over /app, so a build-time install would
# be shadowed).
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run start:dev"]

# ---------- build: compile server + client bundle ----------
FROM node:20-slim AS build
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- serve: run the compiled NestJS server ----------
FROM node:20-slim AS serve
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# Runtime deps only (leaflet/turf are bundled into public/app.js at build time)
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/views ./views
EXPOSE 3000
CMD ["node", "dist/main.js"]
