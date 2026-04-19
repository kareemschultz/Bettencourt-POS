# Bettencourt POS V3 — Implementation Plan

> **Current status:** Scaffolded 2026-04-17. V3 is at `/home/karetech/projects/bettencourt-pos-v3/`. V1 stays live at `kt-bettencourt-pos` on Vultr throughout.

---

## What changes / What doesn't

| Stays the same | Changes |
|---|---|
| `Bettencourt-POS/apps/server` (Bun + Hono backend) | Every frontend page/component |
| `Bettencourt-POS/packages/api` (oRPC router definitions) | Auth pages (Clerk removed, better-auth) |
| `Bettencourt-POS/packages/db` (Drizzle schema) | Layout shell (shadcn-admin template base) |
| Color scheme (amber/charcoal OKLCH) | Routing: React Router v7 to TanStack Router |
| Geist + Geist Mono fonts | Radius bumped 0.5rem to 0.75rem |

V3 is a **standalone Vite app** at `/home/karetech/projects/bettencourt-pos-v3/`. Calls the existing backend via `VITE_API_URL`. No monorepo wiring needed.

---

## Bootstrap (already done)

```bash
cd /home/karetech/projects/bettencourt-pos-v3
pnpm install
pnpm dev          # http://localhost:5173
```

Stack: React 19, Vite 8, TanStack Router v1, TanStack Query v5, Tailwind v4, shadcn/ui, Recharts v3, Zustand v5, Zod v4, Sonner, better-auth, @orpc/client + @orpc/tanstack-query.

---

## Color scheme (applied)

Bettencourt amber/charcoal palette in `src/styles/theme.css`. Same OKLCH vars as V1.
- Light: warm off-white bg + amber primary
- Dark: charcoal bg + bright amber primary
- Sidebar: always dark charcoal
- Accent: deep terracotta for badges and CTAs
- `--radius: 0.75rem`

---

## Sidebar navigation groups

POS: Terminal, Orders, Tables, Waitlist, Reservations, Kitchen
Products: Products, Categories, Modifiers, Inventory, Pricelists, Menu Schedules, Labels, Stock Alerts
Finance: Dashboard, Invoices, Quotations, Credit Notes, Recurring, Vendor Bills, Expenses, Budgets, Journal, P&L, Tax Summary, Aging, Profitability
Customers: Customers, Loyalty, Gift Cards, Feedback, Statements, Analytics
Reports: Overview, Analytics, Financial Reports, Variance, Production Report, Waste, EOD, Voids
Staff: Shifts, Timeclock, Labor, Tips
Settings: Settings, Printers, Locations, Currency, Webhooks, Audit Log, Backup, Profile

---

## Phase 0 — Foundation (COMPLETE)

- [x] Cloned shadcn-admin v2.2.1 (TanStack Router + Tailwind v4 + React 19)
- [x] Applied Bettencourt amber/charcoal palette to `src/styles/theme.css`
- [x] Bumped `--radius` to `0.75rem`
- [x] Swapped fonts to Geist + Geist Mono in `@theme inline`
- [x] Replaced Clerk with better-auth + oRPC client deps in `package.json`
- [x] Fresh git history

---

## Phase 1 — Auth + Layout Shell

Goal: Login works. Every route has the polished sidebar shell.

1. Remove Clerk: delete `src/routes/clerk/`, Clerk components
2. `src/lib/auth-client.ts` — better-auth createAuthClient() pointing to VITE_API_URL
3. `src/lib/orpc.ts` — oRPC client wired to VITE_API_URL/rpc
4. `src/lib/query-client.ts` — TanStack QueryClient setup
5. Auth routes: sign-in, forgot-password
6. Route guard: _authenticated/route.tsx redirects to /sign-in if no session
7. Sidebar nav: update with 7 nav groups
8. `.env.local`: VITE_API_URL=http://localhost:3000

Shared components (build once, use everywhere):
- DataTable (TanStack Table: sort, filter, paginate, row selection)
- StatsCard (metric + delta + sparkline)
- PageHeader (title + description + action slot)
- FilterBar (date range + status select + search)
- DetailSheet (Vaul drawer)
- ConfirmDialog (destructive confirmation)
- EmptyState (empty list placeholder)
- StatusBadge (order/invoice/shift status colors)
- CurrencyDisplay (GYD formatting)

---

## Phase 2 — POS Terminal (highest priority, ~4 days)

Port sub-components one at a time:
1. product-grid.tsx: category tabs, product cards (image/price/qty overlay)
2. cart-panel.tsx: line items, qty +/-, per-item notes, sticky totals footer
3. payment-dialog.tsx: cash/card/split tender, keypad, change calculator
4. receipt-preview.tsx: thermal receipt + auto-print via printClient
5. modifier-dialog, discount-dialog, split-bill-dialog, supervisor-override-dialog, tab-list-dialog
6. cart-store.ts (Zustand): items, addItem, removeItem, updateQty, applyDiscount, clear
7. pos/index.tsx: assembles everything

Keyboard shortcuts:
F1=search, F2=discount, F4=void last, F5=tabs, F8=reprint, F9=pay, F12=exact cash, Esc=close, NumpadEnter=confirm

---

## Phase 3 — Dashboard + Orders

Stats cards (daily revenue, orders, avg ticket, covers), hourly sparkline, top products, recent orders.
Orders DataTable: date range, status/type filters, search, expandable row, order detail drawer.

---

## Phase 4 — Products & Inventory

Products DataTable (bulk actions, stock badge, image preview), Categories, Modifiers.
Inventory tabs: Stock Levels, Counts, Transfers, Ledger, Purchase Orders.
Stock Alerts, Labels, Pricelists, Menu Schedules.

---

## Phase 5 — Finance

Invoices, Quotations, Credit Notes (DataTable + status + action sheet).
Recurring, Vendor Bills, Suppliers, Expenses, Budgets.
Journal, P&L, Tax Summary, Aging, Profitability (read-only views).

---

## Phase 6 — Reports & Analytics

Reports hub (card grid). Analytics (recharts: revenue trend, order type, hourly heatmap).
Financial reports, Variance, Waste, EOD, Voids, Production Report.
Customer Analytics, Customer Statements.

---

## Phase 7 — CRM + Staff

Customers list + detail sheet (orders, loyalty, statements).
Loyalty, Gift Cards, Feedback, Waitlist, Reservations.
Shifts (open/close, summary), Timeclock, Labor, Tips.
Cash management, Reconciliation.

---

## Phase 8 — Settings + Special Views

Settings (tabbed: Business Info, Receipt, Taxes, Appearance).
Printers, Locations, Currency, Webhooks, Audit Log, Backup, Profile.
Tables/Floor Plan editor (@dnd-kit/core).
KDS (/kds): dark full-screen, bump-to-complete.
Menu Board (/menu-board), Kiosk (/kiosk).
vite-plugin-pwa for offline support.

---

## oRPC wiring (Phase 1)

```ts
// src/lib/orpc.ts
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { AppRouter } from './types/app-router'

export const orpc = createORPCClient<AppRouter>(
  new RPCLink({ url: `${import.meta.env.VITE_API_URL}/rpc` })
)
```

---

## Deployment

1. pnpm build -> dist/
2. Nginx Docker container: serves dist/, proxies /rpc to kt-bettencourt-pos:3000
3. Pangolin staging: bettencourt-staging.karetechsolutions.com
4. Cutover: swap Pangolin target after Shakira signs off

---

## Risk items

| Risk | Mitigation |
|------|-----------|
| POS terminal complexity (~1800 lines in V1) | Port sub-components one at a time, 4-day budget |
| Floor plan editor (canvas) | Rebuild with @dnd-kit/core in Phase 8 |
| KDS WebSocket real-time | Copy ws.ts from V1, adapt to TanStack Router |
| Offline/PWA | Add vite-plugin-pwa in Phase 8 after core stable |
| TypeScript path to packages/api types | Copy generated router types or tsconfig paths alias |
