# Wave 1: Quick Wins + Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver 4 self-contained features: Tax Config UI, Receipt Customization, Employee Time Clock, and End-of-Day Report.

**Architecture:** Each feature follows the same pattern: schema (if needed) → API procedures → frontend UI. All features use existing Drizzle schema, oRPC routers, and React Router + TanStack Query patterns already established in the codebase.

**Tech Stack:** Drizzle ORM, oRPC, React Router, TanStack Query, shadcn/ui, Sonner toasts.

---

## Task 1: Tax Config UI — API CRUD procedures

**Files:**
- Modify: `packages/api/src/routers/settings.ts`

**Steps:**
1. Add `createTaxRate` procedure — accepts name, rate (0-100), isDefault, isInclusive; inserts into `taxRate` table. If isDefault=true, unset other defaults first.
2. Add `updateTaxRate` procedure — accepts id + partial fields; same default logic.
3. Add `deleteTaxRate` procedure — accepts id; checks if any products reference this rate (via product.taxRate matching the rate value); soft-deletes by setting isActive=false.
4. Verify: `bun run typecheck`

---

## Task 2: Tax Config UI — Frontend

**Files:**
- Modify: `apps/web/src/routes/dashboard.settings.tsx`

**Steps:**
1. Replace the read-only `TaxRatesTab` with full CRUD: Add button, edit/delete per row, dialog for create/edit.
2. Add tax preview calculation in the dialog.
3. Verify: `bun run typecheck`

---

## Task 3: Receipt Config — Schema + API

**Files:**
- Modify: `packages/db/src/schema/organization.ts` — add `receiptConfig` table
- Modify: `packages/db/src/schema/index.ts` — export new table
- Modify: `packages/api/src/routers/settings.ts` — add getReceiptConfig, updateReceiptConfig

---

## Task 4: Receipt Config — Frontend

**Files:**
- Modify: `apps/web/src/routes/dashboard.settings.tsx` — add "Receipt" tab
- Modify: `apps/web/src/components/pos/receipt-preview.tsx` — accept optional receiptConfig prop

---

## Task 5: Employee Time Clock — Schema + API

**Files:**
- Modify: `packages/db/src/schema/organization.ts` — add `timeEntry` table
- Modify: `packages/db/src/schema/index.ts` — export
- Create: `packages/api/src/routers/timeclock.ts` — 6 procedures
- Modify: `packages/api/src/routers/index.ts` — register router

---

## Task 6: Employee Time Clock — Frontend

**Files:**
- Create: `apps/web/src/routes/dashboard.timeclock.tsx`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx` — add nav item

---

## Task 7: End-of-Day Report — API

**Files:**
- Modify: `packages/api/src/routers/reports.ts` — add `getEodReport` procedure

---

## Task 8: End-of-Day Report — Frontend

**Files:**
- Create: `apps/web/src/routes/dashboard.eod.tsx`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx` — add nav item
- Modify: `apps/web/src/index.css` — add @media print styles

---

## Task 9: Verify + Commit

- `bun run typecheck` — zero errors
- `bun run build` — clean build
- Commit all Wave 1 changes
