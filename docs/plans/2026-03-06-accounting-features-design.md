# Bettencourt POS — Accounting & QuickBooks-Style Features

**Date:** 2026-03-06
**Approach:** Quick Wins + Deep Build (Approach C)
**Status:** APPROVED

---

## Overview

Add restaurant-specific accounting features that QuickBooks can't handle well, plus generic export for bookkeeper workflows. Two phases:

- **Phase 1 (Immediate):** Labor cost dashboard, menu profitability, accounting export — uses existing data
- **Phase 2 (Deep Build):** Food waste tracking, COGS variance analysis — requires new data collection

---

# PHASE 1: Reports from Existing Data + Accounting Export

## 1.1 Labor Cost Dashboard

**Goal:** Show labor as % of revenue, cost per labor hour, trends. Uses existing `time_entry` + `order` data.

**Schema changes:**
- `user` table: add `hourlyRate` numeric(10,2) nullable — if not set, use org-level default
- Organization settings JSON: add `defaultHourlyRate` number (fallback rate)

**API:** Extend `packages/api/src/routers/analytics.ts`:
- `getLaborDetails` — input: startDate, endDate. Returns daily breakdown: date, hoursWorked, laborCost, revenue, laborPercent. Also per-employee: name, role, hours, cost.
- `getLaborTrend` — input: days (30/60/90). Returns daily labor % for trend chart.
- `getLaborByRole` — input: startDate, endDate. Groups hours and cost by user role.

**Frontend:** New route `apps/web/src/routes/dashboard.labor.tsx`:
- KPI cards: Today's Labor %, This Week %, Month %, Revenue/Labor Hour
- 30-day trend chart (horizontal bar chart like analytics page)
- Target line at 30% (configurable via org settings)
- Employee breakdown table: Name | Role | Hours | Cost | Revenue (if cashier) | Cost/Hour
- Role summary: Cashier total, Kitchen total, Admin total
- Date range filter

## 1.2 Menu Item Profitability

**Goal:** Per-product margin analysis. Revenue from `order_line_item`, cost from `product.cost`.

**API:** Extend `packages/api/src/routers/reports.ts`:
- `getMenuProfitability` — input: startDate, endDate, departmentId (optional). Returns per-product: name, department, unitsSold, revenue, totalCost, marginDollars, marginPercent, foodCostPercent, abcClass (A/B/C based on cumulative revenue contribution).
- `getDepartmentProfitability` — input: startDate, endDate. Returns per-department: name, unitsSold, revenue, totalCost, marginPercent, foodCostPercent.

**Frontend:** New route `apps/web/src/routes/dashboard.profitability.tsx`:
- Summary cards: Overall Food Cost %, Avg Margin %, Best Performer (name + margin), Worst Performer
- Toggle: Product View / Department View
- Product table: Product | Dept | Units | Revenue | Cost | Margin $ | Margin % | Food Cost % | ABC
- Color coding: green (margin >60%), amber (40-60%), red (<40%)
- ABC badges: A (green, top 80% revenue), B (amber, next 15%), C (red, bottom 5%)
- Department rollup cards with mini bar charts
- Date range filter
- Export to CSV button

## 1.3 Generic Accounting Export

**Goal:** Export financial data in QuickBooks, Xero, and generic CSV formats.

**API:** Extend `packages/api/src/routers/journal.ts`:
- `getExportPreview` — input: startDate, endDate, format (csv|qbo|xero). Returns first 10 rows as preview + total row count.
- `getExportData` — input: startDate, endDate, format. Returns full export data as structured array.

Export formats:
- **Generic CSV:** Date, Account, Description, Debit, Credit, Reference
- **QuickBooks IIF:** Tab-delimited with QBO headers (TRNS, SPL, ENDTRNS blocks). Maps accounts to standard QBO account names (Sales Income, Sales Tax Payable, Cash on Hand, etc.)
- **Xero CSV:** Date, Description, Account Code, Debit, Credit, Tax Rate, Reference. Uses Xero manual journal import format.

Account mapping:
| POS Account | QBO Account | Xero Account Code |
|---|---|---|
| Sales Revenue | Sales Income | 200 |
| Tax Collected | Sales Tax Payable | 820 |
| Cash Received | Cash on Hand | 090 |
| Card Payments | Accounts Receivable | 120 |
| Discounts Given | Discounts Given | 260 |
| Refunds Issued | Refunds & Returns | 261 |
| Expenses | Operating Expenses | 400 |

**Frontend:** Enhance existing `apps/web/src/routes/dashboard.journal.tsx`:
- New "Export" section below journal table
- Format selector: Generic CSV | QuickBooks (IIF) | Xero (CSV)
- Preview table showing first 5 rows in selected format
- "Download" button → generates file client-side and triggers download
- Date range already exists on the page

## 1.4 Enhancements (Added)

### Cash Flow Summary
Add to journal page: a "Cash Flow" card showing:
- Cash In: sales (cash + card), gift card sales, reloads
- Cash Out: refunds, expenses, payouts, drops
- Net Cash Flow for period

### Profit & Loss Statement
**API:** New procedure in `journal.ts`:
- `getProfitAndLoss` — input: startDate, endDate. Returns structured P&L:
  - Revenue: gross sales, discounts, refunds → net revenue
  - COGS: from product costs × quantities sold
  - Gross Profit: net revenue - COGS
  - Operating Expenses: from expense table by category
  - Labor Cost: from time_entry hours × hourly rates
  - Net Profit: gross profit - expenses - labor

**Frontend:** New route `apps/web/src/routes/dashboard.pnl.tsx`:
- Standard P&L format with indented line items
- Comparison: this period vs previous period (% change)
- Print-friendly layout
- Export to CSV/PDF

---

# PHASE 2: Food Waste & Variance Analysis

## 2.1 Food Waste Tracking

**Goal:** Log spoilage, over-prep, and expired items. Track waste cost impact on COGS.

**Schema:** New table in `packages/db/src/schema/inventory.ts`:
```
wasteLog:
  id              uuid PK
  organizationId  uuid FK → organization
  inventoryItemId uuid FK → inventoryItem (nullable — for tracked items)
  productName     text NOT NULL (snapshot — in case item not in inventory)
  quantity         numeric NOT NULL
  unit            text NOT NULL (kg, units, liters, etc.)
  estimatedCost   numeric(10,2) NOT NULL
  reason          text NOT NULL (spoilage, over_prep, expired, dropped, other)
  notes           text nullable
  loggedBy        text FK → user
  createdAt       timestamp
```

**API:** New procedures in `packages/api/src/routers/inventory.ts`:
- `logWaste` — create waste entry, auto-calculate cost from inventory item if linked
- `getWasteLog` — list with filters: date range, reason, item
- `getWasteSummary` — aggregated: total waste cost, by reason, by item, trend over time
- `getWasteByDepartment` — waste cost grouped by product department

**Frontend:** New route `apps/web/src/routes/dashboard.waste.tsx`:
- Quick log form: item (autocomplete from inventory), quantity, unit, reason dropdown, notes
- Summary cards: Today's Waste, This Week, This Month, vs Revenue %
- Waste by reason pie/bar chart
- Top wasted items table
- Trend chart: daily waste cost over 30 days
- Date range filter

## 2.2 COGS Variance Analysis

**Goal:** Compare expected ingredient usage (based on sales × recipes) vs actual inventory changes. Flags potential theft, over-portioning, or unlogged waste.

**Schema:** New table in `packages/db/src/schema/inventory.ts`:
```
recipeIngredient:
  id              uuid PK
  productId       uuid FK → product (the menu item)
  inventoryItemId uuid FK → inventoryItem (the ingredient)
  quantity        numeric NOT NULL (amount of ingredient per 1 unit of product)
  unit            text NOT NULL
  createdAt       timestamp
```

**API:** New procedures in `packages/api/src/routers/reports.ts`:
- `getVarianceAnalysis` — input: startDate, endDate. For each ingredient:
  1. Expected usage = SUM(units_sold × recipe_quantity) from order_line_item
  2. Actual usage = opening_stock - closing_stock + received (from stock_ledger)
  3. Logged waste (from waste_log)
  4. Unaccounted variance = actual - expected - waste
  5. Variance % and cost impact
- `getVarianceAlerts` — items with variance > threshold (e.g. 10%)

**Frontend:** New route `apps/web/src/routes/dashboard.variance.tsx`:
- Summary: Total Unaccounted Variance $ and %
- Table: Ingredient | Expected | Actual | Waste | Unaccounted | Variance % | Cost Impact
- Color coding: green (<5%), amber (5-10%), red (>10%)
- Alert badges for items exceeding threshold
- Date range filter
- "Investigate" link → drill into stock ledger for that item

## 2.3 Recipe Management (Supporting Feature)

**Goal:** Define ingredient lists for menu items so variance analysis can calculate expected usage.

**Frontend:** Add "Recipe" tab to product edit dialog in `dashboard.products.tsx`:
- List of ingredients (from inventory items) with quantity and unit
- Add/remove ingredients
- Auto-calculate theoretical food cost from ingredient costs
- Show food cost % vs selling price

---

# IMPLEMENTATION CHECKLIST

## Phase 1: Immediate (from existing data)
- [x] 1.1.1 Add `hourlyRate` column to user table
- [x] 1.1.2 Add `defaultHourlyRate` to org settings
- [x] 1.1.3 Create labor analytics API procedures (3 procedures)
- [x] 1.1.4 Build dashboard.labor.tsx route page
- [x] 1.1.5 Add Labor to sidebar navigation
- [x] 1.2.1 Create menu profitability API procedures (2 procedures)
- [x] 1.2.2 Build dashboard.profitability.tsx route page
- [x] 1.2.3 Add Profitability to sidebar navigation
- [x] 1.3.1 Create accounting export API procedures (2 procedures)
- [x] 1.3.2 Add export section to dashboard.journal.tsx
- [x] 1.3.3 Implement QBO IIF format generator
- [x] 1.3.4 Implement Xero CSV format generator
- [x] 1.4.1 Add cash flow summary to journal page
- [x] 1.4.2 Create P&L API procedure
- [x] 1.4.3 Build dashboard.pnl.tsx route page
- [x] 1.4.4 Add P&L to sidebar navigation

## Phase 2: Deep Build (new data collection)
- [x] 2.1.1 Create `wasteLog` table in schema
- [x] 2.1.2 Create waste API procedures (4 procedures)
- [x] 2.1.3 Build dashboard.waste.tsx route page
- [x] 2.1.4 Add Waste Tracking to sidebar navigation
- [x] 2.2.1 Create `recipeIngredient` table in schema
- [x] 2.2.2 Create variance analysis API procedures (2 procedures)
- [x] 2.2.3 Build dashboard.variance.tsx route page
- [x] 2.2.4 Add Variance to sidebar navigation
- [x] 2.3.1 Build recipe tab in product edit dialog
- [x] 2.3.2 Auto-calculate theoretical food cost from recipe

---

# SIDEBAR NAVIGATION ADDITIONS

Management group:
- Labor Cost → `/dashboard/labor` (icon: Users/Clock hybrid)
- Profitability → `/dashboard/profitability` (icon: TrendingUp)
- P&L Statement → `/dashboard/pnl` (icon: FileSpreadsheet)

Inventory group:
- Waste Log → `/dashboard/waste` (icon: Trash2)
- Variance → `/dashboard/variance` (icon: GitCompare)
