# Bettencourt POS — Project Progress & History

This document tracks all plan phases and the current state of the system. Update it whenever significant work is completed.

**Last updated:** 2026-03-06

---

## System Overview

- **Client:** Shakira (owner/operator, Bettencourt's Food Inc., Georgetown, Guyana)
- **Live URL:** https://pos.karetechsolutions.com
- **GitHub:** https://github.com/kareemschultz/Bettencourt-POS (private)
- **Tech:** React Router + Hono + Bun + oRPC + Drizzle + PostgreSQL + Better Auth
- **Database:** External PostgreSQL via Docker (`kt-central-db`)
- **Container:** `kt-bettencourt-pos` on the host, served via Pangolin reverse proxy

---

## Plan #1 — Migration from v0 (COMPLETE)

Migrated the initial v0 prototype to the Better-T-Stack monorepo structure.

- Set up Turborepo, packages (api, auth, db, env)
- Implemented oRPC with type-safe end-to-end API
- Set up Better Auth with organization + admin plugins
- Initial database schema

---

## Plan #2 — Feature Build-out (COMPLETE)

Built out all 7 waves of features across 29 routers and 35 pages.

**Routers (29):** auth, cash, customers, dashboard, expenses, gift-cards, inventory, invoices, kitchen, loyalty, modifiers, notifications, online-order, org, permissions, pos, production, products, purchase-orders, quotations, registers, reports, roles, settings, suppliers, tables, time-clock, users, webhooks

**Pages (35):** All dashboard routes from POS terminal through reports, settings, KDS, time clock, etc.

---

## Plan #3 — Production Readiness (COMPLETE)

Completed 2025-2026:

- **Phase 1 (RBAC):** Route guards, permission checking, role mapping for all 35 pages
- **Phase 2 (Search/Filter):** Search, filter, and date controls on all 8 key pages
- **Phase 3 (CRUD UI):** Categories + Modifiers tabs in Settings fully functional
- **Phase 4 (Mock Data):** 7,276-line seed.ts with comprehensive Guyanese restaurant data

**E2E Audit (March 2026):**
- All 13 pages visually verified
- 3 bugs fixed
- TypeScript: zero errors across web + server
- Accessibility: sr-only text, aria-labels, role=alert, aria-live on KDS
- Responsiveness: reviewed all viewport-dependent layouts

---

## Plan #4 — Security & Polish (IN PROGRESS — 2026-03-06)

### Phase 1: Security Hardening ✅

| Task | Status | Details |
|------|--------|---------|
| 1A: Gate demo-login | ✅ Done | Returns 404 when NODE_ENV=production |
| 1B: Fix pin-login password | ✅ Done | Uses auth.$context.internalAdapter.createSession (no hardcoded password) |
| 1C: Remove hardcoded secrets | ✅ Done | docker-compose.prod.yml uses ${DATABASE_URL}, ${BETTER_AUTH_SECRET} |
| 1D: Increase Docker limits | ✅ Done | 512MB memory, 1.0 CPU |

### Phase 2: Seed Data Fixes ✅

| Task | Status | Details |
|------|--------|---------|
| 2A: Fix Curry Chicken prices | ✅ Done | 3 line items fixed (2200→2000), order totals corrected |
| 2B: Modifier seed data | ✅ Done | 4 groups (Spice Level, Protein Add-on, Extras, Cook Style) + 13 modifiers |
| 2C: Receipt config | ✅ Done | Receipt config seeded for the organization |
| 2D: Tax rates on beverages | ✅ Done | 16% VAT on soft drinks, energy drinks, Vita Malt |
| 2E: Verify mock data | ✅ Done | All order statuses, inventory movements, gift cards, loyalty transactions present |

### Phase 3: Seed Script Refactoring ✅

| Task | Status | Details |
|------|--------|---------|
| 3A: Split structural/demo | ✅ Done | SEED_MODE check in seed.ts; structural=lines 1-1192, demo=1193+ |
| 3B: Production seed mode | ✅ Done | SEED_MODE=production stops after structural, creates admin with random password |
| 3C: Migration docs | ✅ Done | docs/PRODUCTION-MIGRATION.md |

### Phase 4: Documentation ✅

| Task | Status | Details |
|------|--------|---------|
| 4A: README | ✅ Done | README.md — tech stack, quickstart, scripts, structure |
| 4B: User manual | ✅ Done | docs/USER-MANUAL.md — Shakira-friendly guide for all features |
| 4C: Developer docs | ✅ Done | docs/DEVELOPER.md — architecture, patterns, setup |
| 4D: Progress tracker | ✅ Done | This file |

### Phase 5: UI/UX Polish (IN PROGRESS)

| Task | Status | Details |
|------|--------|---------|
| 5A: Welcome/onboarding cards | ⏳ Pending | |
| 5B: Empty states | ⏳ Pending | |
| 5C: Loading skeletons | ⏳ Pending | |
| 5D: POS UX audit | ⏳ Pending | |
| 5E: Consistent padding | ⏳ Pending | |
| 5F: Breadcrumbs | ⏳ Pending | |

### Phase 6: Functionality Gaps

| Task | Status | Details |
|------|--------|---------|
| 6A: Clean migration files | ⏳ Pending | |
| 6B: Route permission map | ⏳ Pending | |
| 6C: Delete confirmation dialogs | ⏳ Pending | |

### Phase 7: Build Verification & Deployment

| Task | Status | Details |
|------|--------|---------|
| 7A: TypeScript check | ⏳ Pending | Pre-existing errors in webhooks, inventory, kitchen, loyalty, etc. |
| 7B: Production build | ⏳ Pending | |
| 7C: Re-seed database | ⏳ Pending | |
| 7D: Docker build | ⏳ Pending | |
| 7E: Commit & push | ⏳ Pending | |

---

## Known Issues & Backlog

### Pre-existing TypeScript errors (to fix in Phase 7)

All follow the same pattern: `array[0]?.id` returning `string | undefined` but `eq()` expects `string`. Files affected:
- `packages/api/src/lib/webhooks.ts` (lines 75, 121, 134)
- `packages/api/src/routers/inventory.ts` (lines 538, 727)
- `packages/api/src/routers/kitchen.ts` (lines 134, 137, 143)
- `packages/api/src/routers/loyalty.ts` (lines 58, 210, 212, 222, 292, 296)
- `packages/api/src/routers/notifications.ts` (lines 107, 351)
- `packages/api/src/routers/online-order.ts` (lines 276, 298)
- `packages/api/src/routers/pos.ts` (lines 508, 538, 588)
- `packages/api/src/routers/products.ts` (line 193)
- `packages/api/src/routers/settings.ts` (line 460)

Fix: Replace `array[0]?.id` with `array[0]!.id` where `array.length > 0` has been checked.

### Schema tables without seed data (acceptable for demo)

34 tables are schema-only with no seed entries. These include webhooks, notification templates, quotations, invoices. They work when used but have no mock data.

---

## Future Feature Roadmap (Phase 5+)

From feature gap analysis of top POS systems:

**Priority 1 (High Impact):**
- Online ordering integration (order.bettencourts.com)
- SMS/WhatsApp order notifications to customers
- Table reservations
- Composite product cost tracking

**Priority 2:**
- Multi-location consolidated reporting
- Loyalty program app for customers
- Employee performance reports
- Supplier price comparison

**Priority 3:**
- Tauri desktop app (offline mode)
- Customer-facing order status display
- Advanced analytics dashboard
- Automated reorder alerts

**Priority 4:**
- Webhook integrations (accounting software)
- Invoice → QuickBooks sync
- API access for third-party integrations

---

## Visual Audit Findings (2026-03-07) — Additional Notes for Future Phases

### Minor Bugs / Future Improvements

| # | Page | Finding | Priority |
|---|------|---------|----------|
| 1 | Expenses | Two stat cards both labeled "Unassigned" — second card likely should have a different label (maybe "Uncategorized") | Low |
| 2 | Kitchen Display | Order #GT-018 showing "11h 29m ago" in Pending state — demo data issue, not cleared by kitchen staff | Low (demo data) |
| 3 | Dashboard Chart | Recharts CartesianChart renders with -1x-1 dimensions causing console warning — chart container needs min dimensions | Low |
| 4 | Orders | Void/Refund action buttons are very small (h-7, text-xs) for a frequently-used daily operation — consider larger buttons in a future redesign | Medium |
| 5 | Products page | "Add Product" button hidden off-screen in smaller viewports — button exists in code, viewport cuts it off | Low |
| 6 | POS Terminal | Some department badges (e.g. "Duck") appear truncated on narrow screens; `overflow-x-auto` works but UX could be improved with a dropdown for 5+ departments | Low |
| 7 | POS Terminal | Product names with "/" (e.g. "Anyrice / Curry Beef") look like two items — consider using "or" or parentheses | Low |
| 8 | Loyalty Leaderboard | No pagination — shows all 50 members in one scroll. Consider adding pagination for large member lists | Low |
