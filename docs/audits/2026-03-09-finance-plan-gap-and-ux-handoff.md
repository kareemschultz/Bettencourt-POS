# Bettencourt Finance Plan Audit + UX Handoff (Research-Based)

Date: 2026-03-09  
Author: Codex (audit/report only, no code changes)

## Purpose
Review the proposed "Bettencourt Finance" implementation plan for gaps, missing features, UX risks, role/permission inconsistencies, and premium enhancements (inspired by QuickBooks, Odoo, ERPNext, Invoice Ninja, Sage 50), with **intuitive UX and ease of use** as the top priority.

## Method
- Reviewed current codebase state in `apps/web`, `packages/api`, `packages/db`, and docs.
- Compared the proposed plan against current architecture patterns.
- Benchmarked mainstream accounting/POS finance workflows from official product docs.

---

## Executive Verdict
The proposed plan is a strong start for AR/AP workflows, but it is **not implementation-ready yet**.  
It is missing several control-layer and UX-layer requirements that will cause rework, especially around:

- Financial integrity controls (auditability, reversals, period locks, allocation history)
- Permission consistency (route map vs sidebar module mapping vs role behavior)
- Navigation/IA scalability (too many flat finance pages without task-oriented grouping)
- Operational completeness (scheduler strategy, migration/backfill strategy, test coverage)

Recommendation: keep the 6-wave structure, but add a **Wave 0 (controls + UX architecture)** and adjust several task targets/files.

---

## Current Codebase Reality Check (Important Before Plan Execution)

### 1) New finance entities/routes in the plan are not present yet
- DB finance extensions (credit notes, vendor bills, recurring templates, budgets, invoice payment ledger) are not in schema:
  - `packages/db/src/schema/invoice.ts:37`
- API has only `cash` and `invoices` routers for finance-related backend:
  - `packages/api/src/routers/index.ts:53`
  - `packages/api/src/routers/index.ts:76`
- Finance routes proposed in the plan are not present yet:
  - `apps/web/src/routes/` (no `dashboard.finance.tsx`, `dashboard.credit-notes.tsx`, `dashboard.vendor-bills.tsx`, etc.)

### 2) Existing invoice payment model is still single-record style
- Invoice table stores aggregate payment fields (`amountPaid`, `chequeNumber`, `receiptNumber`, `datePaid`) directly:
  - `packages/db/src/schema/invoice.ts:63`
- API `markPaid` overwrites payment summary on invoice row; it does not maintain payment allocation history:
  - `packages/api/src/routers/invoices.ts:280`

### 3) Sidebar and route authorization have known consistency risks
- Sidebar section is still `"Finance & Billing"`:
  - `apps/web/src/components/layout/app-sidebar.tsx:543`
- Expenses are mapped to `settings` module in route-access:
  - `apps/web/src/lib/route-access.ts:28`
- But expense API is controlled by `shifts.*` permissions:
  - `packages/api/src/routers/cash.ts:556`
- This is already a role-consistency smell for accountant/admin/cashier behavior.

### 4) Existing vendor detail page is already advanced and should be reused
- Supplier detail route already has KPI cards, chart suite, statement preview/print/export:
  - `apps/web/src/routes/dashboard.suppliers.$id.tsx:705`
  - `apps/web/src/routes/dashboard.suppliers.$id.tsx:843`
  - `apps/web/src/routes/dashboard.suppliers.$id.tsx:1021`

### 5) Navigation updates must include multiple files (not only sidebar)
- Proposed plan only calls out sidebar and dashboard map, but there are additional navigation surfaces:
  - Command palette has its own finance menu definitions:
    - `apps/web/src/components/layout/command-palette.tsx:228`
  - Workspace default route options must be updated for new finance landing routes:
    - `apps/web/src/lib/workspace-preferences.ts:9`

---

## High-Priority Gaps In The Proposed Plan

## P0 (Must Add Before Build)

### P0.1 Financial control model is underspecified
Add explicit rules for:
- Immutable payment history (append-only, never overwrite)
- Reversal entries instead of hard delete for posted financial records
- Period locking (month close) and blocked edits on locked periods
- Approval thresholds (e.g., vendor bills/credits above limit need approval)

Without this, finance data will be hard to audit and reconcile later.

### P0.2 Missing posting/audit strategy
The plan adds operational tables but no explicit accounting event trail.
Add:
- `finance_audit_event` (who/what/when/before/after)
- Status transition constraints (`draft -> issued -> applied/paid/voided`)
- Server-side invariant checks for allocations and outstanding balances

### P0.3 Permission matrix is not fully specified for new modules
Current repo has multiple patterns (`settings`, `shifts`, `reports`, `invoices`) across similar finance workflows.
Before implementation, define one matrix for:
- executive
- admin
- accountant
- cashier
- warehouse/checkoff (explicit no-access where relevant)

Then map this matrix consistently across:
- router permission procedures
- `ROUTE_MODULE_MAP`
- sidebar modules
- command palette modules

### P0.4 Plan points to one outdated target
Route module map is in `apps/web/src/lib/route-access.ts`, not in `dashboard.tsx`.
Plan should be corrected to avoid lost work.

### P0.5 No migration/backfill strategy for moving from `amountPaid` aggregate to payment ledger
Add data migration tasks:
- backfill `invoicePayment` rows from current invoice-level paid fields
- reconcile `sum(invoice_payment.amount)` == `invoice.amountPaid`
- run idempotent backfill script with verification report

---

## P1 (Strongly Recommended In First Delivery)

### P1.1 IA/Navigation will become too heavy if all pages are flat
Current plan adds many new finance pages directly in sidebar. This is correct functionally, but high cognitive load.

Recommended final sidebar IA for finance:
- Finance Overview (`/dashboard/finance`)
- Receivables: Invoices, Quotations, Credit Notes, Customer Statements
- Payables: Vendor Bills, Suppliers, Expenses
- Controls: Recurring, Budgets, Tax Summary
- Financial Reports: Aging, P&L, Sales Journal, Reconciliation

If nested groups are not available, keep one flat list but in this order and with clear names (no mixed mental models).

### P1.2 Page naming and consolidation tweaks
Recommended renames:
- `Finance & Billing` -> `Finance`
- `Daily Sales Journal` -> `Sales Journal`
- `Profitability` -> `Product Profitability` (distinguish from P&L)
- `Suppliers` -> `Vendors` (optional, only if adopted globally)

Recommended consolidation:
- Keep supplier analytics and vendor statement in supplier detail route.
- Do not duplicate equivalent "vendor statement" capability in multiple places.

### P1.3 Plan misses cross-surface nav updates
Any new finance page must also update:
- `apps/web/src/components/layout/command-palette.tsx`
- `apps/web/src/lib/workspace-preferences.ts`
- `apps/web/src/routes/dashboard.tsx` (`PAGE_TITLES`)

### P1.4 Several Wave 4 PDF tasks are already partly implemented
Invoice PDF already includes:
- bank details + payment instructions
- TIN
- footer note
- balance due
References:
- `apps/web/src/lib/pdf/invoice-pdf.ts:137`
- `apps/web/src/lib/pdf/invoice-pdf.ts:229`
- `apps/web/src/lib/pdf/invoice-pdf.ts:275`
- `apps/web/src/lib/pdf/invoice-pdf.ts:288`

Adjust plan to avoid redoing completed behavior; only add missing payment-history table output.

---

## P2 (Premium Enhancements To Include In Handoff)

### P2.1 Reconciliation workbench
Add a reconciliation screen similar to Odoo/ERPNext approach:
- unmatched payments list
- suggested match candidates
- partial-match + write-off workflow
- audit trail of manual match decisions

### P2.2 Credit and bill automation
Add:
- auto-application suggestions for credits
- "apply all/oldest first" shortcuts
- duplicate bill detection (same supplier + invoice number + amount)

### P2.3 Customer statement and collections workflow
Add:
- dunning/reminder stages
- reminder templates
- reminder schedule (e.g., 3 days before due, on due, 7 days overdue)
- one-click communication history log on customer account

### P2.4 Recurring engine safety
Add:
- preview next generated document before activation
- skip/shift next run controls
- failure queue + retry logging
- idempotency key on generation runs

### P2.5 Budget intelligence
Beyond static budgets, add:
- forecast-at-month-end
- variance root-cause note per category
- threshold notifications routed by role

---

## UX-First Requirements (For Intuitive, Premium Feel)

### Core interaction model (apply to every new finance page)
- Top: KPI strip (3-6 cards)
- Middle: filter bar (search, date range, status, quick presets)
- Main: data table/cards with sticky action column
- Right/Drawer: detail and actions (no hard navigation for basic tasks)

### UX standards to enforce
- One primary CTA per page (clear hierarchy)
- Visible status chips with consistent semantic colors
- Empty states with next-step action text
- Skeleton loading states for all async panes
- Confirmation dialogs for destructive actions
- Undo for non-destructive state changes where possible

### Mobile/responsive requirements (explicit)
- Convert dense tables to card list on small screens
- Keep filters collapsible with chips summary
- Maintain core actions in sticky bottom action bar on mobile

### Accessibility requirements (explicit)
- WCAG 2.2 AA color contrast target
- Keyboard traversal for all dialogs/tables/actions
- Focus-visible styling in all interactive finance components
- Aria labels for icon-only actions

---

## Admin vs Cashier vs Accountant (Recommended Finance Matrix)

Use this as the baseline to prevent role drift:

- `cashier`
  - Can: view own cash session info, process POS payments
  - Cannot: invoices/credit notes/vendor bills/aging/tax/budgets
- `accountant`
  - Can: full read of finance + create/update on invoices, vendor bills, payments, statements, recurring, tax/budgets
  - Cannot: delete posted transactions, system settings unrelated to finance
- `admin`
  - Can: all accountant permissions + approval actions + configuration
- `executive`
  - Can: full access including strategic reports and lock/unlock periods

Implementation note: this matrix must be reflected in both permission payloads and UI visibility logic. Avoid role-only bypass paths that ignore module permissions.

---

## What To Add To Claude's Plan (Concrete)

Add a **Wave 0** before schema:
- Define finance status machine + lifecycle rules
- Define RBAC matrix for all new finance pages and actions
- Define migration/backfill design (`amountPaid` -> `invoicePayment` rows)
- Define reconciliation and audit-event requirements
- Define UX wireframe conventions and mobile behavior

Amend existing waves:
- Wave 2/5: include `command-palette.tsx` and `workspace-preferences.ts`
- Wave 4: only add missing PDF items (do not redo existing bank/TIN/footer functionality)
- Wave 6: add tests, not only type/build checks

Add test gates:
- API tests for payment allocation, credit application, aging buckets, tax summary
- UI tests for role-specific menu visibility and route access
- Regression checks for invoices/expenses existing flows

---

## Benchmark Features Worth Bringing In (Prioritized)

### Tier 1 (ship now)
- Credit notes/credit memos with controlled apply flow
- Vendor credits and bill settlement flow
- Recurring transaction templates
- Customer statements
- AR/AP aging
- Audit log for finance state changes

### Tier 2 (next release)
- Payment reconciliation workbench
- Deferred revenue/expense scheduling
- Multi-currency support with exchange-rate snapshots per document

### Tier 3 (premium roadmap)
- OCR-assisted vendor bill capture
- Customer portal self-service payments/statements
- Advanced approval workflows and anomaly flags

---

## Research Sources (Official Docs)

### QuickBooks (Intuit)
- Recurring transactions:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/recurring-transactions/create-recurring-transactions-quickbooks-online/L3xM2qSxZ_US_en_US
- Credit memos/refunds:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/credit-memos/create-apply-credit-memos-refunds-customers/L5e0g8XQm_US_en_US
- Vendor credits/refunds from bills:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/bill-management/enter-vendor-credits-refunds-bills/L71U6DnHz_US_en_US
- Record invoice payments:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/manage-invoices/record-invoice-payments-quickbooks-online/L5Fv7D7Bb_US_en_US
- Customer statements:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/customer-statements/create-send-customer-statements-quickbooks-online/L9yQkYgWk_US_en_US
- Audit log:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/audit-log/use-audit-log-quickbooks-online/L2WoVnMQQ_US_en_US

### Odoo
- Vendor bills:
  - https://www.odoo.com/documentation/19.0/applications/finance/accounting/vendor_bills.html
- Bank reconciliation:
  - https://www.odoo.com/documentation/19.0/applications/finance/accounting/bank/reconciliation.html
- Deferred revenues:
  - https://www.odoo.com/documentation/19.0/applications/finance/accounting/customer_invoices/deferred_revenues.html

### ERPNext
- Payment reconciliation:
  - https://docs.frappe.io/erpnext/user/manual/en/payment-reconciliation
- Accounting reports:
  - https://docs.frappe.io/erpnext/user/manual/en/accounting-reports
- Payment entry:
  - https://docs.frappe.io/erpnext/user/manual/en/payment-entry
- Journal entry:
  - https://docs.frappe.io/erpnext/user/manual/en/journal-entry
- Multi-currency accounting:
  - https://docs.frappe.io/erpnext/user/manual/en/multi-currency-accounting

### Invoice Ninja
- Credits:
  - https://invoiceninja.github.io/en/credits
- Recurring invoices:
  - https://invoiceninja.github.io/en/recurring-invoices
- Client portal:
  - https://invoiceninja.github.io/en/client-portal
- Invoice reminders:
  - https://invoiceninja.github.io/en/reminders

### Sage 50
- Aged receivables report:
  - https://help-sage50.na.sage.com/en-us/2024/Content/Reports_Forms/Customers_Sales/AR_Reports.htm
- Recurring transaction manager:
  - https://help-sage50.na.sage.com/en-us/2024/Content/Transactions/Recurring/Recurring_Transaction_Manager.htm
- Audit trail report:
  - https://help-sage50.na.sage.com/en-us/2024/Content/Reports_Forms/General_Ledger/G_L_Reports.htm

### UX/Accessibility
- Nielsen heuristics:
  - https://www.nngroup.com/articles/ten-usability-heuristics/
- WCAG 2.2 quick reference:
  - https://www.w3.org/WAI/WCAG22/quickref/
- WAI-ARIA APG:
  - https://www.w3.org/WAI/ARIA/apg/

---

## Final Handoff Summary For Claude
Use the current 6-wave plan as baseline, but do not implement as-is.  
First apply this report's Wave 0 corrections, RBAC matrix, navigation surface coverage, and control-layer requirements.  
If those are included, implementation can proceed with far less rework and a much more intuitive, professional finance experience.
