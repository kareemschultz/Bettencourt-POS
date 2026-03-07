# Developer Documentation

## Architecture Overview

Bettencourt POS is a monorepo (Turborepo) with three main apps and two key packages:

```
apps/
  web/        React SPA — React Router v7, Tailwind CSS v4, shadcn/ui
  server/     Hono API server — handles auth routes, RPC routing, SSE

packages/
  api/        oRPC routers (29 routers, ~5000 LOC of business logic)
  auth/       Better Auth configuration
  db/         Drizzle ORM schema (78 tables) + seed script
  env/        Shared Zod-validated environment configuration
```

The web app is a pure SPA — all API calls go through oRPC endpoints exposed by the server. In production, the server also serves the SPA's static files.

---

## API Layer (oRPC)

### Router patterns

All routers live in `packages/api/src/routers/`. Each router uses one of three procedure types:

```typescript
// Public: no authentication required
publicProcedure

// Protected: must be logged in (any role)
protectedProcedure

// Permission-gated: requires a specific permission
permissionProcedure("orders.create")
permissionProcedure("inventory.manage")
```

### Adding a new router

1. Create `packages/api/src/routers/my-feature.ts`
2. Export a router object with procedures
3. Add to `packages/api/src/routers/index.ts`
4. Add to `apps/web/src/lib/orpc.ts` client

### Context

Every procedure receives `context` with:
- `context.session` — current user session (null if unauthenticated)
- `context.user` — current user object
- `context.db` — Drizzle DB instance

---

## Permission System

Roles are seeded in `seed.ts`. The mapping is:

| Role | Key Permissions |
|------|----------------|
| Owner | All permissions |
| Manager | All except system config |
| Cashier | orders.create, customers.manage, giftcards.manage |
| Server | orders.create, customers.view |
| Kitchen | kitchen.manage |
| Warehouse Clerk | inventory.manage, purchase_orders.manage |
| Accountant | reports.financial, expenses.manage |
| Executive | reports.* (read-only analytics) |

Permissions are checked server-side via `permissionProcedure`. Client-side, the `usePermissions()` hook gates UI elements.

Route-level guards are defined in `apps/web/src/routes/dashboard.tsx` via the `ROUTE_MODULE_MAP` constant.

---

## Database Schema

78 tables organized by domain:

| Domain | Tables | File |
|--------|--------|------|
| Auth | user, session, account, member, invitation, role, permission, rolePermission | `schema/auth.ts` |
| Organization | organization, location, register, registerDepartment, receiptConfig, timeEntry | `schema/organization.ts` |
| Product | product, reportingCategory, modifierGroup, modifier, productModifierGroup, comboProduct, comboComponent, productBarcode | `schema/product.ts` |
| Order | order, orderLineItem, payment, discount, discountRule, table, orderTable | `schema/order.ts` |
| Inventory | inventoryItem, stockLedger, stockAlert, purchaseOrder, purchaseOrderItem, supplier, wasteLog | `schema/inventory.ts` |
| Customer | customer, giftCard, giftCardTransaction, loyaltyProgram, loyaltyTier, customerLoyalty, loyaltyTransaction | `schema/customer.ts` |
| Cash | cashSession, cashDrop, shiftSummary | `schema/cash.ts` |
| Kitchen | kitchenOrderTicket, kitchenOrderItem, productionLog, productionCheckoff | `schema/kitchen.ts` |
| Notifications | notificationSettings, notificationLog, notificationTemplate | `schema/notification.ts` |
| Audit | auditLog | `schema/audit.ts` |
| Webhooks | webhook, webhookDelivery | `schema/webhook.ts` |
| Invoice | invoice, invoiceLineItem, quotation, quotationLineItem | `schema/invoice.ts` |
| Production | productionBatch, productionComponent, productComponentMapping | `schema/production.ts` |
| Tax | taxRate | (in organization schema) |

---

## Authentication

Better Auth handles authentication with these plugins enabled:
- `organization` — multi-tenant with member roles
- `admin` — admin plugin for role management and session creation
- `multiSession` — up to 3 concurrent sessions per user
- `twoFactor` — optional 2FA
- `username` — username field on users

### Custom auth endpoints

Two custom endpoints in `apps/server/src/index.ts`:

- `POST /api/auth/pin-login` — authenticates via PIN hash using Better Auth's internal session creation
- `POST /api/auth/demo-login` — **disabled in production** (NODE_ENV check)

---

## Real-time (SSE)

Kitchen Display System uses Server-Sent Events:

- Endpoint: `GET /api/kitchen/events`
- Server emits via `emitKitchenEvent()` from `packages/api/src/lib/kitchen-events.ts`
- Client subscribes in `apps/web/src/routes/dashboard.kitchen.tsx`

Event types: `ticket:created`, `ticket:updated`, `item:updated`

---

## Frontend Patterns

### Data fetching

All data fetching uses oRPC + React Query via a typed client:

```typescript
import { orpc } from "~/lib/orpc";

const { data } = useQuery(orpc.orders.list.queryOptions({ ... }));
const mutation = useMutation(orpc.orders.create.mutationOptions());
```

### Permissions in UI

```typescript
import { usePermissions } from "~/hooks/use-permissions";

const { can } = usePermissions();
if (can("orders.void")) { /* show void button */ }
```

### Route guards

Dashboard routes check permissions in the layout component (`dashboard.tsx`). Unauthorized access redirects to `/unauthorized`.

---

## Running Locally

```bash
# Start Postgres (Docker)
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:15

# Configure env
echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bettencourt_pos' > apps/server/.env
echo 'BETTER_AUTH_SECRET=dev-secret-must-be-at-least-32-chars-long' >> apps/server/.env
echo 'BETTER_AUTH_URL=http://localhost:3000' >> apps/server/.env
echo 'CORS_ORIGIN=http://localhost:5173' >> apps/server/.env

# Setup DB
bun run db:push
cd packages/db && bun run db:seed && cd ../..

# Start dev
bun run dev
```

---

## Docker Image Optimization

### Overview

The production Docker image was reduced from **701 MB → 189 MB** (73% reduction) using two key techniques: `bun build --compile` to eliminate node_modules, and `gcr.io/distroless/cc-debian12` as the minimal runtime base.

### Multistage Build Architecture

```
Stage 1 — Builder (node:22-slim + bun)
  ├── bun install            (all workspace dependencies)
  ├── cd apps/web && bun run build   (Vite → static SPA assets)
  └── bun build --compile --minify ./src/index.ts   (→ /app/server-bin)

Stage 2 — Runner (gcr.io/distroless/cc-debian12:nonroot)
  ├── /app/server           (compiled binary, ~124 MB — includes Bun runtime + 932 JS modules)
  └── /app/public/          (SPA static assets, ~3.5 MB)
```

### Key Technique: `bun build --compile`

`bun build --compile` produces a standalone ELF binary that embeds:
- The Bun runtime (JavaScriptCore engine)
- All 932 JS modules from the monorepo
- No reference to `node_modules` at runtime

This eliminates the need to ship any JavaScript source or dependency tree in the final image — just the binary + the built SPA assets.

**Original approach** used `tsdown` externals, which required shipping `node_modules` (~349 MB) in the runner image. That, combined with the `oven/bun:1-slim` base (~200 MB), produced 701 MB total.

### Why `gcr.io/distroless/cc-debian12`, not Alpine

The compiled Bun binary requires **glibc + libstdc++** because JavaScriptCore (Bun's JS engine) is built against glibc.

Alpine Linux uses **musl libc** instead of glibc. The `gcompat` shim for Alpine provides partial compatibility but is missing symbols that Bun requires:
```
backtrace, backtrace_symbols, malloc_trim, __fprintf_chk,
__cxa_thread_atexit_impl, gnu_get_libc_version
```

`gcr.io/distroless/cc-debian12` is a Debian-based minimal image that provides exactly glibc + libstdc++ in ~30 MB with no shell, no package manager, and runs as a non-root user (uid 65532) for security.

### Why `strip --strip-all` Was NOT Used

Stripping ELF debug symbols is a common technique to shrink binaries, but **it breaks compiled Bun binaries**. `bun build --compile` embeds the JavaScript payload in custom ELF sections. `strip --strip-all` removes unknown sections, destroying the embedded payload. When the payload is gone, Bun falls back to CLI mode (prints the Bun help text) instead of running the server.

The `binutils` package is still installed in the builder stage but `strip` is not invoked.

### Build Layer Caching

Package files are copied before source files to maximize Docker cache hits:

```dockerfile
# These layers only rebuild when package.json or bun.lock changes
COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/*/package.json packages/*/
RUN bun install

# Source changes only rebuild from here
COPY apps/ apps/
COPY packages/ packages/
RUN bun run build && bun build --compile ...
```

A typical rebuild after a source-only change takes ~30s instead of ~2 min because `bun install` is cached.

### Healthcheck Limitation

`distroless` images have no shell, no `curl`, no `wget`. In-container healthchecks using shell commands are not possible. Instead:

- `docker-compose.prod.yml` uses `restart: unless-stopped` for automatic recovery
- External monitoring (Pangolin / uptime monitors) checks `GET /health`
- The `/health` endpoint returns `{"status":"ok","timestamp":"..."}` from `apps/server/src/index.ts`

### Size Breakdown

| Component | Size |
|-----------|------|
| distroless/cc-debian12 base | ~30 MB |
| Compiled server binary | ~124 MB |
| Web SPA static assets | ~3.5 MB |
| **Total** | **~189 MB** |

---

## CI/CD (GitHub Actions)

The CI/CD pipeline is defined in `.github/workflows/ci.yml`. It has two jobs:

| Job | Runner | Triggers |
|-----|--------|---------|
| `check` — Type Check & Lint | `ubuntu-latest` (GitHub-hosted) | Every push and PR |
| `deploy` — Build & Deploy | `self-hosted` (production host) | Push to `master` only (after `check` passes) |

### What the pipeline does

**Check job** (GitHub-hosted runner):
1. Install dependencies (cached by `bun.lock` hash)
2. Run `bun run check-types` — must be zero errors
3. Run `bunx @biomejs/biome ci .` — lint/format in read-only CI mode

**Deploy job** (self-hosted runner on production host):
1. Write GitHub Secrets to a `.env` file
2. Run `docker compose -f docker-compose.prod.yml --env-file .env up -d --build`
3. Poll `GET http://localhost:3000/health` for up to 60 seconds
4. Prune dangling Docker images
5. Delete the `.env` file (cleanup runs even on failure)

### Setting up the self-hosted runner

The deploy job needs a GitHub Actions runner installed on the production host (this machine). Register it once:

```bash
# 1. Go to: https://github.com/kareemschultz/Bettencourt-POS/settings/actions/runners/new
# 2. Follow the Linux/x64 instructions shown on that page
# 3. When prompted for labels, add: self-hosted
# 4. Install as a systemd service so it survives reboots:
sudo ./svc.sh install
sudo ./svc.sh start
```

The runner connects outbound to GitHub — no inbound ports or SSH exposure required.

### Adding GitHub Secrets

Go to **repo Settings → Secrets and variables → Actions**, then add:

| Secret name | Value |
|------------|-------|
| `DATABASE_URL` | `postgresql://...` (production database URL) |
| `BETTER_AUTH_SECRET` | The 32+ character auth secret |

### Build caching

Because the deploy job runs on the self-hosted runner (persistent machine), Docker's build cache accumulates between deployments. After the first full build:
- The `bun install` layer is cached as long as `bun.lock` doesn't change
- Typical rebuild time: **~30 seconds** (vs ~2 min for a cold build)

---

## Docker Image Optimization
