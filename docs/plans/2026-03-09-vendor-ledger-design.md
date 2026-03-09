# Vendor Ledger & Analytics — Design Document
**Date:** 2026-03-09
**Requested by:** Shakira (Bettencourt's Food Inc.)
**Status:** Approved for implementation

---

## Overview

A dedicated vendor detail page reachable from the Suppliers list and from any vendor badge in the Expenses table. Provides full transaction history, spend analytics, and a printable vendor statement — all scoped per vendor with flexible period filtering.

---

## Navigation & Entry Points

- **From Suppliers page** — clicking any vendor row navigates to `/dashboard/suppliers/:id`
- **From Expenses table** — vendor badge in the Supplier column is a clickable link to the same page
- **Breadcrumb** — `Suppliers › {Vendor Name}` at the top of the page for easy back-navigation

---

## Page Layout (top to bottom)

### 1. Header Strip

| Element | Detail |
|---|---|
| Vendor name (h1) | Large, prominent |
| Category tags | Colored badges (Food & Beverage, Utilities, etc.) |
| Active / Inactive badge | Green / gray pill |
| Contact block | Contact name · phone · email · address |
| Action buttons | **Edit Vendor** (opens existing edit dialog) · **+ Add Expense** (opens new expense dialog pre-filled with this vendor) |

### 2. KPI Summary Cards (6 cards, responsive grid)

All 6 cards **update live** when the period filter changes:

| Card | Value | Sub-text |
|---|---|---|
| Period Spend | GYD total for selected range | "X transactions" |
| vs. Previous Period | % change up/down arrow | Compared to equal prior window |
| All-Time Spend | Lifetime GYD total | Since first transaction |
| Average Transaction | Period average per expense | Helps spot price creep |
| Last Purchase | Date of most recent expense | "X days ago" |
| Largest Single Expense | Highest single amount in period | With description |

### 3. Analytics Row (2 charts, side-by-side on desktop, stacked on mobile)

**Chart A — Monthly Spend Trend (bar chart)**
- Always shows the last 12 calendar months regardless of period filter
- Highlights the currently selected period's months in accent color
- Hover tooltip shows month total + transaction count
- Helps Shakira spot seasonal patterns (e.g. snapper supplier spikes during Lent)

**Chart B — Spend by Category (horizontal bar chart)**
- Scoped to the selected period
- Shows each expense category this vendor appears in, sorted by amount descending
- E.g. "Food & Beverage GYD 45,000 · Cleaning Supplies GYD 3,200"
- Percentage of total shown on each bar

### 4. Transaction Table

**Period selector** (top-right of section):
- Quick presets: Today · This Week · This Month · Last Month · This Quarter · Last Quarter · This Year · All Time · Custom Range
- Default: This Month

**Table columns:**
| Column | Notes |
|---|---|
| Date | Guyana timezone, sortable |
| Description | Truncated with tooltip on hover |
| Category | Colored badge |
| Payment Method | Cash / Card / Bank Transfer / Cheque |
| Reference # | Invoice/receipt number, copyable |
| Authorized By | Staff name |
| Amount (GYD) | Right-aligned, sortable |

**Table footer (pinned):**
- `{N} transactions · Total: GYD X,XXX.XX` — always visible at the bottom of filtered results

**Table controls:**
- Search bar — filters description and reference number in real time
- Category dropdown — filter within this vendor's transactions only
- Sort by Date (default desc) or Amount

**Action buttons (top-right):**
- **Print Vendor Statement** → generates PDF
- **Export CSV** → downloads filtered transactions as CSV

---

## Vendor Statement PDF

Mirrors the transaction table exactly. Layout:

```
┌─────────────────────────────────────────────────────────┐
│  [Bettencourt's Logo]    VENDOR STATEMENT               │
│  Bettencourt's Food Inc.                                │
│  Georgetown, Guyana · bettencourtsfood@gmail.com        │
├─────────────────────────────────────────────────────────┤
│  VENDOR                    STATEMENT PERIOD             │
│  {Vendor Name}             {Start Date} – {End Date}    │
│  {Contact Name}                                         │
│  {Phone} · {Email}         Generated: {timestamp}       │
├─────────────────────────────────────────────────────────┤
│  Date    Description   Category   Ref #   Method  Amt  │
│  ──────────────────────────────────────────────────── │
│  ...rows...                                             │
├─────────────────────────────────────────────────────────┤
│  {N} transactions                  TOTAL  GYD X,XXX.XX │
├─────────────────────────────────────────────────────────┤
│  Category Breakdown                                     │
│  Food & Beverage .............. GYD XX,XXX             │
│  Utilities .................... GYD X,XXX              │
├─────────────────────────────────────────────────────────┤
│  Prepared by: {user name}  ·  {timestamp}               │
└─────────────────────────────────────────────────────────┘
```

- Category subtotals section at the bottom of the PDF (above footer)
- Same styling as existing invoice PDF (Bettencourt's brand, clean sans-serif)

---

## Quality-of-Life Enhancements

| Enhancement | Description |
|---|---|
| **Pre-filled expense dialog** | "Add Expense" button on vendor page pre-selects this vendor — saves 2 clicks |
| **Clickable vendor badges in expenses table** | Existing expenses page vendor badges become links |
| **Period % change card** | Shows if spend went up or down vs. the prior equivalent period — catches price creep |
| **Duplicate flag** | If two expenses exist within 7 days with the same amount for this vendor, show a yellow warning icon with tooltip "Possible duplicate" |
| **Zero-expense months greyed** | Monthly chart shows all 12 months — gaps are visible at a glance |
| **CSV includes all fields** | Reference #, payment method, notes, authorized by — not just date/amount |
| **Keyboard shortcut** | `Esc` navigates back to Suppliers list from the detail page |
| **Empty state** | If vendor has no expenses, shows "No expenses recorded for this vendor yet" + direct "Add Expense" button |

---

## Technical Implementation

### New Files
| File | Purpose |
|---|---|
| `apps/web/src/routes/dashboard.suppliers.$id.tsx` | New vendor detail page |
| `apps/web/src/lib/pdf/vendor-statement-pdf.ts` | PDF generator (mirrors invoice-pdf.ts pattern) |

### Modified Files
| File | Change |
|---|---|
| `apps/web/src/routes/dashboard.expenses.tsx` | Make vendor badges clickable links |
| `packages/api/src/routers/cash.ts` | Add `getSupplierSpendSummary`, `getSupplierMonthlySpend`, `getSupplierCategoryBreakdown` procedures |

### New API Procedures (in `cash.ts` router)

```typescript
// All-time stats + period stats in one call
getSupplierSpendSummary(supplierId, startDate?, endDate?)
// Returns: periodTotal, periodCount, allTimeTotal, allTimeCount,
//          lastPurchaseDate, avgTransactionPeriod, largestExpensePeriod,
//          previousPeriodTotal (for % change card)

// 12-month grouped spend for bar chart
getSupplierMonthlySpend(supplierId)
// Returns: [{ month: "2026-02", total: "45200.00", count: 8 }, ...]

// Category breakdown for selected period
getSupplierCategoryBreakdown(supplierId, startDate?, endDate?)
// Returns: [{ category: "Food & Beverage", total: "45200.00", pct: 78 }, ...]
```

### No Schema Changes Required
All data already exists — `expense.supplierId` FK is in place, `expense.category` is already stored. This feature is pure query-layer + UI.

---

## Out of Scope (not in this plan)
- Outstanding balance tracking (would require invoice-to-expense matching)
- Vendor rating / performance scoring
- Automated reorder suggestions
- Multi-currency vendor spend (all GYD for now, USD conversion is order-level only)

---

## Definition of Done
- [ ] Vendor detail page renders at `/dashboard/suppliers/:id`
- [ ] All 6 KPI cards update on period change
- [ ] Monthly trend chart (12 months) renders correctly
- [ ] Category breakdown chart renders for selected period
- [ ] Transaction table with search, filter, sort, and pinned total footer
- [ ] Print Vendor Statement PDF matches layout spec
- [ ] CSV export includes all columns
- [ ] Vendor badges in expenses table are clickable links
- [ ] "Add Expense" pre-fills vendor
- [ ] Duplicate flag logic works
- [ ] Zero TS errors, clean build
- [ ] Docs updated (USER-MANUAL.md + fumadocs)
