# Bettencourt POS — Senior Production Audit (2026-04-19)

## Scope
- Repository: `kareemschultz/Bettencourt-POS`
- Audit type: engineering + security + data/financial correctness + cashier UX under lunch-rush conditions
- Method: static code review of server, API routers, schema, POS UI, and docs

## 1) System Map & Architecture

### Monorepo map
- `apps/web`: React 19 SPA (POS, KDS, ops/admin modules)
- `apps/server`: Hono/Bun server entry, auth/PIN endpoints, uploads, print proxy, websocket/SSE
- `apps/fumadocs`: documentation site
- `packages/api`: oRPC router layer + core business logic
- `packages/auth`: Better Auth setup and plugins
- `packages/db`: Drizzle schema + SQL migrations + seed
- `packages/env`: zod env parsing
- `packages/server`: currently appears unused by runtime code

### Entrypoints
- Web: route files under `apps/web/src/routes/*`, POS entry at `dashboard.pos.tsx`
- Server: `apps/server/src/index.ts`
- API router composition: `packages/api/src/routers/index.ts`

### Critical subsystem identification
- Auth/session lifecycle: Better Auth + custom `/api/auth/pin-login`
- RBAC: `permissionProcedure()` + permission map loader
- Order/payment lifecycle: `packages/api/src/routers/pos.ts` + `orders.ts` + `split-bill.ts`
- Receipt flow: `ReceiptPreview` component + print dispatch from checkout
- Kitchen realtime: websocket `/ws` + SSE `/api/kitchen/events`
- Inventory: separate routers exist; no checkout stock decrement found in POS checkout path

## 2) Executive Summary

- **Repo health score:** **6.1/10**
- **Production readiness:** **Conditional**. Works for many happy-path operations, but has several high-impact multi-tenant security and financial integrity risks that should be fixed before scale-up.

### Top 10 critical issues
1. Missing org scoping in `orders.void`/`orders.refund` (IDOR + cross-tenant writes).
2. Missing org scoping in split-bill router mutations.
3. Product catalog read endpoints in POS are not org-scoped.
4. Checkout trusts client-supplied prices/product names/tax rates.
5. Floating-point arithmetic for totals/payments/splits in money-critical paths.
6. Offline queue records sales as “queued” but POS clears cart before server ack.
7. Gift card payment path in checkout does not debit gift card balance.
8. Network print proxy can target arbitrary host:port (SSRF-internal pivot risk).
9. Upload-serving path is not normalized against traversal (`/uploads/*`).
10. Documentation is materially stale (router counts, realtime architecture, plugin list), increasing operational misconfiguration risk.

### Top 10 quick wins
1. Add org filter (`organizationId`) to all order/split reads+writes.
2. Recompute line prices server-side from product/modifier IDs.
3. Move all currency math to decimal library or integer minor units.
4. Add transactional idempotency key on checkout.
5. Do not clear cart until online checkout returns `2xx` with created order id.
6. Add gift-card redemption transaction when payment method is `gift_card`.
7. Restrict `/api/print/network` to allowlisted subnets/printers.
8. Canonicalize upload paths and reject `..` traversal.
9. Add DB check constraints (nonnegative amounts, valid status enums).
10. Update docs (`README`, `DEVELOPER.md`) from source-of-truth code metadata.

## 3) Detailed Findings Table

| ID | Sev | Category | Location | Evidence | Why it matters | Repro scenario | Recommendation | Confidence |
|---|---|---|---|---|---|---|---|---|
| F-001 | Critical | Security/IDOR | `packages/api/src/routers/orders.ts` | `voidOrder` and `refund` fetch by `order.id` only, no org predicate | User with permission in org A can alter org B orders if UUID leaked | Call `orders.void` with foreign org order ID | Enforce `organizationId` on every select/update/delete | High |
| F-002 | Critical | Security/IDOR | `packages/api/src/routers/split-bill.ts` | split procedures fetch order by `id` only | Cross-tenant split/payment mutation risk | Split foreign org order ID | Scope by org via `requireOrganizationId(context)` joins | High |
| F-003 | High | Security/Data exposure | `packages/api/src/routers/pos.ts` | `getProducts` / `getModifiers` do not filter by `organizationId` | Product catalog leakage across tenants; wrong menu at terminal | Login as org A, query products for org B register/location IDs | Add org predicates on all product/modifier/department queries | High |
| F-004 | Critical | Data integrity/financial | `packages/api/src/routers/pos.ts` | checkout uses client `unitPrice`, `taxRate`, `productName` snapshots directly | Cashier/client tampering can undercharge without server validation | Intercept RPC and send lower `unitPrice` | Load authoritative price/tax/product from DB in transaction | High |
| F-005 | High | Financial correctness | `packages/api/src/routers/pos.ts`, `split-bill.ts`, `orders.ts` | Uses JS `number` math + `.toFixed` for currency | Floating-point rounding drift at scale; reconciliation mismatch | High-volume split/discount/tax edge totals differ by cents | Use decimal lib or integer cents everywhere | High |
| F-006 | High | Reliability | `apps/web/src/components/pos/pos-terminal.tsx`, `apps/web/src/lib/offline.ts` | Offline path queues op then immediately clears cart and shows success-style toast | Silent data loss if queue later fails/retries exhaust; no cashier remediation path | Go offline, sell, close tab before sync | Keep pending ticket visible until confirmed sync + retry UX | High |
| F-007 | High | Financial correctness | `packages/api/src/routers/pos.ts` + `giftcards.ts` | checkout records `gift_card` payments but does not redeem balance | Gift card can be reused despite payment records | Pay with gift card multiple times | In checkout transaction call gift-card redeem mutation logic/ledger | High |
| F-008 | High | Security/SSRF | `apps/server/src/index.ts` `/api/print/network` | Authenticated user can pass arbitrary `address` host:port | Internal network probing/exfiltration via print tunnel | Send `127.0.0.1:...` or RFC1918 target | Add printer allowlist, subnet restrictions, port constraints | High |
| F-009 | High | Security/path traversal | `apps/server/src/index.ts` `/uploads/*` | `join(env.UPLOADS_DIR, reqPath.replace(...))` without normalization guard | Potential read outside uploads dir using `..` | Request `/uploads/../../...` style paths | Resolve+normalize and enforce prefix | Medium |
| F-010 | Medium | Security/session config | `packages/auth/src/index.ts` | Cookie attrs forced `SameSite=None; Secure` always | Local HTTP/dev misbehavior; can cause random auth failures under ops support | QA/local session inconsistency | Environment-sensitive cookie settings | Medium |
| F-011 | Medium | Concurrency | `packages/api/src/routers/pos.ts` | order number uses global sequence + daily counter read without unique formatted constraint | Potential duplicate/display confusion under parallel checkout | Parallel rush transactions | Add unique constraint on order number; robust formatter | Medium |
| F-012 | Medium | Data constraints | `packages/db/src/schema/*.ts` | Many status/type columns are free-text; limited DB CHECK enforcement | Invalid states can enter DB outside app path | Manual SQL / future code path writes invalid status | Convert to enums or add `CHECK` constraints | High |
| F-013 | Medium | Performance | `packages/api/src/routers/pos.ts` | product queries + combo joins + in-memory mapping per request | Slow POS load on large menus | >2k products / multiple terminals | Precompute/materialize menu view; add pagination/caching | Medium |
| F-014 | Medium | Performance | `apps/web/src/components/pos/product-grid.tsx` | Non-virtualized product grid renders full list | Input lag on lower-end terminals | 300+ products visible in rush | Virtualize grid and memoize product cards | High |
| F-015 | Medium | UX/ops safety | `apps/web/src/components/pos/pos-terminal.tsx` | `F4` clears cart immediately, no undo | Accidental full-order loss in rush | Mis-press function key | Undo-first snackbar + delayed hard clear | High |
| F-016 | Medium | UX/terminology | POS labels | Mixes “Current Order”, “Open Tab”, “Split Bill”, “Pay”, “Checkout” semantics | Increases training burden and action ambiguity | New cashier onboarding | Adopt one canonical vocabulary set | Medium |
| F-017 | Medium | Test coverage | repo-wide tests | No direct tests for checkout, split, void/refund org scoping | Regressions likely in mission-critical money flows | Modify checkout logic, no failing tests | Add integration tests for order/payment invariants | High |
| F-018 | Low | Dead code/stale artifacts | `packages/server/services/print-service.ts`, `apps/server/index.js.map` | No references to package print-service; built map committed in source tree | Maintenance confusion, stale binary artifacts | Contributor edits wrong print service | Remove or wire intentionally; ignore build artifacts in VCS | Medium |
| F-019 | Medium | Docs drift | `docs/DEVELOPER.md`, `README.md` | Router/table/plugin counts and realtime architecture text no longer match source | Wrong runbooks during incidents | On-call follows outdated docs | Generate docs from code stats and update regularly | High |
| F-020 | Medium | POS ops gap | POS flow | No fast cash one-tap tenders on main screen; split flow buried | Slower throughput under queue pressure | Lunch rush cash line | Expose quick cash buttons + keyboard-first tendering | Medium |

## 4) Security Report

### High-risk findings
- Cross-tenant mutation vectors exist in order/split paths (F-001/F-002).
- SSRF-style network print proxy exposure for authenticated users (F-008).
- Upload file serving path hardening incomplete (F-009).
- POS catalog endpoints missing tenant scope (F-003).

### Additional observations
- RBAC middleware exists and is consistently used at procedure level.
- PIN login has brute-force lockout controls and ban-state checks.
- Webhook outbound delivery is signed (HMAC) when secret exists.

## 5) Data & Financial Integrity Report

### Critical correctness risks
- Client-authoritative price/tax/identity on checkout (F-004).
- Floating-point money math on transactional paths (F-005).
- Gift card payment not tied to gift-card ledger decrement (F-007).
- Free-text status columns allow invalid transitions (F-012).

### Control recommendations
- Server-side recomputation and strict invariant checks before commit.
- DB transaction invariant checks: `sum(payments) >= total`, refunds cap, split totals exact.
- Add immutable financial ledger table for all balance-changing events.

## 6) Performance Report

- POS menu hydration likely degrades with scale due to broad query+map strategy (F-013).
- Product grid lacks virtualization (F-014).
- Potential high invalidation churn from websocket-triggered invalidates on each 86 event.

## 7) CASHIER UX REPORT (Detailed)

### Current flow (observed)
1. Choose register.
2. Pick department.
3. Tap items (modifiers/notes optionally via extra dialogs).
4. Optional discount/promo/customer lookup/tab.
5. Tap checkout.
6. In payment dialog: choose method, enter amounts, confirm.
7. Receipt modal opens.
8. Dismiss and start next order.

### Estimated interaction cost
- Simple cash sale: ~7–11 taps/clicks minimum.
- Split/gift-card/mixed tender: 12–20+ interactions.
- Pickup/delivery adds multiple fields and mode toggles.

### Friction points
- Too many optional controls in top bar during rush.
- “Hold/Clear/Discount/Tab/Customer” all compete with payment action.
- Destructive clear lacks undo safety.
- Split bill is dialog-deep and not optimized for rapid repeated use.

### Terminology audit
- Inconsistent action naming among “Order”, “Tab”, “Bill”, “Pay”, “Checkout”, “Current Order”.
- Suggested standard:
  - “Ticket” for in-progress sale
  - “Pay” for tender action
  - “Hold Ticket” / “Recall Ticket”
  - “Split Check” (restaurant standard) instead of “Split Bill”

### Screen hierarchy recommendations
- Left: high-density product grid with favorites first row.
- Right sticky panel: ticket lines + always-visible “Pay” CTA.
- Move infrequent actions (gift card sell, reprint, shortcuts help) into overflow menu.
- Add persistent queue badge for pending offline sync.

### Speed optimization (target: <5s simple sale)
- Auto-focus barcode input/listener context.
- One-tap cash tenders on main cart footer (Exact, +100, +500, +1000).
- Default to last-used payment method and register per cashier session.
- Keep customer lookup collapsed until non-dine-in selected.

### Error prevention
- Replace immediate clear with undo snackbar (5–8s).
- Quantity edits: include numeric keypad quick-entry.
- Void/cancel should show reversible state where possible.

### High-stress usability
- Keep action placement fixed (muscle memory).
- Ensure primary action “Pay” is visually dominant and always in same corner.
- Separate “danger” actions from routine actions.

### Hardware support
- Barcode path exists and works with lookup API.
- Keyboard shortcuts exist (F2/F3/F4/F5/F8/F12), but discoverability is low.
- Add full shortcut map + cashier cheat sheet + numpad quantity entry.

### Professional POS feature gap analysis
Missing or underpowered relative to leading restaurant POS:
- Pinned favorites / quick keys by cashier
- Recent items / repeat last ticket quick action
- Fast cash tender buttons in main workflow
- Seat-based split and shared-item distribution UX
- Strong offline ticket queue management with operator conflict resolution
- Lane/queue management view during rush

## 8) Test Coverage Audit

### Major uncovered flows
- `pos.checkout` invariants and failure rollback behavior
- org-scoping guard tests for order/split mutations
- gift card tender integration with balance decrement
- offline queue lifecycle + recovery
- cash session expected cash reconciliation math

### High-value test plan
- Unit: deterministic money math helper (integer cents)
- Integration: checkout transaction with tax/discount/split/refund invariants
- Security: forbidden cross-org operations (void/refund/split)
- E2E: cashier lunch-rush script (barcode + discount + split + receipt)

## 9) Dead Code & Stale Abstractions

- `packages/server/services/print-service.ts` appears unused by app/server + api runtime imports.
- `apps/server/index.js.map` appears committed build artifact.
- Multiple docs/plans reference superseded architecture details.

## 10) Roadmap

### Immediate (0–7 days)
- Patch org-scoping gaps (F-001/2/3).
- Enforce server-authoritative pricing (F-004).
- Harden print proxy and uploads path (F-008/9).
- Add rollback-safe offline UX (F-006).

### Short term (1–4 weeks)
- Migrate money math to integer/decimal model (F-005).
- Add financial invariant test suite (F-017).
- Add DB checks/enums for core statuses (F-012).
- POS quick-tender and undo UX improvements (F-015/20).

### Major redesign (1–2 quarters)
- Dedicated transaction ledger + idempotency framework.
- Full cashier-optimized surface (favorites, repeat, queue, seat split).
- Observability for checkout latency and tender failure rates.
- Docs-as-code pipeline to prevent drift.

---

## 11) Remediation Status (as of 2026-04-19)

All immediate + short-term findings fully addressed. Commits `8e5247c` → `c1ae520`.

| Finding | Description | Status |
|---------|-------------|--------|
| F-001/002/003 | IDOR — org-scoping gaps in pos, customers, orders | ✅ Fixed |
| F-004 | Server-side price validation | ✅ Fixed |
| F-005 | money.ts helpers (toCents, fromCents, roundMoney) | ✅ Fixed |
| F-006 | Offline cart kept visible pending cashier confirm | ✅ Fixed |
| F-007 | Gift card debit inside transaction | ✅ Fixed |
| F-008 | SSRF on print proxy | ✅ Fixed |
| F-009 | Path traversal on uploads | ✅ Fixed |
| F-011 | UNIQUE index on order_number+org | ✅ Fixed |
| F-012 | CHECK constraints on financial columns | ✅ Fixed |
| F-013 | Pagination on list endpoints | ✅ Fixed |
| F-014 | Product grid virtualisation (`@tanstack/react-virtual`) | ✅ Fixed |
| F-015 | Cart clear undo action | ✅ Fixed |
| F-016 | "Split Check" rename | ✅ Fixed |
| F-018 | Dead code removed | ✅ Fixed |
| F-020 | GYD quick-cash denominations corrected (`[100,500,1000,2000,5000]`) | ✅ Fixed |
| F-021 | `lookupBarcode` org-scoped | ✅ Fixed |
| F-022 | `toggle86` org-scoped | ✅ Fixed |
| F-023 | All 9 modifier procedures org-scoped | ✅ Fixed |
| F-024 | `longPressTimerRef` moved to `useRef` (was leaked on re-render) | ✅ Fixed |
| F-025 | Offline console.log/error removed | ✅ Fixed |
| F-026 | `reports.ts` IDOR — all 13 report types + EOD report org-scoped | ✅ Fixed |
| F-017 | Integration tests | 🗓 Backlog |
| F-019 | DEVELOPER.md + README.md docs | 🗓 Backlog |

**Additional session work (2026-04-19):**
- VAT: seed updated to 14% Guyana GRA rate; escpos/receipt/cart all show "Incl. VAT" extraction (VAT-inclusive pricing); tax settings UI shows GRA formula.
- Courses toggle: per-terminal localStorage `pos-show-courses`; Shakira's counter-service preference.
- `getPosSettings` wired into `pos-terminal.tsx`: `autoPrintReceipt`, `defaultOrderType`, `enableGiftCards`, `enableLoyalty` now consumed at runtime.
- CartPanel VAT breakdown: "Incl. VAT" row clickable — expands per-item VAT; persisted to `pos-show-vat` localStorage.
- QZ Tray: self-signed CA cert (CA:TRUE) served from `/api/qz/certificate`; PowerShell one-liner for Windows setup; override.crt mechanism documented.
- All changes deployed to Titan, HTTP 200 confirmed on `pos.bettencourtgy.com`.

