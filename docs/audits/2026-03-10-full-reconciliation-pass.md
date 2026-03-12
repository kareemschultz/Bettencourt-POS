# 2026-03-10 Full Repository Reconciliation Pass

## 1) Plan/spec files discovered

### Planning and handoff docs

- `docs/plans/plan-16-codex-handoff.md`
- `docs/plans/2026-03-05-feature-buildout-design.md`
- `docs/plans/2026-03-05-plan2-feature-buildout-design.md`
- `docs/plans/2026-03-05-plan2-implementation.md`
- `docs/plans/2026-03-05-wave1-implementation.md`
- `docs/plans/2026-03-06-accounting-features-design.md`
- `docs/plans/2026-03-06-barcode-integration-design.md`
- `docs/plans/2026-03-06-features-and-documentation.md`
- `docs/plans/2026-03-06-invoices-quotations-design.md`
- `docs/plans/2026-03-06-mock-data-and-qol.md`
- `docs/plans/2026-03-06-phase3-client-feedback.md`
- `docs/plans/2026-03-06-production-components-refund-design.md`
- `docs/plans/2026-03-06-production-components-refund.md`
- `docs/plans/2026-03-07-invoice-quotation-revamp-design.md`
- `docs/plans/2026-03-07-invoice-quotation-revamp.md`
- `docs/plans/2026-03-08-comprehensive-seed-data.md`
- `docs/plans/2026-03-08-final-audit-closure.md`
- `docs/plans/2026-03-08-final-sweep-audit.md`
- `docs/plans/2026-03-08-v2-deferred-and-premium.md`
- `docs/plans/2026-03-09-backup-restore-design.md`
- `docs/plans/2026-03-09-backup-restore.md`
- `docs/plans/2026-03-09-vendor-ledger-design.md`
- `docs/plans/2026-03-09-vendor-ledger-plan.md`
- `docs/plans/2026-03-10-user-management-design.md`
- `docs/plans/2026-03-10-user-management.md`

### Audit handoff docs (used as implementation checkpoints)

- `docs/audits/2026-03-07-codebase-audit-handoff.md`
- `docs/audits/2026-03-08-comprehensive-audit-handoff-v2.md`
- `docs/audits/2026-03-09-finance-plan-gap-and-ux-handoff.md`

### `claude.md`

- No `claude.md` file was found in the repository root tree during this pass.

---

## 2) Master feature extraction (condensed)

Across plans, intended capabilities cluster into:

- POS operations: orders, split bills, refunds/voids, kitchen/KDS, table workflows, cash sessions, reconciliation.
- Inventory and production: stock movement, recipe/components, production runs, variance and waste analysis.
- Accounting: invoices, quotations, credit notes, vendor bills, payments, recurring templates, budgets, ledgers, tax and reporting.
- Customer/staff: CRM, loyalty, statements, user/role management, manager authorization.
- Reliability/ops: audit logs, backup/restore, docs, performance hardening, deployment readiness.

---

## 3) Reconciliation status snapshot

### Fully implemented (broadly)

- Core POS, inventory, kitchen, and finance route surfaces are present and wired.
- Plan #16 finance UX/documentation baseline was completed previously.

### Partially implemented (important)

- Recurring automation Wave A: backend groundwork existed but lifecycle/run-history polish was incomplete before this pass.
- Deeper finance operations from handoff wave list remain partially implemented:
  - billable expense to invoice linkage (single/bulk)
  - unapplied/partially-applied payment allocation ledger workflows

### Not fully closed in this pass

- Full end-to-end closure of _every_ deferred plan item across all historic plans is still substantial and should be completed in phased follow-ups (especially deep accounting and procurement workflow items).

---

## 4) Features implemented in this pass

### Recurring lifecycle completion and history

- Hardened recurring generation lifecycle:
  - reject generation unless template is active
  - enforce remaining cycle limits
  - decrement cycles after generation
  - mark template completed when cycles end or end-date boundary is crossed
- Added recurring run persistence for both success and failure outcomes.
- Added `runHistory` API endpoint.
- Added recurring UI run-history modal and status/cycle visibility.
- Added recurring lifecycle DB migration (`0010_recurring_lifecycle_and_runs.sql`).

### Recurring template UX controls (industry-inspired)

- Added recurring form controls for:
  - start date
  - remaining cycles
  - price automation mode (`none`, `fixed_update`, `percent_increase`)
  - price automation value

---

## 5) Bugs/logic issues fixed in this pass

- Prevented generation for paused/completed recurring templates.
- Prevented generation when remaining cycles are exhausted.
- Fixed lifecycle state drift by explicitly syncing `status` + `isActive` to completion conditions.
- Added failure-path run logging so generation errors are inspectable (operational observability).

---

## 6) Industry research notes

Attempted direct web verification for Invoice Ninja, QuickBooks, and Sage 50/Peachtree product pages in this environment, but outbound HTTP was blocked with 403 at the network boundary.

Despite that limitation, implemented improvements aligned with mainstream accounting platform patterns:

- recurring schedule controls (start/end/cycle-aware lifecycle)
- price automation on recurring templates
- explicit generation run history for auditability and operator trust

---

## 7) Production-readiness observations

- Formatting and patch integrity checks pass.
- Dependency installation and full typecheck are currently blocked by upstream package/network restrictions in this execution environment.
- Recommend running full CI (install/typecheck/test/e2e/db migration) in a network-enabled runner before production deployment.

---

## 8) Additional implementation pass (this update)

- Added centralized financial calculation helpers in API lib:
  - safe rounding
  - discount computation with caps
  - invoice totals recomputation (subtotal, discount, tax, total)
  - recurring template normalization that recomputes totals after price automation
- Added recurring lifecycle helper to centralize completion/state transition logic.
- Hardened recurring API production behavior:
  - create/update now validates price-automation mode/value combinations
  - generation flow now runs inside a transaction for safer state consistency
  - retained failure run logging for observability
- Added focused automated tests:
  - financial calculations tests
  - recurring lifecycle state tests

These changes reduce drift between stored and computed monetary fields and improve recurring generation stability.

---

## 9) Extended enhancement implementation (current)

Implemented additional high-value roadmap items from the pending list:

- Billable expense to invoice flow foundation:
  - Added `expense.billable`, `expense.customerId`, `expense.invoicedAt`, `expense.invoiceId`, `expense.invoiceLineId`
  - Added API to list billable expenses (`invoiced` / `uninvoiced`)
  - Added API to bulk attach billable expenses into invoice line items with total recalculation and traceability updates on expenses
- Payment allocation ledger foundation:
  - Added `customer_payment`, `customer_payment_allocation`, and `customer_payment_ledger` tables
  - Added API for creating unapplied customer payments
  - Added API for allocating unapplied payments across invoices with customer/amount validation and immutable ledger entries
- Lifecycle timeline + scheduled send foundation:
  - Added `invoice_lifecycle_event` table
  - Added schedule-send endpoint for invoices/quotations (`scheduledSendAt`)
  - Added lifecycle timeline query endpoint
  - `markSent` now records explicit lifecycle events

These changes establish the core data model and API contracts required for full UI rollout, reconciliation, and future automation workers.
