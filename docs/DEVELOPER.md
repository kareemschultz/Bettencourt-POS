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

## Code Quality

- **Linting/Formatting**: Biome (`bun run check`)
- **Type checking**: `bun run check-types`
- **Pre-commit hooks**: Husky + lint-staged run Biome on staged files
