# Bettencourt POS — V2 Deferred Items + Premium Additions (Plan #9)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the remaining deferred items from the v2 audit (`docs/audits/2026-03-08-comprehensive-audit-handoff-v2.md`) and add the highest-value premium features: custom split bills, atomic user creation, nav alignment, webhook event center, and a global command palette.

**Architecture:** Fix-in-place across the monorepo. All changes are incremental — no new packages. Nav restructure touches only `app-sidebar.tsx` and `dashboard.tsx`. The command palette adds one new component and one context hook.

**Tech Stack:** React Router, Hono, Bun, oRPC, Drizzle ORM, Better Auth, shadcn/ui (Command component already present at `apps/web/src/components/ui/command.tsx`)

**Source audit:** `docs/audits/2026-03-08-comprehensive-audit-handoff-v2.md`

---

## Wave 1: Remaining Bug Fixes

### Task 1.1: Custom split bill — API endpoint (B18)

The UI collects per-person amounts but `handleCustomSplit` in `split-bill-dialog.tsx:182` ignores them and calls `splitEqualMut` with just a count. Need a new `splitCustom` oRPC procedure.

**Files:**
- Modify: `packages/api/src/routers/split-bill.ts`
- Modify: `packages/api/src/index.ts` (export from splitBill router)

**Fix:**
Add `splitCustom` procedure after `splitEqual` in `split-bill.ts`:

```ts
const splitCustom = permissionProcedure("orders.create")
  .input(
    z.object({
      orderId: z.string().uuid(),
      amounts: z
        .array(z.number().positive())
        .min(2, "Need at least 2 splits")
        .max(20),
    }),
  )
  .handler(async ({ input }) => {
    const { orderId, amounts } = input;

    const orders = await db
      .select({ id: schema.order.id, total: schema.order.total, status: schema.order.status })
      .from(schema.order)
      .where(eq(schema.order.id, orderId));

    if (orders.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Order not found" });
    }

    const order = orders[0]!;
    const total = Number(order.total);
    const inputSum = amounts.reduce((s, a) => s + a, 0);

    if (Math.abs(inputSum - total) > 0.02) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Split amounts (${inputSum.toFixed(2)}) must equal order total (${total.toFixed(2)})`,
      });
    }

    const inserted = await db.transaction(async (tx) => {
      // Remove prior pending splits
      await tx
        .delete(schema.payment)
        .where(
          and(
            eq(schema.payment.orderId, orderId),
            eq(schema.payment.status, "pending"),
          ),
        );

      return await tx
        .insert(schema.payment)
        .values(
          amounts.map((amt, i) => ({
            orderId,
            method: "cash" as const,
            amount: amt.toFixed(2),
            status: "pending" as const,
            splitGroup: i + 1,
          })),
        )
        .returning({
          id: schema.payment.id,
          splitGroup: schema.payment.splitGroup,
          amount: schema.payment.amount,
        });
    });

    return inserted.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));
  });
```

Add `splitCustom` to the exported router object at the bottom of the file.

**Verification:** `bun run check-types` — 0 errors.

---

### Task 1.2: Custom split bill — frontend wiring (B18)

**Files:**
- Modify: `apps/web/src/components/pos/split-bill-dialog.tsx:166-183`

**Fix:**
Replace the `handleCustomSplit` function with one that calls the new `splitCustom` mutation:

```ts
const splitCustomMut = useMutation(
  orpc.splitBill.splitCustom.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.splitBill.getSplits.queryOptions({ input: { orderId } }).queryKey });
    },
    onError: (err) => toast.error(err.message || "Failed to split"),
  }),
);

function handleCustomSplit() {
  if (Math.abs(customRemaining) > 0.01) {
    toast.error("Split amounts must equal the order total");
    return;
  }
  const validAmounts = customAmounts.map(Number).filter((a) => a > 0);
  if (validAmounts.length < 2) {
    toast.error("Enter at least 2 split amounts");
    return;
  }
  splitCustomMut.mutate({ orderId, amounts: validAmounts });
}
```

Remove the old `handleCustomSplit` and the call to `splitEqualMut` inside it (lines 173-182).
Update the `isProcessing` check to also include `splitCustomMut.isPending`.

**Verification:** `bun run check-types` — 0 errors. In app: Custom split tab now correctly creates per-person payment records.

---

### Task 1.3: Fix notification credential update — prevent accidental clearing (B03)

**Files:**
- Modify: `packages/api/src/routers/notifications.ts:110-135` (updateSettings handler)

The audit notes credentials can be cleared if an empty string is sent. The `getSettings` already masks correctly; the `updateSettings` must use conditional updates.

**Fix — in the `updateSettings` handler, change both `update` and `insert` `.set()` calls:**

```ts
// In the update branch:
.set({
  provider: input.provider,
  isActive: input.isActive,
  dailyLimit: input.dailyLimit,
  ...(input.fromNumber !== undefined ? { fromNumber: input.fromNumber || null } : {}),
  ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber || null } : {}),
  // Only update credentials if a real new value is provided (not empty string)
  ...(input.accountSid && !input.accountSid.includes("*") ? { accountSid: input.accountSid } : {}),
  ...(input.authToken && !input.authToken.includes("*") ? { authToken: input.authToken } : {}),
})
```

Apply the same conditional logic to the `insert` branch.

**Verification:** `bun run check-types` — 0 errors.

---

### Task 1.4: Atomic user creation — add member + role assignment (B gap)

**Files:**
- Modify: `packages/api/src/routers/settings.ts` (createUser handler, lines 332-363)

Current `createUser` only inserts the `user` table. It must also:
1. Create a `member` row linking user to org
2. Create a `userRole` row assigning the specified POS role

**Fix — replace the createUser handler body:**

```ts
.input(
  z.object({
    name: z.string().min(1),
    email: z.string().email(),
    roleId: z.string().uuid("Must select a valid role"),
    password: z.string().min(8, "Password must be at least 8 characters").optional(),
  }),
)
.handler(async ({ input }) => {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    // 1. Create auth user
    await tx.insert(schema.user).values({
      id,
      name: input.name,
      email: input.email,
      role: "user",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create org membership
    await tx.insert(schema.member).values({
      id: crypto.randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      userId: id,
      role: "member",
      createdAt: now,
    });

    // 3. Assign POS role
    await tx.insert(schema.userRole).values({
      id: crypto.randomUUID(),
      userId: id,
      roleId: input.roleId,
      organizationId: DEFAULT_ORG_ID,
      assignedAt: now,
    });
  });

  return { id, name: input.name, email: input.email };
});
```

**Also update the frontend** (`apps/web/src/routes/dashboard.settings.tsx` — the create user form) to include a role selector field (`roleId` from `useQuery(orpc.settings.getRoles...)`) and optionally a password field. Remove the `role: z.string()` field from the form since role is now selected by UUID.

**Verification:** `bun run check-types` — 0 errors. Creating a new user should now appear in the sidebar immediately with correct permissions.

---

## Wave 2: Navigation Final Alignment

These changes align the sidebar with the audit's proposed structure:
- `POS Terminal` → `New Sale`
- Merge `Restaurant` + `Staff` → single `Operations` group
- Move `Discounts` from Customers → Finance group (pricing belongs with financial items)
- Move `Currency` from Finance → System (it's a system config, not a financial report)
- Move `Stock Alerts` to remain in Inventory (already correct)

**Files:**
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`
- Modify: `apps/web/src/routes/dashboard.tsx` (PAGE_TITLES)

### Task 2.1: Rename POS Terminal → New Sale

**In `app-sidebar.tsx` `mainNavItems`:**
```ts
{ title: "New Sale", url: "/dashboard/pos", icon: UtensilsCrossed, ... }
```

**In `dashboard.tsx` PAGE_TITLES:**
```ts
"/dashboard/pos": "New Sale",
```

---

### Task 2.2: Merge Restaurant + Staff → Operations

**In `app-sidebar.tsx`**, replace `restaurantNavItems` and `staffNavItems` with a single `operationsNavItems`:

```ts
const operationsNavItems = [
  { title: "Tables", url: "/dashboard/tables", icon: Utensils, module: "orders", roles: ["executive", "admin"] },
  { title: "Kitchen Display", url: "/dashboard/kitchen", icon: ChefHat, module: "orders", roles: ["executive", "admin", "cashier", "checkoff"] },
  { title: "Production Board", url: "/dashboard/production", icon: CookingPot, module: null, roles: ["executive", "admin", "checkoff"] },
  { title: "Production Report", url: "/dashboard/production-report", icon: BarChart3, module: "reports", roles: ["executive", "admin"] },
  { title: "Menu Calendar", url: "/dashboard/menu-schedules", icon: CalendarClock, module: "settings", roles: ["executive", "admin"] },
  { title: "Time Clock", url: "/dashboard/timeclock", icon: Clock, module: null, roles: ["executive", "admin", "cashier", "checkoff"] },
];
```

Delete `restaurantNavItems` and `staffNavItems` arrays.

**In the render section**, replace:
```tsx
{renderNavGroup("Restaurant", restaurantNavItems)}
...
{renderNavGroup("Staff", staffNavItems)}
```
with:
```tsx
{renderNavGroup("Operations", operationsNavItems)}
```

---

### Task 2.3: Restructure Finance, Customers, System groups

**Move `Discounts` from `customerNavItems` → `cashNavItems`** (Finance group):
```ts
// Remove from customerNavItems:
{ title: "Discounts", url: "/dashboard/discounts", ... }

// Add to cashNavItems (after Expenses):
{ title: "Discounts", url: "/dashboard/discounts", icon: Percent, module: "settings", roles: ["executive", "admin"] },
```

**Move `Currency` from `cashNavItems` → `systemNavItems`**:
```ts
// Remove from cashNavItems:
{ title: "Currency", ... }

// Add to systemNavItems (before Audit Log):
{ title: "Currency", url: "/dashboard/currency", icon: Banknote, module: "settings", roles: ["executive", "admin"] },
```

**Remove `Percent` from imports** if no longer used in customerNavItems (check if used elsewhere first).

**Verification:** `bun run check-types` — 0 errors. Sidebar shows correct groupings.

---

## Wave 3: Premium Features

### Task 3.1: Webhook Delivery Log — event center UI

The API already has `orpc.webhooks.getDeliveries`. Add a delivery log drawer to `dashboard.webhooks.tsx`.

**Files:**
- Modify: `apps/web/src/routes/dashboard.webhooks.tsx`

**Fix:**
1. Add state: `const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null)` (endpoint ID being viewed).
2. Add a "View Logs" button to each endpoint row in the table.
3. Add a `<Sheet>` (or `<Dialog>`) that opens when `viewingDeliveries` is set:

```tsx
const { data: deliveries = [] } = useQuery({
  ...orpc.webhooks.getDeliveries.queryOptions({
    input: { endpointId: viewingDeliveries!, limit: 50, offset: 0 },
  }),
  enabled: !!viewingDeliveries,
});
```

4. Inside the sheet, render a table with columns: **Time**, **Event**, **Status**, **Duration (ms)**, **Expand payload**.
   - Color code status: green for 2xx, red for errors.
   - A "Retry" button per row (calls `testEndpoint` or a future `retryDelivery`; for now just shows a toast "Manual retry: re-trigger the event").
5. Add "Refresh" button to re-fetch deliveries.

**Delivery table columns to show from schema:**
- `createdAt` (formatted relative time)
- `eventType`
- `statusCode` (badge: green if 2xx, red otherwise)
- `durationMs`
- Expandable: `requestPayload`, `responseBody`, `errorMessage`

**Verification:** `bun run check-types` — 0 errors. Clicking "View Logs" on an endpoint shows the delivery history.

---

### Task 3.2: Global Command Palette (Ctrl+K / Cmd+K)

**Files:**
- Create: `apps/web/src/components/command-palette.tsx`
- Modify: `apps/web/src/routes/dashboard.tsx` (add to layout)

**Step 1: Create `command-palette.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  AlertTriangle, BarChart3, Bell, BookOpen, Building2, Calculator,
  CalendarClock, ChefHat, Clock, CookingPot, DollarSign, FileText,
  Gift, GitCompareArrows, LayoutDashboard, MapPin, Package, Percent,
  PieChart, Receipt, ReceiptText, Salad, Scale, Settings, Shield,
  ShoppingCart, Star, Tag, TrendingUp, Truck, Users, UtensilsCrossed,
  Warehouse, Webhook,
} from "lucide-react";

const commands = [
  // Sales
  { group: "Sales", label: "New Sale", url: "/dashboard/pos", icon: UtensilsCrossed },
  { group: "Sales", label: "Orders", url: "/dashboard/orders", icon: ShoppingCart },
  { group: "Sales", label: "Customers", url: "/dashboard/customers", icon: Users },
  { group: "Sales", label: "Gift Cards", url: "/dashboard/giftcards", icon: Gift },
  { group: "Sales", label: "Loyalty Program", url: "/dashboard/loyalty", icon: Star },
  // Operations
  { group: "Operations", label: "Kitchen Display", url: "/dashboard/kitchen", icon: ChefHat },
  { group: "Operations", label: "Production Board", url: "/dashboard/production", icon: CookingPot },
  { group: "Operations", label: "Tables", url: "/dashboard/tables", icon: Package },
  { group: "Operations", label: "Time Clock", url: "/dashboard/timeclock", icon: Clock },
  // Inventory
  { group: "Inventory", label: "Products", url: "/dashboard/products", icon: Salad },
  { group: "Inventory", label: "Inventory", url: "/dashboard/inventory", icon: Warehouse },
  { group: "Inventory", label: "Stock Alerts", url: "/dashboard/stock-alerts", icon: AlertTriangle },
  { group: "Inventory", label: "Purchase Orders", url: "/dashboard/inventory?tab=purchase-orders", icon: Truck },
  { group: "Inventory", label: "Suppliers", url: "/dashboard/suppliers", icon: Building2 },
  { group: "Inventory", label: "Waste & Shrinkage", url: "/dashboard/waste", icon: ReceiptText },
  // Finance
  { group: "Finance", label: "Cash Control", url: "/dashboard/cash", icon: DollarSign },
  { group: "Finance", label: "Cash Reconciliation", url: "/dashboard/reconciliation", icon: Scale },
  { group: "Finance", label: "Expenses", url: "/dashboard/expenses", icon: ReceiptText },
  { group: "Finance", label: "Profit & Loss", url: "/dashboard/pnl", icon: Receipt },
  { group: "Finance", label: "Invoices", url: "/dashboard/invoices", icon: Receipt },
  { group: "Finance", label: "Quotations", url: "/dashboard/quotations", icon: FileText },
  // Insights
  { group: "Insights", label: "Reports", url: "/dashboard/reports", icon: BarChart3 },
  { group: "Insights", label: "Analytics", url: "/dashboard/analytics", icon: TrendingUp },
  { group: "Insights", label: "EOD Report", url: "/dashboard/eod", icon: FileText },
  // System
  { group: "System", label: "Settings", url: "/dashboard/settings", icon: Settings },
  { group: "System", label: "Locations", url: "/dashboard/locations", icon: MapPin },
  { group: "System", label: "Audit Log", url: "/dashboard/audit", icon: Shield },
  { group: "System", label: "Webhooks", url: "/dashboard/webhooks", icon: Webhook },
  { group: "System", label: "Notifications", url: "/dashboard/notifications", icon: Bell },
];

// Group commands by group key
const grouped = commands.reduce<Record<string, typeof commands>>((acc, cmd) => {
  if (!acc[cmd.group]) acc[cmd.group] = [];
  acc[cmd.group].push(cmd);
  return acc;
}, {});

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function handleSelect(url: string) {
    setOpen(false);
    navigate(url);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(grouped).map(([group, items], i) => (
          <span key={group}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.url}
                  value={item.label}
                  onSelect={() => handleSelect(item.url)}
                >
                  <item.icon className="mr-2 size-4" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </span>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
```

**Step 2: Add to `dashboard.tsx` layout**

In `apps/web/src/routes/dashboard.tsx`, import and add `<CommandPalette />` directly inside the layout JSX (e.g., right before the closing `</div>` of the root shell):

```tsx
import { CommandPalette } from "@/components/command-palette";
// ...inside layout return:
<CommandPalette />
```

Also add a small `⌘K` hint badge in the sidebar search input placeholder or as a tooltip on the search field to make it discoverable.

**Verification:** `bun run check-types` — 0 errors. Pressing Ctrl+K / Cmd+K opens the palette. Typing "cash" filters to relevant pages. Selecting navigates without reload.

---

## Wave 4: Create User Form — Frontend Update

### Task 4.1: Update create-user dialog to include roleId + optional password

**Files:**
- Modify: `apps/web/src/routes/dashboard.settings.tsx` (user create form, ~line 893-939)

The create form must now send `roleId` (UUID) instead of `role` (string). It should:
1. Add a `<Select>` for role, populated from `useQuery(orpc.settings.getRoles...)`.
2. Add an optional password `<Input type="password">` field.
3. Remove any `role: string` field from the form state.
4. Update the mutation call to send `{ name, email, roleId, password? }`.

Example form state change:
```ts
// Before:
const [form, setForm] = useState({ name: "", email: "", role: "user" });
// After:
const [form, setForm] = useState({ name: "", email: "", roleId: "", password: "" });
```

**Verification:** `bun run check-types` — 0 errors. Creating a user assigns them to the org and the selected role immediately.

---

## Final Verification

1. `bun run check-types` — 0 errors across all 8 packages
2. `bun run build` — clean production build
3. Verify custom split bill sends correct amounts to API
4. Verify Ctrl+K / Cmd+K opens command palette in app
5. Verify new user creation includes member + role rows in DB
6. Verify webhook delivery log shows events per endpoint
7. `docker compose -f docker-compose.prod.yml up -d --build`
8. Commit all changes: `feat: v2 deferred items + premium additions (Plan #9)`
9. Push to GitHub: `git push origin master`
10. Update `docs/PROGRESS.md` with Plan #9 entry

---

## Execution Strategy

```
Wave 1 (Bug fixes — sequential):
  1.1 → 1.2 → 1.3 → 1.4

Wave 2 (Nav — sequential, low risk):
  2.1 → 2.2 → 2.3

Wave 3 (Premium features — can parallelize):
  Agent A: 3.1 (webhook event center)
  Agent B: 3.2 (command palette)

Wave 4:
  4.1 (user form update)

Final: check-types → build → Docker → commit → push → PROGRESS.md
```
