# Plan 17 — Operations Polish Design

**Date:** 2026-03-12
**Status:** Approved
**Migration:** `0012_operations_polish`

## Overview

Four targeted operational improvements that Shakira's team will use daily: PIN-protecting certain POS categories, a printable end-of-shift PDF, stock alert emails, and expense receipt photo uploads.

---

## T1 — Supervisor PIN for POS Categories

**Problem:** Shakira wants Pastries and Beverages categories locked on the POS so cashiers cannot ring them without a supervisor PIN (prevents unauthorised discounts / ringing up personal orders).

**Design:**
- DB: Add `pin_protected: boolean DEFAULT false` to `reporting_category` table (migration 0012)
- API: Extend `updateCategory` / `createCategory` in settings router to accept `pinProtected`
- Settings UI (`/dashboard/settings` → Categories tab): add a lock toggle per category
- POS UI (`/dashboard/pos`): when a tab with `pin_protected = true` is clicked, show a modal PIN dialog. On correct PIN (supervisor/admin PIN already in the system), store unlocked category IDs in local `useState` for the session. Tab shows a 🔒 icon when locked.

**Permissions:** Only `admin` / `supervisor` roles can toggle the setting. Any valid supervisor/admin PIN unlocks.

---

## T2 — End-of-Shift Summary PDF

**Problem:** There is no printable summary when a cashier closes a cash session. The manager needs a paper trail for the safe.

**Design:**
- New file: `apps/web/src/lib/pdf/cash-session-pdf.ts` (Blob URL + auto-print pattern matching `daily-expense-summary-pdf.ts`)
- Content sections:
  1. Header: organisation name, session date, cashier name, open/close times
  2. Sales summary: total orders, revenue by payment method (Cash / Card / Gift Card / etc.)
  3. Cash float: opening float, cash sales, cash expenses, expected closing cash
  4. Expenses: list of expenses recorded during session (category, amount, supplier)
  5. Voids: count and total value of voided orders
  6. Signature line for cashier + manager
- Trigger: "Print Session Report" button on the cash session detail view in `/dashboard/cash`

---

## T3 — Stock Alert Emails

**Problem:** Low-stock and out-of-stock alerts exist in the UI but Shakira has to actively log in to notice them.

**Design:**
- Extend the existing midnight cron in `apps/server/src/backup-engine.ts`
- After backup job: query `stock_alert` where `acknowledged = false AND (type = 'low_stock' OR type = 'out_of_stock')`
- If any alerts found: send a formatted email to `SMTP_ALERT_TO` (env var already exists)
- Email format: table with columns — Item, Category, Current Qty, Threshold, Alert Type
- Footer link: `https://pos.karetechsolutions.com/dashboard/stock-alerts`
- No email sent if zero unacknowledged alerts (silent success)

---

## T4 — Expense Receipt Photo Upload

**Problem:** The `receipt_photo_url` column on `expense` has always existed but was never wired to a UI. Shakira wants to attach receipt photos to expense records.

**Design:**
- Server: `POST /api/uploads/receipt` — multipart form upload, saves to `/app/uploads/receipts/<uuid>.<ext>`, returns `{ url: "/uploads/receipts/<filename>" }`
- Server: serve `/uploads/` as a static directory from `/app/uploads/`
- API: `createExpense` and `updateExpense` procedures already accept `receiptPhotoUrl`; no change needed
- UI (expense form): add a file input below the Notes field. On file select, upload immediately (optimistic preview). Show thumbnail if photo already attached. "Remove" button clears the field.
- Supported: JPEG, PNG, WebP (max 5 MB client-side validation)

---

## Migration: 0012_operations_polish.sql

```sql
ALTER TABLE "reporting_category" ADD COLUMN "pin_protected" boolean DEFAULT false NOT NULL;
```

---

## Files Changed

| File | Change |
|------|--------|
| `packages/db/src/schema/products.ts` | Add `pinProtected` to `reportingCategory` |
| `packages/db/src/migrations/0012_*.sql` | Migration |
| `packages/api/src/routers/settings.ts` | Accept `pinProtected` in category CRUD |
| `apps/web/src/routes/dashboard.pos.tsx` | PIN dialog on locked category tabs |
| `apps/web/src/routes/dashboard.cash.tsx` | "Print Session Report" button |
| `apps/web/src/lib/pdf/cash-session-pdf.ts` | New PDF generator |
| `apps/server/src/backup-engine.ts` | Stock alert email after backup cron |
| `apps/server/src/index.ts` | `/api/uploads/receipt` POST + `/uploads/` static |
| `apps/web/src/routes/dashboard.expenses.tsx` | Receipt photo upload UI |
