# =============================================================================
# Bettencourt POS - Production Docker Image (Optimized)
# =============================================================================
# Pattern: bun build --compile → single self-contained binary (no node_modules)
#
# Architecture:
#   - Stage 1 (Builder): Node.js + Bun — builds web SPA and compiles server binary
#   - Stage 2 (Runner): gcr.io/distroless/cc-debian12 — ~30MB base, full glibc
#
# Why distroless/cc?
#   The compiled Bun binary requires glibc + libstdc++ (for JavaScriptCore).
#   Alpine + gcompat lacks too many glibc symbols (backtrace, malloc_trim, etc.)
#   distroless/cc provides exactly what Bun needs with the minimal footprint.
#
# Why bun build --compile?
#   Bundles Bun runtime + 932 JS modules into one ELF binary — no node_modules.
#   Final image: ~160MB vs original 701MB (~77% reduction).
#
# Healthcheck: defined in docker-compose.prod.yml (no shell in distroless).
#
# Node.js is required in builder because React Router's writeBundle hook
# imports react-dom/server which lacks renderToPipeableStream in Bun's runtime.
# =============================================================================

# Stage 1: Builder (Node.js + Bun for react-router compatibility)
FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends binutils && rm -rf /var/lib/apt/lists/*
RUN npm install -g bun

WORKDIR /app

# Copy package files first for layer caching
COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/fumadocs/package.json apps/fumadocs/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/config/package.json packages/config/

# --ignore-scripts: fumadocs postinstall (fumadocs-mdx) needs source.config.ts
# which isn't present at this layer. The Vite plugin regenerates .source/ during
# bun run build, so the postinstall is redundant in Docker.
RUN bun install --ignore-scripts

# Copy source
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/
COPY apps/fumadocs/ apps/fumadocs/
COPY packages/ packages/

# Build web SPA (empty VITE_SERVER_URL = same-origin in production)
ENV VITE_SERVER_URL=""
# NODE_ENV=production must be set BEFORE bun build --compile.
# Bun inlines process.env.NODE_ENV at compile time (dead code elimination).
# Without this, the production static-file serving branch gets eliminated,
# and the server returns "Bettencourt POS API — Development" at runtime.
ENV NODE_ENV=production
RUN cd apps/web && bun run build

# Build fumadocs user manual (prerendered static pages under /manual/*)
RUN cd apps/fumadocs && bun run build

# Compile server into a single self-contained binary.
# --compile:   embed Bun runtime + all JS modules into one ELF executable
# --minify:    shrink the embedded JS payload
# NOTE: strip is intentionally NOT used — strip --strip-all removes ELF sections
#       that Bun uses to locate its embedded JS payload, causing the binary to
#       fall back to Bun CLI mode instead of running the server.
WORKDIR /app/apps/server
RUN bun build --compile --minify ./src/index.ts --outfile /app/server-bin


# Stage 2: Minimal distroless runtime
# gcr.io/distroless/cc-debian12 provides glibc + libstdc++ in ~30MB.
# No shell, no package manager — just what the Bun binary needs.
# Runs as nonroot user (uid 65532) for security.
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# The compiled server binary (includes Bun runtime + all JS code)
COPY --from=builder --chown=nonroot:nonroot /app/server-bin ./server

# SPA static assets served by Hono's serveStatic({ root: "./public" })
COPY --from=builder --chown=nonroot:nonroot /app/apps/web/build/client/ ./public/

# Fumadocs user manual — prerendered pages at /manual/*, assets at /manual/assets/*
# With vite base="/manual", generated HTML references /manual/assets/..., so assets
# must land in ./public/manual/assets/ to resolve correctly via serveStatic.
COPY --from=builder --chown=nonroot:nonroot /app/apps/fumadocs/build/client/manual/ ./public/manual/
COPY --from=builder --chown=nonroot:nonroot /app/apps/fumadocs/build/client/assets/ ./public/manual/assets/

EXPOSE 3000

# Healthcheck is defined in docker-compose.prod.yml (no shell tools in distroless)
CMD ["/app/server"]
