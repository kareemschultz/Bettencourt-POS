# Plan 19 — Dashboard & Reporting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three data visibility enhancements: a Financial Pulse KPI row on the executive dashboard (expenses, AR, overdue invoices, low stock), a week-over-week sales comparison chart on the Analytics page, and a Budget vs Actual chart on the Budgets page.

**Architecture:** No schema changes needed. All three tasks add new SQL queries to existing routers and new UI sections to existing pages. The dashboard router extends `getSummary()`. The analytics router gets a new `getWeeklyComparison()` procedure. The budgets router gets a new `getBudgetVsActual()` procedure.

**Tech Stack:** Drizzle ORM (raw SQL with `db.execute(sql\`...\``), oRPC procedures, Recharts (already installed — `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer`), React, shadcn/ui Card

**Monorepo conventions:**
- Package manager: `bun` — run as `/home/karetech/.bun/bin/bun run <script>` with `PATH="/home/karetech/.bun/bin:$PATH"`
- Commits: `HUSKY=0 git commit -F /tmp/msg.txt`
- TypeScript check: `PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types`
- Guyana timezone: always use `AT TIME ZONE 'America/Guyana'` in SQL; `toLocaleDateString("en-CA", { timeZone: "America/Guyana" })` in JS
- Project root: `/home/karetech/projects/bettencourt/Bettencourt-POS`

---

## Task 1: Extend `getSummary()` with Financial Pulse fields

**Files:**
- Modify: `packages/api/src/routers/dashboard.ts`

**Step 1: Read the current router**

Read `packages/api/src/routers/dashboard.ts` (the full file is ~115 lines). Note the `Promise.all` pattern with 8 parallel queries.

**Step 2: Add 4 new queries to the `Promise.all`**

Add these 4 new queries to the existing `Promise.all` array (alongside the 8 existing ones):

```typescript
    // Expenses today
    db.execute(
      sql`SELECT COALESCE(SUM(amount), 0)::numeric as total
          FROM expense
          WHERE DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`,
    ),
    // Open invoices count + total outstanding
    db.execute(
      sql`SELECT COUNT(*)::int as cnt,
                COALESCE(SUM(total - amount_paid), 0)::numeric as outstanding
          FROM invoice
          WHERE status IN ('sent', 'partial')`,
    ),
    // Overdue invoices count
    db.execute(
      sql`SELECT COUNT(*)::int as cnt
          FROM invoice
          WHERE status IN ('sent', 'partial')
            AND due_date < NOW()`,
    ),
    // Low / out-of-stock alerts count
    db.execute(
      sql`SELECT COUNT(*)::int as cnt
          FROM stock_alert
          WHERE acknowledged = false
            AND alert_type IN ('low_stock', 'out_of_stock')`,
    ),
```

**Step 3: Destructure the new results**

Update the destructuring (currently 8 variables, add 4 more):
```typescript
const [
  statsResult,
  productCountResult,
  openShiftsResult,
  recentOrdersResult,
  topProductsResult,
  paymentBreakdownResult,
  voidCountResult,
  hourlySalesResult,
  expensesTodayResult,      // NEW
  openInvoicesResult,       // NEW
  overdueInvoicesResult,    // NEW
  lowStockResult,           // NEW
] = await Promise.all([...]);
```

**Step 4: Add to return value**

Extend the `return { ... }` object:
```typescript
return {
  stats: statsResult.rows[0] as Record<string, unknown>,
  productCount: Number((productCountResult.rows[0] as Record<string, unknown>).cnt),
  openShifts: Number((openShiftsResult.rows[0] as Record<string, unknown>).cnt),
  recentOrders: recentOrdersResult.rows as Record<string, unknown>[],
  topProducts: topProductsResult.rows as Record<string, unknown>[],
  paymentBreakdown: paymentBreakdownResult.rows as Record<string, unknown>[],
  voidCount: Number((voidCountResult.rows[0] as Record<string, unknown>).cnt),
  hourlySales: hourlySalesResult.rows as Record<string, unknown>[],
  // NEW — Financial Pulse
  expensesToday: String((expensesTodayResult.rows[0] as Record<string, unknown>).total ?? "0"),
  openInvoicesCount: Number((openInvoicesResult.rows[0] as Record<string, unknown>).cnt ?? 0),
  openInvoicesTotal: String((openInvoicesResult.rows[0] as Record<string, unknown>).outstanding ?? "0"),
  overdueInvoicesCount: Number((overdueInvoicesResult.rows[0] as Record<string, unknown>).cnt ?? 0),
  lowStockCount: Number((lowStockResult.rows[0] as Record<string, unknown>).cnt ?? 0),
};
```

**Step 5: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(dashboard): extend getSummary with financial pulse KPIs\n\nAdds: expensesToday, openInvoicesCount, openInvoicesTotal,\noverdueInvoicesCount, lowStockCount\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 2: Financial Pulse UI row on executive dashboard

**Files:**
- Modify: `apps/web/src/routes/dashboard._index.tsx`

**Step 1: Read the dashboard home page**

Read `apps/web/src/routes/dashboard._index.tsx`. Find the executive dashboard section that renders the 4-card stats grid (Today's Revenue, Orders Today, Active Products, Open Shifts). Note the Card component imports.

**Step 2: Add Financial Pulse row**

After the existing 4-card stats grid, add a new row. The dashboard data comes from `orpc.dashboard.getSummary.queryOptions()` — the new fields are available once the API is updated.

```tsx
{/* Financial Pulse row */}
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  <Card>
    <CardContent className="p-4">
      <p className="text-xs font-medium text-muted-foreground">Expenses Today</p>
      <p className="mt-1 text-xl font-bold text-destructive">
        {formatCurrency(Number(summary.expensesToday))}
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-4">
      <p className="text-xs font-medium text-muted-foreground">AR Outstanding</p>
      <p className="mt-1 text-xl font-bold text-violet-600">
        {formatCurrency(Number(summary.openInvoicesTotal))}
      </p>
      <p className="text-xs text-muted-foreground">{summary.openInvoicesCount} invoice(s)</p>
    </CardContent>
  </Card>

  <Card className={summary.overdueInvoicesCount > 0 ? "border-destructive/40" : ""}>
    <CardContent className="p-4">
      <p className="text-xs font-medium text-muted-foreground">Overdue Invoices</p>
      <p className={`mt-1 text-xl font-bold ${summary.overdueInvoicesCount > 0 ? "text-destructive" : ""}`}>
        {summary.overdueInvoicesCount}
      </p>
      {summary.overdueInvoicesCount > 0 && (
        <Link to="/dashboard/invoices" className="text-xs text-destructive hover:underline">
          View →
        </Link>
      )}
    </CardContent>
  </Card>

  <Card
    className={summary.lowStockCount > 0 ? "border-amber-400/40" : ""}
    asChild
  >
    <Link to="/dashboard/stock-alerts">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">Low Stock</p>
        <p className={`mt-1 text-xl font-bold ${summary.lowStockCount > 0 ? "text-amber-600" : ""}`}>
          {summary.lowStockCount}
        </p>
        {summary.lowStockCount > 0 && (
          <p className="text-xs text-amber-600">Need attention</p>
        )}
      </CardContent>
    </Link>
  </Card>
</div>
```

Note: `formatCurrency` should already exist in the file or in `@/lib/utils`. If it doesn't, add:
```typescript
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GY", {
    style: "currency",
    currency: "GYD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
```

**Step 3: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(dashboard): Financial Pulse KPI row (expenses, AR, overdue, low stock)\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 3: Add `getWeeklyComparison()` to analytics router

**Files:**
- Modify: `packages/api/src/routers/analytics.ts` (or `reports.ts` — check which exists)

**Step 1: Find the analytics router**

Read the first 30 lines of `packages/api/src/routers/analytics.ts`. Confirm it exports an `analyticsRouter` object.

**Step 2: Add the procedure**

At the end of `analytics.ts`, before the export, add:

```typescript
// ── getWeeklyComparison ─────────────────────────────────────────────────
// Returns this week vs last week sales by day (Mon–Sun), Guyana timezone.
const getWeeklyComparison = permissionProcedure("orders.read").handler(async () => {
  const result = await db.execute(sql`
    WITH week_data AS (
      SELECT
        DATE(created_at AT TIME ZONE 'America/Guyana') as day,
        COALESCE(SUM(total), 0)::numeric as revenue,
        COUNT(*)::int as orders
      FROM "order"
      WHERE status IN ('completed', 'closed')
        AND created_at AT TIME ZONE 'America/Guyana'
          >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date - interval '13 days'
      GROUP BY DATE(created_at AT TIME ZONE 'America/Guyana')
    ),
    -- Build Mon-Sun for this week (most recent Mon)
    this_week AS (
      SELECT
        generate_series(
          date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date),
          date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date) + interval '6 days',
          interval '1 day'
        )::date AS day
    ),
    last_week AS (
      SELECT
        generate_series(
          date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date) - interval '7 days',
          date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date) - interval '1 day',
          interval '1 day'
        )::date AS day
    )
    SELECT
      tw.day::text as "thisWeekDay",
      lw.day::text as "lastWeekDay",
      TO_CHAR(tw.day, 'Dy') as "dayLabel",
      COALESCE(wd_this.revenue, 0)::text as "thisWeekRevenue",
      COALESCE(wd_last.revenue, 0)::text as "lastWeekRevenue",
      COALESCE(wd_this.orders, 0)::int as "thisWeekOrders",
      COALESCE(wd_last.orders, 0)::int as "lastWeekOrders"
    FROM this_week tw
    JOIN last_week lw ON tw.day = lw.day + interval '7 days'
    LEFT JOIN week_data wd_this ON wd_this.day = tw.day
    LEFT JOIN week_data wd_last ON wd_last.day = lw.day
    ORDER BY tw.day
  `);

  return result.rows as Array<{
    thisWeekDay: string;
    lastWeekDay: string;
    dayLabel: string;
    thisWeekRevenue: string;
    lastWeekRevenue: string;
    thisWeekOrders: number;
    lastWeekOrders: number;
  }>;
});
```

Add `getWeeklyComparison` to the `analyticsRouter` export.

**Step 3: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(analytics): getWeeklyComparison endpoint (this week vs last week by day)\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 4: Weekly Comparison Chart UI

**Files:**
- Modify: `apps/web/src/routes/dashboard.analytics.tsx`

**Step 1: Read the analytics page**

Read `apps/web/src/routes/dashboard.analytics.tsx`. Understand how existing Recharts components are used and how queries are structured.

**Step 2: Add the weekly comparison section**

Add a query at the top of the component:
```typescript
const { data: weeklyData } = useQuery(
  orpc.analytics.getWeeklyComparison.queryOptions({}),
);
```

Add a toggle for Revenue vs Orders view:
```typescript
const [weeklyMetric, setWeeklyMetric] = useState<"revenue" | "orders">("revenue");
```

Add the chart section below existing charts:
```tsx
{/* Week-over-Week Comparison */}
<Card>
  <CardContent className="p-4">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-semibold">This Week vs Last Week</h3>
      <div className="flex rounded-md border text-xs">
        <button
          className={`px-3 py-1 ${weeklyMetric === "revenue" ? "bg-muted font-medium" : ""}`}
          onClick={() => setWeeklyMetric("revenue")}
        >
          Revenue
        </button>
        <button
          className={`px-3 py-1 ${weeklyMetric === "orders" ? "bg-muted font-medium" : ""}`}
          onClick={() => setWeeklyMetric("orders")}
        >
          Orders
        </button>
      </div>
    </div>
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={weeklyData ?? []} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={weeklyMetric === "revenue" ? (v) => `$${(v / 1000).toFixed(0)}k` : undefined}
        />
        <RechartsTooltip
          formatter={(value: number, name: string) =>
            weeklyMetric === "revenue"
              ? [new Intl.NumberFormat("en-GY", { style: "currency", currency: "GYD" }).format(value), name]
              : [value, name]
          }
        />
        <Legend />
        <Bar
          dataKey={weeklyMetric === "revenue" ? "thisWeekRevenue" : "thisWeekOrders"}
          name="This Week"
          fill="#0f766e"
          radius={[3, 3, 0, 0]}
          // Revenue comes as string from API, convert:
          // Use a transform if needed
        />
        <Bar
          dataKey={weeklyMetric === "revenue" ? "lastWeekRevenue" : "lastWeekOrders"}
          name="Last Week"
          fill="#94a3b8"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </CardContent>
</Card>
```

**Note on numeric conversion:** The revenue fields come as strings from the API. Recharts needs numbers. Use a `transform` or map the data before passing:
```typescript
const chartData = (weeklyData ?? []).map(d => ({
  ...d,
  thisWeekRevenue: Number(d.thisWeekRevenue),
  lastWeekRevenue: Number(d.lastWeekRevenue),
}));
```

**Step 3: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(analytics): week-over-week comparison bar chart (revenue/orders toggle)\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 5: Add `getBudgetVsActual()` to budgets router

**Files:**
- Modify: `packages/api/src/routers/budgets.ts`

**Step 1: Read the budgets router**

Read `packages/api/src/routers/budgets.ts` (already read earlier — 50 lines). Note the `requireOrganizationId` pattern and `schema.budget` structure. Budget has `category: string` and `budgeted: numeric` fields (based on schema from earlier read).

**Step 2: Read the budget schema**

Read `packages/api/src/routers/budgets.ts` lines 50–end to see what fields `budget` has.

**Step 3: Add `getBudgetVsActual` procedure**

Before the export, add:
```typescript
// ── getBudgetVsActual ───────────────────────────────────────────────────
// Compares current-month budget amounts against actual expense totals per category.
const getBudgetVsActual = permissionProcedure("reports.read").handler(
  async ({ context }) => {
    const orgId = requireOrganizationId(context);
    const now = new Date();
    const month = now.toLocaleString("en-CA", {
      timeZone: "America/Guyana",
      year: "numeric",
      month: "2-digit",
    }); // "YYYY-MM"
    const [year, mon] = month.split("-");

    const result = await db.execute(sql`
      SELECT
        b.category,
        b.budgeted::text as budgeted,
        COALESCE(SUM(e.amount), 0)::text as actual,
        (b.budgeted - COALESCE(SUM(e.amount), 0))::text as variance
      FROM budget b
      LEFT JOIN expense e ON e.category = b.category
        AND e.organization_id = b.organization_id
        AND EXTRACT(YEAR  FROM e.created_at AT TIME ZONE 'America/Guyana') = ${Number(year)}
        AND EXTRACT(MONTH FROM e.created_at AT TIME ZONE 'America/Guyana') = ${Number(mon)}
      WHERE b.organization_id = ${orgId}
      GROUP BY b.category, b.budgeted
      ORDER BY b.category
    `);

    const rows = result.rows as Array<{
      category: string;
      budgeted: string;
      actual: string;
      variance: string;
    }>;

    const totalBudgeted = rows.reduce((s, r) => s + Number(r.budgeted), 0);
    const totalActual = rows.reduce((s, r) => s + Number(r.actual), 0);

    return {
      rows,
      totalBudgeted: totalBudgeted.toString(),
      totalActual: totalActual.toString(),
      totalVariance: (totalBudgeted - totalActual).toString(),
      month,
    };
  },
);
```

Add `getBudgetVsActual` to the `budgetsRouter` export.

**Step 4: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(budgets): getBudgetVsActual endpoint — current-month budget vs actual spend\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 6: Budget vs Actual Chart UI

**Files:**
- Modify: `apps/web/src/routes/dashboard.budgets.tsx`

**Step 1: Read the budgets page**

Read `apps/web/src/routes/dashboard.budgets.tsx`. Understand current layout (table of budgets with category, amount, alert threshold). Find where to add the chart — below the table as a new Card.

**Step 2: Add the chart query**

At the top of the component:
```typescript
const { data: budgetActual } = useQuery(
  orpc.budgets.getBudgetVsActual.queryOptions({}),
);
```

**Step 3: Add the chart section**

After the existing budgets table Card, add:
```tsx
{budgetActual && budgetActual.rows.length > 0 && (
  <Card>
    <CardContent className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Budget vs Actual — {budgetActual.month}</h3>
          <p className="text-xs text-muted-foreground">Current month spending vs budget</p>
        </div>
        <div className="text-right text-xs">
          <span className={Number(budgetActual.totalVariance) >= 0 ? "text-green-600" : "text-destructive"}>
            {Number(budgetActual.totalVariance) >= 0 ? "Under budget" : "Over budget"} by{" "}
            {new Intl.NumberFormat("en-GY", { style: "currency", currency: "GYD" }).format(
              Math.abs(Number(budgetActual.totalVariance))
            )}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, budgetActual.rows.length * 44)}>
        <BarChart
          layout="vertical"
          data={budgetActual.rows.map(r => ({
            category: r.category,
            budgeted: Number(r.budgeted),
            actual: Number(r.actual),
          }))}
          margin={{ left: 120, right: 20, top: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 11 }}
            width={115}
          />
          <RechartsTooltip
            formatter={(value: number) =>
              new Intl.NumberFormat("en-GY", { style: "currency", currency: "GYD" }).format(value)
            }
          />
          <Legend />
          <Bar dataKey="budgeted" name="Budget" fill="#0f766e" radius={[0, 3, 3, 0]} />
          <Bar
            dataKey="actual"
            name="Actual"
            radius={[0, 3, 3, 0]}
            // Color each bar: green if under budget, red if over
            fill="#22c55e"
            // For per-bar coloring, we'd need Cell component — use static color for simplicity
          />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
)}
```

Add missing Recharts imports if needed (check existing imports at top of the file):
```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
```

**Step 4: TypeScript check + commit**
```bash
PATH="/home/karetech/.bun/bin:$PATH" /home/karetech/.bun/bin/bun run check-types
python3 -c "
with open('/tmp/msg.txt','w') as f:
    f.write('feat(budgets): Budget vs Actual horizontal bar chart for current month\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n')
"
HUSKY=0 git commit -F /tmp/msg.txt
```

---

## Task 7: Final — TypeScript check, push, Docker deploy

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

**Step 4: Verify container**
```bash
docker ps --filter "name=kt-bettencourt-pos" --format "table {{.Names}}\t{{.Status}}"
```
Expected: `Up N seconds`
