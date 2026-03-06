# Plan #2: Feature Build-out & Infrastructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch to central DB, Dockerize the app, wire oRPC clients, add RBAC, SSE KDS, PIN auth, settings UI, and remaining pages.

**Architecture:** Single Docker container runs Hono (serves SPA + API). All data fetching migrates from SWR/fetch to oRPC+TanStack Query. RBAC enforced at procedure level via `requirePermission()` middleware. KDS uses SSE for real-time updates. PIN auth provides terminal lock/unlock.

**Tech Stack:** Hono, oRPC, Drizzle, Better Auth, TanStack Query, SSE, Docker, Traefik

---

## Batch 1: Infrastructure (Tasks 1-3)

### Task 1: Switch to kt-central-db

**Files:**
- Modify: `apps/server/.env`
- Delete: `packages/db/docker-compose.yml`
- Modify: `packages/db/drizzle.config.ts` (verify env loading)
- Modify: `packages/db/package.json` (remove db:start, db:stop, db:down scripts)
- Modify: `turbo.json` (remove db:start, db:stop, db:down tasks)

**Step 1: Update DATABASE_URL**

In `apps/server/.env`, change:
```
DATABASE_URL=postgresql://postgres:PASSWORD@kt-central-db:5432/bettencourt_pos
```

Note: For local dev (outside Docker), use `localhost:5432` if kt-central-db is port-mapped, or the actual IP. The Docker hostname `kt-central-db` only works from containers on `kt-network`. Create a `.env.docker` for the container and keep `.env` for local dev:

```
# apps/server/.env (local dev)
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/bettencourt_pos

# apps/server/.env.docker (container on kt-network)
DATABASE_URL=postgresql://postgres:PASSWORD@kt-central-db:5432/bettencourt_pos
```

Ask the user for the actual PASSWORD value.

**Step 2: Stop and remove local PG container**

```bash
cd packages/db
docker compose down -v
```

**Step 3: Delete docker-compose.yml**

```bash
rm packages/db/docker-compose.yml
```

**Step 4: Clean up turbo.json**

Remove `db:start`, `db:stop`, `db:down` tasks from `turbo.json` since there's no local container to manage.

**Step 5: Push schema to kt-central-db**

```bash
cd packages/db
bun run db:push
```

**Step 6: Seed the database**

```bash
bun run src/seed.ts
```

**Step 7: Verify**

```bash
docker exec kt-central-db psql -U postgres -d bettencourt_pos -c "SELECT count(*) FROM product;"
```

Expected: `32`

**Step 8: Commit**

```bash
git add -A
git commit -m "infra: switch to kt-central-db, remove local PG container"
```

---

### Task 2: Dockerize the application (single container)

**Files:**
- Create: `Dockerfile` (project root)
- Create: `docker-compose.prod.yml` (project root)
- Create: `.dockerignore` (project root)
- Modify: `apps/server/src/index.ts` (add static file serving + health check)
- Modify: `packages/env/src/server.ts` (add PORT env var)

**Step 1: Create .dockerignore**

```
node_modules
.git
*.md
docs
apps/fumadocs
.claude
.turbo
packages/db/drizzle
```

**Step 2: Modify Hono server to serve SPA static files + health check**

In `apps/server/src/index.ts`, add after all API routes but before the default handler:

```typescript
import { serveStatic } from "hono/bun";

// Health check for Docker
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve static files from the web build (production only)
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./public" }));
  // SPA fallback: serve index.html for any unmatched route
  app.get("/*", serveStatic({ path: "./public/index.html" }));
}
```

Remove the existing `app.get("/", ...)` handler.

**Step 3: Add PORT to server env**

In `packages/env/src/server.ts`, add:
```typescript
PORT: z.coerce.number().default(3000),
```

In `apps/server/src/index.ts`, update the export:
```typescript
export default {
  port: env.PORT,
  fetch: app.fetch,
};
```

Wait — check if Hono/Bun already uses this pattern. The current `export default app` may need to become:
```typescript
export default {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  fetch: app.fetch,
};
```

**Step 4: Create Dockerfile**

```dockerfile
# Stage 1: Install and build
FROM oven/bun:1 AS builder

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

RUN bun install --frozen-lockfile

# Copy source
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/
COPY packages/ packages/

# Build web SPA
RUN cd apps/web && bun run build

# Build server
RUN cd apps/server && bun run build

# Stage 2: Production runtime
FROM oven/bun:1-slim

WORKDIR /app

# Copy server build
COPY --from=builder /app/apps/server/dist/ ./dist/

# Copy SPA build (client-side files)
COPY --from=builder /app/apps/web/build/client/ ./public/

# Copy package.json for bun to read
COPY --from=builder /app/apps/server/package.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/index.mjs"]
```

**Step 5: Create docker-compose.prod.yml**

```yaml
name: bettencourt-pos

services:
  app:
    build: .
    container_name: kt-bettencourt-pos
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://postgres:PASSWORD@kt-central-db:5432/bettencourt_pos
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: https://pos.bettencourt.gy
      CORS_ORIGIN: https://pos.bettencourt.gy
    networks:
      - kt-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.bettencourt-pos.rule=Host(`pos.bettencourt.gy`)"
      - "traefik.http.routers.bettencourt-pos.entrypoints=websecure"
      - "traefik.http.routers.bettencourt-pos.tls.certresolver=letsencrypt"
      - "traefik.http.services.bettencourt-pos.loadbalancer.server.port=3000"

networks:
  kt-network:
    external: true
```

Ask the user for:
- The actual domain (or adjust to their Traefik config)
- Whether they use `letsencrypt` certresolver or something else
- The actual postgres PASSWORD

**Step 6: Test Docker build locally**

```bash
docker build -t bettencourt-pos:latest .
```

**Step 7: Commit**

```bash
git add Dockerfile docker-compose.prod.yml .dockerignore
git add apps/server/src/index.ts packages/env/src/server.ts
git commit -m "infra: Dockerize app with single container for Traefik"
```

---

### Task 3: Global error boundary

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`
- Modify: `apps/web/src/routes/dashboard.tsx`

**Step 1: Create error boundary component**

```tsx
import { useRouteError, isRouteErrorResponse, Link } from "react-router"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export function ErrorBoundary() {
  const error = useRouteError()

  let title = "Something went wrong"
  let message = "An unexpected error occurred."

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    message = error.data?.message || "The page you requested could not be found."
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Wire into dashboard layout route**

In `apps/web/src/routes/dashboard.tsx`, add:
```typescript
import { ErrorBoundary } from "@/components/error-boundary"
export { ErrorBoundary }
```

React Router will use this as the error boundary for all dashboard child routes.

**Step 3: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx apps/web/src/routes/dashboard.tsx
git commit -m "feat: add global error boundary for dashboard routes"
```

---

## Batch 2: RBAC + Context Enrichment (Tasks 4-5)

### Task 4: Enrich oRPC context with user permissions

**Files:**
- Modify: `packages/api/src/context.ts`
- Create: `packages/api/src/lib/permissions.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Create permissions helper**

`packages/api/src/lib/permissions.ts`:

```typescript
import { db } from "@Bettencourt-POS/db";
import { eq } from "drizzle-orm";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import type { Context } from "../context";

// Permission format in DB: { "orders": ["create", "read", "void"], "products": ["read"] }
export type Permissions = Record<string, string[]>;

export async function loadUserPermissions(userId: string): Promise<Permissions> {
  const roles = await db
    .select({
      permissions: schema.customRole.permissions,
    })
    .from(schema.userRole)
    .innerJoin(schema.customRole, eq(schema.userRole.roleId, schema.customRole.id))
    .where(eq(schema.userRole.userId, userId));

  // Merge permissions from all roles
  const merged: Permissions = {};
  for (const role of roles) {
    const perms = role.permissions as Permissions;
    for (const [resource, actions] of Object.entries(perms)) {
      if (!merged[resource]) merged[resource] = [];
      for (const action of actions) {
        if (!merged[resource].includes(action)) {
          merged[resource].push(action);
        }
      }
    }
  }
  return merged;
}

/**
 * Check if permissions include the required permission.
 * Format: "resource.action" e.g. "orders.void", "products.read"
 */
export function hasPermission(permissions: Permissions, required: string): boolean {
  const [resource, action] = required.split(".");
  if (!resource || !action) return false;
  return permissions[resource]?.includes(action) ?? false;
}
```

**Step 2: Enrich context**

In `packages/api/src/context.ts`, extend to load permissions:

```typescript
import { auth } from "@Bettencourt-POS/auth";
import type { Context as HonoContext } from "hono";
import { loadUserPermissions, type Permissions } from "./lib/permissions";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });

  let userPermissions: Permissions = {};
  if (session?.user?.id) {
    userPermissions = await loadUserPermissions(session.user.id);
  }

  return {
    session,
    userPermissions,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

**Step 3: Create requirePermission middleware**

In `packages/api/src/index.ts`, add:

```typescript
import { hasPermission } from "./lib/permissions";

export function requirePermission(permission: string) {
  return o.middleware(async ({ context, next }) => {
    if (!context.session?.user) {
      throw new ORPCError("UNAUTHORIZED");
    }
    if (!hasPermission(context.userPermissions, permission)) {
      throw new ORPCError("FORBIDDEN", {
        message: `Missing permission: ${permission}`,
      });
    }
    return next({ context });
  });
}
```

**Step 4: Commit**

```bash
git add packages/api/src/lib/permissions.ts packages/api/src/context.ts packages/api/src/index.ts
git commit -m "feat: RBAC context enrichment and requirePermission middleware"
```

---

### Task 5: Apply RBAC to all oRPC routers

**Files:**
- Modify: `packages/api/src/routers/pos.ts`
- Modify: `packages/api/src/routers/orders.ts`
- Modify: `packages/api/src/routers/products.ts`
- Modify: `packages/api/src/routers/categories.ts`
- Modify: `packages/api/src/routers/inventory.ts`
- Modify: `packages/api/src/routers/kitchen.ts`
- Modify: `packages/api/src/routers/cash.ts`
- Modify: `packages/api/src/routers/production.ts`
- Modify: `packages/api/src/routers/reports.ts`
- Modify: `packages/api/src/routers/audit.ts`
- Modify: `packages/api/src/routers/settings.ts`
- Modify: `packages/api/src/routers/reconciliation.ts`

**Permission mapping per procedure:**

| Router | Procedure | Permission |
|--------|-----------|------------|
| pos | getProducts | orders.read |
| pos | getModifiers | orders.read |
| pos | checkout | orders.create |
| orders | list | orders.read |
| orders | getById | orders.read |
| orders | void | orders.void |
| orders | refund | orders.refund |
| products | list | products.read |
| products | getById | products.read |
| products | create | products.create |
| products | update | products.update |
| products | delete | products.delete |
| categories | list | departments.read |
| categories | create | departments.create |
| categories | update | departments.update |
| categories | delete | departments.delete |
| inventory | getStockLevels | inventory.read |
| inventory | getLedger | inventory.read |
| inventory | createStockCount | inventory.create |
| inventory | createPurchaseOrder | inventory.create |
| inventory | createTransfer | inventory.create |
| kitchen | getActive | orders.read |
| kitchen | updateStatus | orders.update |
| cash | getSessions | shifts.read |
| cash | openSession | shifts.create |
| cash | closeSession | shifts.update |
| cash | createDrop | shifts.create |
| cash | createPayout | shifts.create |
| production | getEntries | orders.read |
| production | createEntry | orders.update |
| reports | getReport | reports.read |
| audit | list | audit.read |
| settings | * | settings.read or settings.update |
| reconciliation | getDailyReport | reports.read |

**Step 1: Add requirePermission import to each router**

In each router file, change:
```typescript
import { protectedProcedure } from "../index";
```
to:
```typescript
import { protectedProcedure, requirePermission } from "../index";
```

**Step 2: Add `.use(requirePermission(...))` to each procedure**

Example for orders.ts:
```typescript
const list = protectedProcedure
  .use(requirePermission("orders.read"))
  .input(...)
  .handler(...)

const voidOrder = protectedProcedure
  .use(requirePermission("orders.void"))
  .input(...)
  .handler(...)
```

Apply the permission mapping table above to every procedure across all 12 router files.

**Step 3: Verify build**

```bash
bun run check-types
bun run build
```

**Step 4: Commit**

```bash
git add packages/api/src/routers/
git commit -m "feat: enforce RBAC on all oRPC procedures"
```

---

## Batch 3: oRPC Client Wiring (Tasks 6-9)

### Task 6: Wire POS components to oRPC

**Files:**
- Modify: `apps/web/src/components/pos/pos-terminal.tsx`
- Modify: `apps/web/src/components/pos/modifier-dialog.tsx`

**Step 1: Replace SWR with oRPC in pos-terminal.tsx**

Remove:
```typescript
import useSWR from "swr"
const fetcher = (url: string) => fetch(url).then((r) => r.json())
const { data: posData, isLoading } = useSWR(productUrl, fetcher)
```

Replace with:
```typescript
import { orpc } from "@/utils/orpc"

const { data: posData, isLoading } = orpc.pos.getProducts.useQuery({
  input: {
    registerId: selectedRegister,
    departmentId: selectedDepartment !== "all" ? selectedDepartment : undefined,
  },
})
```

**Step 2: Replace checkout fetch with oRPC mutation**

Remove the raw `fetch("/api/pos/checkout", ...)` call. Replace with:
```typescript
const checkoutMutation = orpc.pos.checkout.useMutation({
  onSuccess: () => {
    // Invalidate kitchen, orders, dashboard queries
    queryClient.invalidateQueries({ queryKey: ["kitchen"] })
    queryClient.invalidateQueries({ queryKey: ["orders"] })
  },
})
```

Use `checkoutMutation.mutateAsync(...)` in the checkout handler.

**Step 3: Replace modifier fetch in modifier-dialog.tsx**

Same pattern — replace `useSWR` or `fetch` with `orpc.pos.getModifiers.useQuery(...)`.

**Step 4: Verify POS page loads**

```bash
bun run build
```

**Step 5: Commit**

```bash
git add apps/web/src/components/pos/
git commit -m "feat: wire POS components to oRPC client"
```

---

### Task 7: Wire orders, cash, and production components to oRPC

**Files:**
- Modify: `apps/web/src/components/orders/orders-table.tsx`
- Modify: `apps/web/src/routes/dashboard.cash.tsx`
- Modify: `apps/web/src/components/cash/cash-control-panel.tsx`
- Modify: `apps/web/src/components/production/production-tracker.tsx`

**Step 1: orders-table.tsx**

Replace `useSWR("/api/orders", fetcher)` with:
```typescript
const { data: orders, isLoading } = orpc.orders.list.useQuery({ input: {} })
```

Replace void/refund fetch calls with:
```typescript
const voidMutation = orpc.orders.void.useMutation({
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
})
const refundMutation = orpc.orders.refund.useMutation({
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
})
```

**Step 2: dashboard.cash.tsx + cash-control-panel.tsx**

Replace the `useEffect` + `fetch("/api/cash")` in `dashboard.cash.tsx` with:
```typescript
const { data: cashData, isLoading } = orpc.cash.getSessions.useQuery({ input: {} })
```

Replace fetch calls in `cash-control-panel.tsx` (openShift, closeShift, drop, payout) with corresponding `orpc.cash.*.useMutation()`.

**Step 3: production-tracker.tsx**

Replace `useSWR` with `orpc.production.getEntries.useQuery(...)`.
Replace `fetch("/api/production", { method: "POST" ... })` with `orpc.production.createEntry.useMutation(...)`.

**Step 4: Verify build**

```bash
bun run build
```

**Step 5: Commit**

```bash
git add apps/web/src/components/orders/ apps/web/src/routes/dashboard.cash.tsx
git add apps/web/src/components/cash/ apps/web/src/components/production/
git commit -m "feat: wire orders, cash, production components to oRPC"
```

---

### Task 8: Wire inventory components to oRPC

**Files:**
- Modify: `apps/web/src/components/inventory/stock-levels.tsx`
- Modify: `apps/web/src/components/inventory/stock-ledger.tsx`
- Modify: `apps/web/src/components/inventory/purchase-orders.tsx`
- Modify: `apps/web/src/components/inventory/transfers-list.tsx`
- Modify: `apps/web/src/components/inventory/stock-counts.tsx`

**Step 1: Replace SWR in each inventory component**

Each file follows the same pattern:
- Remove `import useSWR from "swr"` and the fetcher
- Add `import { orpc } from "@/utils/orpc"`
- Replace `useSWR("/api/inventory/...", fetcher)` with the corresponding `orpc.inventory.*.useQuery(...)`
- Replace any `fetch("/api/inventory/...", { method: "POST" ... })` with `orpc.inventory.*.useMutation(...)`

Mapping:
| Component | Query | Mutations |
|-----------|-------|-----------|
| stock-levels | `inventory.getStockLevels` | — |
| stock-ledger | `inventory.getLedger` | — |
| purchase-orders | `inventory.listPurchaseOrders` | `inventory.createPurchaseOrder` |
| transfers-list | `inventory.listTransfers` | `inventory.createTransfer` |
| stock-counts | `inventory.listStockCounts` | `inventory.createStockCount` |

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add apps/web/src/components/inventory/
git commit -m "feat: wire inventory components to oRPC"
```

---

### Task 9: Wire reports and reconciliation to oRPC, remove SWR

**Files:**
- Modify: `apps/web/src/components/reports/reports-dashboard.tsx`
- Modify: `apps/web/src/components/reconciliation/reconciliation-dashboard.tsx`
- Modify: `apps/web/package.json` (remove swr dependency)

**Step 1: reports-dashboard.tsx**

Replace `useSWR` with `orpc.reports.getReport.useQuery({ input: { type: selectedTab } })`.

**Step 2: reconciliation-dashboard.tsx**

Replace `useSWR` / fetch with `orpc.reconciliation.getDailyReport.useQuery({ input: { date } })`.

**Step 3: Remove SWR dependency**

```bash
cd apps/web
bun remove swr
```

**Step 4: Verify no SWR imports remain**

```bash
rg "useSWR|from .swr" apps/web/src/
```
Expected: no matches.

**Step 5: Verify build**

```bash
bun run build
```

**Step 6: Commit**

```bash
git add apps/web/src/components/reports/ apps/web/src/components/reconciliation/
git add apps/web/package.json
git commit -m "feat: wire reports & reconciliation to oRPC, remove SWR"
```

---

## Batch 4: SSE Kitchen Display + PIN Auth (Tasks 10-12)

### Task 10: SSE Kitchen Display — Server Side

**Files:**
- Create: `packages/api/src/lib/event-bus.ts`
- Modify: `apps/server/src/index.ts` (add SSE endpoint)
- Modify: `packages/api/src/routers/pos.ts` (emit event on checkout)
- Modify: `packages/api/src/routers/kitchen.ts` (emit event on status change)

**Step 1: Create in-memory event bus**

`packages/api/src/lib/event-bus.ts`:

```typescript
type Listener = (event: string, data: unknown) => void;

class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: string, data: unknown) {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }
}

export const kitchenBus = new EventBus();
```

**Step 2: Add SSE endpoint to Hono server**

In `apps/server/src/index.ts`, add before the RPC handler:

```typescript
import { streamSSE } from "hono/streaming";
import { kitchenBus } from "@Bettencourt-POS/api/lib/event-bus";

app.get("/api/kitchen/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = kitchenBus.subscribe((event, data) => {
      stream.writeSSE({ event, data: JSON.stringify(data) });
    });

    // Keep alive every 30s
    const keepAlive = setInterval(() => {
      stream.writeSSE({ event: "ping", data: "" });
    }, 30000);

    stream.onAbort(() => {
      unsubscribe();
      clearInterval(keepAlive);
    });

    // Block until client disconnects
    await new Promise(() => {});
  });
});
```

**Step 3: Emit events from checkout and kitchen router**

In `packages/api/src/routers/pos.ts`, after successful checkout:
```typescript
import { kitchenBus } from "../lib/event-bus";
// ... after inserting kitchen ticket:
kitchenBus.emit("new-order", { orderId: order.id, orderNumber });
```

In `packages/api/src/routers/kitchen.ts`, after status update:
```typescript
import { kitchenBus } from "../lib/event-bus";
// ... after updating status:
kitchenBus.emit("status-change", { ticketId: input.id, status: input.status });
```

**Step 4: Commit**

```bash
git add packages/api/src/lib/event-bus.ts apps/server/src/index.ts
git add packages/api/src/routers/pos.ts packages/api/src/routers/kitchen.ts
git commit -m "feat: SSE kitchen event bus and stream endpoint"
```

---

### Task 11: SSE Kitchen Display — Client Side

**Files:**
- Modify: `apps/web/src/routes/dashboard.kitchen.tsx`

**Step 1: Replace polling with SSE + oRPC**

Rewrite `dashboard.kitchen.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from "react"
import { orpc, queryClient } from "@/utils/orpc"
import { env } from "@Bettencourt-POS/env/web"
// ... keep all existing UI imports and interfaces

export default function KitchenPage() {
  const { data: orders = [], isLoading } = orpc.kitchen.getActive.useQuery({
    input: {},
  })

  const updateStatusMutation = orpc.kitchen.updateStatus.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen"] })
    },
  })

  // SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`${env.VITE_SERVER_URL}/api/kitchen/stream`)

    eventSource.addEventListener("new-order", () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen"] })
    })

    eventSource.addEventListener("status-change", () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen"] })
    })

    // Fallback: poll every 30s in case SSE drops
    const fallback = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["kitchen"] })
    }, 30000)

    eventSource.onerror = () => {
      // SSE reconnects automatically, but ensure fresh data on reconnect
      queryClient.invalidateQueries({ queryKey: ["kitchen"] })
    }

    return () => {
      eventSource.close()
      clearInterval(fallback)
    }
  }, [])

  async function updateStatus(id: string, status: string) {
    updateStatusMutation.mutate({ id, status })
  }

  // ... keep all existing render logic, using orders directly
  const pending = orders.filter((o: any) => o.status === "pending")
  const preparing = orders.filter((o: any) => o.status === "preparing")
  const ready = orders.filter((o: any) => o.status === "ready")

  // ... rest of JSX stays the same
}
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/dashboard.kitchen.tsx
git commit -m "feat: SSE-powered kitchen display with auto-fallback"
```

---

### Task 12: PIN Terminal Lock

**Files:**
- Create: `packages/api/src/routers/auth.ts`
- Modify: `packages/api/src/routers/index.ts` (add auth router)
- Modify: `packages/api/src/routers/settings.ts` (add setPin procedure)
- Create: `apps/web/src/components/pin-lock-screen.tsx`
- Modify: `apps/web/src/routes/dashboard.tsx` (add lock overlay)

**Step 1: Create auth router with verifyPin**

`packages/api/src/routers/auth.ts`:

```typescript
import { z } from "zod";
import { protectedProcedure } from "../index";
import { db } from "@Bettencourt-POS/db";
import { eq } from "drizzle-orm";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";

// In-memory rate limiter (per user)
const pinAttempts = new Map<string, { count: number; lockedUntil: number }>();

const verifyPin = protectedProcedure
  .input(z.object({ pin: z.string().min(4).max(6) }))
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id;

    // Check rate limit
    const attempts = pinAttempts.get(userId);
    if (attempts && attempts.lockedUntil > Date.now()) {
      const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: `Too many attempts. Try again in ${remaining}s`,
      });
    }

    // Get user's pin hash
    const [user] = await db
      .select({ pinHash: schema.user.pinHash })
      .from(schema.user)
      .where(eq(schema.user.id, userId));

    if (!user?.pinHash) {
      throw new ORPCError("BAD_REQUEST", { message: "PIN not set" });
    }

    // Verify PIN using Bun's built-in
    const valid = await Bun.password.verify(input.pin, user.pinHash);

    if (!valid) {
      const current = pinAttempts.get(userId) || { count: 0, lockedUntil: 0 };
      current.count++;
      if (current.count >= 3) {
        current.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 min lockout
        current.count = 0;
      }
      pinAttempts.set(userId, current);
      throw new ORPCError("UNAUTHORIZED", { message: "Invalid PIN" });
    }

    // Success — clear attempts
    pinAttempts.delete(userId);
    return { success: true };
  });

export const authRouter = { verifyPin };
```

**Step 2: Add setPin to settings router**

In `packages/api/src/routers/settings.ts`, add:

```typescript
const setPin = protectedProcedure
  .use(requirePermission("settings.update"))
  .input(z.object({
    userId: z.string().optional(), // admins can set for others
    pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must be numeric"),
  }))
  .handler(async ({ input, context }) => {
    const targetUserId = input.userId || context.session.user.id;

    // Only admins can set PINs for other users
    if (input.userId && input.userId !== context.session.user.id) {
      if (!hasPermission(context.userPermissions, "users.update")) {
        throw new ORPCError("FORBIDDEN");
      }
    }

    const pinHash = await Bun.password.hash(input.pin);
    await db
      .update(schema.user)
      .set({ pinHash })
      .where(eq(schema.user.id, targetUserId));

    return { success: true };
  });
```

Add `setPin` to the `settingsRouter` export.

**Step 3: Register auth router**

In `packages/api/src/routers/index.ts`, add:
```typescript
import { authRouter } from "./auth";
// In appRouter:
auth: authRouter,
```

**Step 4: Create PIN lock screen component**

`apps/web/src/components/pin-lock-screen.tsx`:

```tsx
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Lock, Delete } from "lucide-react"
import { orpc } from "@/utils/orpc"

interface PinLockScreenProps {
  userName: string
  onUnlock: () => void
  onLogout: () => void
}

export function PinLockScreen({ userName, onUnlock, onLogout }: PinLockScreenProps) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const verifyMutation = orpc.auth.verifyPin.useMutation()

  async function handleSubmit() {
    if (pin.length < 4) return
    setLoading(true)
    setError("")
    try {
      await verifyMutation.mutateAsync({ pin })
      onUnlock()
    } catch (e: any) {
      setError(e.message || "Invalid PIN")
      setPin("")
    } finally {
      setLoading(false)
    }
  }

  function handleDigit(d: string) {
    if (pin.length < 6) {
      const next = pin + d
      setPin(next)
      if (next.length >= 4) {
        // Auto-submit at 4+ digits
        setTimeout(() => {
          setPin(next)
          handleSubmit()
        }, 100)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 w-72">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="text-lg font-semibold text-center">{userName}</p>
          <p className="text-sm text-muted-foreground text-center">Enter PIN to unlock</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-colors ${
                i < pin.length ? "bg-primary border-primary" : "border-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-2">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key) => (
            <Button
              key={key}
              variant="outline"
              size="lg"
              className="h-14 w-14 text-lg font-mono"
              disabled={loading || key === ""}
              onClick={() => {
                if (key === "⌫") setPin((p) => p.slice(0, -1))
                else if (key !== "") handleDigit(key)
              }}
            >
              {key === "⌫" ? <Delete className="h-5 w-5" /> : key}
            </Button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
          Sign out instead
        </Button>
      </div>
    </div>
  )
}
```

**Step 5: Wire into dashboard layout**

In `apps/web/src/routes/dashboard.tsx`, add lock state:

```tsx
import { PinLockScreen } from "@/components/pin-lock-screen"
import { signOut } from "@/lib/auth-client"

// Inside DashboardLayout component:
const [locked, setLocked] = useState(false)

// Auto-lock after 10 min inactivity
useEffect(() => {
  if (!session?.user) return
  let timeout: ReturnType<typeof setTimeout>
  const reset = () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => setLocked(true), 10 * 60 * 1000)
  }
  window.addEventListener("mousemove", reset)
  window.addEventListener("keydown", reset)
  window.addEventListener("touchstart", reset)
  reset()
  return () => {
    clearTimeout(timeout)
    window.removeEventListener("mousemove", reset)
    window.removeEventListener("keydown", reset)
    window.removeEventListener("touchstart", reset)
  }
}, [session?.user])

// In render, before the main layout:
if (locked && session?.user) {
  return (
    <PinLockScreen
      userName={session.user.name || "User"}
      onUnlock={() => setLocked(false)}
      onLogout={() => signOut()}
    />
  )
}
```

Also add a manual lock button in the sidebar (keyboard shortcut: Ctrl+L).

**Step 6: Verify build**

```bash
bun run build
```

**Step 7: Commit**

```bash
git add packages/api/src/routers/auth.ts packages/api/src/routers/settings.ts
git add packages/api/src/routers/index.ts
git add apps/web/src/components/pin-lock-screen.tsx apps/web/src/routes/dashboard.tsx
git commit -m "feat: PIN terminal lock with auto-lock and number pad UI"
```

---

## Batch 5: Settings Page + Remaining Pages (Tasks 13-15)

### Task 13: Settings page UI (5 tabs)

**Files:**
- Modify: `apps/web/src/routes/dashboard.settings.tsx`

**Step 1: Build the 5-tab settings page**

Replace the stub with a full implementation using:
- `Tabs` / `TabsContent` for the 5 sections
- `orpc.settings.*` queries and mutations for all CRUD
- Form validation with zod

**Tab 1: Organization** — form with name, address, phone, logo URL. Uses `orpc.settings.getOrganization` / `orpc.settings.updateOrganization`.

**Tab 2: Locations & Registers** — table of registers, click to edit, department checkboxes. Uses `orpc.settings.getRegisters`, `orpc.settings.updateRegister`.

**Tab 3: Tax Rates** — table with add/edit dialog. `orpc.settings.getTaxRates`, `orpc.settings.createTaxRate`, `orpc.settings.updateTaxRate`.

**Tab 4: Users & Roles** — user table, role dropdown, PIN set/reset button, active toggle. Uses `orpc.settings.listUsers`, `orpc.settings.updateUser`, `orpc.settings.setPin`.

**Tab 5: Receipt Template** — textarea for header/footer, preview panel. Uses `orpc.settings.getLocation` / `orpc.settings.updateLocation`.

Each tab is its own sub-component within the file (or extracted if large).

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/dashboard.settings.tsx
git commit -m "feat: settings page with org, registers, tax, users, receipt tabs"
```

---

### Task 14: Wire reconciliation dashboard

**Files:**
- Modify: `apps/web/src/components/reconciliation/reconciliation-dashboard.tsx`

**Step 1: Replace fetch stubs with oRPC**

The component should already be partially wired from Task 9. Verify it loads data from `orpc.reconciliation.getDailyReport` and displays:
- Sales by department
- Payment method breakdown
- Cash session summary
- Variance calculation

If the component is still a stub, build out the full UI with summary cards and a breakdown table.

**Step 2: Commit**

```bash
git add apps/web/src/components/reconciliation/
git commit -m "feat: wire reconciliation dashboard to oRPC"
```

---

### Task 15: Table layout page

**Files:**
- Modify: `apps/web/src/routes/dashboard.tables.tsx` (if exists) or create a new route file

Check if a tables route exists. The v0 prototype had `/dashboard/tables` as a stub.

**Step 1: Create the route if needed**

Create `apps/web/src/routes/dashboard.tables.tsx` with:
- Grid of table cards from `table_layout` schema
- Status badges (available, occupied, reserved)
- Click to assign to current order
- Simple add/edit dialog for managing tables

**Step 2: Add to sidebar navigation**

Update `apps/web/src/components/layout/app-sidebar.tsx` to include the tables link.

**Step 3: Verify build**

```bash
bun run build
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/dashboard.tables.tsx apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat: table layout page with grid view and status"
```

---

## Batch 6: Final Verification (Task 16)

### Task 16: Full verification and cleanup

**Step 1: Verify no SWR/fetch patterns remain**

```bash
rg "useSWR|from .swr" apps/web/src/
rg "fetch\(./api/" apps/web/src/
```
Expected: no matches.

**Step 2: Verify TypeScript compiles**

```bash
bun run check-types
```

**Step 3: Verify build passes**

```bash
bun run build
```

**Step 4: Verify Docker build**

```bash
docker build -t bettencourt-pos:latest .
```

**Step 5: Verify dev servers start**

```bash
# Terminal 1
cd apps/server && bun run dev
# Terminal 2
cd apps/web && bun run dev
```

**Step 6: Manual smoke test**

- Visit http://localhost:5173
- Login with admin@bettencourt.com / password123
- Navigate all sidebar pages
- POS: load products, add to cart
- Kitchen: verify SSE connection (check Network tab)
- Settings: verify 5 tabs render
- Lock terminal (Ctrl+L), verify PIN screen appears

**Step 7: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup and verification for Plan #2"
```
