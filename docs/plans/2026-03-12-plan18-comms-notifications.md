# Plan 18 — Comms & Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three communication features built on existing Nodemailer + node-cron infrastructure: nightly email digest for Shakira, direct invoice delivery to customers, and automated overdue payment reminders.

**Architecture:** All email logic is centralised in `apps/server/src/email.ts`. New cron jobs are added to `startBackupScheduler()` in `backup-engine.ts` (or a new `startScheduler()` function extracted from it). The invoice schema gets two timestamp columns for tracking email sends. The invoices page gets a "Send by Email" action.

**Tech Stack:** Nodemailer (SMTP), node-cron, Drizzle ORM (raw SQL queries for digest), oRPC procedure for invoice send, Hono server

**Monorepo conventions:**
- Package manager: `bun` — run as `/home/karetech/.bun/bin/bun run <script>` with `PATH="/home/karetech/.bun/bin:$PATH"`
- Commits: `HUSKY=0 git commit -F /tmp/msg.txt`
- TypeScript check: `PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types`
- Project root: `/home/karetech/projects/bettencourt/Bettencourt-POS`

---

## Task 1: DB Migration — Add email tracking columns to `invoice`

**Files:**
- Modify: `packages/db/src/schema/invoice.ts`
- Create: `packages/db/src/migrations/0013_comms_notifications.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`

**Step 1: Add columns to invoice schema**

In `packages/db/src/schema/invoice.ts`, inside the `invoice` pgTable definition, add after `updatedAt`:
```typescript
lastEmailedAt: timestamp("last_emailed_at", { withTimezone: true }),
lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
```

**Step 2: Create migration SQL**

Create `packages/db/src/migrations/0013_comms_notifications.sql`:
```sql
ALTER TABLE "invoice" ADD COLUMN "last_emailed_at" timestamp with time zone;
ALTER TABLE "invoice" ADD COLUMN "last_reminder_sent_at" timestamp with time zone;
```

**Step 3: Register in journal**

In `packages/db/src/migrations/meta/_journal.json`, append:
```json
{
  "idx": 8,
  "version": "7",
  "when": 1773400001000,
  "tag": "0013_comms_notifications",
  "breakpoints": true
}
```

**Step 4: Run migration**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run db:migrate
```

**Step 5: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(db): add lastEmailedAt + lastReminderSentAt to invoice (migration 0013)\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 2: Add env vars for digest + reminder config

**Files:**
- Modify: `packages/env/src/server.ts` (or wherever `SMTP_*` env vars are declared)

**Step 1: Find the env file**

Read `packages/env/src/server.ts`. Find where `SMTP_ALERT_TO` is declared.

**Step 2: Add new env vars**

Add alongside `SMTP_ALERT_TO`:
```typescript
SMTP_DIGEST_TO: z.string().optional(),         // Comma-separated email recipients for daily digest
REMINDER_INTERVAL_DAYS: z.coerce.number().default(7), // Days between reminder emails
```

**Step 3: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(env): add SMTP_DIGEST_TO and REMINDER_INTERVAL_DAYS env vars\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 3: Daily Digest — email helper + cron

**Files:**
- Modify: `apps/server/src/email.ts`
- Modify: `apps/server/src/backup-engine.ts`

**Step 1: Add `sendDailyDigest` to email.ts**

Append to `apps/server/src/email.ts`:
```typescript
interface DigestData {
  date: string;
  revenue: string;
  orderCount: number;
  topProducts: Array<{ name: string; qty: number }>;
  expensesTotal: string;
  openInvoicesCount: number;
  openInvoicesTotal: string;
  stockAlertCount: number;
}

export async function sendDailyDigest(data: DigestData, to: string): Promise<void> {
  if (!env.SMTP_HOST) return;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  const fmtGYD = (v: string | number) =>
    new Intl.NumberFormat("en-GY", { style: "currency", currency: "GYD" }).format(Number(v));

  const topRows = data.topProducts.map(p =>
    `<tr><td style="padding:3px 8px">${p.name}</td><td style="padding:3px 8px;text-align:center">${p.qty}</td></tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:18px">Bettencourt's — Daily Summary</h1>
    <p style="margin:4px 0 0;font-size:12px;opacity:.8">${data.date}</p>
  </div>
  <div style="background:#f9fafb;padding:16px 20px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280">Revenue Today</div>
        <div style="font-size:20px;font-weight:bold;color:#0f766e">${fmtGYD(data.revenue)}</div>
        <div style="font-size:11px;color:#6b7280">${data.orderCount} orders</div>
      </div>
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280">Expenses Today</div>
        <div style="font-size:20px;font-weight:bold;color:#dc2626">${fmtGYD(data.expensesTotal)}</div>
      </div>
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280">Open Invoices</div>
        <div style="font-size:20px;font-weight:bold;color:#7c3aed">${data.openInvoicesCount}</div>
        <div style="font-size:11px;color:#6b7280">${fmtGYD(data.openInvoicesTotal)} outstanding</div>
      </div>
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid ${data.stockAlertCount > 0 ? '#f59e0b' : '#e5e7eb'}">
        <div style="font-size:11px;color:#6b7280">Stock Alerts</div>
        <div style="font-size:20px;font-weight:bold;color:${data.stockAlertCount > 0 ? '#d97706' : '#111'}">${data.stockAlertCount}</div>
        <div style="font-size:11px;color:#6b7280">unacknowledged</div>
      </div>
    </div>
    ${data.topProducts.length > 0 ? `
    <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
      <div style="font-size:11px;font-weight:600;margin-bottom:8px;color:#374151">TOP SELLERS TODAY</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f3f4f6"><th style="padding:3px 8px;text-align:left">Product</th><th style="padding:3px 8px">Qty</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>` : ""}
    <p style="font-size:11px;color:#9ca3af;margin-top:12px;text-align:center">
      <a href="https://pos.karetechsolutions.com/dashboard" style="color:#0f766e">Open Dashboard →</a>
    </p>
  </div>
</div>`;

  const recipients = to.split(",").map(s => s.trim()).filter(Boolean);
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: recipients.join(", "),
    subject: `[Bettencourt's] Daily Summary — ${data.date}`,
    html,
  });
}
```

**Step 2: Add digest cron to `startBackupScheduler` in `backup-engine.ts`**

First add the db/sql import at top if not present:
```typescript
import { sql } from "drizzle-orm";
```

Then inside `startBackupScheduler()`, after the backup cron block, add:
```typescript
  // Daily digest email — 04:30 UTC (after backup + stock alerts)
  cron.schedule(
    "30 4 * * *",
    async () => {
      const to = env.SMTP_DIGEST_TO ?? env.SMTP_ALERT_TO;
      if (!to) {
        console.log("[digest] No SMTP_DIGEST_TO configured — skipping");
        return;
      }
      try {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guyana" });

        const [revenueRes, expensesRes, invoicesRes, stockRes, topRes] = await Promise.all([
          db.execute(sql`
            SELECT COALESCE(SUM(total),0)::text as revenue, COUNT(*)::int as order_count
            FROM "order"
            WHERE status IN ('completed','closed')
              AND DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`),
          db.execute(sql`
            SELECT COALESCE(SUM(amount),0)::text as total
            FROM expense
            WHERE DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`),
          db.execute(sql`
            SELECT COUNT(*)::int as cnt, COALESCE(SUM(total - amount_paid),0)::text as outstanding
            FROM invoice
            WHERE status IN ('sent','partial')`),
          db.execute(sql`
            SELECT COUNT(*)::int as cnt FROM stock_alert
            WHERE acknowledged = false AND alert_type IN ('low_stock','out_of_stock')`),
          db.execute(sql`
            SELECT oli.product_name_snapshot as name, SUM(oli.quantity)::int as qty
            FROM order_line_item oli
            JOIN "order" o ON o.id = oli.order_id
            WHERE o.status IN ('completed','closed')
              AND DATE(o.created_at AT TIME ZONE 'America/Guyana') = ${today}
              AND oli.voided = false
            GROUP BY oli.product_name_snapshot
            ORDER BY qty DESC LIMIT 5`),
        ]);

        const rev = revenueRes.rows[0] as { revenue: string; order_count: number };
        const exp = expensesRes.rows[0] as { total: string };
        const inv = invoicesRes.rows[0] as { cnt: number; outstanding: string };
        const stk = stockRes.rows[0] as { cnt: number };

        await sendDailyDigest({
          date: today,
          revenue: rev.revenue,
          orderCount: rev.order_count,
          expensesTotal: exp.total,
          openInvoicesCount: inv.cnt,
          openInvoicesTotal: inv.outstanding,
          stockAlertCount: stk.cnt,
          topProducts: topRes.rows as Array<{ name: string; qty: number }>,
        }, to);

        console.log(`[digest] Daily digest sent to ${to}`);
      } catch (err) {
        console.error("[digest] Failed to send daily digest:", err);
      }
    },
    { timezone: "UTC" },
  );
```

Also add `sendDailyDigest` to the import from `./email`:
```typescript
import { sendBackupFailureAlert, sendDailyDigest, sendStockAlertEmail } from "./email";
```
(adjust based on what Plan 17 already added)

**Step 3: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(server): nightly daily digest email cron at 04:30 UTC\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 4: Invoice Email — API procedure

**Files:**
- Modify: `apps/server/src/email.ts`
- Modify: `packages/api/src/routers/invoices.ts`

**Step 1: Add `sendInvoiceEmailMsg` helper to email.ts**

Append to `apps/server/src/email.ts`:
```typescript
interface InvoiceEmailData {
  to: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  items: Array<{ description: string; qty: number; unitPrice: string; total: string }>;
  subtotal: string;
  taxTotal: string;
  total: string;
  notes?: string | null;
  paymentTerms: string;
  organizationName: string;
}

export async function sendInvoiceEmailMsg(data: InvoiceEmailData): Promise<void> {
  if (!env.SMTP_HOST) throw new Error("SMTP not configured");

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  const fmtGYD = (v: string | number) =>
    new Intl.NumberFormat("en-GY", { style: "currency", currency: "GYD" }).format(Number(v));

  const itemRows = data.items.map(item =>
    `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #eee">${item.description}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${fmtGYD(item.unitPrice)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${fmtGYD(item.total)}</td>
    </tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto">
  <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:18px">${data.organizationName}</h1>
    <p style="margin:4px 0 0;opacity:.8;font-size:13px">Invoice ${data.invoiceNumber}</p>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-top:0">
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <div><b>Bill To:</b><br>${data.customerName}</div>
      <div style="text-align:right">
        <div><b>Issue Date:</b> ${data.issueDate}</div>
        <div><b>Due Date:</b> ${data.dueDate}</div>
        <div><b>Payment Terms:</b> ${data.paymentTerms.replace(/_/g, " ")}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:6px 8px;text-align:left">Description</th>
          <th style="padding:6px 8px;text-align:center">Qty</th>
          <th style="padding:6px 8px;text-align:right">Unit Price</th>
          <th style="padding:6px 8px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:right;font-size:13px">
      <div>Subtotal: ${fmtGYD(data.subtotal)}</div>
      <div>Tax: ${fmtGYD(data.taxTotal)}</div>
      <div style="font-size:16px;font-weight:bold;color:#0f766e;margin-top:4px">Total: ${fmtGYD(data.total)}</div>
    </div>
    ${data.notes ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:4px;font-size:12px"><b>Notes:</b> ${data.notes}</div>` : ""}
    <p style="font-size:11px;color:#9ca3af;margin-top:20px">
      For questions, please contact ${data.organizationName}.
    </p>
  </div>
</div>`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: data.to,
    subject: `Invoice ${data.invoiceNumber} from ${data.organizationName}`,
    html,
  });
}
```

**Step 2: Read the invoices router to understand structure**

Read `packages/api/src/routers/invoices.ts` (first 80 lines). Understand the `getById` procedure and how `invoice.items` is stored (JSONB array). Check what fields are available.

**Step 3: Add `sendInvoiceEmail` procedure to invoices router**

At the end of `packages/api/src/routers/invoices.ts`, before the export, add:

```typescript
// ── sendInvoiceEmail ────────────────────────────────────────────────────
const sendInvoiceEmail = permissionProcedure("invoices.read")
  .input(z.object({ invoiceId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);

    const rows = await db
      .select()
      .from(schema.invoice)
      .where(and(eq(schema.invoice.id, input.invoiceId), eq(schema.invoice.organizationId, orgId)))
      .limit(1);

    if (rows.length === 0) throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    const invoice = rows[0]!;

    if (!invoice.customerId) {
      throw new ORPCError("BAD_REQUEST", { message: "Invoice has no customer attached" });
    }

    // Look up customer email
    const customerRows = await db
      .select({ email: schema.customer.email, name: schema.customer.name })
      .from(schema.customer)
      .where(eq(schema.customer.id, invoice.customerId))
      .limit(1);

    const customer = customerRows[0];
    if (!customer?.email) {
      throw new ORPCError("BAD_REQUEST", { message: "Customer has no email address on file" });
    }

    // Get org name
    const orgRows = await db
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId))
      .limit(1);
    const orgName = orgRows[0]?.name ?? "Bettencourt's";

    const items = (invoice.items as Array<{ description: string; quantity: number; unitPrice: string; total: string }>) ?? [];

    await sendInvoiceEmailMsg({
      to: customer.email,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      issueDate: invoice.issuedDate?.toLocaleDateString("en-GY") ?? "",
      dueDate: invoice.dueDate?.toLocaleDateString("en-GY") ?? "",
      items: items.map(i => ({
        description: i.description,
        qty: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      notes: invoice.notes,
      paymentTerms: invoice.paymentTerms,
      organizationName: orgName,
    });

    // Update lastEmailedAt
    await db.update(schema.invoice)
      .set({ lastEmailedAt: new Date() })
      .where(eq(schema.invoice.id, input.invoiceId));

    return { success: true };
  });
```

Note: `sendInvoiceEmailMsg` needs to be imported from the server's `email.ts`. Since oRPC procedures run in the API package which doesn't directly import server code, we need to handle this differently.

**Important:** The email.ts is in `apps/server/src/` and the invoices router is in `packages/api/src/`. The email sending needs to happen either:
a) In a new server-side route (preferred — keeps email logic in the server)
b) Or by moving email helpers to a shared package

**Recommended approach:** Create a `POST /api/invoices/:id/send-email` route in the Hono server (`apps/server/src/routes/`), similar to how backups routes work.

Create `apps/server/src/routes/invoices.ts`:
```typescript
import { auth } from "@Bettencourt-POS/auth";
import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { sendInvoiceEmailMsg } from "../email";

export const invoiceEmailRouter = new Hono();

invoiceEmailRouter.post("/:id/send-email", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "Unauthorized" }, 401);

  const invoiceId = c.req.param("id");
  // ... same logic as above, but in Hono handler
  // Returns { success: true } or error JSON
});
```

Register in `apps/server/src/index.ts`:
```typescript
import { invoiceEmailRouter } from "./routes/invoices";
app.route("/api/invoices", invoiceEmailRouter);
```

**Step 4: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(server): POST /api/invoices/:id/send-email endpoint\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 5: Invoice Email — UI "Send by Email" button

**Files:**
- Modify: `apps/web/src/routes/dashboard.invoices.tsx`

**Step 1: Read the invoices page**

Read `apps/web/src/routes/dashboard.invoices.tsx`. Find the More Actions dropdown (already exists from Plan 16). Find where `lastEmailedAt` needs to be displayed.

**Step 2: Add Send by Email to More Actions**

In the invoice detail or list More Actions dropdown, add:
```tsx
<DropdownMenuItem
  onClick={() => handleSendEmail(invoice.id, invoice.customerEmail)}
  disabled={!invoice.customerEmail}
>
  <Mail className="mr-2 size-4" />
  Send by Email
  {!invoice.customerEmail && (
    <span className="ml-auto text-xs text-muted-foreground">No email on file</span>
  )}
</DropdownMenuItem>
```

Add the handler:
```typescript
async function handleSendEmail(invoiceId: string, customerEmail?: string | null) {
  if (!customerEmail) {
    toast.error("Customer has no email address. Please update the customer record.");
    return;
  }
  try {
    const res = await fetch(`/api/invoices/${invoiceId}/send-email`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    toast.success("Invoice sent to " + customerEmail);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  } catch {
    toast.error("Failed to send invoice");
  }
}
```

Add `Mail` to lucide-react imports.

**Step 3: Show `lastEmailedAt` badge**

In the invoice detail/list view, show a small badge if `lastEmailedAt` is set:
```tsx
{invoice.lastEmailedAt && (
  <span className="text-xs text-muted-foreground">
    Last sent {new Date(invoice.lastEmailedAt).toLocaleDateString("en-GY")}
  </span>
)}
```

**Step 4: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(invoices): Send by Email button in More Actions, last emailed badge\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 6: Overdue Invoice Reminders (cron)

**Files:**
- Modify: `apps/server/src/email.ts`
- Modify: `apps/server/src/backup-engine.ts`

**Step 1: Add `sendOverdueReminder` to email.ts**

Append to `apps/server/src/email.ts`:
```typescript
interface OverdueReminderData {
  to: string;
  customerName: string;
  invoiceNumber: string;
  dueDate: string;
  amountOutstanding: string;
  organizationName: string;
}

export async function sendOverdueReminder(data: OverdueReminderData): Promise<void> {
  if (!env.SMTP_HOST) return;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  const fmtGYD = (v: string | number) =>
    new Intl.NumberFormat("en-GY", { style: "currency", currency: "GYD" }).format(Number(v));

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#dc2626;color:#fff;padding:14px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:16px">Payment Reminder — ${data.organizationName}</h1>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-top:0">
    <p>Dear ${data.customerName},</p>
    <p>This is a friendly reminder that invoice <b>${data.invoiceNumber}</b> was due on <b>${data.dueDate}</b> and remains outstanding.</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:16px 0">
      <div style="font-size:11px;color:#6b7280">Amount Outstanding</div>
      <div style="font-size:22px;font-weight:bold;color:#dc2626">${fmtGYD(data.amountOutstanding)}</div>
    </div>
    <p>Please arrange payment at your earliest convenience. If you have already made payment, please disregard this notice.</p>
    <p>Thank you for your business.</p>
    <p>— ${data.organizationName}</p>
  </div>
</div>`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: data.to,
    subject: `Payment Reminder — Invoice ${data.invoiceNumber} from ${data.organizationName}`,
    html,
  });
}
```

**Step 2: Add reminder cron to `startBackupScheduler`**

Add at 05:00 UTC (after backup + stock + digest):
```typescript
  // Overdue invoice reminders — 05:00 UTC
  cron.schedule(
    "0 5 * * *",
    async () => {
      try {
        const intervalDays = env.REMINDER_INTERVAL_DAYS ?? 7;
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guyana" });
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - intervalDays);

        const overdueRows = await db.execute(sql`
          SELECT
            i.id,
            i.invoice_number as "invoiceNumber",
            i.customer_name as "customerName",
            i.due_date as "dueDate",
            (i.total - i.amount_paid)::text as "amountOutstanding",
            c.email as "customerEmail"
          FROM invoice i
          LEFT JOIN customer c ON c.id = i.customer_id
          WHERE i.status IN ('sent', 'partial')
            AND i.due_date < NOW()
            AND c.email IS NOT NULL
            AND (i.last_reminder_sent_at IS NULL OR i.last_reminder_sent_at < ${cutoff.toISOString()})
        `);

        const orgRows = await db.execute(sql`SELECT name FROM organization LIMIT 1`);
        const orgName = (orgRows.rows[0] as { name: string })?.name ?? "Bettencourt's";

        let sent = 0;
        for (const row of overdueRows.rows as Array<{
          id: string; invoiceNumber: string; customerName: string;
          dueDate: string; amountOutstanding: string; customerEmail: string;
        }>) {
          try {
            await sendOverdueReminder({
              to: row.customerEmail,
              customerName: row.customerName,
              invoiceNumber: row.invoiceNumber,
              dueDate: new Date(row.dueDate).toLocaleDateString("en-GY"),
              amountOutstanding: row.amountOutstanding,
              organizationName: orgName,
            });
            await db.execute(sql`
              UPDATE invoice SET last_reminder_sent_at = NOW() WHERE id = ${row.id}
            `);
            sent++;
          } catch (e) {
            console.error(`[reminders] Failed to send reminder for invoice ${row.invoiceNumber}:`, e);
          }
        }
        console.log(`[reminders] Sent ${sent} overdue reminder(s)`);
      } catch (err) {
        console.error("[reminders] Overdue reminder job failed:", err);
      }
    },
    { timezone: "UTC" },
  );
```

**Step 3: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(server): overdue invoice reminder emails cron at 05:00 UTC\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 7: Final — TypeScript check, push, Docker deploy

**Step 1: Full type check**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
```

**Step 2: Push**
```bash
git push origin master
```

**Step 3: Rebuild Docker**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**Step 4: Verify**
```bash
docker ps --filter "name=kt-bettencourt-pos" --format "table {{.Names}}\t{{.Status}}"
```
