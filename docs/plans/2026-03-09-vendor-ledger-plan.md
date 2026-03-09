# Vendor Ledger & Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dedicated vendor detail page at `/dashboard/suppliers/:id` with spend analytics, transaction history, and a printable vendor statement PDF.

**Architecture:** New route `dashboard.suppliers.$id.tsx` (React Router v7 flat-routes) reads from three new cash-router procedures plus existing `settings.getSupplierById`. Vendor statement PDF mirrors the existing `invoice-pdf.ts` Blob URL pattern (`win.location.href = blobUrl`). No schema migrations needed — `expense.supplierId` FK already exists.

**Tech Stack:** React Router v7 · oRPC · Drizzle + raw SQL · Recharts (`BarChart`, `Bar`, `ResponsiveContainer`) · shadcn/ui · `formatGYD` from `@/lib/types` · `todayGY` from `@/lib/utils` · `downloadCsv` from `@/lib/csv-export`

---

## Task 1: Add `getSupplierById` to settings router

**Files:**
- Modify: `packages/api/src/routers/settings.ts`

**Context:** `settingsRouter.getSuppliers` returns the full list (line ~135). Need a single-item lookup for the detail page header. Same pattern: `permissionProcedure("settings.read")` + `requireOrganizationId(context)`.

**Step 1: Add the procedure after `getSuppliers`**

```typescript
// ── getSupplierById ─────────────────────────────────────────────────────
const getSupplierById = permissionProcedure("settings.read")
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const [supplier] = await db
      .select()
      .from(schema.supplier)
      .where(
        and(
          eq(schema.supplier.id, input.id),
          eq(schema.supplier.organizationId, orgId),
        ),
      )
      .limit(1);
    if (!supplier) throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
    return supplier;
  });
```

**Step 2: Add `getSupplierById` to the `settingsRouter` export object (around line 1209)**

**Step 3: TypeScript check + commit**

```bash
bun tsc -p packages/api --noEmit
git add packages/api/src/routers/settings.ts
git commit -m "feat(api): add getSupplierById to settings router"
```

---

## Task 2: Add `getSupplierSpendSummary` to cash router

**Files:**
- Modify: `packages/api/src/routers/cash.ts`

**Context:** Returns all KPI card data in one call. Uses raw `sql` template tag (same as `getExpenseReport` around line 628). The previous-period window is computed by mirroring the date range back by the same number of days.

**Step 1: Add procedure after `getExpenseReport`**

```typescript
// ── getSupplierSpendSummary ──────────────────────────────────────────────
const getSupplierSpendSummary = permissionProcedure("shifts.read")
  .input(z.object({
    supplierId: z.string().uuid(),
    startDate:  z.string().optional(),
    endDate:    z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const { supplierId, startDate, endDate } = input;

    const [period] = await db.execute<{
      total: string; count: string; avg: string; largest: string; largest_desc: string | null;
    }>(sql`
      SELECT
        COALESCE(SUM(amount), 0)::text AS total,
        COUNT(*)::text                 AS count,
        COALESCE(AVG(amount), 0)::text AS avg,
        COALESCE(MAX(amount), 0)::text AS largest,
        (SELECT description FROM expense
           WHERE supplier_id     = ${supplierId}::uuid
             AND organization_id = ${orgId}::uuid
             ${startDate ? sql`AND created_at >= ${startDate}::timestamptz` : sql``}
             ${endDate   ? sql`AND created_at <= ${endDate}::timestamptz`   : sql``}
           ORDER BY amount DESC LIMIT 1) AS largest_desc
      FROM expense
      WHERE supplier_id     = ${supplierId}::uuid
        AND organization_id = ${orgId}::uuid
        ${startDate ? sql`AND created_at >= ${startDate}::timestamptz` : sql``}
        ${endDate   ? sql`AND created_at <= ${endDate}::timestamptz`   : sql``}
    `);

    const [allTime] = await db.execute<{ total: string; count: string }>(sql`
      SELECT COALESCE(SUM(amount), 0)::text AS total, COUNT(*)::text AS count
      FROM expense
      WHERE supplier_id = ${supplierId}::uuid AND organization_id = ${orgId}::uuid
    `);

    const [last] = await db.execute<{ last_date: string | null }>(sql`
      SELECT MAX(created_at)::text AS last_date
      FROM expense
      WHERE supplier_id = ${supplierId}::uuid AND organization_id = ${orgId}::uuid
    `);

    let prevTotal = "0";
    if (startDate && endDate) {
      const start  = new Date(startDate);
      const end    = new Date(endDate);
      const days   = Math.round((end.getTime() - start.getTime()) / 86_400_000);
      const prevEnd   = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - days * 86_400_000);
      const [prev] = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(amount), 0)::text AS total
        FROM expense
        WHERE supplier_id     = ${supplierId}::uuid
          AND organization_id = ${orgId}::uuid
          AND created_at >= ${prevStart.toISOString()}::timestamptz
          AND created_at <= ${prevEnd.toISOString()}::timestamptz
      `);
      prevTotal = prev?.total ?? "0";
    }

    return {
      periodTotal:       period?.total       ?? "0",
      periodCount:       Number(period?.count ?? 0),
      periodAvg:         period?.avg          ?? "0",
      periodLargest:     period?.largest      ?? "0",
      periodLargestDesc: period?.largest_desc ?? null,
      allTimeTotal:      allTime?.total       ?? "0",
      allTimeCount:      Number(allTime?.count ?? 0),
      lastPurchaseDate:  last?.last_date       ?? null,
      previousPeriodTotal: prevTotal,
    };
  });
```

**Step 2: Add `getSupplierSpendSummary` to `cashRouter` export + commit**

```bash
git add packages/api/src/routers/cash.ts
git commit -m "feat(api): add getSupplierSpendSummary procedure"
```

---

## Task 3: Add `getSupplierMonthlySpend` to cash router

**Files:**
- Modify: `packages/api/src/routers/cash.ts`

**Context:** Always returns the last 12 calendar months regardless of the period filter, filling zero-spend months so the bar chart shows a full 12-bar layout.

**Step 1: Add procedure**

```typescript
// ── getSupplierMonthlySpend ──────────────────────────────────────────────
const getSupplierMonthlySpend = permissionProcedure("shifts.read")
  .input(z.object({ supplierId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const rows = await db.execute<{ month: string; total: string; count: string }>(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at AT TIME ZONE 'America/Guyana'), 'YYYY-MM') AS month,
        COALESCE(SUM(amount), 0)::text AS total,
        COUNT(*)::text                 AS count
      FROM expense
      WHERE supplier_id     = ${input.supplierId}::uuid
        AND organization_id = ${orgId}::uuid
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at AT TIME ZONE 'America/Guyana')
      ORDER BY month ASC
    `);
    const map = new Map(rows.map((r) => [r.month, r]));
    const result: { month: string; label: string; total: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-GY", { month: "short", year: "2-digit" });
      const row   = map.get(key);
      result.push({ month: key, label, total: Number(row?.total ?? 0), count: Number(row?.count ?? 0) });
    }
    return result;
  });
```

**Step 2: Add to `cashRouter` + commit**

```bash
git add packages/api/src/routers/cash.ts
git commit -m "feat(api): add getSupplierMonthlySpend procedure (12-month chart data)"
```

---

## Task 4: Add `getSupplierCategoryBreakdown` to cash router

**Files:**
- Modify: `packages/api/src/routers/cash.ts`

**Step 1: Add procedure**

```typescript
// ── getSupplierCategoryBreakdown ─────────────────────────────────────────
const getSupplierCategoryBreakdown = permissionProcedure("shifts.read")
  .input(z.object({
    supplierId: z.string().uuid(),
    startDate:  z.string().optional(),
    endDate:    z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const { supplierId, startDate, endDate } = input;
    const rows = await db.execute<{ category: string; total: string }>(sql`
      SELECT
        category,
        COALESCE(SUM(amount), 0)::text AS total
      FROM expense
      WHERE supplier_id     = ${supplierId}::uuid
        AND organization_id = ${orgId}::uuid
        ${startDate ? sql`AND created_at >= ${startDate}::timestamptz` : sql``}
        ${endDate   ? sql`AND created_at <= ${endDate}::timestamptz`   : sql``}
      GROUP BY category
      ORDER BY SUM(amount) DESC
    `);
    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    return rows.map((r) => ({
      category: r.category,
      total:    Number(r.total),
      pct:      grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0,
    }));
  });
```

**Step 2: Add to `cashRouter` + commit**

```bash
git add packages/api/src/routers/cash.ts
git commit -m "feat(api): add getSupplierCategoryBreakdown procedure"
```

---

## Task 5: Create vendor statement PDF generator

**Files:**
- Create: `apps/web/src/lib/pdf/vendor-statement-pdf.ts`

**Context:** Mirror `invoice-pdf.ts` exactly. That file opens `about:blank` synchronously (before any await — browsers block popups after async calls), fetches the logo via `arrayBuffer` + `btoa`, builds an HTML string, creates a Blob, and sets `win.location.href = blobUrl`. Revoke the URL after 15 seconds. Do NOT use any deprecated browser APIs.

**Step 1: Create the file**

```typescript
// apps/web/src/lib/pdf/vendor-statement-pdf.ts

export interface VendorStatementExpense {
  date: string;
  description: string;
  category: string;
  referenceNumber: string | null;
  paymentMethod: string | null;
  authorizedByName: string | null;
  amount: string;
}

export interface VendorInfo {
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
}

export async function openVendorStatementPdf(
  vendor: VendorInfo,
  expenses: VendorStatementExpense[],
  categoryBreakdown: CategoryBreakdown[],
  period: { startDate: string | null; endDate: string | null },
): Promise<void> {
  // Open window synchronously inside user-gesture context (before any await).
  const win = window.open("about:blank", "_blank");
  const logoBase64 = await fetchLogoBase64();
  const html = buildVendorStatementHtml(vendor, expenses, categoryBreakdown, period, logoBase64);
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  if (win) {
    win.location.href = url;
  } else {
    window.open(url, "_blank");
  }
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

async function fetchLogoBase64(): Promise<string> {
  try {
    const resp = await fetch("/images/bettencourts-logo.png");
    const buf  = await resp.arrayBuffer();
    const b64  = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `data:image/png;base64,${b64}`;
  } catch {
    return "";
  }
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtGYD(n: number): string {
  return `GYD ${n.toLocaleString("en-GY", { minimumFractionDigits: 2 })}`;
}

function buildVendorStatementHtml(
  vendor: VendorInfo,
  expenses: VendorStatementExpense[],
  categoryBreakdown: CategoryBreakdown[],
  period: { startDate: string | null; endDate: string | null },
  logo: string,
): string {
  const logoHtml   = logo ? `<img src="${logo}" class="logo" alt="Bettencourt's Logo" />` : "";
  const periodLabel =
    period.startDate && period.endDate
      ? `${period.startDate} \u2013 ${period.endDate}`
      : "All Time";
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const rows = expenses.map((e) => `
    <tr>
      <td>${esc(e.date)}</td>
      <td>${esc(e.description)}</td>
      <td>${esc(e.category)}</td>
      <td>${esc(e.referenceNumber ?? "\u2014")}</td>
      <td>${esc(e.paymentMethod ?? "\u2014")}</td>
      <td>${esc(e.authorizedByName ?? "\u2014")}</td>
      <td class="amt">${fmtGYD(Number(e.amount))}</td>
    </tr>`).join("");

  const catRows = categoryBreakdown.map((c) => `
    <tr class="cat">
      <td colspan="6">${esc(c.category)}</td>
      <td class="amt">${fmtGYD(c.total)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Vendor Statement \u2014 ${esc(vendor.name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff}
  .page{max-width:860px;margin:0 auto;padding:36px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:2px solid #e2e8f0}
  .logo{height:56px;border-radius:6px}
  .org{font-size:20px;font-weight:700;color:#0f172a;margin-top:10px}
  .org-sub{font-size:11px;color:#64748b;margin-top:4px}
  .title{font-size:22px;font-weight:800;color:#0f172a}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px 0;border-bottom:1px solid #e2e8f0}
  .lbl{font-size:9px;font-weight:700;letter-spacing:.12em;color:#64748b;text-transform:uppercase;margin-bottom:6px}
  .val{font-size:13px;font-weight:600;color:#0f172a}
  .sub{font-size:11px;color:#475569}
  table{width:100%;border-collapse:collapse;margin-top:24px;font-size:11px}
  th{padding:10px 12px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#475569;border-bottom:2px solid #e2e8f0;text-align:left}
  td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .amt{text-align:right;font-variant-numeric:tabular-nums}
  .foot td{padding:12px;font-weight:700;font-size:13px;border-top:2px solid #0f172a;background:#f8fafc}
  .sec{font-size:9px;font-weight:700;letter-spacing:.12em;color:#64748b;text-transform:uppercase;margin:28px 0 8px}
  .cat td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569}
  .ftr{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  @media print{.page{padding:0}}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div>${logoHtml}<div class="org">Bettencourt's Food Inc.</div><div class="org-sub">Georgetown, Guyana</div></div>
    <div style="text-align:right"><div class="title">VENDOR STATEMENT</div></div>
  </div>
  <div class="meta">
    <div>
      <div class="lbl">Vendor</div>
      <div class="val">${esc(vendor.name)}</div>
      ${vendor.contactName ? `<div class="sub">${esc(vendor.contactName)}</div>` : ""}
      ${vendor.phone       ? `<div class="sub">${esc(vendor.phone)}</div>` : ""}
      ${vendor.email       ? `<div class="sub">${esc(vendor.email)}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div class="lbl">Statement Period</div>
      <div class="val">${esc(periodLabel)}</div>
      <div class="lbl" style="margin-top:12px">Generated</div>
      <div class="sub">${new Date().toLocaleString("en-GY")}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Date</th><th>Description</th><th>Category</th>
      <th>Reference</th><th>Method</th><th>Authorized By</th><th class="amt">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot class="foot"><tr>
      <td colspan="6">${expenses.length} transaction${expenses.length !== 1 ? "s" : ""} \u00b7 Total</td>
      <td class="amt">${fmtGYD(total)}</td>
    </tr></tfoot>
  </table>
  ${categoryBreakdown.length > 0 ? `
    <div class="sec">Category Breakdown</div>
    <table><tbody>${catRows}</tbody></table>` : ""}
  <div class="ftr">Bettencourt's Food Inc. &nbsp;&middot;&nbsp; Vendor Statement &nbsp;&middot;&nbsp; Generated ${new Date().toLocaleString("en-GY")}</div>
</div>
</body>
</html>`;
}
```

**Step 2: TypeScript check + commit**

```bash
bun tsc -p apps/web --noEmit
git add apps/web/src/lib/pdf/vendor-statement-pdf.ts
git commit -m "feat(pdf): add vendor statement PDF generator (Blob URL pattern)"
```

---

## Task 6: Create vendor detail page — skeleton, header, period selector

**Files:**
- Create: `apps/web/src/routes/dashboard.suppliers.$id.tsx`

**Context:** React Router v7 flat-routes — filename `dashboard.suppliers.$id.tsx` auto-creates route `/dashboard/suppliers/:id`. Use `useParams()` for the id. Copy the import style from `dashboard.expenses.tsx`.

**Step 1: Create the file**

```typescript
// apps/web/src/routes/dashboard.suppliers.$id.tsx
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Calendar, Download,
  Mail, MapPin, Phone, Printer, TrendingDown, TrendingUp, User,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Link, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv-export";
import { openVendorStatementPdf } from "@/lib/pdf/vendor-statement-pdf";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { AlertTriangle } from "lucide-react";

// ── Period helpers ──────────────────────────────────────────────────────
type PeriodKey =
  | "this_month" | "last_month" | "this_quarter"
  | "last_quarter" | "this_year" | "all_time";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  this_month:    "This Month",
  last_month:    "Last Month",
  this_quarter:  "This Quarter",
  last_quarter:  "Last Quarter",
  this_year:     "This Year",
  all_time:      "All Time",
};

function getPeriodDates(key: PeriodKey): { startDate?: string; endDate?: string } {
  const today = todayGY();
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => d.toISOString();
  switch (key) {
    case "this_month":
      return { startDate: iso(new Date(y, m, 1)), endDate: iso(new Date(y, m + 1, 0, 23, 59, 59)) };
    case "last_month":
      return { startDate: iso(new Date(y, m - 1, 1)), endDate: iso(new Date(y, m, 0, 23, 59, 59)) };
    case "this_quarter": {
      const qs = Math.floor(m / 3) * 3;
      return { startDate: iso(new Date(y, qs, 1)), endDate: iso(new Date(y, qs + 3, 0, 23, 59, 59)) };
    }
    case "last_quarter": {
      const qs = Math.floor(m / 3) * 3 - 3;
      return { startDate: iso(new Date(y, qs, 1)), endDate: iso(new Date(y, qs + 3, 0, 23, 59, 59)) };
    }
    case "this_year":
      return { startDate: iso(new Date(y, 0, 1)), endDate: iso(new Date(y, 11, 31, 23, 59, 59)) };
    case "all_time":
      return {};
  }
}

// ── Page ───────────────────────────────────────────────────────────────
export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod]         = useState<PeriodKey>("this_month");
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("all");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");

  const { startDate, endDate } = useMemo(() => getPeriodDates(period), [period]);

  const { data: vendor, isLoading: vendorLoading } = useQuery(
    orpc.settings.getSupplierById.queryOptions({ input: { id: id! } }),
  );
  const { data: summary, isLoading: summaryLoading } = useQuery(
    orpc.cash.getSupplierSpendSummary.queryOptions({
      input: { supplierId: id!, startDate, endDate },
    }),
  );
  const { data: monthlySpend = [] } = useQuery(
    orpc.cash.getSupplierMonthlySpend.queryOptions({ input: { supplierId: id! } }),
  );
  const { data: categoryBreakdown = [] } = useQuery(
    orpc.cash.getSupplierCategoryBreakdown.queryOptions({
      input: { supplierId: id!, startDate, endDate },
    }),
  );
  const { data: expensesRaw = [] } = useQuery(
    orpc.cash.getExpenses.queryOptions({ input: { supplierId: id!, startDate, endDate } }),
  );

  // ── Derived data ───────────────────────────────────────────────────
  const availableCats = useMemo(
    () => [...new Set(expensesRaw.map((e) => e.category).filter(Boolean))].sort(),
    [expensesRaw],
  );

  const expenses = useMemo(() => {
    let list = [...expensesRaw];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) => e.description.toLowerCase().includes(q) ||
          (e.reference_number ?? "").toLowerCase().includes(q),
      );
    }
    if (catFilter !== "all") list = list.filter((e) => e.category === catFilter);
    list.sort((a, b) =>
      sortDir === "desc"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return list;
  }, [expensesRaw, search, catFilter, sortDir]);

  const tableTotal = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses],
  );

  // Duplicate flag: same amount within 7 days for this vendor
  const duplicateIds = useMemo(() => {
    const flagged = new Set<string>();
    for (let i = 0; i < expensesRaw.length; i++) {
      for (let j = i + 1; j < expensesRaw.length; j++) {
        const a = expensesRaw[i]!;
        const b = expensesRaw[j]!;
        if (
          a.amount === b.amount &&
          Math.abs(
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          ) <= 7 * 86_400_000
        ) {
          flagged.add(a.id);
          flagged.add(b.id);
        }
      }
    }
    return flagged;
  }, [expensesRaw]);

  // ── Handlers ───────────────────────────────────────────────────────
  function handleExportCsv() {
    downloadCsv(
      expenses.map((e) => ({
        Date:             new Date(e.created_at).toLocaleString("en-GY"),
        Description:      e.description,
        Category:         e.category,
        "Reference #":    e.reference_number ?? "",
        "Payment Method": e.payment_method ?? "",
        "Authorized By":  e.authorized_by_name ?? "",
        "Amount (GYD)":   e.amount,
      })),
      `vendor-statement-${vendor?.name ?? id}-${period}.csv`,
    );
  }

  async function handlePrint() {
    if (!vendor) return;
    await openVendorStatementPdf(
      {
        name:        vendor.name,
        contactName: vendor.contactName ?? null,
        email:       vendor.email       ?? null,
        phone:       vendor.phone       ?? null,
        address:     vendor.address     ?? null,
      },
      expenses.map((e) => ({
        date:            new Date(e.created_at).toLocaleDateString("en-GY"),
        description:     e.description,
        category:        e.category,
        referenceNumber: e.reference_number ?? null,
        paymentMethod:   e.payment_method   ?? null,
        authorizedByName: e.authorized_by_name ?? null,
        amount:          e.amount,
      })),
      categoryBreakdown,
      { startDate: startDate ?? null, endDate: endDate ?? null },
    );
  }

  // ── Render: loading ────────────────────────────────────────────────
  if (vendorLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground">
        <Building2 className="size-12 opacity-30" />
        <p>Vendor not found.</p>
        <Button variant="outline" asChild>
          <Link to="/dashboard/suppliers">
            <ArrowLeft className="mr-2 size-4" />Back to Suppliers
          </Link>
        </Button>
      </div>
    );
  }

  const categories: string[] = Array.isArray(vendor.categories)
    ? (vendor.categories as string[])
    : [];

  // % change vs previous period
  const prevTotal = Number(summary?.previousPeriodTotal ?? 0);
  const currTotal = Number(summary?.periodTotal ?? 0);
  const pctChange = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : null;
  const isUp      = pctChange !== null && pctChange > 0;

  const lastDate   = summary?.lastPurchaseDate
    ? new Date(summary.lastPurchaseDate).toLocaleDateString("en-GY")
    : null;
  const daysAgoVal = summary?.lastPurchaseDate
    ? Math.round((Date.now() - new Date(summary.lastPurchaseDate).getTime()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-muted-foreground text-sm">
        <Link to="/dashboard/suppliers" className="hover:text-foreground transition-colors">
          Suppliers
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{vendor.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-2xl">{vendor.name}</h1>
            <Badge variant={vendor.isActive ? "default" : "secondary"}>
              {vendor.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
            {vendor.contactName && (
              <span className="flex items-center gap-1"><User className="size-3" />{vendor.contactName}</span>
            )}
            {vendor.phone && (
              <span className="flex items-center gap-1"><Phone className="size-3" />{vendor.phone}</span>
            )}
            {vendor.email && (
              <span className="flex items-center gap-1"><Mail className="size-3" />{vendor.email}</span>
            )}
            {vendor.address && (
              <span className="flex items-center gap-1"><MapPin className="size-3" />{vendor.address}</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard/suppliers">
            <ArrowLeft className="mr-2 size-4" />All Suppliers
          </Link>
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-muted-foreground" />
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PERIOD_LABELS) as [PeriodKey, string][]).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {summaryLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Period Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-xl">{formatGYD(currTotal)}</p>
              <p className="mt-1 text-muted-foreground text-xs">{summary.periodCount} transaction{summary.periodCount !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">vs. Previous Period</CardTitle>
            </CardHeader>
            <CardContent>
              {pctChange !== null ? (
                <div className={`flex items-center gap-1 font-bold text-xl ${isUp ? "text-red-600" : "text-green-600"}`}>
                  {isUp ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  {Math.abs(pctChange).toFixed(1)}%
                </div>
              ) : (
                <p className="font-bold text-xl text-muted-foreground">—</p>
              )}
              <p className="mt-1 text-muted-foreground text-xs">prev: {formatGYD(prevTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">All-Time Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-xl">{formatGYD(Number(summary.allTimeTotal))}</p>
              <p className="mt-1 text-muted-foreground text-xs">{summary.allTimeCount} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg Transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-xl">{formatGYD(Number(summary.periodAvg))}</p>
              <p className="mt-1 text-muted-foreground text-xs">this period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-xl">{lastDate ?? "—"}</p>
              {daysAgoVal !== null && (
                <p className="mt-1 text-muted-foreground text-xs">
                  {daysAgoVal === 0 ? "today" : `${daysAgoVal}d ago`}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Largest Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-xl">{formatGYD(Number(summary.periodLargest))}</p>
              {summary.periodLargestDesc && (
                <p className="mt-1 truncate text-muted-foreground text-xs" title={summary.periodLargestDesc}>
                  {summary.periodLargestDesc}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Monthly Spend (12 months)</CardTitle></CardHeader>
          <CardContent>
            {monthlySpend.some((m) => m.total > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlySpend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatGYD(Number(v))} />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-muted-foreground text-sm">No spend data yet</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Spend by Category — {PERIOD_LABELS[period]}</CardTitle></CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="category" className="text-xs" width={130} />
                  <Tooltip formatter={(v) => formatGYD(Number(v))} />
                  <Bar dataKey="total" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-muted-foreground text-sm">No category data for this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Transactions</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={expenses.length === 0}>
                <Download className="mr-2 size-4" />Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={expenses.length === 0}>
                <Printer className="mr-2 size-4" />Print Statement
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Input
              placeholder="Search description or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-64"
            />
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {availableCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}>
              Date {sortDir === "desc" ? "↓" : "↑"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm">
              <Building2 className="size-8 opacity-30" />
              <p>No expenses recorded for this vendor in the selected period.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Reference #</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Authorized By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow
                    key={e.id}
                    className={duplicateIds.has(e.id) ? "bg-yellow-50/50 dark:bg-yellow-900/10" : undefined}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(e.created_at).toLocaleDateString("en-GY")}
                    </TableCell>
                    <TableCell className="max-w-48 text-sm">
                      <span className="truncate block" title={e.description}>{e.description}</span>
                      {duplicateIds.has(e.id) && (
                        <span title="Possible duplicate within 7 days" className="ml-1 inline-flex text-yellow-600">
                          <AlertTriangle className="size-3" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{e.category}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {e.reference_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{e.payment_method ?? "—"}</TableCell>
                    <TableCell className="text-sm">{e.authorized_by_name ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatGYD(Number(e.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold">
                    {expenses.length} transaction{expenses.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell className="text-right font-bold text-base">{formatGYD(tableTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
```

**Step 2: Check the exact field names returned from `getExpenses`**

The raw SQL in `cash.ts` around line 608 returns columns like `supplier_name`, `supplier_id`, `reference_number`, `payment_method`. Check whether `authorized_by_name` is returned or if it's just `authorized_by` (a user ID). If it's a user ID, either join to the user table in the query or display the ID. Adjust field names in the component to match.

**Step 3: TypeScript check + commit**

```bash
bun run check-types
git add apps/web/src/routes/"dashboard.suppliers.\$id.tsx"
git commit -m "feat(ui): add vendor detail page (header, KPI cards, charts, transaction table)"
```

---

## Task 7: Make vendor badges in expenses table clickable links

**Files:**
- Modify: `apps/web/src/routes/dashboard.expenses.tsx`

**Context:** The badge is at approximately line 664. The expense row has `e.supplier_id` (nullable string) already in the data shape (confirmed at line 148 and 322). Import `Link` from `react-router` if not already imported.

**Step 1: Add `Link` import** (add to existing react-router import if present, or add new)

```typescript
import { Link } from "react-router";
```

**Step 2: Locate the vendor badge block (around line 664) and replace**

Old:
```tsx
{e.supplier_name ? (
  <Badge variant="secondary" className={`text-xs ${color ?? ""}`}>
    {e.supplier_name}
  </Badge>
) : (
  <span className="text-muted-foreground text-xs">—</span>
)}
```

New:
```tsx
{e.supplier_name && e.supplier_id ? (
  <Link to={`/dashboard/suppliers/${e.supplier_id}`}>
    <Badge
      variant="secondary"
      className={`cursor-pointer text-xs transition-opacity hover:opacity-80 ${color ?? ""}`}
    >
      {e.supplier_name}
    </Badge>
  </Link>
) : e.supplier_name ? (
  <Badge variant="secondary" className={`text-xs ${color ?? ""}`}>
    {e.supplier_name}
  </Badge>
) : (
  <span className="text-muted-foreground text-xs">—</span>
)}
```

**Step 3: TypeScript check + commit**

```bash
bun run check-types
git add apps/web/src/routes/dashboard.expenses.tsx
git commit -m "feat(ui): make vendor badges in expenses table clickable links to vendor ledger"
```

---

## Task 8: Register route + update ROUTE_MODULE_MAP

**Files:**
- Modify: `apps/web/src/routes/dashboard.tsx`

**Context:** The existing `PAGE_TITLES` entry `"/dashboard/suppliers": "Suppliers"` already covers the detail page via the prefix-match logic at line 91. Only ROUTE_MODULE_MAP needs the new entry.

**Step 1: Find `ROUTE_MODULE_MAP` in `dashboard.tsx` and add:**

```typescript
"/dashboard/suppliers/:id": "settings",
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/dashboard.tsx
git commit -m "feat: register vendor detail route in ROUTE_MODULE_MAP"
```

---

## Task 9: Update documentation

**Files:**
- Modify: `docs/USER-MANUAL.md`
- Modify: `apps/fumadocs/content/docs/suppliers.mdx` (create if it doesn't exist)

**Step 1: Find the Suppliers section in USER-MANUAL.md and add a "Vendor Ledger" subsection:**

```markdown
### Viewing a Vendor's Transaction History (Vendor Ledger)

1. Go to **Suppliers** in the sidebar
2. Click any vendor's name to open their **Vendor Ledger**
3. Use the **period selector** (This Month, Last Month, This Quarter, etc.) to change the date range
4. The page shows:
   - **6 summary cards** — period spend, change vs. prior period, all-time total, average transaction, last purchase date, largest expense
   - **Monthly spend chart** — 12-month bar chart showing spending patterns (helpful for spotting seasonal spikes)
   - **Category breakdown** — horizontal chart showing which expense categories this vendor covers
   - **Transaction table** — full list with search bar, category filter, and date sort; grand total pinned to the bottom
5. Transactions with a **yellow warning icon** may be duplicate entries (same amount within 7 days) — review before paying
6. Click **Print Statement** to generate a printable PDF with all transactions and category subtotals
7. Click **Export CSV** to download all filtered transactions

You can also open a vendor's ledger by clicking their name badge directly in the **Expenses** table.
```

**Step 2: Add the same content to fumadocs**

**Step 3: Commit**

```bash
git add docs/USER-MANUAL.md apps/fumadocs/content/docs/
git commit -m "docs: add vendor ledger section to user manual and fumadocs"
```

---

## Task 10: Final verification + Docker rebuild + push

**Step 1: Full TypeScript check**

```bash
bun run check-types
```
Expected: `Tasks: 4 successful` with zero errors

**Step 2: Docker rebuild**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**Step 3: Health check**

```bash
curl -sf http://localhost:3000/health
```

**Step 4: Smoke test**
- Go to https://pos.karetechsolutions.com → Suppliers → click a vendor
- Verify header, 6 KPI cards, charts, transaction table, grand total footer all render
- Change period — verify cards and charts update
- Click Print Statement — verify PDF opens in new tab
- Go to Expenses → verify vendor badges are clickable

**Step 5: Push**

```bash
git push origin master
```

---

## Definition of Done

- [ ] `/dashboard/suppliers/:id` loads with header, category tags, contact info
- [ ] Period selector (6 presets) updates KPI cards, category chart, and transaction table
- [ ] 12-month bar chart renders even with zero-spend months
- [ ] Category breakdown horizontal chart renders
- [ ] Transaction table has search, category filter, date sort
- [ ] Grand total visible in `<TableFooter>` always
- [ ] Yellow duplicate flag appears on rows with same amount within 7 days
- [ ] Print Statement PDF opens in new tab with all rows + category subtotals
- [ ] Export CSV downloads filtered transactions with all columns
- [ ] Vendor badges in Expenses table link to `/dashboard/suppliers/:id`
- [ ] Zero TypeScript errors
- [ ] Clean Docker build, container healthy at `localhost:3000/health`
- [ ] USER-MANUAL.md updated
- [ ] All commits pushed to GitHub
