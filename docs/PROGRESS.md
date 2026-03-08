# Bettencourt POS — Project Progress & History

This document tracks all plan phases and the current state of the system. Update it whenever significant work is completed.

**Last updated:** 2026-03-07

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

## Plan #4 — Security & Polish (COMPLETE — 2026-03-06)

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

### Phase 5: UI/UX Polish ✅

| Task | Status | Details |
|------|--------|---------|
| 5A: Welcome/onboarding cards | ✅ Done | Quick-start cards on dashboard: POS, Reports, Inventory, Customers |
| 5B: Empty states | ✅ Done | Verified all key pages have empty states with icon + message + action |
| 5C: Loading skeletons | ✅ Done | Orders, dashboard replaced plain "Loading..." with structured skeletons |
| 5D: POS UX audit | ✅ Done | Product buttons: hover shadow/brightness; dept badge: dashed border + "+" prefix |
| 5E: Consistent padding | ✅ Done | Customers page outer wrapper gets `p-4 md:p-6`; all pages verified |
| 5F: Breadcrumbs | ✅ Done | PAGE_TITLES map updated with all 14 missing routes |

### Phase 6: Functionality Gaps ✅

| Task | Status | Details |
|------|--------|---------|
| 6A: Clean migration files | ✅ Done | db:push workflow documented in PROGRESS.md; migration files retained as reference |
| 6B: Route permission map | ✅ Done | ROUTE_MODULE_MAP already complete; customers→orders, giftcards→orders, products→products |
| 6C: Delete confirmation dialogs | ✅ Done | Verified AlertDialog on loyalty tiers, products, customers, orders — all present |

### Phase 7: Build Verification & Deployment ✅

| Task | Status | Details |
|------|--------|---------|
| 7A: TypeScript check | ✅ Done | Zero errors — fixed loyalty.tsx, products.tsx, waste.tsx, hardware.ts, dashboard._index.tsx |
| 7B: Production build | ✅ Done | `bun run build` — 3/3 tasks successful, clean output |
| 7C: Re-seed database | ✅ Done | Seed runs cleanly with modifier groups, receipt config, tax rates |
| 7D: Docker build | ✅ Done | Full image rebuild successful (commit 8840dda) |
| 7E: Commit & push | ✅ Done | Pushed to origin/master; container live at pos.karetechsolutions.com |

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

## Plan #5 — Feature Gaps, Polish & Documentation (COMPLETE — 2026-03-06)

### Implemented

| Task | Status | Details |
|------|--------|---------|
| Recharts chart fix | ✅ Done | SVG fill with `hsl(var(...))` doesn't work; fixed with CSS class selector in index.css + `style={{}}` prop on tick |
| Split Bill in POS | ✅ Done | SplitBillDialog was orphaned (file existed, never imported); wired into ReceiptPreview post-checkout |
| Modifier min/max enforcement | ✅ Done | Already fully implemented in schema, router, and POS dialog; confirmed working |
| Manager auth override | ✅ Done | SupervisorOverrideDialog, useSupervisorOverride hook, settings.verifySupervisor — all pre-existing and working |
| No-sale drawer button | ✅ Done | Added "No Sale" button to CashControlPanel with dialog + reason field; logs to noSaleEvent table |
| Stock alert sidebar badge | ✅ Done | Live badge count on "Stock Alerts" nav item; polls every 60s via getAlerts with unacknowledgedOnly:true |
| Digital menu board | ✅ Done | /menu-board was already fully implemented; auto-scroll, fullscreen, 60s refresh |
| Online ordering | ✅ Done | /order was already fully implemented; pickup/delivery, cart, confirmation flow |
| PWA / offline support | ✅ Done | vite-plugin-pwa already configured with workbox caching strategies |
| Comprehensive user manual | ✅ Done | docs/USER-MANUAL.md rewritten — 1,195 lines covering all 37+ pages |
| SMS notifications | Skipped | User requested to skip for now |
| TypeScript: zero errors | ✅ Done | web app passes tsc --noEmit clean |
| Production build | ✅ Done | bun run build succeeds |
| Docker deploy | ✅ Done | Container healthy at pos.karetechsolutions.com |

---

## Future Feature Roadmap

**Priority 1 (High Impact):**
- SMS/WhatsApp order notifications to customers (was skipped in Plan #5)
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

---

## Plan #6 — Print Polish & Combo Check-Off Splitting (2026-03-07)

### Context

Client feedback (Shakira, WhatsApp): pointed to combo items in the Check Off screen ("Anyrice / Curry Beef", "Cookup Baked Snapper", "Fried Rice and Baked Chicken") and asked if they would be split for production tracking.

### Implemented

| Task | Status | Details |
|------|--------|---------|
| Print/PDF styling — global | ✅ Done | `@page { margin: 1.5cm 2cm }` added; CSS variable reset inside `@media print` forces light theme even in dark mode |
| Print header — P&L | ✅ Done | Two-column letterhead: company name/address left, report title/date/generated timestamp right |
| Print header — EOD | ✅ Done | Same two-column letterhead pattern |
| Print header — Production Report | ✅ Done | Was completely missing; added print-only header block + `print:hidden` on screen header |
| Print — Invoices | ✅ Done | List panel hidden in print; full-width letterhead inside card; "Bill To" label; print footer |
| Bug fix: Pastries filter | ✅ Done | `"pastries".includes("pastry")` → false; fixed with `isBakeryDept()` helper checking `"pastri"` prefix |
| Bug fix: workflow not saved | ✅ Done | `handleSubmit` in production-tracker.tsx was missing `workflow` in `createEntryMutation.mutate()` |
| Bug fix: dept pills showing all | ✅ Done | Department pills were built from all products; now built from `filteredProducts` (current workflow only) |
| Combo indicator on cards | ✅ Done | Combo products show amber `Layers` icon + "splits into components" badge instead of Package icon |
| Combo preview in dialog | ✅ Done | When a combo is selected, dialog shows live component breakdown (e.g. "Cookup × 5 / Baked Snapper × 5") that updates as quantity changes |
| Server-side combo expansion | ✅ Done | `createEntry` API checks `productProductionComponent` table; if components exist, creates one log entry per component instead of one for the combo |
| `listComboProductIds` endpoint | ✅ Done | New production router endpoint returns all product IDs that have component mappings — used to mark cards in the UI |
| USER-MANUAL.md updated | ✅ Done | Section 6 fully rewritten: workflow tabs, entry types, combo splitting explained in plain language |
| TypeScript check | ✅ Done | `tsc -b --noEmit` passes with zero errors |

### How combo splitting works end-to-end

1. Seed data maps combo products → components in `productProductionComponent` (e.g. "Fried Rice and Baked Chicken" → ["Fried Rice" ×1, "Baked Chicken" ×1])
2. Staff taps combo card in Check Off → dialog shows component preview → confirms
3. Server's `createEntry` detects component mappings and inserts separate `productionLog` rows for each component (using `productName = componentName`)
4. Production Report (`getReport`) builds `byProduct` keyed by `productName` — matches individual component log entries
5. Actual sold: POS combo sale also expands through `productProductionComponent` → `actualByName` accumulates "Fried Rice" and "Baked Chicken" sold counts
6. Variance = component actual sold − component production logged → report balances correctly

### Commit

`feat: print polish, check-off bug fixes, combo component splitting` (2026-03-07)

---

## Plan #7 — Comprehensive Codebase Audit & Bug Fix (2026-03-07)

### Context

Full 4-phase audit covering all critical, high, medium, and low priority issues found by static + runtime analysis of the entire codebase.

### Phase 1 — Critical Fixes ✅

| Task | Status | Details |
|------|--------|---------|
| 1A: modifiers.ts wrong WHERE | ✅ Done | `&&` → `and()` in `unlinkGroupFromProduct`; was deleting ALL modifier links for a group |
| 1B: reconciliation.ts SQL injection | ✅ Done | `sql.raw()` with interpolated UUID → parameterized `sql` template literal |
| 1C: checkout payment validation | ✅ Done | `payments.min(1)` in Zod schema; sum ≥ order total; reject zero/negative amounts |
| 1D: payment clamping / split tender | ✅ Done | Sequential balance allocator; sum ALL cash rows for cash session (not just first) |
| 1E: combo double-count in reports | ✅ Done | `isComponent` column on `order_line_item`; reports exclude component lines; KDS keeps them |
| 1F: EOD print (full page) | ✅ Done | Popup-based printing with dedicated print stylesheet |
| 1G: Production report print | ✅ Done | Same popup-based printing pattern |
| 1H: P&L print | ✅ Done | Same popup-based printing pattern |
| 1I: Reports dashboard print | ✅ Done | Same popup-based printing pattern |

### Phase 2 — High Priority Fixes ✅

| Task | Status | Details |
|------|--------|---------|
| 2A: Refund bounds validation | ✅ Done | Reject refund > order total; track cumulative refunded; idempotency guard |
| 2B: Kitchen SSE auth gate | ✅ Done | `/api/kitchen/events` requires authenticated session; returns 401 otherwise |
| 2C: Split-bill idempotency | ✅ Done | Delete prior pending payments in transaction before creating new set |
| 2D: Dead code removal | ✅ Done | Deleted header, sign-in-form, sign-up-form, loader, mode-toggle, user-menu, hardware.ts |

### Phase 3 — Medium Priority Fixes ✅

| Task | Status | Details |
|------|--------|---------|
| 3A: Gift cards race condition | ✅ Done | Atomic UPDATE ... WHERE balance >= amount; reject if insufficient balance |
| 3B: menu-schedules transaction | ✅ Done | Delete+insert wrapped in `db.transaction()` |
| 3C: Discount overnight window | ✅ Done | `startTime > endTime` → OR condition for overnight schedules |
| 3D: Audit log outside transaction | ✅ Done | `createAuditLog()` moved after `db.transaction()` commits |
| 3E: Cash session lifecycle | ✅ Done | Guard: one open session per register; close validates `open` status |
| 3F: Notification secrets masking | ✅ Done | `getSettings` returns `hasCredentials` + `accountSidMasked`; never full token |
| 3G: Notification test stub fix | ✅ Done | Test send fails explicitly when provider not configured |
| 3H: Missing onError handlers | ✅ Done | Added `toast.error()` to all silent mutations across kitchen, menu-schedules, products pages |
| 3I: Replace `confirm()` with AlertDialog | ✅ Done | 9 delete actions converted: customers, suppliers, expenses (×2), waste, webhooks, menu-schedules |
| 3J: Date handling (Guyana TZ) | ✅ Done | `todayGY()` used in discounts.tsx, settings.tsx |
| 3K: deleteRole NOT_FOUND | ✅ Done | Fetch role first; throw NOT_FOUND if missing |
| 3L: locations.ts permission check | ✅ Done | Changed to `permissionProcedure("settings.read")` |
| 3M: Reports weekly trend date params | ✅ Done | Date range filter applied to weekly trend SQL |
| 3N: online-order time parsing | ✅ Done | Guyana TZ-aware ISO 8601 string: `${date}T${time}:00-04:00` |
| 3O: cash.tsx hardcoded location | ✅ Done | Uses `useLocationContext()` from dashboard.tsx |
| 3P: notifications.tsx render state | ✅ Done | `setInitialized` moved into `useEffect` |
| 3Q: PAGE_TITLES / ROUTE_MODULE_MAP | ✅ Done | Removed bogus `/dashboard/users`; added `/dashboard/production` |

### Phase 4 — Low Priority Fixes ✅

| Task | Status | Details |
|------|--------|---------|
| 4A: ORPCError in online-order.ts | ✅ Done | All `throw new Error()` replaced with `throw new ORPCError()` with explicit HTTP codes |
| 4B: check-types pipeline | ✅ Done | `check-types` script added to `web` and `api` packages; turbo pipeline runs all 8 packages |
| 4C: turbo.json outputs | ✅ Done | Added `web#build` override with `build/**` + `.react-router/**` outputs |
| 4D: Biome linting excludes | ✅ Done | `.react-router` excluded from `files.includes` in biome.json |
| 4E: Composite indexes | ✅ Done | `(organizationId, createdAt)` on orders and expenses; `(customerId)` index on orders |
| 4F: Skeleton loaders | ✅ Done | 11 route files updated: discounts, locations, customers, menu-schedules, giftcards, audit, labels, timeclock, production-report, products, pos |
| 4G: productionLog.createdAt notNull | ✅ Done | Added `.notNull()` to schema; applied via db:push |
| 4H: order.tableId FK | ⏭ Skipped | No `dining_table` entity in schema; FK has no target |

### TypeScript & Build

- `bun run check-types`: 3/3 checked packages pass (api, server, web)
- `bun run build`: clean build
- `db:push`: all schema changes applied to DB

### Commit

`fix: comprehensive codebase audit — critical bugs, security, UX polish, schema fixes` (2026-03-07)

## Plan #8 — V2 Comprehensive Audit Fixes (COMPLETE — 2026-03-07)

Source: `docs/audits/2026-03-08-comprehensive-audit-handoff-v2.md`
Branch: `plan5/audit-fixes-v2`

### Wave 1 — Security Hardening ✅

| Task | Status | Details |
|------|--------|---------|
| B01: PIN banned check | ✅ Done | `isBanned` check with expiry; removed token from response body |
| B01: PIN uniqueness | ✅ Done | `.unique()` added to `pinHash` column in schema |
| B02: PIN rate-limit by IP | ✅ Done | Rate-limit key changed from hash to `x-forwarded-for`/`x-real-ip`; 60s lockout |
| B03b: Mask webhook secrets | ✅ Done | API never returns secret value; UI shows placeholder; only sends if user types new one |
| B04: Kitchen SSE permission | ✅ Done | Requires `orders.read` permission before streaming |
| B05: Server-side actor attribution | ✅ Done | Removed `userId`/`createdBy`/`authorizedBy` from all mutation inputs; derived from session |
| B06: HTML escaping in print templates | ✅ Done | `escapeHtml()` utility added; applied to orders + expenses print templates |
| B07: Checkout financial bounds | ✅ Done | `nonnegative()` prices, enum payment methods, clamped totals, per-payment change calc |

### Wave 2 — RBAC & Permission Normalization ✅

| Task | Status | Details |
|------|--------|---------|
| B08: settings.write normalization | ✅ Done | All `settings.write` → CRUD verbs across webhooks, locations, notifications |
| B09: Complete ROUTE_MODULE_MAP | ✅ Done | Added pos, orders, cash, kitchen, timeclock entries |
| B10: Unify mapRoleToSidebarRole | ✅ Done | Exported from `dashboard.tsx`, imported in `dashboard._index.tsx` |
| B11: Sidebar module allowlists | ✅ Done | WAREHOUSE_MODULES and ACCOUNTANT_MODULES verified/corrected |
| B12: Real user role to OrdersTable | ✅ Done | Passes `userProfile?.roleName` instead of hardcoded "admin" |
| B13: Customers permission module | ✅ Done | All customer procedures use `customers.*` instead of `orders.*` |
| B14: Cash/expense permission verbs | ✅ Done | `deleteExpenseCategory` → shifts.delete, `updateExpense` → shifts.update |
| B15: getCurrentUser merged permissions | ✅ Done | Returns merged permissions + organizationId from member table |
| B16: organizationId from session | ✅ Done | Wired to enable sidebar stock alert badge |

### Wave 3 — Stability & Code Quality ✅

| Task | Status | Details |
|------|--------|---------|
| B17: setState during render | ✅ Done | Wrapped in `useEffect` in settings, currency, loyalty pages |
| B19: Orders table stale state | ✅ Done | Removed `useState` wrapper; component uses prop directly |
| B20: Link vs anchor in sidebar | ✅ Done | Replaced `<a href>` with `<Link to>` for SPA navigation |
| B21: Hardcoded org/location IDs | ✅ Done | Removed from stock-alerts and cash; use context + session |
| B23: Partial unique index on cash sessions | ✅ Done | `uq_cash_session_open_register` filtered by `status = 'open'` |
| B24: Fumadocs check-types script | ✅ Done | Renamed `types:check` → `check-types` for Turbo pipeline |

### Wave 4 — Accessibility ✅

| Task | Status | Details |
|------|--------|---------|
| POS clickable badges | ✅ Done | Replaced `<Badge onClick>` with `<button type="button">` |
| POS nested button | ✅ Done | Used `<span role="button" tabIndex={0}>` with biome-ignore comment |
| PIN keypad backspace | ✅ Done | Added `aria-label="Backspace"` to both login + lock screen |
| Customer table rows | ✅ Done | Added `role="button"`, `tabIndex={0}`, `onKeyDown` handler |

### Wave 5 — Navigation Polish ✅

| Task | Status | Details |
|------|--------|---------|
| B: Sidebar label renames | ✅ Done | 7 labels renamed for clarity |
| B: Management group split | ✅ Done | 16-item group → Finance / Insights / System; old Finance → Billing |

### TypeScript & Build

- `bun run check-types`: 0 errors across all 8 packages
- `bun run build`: clean production build
- Docker: `kt-bettencourt-pos` rebuilt and running

### Commit

`feat: comprehensive security, RBAC, and UX audit fixes (Plan #5)` (2026-03-07)

## Plan #9 — Deferred & Premium Features (COMPLETE — 2026-03-08)

Source: `docs/plans/2026-03-08-v2-deferred-and-premium.md`
Branch: `plan9/deferred-premium`

### Wave 1 — Bug Fixes ✅

| Task | Status | Details |
|------|--------|---------|
| B18: Split bill custom amounts | ✅ Done | `splitCustom` API procedure added; frontend wired to use it (was incorrectly calling `splitEqual`) |
| B03 notifications creds | ✅ Done | `updateSettings` guards against clearing credentials when input is empty/masked |
| Atomic user creation | ✅ Done | `createUser` now runs user + member + userRole inserts in a DB transaction |
| User form dynamic roles | ✅ Done | Create-user form uses `roleId` UUID with dynamic role select from DB instead of static system roles |

### Wave 2 — Nav Alignment ✅

| Task | Status | Details |
|------|--------|---------|
| Rename POS Terminal | ✅ Done | "POS Terminal" → "New Sale" in sidebar and PAGE_TITLES |
| Merge Restaurant + Staff | ✅ Done | Combined into "Operations" group; Time Clock moved from standalone Staff |
| Currency to System | ✅ Done | Currency nav item moved from Finance → System group |
| Discounts to Finance | ✅ Done | Discounts nav item moved from Customers → Finance group |

### Wave 3 — Premium Features ✅

| Task | Status | Details |
|------|--------|---------|
| Webhook event center | ✅ Already done | `DeliveryLog` component with expandable payload/response rows was complete in Plan #8 |
| Global Ctrl+K command palette | ✅ Done | `command-palette.tsx` component; permission-aware; wired to dashboard layout |

### TypeScript & Build

- `bun run check-types`: 0 errors
- `bun run build`: clean production build
- Docker: `kt-bettencourt-pos` rebuilt and running

### Commit

`feat: Plan #9 deferred & premium features` (2026-03-08)

## Plan #10 — Final Audit Closure (COMPLETE — 2026-03-08)

Source: `docs/audits/2026-03-08-comprehensive-audit-handoff-v2.md`
Branch: `plan10/final-audit`

### B03 — Secrets Encrypted at Rest ✅

| Item | Details |
|------|---------|
| `packages/api/src/lib/crypto.ts` | AES-256-GCM `encrypt`/`decrypt`/`isEncrypted`; `enc:v1:iv:ciphertext:authTag` format |
| Backward compatibility | Legacy plaintext values pass through `decrypt()` unchanged |
| `packages/env/src/server.ts` | `SECRET_ENCRYPTION_KEY` (min 32 chars) added to env schema |
| Webhooks router | Secret encrypted on create/update |
| Webhooks dispatch lib | Secret decrypted before HMAC signing |
| Notifications router | `accountSid`/`authToken` encrypted on write; decrypted before masking display |

### B09 — Route Default-Deny ✅

| Item | Details |
|------|---------|
| `apps/web/src/lib/route-access.ts` | Extracted `ROUTE_MODULE_MAP` + `hasRouteAccess` for testability |
| `dashboard.tsx` | Imports from route-access module; fallback changed from `return true` → `return pathname === "/dashboard"` |
| Effect | Any `/dashboard/*` route not in the map now returns 403 instead of passing through |

### Test Suite ✅

| File | Tests | Coverage |
|------|-------|---------|
| `packages/api/src/__tests__/crypto.test.ts` | 8 | AES round-trip, unique IV, legacy passthrough, malformed detection |
| `packages/api/src/__tests__/permissions.test.ts` | 7 | RBAC matrix, cashier vs admin, edge cases |
| `apps/web/src/__tests__/route-access.test.ts` | 17 | Default-deny, all mapped routes, sub-paths, role boundaries |
| `apps/web/src/__tests__/escape-html.test.ts` | 9 | XSS payloads, all 5 HTML special chars, null/undefined |
| `apps/server/src/__tests__/pin-auth.test.ts` | 10 | Banned state logic, rate-limiter state machine |
| **Total** | **47** | **0 failures** |

### Infrastructure
- `turbo.json`: `test` task added to pipeline
- `package.json` (root, api, web, server): `"test": "bun test"` scripts added
- `packages/api/src/lib/has-permission.ts`: pure zero-dep function, enables testing without env validation

### TypeScript & Build
- `bun run check-types`: 0 errors
- `bun run build`: clean production build
- Docker: `kt-bettencourt-pos` rebuilt with `SECRET_ENCRYPTION_KEY` in env

### Commits
- `feat: Plan #10 — final audit closure (encryption, route deny, test suite)` (2026-03-08)

## Plan #11 — Future-Proof Hardening (IN PROGRESS — 2026-03-08)

### Worktree / Branch State
- `master` and `origin/master` verified in sync before this pass (`ahead/behind = 0/0`).
- Local worktree remains intentionally dirty while final hardening changes are being batched.

### Completed in this pass
- Added DB-backed PIN rate-limit state with in-memory fallback if the limiter table is missing:
  - `apps/server/src/pin-rate-limit.ts`
  - `apps/server/src/pin-rate-limit-state.ts`
  - `apps/server/src/index.ts` now uses shared limiter helpers
  - `packages/db/src/schema/auth.ts` adds `pin_login_rate_limit` schema
  - `packages/db/src/migrations/0008_pin_login_rate_limit.sql`
- Added focused rate-limit state tests:
  - `apps/server/src/__tests__/pin-rate-limit.test.ts`
- Fixed server test duplication issue (compiled `dist` tests being re-run) by narrowing the test glob:
  - `apps/server/package.json` → `bun test ./src/__tests__/*.test.ts`
- Hardened CI gates:
  - `.github/workflows/ci.yml` now runs `bun run test` and `bun run build` in the check job
  - Deploy job now verifies public FQDN health at `https://pos.karetechsolutions.com/health`

### Verification
- `bun run check-types`: pass
- `bun run test`: pass
- `bun run build`: pass
