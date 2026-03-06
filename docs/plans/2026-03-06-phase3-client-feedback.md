# Bettencourt POS Phase 3 — Client Feedback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all client feedback from Bonita: Check Off dual workflow, department time-based access, discount/price supervisor gates, pickup/delivery enforcement, product protein categories, production report, credit sales, and PDF export.

**Architecture:** Tasks are grouped by dependency. Group A (quick UI) and Group F (PDF) are fully independent. Group B (DB) must land before Groups C/D/E. Group G (credit sales) only needs a new payment method + API hook.

**Tech Stack:** React Router v7, Drizzle ORM (Postgres), oRPC, TanStack Query, Bun, Tailwind, shadcn/ui

---

## What Already Exists (DO NOT REBUILD)

- `supervisor-override-dialog.tsx` + `use-supervisor-override.ts` + `settings.verifySupervisor` API ✅
- `pos.tsx` standalone cashier route ✅
- `departmentOverrideActive` state in `pos-terminal.tsx` ✅
- `order.customerPhone`, `order.deliveryAddress`, `order.estimatedReadyAt` columns ✅
- Invoices & Quotations module ✅
- `dashboard.expenses.tsx` ✅
- Production tracker with opening/reorder/closing modes ✅
- `product.reportingCategoryId` + `product.reportingName` ✅

---

## Group A — Quick UI Wins (No DB, Fully Independent)

### Task A1: Rename "Production" → "Check Off"

**Files:**
- Modify: `apps/web/src/components/layout/app-sidebar.tsx:107`
- Modify: `apps/web/src/components/production/production-tracker.tsx` (heading)

**Steps:**

**Step 1: Update sidebar label**

In `app-sidebar.tsx`, change:
```ts
{ title: "Production", url: "/dashboard/production", ... }
```
to:
```ts
{ title: "Check Off", url: "/dashboard/production", ... }
```

**Step 2: Update page heading in production-tracker.tsx**

Find the page heading (look for "Production Tracker" or similar) and change to "Check Off".
Also update `MODE_CONFIG.opening.subLabel` from `"Restaurant / Bakery"` to `"Food to Restaurant"`.

**Step 3: Verify**
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run check-types 2>&1 | grep -c "error" || echo "0 errors"
```

**Step 4: Commit**
```bash
git add apps/web/src/components/layout/app-sidebar.tsx apps/web/src/components/production/production-tracker.tsx
git commit -m "feat: rename Production to Check Off in sidebar and page heading"
```

---

### Task A2: Pickup/Delivery Enforcement + 45-min Expiry Timer

**Files:**
- Modify: `apps/web/src/components/pos/pos-terminal.tsx` (checkout validation + timer display)

**Context:** `orderMode` state already exists with values `"dine_in" | "pickup" | "delivery"`. `customerPhone` and `deliveryAddress` states exist. The checkout mutation is called `checkoutMutation`.

**Step 1: Read the checkout handler in pos-terminal.tsx**

Find the `checkoutMutation` call (search for `pos.checkout`). It's around line 200-300.

**Step 2: Add validation before checkout**

Find the function that calls `checkoutMutation.mutate(...)` and add before it:
```ts
// Validate pickup/delivery requirements
if (orderMode === "pickup" && !customerPhone.trim()) {
  toast.error("Phone number required for pickup orders");
  return;
}
if (orderMode === "delivery") {
  if (!customerPhone.trim()) {
    toast.error("Phone number required for delivery orders");
    return;
  }
  if (!deliveryAddress.trim()) {
    toast.error("Delivery address required for delivery orders");
    return;
  }
}
```

**Step 3: Track pickup expiry**

The `lastOrderMeta` state already tracks `{ placedAt: Date; mode: string }`. Find where it's set (after successful checkout) and ensure `mode` is set to `orderMode`.

**Step 4: Display expiry timer for pickup**

Find the section where `lastOrderMeta` is displayed (after checkout success). Add a pickup expiry display:
```tsx
{lastOrderMeta?.mode === "pickup" && (() => {
  const expiresAt = new Date(lastOrderMeta.placedAt.getTime() + 45 * 60 * 1000);
  const now = new Date();
  const minsLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));
  return (
    <div className={`text-xs font-medium ${minsLeft <= 5 ? "text-red-600" : minsLeft <= 10 ? "text-amber-600" : "text-muted-foreground"}`}>
      Pickup expires: {expiresAt.toLocaleTimeString("en-GY", { hour: "2-digit", minute: "2-digit" })}
      {minsLeft > 0 && ` (${minsLeft} min left)`}
    </div>
  );
})()}
```

**Step 5: Commit**
```bash
git add apps/web/src/components/pos/pos-terminal.tsx
git commit -m "feat: enforce phone/address for pickup/delivery, show 45-min expiry timer"
```

---

### Task A3: Discount Requires Supervisor for Unauthorized Users

**Files:**
- Modify: `apps/web/src/components/pos/pos-terminal.tsx` (discount button handler)

**Context:** `canApplyDiscount` is already derived from `userPermissions.discounts?.includes("apply")`. The `requestOverride` function from `useSupervisorOverride` already exists in the component. The discount button opens `setDiscountOpen(true)`.

**Step 1: Find the discount button**

Search for `setDiscountOpen(true)` in pos-terminal.tsx.

**Step 2: Wrap with supervisor gate**

Change the onClick from:
```ts
onClick={() => setDiscountOpen(true)}
```
to:
```ts
onClick={async () => {
  if (canApplyDiscount) {
    setDiscountOpen(true);
  } else {
    try {
      await requestOverride("discounts.apply");
      setDiscountOpen(true);
    } catch {
      // cancelled or denied — do nothing
    }
  }
}}
```

**Step 3: Commit**
```bash
git add apps/web/src/components/pos/pos-terminal.tsx
git commit -m "feat: discount button requires supervisor PIN for unauthorized cashiers"
```

---

### Task A4: Time-Based Department Access (Pastry→Food at 3pm)

**Files:**
- Modify: `apps/web/src/components/pos/pos-terminal.tsx`

**Context:** `departmentOverrideActive` state exists. The "Other Departments" button calls `requestOverride("departments.override")`. At 3pm Guyana time, Food dept cashiers should automatically access pastry without supervisor — this is implemented by auto-setting `departmentOverrideActive = true` when it's after 3pm.

**Step 1: Add time-based auto-unlock on mount**

Find the `useEffect` hooks in pos-terminal.tsx. Add:
```ts
// Auto-unlock department override after 3pm (15:00) Guyana time
useEffect(() => {
  function checkTime() {
    const now = new Date();
    // Guyana is UTC-4
    const gyHour = (now.getUTCHours() - 4 + 24) % 24;
    if (gyHour >= 15) {
      setDepartmentOverrideActive(true);
    }
  }
  checkTime();
  const interval = setInterval(checkTime, 60_000); // re-check every minute
  return () => clearInterval(interval);
}, []);
```

**Step 2: Commit**
```bash
git add apps/web/src/components/pos/pos-terminal.tsx
git commit -m "feat: auto-unlock all departments after 3pm Guyana time"
```

---

## Group B — DB Schema Changes (Run First, Others Depend on This)

### Task B1: Add protein category + workflow to schema

**Files:**
- Modify: `packages/db/src/schema/product.ts`
- Modify: `packages/db/src/schema/production.ts`

**Step 1: Add proteinCategoryId to product**

In `product.ts`, inside the `product` pgTable columns, add after `reportingCategoryId`:
```ts
proteinCategoryId: uuid("protein_category_id").references(
  () => reportingCategory.id,
  { onDelete: "set null" },
),
```

Also add an index at the bottom of the table definition:
```ts
index("idx_product_protein_category").on(table.proteinCategoryId),
```

**Step 2: Add workflow to productionLog**

In `production.ts`, inside the `productionLog` pgTable, add after `entryType`:
```ts
workflow: text("workflow"), // "restaurant" | "bakery" | null
```

**Step 3: Push schema to DB**
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run db:push
```
Expected: 2 new columns added. No data loss.

**Step 4: Commit**
```bash
git add packages/db/src/schema/product.ts packages/db/src/schema/production.ts
git commit -m "feat: add proteinCategoryId to product, workflow to productionLog"
```

---

## Group C — Check Off Dual Workflow (Depends on B1)

### Task C1: Add workflow tabs to production tracker

**Files:**
- Modify: `apps/web/src/components/production/production-tracker.tsx`
- Modify: `apps/web/src/routes/dashboard.production.tsx`

**Context:** `ProductionTracker` receives `products: ProductItem[]`. Products have `department_id` and `department_name`. The workflow determines which products to show.

**Step 1: Add workflow state + tabs to ProductionTracker**

At the top of the `ProductionTracker` component, add:
```ts
const [workflow, setWorkflow] = useState<"restaurant" | "bakery">("restaurant");
```

Below the mode selector buttons, add workflow tabs:
```tsx
<div className="flex gap-2 mb-4">
  <Button
    size="sm"
    variant={workflow === "restaurant" ? "default" : "outline"}
    onClick={() => setWorkflow("restaurant")}
  >
    Restaurant → Food
  </Button>
  <Button
    size="sm"
    variant={workflow === "bakery" ? "default" : "outline"}
    onClick={() => setWorkflow("bakery")}
  >
    Bakery → Pastry
  </Button>
</div>
```

**Step 2: Filter products by workflow**

The products prop includes all products. We need to filter by department. Add a prop `workflowDepartments?: { restaurant: string[]; bakery: string[] }` — OR simpler: filter based on department name keywords.

Simplest approach — filter by department name containing "pastry" or "bakery" for bakery workflow:
```ts
const filteredProducts = products.filter(p => {
  if (workflow === "bakery") {
    return p.department_name?.toLowerCase().includes("pastry") ||
           p.department_name?.toLowerCase().includes("bakery");
  }
  // restaurant: everything that is NOT bakery/pastry
  return !p.department_name?.toLowerCase().includes("pastry") &&
         !p.department_name?.toLowerCase().includes("bakery");
});
```

Use `filteredProducts` instead of `products` everywhere in the component.

**Step 3: Pass workflow to production.logEntry API**

Find where `production.logEntry` is called in the production tracker. Add `workflow` to the mutation input:
```ts
workflow: workflow,
```

**Step 4: Update API to accept workflow**

In `packages/api/src/routers/production.ts`, find the `logEntry` procedure input schema and add:
```ts
workflow: z.string().optional(),
```
And in the handler, pass it to the DB insert:
```ts
workflow: input.workflow ?? null,
```

**Step 5: Commit**
```bash
git add apps/web/src/components/production/production-tracker.tsx packages/api/src/routers/production.ts
git commit -m "feat: Check Off dual workflow — Restaurant/Food and Bakery/Pastry tabs"
```

---

## Group D — Production Report (Depends on B1)

### Task D1: Production report API endpoint

**Files:**
- Modify: `packages/api/src/routers/production.ts`

**Step 1: Add `getReport` procedure**

```ts
const getReport = permissionProcedure("reports.read")
  .input(z.object({
    date: z.string(), // YYYY-MM-DD
    workflow: z.string().optional(),
  }))
  .handler(async ({ input }) => {
    const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

    // 1. Get Check Off totals for the date
    const conditions = [
      eq(schema.productionLog.logDate, input.date),
    ];
    if (input.workflow) {
      conditions.push(eq(schema.productionLog.workflow, input.workflow));
    }

    const entries = await db
      .select({
        productId: schema.productionLog.productId,
        productName: schema.productionLog.productName,
        entryType: schema.productionLog.entryType,
        quantity: schema.productionLog.quantity,
      })
      .from(schema.productionLog)
      .where(and(...conditions));

    // Group by product: sum opening, reorder, closing
    const byProduct = new Map<string, { name: string; opening: number; reorder: number; closing: number }>();
    for (const e of entries) {
      const key = e.productId ?? e.productName;
      const cur = byProduct.get(key) ?? { name: e.productName, opening: 0, reorder: 0, closing: 0 };
      if (e.entryType === "opening") cur.opening += e.quantity;
      if (e.entryType === "reorder") cur.reorder += e.quantity;
      if (e.entryType === "closing") cur.closing += e.quantity;
      byProduct.set(key, cur);
    }

    // 2. Get actual sold from order line items for the date
    const dateStart = new Date(`${input.date}T00:00:00-04:00`); // Guyana UTC-4
    const dateEnd = new Date(`${input.date}T23:59:59-04:00`);

    const soldItems = await db
      .select({
        productId: schema.orderLineItem.productId,
        productName: schema.orderLineItem.productNameSnapshot,
        quantity: schema.orderLineItem.quantity,
      })
      .from(schema.orderLineItem)
      .innerJoin(schema.order, eq(schema.orderLineItem.orderId, schema.order.id))
      .where(
        and(
          eq(schema.order.organizationId, DEFAULT_ORG_ID),
          eq(schema.order.status, "completed"),
          gte(schema.order.createdAt, dateStart),
          lte(schema.order.createdAt, dateEnd),
          eq(schema.orderLineItem.voided, false),
        )
      );

    const actualByProduct = new Map<string, number>();
    for (const s of soldItems) {
      const key = s.productId ?? s.productName;
      actualByProduct.set(key, (actualByProduct.get(key) ?? 0) + s.quantity);
    }

    // 3. Build report rows
    const rows = Array.from(byProduct.entries()).map(([key, v]) => {
      const expected = v.opening + v.reorder - v.closing;
      const actual = actualByProduct.get(key) ?? 0;
      return {
        productId: key,
        productName: v.name,
        opening: v.opening,
        reorder: v.reorder,
        closing: v.closing,
        expected,
        actual,
        variance: actual - expected,
      };
    });

    return { rows, date: input.date };
  });
```

Add necessary imports: `gte`, `lte` from `drizzle-orm`.

Export it in the router: `getReport,`

**Step 2: Commit**
```bash
git add packages/api/src/routers/production.ts
git commit -m "feat: production.getReport endpoint — expected vs actual with variance"
```

---

### Task D2: Production Report UI page

**Files:**
- Create: `apps/web/src/routes/dashboard.production-report.tsx`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

**Step 1: Create the report page**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProductionReportPage() {
  const [date, setDate] = useState(todayGY());
  const [workflow, setWorkflow] = useState<"restaurant" | "bakery">("restaurant");

  const { data, isLoading } = useQuery(
    orpc.production.getReport.queryOptions({ input: { date, workflow } })
  );

  const rows = data?.rows ?? [];
  const balanced = rows.filter(r => r.variance === 0).length;
  const short = rows.filter(r => r.variance < 0).length;
  const over = rows.filter(r => r.variance > 0).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Report</h1>
          <p className="text-muted-foreground text-sm">Expected vs Actual Sales — Check Off vs Register</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <Button size="sm" variant={workflow === "restaurant" ? "default" : "outline"} onClick={() => setWorkflow("restaurant")}>Restaurant</Button>
            <Button size="sm" variant={workflow === "bakery" ? "default" : "outline"} onClick={() => setWorkflow("bakery")}>Bakery</Button>
          </div>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{balanced}</div>
          <div className="text-sm text-muted-foreground">Balanced</div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{short}</div>
          <div className="text-sm text-muted-foreground">Short</div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{over}</div>
          <div className="text-sm text-muted-foreground">Over</div>
        </div>
      </div>

      {/* Report table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Item</th>
              <th className="text-center p-3 font-medium">Opening</th>
              <th className="text-center p-3 font-medium">Reorder</th>
              <th className="text-center p-3 font-medium">Closing</th>
              <th className="text-center p-3 font-medium">Expected Sold</th>
              <th className="text-center p-3 font-medium">Actual Sold</th>
              <th className="text-center p-3 font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No data for {date}</td></tr>
            ) : (
              rows.map(row => (
                <tr key={row.productId} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{row.productName}</td>
                  <td className="p-3 text-center">{row.opening}</td>
                  <td className="p-3 text-center">{row.reorder}</td>
                  <td className="p-3 text-center">{row.closing}</td>
                  <td className="p-3 text-center font-medium">{row.expected}</td>
                  <td className="p-3 text-center">{row.actual}</td>
                  <td className="p-3 text-center">
                    <Badge variant={row.variance === 0 ? "secondary" : row.variance < 0 ? "destructive" : "outline"}
                      className={row.variance > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : ""}>
                      {row.variance > 0 ? "+" : ""}{row.variance}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Add to sidebar**

In `app-sidebar.tsx`, add to `managementNavItems` (after Analytics):
```ts
{
  title: "Production Report",
  url: "/dashboard/production-report",
  icon: BarChart3,
  module: "reports",
  roles: ["executive", "admin"],
},
```

**Step 3: Commit**
```bash
git add apps/web/src/routes/dashboard.production-report.tsx apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat: production report page — expected vs actual variance by date"
```

---

## Group E — Product Protein Category UI (Depends on B1)

### Task E1: Add protein category to products page

**Files:**
- Modify: `apps/web/src/routes/dashboard.products.tsx` (add field to edit form)
- Modify: `packages/api/src/routers/products.ts` (accept proteinCategoryId)

**Step 1: Update products API**

In `packages/api/src/routers/products.ts`, find the `update` procedure. Add to its input schema:
```ts
proteinCategoryId: z.string().uuid().nullable().optional(),
```
And in the updates object:
```ts
if (input.proteinCategoryId !== undefined) updates.proteinCategoryId = input.proteinCategoryId;
```

Also update the `create` procedure input schema similarly.

**Step 2: Add protein category selector to product edit dialog**

In `dashboard.products.tsx`, find the product edit form (where `reportingCategoryId` is already set). Add immediately after the "Reporting Category" field:

```tsx
<div className="space-y-2">
  <Label>Protein Category (for production report)</Label>
  <Select
    value={editForm.proteinCategoryId ?? "none"}
    onValueChange={v => setEditForm(f => ({ ...f, proteinCategoryId: v === "none" ? null : v }))}
  >
    <SelectTrigger>
      <SelectValue placeholder="None (standalone item)" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">None</SelectItem>
      {categories.map(c => (
        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    E.g. "Cook up BBQ" → protein category "Barbecue Chicken". Used to group totals in production report.
  </p>
</div>
```

**Step 3: Commit**
```bash
git add apps/web/src/routes/dashboard.products.tsx packages/api/src/routers/products.ts
git commit -m "feat: add protein category field to products for production report grouping"
```

---

## Group F — PDF Export for Invoices & Quotations (Independent)

### Task F1: Print-ready invoice layout + download button

**Files:**
- Modify: `apps/web/src/routes/dashboard.invoices.tsx`
- Modify: `apps/web/src/routes/dashboard.quotations.tsx`
- Create: `apps/web/src/styles/print.css` (or add to global CSS)

**Step 1: Add print styles**

In `apps/web/src/app.css` (or global stylesheet), add:
```css
@media print {
  /* Hide everything except the invoice detail panel */
  body > * { display: none !important; }
  .print-area { display: block !important; }
  .no-print { display: none !important; }
  .print-area {
    font-family: sans-serif;
    font-size: 12pt;
    color: #000;
    padding: 20mm;
  }
}
```

**Step 2: Add print-area wrapper to invoice detail**

In `dashboard.invoices.tsx`, find the invoice detail panel (the right-side or modal that shows full invoice details). Wrap the content with:
```tsx
<div className="print-area">
  {/* ... invoice detail content ... */}
</div>
```
Add `className="no-print"` to all action buttons.

**Step 3: Add "Print / Save PDF" button**

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => window.print()}
  className="no-print gap-1.5"
>
  <Printer className="size-4" />
  Print / Save PDF
</Button>
```

Import `Printer` from `lucide-react`.

**Step 4: Repeat for quotations**

Apply the same `print-area` wrapper and Print button to `dashboard.quotations.tsx`.

**Step 5: Commit**
```bash
git add apps/web/src/routes/dashboard.invoices.tsx apps/web/src/routes/dashboard.quotations.tsx apps/web/src/app.css
git commit -m "feat: print/PDF export for invoices and quotations"
```

---

## Group G — Credit Sales (POS "Credit / Invoice" Payment Method)

### Task G1: Add "Credit" payment method to POS

**Files:**
- Modify: `apps/web/src/components/pos/payment-dialog.tsx` (add Credit tab/option)
- Modify: `packages/api/src/routers/pos.ts` (handle credit payment → create draft invoice)

**Context:** Payment dialog has tabs for Cash, Card, etc. Credit is a new payment type. When selected:
1. Customer must be selected (link to customer account)
2. The order goes through as completed
3. A draft invoice is auto-created for the amount

**Step 1: Read payment-dialog.tsx**

Read the file to understand the payment method tabs structure. Add a "Credit" tab.

**Step 2: Add Credit tab UI**

In the payment dialog methods list, add:
```tsx
{
  id: "credit",
  label: "Credit / Invoice",
  icon: <FileText className="size-4" />,
}
```

When Credit is selected, show a notice:
```tsx
<div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
  <strong>Credit Sale:</strong> Order will be recorded as credit. A draft invoice
  will be created automatically. Customer must be linked to this order.
</div>
```

**Step 3: Update POS checkout to handle credit**

In `packages/api/src/routers/pos.ts`, find the `checkout` handler. After creating the order and payment, add:
```ts
// If payment method is "credit", auto-create a draft invoice
if (paymentMethod === "credit") {
  const invoiceNumber = await nextInvoiceNumber(DEFAULT_ORG_ID);
  await db.insert(schema.invoice).values({
    organizationId: DEFAULT_ORG_ID,
    locationId: input.locationId ?? DEFAULT_LOC_ID,
    invoiceNumber,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? "Walk-in",
    items: lineItemsForInvoice, // map from order line items
    subtotal: String(orderSubtotal),
    taxTotal: String(orderTaxTotal),
    total: String(orderTotal),
    status: "outstanding", // already sent, awaiting payment
    notes: `Auto-created from POS order ${orderNumber}`,
    createdBy: input.userId,
  });
}
```

The `nextInvoiceNumber` helper is already in `invoices.ts` — move it to a shared lib file or duplicate it temporarily.

**Step 4: Commit**
```bash
git add apps/web/src/components/pos/payment-dialog.tsx packages/api/src/routers/pos.ts
git commit -m "feat: credit payment method in POS auto-creates draft invoice"
```

---

## Verification Checklist

```
bun run check-types   → 0 errors
bun run build         → clean build
```

Manual checks:
- [ ] Sidebar shows "Check Off" (not "Production")
- [ ] Check Off page has Restaurant/Bakery tabs
- [ ] Pickup order → checkout without phone → toast error
- [ ] Delivery → checkout without address → toast error
- [ ] After 3:00pm → all departments visible in POS without supervisor
- [ ] Discount button as cashier (no permission) → supervisor PIN dialog opens
- [ ] Products page edit → protein category dropdown visible
- [ ] /dashboard/production-report → shows expected/actual/variance table
- [ ] Invoice detail → "Print / Save PDF" button → browser print dialog
- [ ] POS payment → select Credit → invoice auto-created in /dashboard/invoices

---

## Deploy

```bash
ssh kt-nexus-01 "cd /opt/bettencourt && docker compose -f docker-compose.prod.yml up -d --build"
```
