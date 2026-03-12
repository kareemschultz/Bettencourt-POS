# Plan 19 — Dashboard & Reporting Design

**Date:** 2026-03-12
**Status:** Approved
**Migration:** None required

## Overview

Three data visibility improvements: a Financial Pulse KPI row on the executive dashboard, a week-over-week sales comparison chart on the Analytics page, and a Budget vs Actual chart on the Budgets page.

---

## T1 — Dashboard Financial Pulse Row

**Problem:** The executive dashboard shows POS/sales KPIs well but has no financial or inventory context. Shakira has to navigate to Finance or Inventory to see outstanding invoices or low stock.

**Design:**
- Extend `getSummary()` in `packages/api/src/routers/dashboard.ts` with 4 new fields:
  - `expensesToday: string` — sum of expenses created today (Guyana timezone)
  - `openInvoicesCount: number` — invoices with status `sent` or `partial`
  - `openInvoicesTotal: string` — sum of outstanding balances
  - `overdueInvoicesCount: number` — open invoices where `due_date < today`
  - `lowStockCount: number` — unacknowledged stock alerts
- UI: Add a "Financial Pulse" row below the existing 4-card stats row on the executive dashboard
  - Cards: **Expenses Today** | **AR Outstanding** (with sub-count) | **Overdue** (red badge if > 0) | **Low Stock** (amber badge, links to `/dashboard/stock-alerts`)
- No schema changes — all computed at query time

---

## T2 — Weekly Sales Comparison Chart

**Problem:** The Analytics page shows historical data but no easy "this week vs last week" comparison. Hard to spot trends at a glance.

**Design:**
- New `getWeeklyComparison()` procedure in `packages/api/src/routers/analytics.ts` (or reports router)
- Returns two 7-element arrays (Mon–Sun) for current week and previous week:
  - `day: string`, `thisWeekRevenue: string`, `lastWeekRevenue: string`, `thisWeekOrders: number`, `lastWeekOrders: number`
- Uses Guyana timezone for day boundaries
- UI: New "Week-over-Week" section on Analytics page with a grouped BarChart (Recharts, two bars per day — this week vs last week)
- Toggle: Revenue / Orders view
- Placed below the existing charts on the analytics page

---

## T3 — Budget vs Actual Chart

**Problem:** The Budgets page shows budget amounts but no comparison against what was actually spent. No way to tell at a glance if you're on track.

**Design:**
- New `getBudgetVsActual()` procedure in `packages/api/src/routers/budgets.ts`
- For the current month (Guyana timezone), joins `budget` amounts against actual `expense` totals grouped by category
- Returns per-category: `category: string`, `budgeted: string`, `actual: string`, `variance: string` (negative = over budget)
- UI: Horizontal grouped bar chart added to `/dashboard/budgets` page
  - Two horizontal bars per category row: Budget (teal) and Actual (colour-coded: green if under, red if over)
  - Summary row: total budgeted vs total actual with percentage
- Placed as a new card below the existing budgets table

---

## Files Changed

| File | Change |
|------|--------|
| `packages/api/src/routers/dashboard.ts` | Extend `getSummary()` with financial + stock fields |
| `packages/api/src/routers/analytics.ts` | Add `getWeeklyComparison()` |
| `packages/api/src/routers/budgets.ts` | Add `getBudgetVsActual()` |
| `apps/web/src/routes/dashboard._index.tsx` | Financial Pulse KPI row |
| `apps/web/src/routes/dashboard.analytics.tsx` | Week-over-week chart section |
| `apps/web/src/routes/dashboard.budgets.tsx` | Budget vs Actual chart |
