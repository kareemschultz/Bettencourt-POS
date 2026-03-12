# Plan 17 — Operations Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Four daily-use operational improvements: supervisor PIN-protected POS categories, end-of-shift session PDF, automated stock-alert emails, and expense receipt photo upload.

**Architecture:** Each task is self-contained. T1 reuses the existing `verifySupervisor` API endpoint. T2 follows the Blob-URL PDF pattern from `daily-expense-summary-pdf.ts`. T3 extends the node-cron scheduler in `backup-engine.ts`. T4 adds a Hono multipart upload route and wires the existing `receipt_photo_url` DB column to the UI.

**Tech Stack:** Drizzle ORM (PostgreSQL), oRPC procedures, Hono (Bun), React + shadcn/ui, node-cron, Blob URL PDFs, Nodemailer

**Monorepo conventions:**
- Package manager: `bun` — run commands as `/home/karetech/.bun/bin/bun run <script>` with `PATH="/home/karetech/.bun/bin:$PATH"`
- Commits: `HUSKY=0 git commit -F /tmp/msg.txt` (hooks fail in non-interactive shell)
- TypeScript check: `PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types`
- Biome lint: `PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run lint`
- Project root: `/home/karetech/projects/bettencourt/Bettencourt-POS`

---

## Task 1: DB Migration — Add `pin_protected` to `reporting_category`

**Files:**
- Modify: `packages/db/src/schema/product.ts` (lines 20–35, `reportingCategory` table)
- Create: `packages/db/src/migrations/0012_operations_polish.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`

**Step 1: Add the field to the schema**

In `packages/db/src/schema/product.ts`, add to `reportingCategory`:
```typescript
// After: isActive: boolean("is_active").notNull().default(true),
pinProtected: boolean("pin_protected").notNull().default(false),
```

**Step 2: Create the migration SQL file**

Create `packages/db/src/migrations/0012_operations_polish.sql`:
```sql
ALTER TABLE "reporting_category" ADD COLUMN "pin_protected" boolean DEFAULT false NOT NULL;
```

**Step 3: Register migration in journal**

In `packages/db/src/migrations/meta/_journal.json`, append to the `entries` array:
```json
{
  "idx": 7,
  "version": "7",
  "when": 1773400000000,
  "tag": "0012_operations_polish",
  "breakpoints": true
}
```

**Step 4: Run migration against the dev/prod DB**
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run db:migrate
```
Expected: migration runs, exits 0.

**Step 5: Verify TypeScript compiles**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
```

**Step 6: Commit**
```bash
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(db): add pin_protected to reporting_category (migration 0012)\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 2: API — Expose `pinProtected` in category endpoints

**Files:**
- Modify: `packages/api/src/routers/products.ts` (getDepartments query)
- Modify: `packages/api/src/routers/settings.ts` (add getDepartments + updateDepartment if missing)

**Step 1: Check how departments are fetched in products router**

Read `packages/api/src/routers/products.ts` lines 1–120. The `getDepartments` procedure (or equivalent) selects from `schema.reportingCategory`. It must now also return `pinProtected`.

**Step 2: Add `pinProtected` to the departments select**

Find the query that selects from `schema.reportingCategory` and add the field:
```typescript
pinProtected: schema.reportingCategory.pinProtected,
```

**Step 3: Add getDepartments + updateDepartment to settingsRouter if not present**

If `settingsRouter` doesn't export `getDepartments`/`updateDepartment`, add them to `packages/api/src/routers/settings.ts`:

```typescript
// ── getDepartments ──────────────────────────────────────────────────────
const getDepartments = permissionProcedure("settings.read").handler(
  async ({ context }) => {
    const orgId = requireOrganizationId(context);
    return db
      .select()
      .from(schema.reportingCategory)
      .where(eq(schema.reportingCategory.organizationId, orgId))
      .orderBy(asc(schema.reportingCategory.sortOrder), asc(schema.reportingCategory.name));
  },
);

// ── updateDepartment ────────────────────────────────────────────────────
const updateDepartment = permissionProcedure("settings.update")
  .input(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    pinProtected: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const { id, ...rest } = input;
    const updates: Partial<typeof schema.reportingCategory.$inferInsert> = {};
    if (rest.name !== undefined) updates.name = rest.name;
    if (rest.pinProtected !== undefined) updates.pinProtected = rest.pinProtected;
    if (rest.isActive !== undefined) updates.isActive = rest.isActive;
    if (rest.sortOrder !== undefined) updates.sortOrder = rest.sortOrder;
    await db.update(schema.reportingCategory)
      .set(updates)
      .where(and(eq(schema.reportingCategory.id, id), eq(schema.reportingCategory.organizationId, orgId)));
    return { success: true };
  });
```

Add `getDepartments` and `updateDepartment` to `settingsRouter` export object.

**Step 4: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(api): expose pinProtected on departments, add getDepartments/updateDepartment\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 3: Settings UI — PIN lock toggle on categories

**Files:**
- Modify: `apps/web/src/routes/dashboard.settings.tsx` (find the Categories/Departments settings tab)

**Step 1: Read the settings page to find the departments section**

Read `apps/web/src/routes/dashboard.settings.tsx`. Search for where `reportingCategory` or "Department" is rendered. It likely shows a list with edit/delete. We need to add a "PIN protected" toggle.

**Step 2: Add the toggle**

In the department list row, after the existing name/sort order fields, add a Switch:
```tsx
import { Switch } from "@/components/ui/switch";

// In the row render:
<div className="flex items-center gap-2">
  <Switch
    checked={dept.pinProtected}
    onCheckedChange={(checked) =>
      updateDepartmentMutation.mutate({ id: dept.id, pinProtected: checked })
    }
  />
  <span className="text-xs text-muted-foreground">PIN required</span>
</div>
```

Wire a `useMutation` to `orpc.settings.updateDepartment`.

**Step 3: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(ui): add PIN lock toggle to department settings\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 4: POS UI — PIN dialog on locked category tabs

**Files:**
- Modify: `apps/web/src/routes/dashboard.pos.tsx`

**Step 1: Read the POS route**

Read `apps/web/src/routes/dashboard.pos.tsx`. Find where category tabs are rendered (likely maps over departments/categories, renders tab buttons). Find where `verifySupervisor` is called elsewhere in the codebase for reference.

**Step 2: Add unlocked state tracking**

Near the top of the POS component, add:
```typescript
const [unlockedCategories, setUnlockedCategories] = useState<Set<string>>(new Set());
const [pinDialogOpen, setPinDialogOpen] = useState(false);
const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
const [pinValue, setPinValue] = useState("");
const [pinError, setPinError] = useState("");
```

**Step 3: Wrap category tab click**

Find the category tab `onClick` handler. Replace it with:
```typescript
function handleCategoryClick(categoryId: string, pinProtected: boolean) {
  if (pinProtected && !unlockedCategories.has(categoryId)) {
    setPendingCategoryId(categoryId);
    setPinDialogOpen(true);
    return;
  }
  setSelectedCategory(categoryId); // existing logic
}
```

**Step 4: Add lock icon to protected tabs**

In the tab label render, add a lock icon for protected categories:
```tsx
import { Lock } from "lucide-react";

// In tab label:
{dept.pinProtected && !unlockedCategories.has(dept.id) && (
  <Lock className="ml-1 size-3 opacity-60" />
)}
```

**Step 5: Add PIN dialog**

Add a Dialog component (import from `@/components/ui/dialog`):
```tsx
const verifySupervisorMutation = useMutation({
  mutationFn: (pin: string) =>
    orpc.settings.verifySupervisor.call({
      pin,
      requiredPermission: "pos.unlock_category",
    }),
  onSuccess: () => {
    if (pendingCategoryId) {
      setUnlockedCategories((prev) => new Set([...prev, pendingCategoryId]));
      setSelectedCategory(pendingCategoryId);
    }
    setPinDialogOpen(false);
    setPinValue("");
    setPinError("");
    setPendingCategoryId(null);
  },
  onError: () => {
    setPinError("Incorrect PIN. Please try again.");
    setPinValue("");
  },
});

// Dialog JSX (add near end of component return):
<Dialog open={pinDialogOpen} onOpenChange={(o) => { setPinDialogOpen(o); setPinValue(""); setPinError(""); }}>
  <DialogContent className="max-w-xs">
    <DialogHeader>
      <DialogTitle>Supervisor PIN Required</DialogTitle>
      <DialogDescription>Enter a supervisor PIN to access this category.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3 py-2">
      <Input
        type="password"
        inputMode="numeric"
        maxLength={8}
        placeholder="Enter PIN"
        value={pinValue}
        onChange={(e) => setPinValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && pinValue.length >= 4)
            verifySupervisorMutation.mutate(pinValue);
        }}
        autoFocus
      />
      {pinError && <p className="text-sm text-destructive">{pinError}</p>}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setPinDialogOpen(false)}>Cancel</Button>
      <Button
        onClick={() => verifySupervisorMutation.mutate(pinValue)}
        disabled={pinValue.length < 4 || verifySupervisorMutation.isPending}
      >
        Unlock
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 6: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(pos): supervisor PIN dialog for locked category tabs\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 5: End-of-Shift Session PDF

**Files:**
- Create: `apps/web/src/lib/pdf/cash-session-pdf.ts`
- Modify: `apps/web/src/routes/dashboard.cash.tsx`

**Step 1: Read the existing cash route**

Read `apps/web/src/routes/dashboard.cash.tsx` to understand the session data structure. Also read `apps/web/src/lib/pdf/daily-expense-summary-pdf.ts` lines 1–100 to understand the Blob URL pattern to copy.

**Step 2: Create the PDF builder**

Create `apps/web/src/lib/pdf/cash-session-pdf.ts`:

```typescript
// ── Cash Session PDF Builder ───────────────────────────────────────────────
// Printable end-of-shift summary for the cashier and manager safe record.

export interface CashSessionPdfOptions {
  session: {
    id: string;
    openedAt: string;
    closedAt?: string | null;
    openingFloat: string;
    cashierName: string;
  };
  salesByMethod: Array<{ method: string; count: number; total: string }>;
  expenses: Array<{ category: string; amount: string; supplier?: string | null; description?: string | null }>;
  voidCount: number;
  voidTotal: string;
  totalRevenue: string;
  organizationName: string;
}

function fmtGYD(amount: string | number): string {
  return new Intl.NumberFormat("en-GY", {
    style: "currency",
    currency: "GYD",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

export function printCashSessionReport(opts: CashSessionPdfOptions): void {
  const win = window.open("about:blank", "_blank");
  const html = buildHtml(opts);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  if (win) {
    win.location.href = url;
  } else {
    window.open(url, "_blank");
  }
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

function buildHtml(opts: CashSessionPdfOptions): string {
  const totalExpenses = opts.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const cashSales = opts.salesByMethod.find(m => m.method.toLowerCase() === "cash")?.total ?? "0";
  const expectedClosing = Number(opts.session.openingFloat) + Number(cashSales) - totalExpenses;

  const expenseRows = opts.expenses.map(e =>
    `<tr>
      <td>${e.category}</td>
      <td>${e.supplier ?? ""}</td>
      <td>${e.description ?? ""}</td>
      <td style="text-align:right">${fmtGYD(e.amount)}</td>
    </tr>`
  ).join("");

  const salesRows = opts.salesByMethod.map(m =>
    `<tr>
      <td>${m.method}</td>
      <td style="text-align:center">${m.count}</td>
      <td style="text-align:right">${fmtGYD(m.total)}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Session Report</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 12px; margin: 14px 0 4px; border-bottom: 1px solid #999; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #f0f0f0; text-align: left; padding: 3px 6px; }
  td { padding: 3px 6px; border-bottom: 1px solid #eee; }
  .kpi { display: inline-block; min-width: 160px; margin: 4px 12px 4px 0; }
  .kpi-label { font-size: 10px; color: #666; }
  .kpi-value { font-size: 13px; font-weight: bold; }
  .sig-row { display: flex; gap: 60px; margin-top: 30px; }
  .sig-box { flex: 1; border-top: 1px solid #333; padding-top: 4px; font-size: 10px; color: #555; }
  .no-print { display: none; }
  @media print { .no-print { display: none !important; } }
</style>
<script>window.onload = function(){ window.print(); }<\/script>
</head>
<body>
<h1>${opts.organizationName}</h1>
<div style="color:#555; font-size:10px">Cash Session Report — Printed ${new Date().toLocaleString("en-GY", { timeZone: "America/Guyana" })}</div>

<h2>Session Details</h2>
<div>
  <span class="kpi"><span class="kpi-label">Cashier</span><br><span class="kpi-value">${opts.session.cashierName}</span></span>
  <span class="kpi"><span class="kpi-label">Opened</span><br><span class="kpi-value">${new Date(opts.session.openedAt).toLocaleString("en-GY", { timeZone: "America/Guyana" })}</span></span>
  ${opts.session.closedAt ? `<span class="kpi"><span class="kpi-label">Closed</span><br><span class="kpi-value">${new Date(opts.session.closedAt).toLocaleString("en-GY", { timeZone: "America/Guyana" })}</span></span>` : ""}
  <span class="kpi"><span class="kpi-label">Opening Float</span><br><span class="kpi-value">${fmtGYD(opts.session.openingFloat)}</span></span>
</div>

<h2>Sales by Payment Method</h2>
<table>
  <thead><tr><th>Method</th><th style="text-align:center">Orders</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${salesRows}</tbody>
  <tfoot><tr><td><b>Total Revenue</b></td><td></td><td style="text-align:right"><b>${fmtGYD(opts.totalRevenue)}</b></td></tr></tfoot>
</table>

<h2>Expenses During Session</h2>
${opts.expenses.length > 0 ? `
<table>
  <thead><tr><th>Category</th><th>Supplier</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${expenseRows}</tbody>
  <tfoot><tr><td colspan="3"><b>Total Expenses</b></td><td style="text-align:right"><b>${fmtGYD(totalExpenses)}</b></td></tr></tfoot>
</table>` : "<p style='color:#666'>No expenses recorded this session.</p>"}

<h2>Cash Summary</h2>
<table>
  <tbody>
    <tr><td>Opening Float</td><td style="text-align:right">${fmtGYD(opts.session.openingFloat)}</td></tr>
    <tr><td>Cash Sales</td><td style="text-align:right">+ ${fmtGYD(cashSales)}</td></tr>
    <tr><td>Cash Expenses</td><td style="text-align:right">− ${fmtGYD(totalExpenses)}</td></tr>
    <tr><td><b>Expected Closing Cash</b></td><td style="text-align:right"><b>${fmtGYD(expectedClosing)}</b></td></tr>
  </tbody>
</table>

${opts.voidCount > 0 ? `<p style="color:#c00"><b>Voided orders this session:</b> ${opts.voidCount} (${fmtGYD(opts.voidTotal)} total)</p>` : ""}

<div class="sig-row">
  <div class="sig-box">Cashier Signature</div>
  <div class="sig-box">Manager Signature</div>
</div>
</body>
</html>`;
}
```

**Step 3: Find the session detail view in `dashboard.cash.tsx`**

Read `apps/web/src/routes/dashboard.cash.tsx` and find where session details are shown. Add a "Print Session Report" button that calls `printCashSessionReport`.

Look for where `getExpenses` and payment breakdown data are available, and pass them to the PDF builder. Add the import and button:
```typescript
import { printCashSessionReport } from "@/lib/pdf/cash-session-pdf";

// In the session detail section:
<Button variant="outline" size="sm" onClick={() => printCashSessionReport({
  session: { ...selectedSession },
  salesByMethod: sessionPaymentBreakdown,
  expenses: sessionExpenses,
  voidCount: sessionVoidCount,
  voidTotal: sessionVoidTotal,
  totalRevenue: sessionTotalRevenue,
  organizationName: "Bettencourt's Food Inc.",
})}>
  <Printer className="mr-2 size-4" />
  Print Session Report
</Button>
```

**Step 4: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(pdf): end-of-shift cash session PDF with sales, expenses, float summary\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 6: Stock Alert Emails (server-side cron)

**Files:**
- Modify: `apps/server/src/email.ts`
- Modify: `apps/server/src/backup-engine.ts`

**Step 1: Add `sendStockAlertEmail` to `apps/server/src/email.ts`**

Append after `sendBackupFailureAlert`:
```typescript
export async function sendStockAlertEmail(
  alerts: Array<{ itemName: string; category: string; currentQty: number; threshold: number; alertType: string }>,
): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_ALERT_TO) return;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  const rows = alerts.map(a =>
    `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${a.itemName}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${a.category}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${a.currentQty}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${a.threshold}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;color:${a.alertType === 'out_of_stock' ? '#c00' : '#c60'}">${a.alertType === 'out_of_stock' ? 'OUT OF STOCK' : 'LOW STOCK'}</td>
    </tr>`
  ).join("");

  const html = `
    <h2 style="font-family:Arial,sans-serif">🔔 Stock Alert — Bettencourt's</h2>
    <p style="font-family:Arial,sans-serif">${alerts.length} item(s) need attention:</p>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:4px 8px;text-align:left">Item</th>
          <th style="padding:4px 8px;text-align:left">Category</th>
          <th style="padding:4px 8px;text-align:center">Current Qty</th>
          <th style="padding:4px 8px;text-align:center">Threshold</th>
          <th style="padding:4px 8px;text-align:left">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-family:Arial,sans-serif;margin-top:16px">
      <a href="https://pos.karetechsolutions.com/dashboard/stock-alerts">View Stock Alerts →</a>
    </p>`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: env.SMTP_ALERT_TO,
    subject: `[Bettencourt POS] ${alerts.length} Stock Alert(s) — ${new Date().toLocaleDateString("en-GY", { timeZone: "America/Guyana" })}`,
    html,
  });
}
```

**Step 2: Add the stock alert cron to `startBackupScheduler`**

In `apps/server/src/backup-engine.ts`, add import at top:
```typescript
import { sendBackupFailureAlert, sendStockAlertEmail } from "./email";
import { sql } from "drizzle-orm";
```

Then after the backup cron block (inside `startBackupScheduler`), add:
```typescript
  // Stock alert email — runs at 04:15 UTC (after backup)
  cron.schedule(
    "15 4 * * *",
    async () => {
      try {
        const result = await db.execute(
          sql`SELECT
                ii.name as "itemName",
                COALESCE(rc.name, 'Uncategorised') as category,
                COALESCE(ist.quantity, 0)::int as "currentQty",
                COALESCE(ii.reorder_point, 0)::int as threshold,
                sa.alert_type as "alertType"
              FROM stock_alert sa
              JOIN inventory_item ii ON ii.id = sa.inventory_item_id
              LEFT JOIN reporting_category rc ON rc.id = ii.category_id
              LEFT JOIN inventory_stock ist ON ist.inventory_item_id = ii.id
              WHERE sa.acknowledged = false
                AND sa.alert_type IN ('low_stock', 'out_of_stock')
              ORDER BY sa.alert_type DESC, ii.name`,
        );
        const alerts = result.rows as Array<{
          itemName: string;
          category: string;
          currentQty: number;
          threshold: number;
          alertType: string;
        }>;
        if (alerts.length > 0) {
          await sendStockAlertEmail(alerts);
          console.log(`[alerts] Sent stock alert email for ${alerts.length} item(s)`);
        } else {
          console.log("[alerts] No unacknowledged stock alerts — skipping email");
        }
      } catch (err) {
        console.error("[alerts] Stock alert email failed:", err);
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
    f.write('feat(server): nightly stock alert email via cron at 04:15 UTC\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 7: Expense Receipt Photo Upload

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/routes/dashboard.expenses.tsx`

**Step 1: Add upload route + static serving to `apps/server/src/index.ts`**

After `app.route("/api/backups", backupsRouter);`, add:
```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";

// POST /api/uploads/receipt — multipart form, field name "file"
app.post("/api/uploads/receipt", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "Unauthorized" }, 401);

  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") return c.json({ error: "No file provided" }, 400);

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return c.json({ error: "Invalid file type" }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: "File too large (max 5MB)" }, 400);

  const ext = extname(file.name) || ".jpg";
  const filename = `${crypto.randomUUID()}${ext}`;
  const dir = join(UPLOADS_DIR, "receipts");
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, filename), buffer);

  return c.json({ url: `/uploads/receipts/${filename}` });
});

// Serve uploaded files
app.use("/uploads/*", serveStatic({ root: UPLOADS_DIR.replace(/\/receipts$/, "") }));
```

Note: `serveStatic` root should be the parent of `receipts/`. Adjust path logic if `UPLOADS_DIR` is `/app/uploads` (no subdirectory in root).

**Step 2: Adjust static serving**

Since `serveStatic` serves relative to the root, and files live at `/app/uploads/receipts/<file>`, the URL `/uploads/receipts/<file>` needs to map to `/app/uploads/receipts/<file>`.

```typescript
// Serve /uploads/* from /app/uploads/
app.use("/uploads/*", async (c, next) => {
  const url = new URL(c.req.url);
  const filePath = join(UPLOADS_DIR, url.pathname.replace("/uploads", ""));
  const { readFile } = await import("node:fs/promises");
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".png": "image/png", ".webp": "image/webp",
    };
    return new Response(data, {
      headers: { "Content-Type": mimeMap[ext] ?? "application/octet-stream" },
    });
  } catch {
    await next();
  }
});
```

**Step 3: Add receipt upload UI to expense form**

In `apps/web/src/routes/dashboard.expenses.tsx`, find the expense form dialog (around the Notes field). Add after Notes:

```tsx
{/* Receipt Photo */}
<div className="flex flex-col gap-1.5">
  <Label>Receipt Photo</Label>
  {form.receiptPhotoUrl ? (
    <div className="flex items-center gap-2">
      <img
        src={form.receiptPhotoUrl}
        alt="Receipt"
        className="h-20 w-20 rounded border object-cover"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setForm((f) => ({ ...f, receiptPhotoUrl: "" }))}
      >
        Remove
      </Button>
    </div>
  ) : (
    <label className="flex h-20 w-full cursor-pointer items-center justify-center rounded border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/30">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            toast.error("File too large (max 5MB)");
            return;
          }
          const fd = new FormData();
          fd.append("file", file);
          try {
            const res = await fetch("/api/uploads/receipt", { method: "POST", body: fd });
            const data = await res.json() as { url: string };
            setForm((f) => ({ ...f, receiptPhotoUrl: data.url }));
          } catch {
            toast.error("Upload failed");
          }
        }}
      />
      <span>Click to attach receipt photo</span>
    </label>
  )}
</div>
```

Also ensure `form` state includes `receiptPhotoUrl: ""` and that `createExpense`/`updateExpense` mutations pass `receiptPhotoUrl: form.receiptPhotoUrl || null`.

**Step 4: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(expenses): receipt photo upload, local file storage, thumbnail preview\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 8: Final — TypeScript check, push, Docker deploy

**Step 1: Full type check**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
```
Fix any errors before proceeding.

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
Expected: `Up N seconds`
