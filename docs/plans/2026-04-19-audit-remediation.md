# Audit Remediation Plan -- 2026-04-19

**Last updated:** 2026-04-19
**Last verified:** 2026-04-19
**Audit source:** `docs/audits/2026-04-19-production-audit.md`
**Stack:** Bun + Hono + Drizzle + React 19 + oRPC monorepo

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔄 | In Progress |
| ⏳ | Planned |
| 🗓 | Backlog |

---

## Wave 1 -- Critical Security & Data Integrity (Immediate, 0-7 days)

All Wave 1 items were implemented on 2026-04-19 in a single commit.

### F-001 ✅ -- orders.void / orders.refund missing org scope (IDOR)

- **File:** `packages/api/src/routers/orders.ts`
- **Fix:** Add `requireOrganizationId(context)` + `eq(schema.order.organizationId, orgId)` predicate to both `voidOrder` and `refund` fetch queries.

### F-002 ✅ -- split-bill router missing org scope (IDOR)

- **File:** `packages/api/src/routers/split-bill.ts`
- **Fix:** Add `context` parameter + `requireOrganizationId(context)` to all four procedures (`splitEqual`, `splitByItems`, `splitCustom`, `getSplits`) and add org filter on order fetch.

### F-003 ✅ -- getProducts / getModifiers not org-scoped

- **File:** `packages/api/src/routers/pos.ts`
- **Fix:** Pass `context` to both handlers; add `eq(schema.product.organizationId, orgId)` and `eq(schema.reportingCategory.organizationId, orgId)` to all product/department queries; add org check on modifier product lookup.

### F-008 ✅ -- Network print proxy SSRF

- **File:** `apps/server/src/index.ts`
- **Fix:** Add `isPrivateAddress(host)` guard; reject any host that is not a private RFC1918 or loopback address. Block non-standard ports (only 9100, 515, 631 allowed).

### F-009 ✅ -- Upload serve path traversal

- **File:** `apps/server/src/index.ts`
- **Fix:** `resolve()` the final path and assert it has `UPLOADS_DIR` as prefix before serving; return 404 if check fails.

### F-015 ✅ -- F4 clear cart with no undo

- **File:** `apps/web/src/components/pos/pos-terminal.tsx`
- **Fix:** `handleClearCart` saves a snapshot, clears cart, shows sonner toast with "Undo" action (6 s) that restores snapshot. F4 keyboard handler calls `handleClearCart()` instead of setting state directly.

---

## Wave 2 -- Financial Correctness (1-4 weeks)

### F-004 ⏳ -- Checkout trusts client-supplied prices

- **File:** `packages/api/src/routers/pos.ts` (`checkout`)
- **Fix:** In checkout transaction, re-fetch canonical `unitPrice`, `taxRate`, `productName` from DB using `productId`; reject or override client snapshot if mismatch exceeds tolerance.
- **Risk:** Breaking change to checkout input contract -- requires client-side coordination before shipping.

### F-005 ⏳ -- Floating-point money math

- **Files:** `packages/api/src/routers/pos.ts`, `split-bill.ts`, `orders.ts`
- **Fix:** Introduce integer-cent helpers (`toCents(n)`, `fromCents(n)`) in a shared `packages/api/src/lib/money.ts` module. Replace all `Number()` + `.toFixed()` money operations.
- **Risk:** Large refactor; requires thorough test coverage before shipping.

### F-006 ⏳ -- Offline queue clears cart before server ack

- **Files:** `apps/web/src/components/pos/pos-terminal.tsx`, `apps/web/src/lib/offline.ts`
- **Fix:** Keep cart in `pending` state until `checkout` RPC returns `2xx` with order ID; only then clear. Offline queue tracks per-ticket sync state and surfaces unsynced tickets.

### F-007 ⏳ -- Gift card payment does not debit balance

- **File:** `packages/api/src/routers/pos.ts` (`checkout`)
- **Fix:** In checkout transaction, when `payment.method === "gift_card"`, call gift card ledger to debit `payment.amount`; rollback if insufficient balance.
- **Note:** Verify gift card schema and router exist with a balance field before implementing.

### F-011 ⏳ -- Order number race condition

- **Files:** `packages/api/src/routers/pos.ts`, `packages/db/src/schema/*.ts`
- **Fix:** Add `UNIQUE` constraint on `order_number`; wrap sequence fetch + insert in single SQL expression; add unique index to enforce at DB level.

### F-012 ⏳ -- Free-text status columns

- **Files:** `packages/db/src/schema/*.ts` + migrations
- **Fix:** Convert `order.status`, `payment.status`, `payment.method` columns to Postgres enums or add `CHECK` constraints.

---

## Wave 3 -- Performance & UX (Ongoing)

### F-013 ⏳ -- POS menu query performance

- **File:** `packages/api/src/routers/pos.ts`
- **Fix:** Add pagination (`limit`/`offset`) to `getProducts`; consider a materialized menu cache invalidated on product writes.

### F-014 ⏳ -- Non-virtualized product grid

- **File:** `apps/web/src/components/pos/product-grid.tsx`
- **Fix:** Replace render-all approach with `@tanstack/react-virtual` row virtualization; memoize product cards.

### F-016 ⏳ -- Inconsistent POS terminology

- Standardize to: "Ticket" (in-progress), "Pay" (tender), "Hold Ticket" / "Recall Ticket", "Split Check".

### F-020 ⏳ -- No fast cash tender buttons

- Add one-tap cash buttons (Exact, +100, +500, +1000 GYD) to checkout footer.

---

## Wave 4 -- Tests & Documentation (Ongoing)

### F-017 ⏳ -- No tests for checkout / org-scope / split invariants

- Add integration tests: checkout rollback, cross-org forbidden mutations, gift-card tender math, split total invariant.

### F-018 ⏳ -- Dead code

- Remove `packages/server/services/print-service.ts` if confirmed unused.
- Add `apps/server/index.js.map` to `.gitignore`.

### F-019 ⏳ -- Stale docs

- Update `docs/DEVELOPER.md` and `README.md` router/table/plugin counts from source.

---

## Notes

- F-004 and F-005 are the highest financial-correctness risk items but require coordinated client + server changes.
- F-007 requires verifying the gift card schema/router exists and has a balance field before implementing.
- Wave 1 items (F-001, F-002, F-003, F-008, F-009, F-015) were all completed on 2026-04-19 in a single commit.
