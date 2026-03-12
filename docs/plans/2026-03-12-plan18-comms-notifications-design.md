# Plan 18 — Comms & Notifications Design

**Date:** 2026-03-12
**Status:** Approved
**Migration:** `0013_comms_notifications`

## Overview

Three communication features that extend the existing Nodemailer + node-cron infrastructure: a nightly email digest for Shakira, direct invoice delivery to customers by email, and automated overdue payment reminders.

---

## T1 — Daily Email Digest

**Problem:** Shakira needs a daily snapshot of the business without logging in — revenue, top sellers, expenses, open invoices.

**Design:**
- New cron job in `apps/server/src/backup-engine.ts` (or extracted to `apps/server/src/scheduler.ts`)
- Schedule: `0 4 * * *` (04:00 UTC = midnight Guyana time) — runs after the backup job
- Queries (reusing dashboard router logic directly from DB):
  - Today's total revenue + order count
  - Top 5 products by quantity sold today
  - Total expenses today
  - Count + sum of open (unpaid) invoices
  - Count of unacknowledged stock alerts
- HTML email template: Bettencourt's header, colour-coded KPI cards, top sellers table, alerts section
- Recipients: `SMTP_DIGEST_TO` env var (comma-separated; falls back to `SMTP_ALERT_TO`)
- Graceful: if no orders today, sends "quiet day" summary rather than skipping

---

## T2 — Send Invoice to Customer by Email

**Problem:** To get paid, Shakira needs to send invoices to customers. Currently she has to manually copy invoice details and email from her personal account.

**Design:**
- Customer table already has `email` field
- New `sendInvoiceEmail` procedure in `packages/api/src/routers/invoices.ts` (protected, `invoices.read` permission)
- Server-side renders HTML invoice: invoice number, issue date, due date, line items table, subtotal, tax, total, payment terms, company footer
- Sends via `email.ts` → SMTP
- Tracks send: add `last_emailed_at: timestamp` column to `invoice` table (migration 0013)
- UI: "Send by Email" added to the More Actions dropdown on invoice detail page
  - If customer has no email: show inline warning with link to edit customer
  - On success: toast confirmation + `last_emailed_at` badge shown on invoice

---

## T3 — Overdue Invoice Payment Reminders

**Problem:** Outstanding invoices age without follow-up. Shakira needs automatic reminders sent to customers with overdue balances.

**Design:**
- Daily cron at `0 5 * * *` (05:00 UTC = 01:00 Guyana): after digest job
- Query: invoices where `due_date < today AND status NOT IN ('paid','cancelled','draft')`
- Skip if `last_reminder_sent_at` is within the last 7 days (configurable via env `REMINDER_INTERVAL_DAYS`, default 7)
- Email: polite reminder template — invoice number, original due date, amount outstanding, contact info
- Updates `last_reminder_sent_at` on invoice after send
- Uses same `last_emailed_at` migration (add separate `last_reminder_sent_at` column)

---

## Migration: 0013_comms_notifications.sql

```sql
ALTER TABLE "invoice" ADD COLUMN "last_emailed_at" timestamp with time zone;
ALTER TABLE "invoice" ADD COLUMN "last_reminder_sent_at" timestamp with time zone;
```

---

## Files Changed

| File | Change |
|------|--------|
| `packages/db/src/schema/` | Add `lastEmailedAt`, `lastReminderSentAt` to invoice |
| `packages/db/src/migrations/0013_*.sql` | Migration |
| `packages/api/src/routers/invoices.ts` | Add `sendInvoiceEmail` procedure |
| `apps/server/src/email.ts` | Add `sendDailyDigest()`, `sendInvoiceEmail()`, `sendOverdueReminder()` helpers |
| `apps/server/src/backup-engine.ts` | Add digest + reminder cron jobs |
| `apps/web/src/routes/dashboard.invoices.tsx` | "Send by Email" in More Actions |
