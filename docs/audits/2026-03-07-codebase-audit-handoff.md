# Bettencourt POS Codebase Audit Handoff

Date: 2026-03-07
Author: Codex audit pass (read + static/runtime checks)
Repository: Bettencourt-POS

## Purpose
This document is a fix plan for Claude: concrete bugs, risks, feature gaps, and recommended remediations, prioritized by impact.

## Scope
- Automated checks run: `bun run check-types`, `bun run build`, targeted `biome check`.
- Manual review focus:
  - `packages/api/src/routers/*`
  - `apps/server/src/index.ts`
  - `apps/web/src/routes/*` (high-risk flows)
  - CI/tooling config

## Executive Summary
- Build and root typecheck pass, but there are several high-impact logic and security issues.
- Highest-risk areas are payment/accounting invariants, reporting correctness, and public realtime event exposure.
- There is no test harness protecting critical flows (checkout/refund/reports).

## Priority 0 (Fix First)

### A01 - Critical - Wrong SQL condition in modifier unlink
- Problem: Unlink query uses JS `&&` inside Drizzle `where`, so condition is incorrect.
- Evidence: `packages/api/src/routers/modifiers.ts:253`
- Risk: Can remove wrong `product_modifier_group` rows.
- Recommendation:
  1. Replace `condA && condB` with `and(condA, condB)` from `drizzle-orm`.
  2. Add a regression test for unlinking one group from one product.

### A02 - Critical - Checkout can create completed order without valid payment state
- Problem: Checkout allows empty/invalid payment combinations and still writes `order.status = "completed"`.
- Evidence:
  - `packages/api/src/routers/pos.ts:283`
  - `packages/api/src/routers/pos.ts:384`
- Risk: Completed sales with missing tender; accounting mismatch.
- Recommendation:
  1. Enforce `payments.min(1)`.
  2. Validate sum of accepted payment amounts equals order total (allow explicit over-tender only for cash with change).
  3. Reject negative/NaN/zero payment amounts.
  4. Move order status transitions to explicit state machine (`pending_payment` -> `completed`).

### A03 - High - Payment clamping logic can under/over-state tender
- Problem: Each payment row uses `Math.min(pmt.amount, total)` independently; split tenders can distort recorded tender. Cash session update uses only first cash payment.
- Evidence:
  - `packages/api/src/routers/pos.ts:453`
  - `packages/api/src/routers/pos.ts:462`
- Risk: Payment ledger and expected cash drift from reality.
- Recommendation:
  1. Allocate remaining due across payment rows (deterministic allocator), not per-row clamp to total.
  2. Sum all cash-method rows when updating cash session.
  3. Add invariant checks before commit.

### A04 - High - Combo lines likely double-counted in reports
- Problem: Checkout stores both parent combo line and expanded component lines; report SQL sums all line-item totals.
- Evidence:
  - `packages/api/src/routers/pos.ts:407`
  - `packages/api/src/routers/pos.ts:427`
  - `packages/api/src/routers/reports.ts:70`
  - `packages/api/src/routers/reports.ts:89`
- Risk: Inflated product/department revenue.
- Recommendation:
  1. Introduce explicit marker on component rows (e.g. `is_component=true`) and exclude from sales revenue queries, or
  2. Keep only parent lines for revenue and use components only for production variance queries.
  3. Backfill/fix legacy report queries.

### A05 - High - Refund input is not bounded to valid range
- Problem: Refund endpoint accepts optional arbitrary amount, including negative or > order total.
- Evidence:
  - `packages/api/src/routers/orders.ts:284`
  - `packages/api/src/routers/orders.ts:307`
  - `packages/api/src/routers/orders.ts:324`
- Risk: Invalid financial records, potential abuse.
- Recommendation:
  1. Validate refund amount: `> 0 && <= order.total`.
  2. Track cumulative refunded amount and prevent over-refund.
  3. Add idempotency guard (avoid duplicate refund rows on retries).

### A06 - High - Kitchen SSE endpoint is public
- Problem: `/api/kitchen/events` has no auth/permission gate.
- Evidence: `apps/server/src/index.ts:198`
- Risk: Any client can subscribe to operational kitchen events.
- Recommendation:
  1. Require authenticated session + `kitchen.read` permission.
  2. Return `401/403` on failure.
  3. Optionally scope by location.

## Priority 1 (High Value Next)

### A07 - Medium - Notification credentials are stored/returned as plaintext
- Problem: Twilio token/SID are persisted and returned via `getSettings`, then loaded into UI state.
- Evidence:
  - `packages/api/src/routers/notifications.ts:62`
  - `packages/api/src/routers/notifications.ts:101`
  - `apps/web/src/routes/dashboard.notifications.tsx:805`
- Risk: Secret exposure to users with settings access; accidental logging risk.
- Recommendation:
  1. Encrypt at rest (KMS/app key envelope).
  2. Never return full secrets from API; return masked value + `hasToken` boolean.
  3. Add rotation flow.

### A08 - Medium - Notification test send is stubbed as successful
- Problem: Code marks test notifications `sent` without external provider call.
- Evidence: `packages/api/src/routers/notifications.ts:346`
- Risk: False confidence in production notifications.
- Recommendation:
  1. Implement real provider call (Twilio/Vonage).
  2. Distinguish `queued`, `provider_accepted`, `delivered`, `failed`.
  3. If provider not configured, fail explicitly.

### A09 - Medium - Split bill flow can duplicate pending payments
- Problem: Re-running split endpoints adds more pending payment rows; no idempotency/cleanup.
- Evidence:
  - `packages/api/src/routers/split-bill.ts:49`
  - `packages/api/src/routers/split-bill.ts:69`
  - `packages/api/src/routers/split-bill.ts:161`
  - `packages/api/src/routers/split-bill.ts:183`
- Risk: Duplicate checks and corrupted settlement totals.
- Recommendation:
  1. Wrap split actions in transaction.
  2. Delete/reconcile prior pending split payments before creating new set.
  3. Add unique/idempotency key per split operation.

### A10 - Medium - Cash session lifecycle lacks enforcement
- Problem: No hard guard for one open session per register; close operation does not assert current status.
- Evidence:
  - `packages/api/src/routers/cash.ts:66`
  - `packages/api/src/routers/cash.ts:94`
  - `packages/db/src/schema/cash.ts:18`
- Risk: Multiple concurrent open sessions and unreliable reconciliation.
- Recommendation:
  1. Enforce unique open session per register (partial unique index).
  2. Validate session exists and is `open` before close/drop/payout/no-sale.
  3. Block operations on closed sessions.

## Priority 2 (Stability and DX)

### A11 - Low - State set during render in notifications page
- Problem: component mutates state during render path (`if (settings && !initialized) set...`).
- Evidence: `apps/web/src/routes/dashboard.notifications.tsx:803`
- Risk: React warnings and brittle rerender behavior.
- Recommendation: Move initialization to `useEffect` with `[settings, initialized]` dependencies.

### A12 - Low - Inconsistent error typing in public API
- Problem: uses `throw new Error(...)` in public routers.
- Evidence:
  - `packages/api/src/routers/online-order.ts:106`
  - `packages/api/src/routers/online-order.ts:132`
  - `packages/api/src/routers/online-order.ts:335`
  - `packages/api/src/routers/pos.ts:327`
- Risk: Inconsistent client error handling and less predictable error codes.
- Recommendation: Standardize on `ORPCError` with explicit codes/messages.

### A13 - Low - Typecheck pipeline misses web/fumadocs checks
- Problem: root `check-types` only executes tasks that exist; `web` has `typecheck` (not `check-types`).
- Evidence:
  - `package.json:25`
  - `apps/web/package.json:9`
  - `apps/fumadocs/package.json:9`
  - `apps/server/package.json:7`
- Risk: frontend type regressions can bypass CI.
- Recommendation:
  1. Standardize script name across packages (`check-types`).
  2. Ensure turbo task matrix includes web/fumadocs checks.

### A14 - Low - Turbo outputs misconfigured for frontend builds
- Problem: Turbo `build.outputs` is `dist/**`, but apps produce `build/**`.
- Evidence:
  - `turbo.json:8`
  - `apps/web/package.json:8`
  - `apps/fumadocs/package.json:8`
- Risk: cache misses, poor CI performance, noisy warnings.
- Recommendation: set per-package outputs correctly (e.g. `apps/*/build/**`, server `dist/**`).

### A15 - Low - Linting includes generated React Router artifacts
- Problem: Biome CI checks generated `.react-router/types` files.
- Evidence:
  - `.github/workflows/ci.yml:45`
  - `apps/fumadocs/.react-router/types/+routes.ts:1`
- Risk: noisy/fragile CI and high false positives.
- Recommendation: exclude generated directories in Biome config or CI command.

### A16 - Feature gap - Hardcoded org/location IDs limit multi-tenant growth
- Problem: many routers use `DEFAULT_ORG_ID`/`DEFAULT_LOCATION_ID` constants.
- Evidence example: `packages/api/src/routers/pos.ts:10` (repeated in many routers)
- Risk: difficult true multi-org support, migration complexity.
- Recommendation:
  1. Resolve org/location from authenticated session/context.
  2. Remove hardcoded IDs from router logic.
  3. Add tenant-scoped integration tests.

## Nice-to-Have Enhancements
- Add domain service layer for checkout/refund/cash session state transitions.
- Add idempotency keys for all mutation endpoints that can be retried from UI/network.
- Add audit metadata to all destructive changes (who/why/from where).
- Add money-safe utility (decimal library) to avoid float drift in calculations.

## Test Coverage Gaps
No effective automated tests were found for critical business flows.

Recommended minimum suite:
1. Checkout invariants (single, split, cash change, mixed tender).
2. Refund limits and idempotency.
3. Combo reporting correctness.
4. Split-bill duplication prevention.
5. Cash session open/close concurrency rules.
6. SSE auth/permission checks.

## Suggested Execution Order for Claude
1. Fix A01-A06 first (production risk).
2. Implement A07-A10 next (security + accounting correctness).
3. Complete A11-A16 (stability + tooling + scalability).
4. Add test suite for all fixed areas before closing.

## Definition of Done
- All P0/P1 issues patched and covered by tests.
- CI validates server + web + docs type safety and lint without generated-file noise.
- Financial invariants enforced with failing tests for invalid states.
- Security-sensitive endpoints require proper auth and least privilege.

