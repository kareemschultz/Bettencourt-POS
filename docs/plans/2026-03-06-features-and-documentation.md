# Plan #5 — Feature Completion & Comprehensive Documentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all remaining POS feature gaps and produce exhaustive documentation (user manual + developer guide) that covers every page and workflow.

**Architecture:** All new features follow the existing pattern: oRPC router procedure → Drizzle ORM → React Router route + shadcn/ui components. No new external services unless explicitly specified. Documentation lives in `docs/`.

**Tech Stack:** React Router v7, TypeScript, Tailwind CSS v4, shadcn/ui, oRPC, Drizzle ORM, Better Auth, Bun, PostgreSQL (Docker)

**Date:** 2026-03-06

---

## Audit Summary — What's Already Built vs. What's Missing

### Already Built (37 route pages — need documentation only)
dashboard, pos, orders, kitchen, products, inventory, purchase-orders, suppliers,
customers, loyalty, gift-cards, discounts, tables, menu-schedules, cash, reconciliation,
timeclock, reports, analytics, pnl, profitability, eod, labor, variance, production-report,
production, stock-alerts, waste, expenses, journal, invoices, quotations, locations,
currency, notifications, audit, webhooks, labels, settings

### Genuinely Missing Features
1. **Split Bill** — no split-bill UI in POS (no code found)
2. **Modifier Min/Max enforcement** — no schema field; modifiers have no required/optional/count rules
3. **Manager PIN for Void/Refund** — backend has `voidAuthorizedBy` field but UI doesn't enforce it
4. **Online Ordering page** — no customer-facing ordering route
5. **SMS/WhatsApp customer notifications** — internal notifications exist; no SMS-to-customer
6. **Digital Menu Board** — no TV-optimized route
7. **Offline-First PWA** — no service worker, no IndexedDB
8. **Role-Based Dashboard** — no per-role homepage customization

---

## PHASE 1: Comprehensive User Manual (Documentation Only)

**Goal:** Rewrite `docs/USER-MANUAL.md` to cover all 37 pages in detail, written for Shakira and all staff roles.

### Task 1: User Manual — Core POS & Orders

**File:** `docs/USER-MANUAL.md` (full rewrite)

**Step 1: Write the document structure**

Create a table of contents at the top with anchor links to each section:

```markdown
# Bettencourt POS — Staff User Manual

> Version: 2026-03 | For: Shakira & all Bettencourt's Food Inc. staff
> Live system: https://pos.karetechsolutions.com
> Support: Kareem Schultz — KareTech Solutions | karetechsolutions.com

## Table of Contents

1. [Getting Started & Login](#1-getting-started--login)
2. [Dashboard Overview](#2-dashboard-overview)
3. [POS Terminal — Taking Orders](#3-pos-terminal--taking-orders)
4. [Orders — History & Management](#4-orders--history--management)
5. [Kitchen Display System (KDS)](#5-kitchen-display-system-kds)
6. [Customers & CRM](#6-customers--crm)
7. [Loyalty Program](#7-loyalty-program)
8. [Gift Cards](#8-gift-cards)
9. [Cash Control & Shifts](#9-cash-control--shifts)
10. [Cash Reconciliation](#10-cash-reconciliation)
11. [Inventory Management](#11-inventory-management)
12. [Suppliers & Purchase Orders](#12-suppliers--purchase-orders)
13. [Stock Alerts](#13-stock-alerts)
14. [Waste Log](#14-waste-log)
15. [Expenses](#15-expenses)
16. [Products & Menu Management](#16-products--menu-management)
17. [Discounts & Promotions](#17-discounts--promotions)
18. [Table Management](#18-table-management)
19. [Menu Schedules](#19-menu-schedules)
20. [Time Clock](#20-time-clock)
21. [Reports & Analytics](#21-reports--analytics)
22. [End-of-Day Report](#22-end-of-day-report)
23. [P&L / Profitability](#23-pl--profitability)
24. [Production & Variance](#24-production--variance)
25. [Daily Journal](#25-daily-journal)
26. [Invoices & Quotations](#26-invoices--quotations)
27. [Labels & Barcodes](#27-labels--barcodes)
28. [Notifications](#28-notifications)
29. [Settings & Configuration](#29-settings--configuration)
30. [Multi-Location Management](#30-multi-location-management)
31. [Currency Settings](#31-currency-settings)
32. [Audit Log](#32-audit-log)
33. [Webhooks & Integrations](#33-webhooks--integrations)
34. [Frequently Asked Questions](#34-frequently-asked-questions)
35. [Role Permissions Reference](#35-role-permissions-reference)
36. [Troubleshooting](#36-troubleshooting)
```

**Step 2: Write Section 1 — Getting Started & Login**

```markdown
---

## 1. Getting Started & Login

### Accessing the System

Open any web browser and go to: **https://pos.karetechsolutions.com**

The system works on tablets, phones, and computers. For best results, use a tablet or laptop.

### PIN Login (Recommended for Staff)

1. The login screen shows a PIN entry keypad
2. Type your 4–8 digit PIN using the keypad
3. Tap **Login**
4. You are taken directly to the Dashboard

> **Tip:** PINs are assigned by the Manager or Admin. If you forget yours, ask the manager to reset it in Settings → Users.

### Email Login (For Managers & Admins)

1. On the login screen, tap **Sign in with Email**
2. Enter your email address and password
3. Click **Sign In**

### Logging Out

Click your name or avatar at the bottom of the left sidebar, then click **Sign Out**. Always log out if you are sharing a device.

---
```

**Step 3: Write Section 2 — Dashboard Overview**

```markdown
## 2. Dashboard Overview

After logging in you land on the **Dashboard**. What you see depends on your role.

### Quick Stats (top of page)

| Card | What it shows |
|------|---------------|
| Today's Revenue | Total GYD collected today |
| Orders Today | Count of completed orders |
| Active Orders | Orders currently open |
| Low Stock Items | Items needing reorder |

### Quick Action Cards

Four shortcut cards link you to the most common tasks:
- **New Order** → POS Terminal
- **View Reports** → Reports
- **Manage Inventory** → Inventory
- **View Customers** → Customers

### Sidebar Navigation

The sidebar on the left contains all sections. Sections you don't have permission to see are hidden automatically based on your role.

---
```

**Step 4: Write Section 3 — POS Terminal (full detail)**

Cover every workflow in the POS:
- Browsing by category/department (tabs across top)
- Searching for a product by name
- Adding items to cart (tap = add 1, +/- buttons in cart)
- Modifier popups — what they are, how to select options
- Linking a customer to the order (search by name or phone)
- Applying a discount (coupon code, percentage, fixed amount)
- Split bill (enter number of splits, each portion pays separately)
- Holding an order (saving without completing)
- Processing payment: Cash, Card, Gift Card, Split payment
- Loyalty points — how they earn on checkout
- Printing a receipt
- Opening the cash drawer manually

**Step 5: Write Sections 4–10 (Orders through Reconciliation)**

Each section must include:
- Navigation path
- What the page shows
- Step-by-step for every action button
- Tips & warnings

Sections to cover:
- Orders: search, filter by status/date, view detail, void, refund
- KDS: ticket cards, checking off items, order-ready flow, ticket aging colors
- Customers: list, add new, view profile, purchase history, notes
- Loyalty: member list, point balances, redeem rewards, tier progress, leaderboard
- Gift Cards: issue, reload, balance lookup, redeem in POS
- Cash Control: open shift, cash drop, payout, close shift, shift history
- Reconciliation: daily cash reconciliation workflow, variance explanation, manager approval

**Step 6: Write Sections 11–20 (Inventory through Time Clock)**

- Inventory: stock levels, add movement (received/used/wasted/adjustment), movement history
- Suppliers: list, add supplier, contact info, linked purchase orders
- Purchase Orders: create, add line items, save draft, mark ordered, receive stock, partial receive
- Stock Alerts: list of low-stock items, minimum level config, how to act on alerts
- Waste Log: record waste, waste by category, monthly waste totals
- Expenses: log an expense, expense categories, filter by date/category, totals
- Products: add/edit/deactivate, set price/category/tax, configure modifiers, sort order
- Discounts: create discount rule, types (%, fixed, BOGO, happy hour, coupon code), enable/disable
- Tables: floor plan view, table status (available/occupied/reserved), start a table order
- Menu Schedules: create time-based menus (breakfast/lunch/dinner), assign products, time windows
- Time Clock: clock in/out, view shift history, manager edit of entries, labor cost summary

**Step 7: Write Sections 21–33 (Reports through Webhooks)**

- Reports: sales overview, top products, category breakdown, payment method breakdown
- Analytics: trend charts, peak hours heatmap, year-over-year comparison
- EOD Report: what it includes, how to generate, print/export
- PnL: revenue/cost/profit by period, filter by location
- Profitability: product-level margins, COGS tracking, most/least profitable items
- Production Report: planned vs actual production, variance by item
- Production: daily production log, component consumption
- Variance: stock variance — expected vs counted
- Labor: staff hours, cost per shift, labor cost %
- Daily Journal: accounting-format daily summary, export to CSV
- Invoices: create invoice for a customer, add line items, mark paid
- Quotations: create price quote, convert quote to invoice
- Labels: generate barcode labels, print settings, batch printing
- Notifications: internal notification center, mark read, clear
- Audit Log: system event log, who did what and when
- Webhooks: configure endpoint URLs, event types, test delivery

**Step 8: Write Section 29 — Settings (comprehensive)**

Settings has many sub-tabs. Document each:
- **Organization** — business name, logo, timezone, contact info
- **Locations** — multiple location config (see Section 30)
- **Registers** — POS register names and assignment
- **Products** — (shortcut to Products page)
- **Categories** — add/edit/reorder product categories
- **Modifiers** — modifier groups and options
- **Tax Rates** — VAT rates, which products they apply to
- **Discounts** — (shortcut to Discounts page)
- **Receipt Config** — header, footer, logo, paper width
- **Users** — add/edit staff, set role, reset PIN
- **Roles & Permissions** — what each role can see/do
- **Currency** — GYD base currency, USD exchange rate

**Step 9: Write Sections 34–36 (FAQ, Roles Reference, Troubleshooting)**

**FAQ** must include at minimum:
- How to void an order
- How to process a refund
- How to add a new staff member
- How to reset a PIN
- How to hide a product from POS
- How to check yesterday's sales
- How to print a receipt
- How to see what a staff member sold
- How to handle cash shortages
- How to record a supplier delivery
- How to add a modifier to a product
- How to issue a gift card
- How to redeem loyalty points at POS
- How to create a discount for a special event
- The system is slow — what to do
- I can't find a product in POS — what to do
- How to close end of day

**Roles Reference table:**

| Permission | Admin | Manager | Cashier | Kitchen | Production |
|-----------|-------|---------|---------|---------|------------|
| POS Terminal | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Orders | ✅ | ✅ | Own | ✅ | ❌ |
| Void Orders | ✅ | ✅ | ❌ | ❌ | ❌ |
| Refund Orders | ✅ | ✅ | ❌ | ❌ | ❌ |
| Inventory | ✅ | ✅ | ❌ | ❌ | ✅ |
| Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Time Clock | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kitchen Display | ✅ | ✅ | ❌ | ✅ | ❌ |

**Step 10: Commit**

```bash
git add docs/USER-MANUAL.md
git commit -m "docs: comprehensive user manual covering all 37 pages and workflows"
```

---

### Task 2: Developer Documentation Update

**File:** `docs/DEVELOPER.md`

**Step 1: Read the current developer docs**

Read `docs/DEVELOPER.md` and identify what's missing based on the current codebase.

**Step 2: Add sections that are missing**

Add or expand these sections:
- **Router Pattern** — full example of a permissionProcedure with input validation
- **Schema Overview** — table groupings (auth, pos, inventory, loyalty, etc.)
- **Seed Data** — how SEED_MODE works, structural vs demo data
- **Permission System** — all permission strings and which procedures use them
- **Hardware Abstraction** — PrinterDriver / BrowserPrinter / how to add real hardware
- **Adding a New Page** — step-by-step: schema → router → route file → sidebar entry → PAGE_TITLES → ROUTE_MODULE_MAP
- **Common TypeScript Patterns** — `array[0]!.id` inside length guard, `as unknown as` for Date→string

**Step 3: Commit**

```bash
git add docs/DEVELOPER.md
git commit -m "docs: expand developer guide with patterns, schema overview, and how-to guides"
```

---

## PHASE 2: POS — Split Bill

**Goal:** Allow a single order to be split into N equal portions (or split by item), each paid separately.

### Task 3: Split Bill Backend

**File:** `packages/api/src/routers/pos.ts`

**Step 1: Add splitOrder procedure**

Add to the pos router a `splitOrder` procedure. It doesn't create new DB records — it's a calculation helper that returns how to split:

```typescript
const splitOrder = permissionProcedure("orders.create")
  .input(
    z.object({
      orderId: z.string().uuid(),
      splitCount: z.number().int().min(2).max(20),
    }),
  )
  .handler(async ({ input }) => {
    const order = await db
      .select()
      .from(schema.order)
      .where(eq(schema.order.id, input.orderId))
      .limit(1);

    if (order.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Order not found" });
    }

    const total = Number(order[0]!.total);
    const perPerson = total / input.splitCount;
    const portions = Array.from({ length: input.splitCount }, (_, i) => ({
      portion: i + 1,
      amount: Number(perPerson.toFixed(2)),
    }));

    // Adjust last portion for rounding
    const sumSoFar = portions.slice(0, -1).reduce((s, p) => s + p.amount, 0);
    portions[portions.length - 1]!.amount = Number(
      (total - sumSoFar).toFixed(2),
    );

    return { orderId: input.orderId, total, splitCount: input.splitCount, portions };
  });
```

Export it in `posRouter`.

**Step 2: Run type check**

```bash
bunx tsc -b packages/api/tsconfig.json --noEmit
```
Expected: zero new errors

**Step 3: Commit**

```bash
git add packages/api/src/routers/pos.ts
git commit -m "feat: add splitOrder procedure for equal-portion bill splitting"
```

### Task 4: Split Bill UI in POS Terminal

**File:** `apps/web/src/routes/dashboard.pos.tsx` (or the cart component)

**Step 1: Find the cart payment section**

Search for where the "Charge" / payment button is rendered in the POS. This is likely a `CartPanel` or inline in the route.

```bash
grep -n "Charge\|charge\|payment\|Payment" apps/web/src/routes/dashboard.pos.tsx | head -20
```

**Step 2: Add Split Bill button next to Charge**

Add a `SplitBillDialog` that:
1. Opens a dialog with a number input (how many ways?)
2. Calls `orpc.pos.splitOrder.query({ orderId, splitCount })`
3. Shows each portion as a separate payment row
4. Each portion has its own payment method selector (Cash/Card/Gift Card)
5. As each portion is paid, mark it and show remaining portions

```tsx
// In the cart/payment area, alongside the Charge button:
<SplitBillButton orderId={currentOrderId} orderTotal={cartTotal} />
```

Create `apps/web/src/components/pos/split-bill-dialog.tsx`:

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scissors } from "lucide-react";
import { orpc } from "@/lib/orpc";
import { formatCurrency } from "@/lib/utils";

interface Props {
  orderId: string;
  orderTotal: number;
  onPortionPaid: (portionIndex: number, method: string) => void;
}

export function SplitBillDialog({ orderId, orderTotal, onPortionPaid }: Props) {
  const [open, setOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [paidPortions, setPaidPortions] = useState<Set<number>>(new Set());

  const perPerson = orderTotal / splitCount;

  const markPaid = (i: number, method: string) => {
    setPaidPortions((prev) => new Set([...prev, i]));
    onPortionPaid(i, method);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Scissors className="h-4 w-4" />
          Split Bill
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split Bill</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Split between</Label>
            <Input
              type="number"
              min={2}
              max={20}
              value={splitCount}
              onChange={(e) => setSplitCount(Math.max(2, Number(e.target.value)))}
              className="w-20"
            />
            <span className="text-muted-foreground">people</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Each person pays: <strong>{formatCurrency(perPerson)}</strong>
          </p>
          <div className="space-y-2">
            {Array.from({ length: splitCount }, (_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">Person {i + 1}</span>
                <span>{formatCurrency(i === splitCount - 1
                  ? orderTotal - perPerson * (splitCount - 1)
                  : perPerson)}
                </span>
                {paidPortions.has(i) ? (
                  <span className="text-sm font-medium text-green-600">Paid</span>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => markPaid(i, "cash")}>Cash</Button>
                    <Button size="sm" variant="outline" onClick={() => markPaid(i, "card")}>Card</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {paidPortions.size === splitCount && (
            <p className="text-center font-semibold text-green-600">All portions paid!</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Run type check**

```bash
bunx tsc -b apps/web/tsconfig.json --noEmit
```
Expected: zero errors

**Step 4: Commit**

```bash
git add apps/web/src/components/pos/split-bill-dialog.tsx apps/web/src/routes/dashboard.pos.tsx
git commit -m "feat: split bill dialog for equal-portion payment splitting in POS"
```

---

## PHASE 3: Modifier Min/Max Enforcement

**Goal:** Allow modifier groups to define required minimums and maximums so the POS can validate selections before adding to cart.

### Task 5: Schema — Add Min/Max to Modifier Groups

**File:** `packages/db/src/schema.ts`

**Step 1: Find the modifierGroup table definition**

```bash
grep -n "modifierGroup\|modifier_group" packages/db/src/schema.ts | head -20
```

**Step 2: Add minSelections and maxSelections columns**

Find the `modifierGroup` table and add:

```typescript
minSelections: integer("min_selections").notNull().default(0),
maxSelections: integer("max_selections"), // null = unlimited
```

**Step 3: Update the modifiers router input schemas**

**File:** `packages/api/src/routers/modifiers.ts`

Find `createModifierGroup` and `updateModifierGroup` input schemas, add:

```typescript
minSelections: z.number().int().min(0).default(0),
maxSelections: z.number().int().min(1).nullable().optional(),
```

And in the insert/update values:

```typescript
minSelections: input.minSelections,
maxSelections: input.maxSelections ?? null,
```

**Step 4: Push schema changes**

```bash
cd packages/db && bun run db:push
```

**Step 5: Run type check**

```bash
bunx tsc -b --noEmit
```

**Step 6: Update the Settings Modifiers UI**

**File:** `apps/web/src/routes/dashboard.settings.tsx` (or wherever modifier groups are edited)

Find the modifier group create/edit form. Add min/max fields:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div className="space-y-1">
    <Label>Min Selections</Label>
    <Input
      type="number"
      min={0}
      value={form.minSelections ?? 0}
      onChange={(e) => setForm({ ...form, minSelections: Number(e.target.value) })}
    />
    <p className="text-xs text-muted-foreground">0 = optional</p>
  </div>
  <div className="space-y-1">
    <Label>Max Selections</Label>
    <Input
      type="number"
      min={1}
      placeholder="Unlimited"
      value={form.maxSelections ?? ""}
      onChange={(e) =>
        setForm({ ...form, maxSelections: e.target.value ? Number(e.target.value) : null })
      }
    />
    <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
  </div>
</div>
```

**Step 7: Enforce in POS modifier dialog**

**File:** Find the modifier selection dialog/sheet in POS components

In the dialog, before allowing "Add to Cart":
```tsx
const isValid = modifierGroups.every((group) => {
  const selectedCount = selectedModifiers.filter(
    (m) => m.groupId === group.id,
  ).length;
  if (selectedCount < group.minSelections) return false;
  if (group.maxSelections && selectedCount > group.maxSelections) return false;
  return true;
});

// Disable Add to Cart button when !isValid
// Show per-group validation message
```

**Step 8: Commit**

```bash
git add packages/db/src/schema.ts packages/api/src/routers/modifiers.ts apps/web/src/routes/dashboard.settings.tsx
git commit -m "feat: modifier group min/max selections with POS validation"
```

---

## PHASE 4: Manager PIN for Void/Refund Authorization

**Goal:** Require a manager or admin to enter their PIN before a void or refund can be processed, enforced at the UI level.

### Task 6: Manager Authorization Dialog Component

**File:** `apps/web/src/components/shared/manager-auth-dialog.tsx` (create new)

**Step 1: Create the dialog**

```tsx
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { orpc } from "@/lib/orpc";

interface Props {
  open: boolean;
  onClose: () => void;
  onAuthorized: (managerId: string, managerName: string) => void;
  action: "void" | "refund";
}

export function ManagerAuthDialog({ open, onClose, onAuthorized, action }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    setLoading(true);
    try {
      // Use the existing pin-login endpoint to verify the PIN belongs to a manager/admin
      const result = await orpc.auth.verifyManagerPin.query({ pin });
      if (result.authorized) {
        onAuthorized(result.userId, result.name);
        setPin("");
        setError("");
      } else {
        setError("PIN not recognized or insufficient permissions");
      }
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-500" />
            Manager Authorization Required
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A manager or admin PIN is required to {action} this order.
        </p>
        <div className="space-y-3">
          <Label>Manager PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter PIN"
            onKeyDown={(e) => e.key === "Enter" && verify()}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={verify} disabled={loading} className="flex-1">
              {loading ? "Verifying..." : "Authorize"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add verifyManagerPin backend procedure**

**File:** `packages/api/src/routers/auth-helpers.ts` (or add to existing auth router)

This procedure looks up the PIN hash and checks the user has manager/admin role:

```typescript
const verifyManagerPin = permissionProcedure("orders.create")
  .input(z.object({ pin: z.string().min(4).max(8) }))
  .handler(async ({ input }) => {
    // Find users with manager/admin role that have this PIN
    const users = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        pin: schema.user.pin,
        role: schema.orgMember.role,
      })
      .from(schema.user)
      .innerJoin(schema.orgMember, eq(schema.orgMember.userId, schema.user.id))
      .where(
        and(
          eq(schema.orgMember.organizationId, DEFAULT_ORG_ID),
          inArray(schema.orgMember.role, ["admin", "manager"]),
        ),
      );

    for (const user of users) {
      if (user.pin && await verifyPinHash(input.pin, user.pin)) {
        return { authorized: true, userId: user.id, name: user.name };
      }
    }
    return { authorized: false, userId: null, name: null };
  });
```

(Use the same PIN hashing function as the existing pin-login endpoint in `apps/server/src/index.ts`)

**Step 3: Wire ManagerAuthDialog into Orders page void/refund flow**

**File:** `apps/web/src/routes/dashboard.orders.tsx`

Find where void and refund mutations are called. Add state:

```tsx
const [authDialogOpen, setAuthDialogOpen] = useState(false);
const [pendingAction, setPendingAction] = useState<{
  type: "void" | "refund";
  orderId: string;
  amount?: number;
} | null>(null);
```

Replace direct `voidMut.mutate(orderId)` with:

```tsx
const handleVoidClick = (orderId: string) => {
  setPendingAction({ type: "void", orderId });
  setAuthDialogOpen(true);
};

const handleAuthorized = (managerId: string, managerName: string) => {
  setAuthDialogOpen(false);
  if (pendingAction?.type === "void") {
    voidMut.mutate({ orderId: pendingAction.orderId, authorizedBy: managerId });
  } else if (pendingAction?.type === "refund") {
    refundMut.mutate({ orderId: pendingAction.orderId, authorizedBy: managerId, amount: pendingAction.amount });
  }
  setPendingAction(null);
};
```

Add the dialog at the bottom of the JSX:

```tsx
<ManagerAuthDialog
  open={authDialogOpen}
  onClose={() => { setAuthDialogOpen(false); setPendingAction(null); }}
  onAuthorized={handleAuthorized}
  action={pendingAction?.type ?? "void"}
/>
```

**Step 4: Run type check and commit**

```bash
bunx tsc -b --noEmit
git add apps/web/src/components/shared/manager-auth-dialog.tsx apps/web/src/routes/dashboard.orders.tsx
git commit -m "feat: manager PIN authorization required for void and refund operations"
```

---

## PHASE 5: No-Sale Drawer Tracking UI

**Goal:** The schema/backend already has `noSaleEvent` table and cash router. Add the UI to log and view no-sale events.

### Task 7: No-Sale UI in Cash Control

**File:** `apps/web/src/routes/dashboard.cash.tsx`

**Step 1: Find the cash control page**

Read the file to understand its structure:

```bash
grep -n "noSale\|no.sale\|drawer\|Drawer" apps/web/src/routes/dashboard.cash.tsx | head -20
```

**Step 2: Add a "No Sale / Open Drawer" button**

If the no-sale button is missing, add it to the shift controls section:

```tsx
// Button to log a no-sale (opens drawer without a transaction)
<Button
  variant="outline"
  className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
  onClick={() => logNoSale()}
>
  <Unlock className="h-4 w-4" />
  Open Drawer (No Sale)
</Button>
```

Wire the mutation:

```tsx
const logNoSaleMut = orpc.cash.logNoSale.useMutation({
  onSuccess: () => {
    toast.success("Drawer open logged");
    queryClient.invalidateQueries({ queryKey: ["cash"] });
  },
});

const logNoSale = () => {
  if (!activeShift) {
    toast.error("No active shift. Open a shift first.");
    return;
  }
  logNoSaleMut.mutate({ shiftId: activeShift.id });
};
```

**Step 3: Add No-Sale Events to shift detail view**

In the shift detail or history section, show a count of no-sale events and list them:

```tsx
{noSaleEvents.length > 0 && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
    <p className="font-medium text-amber-800">
      ⚠️ {noSaleEvents.length} drawer open(s) without a sale
    </p>
    <ul className="mt-2 space-y-1 text-sm text-amber-700">
      {noSaleEvents.map((evt) => (
        <li key={evt.id}>{formatDateTimeGY(evt.createdAt)} — {evt.cashierName}</li>
      ))}
    </ul>
  </div>
)}
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/dashboard.cash.tsx
git commit -m "feat: no-sale drawer open button and event log in cash control"
```

---

## PHASE 6: Stock Alert Email Notifications

**Goal:** When an item drops to or below its minimum stock level, send an in-app notification AND optionally email the manager.

### Task 8: Auto-Alert on Stock Movement

**File:** `packages/api/src/routers/inventory.ts`

**Step 1: After every stock movement that reduces quantity, check the minimum**

Find the `addMovement` or equivalent procedure. After updating the stock level:

```typescript
// After updating stock level:
const updatedItem = await db
  .select()
  .from(schema.inventoryItem)
  .where(eq(schema.inventoryItem.id, input.inventoryItemId))
  .limit(1);

if (updatedItem.length > 0) {
  const item = updatedItem[0]!;
  if (item.minimumLevel !== null && Number(item.currentStock) <= Number(item.minimumLevel)) {
    // Create a system notification
    await db.insert(schema.notification).values({
      organizationId: DEFAULT_ORG_ID,
      type: "low_stock",
      title: `Low Stock: ${item.name}`,
      message: `${item.name} is at ${item.currentStock} ${item.unit} (minimum: ${item.minimumLevel})`,
      severity: "warning",
      metadata: JSON.stringify({ inventoryItemId: item.id }),
    });
  }
}
```

**Step 2: Stock Alerts page — link to notification**

**File:** `apps/web/src/routes/dashboard.stock-alerts.tsx`

Verify the page already polls low stock. If so, add a "Create Purchase Order" shortcut button next to each alert item, linking directly to the purchase orders create flow pre-filled with that supplier.

**Step 3: Commit**

```bash
git add packages/api/src/routers/inventory.ts
git commit -m "feat: auto-create low-stock notification when item drops to minimum level"
```

---

## PHASE 7: Digital Menu Board

**Goal:** A TV-optimized, public-facing page showing current menu organized by category. Updates in real-time when products change. No login required.

### Task 9: Menu Board Route

**File:** `apps/web/src/routes/menu-board.tsx` (NOT under dashboard — public route)

**Step 1: Register the route**

**File:** `apps/web/src/router.tsx` (or route config)

Add a public route `/menu-board` that doesn't require auth.

**Step 2: Create the menu board page**

```tsx
// apps/web/src/routes/menu-board.tsx
import { useEffect } from "react";
import { orpc } from "@/lib/orpc";

export default function MenuBoardPage() {
  const { data: categories } = orpc.products.listCategories.useQuery(undefined, {
    refetchInterval: 60_000, // refresh every minute
  });
  const { data: products } = orpc.products.listProducts.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  // Dark background, large text, TV-optimized layout
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-bold text-yellow-400">Bettencourt's Food Inc.</h1>
        <p className="mt-2 text-xl text-gray-400">Our Menu</p>
      </div>

      {/* Category columns */}
      <div className="grid grid-cols-3 gap-8">
        {categories?.map((cat) => {
          const catProducts = products?.filter(
            (p) => p.categoryId === cat.id && p.isActive,
          ) ?? [];
          if (catProducts.length === 0) return null;
          return (
            <div key={cat.id}>
              <h2 className="mb-4 border-b border-yellow-400/30 pb-2 text-2xl font-bold text-yellow-400">
                {cat.name}
              </h2>
              <ul className="space-y-3">
                {catProducts.map((p) => (
                  <li key={p.id} className="flex justify-between text-lg">
                    <span className="text-gray-100">{p.name}</span>
                    <span className="font-semibold text-yellow-300">
                      ${Number(p.price).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-gray-500 text-sm">
        Prices in GYD. Menu subject to change.
      </div>
    </div>
  );
}
```

**Step 3: Add menu board link to Settings or Sidebar (admin only)**

In `apps/web/src/routes/dashboard.tsx` sidebar, under a "Display" section:

```tsx
{
  label: "Menu Board",
  href: "/menu-board",
  icon: MonitorPlay,
  target: "_blank", // opens in new tab for TV display
}
```

**Step 4: Run type check and commit**

```bash
bunx tsc -b apps/web/tsconfig.json --noEmit
git add apps/web/src/routes/menu-board.tsx apps/web/src/routes/dashboard.tsx
git commit -m "feat: public digital menu board route for TV display (/menu-board)"
```

---

## PHASE 8: Online Ordering (Customer-Facing)

**Goal:** A separate customer-facing web page at `/order` where customers can browse the menu and place pickup/delivery orders. Orders flow into the KDS and Orders system.

### Task 10: Online Order Schema (already exists — verify)

**Step 1: Check the online-order router**

```bash
cat packages/api/src/routers/online-order.ts | head -50
```

The schema and router already exist. Confirm what procedures are available (createOrder, listOrders, updateStatus, etc.).

**Step 2: Create the public-facing online order route**

**File:** `apps/web/src/routes/order.tsx` (NOT under /dashboard — public, no auth required)

Structure:
1. Menu browsing by category (same style as POS product grid but customer-facing)
2. Cart sidebar
3. Checkout form (name, phone, order type: pickup/delivery, notes)
4. Confirmation page with order number

```tsx
// apps/web/src/routes/order.tsx
// Public online ordering page
// Reads from: orpc.products.listProducts (public procedure needed)
// Submits to: orpc.onlineOrder.createOrder
```

> **Note:** The products.listProducts endpoint may require auth currently. Add a `publicProcedure` variant `products.listPublicMenu` that returns only active products without auth.

**Step 3: Add publicProcedure for menu listing**

**File:** `packages/api/src/routers/products.ts`

```typescript
// Public — no auth required
const listPublicMenu = publicProcedure
  .input(z.object({}).optional())
  .handler(async () => {
    const products = await db
      .select({
        id: schema.product.id,
        name: schema.product.name,
        price: schema.product.price,
        description: schema.product.description,
        categoryId: schema.product.categoryId,
        imageUrl: schema.product.imageUrl,
      })
      .from(schema.product)
      .where(eq(schema.product.isActive, true))
      .orderBy(asc(schema.product.sortOrder));

    const categories = await db
      .select()
      .from(schema.productCategory)
      .orderBy(asc(schema.productCategory.sortOrder));

    return { products, categories };
  });
```

**Step 4: Register the /order route as public (no auth required)**

In the router config, add `/order` to public routes alongside `/login` and `/menu-board`.

**Step 5: Commit**

```bash
git add packages/api/src/routers/products.ts apps/web/src/routes/order.tsx
git commit -m "feat: public online ordering page with menu browsing and checkout"
```

### Task 11: Order Intake in Dashboard

**File:** `apps/web/src/routes/dashboard.orders.tsx`

**Step 1: Add "Online" order type badge/filter**

Online orders already have `source: "online"` in the schema. Ensure:
1. The orders list shows an "Online" badge for online orders
2. A filter chip to show "Online Only" orders
3. New online orders trigger a notification/toast for the cashier

**Step 2: KDS receives online orders**

Verify `apps/web/src/routes/dashboard.kitchen.tsx` shows orders regardless of source. Online orders should appear as tickets in the KDS immediately.

**Step 3: Commit**

```bash
git add apps/web/src/routes/dashboard.orders.tsx
git commit -m "feat: online order badge and filter in orders management"
```

---

## PHASE 9: SMS/WhatsApp Customer Notifications (Twilio)

**Goal:** When a customer's order is marked "ready" in the KDS, automatically send them an SMS/WhatsApp message.

### Task 12: Twilio Integration

**Step 1: Add Twilio dependency**

```bash
cd apps/server && bun add twilio
```

**Step 2: Add env variables**

**File:** `apps/server/src/env.ts`

```typescript
TWILIO_ACCOUNT_SID: z.string().optional(),
TWILIO_AUTH_TOKEN: z.string().optional(),
TWILIO_FROM_NUMBER: z.string().optional(),
```

Add to `.env`:
```
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```

And to `docker-compose.prod.yml`:
```yaml
TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID:-}
TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN:-}
TWILIO_FROM_NUMBER: ${TWILIO_FROM_NUMBER:-}
```

**Step 3: Create SMS utility**

**File:** `apps/server/src/lib/sms.ts`

```typescript
import twilio from "twilio";
import { env } from "../env";

export async function sendSMS(to: string, message: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    console.log("[SMS] Twilio not configured — skipping SMS:", message);
    return;
  }
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: message,
    from: env.TWILIO_FROM_NUMBER,
    to,
  });
}
```

**Step 4: Trigger SMS when KDS marks order ready**

**File:** `packages/api/src/routers/kitchen.ts`

Find the procedure that marks an order as "ready" / all items checked. After status update:

```typescript
// If order has a linked customer with a phone number, send SMS
if (order.customerId) {
  const customer = await db
    .select({ phone: schema.customer.phone, name: schema.customer.name })
    .from(schema.customer)
    .where(eq(schema.customer.id, order.customerId))
    .limit(1);

  if (customer.length > 0 && customer[0]!.phone) {
    await sendSMS(
      customer[0]!.phone,
      `Hi ${customer[0]!.name}! Your order #${order.orderNumber} is ready for pickup at Bettencourt's Food Inc. 🍽️`,
    );
  }
}
```

**Step 5: Run type check and commit**

```bash
bunx tsc -b --noEmit
git add apps/server/src/lib/sms.ts packages/api/src/routers/kitchen.ts apps/server/src/env.ts
git commit -m "feat: Twilio SMS notification to customer when KDS marks order ready"
```

---

## PHASE 10: Offline-First PWA

**Goal:** The POS terminal should work without internet. Orders are saved locally and synced when connectivity returns.

### Task 13: PWA Setup

> **Note:** This is the most complex feature. Implement it carefully and test offline mode thoroughly before deploying.

**Step 1: Add Vite PWA plugin**

```bash
cd apps/web && bun add -D vite-plugin-pwa
```

**Step 2: Configure PWA in vite.config.ts**

**File:** `apps/web/vite.config.ts`

```typescript
import { VitePWA } from "vite-plugin-pwa";

// In plugins array:
VitePWA({
  registerType: "autoUpdate",
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/pos\.karetechsolutions\.com\/api\//,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          networkTimeoutSeconds: 5,
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
  manifest: {
    name: "Bettencourt POS",
    short_name: "BettencourtPOS",
    description: "Point of Sale for Bettencourt's Food Inc.",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    display: "standalone",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
}),
```

**Step 3: Add offline order queue**

**File:** `apps/web/src/lib/offline-queue.ts`

```typescript
// IndexedDB-backed order queue for offline mode
const DB_NAME = "bettencourt-pos-offline";
const STORE_NAME = "pending-orders";

export async function queueOrder(orderData: unknown): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).add({ id, data: orderData, timestamp: Date.now() });
  await tx.done;
  return id;
}

export async function getPendingOrders(): Promise<Array<{ id: string; data: unknown }>> {
  const db = await openDB();
  return db.getAll(STORE_NAME);
}

export async function removePendingOrder(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await tx.done;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

**Step 4: Add offline indicator to POS**

In the POS terminal, show a banner when navigator.onLine === false:

```tsx
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  const on = () => setIsOnline(true);
  const off = () => setIsOnline(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
}, []);

{!isOnline && (
  <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
    ⚡ Offline mode — orders will sync when connection restores
  </div>
)}
```

**Step 5: Commit**

```bash
git add apps/web/vite.config.ts apps/web/src/lib/offline-queue.ts apps/web/src/routes/dashboard.pos.tsx
git commit -m "feat: PWA manifest, service worker caching, and offline order queue"
```

---

## PHASE 11: Build Verification & Deploy

### Task 14: Final Type Check

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bunx tsc -b apps/web/tsconfig.json --noEmit
bunx tsc -b packages/api/tsconfig.json --noEmit
```

Expected: zero errors. Fix any type errors before proceeding.

### Task 15: Production Build

```bash
bun run build
```

Expected: 3/3 tasks successful.

### Task 16: Docker Build & Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify container health:

```bash
sleep 10 && docker ps --filter name=kt-bettencourt-pos
docker logs kt-bettencourt-pos --tail 20
```

### Task 17: Re-seed Database

```bash
cd packages/db && bun run seed
```

### Task 18: Visual Verification

Use Playwright to screenshot all new features:
- `/menu-board` — verify TV layout
- `/order` — verify online ordering
- `/dashboard/cash` — verify no-sale button
- `/dashboard/orders` — verify void/refund requires manager PIN

### Task 19: Final Commit & Push

```bash
git add -A
git commit -m "feat: Plan #5 complete — split bill, min/max modifiers, manager auth, menu board, online ordering, SMS, PWA offline"
git push origin master
```

---

## FILES SUMMARY

### New Files
| File | Purpose |
|------|---------|
| `docs/USER-MANUAL.md` | Complete rewrite covering all 37 pages |
| `apps/web/src/routes/menu-board.tsx` | Public TV-optimized menu display |
| `apps/web/src/routes/order.tsx` | Public customer online ordering page |
| `apps/web/src/components/pos/split-bill-dialog.tsx` | Split bill UI component |
| `apps/web/src/components/shared/manager-auth-dialog.tsx` | Manager PIN authorization dialog |
| `apps/server/src/lib/sms.ts` | Twilio SMS utility |
| `apps/web/src/lib/offline-queue.ts` | IndexedDB offline order queue |

### Modified Files
| File | Changes |
|------|---------|
| `docs/DEVELOPER.md` | Expanded with patterns, schema, how-to guides |
| `packages/db/src/schema.ts` | Add minSelections/maxSelections to modifierGroup |
| `packages/api/src/routers/modifiers.ts` | Add min/max to create/update procedures |
| `packages/api/src/routers/pos.ts` | Add splitOrder procedure |
| `packages/api/src/routers/products.ts` | Add listPublicMenu public procedure |
| `packages/api/src/routers/inventory.ts` | Auto-create low-stock notification |
| `packages/api/src/routers/kitchen.ts` | SMS on order-ready |
| `packages/api/src/routers/orders.ts` | Wire authorizedBy from manager auth |
| `apps/web/src/routes/dashboard.orders.tsx` | Manager auth dialog for void/refund |
| `apps/web/src/routes/dashboard.cash.tsx` | No-sale drawer button + event log |
| `apps/web/src/routes/dashboard.settings.tsx` | Min/Max fields in modifier group form |
| `apps/web/vite.config.ts` | PWA plugin, service worker |
| `apps/server/src/env.ts` | Twilio env vars |
| `docker-compose.prod.yml` | Twilio env var passthrough |
| `.env` | Twilio credentials (gitignored) |

---

## EXECUTION ORDER

```
Phase 1 (Documentation) — can run first, standalone, no code changes
  Task 1: USER-MANUAL.md rewrite
  Task 2: DEVELOPER.md update

Phase 2–3 (POS features) — sequential (depend on POS file)
  Task 3: Split bill backend
  Task 4: Split bill UI
  Task 5: Modifier min/max

Phase 4–5 (Security & Controls)
  Task 6: Manager auth dialog
  Task 7: No-sale UI

Phase 6 (Alerts)
  Task 8: Stock alert notification

Phase 7–8 (External features) — can be parallel
  Task 9: Digital menu board
  Tasks 10–11: Online ordering

Phase 9 (Twilio) — requires Twilio account setup
  Task 12: SMS notifications

Phase 10 (PWA) — last, most complex
  Task 13: Offline-First PWA

Phase 11 (Verification)
  Tasks 14–19: Type check, build, deploy, verify
```

---

## VERIFICATION CHECKLIST

1. `bunx tsc -b --noEmit` — zero errors
2. `bun run build` — clean build
3. Split bill dialog opens from POS, shows N equal portions, each can pay separately
4. Modifier groups with minSelections > 0 block "Add to Cart" until selections are met
5. Void/Refund in Orders requires manager PIN entry before proceeding
6. No-sale button in Cash Control appears and logs the event to the shift
7. Low-stock movement creates a notification visible in the Notifications page
8. `/menu-board` loads without login, shows products by category in TV layout
9. `/order` loads without login, allows cart + checkout form submission
10. Online orders appear in dashboard Orders list with "Online" badge
11. When KDS marks order ready and customer has phone, SMS is sent
12. POS shows offline banner when network is unavailable
13. `docker compose -f docker-compose.prod.yml up -d --build` — clean rebuild
14. Container healthy, app live at https://pos.karetechsolutions.com
15. USER-MANUAL.md covers all 37 pages with step-by-step instructions
