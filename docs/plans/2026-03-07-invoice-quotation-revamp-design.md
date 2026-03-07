# Invoice & Quotation Revamp — Design Document
**Date:** 2026-03-07
**Status:** Approved
**Scope:** Full revamp of invoice and quotation pages — PDF fix, new features, professional document design

---

## Problem Statement

1. **PDF blocking** — Quotation `window.print()` prints the entire page (header, filters, list table) because `print:hidden` classes were never added to layout wrappers. Invoice works correctly but both should be migrated to Blob URL for consistency.
2. **Missing financial fields** — No tax rate, no discount, no payment terms, no balance due tracking.
3. **Missing UX** — No product/customer auto-complete, no duplicate action, no aging summary, no date/customer filters.
4. **PDF document design** — Current letterhead is minimal text-only. Needs professional layout with logo, colored header band, clean table, payment instructions.

---

## Architecture

### PDF Generation: Blob URL Pattern
Both pages replace `window.print()` with the existing Blob URL pattern (used by orders):
```ts
const html = buildInvoicePdf(invoice)
const blob = new Blob([html], { type: 'text/html' })
const url = URL.createObjectURL(blob)
window.open(url, '_blank')
setTimeout(() => URL.revokeObjectURL(url), 15_000)
```
The HTML document is fully self-contained (inline CSS, base64 logo via fetch, no external deps).

### Database Changes (Migration `0006`)
Add to `invoice` table:
- `discount_type` text — `'percent'` | `'fixed'` (default `'percent'`)
- `discount_value` numeric(12,2) — amount or percent (default 0)
- `tax_mode` text — `'invoice'` | `'line'` (default `'invoice'`)
- `tax_rate` numeric(5,2) — percent e.g. 16.5 (default 16.5)
- `payment_terms` text — `'due_on_receipt'` | `'net_15'` | `'net_30'` | `'net_60'` | `'custom'`

Add to `quotation` table:
- `discount_type`, `discount_value`, `tax_mode`, `tax_rate` (same as above)
- `terms_and_conditions` text — optional T&C text printed on PDF

Add to `invoice` line item schema (jsonb):
- `tax_exempt` boolean — per-line tax exemption when `tax_mode = 'line'`

### API Changes
- `invoices.create` / `invoices.update` — accept new fields
- `quotations.create` / `quotations.update` — accept new fields
- Both list endpoints — include new columns in SELECT
- New `invoices.duplicate` and `quotations.duplicate` procedures

---

## Features

### 1. Tax System
**Invoice-level mode** (default): Single tax rate % applied to `subtotal - discount`. Tax rate is editable (default 16.5% GY VAT). Toggle on the form: `Invoice-level tax`.

**Line-level mode**: Each line item gets a `Taxable` checkbox. Tax is summed only from taxable lines × the rate. Toggle on the form: `Per-line tax`.

The form header has a compact settings bar:
```
[Tax mode: Invoice ▼]  [Rate: 16.5 %]  [Discount: % ▼]  [Amount: 0]
```

### 2. Discount
Single invoice/quotation-level discount. Toggle between **%** (percent of subtotal) and **GYD** (fixed deduction). Shown as a deduction line in the totals section.

### 3. Payment Terms (Invoice only)
Dropdown: Due on Receipt / Net 15 / Net 30 / Net 60 / Custom.
Shown on PDF below the invoice dates. Informs the due date automatically if selected before due date is set.

### 4. Balance Due & Partial Payments
Totals section shows:
```
Subtotal:       GYD xxx,xxx
Discount:      -GYD x,xxx
Tax (16.5%):    GYD x,xxx
─────────────────────────
Total:          GYD xxx,xxx
Paid:          -GYD x,xxx
─────────────────────────
Balance Due:    GYD xxx,xxx   ← bold, colored red if > 0
```

### 5. Overdue Badge
Invoice detail panel shows a red `OVERDUE` badge if `dueDate < today` and `status ∉ {paid, cancelled}`.

### 6. Mark as Sent
One-click button on detail panel for Draft invoices/quotations → sets status to `sent`.

### 7. Duplicate
"Duplicate" button on the detail panel. Clones all fields (customer, items, tax/discount settings) into a new draft with a new number.

### 8. Product Auto-complete on Line Items
Typing in the description field shows a dropdown of matching products from the catalog. Selecting one auto-fills description, unit price. Uses existing `orpc.products.list` endpoint.

### 9. Customer Auto-complete
Customer name field shows matching customers from `orpc.customers.list`. Selecting one fills name, phone, address.

### 10. Filters
- **Date range** — from/to date pickers (default: current month)
- **Customer** — text search filter (already exists via search)
- Both added to the existing filter bar

### 11. Aging Summary Cards
Above the invoice list, 4 stat cards:
```
[Total Outstanding]  [Overdue]  [Paid This Month]  [Draft Count]
```
Computed via a new `invoices.getSummary` endpoint (single SQL query with CASE aggregation).

### 12. Outstanding Balance Column
Invoice list table gains a "Balance" column showing `total - amountPaid` (shown in red if > 0).

### 13. Terms & Conditions (Quotation only)
Multi-line text area on the quotation form. Printed above the signature section on the PDF.

### 14. Quotation Revisions
"Revise" button on a sent/accepted quotation: creates a new quotation with the same content but appends `-R2`, `-R3` to the number. Links back via a `parent_quotation_id` field (new column).

---

## PDF Document Design

### Invoice PDF Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [LOGO]  Bettencourt's Food Inc.     ║  INVOICE             │  ← dark header band
│          Georgetown, Guyana          ║  #INV-0001           │
│          Tel: +592 xxx-xxxx          ║  Issued: DD/MM/YYYY  │
│          TIN: xxx-xxx-xxx            ║  Due: DD/MM/YYYY     │
│                                      ║  Terms: Net 30       │
├─────────────────────────────────────────────────────────────┤
│  BILL TO                                                      │
│  Customer Name                                               │
│  Phone · Address                                             │
├──────────────────────┬──────┬──────────┬────────┬───────────┤
│  Description         │  Qty │  Price   │  Tax   │  Total    │
├──────────────────────┼──────┼──────────┼────────┼───────────┤
│  Item 1              │   2  │ $5,000   │  ✓     │ $10,000   │
│  Item 2              │   1  │ $3,500   │  ✗     │  $3,500   │
├──────────────────────┴──────┴──────────┴────────┴───────────┤
│                                    Subtotal:  GYD 13,500    │
│                                    Discount:  GYD    500    │
│                                 Tax (16.5%):  GYD  2,145   │
│                                    ─────────────────────    │
│                                       Total:  GYD 15,145   │
│                                        Paid:  GYD  5,000   │
│                                 Balance Due:  GYD 10,145   │  ← bold red
├─────────────────────────────────────────────────────────────┤
│  PAYMENT INSTRUCTIONS                                        │
│  Bank: Republic Bank · Account: xxxx-xxxx · Ref: INV-0001  │
├─────────────────────────────────────────────────────────────┤
│  Notes: ...                                                  │
│  Prepared by: [user name]                                    │
└─────────────────────────────────────────────────────────────┘
         Bettencourt's Food Inc. · Thank you for your business
```

### Quotation PDF Layout
Same as invoice, with:
- "QUOTATION" stamp badge replacing "INVOICE" label (bordered box, primary color)
- Valid Until shown instead of Due Date
- T&C section printed above signature
- Two signature lines at bottom (Authorized By / Accepted By)
- Validity countdown: "This quotation is valid for X more days"

### PDF Styling
- **Header band**: Dark background (`#1a1a2e` or brand primary) with white text — gives it a premium, professional look
- **Table**: Alternating row shading (`#f9f9f9`), clean `1px` borders
- **Totals**: Right-aligned, bold Total and Balance Due rows with top border separator
- **Balance Due**: Red if unpaid, green if fully paid
- **Font**: System sans-serif, 11pt body, 9pt table data
- **Logo**: Fetched as base64 and embedded so it prints offline

---

## Files Changed

### DB
- `packages/db/src/schema/invoice.ts` — add new columns
- `packages/db/src/migrations/0006_invoice_quotation_enhancements.sql`

### API
- `packages/api/src/routers/invoices.ts` — new fields, `duplicate`, `getSummary`
- `packages/api/src/routers/quotations.ts` — new fields, `duplicate`, `parent_quotation_id`

### Web
- `apps/web/src/routes/dashboard.invoices.tsx` — full revamp
- `apps/web/src/routes/dashboard.quotations.tsx` — full revamp
- `apps/web/src/lib/pdf/invoice-pdf.ts` — new: Blob PDF builder for invoices
- `apps/web/src/lib/pdf/quotation-pdf.ts` — new: Blob PDF builder for quotations

---

## Out of Scope (Future)
- Email sending (requires SMTP integration)
- Recurring invoices
- Multi-currency
- QR code (low priority, can add later)
