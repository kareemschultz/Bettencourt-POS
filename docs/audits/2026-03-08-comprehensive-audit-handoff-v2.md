# Bettencourt POS Comprehensive Audit Handoff (Pass 2)

Date: 2026-03-08  
Author: Codex audit pass (verification-only, no code changes)  
Repository: Bettencourt-POS

## Purpose
This is the second comprehensive handoff for Claude. It focuses on what remains incomplete, cross-app inconsistencies, RBAC/CRUD gaps, admin-vs-cashier behavior, UI/UX polish opportunities, and premium roadmap recommendations.

## Scope
- Codebase-wide static review (`apps/web`, `apps/server`, `packages/api`, `packages/db`, CI/tooling)
- UX/navigation/accessibility review across dashboard flows
- Role and permission consistency review (sidebar, route gate, router guards)
- Verification run:
  - `bun run check-types` (pass)
  - `bun run build` (pass, with known docs/web build warnings)

## Pass 1 Progress Check (What Claude fixed)
The following were previously reported and are now improved:
- Modifier unlink condition uses `and(...)` correctly in `packages/api/src/routers/modifiers.ts:253`.
- Refund amount bounds + cumulative refund checks are implemented in `packages/api/src/routers/orders.ts:310-340`.
- Split-bill idempotency/cleanup is implemented via transaction + pending cleanup in `packages/api/src/routers/split-bill.ts:49-60` and `:171-181`.
- Combo reporting double-count protection is present (`is_component = false`) in report queries `packages/api/src/routers/reports.ts:83,103,187,200`.
- Notification test endpoint no longer fakes success; now returns explicit `NOT_IMPLEMENTED` in `packages/api/src/routers/notifications.ts:361-374`.

## Priority 0 (Critical Remaining)

### B01 - Critical - PIN login bypasses banned state and relies on non-unique PIN hashes
- Evidence:
  - PIN login query does not check `user.banned`: `apps/server/src/index.ts:62-70`.
  - Session is created directly via adapter: `apps/server/src/index.ts:88-96`.
  - `pin_hash` has no uniqueness constraint: `packages/db/src/schema/auth.ts:35`.
- Impact:
  - Deactivated users can still authenticate through PIN endpoint.
  - Duplicate PINs can resolve to arbitrary first matching user (`limit 1`), creating identity ambiguity.
- Recommendation:
  1. Enforce `banned = false` in PIN auth query.
  2. Enforce per-organization unique PIN hash (or unique PIN per active user scope).
  3. Do not expose session token in JSON response; set secure cookie only.

### B02 - Critical - PIN brute-force guard is ineffective
- Evidence:
  - Rate limit key is hashed PIN value, not actor/IP/account: `apps/server/src/index.ts:39,52-53,74-80`.
- Impact:
  - Attackers can bypass lockout by iterating PINs; lockout does not protect target identities.
- Recommendation:
  1. Rate-limit by IP + device fingerprint + username/session context.
  2. Add progressive lockout and centralized store (Redis), not in-memory map.

### B03 - Critical - Sensitive secrets still plaintext at rest and exposed in API/UI
- Evidence:
  - Notification credentials saved as plaintext: `packages/api/src/routers/notifications.ts:115-116,132-133`.
  - Schema itself indicates encryption not implemented: `packages/db/src/schema/notification.ts:88-89`.
  - Webhook endpoint secret returned in list/select-all and loaded into edit form:
    - API: `packages/api/src/routers/webhooks.ts:15-22`
    - UI: `apps/web/src/routes/dashboard.webhooks.tsx:191-206`
- Impact:
  - Secret exfiltration risk through UI/API responses and DB compromise.
- Recommendation:
  1. Encrypt secrets at rest.
  2. Return only masked indicators (`hasSecret`, last-4), never raw values.
  3. Add explicit rotation/regeneration flows and delivery-signature verification helper UI.

### B04 - Critical - Kitchen SSE endpoint lacks permission check
- Evidence:
  - Session check exists, permission check missing: `apps/server/src/index.ts:199-203`.
- Impact:
  - Any authenticated user can subscribe to kitchen event stream.
- Recommendation:
  1. Require explicit permission (`orders.read` at minimum, ideally `kitchen.read`).
  2. Scope events by location and assigned role.

### B05 - Critical - Client-supplied actor IDs are trusted for auditable operations
- Evidence:
  - Cash operations trust provided `userId/createdBy/authorizedBy`: `packages/api/src/routers/cash.ts:57-63,427-429,445-447`.
  - Orders void/refund trust `userId/authorizedBy` from input: `packages/api/src/routers/orders.ts:189-197,232-233,349`.
  - Inventory alert/waste actor IDs passed from UI; UI currently sends `"system"`:
    - `apps/web/src/routes/dashboard.stock-alerts.tsx:104,123`
    - `apps/web/src/routes/dashboard.waste.tsx:281`
- Impact:
  - Audit trails and accountability can be spoofed.
- Recommendation:
  1. Derive actor identity from `context.session.user.id` server-side.
  2. Remove actor IDs from public mutation inputs where possible.
  3. Store optional `onBehalfOf` only through explicit supervisor flow.

### B06 - Critical - Unsanitized HTML string printing can enable XSS in popup context
- Evidence:
  - Order print template interpolates user-supplied fields into raw HTML: `apps/web/src/components/orders/orders-table.tsx:174-223`.
  - Expenses print template does the same: `apps/web/src/routes/dashboard.expenses.tsx:80-127`.
- Impact:
  - Stored/scripted content could execute in same-origin popup window.
- Recommendation:
  1. Escape all dynamic fields before HTML interpolation.
  2. Prefer DOM node cloning (`importNode`) over raw template string generation.

### B07 - Critical - Checkout still allows invalid financial states in edge cases
- Evidence:
  - Throws generic error instead of typed API error: `packages/api/src/routers/pos.ts:329`.
  - `discountTotal` is unbounded; total can become negative (`total = subtotal + tax - discount`): `packages/api/src/routers/pos.ts:299-343`.
  - Change calculation uses full order total instead of remaining allocated cash in split cash cases: `packages/api/src/routers/pos.ts:459-467`.
- Impact:
  - Potential negative totals/incorrect payment records and inaccurate cash change accounting.
- Recommendation:
  1. Constrain `discountTotal` to `0..subtotal+tax`.
  2. Convert all remaining generic throws to `ORPCError`.
  3. Compute change from per-method remaining due, not global total.

## Priority 1 (High-Value Inconsistency and RBAC Gaps)

### B08 - High - Permission action model is inconsistent (`settings.write` vs CRUD)
- Evidence:
  - Routers require `settings.write`: `packages/api/src/routers/locations.ts:46,77,129`, `webhooks.ts:25,52,97,164`, `notifications.ts:91,165,193,226,318`.
  - Roles UI only models CRUD actions: `apps/web/src/routes/dashboard.settings.tsx:2710`.
  - Seed roles use CRUD for settings (no `write`): `packages/db/src/seed.ts:769,801,824`.
- Impact:
  - Legit admin/manager roles can hit unexpected 403 on settings mutations.
- Recommendation:
  1. Normalize action vocabulary globally.
  2. Add migration to map `write` <-> `update` consistently.

### B09 - High - Route guard map is incomplete and defaults to allow
- Evidence:
  - “Unlisted routes are accessible to all authenticated users”: `apps/web/src/routes/dashboard.tsx:116-117,162`.
  - Missing map entries include `/dashboard/pos`, `/dashboard/orders`, `/dashboard/cash`, `/dashboard/kitchen`, `/dashboard/timeclock`.
- Impact:
  - Access control behavior differs by page and depends on downstream API failures.
- Recommendation:
  1. Invert model to explicit-deny by default for dashboard children.
  2. Add all dashboard routes to the map.

### B10 - High - Role mapping and module mapping inconsistent between shell and home
- Evidence:
  - Layout maps warehouse/accountant to dedicated roles: `apps/web/src/routes/dashboard.tsx:176-179`.
  - Home maps both to `admin`: `apps/web/src/routes/dashboard._index.tsx:52-54`.
- Impact:
  - Inconsistent homepage/cards vs sidebar access semantics.
- Recommendation:
  1. Use one shared role-mapper utility across app.

### B11 - High - Accountant/Warehouse nav module allowlists do not match actual item modules
- Evidence:
  - Accountant allowlist uses `expenses`, `cash`, `customers`: `apps/web/src/components/layout/app-sidebar.tsx:385-392`.
  - Relevant nav items use modules `settings`, `shifts`, `orders`: `app-sidebar.tsx:225,266,329`.
  - Warehouse allowlist includes `purchase-orders` but PO nav item module is `inventory`: `app-sidebar.tsx:160-164,376-383`.
- Impact:
  - Roles silently lose intended menu access.
- Recommendation:
  1. Unify module keys across nav, permission payload, and role allowlists.

### B12 - High - Orders page still hardcodes user role as admin
- Evidence:
  - `userRole="admin"` passed in route: `apps/web/src/routes/dashboard.orders.tsx:254`.
  - Void capability uses this role string: `apps/web/src/components/orders/orders-table.tsx:888`.
- Impact:
  - UI can expose privileged actions incorrectly.
- Recommendation:
  1. Pass actual mapped role from current user profile.

### B13 - High - Customers permission wiring remains inconsistent
- Evidence:
  - Customer update uses `orders.create`: `packages/api/src/routers/customers.ts:121`.
  - Delete uses `customers.delete`: `packages/api/src/routers/customers.ts:233`.
  - Seed roles generally have no `customers` module: `packages/db/src/seed.ts:750-924`.
- Impact:
  - Create/update may be allowed while delete consistently forbidden for most roles.
- Recommendation:
  1. Decide one module contract (`customers.*` preferred) and migrate router checks and role data.

### B14 - High - Cash/expense permissions use incorrect verbs
- Evidence:
  - `deleteExpenseCategory` uses `shifts.create`: `packages/api/src/routers/cash.ts:555`.
  - `updateExpense` uses `shifts.create`: `packages/api/src/routers/cash.ts:565`.
- Impact:
  - Users with create-only permission can mutate/delete existing records.
- Recommendation:
  1. Use update/delete verbs for mutation/destructive endpoints.

### B15 - High - `getCurrentUser` UI permissions may diverge from backend-enforced permissions
- Evidence:
  - UI profile returns first role assignment only: `packages/api/src/routers/settings.ts:28-40,50`.
  - Backend context merges permissions across all roles: `packages/api/src/lib/permissions.ts:22-35`.
- Impact:
  - Sidebar and route decisions may not match server authorization outcomes.
- Recommendation:
  1. Return merged permissions in `getCurrentUser` using same source as context.

### B16 - High - Stock alert badge query is effectively disabled
- Evidence:
  - Dashboard user object sets `organization_id: null`: `apps/web/src/routes/dashboard.tsx:284`.
  - Sidebar query requires non-null org id and is gated by `enabled: !!user.organization_id`: `apps/web/src/components/layout/app-sidebar.tsx:426-434`.
- Impact:
  - Alert badge never appears in normal operation.
- Recommendation:
  1. Return and wire real org/location IDs from current user/session context.

## Priority 2 (Stability, UX, Architecture)

### B17 - Medium - Multiple components still set state during render
- Evidence:
  - `dashboard.settings.tsx`: `OrganizationTab` `:196-199`, `ReceiptConfigTab` `:1339-1350`, `DocumentSettingsTab` `:2464-2480`.
  - `dashboard.currency.tsx`: `:32-35`.
  - `dashboard.loyalty.tsx`: `:143-149`.
- Impact:
  - Re-render loops/warnings and brittle hydration behavior.
- Recommendation:
  1. Move initialization sync into `useEffect` with explicit guards.

### B18 - Medium - Split bill “Custom” path is not a real custom split
- Evidence:
  - Custom validation exists but mutation still calls equal split by count: `apps/web/src/components/pos/split-bill-dialog.tsx:166-183`.
- Impact:
  - UI promises capability not actually delivered.
- Recommendation:
  1. Add API support for explicit amount-per-split payload.

### B19 - Medium - Orders table uses stale local state copy of props
- Evidence:
  - `const [orders] = useState(initialOrders)` with no sync: `apps/web/src/components/orders/orders-table.tsx:884`.
- Impact:
  - Table can desync from incoming query updates.
- Recommendation:
  1. Use props directly or sync with `useEffect`.

### B20 - Medium - Sidebar/navigation uses hard links causing full reload
- Evidence:
  - `<a href={item.url}>` and `<a href="/dashboard">`: `apps/web/src/components/layout/app-sidebar.tsx:482,509`.
- Impact:
  - Slower transitions and inconsistent SPA behavior.
- Recommendation:
  1. Replace with router `<Link>` / `navigate`.

### B21 - Medium - Multi-location context is not consistently honored
- Evidence:
  - Layout provides location switcher context.
  - Pages still hardcode defaults, e.g. stock alerts default org/location constants: `apps/web/src/routes/dashboard.stock-alerts.tsx:38-39,49,122`; cash fallback location constant: `apps/web/src/routes/dashboard.cash.tsx:32`.
- Impact:
  - Location switcher can feel cosmetic; wrong data scope risk.
- Recommendation:
  1. Remove hardcoded IDs from UI routes and use selected context everywhere.

### B22 - Medium - Audit attribution placeholders (`"system"`) still used in UI
- Evidence:
  - Stock alerts/waste route sends `"system"`: `dashboard.stock-alerts.tsx:104,123`, `dashboard.waste.tsx:281`.
- Impact:
  - Loss of true actor attribution for compliance/audit.
- Recommendation:
  1. Use session user identity server-side, not placeholders in client payload.

### B23 - Medium - Cash session uniqueness only enforced in app layer
- Evidence:
  - Runtime guard exists: `packages/api/src/routers/cash.ts:67-84`.
  - No DB partial unique index for one-open-per-register: `packages/db/src/schema/cash.ts:50-54`.
- Impact:
  - Race conditions can still create multiple open sessions.
- Recommendation:
  1. Add partial unique index on `(register_id)` where `status='open'`.

### B24 - Medium - CI typecheck matrix still misses `fumadocs`
- Evidence:
  - Root runs `turbo check-types` but `fumadocs` script is `types:check`: `package.json`, `apps/fumadocs/package.json`.
  - Runtime output confirms only 3 check-types tasks executed.
- Impact:
  - Docs type regressions can bypass CI.
- Recommendation:
  1. Add `check-types` script to `apps/fumadocs` or update turbo pipeline.

## Admin vs Cashier and CRUD Gap Matrix

### What cashiers currently get (roughly)
- Sidebar-visible: Dashboard, POS Terminal, Orders, Customers, Gift Cards, Time Clock, Cash Control, Kitchen Display.
- Hidden but potentially reachable by direct URL due incomplete route map: any dashboard child not in map (depends on API permission fallback).

### Current role/CRUD gaps
- Users can be created from Settings UI without account credential flow or guaranteed role assignment in one operation:
  - UI create form: `apps/web/src/routes/dashboard.settings.tsx:893-939`
  - API create user only inserts `user` table: `packages/api/src/routers/settings.ts:325-333`
- Role editor only supports CRUD actions and cannot cleanly model specialized actions (`void`, `refund`, `approve`, `override`, `apply`):
  - UI action set fixed: `dashboard.settings.tsx:2710`
- Customers delete action requires module/action not provisioned in system roles (`customers.delete`).
- Expense CRUD verb checks are mismatched (`shifts.create` used for update/delete category).

### Recommendation
1. Introduce a formal permission dictionary (single source of truth) and generate both UI matrix and server checks from it.
2. Create user flow should atomically:
   - create auth account credential or invite
   - create org membership
   - assign POS role (`user_role`)
   - enforce PIN setup on first login
3. Add role capability tests per module/action pair.

## UI/UX and Information Architecture Audit

### Major IA issues
- Navigation is too fragmented for operational users; overlapping domains are split across many top-level links.
- Settings functionality is duplicated across dedicated pages and settings tabs (e.g., Locations in both sidebar route and settings tab).
- Finance/Management entries are overlong and mixed (reports + configuration + controls).

### Proposed menu consolidation (recommended)
1. `Sell`
   - Rename `POS Terminal` -> `New Sale`
   - Keep `Orders`, `Customers`, `Gift Cards`, `Loyalty`
2. `Operations`
   - `Kitchen Display`, `Production Board` (rename `Check Off`), `Tables`, `Time Clock`
3. `Inventory`
   - `Products`, `Stock`, `Purchase Orders`, `Waste & Shrinkage` (rename `Waste Log`), `Stock Variance` (rename `Variance`), `Suppliers`, `Labels`
4. `Finance`
   - `Invoices`, `Quotations`, `Expenses`, `Cash Reconciliation` (rename `Reconciliation`), `P&L`, `Sales Journal`
5. `Insights`
   - `Reports`, `Analytics`, `EOD`
6. `System`
   - `Settings`, `Locations`, `Webhooks`, `Notifications`, `Audit Log`, `Currency`

### Rename recommendations
- `Check Off` -> `Production Board`
- `POS Terminal` -> `New Sale`
- `Waste Log` -> `Waste & Shrinkage`
- `Variance` -> `Stock Variance`
- `P&L Statement` -> `Profit & Loss`
- `Sales Journal` -> `Daily Sales Journal`
- `Reconciliation` -> `Cash Reconciliation`
- `Menu Schedules` -> `Menu Calendar`

### Interaction and accessibility gaps
- Clickable non-button badges in POS filter strip: `apps/web/src/components/pos/pos-terminal.tsx:529-575`.
- Nested interactive control (`button` inside `Button`) in customer chip: `pos-terminal.tsx:597-615`.
- Icon-only keypad backspace buttons lack accessible labels:
  - `apps/web/src/routes/login.tsx:210-218`
  - `apps/web/src/components/auth/pin-lock-screen.tsx:122-130`
- Table-row click interactions are mouse-centric and not keyboard equivalent (customers list): `apps/web/src/routes/dashboard.customers.tsx:241-245`.

### Premium visual polish plan (frontend-design oriented)
1. Establish visual system tokens
   - Define semantic color tokens (surface tiers, status ramps, accent), spacing scale, elevation, and radius families.
2. Strengthen hierarchy and density
   - Use a command-center shell with consistent section headers, sticky toolbars, and tighter data cards.
3. Premium typography pairing
   - Use one strong display face for top-level page identity and a high-legibility UI face for dense controls.
4. Motion with purpose
   - Add staged entrance for dashboard cards and state transitions on status changes (ticket ready, shift close, payment complete).
5. Operational readability upgrades
   - Color-consistent status chips, stronger empty states, and contextual quick actions near primary data tables.
6. Print/export coherence
   - Unify print template style, branding block, and legal footer across orders/expenses/reports.

## Premium Feature Inspiration to Incorporate (Odoo/ERPNext-aligned)

### High-fit features for this project
1. Shift close + end-of-day consolidation workflow
   - Inspired by ERPNext POS Closing Voucher + POS invoice consolidation.
   - Fit: your app already has shifts/cash/eod, but needs stricter end-of-day reconciliation and consolidated posting.
2. Self-order channels (QR menu + kiosk)
   - Inspired by Odoo self-order flows.
   - Fit: extend current POS/kitchen pipeline for guest-originated orders with service mode and payment timing controls.
3. Preparation display routing
   - Inspired by Odoo preparation display concept.
   - Fit: add station routing, prep-stage SLA timers, and guest-visible status board.
4. POS profile model
   - Inspired by ERPNext POS profile controls (allowed payment modes, default profile per user, stock behavior).
   - Fit: map to per-register/per-role profile objects in your settings domain.
5. Parallel orders / parked carts refinement
   - Inspired by Odoo parallel orders.
   - Fit: strengthen held-order retrieval, cashier handoff, and multi-cart conflict handling.
6. Offline-first reliability hardening
   - Inspired by Odoo/ERPNext offline behavior.
   - Fit: currently partial; add explicit sync queue visibility, conflict resolution, and recoverable retry states.

### Recommended implementation order
1. End-of-day and shift-close hardening (financial correctness first).
2. POS profile + permission normalization.
3. Self-order + KDS improvements.
4. Offline and resilience upgrades.

## Additional “Nice to Have” Enhancements
- Event center dashboard for webhooks/notifications with retries, dead-letter queue, and signature validation tester.
- Guided onboarding wizard for first-time admin: org, locations, registers, payment methods, taxes, receipt branding.
- Role-based workspace presets (Cashier, Kitchen, Inventory, Finance) with tuned default landing pages.
- Global command palette for quick actions (`New Sale`, `Open Shift`, `Find Order`, `Create PO`).

## Testing and Quality Gaps
No comprehensive automated tests were found for critical business flows.

Recommended minimum automated suite:
1. PIN auth hardening tests (banned user, duplicate PIN behavior, rate limits).
2. RBAC matrix tests for route map + router guards alignment.
3. Checkout invariants (negative total prevention, mixed tender change correctness).
4. Cash session race tests (single open session DB constraint).
5. Audit integrity tests (server-side actor attribution, no client spoofing).
6. Print/export safety tests (escaping/sanitization).

## Definition of Done for Claude (Pass 2)
1. All P0 findings resolved with tests.
2. Permission schema normalized (`module.action` catalog shared by UI and API).
3. Route, sidebar, and API permissions produce consistent outcomes for each role.
4. Actor attribution is server-derived for all auditable mutations.
5. UI IA consolidation plan implemented (menus + naming + role workspaces) and verified responsive/accessibility baseline.

## External Reference Links Used for Premium Benchmarking
- Odoo POS features: https://www.odoo.com/app/point-of-sale-features
- Odoo self-ordering docs: https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/self_order.html
- ERPNext POS overview: https://docs.frappe.io/erpnext/v13/user/manual/en/accounts/point-of-sales
- ERPNext POS profile: https://docs.frappe.io/erpnext/v14/user/manual/en/accounts/pos-profile
- ERPNext POS invoice consolidation: https://docs.frappe.io/erpnext/v14/user/manual/en/accounts/pos_invoice_consolidation
