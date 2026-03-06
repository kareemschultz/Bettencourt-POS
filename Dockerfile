# =============================================================================
# Bettencourt POS - Production Docker Image
# =============================================================================
# Pattern from Terminal Control: bundle + explicit externals install
#
# Architecture:
#   - Stage 1 (Builder): Node.js + Bun - builds web SPA and server bundle
#   - Stage 2 (Runner): Bun slim - bundle + external packages only
#
# Node.js is required in builder because React Router's writeBundle hook
# imports react-dom/server which lacks renderToPipeableStream in Bun's runtime.
#
# External packages (break when bundled due to dynamic imports):
#   - hono, @hono/* (web framework)
#   - @orpc/* (RPC framework)
#   - better-auth, @better-auth/* (auth library with dynamic adapter loading)
#   - drizzle-orm, pg (database)
#   - dotenv, @t3-oss/env-core (env validation)
#   - zod (schema validation)
# =============================================================================

# Stage 1: Builder (Node.js + Bun for react-router compatibility)
FROM node:22-slim AS builder
RUN npm install -g bun

WORKDIR /app

# Copy package files first for layer caching
COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/config/package.json packages/config/

# Note: --frozen-lockfile omitted because apps/fumadocs is excluded via
# .dockerignore, causing a workspace member mismatch.
RUN bun install

# Copy source
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/
COPY packages/ packages/

# Build web SPA (empty VITE_SERVER_URL = same-origin in production)
ENV VITE_SERVER_URL=""
RUN cd apps/web && bun run build

# Build server (tsdown bundles workspace packages, externals remain imports)
RUN cd apps/server && bun run build

# Create minimal node_modules with ONLY external packages
# This avoids Bun's workspace symlink issues entirely
WORKDIR /app/externals
RUN echo '{"name":"externals","type":"module"}' > package.json && \
    bun add hono @orpc/openapi @orpc/server @orpc/zod \
            better-auth @better-auth/drizzle-adapter drizzle-orm pg \
            dotenv @t3-oss/env-core zod --production

WORKDIR /app

# Stage 2: Production runtime
FROM oven/bun:1-slim

WORKDIR /app

# Copy server bundle
COPY --from=builder /app/apps/server/dist/ ./dist/

# Copy SPA build (client-side files)
COPY --from=builder /app/apps/web/build/client/ ./public/

# Copy package.json for Bun module resolution
COPY --from=builder /app/apps/server/package.json ./

# Copy ONLY external packages (clean node_modules, no symlinks)
COPY --from=builder /app/externals/node_modules ./node_modules

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/index.mjs"]
