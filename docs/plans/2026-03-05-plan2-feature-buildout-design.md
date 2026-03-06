# Plan #2: Feature Build-out & Infrastructure — Design

## Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Database | Use `kt-central-db` (existing PG) | No wasted resources on separate container |
| Deployment | Single Docker container (Hono serves SPA + API) | Simple, one port for Traefik |
| KDS real-time | SSE (Server-Sent Events) | One-way push, Hono native support, simpler than WS |
| PIN auth | Terminal lock/unlock (not standalone login) | Quick shift handoff, session persists |
| RBAC | Procedure-level `requirePermission()` | Granular, matches existing permission matrix |
| Settings | 5 tabs: Org, Locations, Tax, Users, Receipt | Expandable as needs arise |

## Section 1: Infrastructure

### Database Switch
- `DATABASE_URL` → `postgresql://postgres:PASSWORD@kt-central-db:5432/bettencourt_pos`
- Remove `packages/db/docker-compose.yml`
- Stop `Bettencourt-POS-postgres` container
- Push schema to `kt-central-db`, re-seed

### Docker Deployment
- Multi-stage Dockerfile at project root
  - Stage 1: Install deps, build web SPA + server
  - Stage 2: Slim bun runtime, copy server dist + web static files
- Hono serves SPA at `/`, API at `/rpc`, auth at `/api/auth`
- `docker-compose.yml` on `kt-network` for Traefik
- Health check endpoint: `GET /health`
- Graceful shutdown on SIGTERM

## Section 2: oRPC Client Wiring

Replace `useSWR`/`fetch()` in 12 components with `orpc.*` hooks:

1. `pos-terminal.tsx` + `modifier-dialog.tsx`
2. `orders-table.tsx`
3. `cash-control-panel.tsx`
4. `stock-levels.tsx`, `stock-ledger.tsx`, `purchase-orders.tsx`, `transfers-list.tsx`, `stock-counts.tsx`
5. `reports-dashboard.tsx`
6. `reconciliation-dashboard.tsx`
7. `production-tracker.tsx`
8. `dashboard.kitchen.tsx` → SSE (Section 4)

Query pattern: `orpc.<router>.<procedure>.useQuery({ input })`
Mutation pattern: `orpc.<router>.<procedure>.useMutation()`

### Query Invalidation Cascade
- Checkout → invalidate kitchen, orders, dashboard
- Void/refund → invalidate orders, reports
- KDS status change → invalidate kitchen

### Optimistic Updates
- KDS status buttons: instant visual feedback, rollback on error
- Cart operations: immediate UI response

Remove `swr` dependency after migration.

## Section 3: RBAC Enforcement

### Middleware
```typescript
function requirePermission(permission: string) {
  return o.middleware(async ({ context, next }) => {
    const perms = context.userPermissions // loaded in context
    if (!hasPermission(perms, permission)) {
      throw new ORPCError("FORBIDDEN")
    }
    return next({ context })
  })
}
```

### Context Enrichment
Extend `createContext` to load user's permissions from `user_role` + `custom_role` tables once per request.

### Permission Strings
- pos: sell, discount, hold
- orders: view, void, refund
- products: view, manage
- inventory: view, manage
- cash: manage, close
- kitchen: view, manage
- production: manage
- reports: view, export
- settings: manage
- users: manage
- audit: view

## Section 4: SSE Kitchen Display

### Server
- Hono SSE endpoint: `GET /api/kitchen/stream`
- In-memory event bus (single process)
- Events: `new-order`, `status-change`, `order-served`
- Emitted from checkout and KDS mutation handlers

### Client
- `EventSource` connection in `dashboard.kitchen.tsx`
- Auto-reconnect with exponential backoff
- Falls back to 5s polling if SSE unavailable
- Status update buttons remain oRPC mutations

## Section 5: PIN Terminal Lock

### Schema
`pin_hash` column on `user` table (already exists).

### Flow
1. Normal email+password login → session created
2. Inactivity or manual lock → lock screen overlay
3. PIN entry → `auth.verifyPin` oRPC call
4. Success → unlock (session was never destroyed)
5. 3 failures → 5-minute lockout

### New Procedures
- `settings.setPin` — requires current password confirmation
- `auth.verifyPin` — bcrypt compare, rate-limited

## Section 6: Settings Page

### Tab 1: Organization
Edit name, address, phone, logo. Backed by `settings.getOrganization` / `settings.updateOrganization`.

### Tab 2: Locations & Registers
CRUD locations and registers. Department assignment matrix per register.

### Tab 3: Tax Rates
CRUD with "default" toggle. Only one default at a time.

### Tab 4: Users & Roles
User list, role assignment dropdown, PIN set/reset, active/inactive toggle.

### Tab 5: Receipt Template
Header/footer text fields, logo toggle, preview.

## Section 7: Remaining Pages

### Reconciliation Dashboard
Wire `reconciliation-dashboard.tsx` to `orpc.reconciliation.getDailyReport`.

### Table Layout
Simple grid view of `table_layout` records. Tap to select for order assignment. Basic implementation, expandable later.

## Enhancements

- **Global error boundary** on dashboard layout
- **Docker health check** at `GET /health`
- **Graceful shutdown** for SIGTERM in Docker
- **Optimistic updates** on KDS and cart
- **Query invalidation cascade** on checkout/void/refund
