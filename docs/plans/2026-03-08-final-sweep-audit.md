# Final Sweep Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all issues found in the post-Codex production-readiness audit — security gaps, dead code, UX pattern violations, and validation gaps.

**Architecture:** Four prioritized waves. Wave 1 is security (data isolation). Waves 2–4 are validation, UX patterns, and code quality. Each wave is independently committable.

**Tech Stack:** Bun, React Router v7, oRPC, Drizzle ORM, Zod, shadcn/ui Skeleton + AlertDialog

---

## FINDINGS REFERENCE

| # | Severity | Category | File | Finding |
|---|----------|----------|------|---------|
| F1 | 🔴 HIGH | Security | `routers/orders.ts` | `list()` missing org filter → cross-tenant data leak |
| F2 | 🔴 HIGH | Security | `routers/inventory.ts` | `getStockLevels()` + `getLedger()` missing org filter |
| F3 | 🟡 MEDIUM | Validation | `routers/notifications.ts` | `fromNumber`/`whatsappNumber` accept any string (no E.164 check) |
| F4 | 🟡 MEDIUM | Validation | `routers/webhooks.ts` | Webhook URL accepts HTTP (should enforce HTTPS) |
| F5 | 🟡 MEDIUM | UX | `routes/dashboard.notifications.tsx` | Template delete has no AlertDialog — bare `onClick` |
| F6 | 🟡 MEDIUM | UX | 11 route files | Plain-text "Loading…" instead of `<Skeleton />` |
| F7 | 🟢 LOW | Dead code | `routes/dashboard.tsx` | `ErrorBoundary` imported + re-exported but never rendered |
| F8 | 🟢 LOW | Dead code | `routes/pos.tsx` | Entire file orphaned — no nav link points to `/pos` |
| F9 | 🟢 LOW | Duplication | 4 route files | `downloadCsv` duplicated identically in orders, expenses, waste, timeclock |
| F10 | 🟢 LOW | Naming | sidebar + command-palette | Group called "Finance & Billing" in sidebar, split "Finance"+"Billing" in palette |
| F11 | 🟢 LOW | Cosmetic | `dashboard.customers.tsx` | Wrapper uses `space-y-6` instead of `flex flex-col gap-6` |

---

## Wave 1 — Security: Multi-Tenant Isolation

### Task 1: Fix orders.ts list() cross-tenant data leak

**File:** `packages/api/src/routers/orders.ts`

**Step 1: Read the current list() procedure to understand its shape**

Look at lines 1–90. Find where `conditions` array is built. Confirm `requireOrganizationId` is NOT currently imported.

**Step 2: Add org context to the list procedure**

Find the import block at the top and add:
```typescript
import { requireOrganizationId } from "../lib/org-context";
```

Find the `list` procedure handler where `conditions` is built (around line 32–46). Add org filter as the **first** condition:
```typescript
const orgId = requireOrganizationId(context);
const conditions: SQL[] = [eq(schema.order.organizationId, orgId)];
```

**Step 3: Verify TypeScript compiles**
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bunx tsc --project apps/server/tsconfig.json --noEmit
bunx tsc --project packages/api/tsconfig.json --noEmit --declaration false --declarationMap false --composite false
```
Expected: zero errors

**Step 4: Also check the `getOne` and `getStats` procedures in the same file**
- If they also lack org filtering, add it the same way.

**Step 5: Commit**
```bash
git add packages/api/src/routers/orders.ts
git commit -m "fix(security): add organizationId filter to orders list() — prevent cross-tenant data leak"
```

---

### Task 2: Fix inventory.ts getStockLevels() + getLedger() cross-tenant data leak

**File:** `packages/api/src/routers/inventory.ts`

**Step 1: Read the file** — Find `getStockLevels` and `getLedger` handlers. Note that `requireOrganizationId` is already imported (line 7) but unused in those two procedures.

**Step 2: Fix getStockLevels**

In the `getStockLevels` handler, after getting `input`, extract the org ID and add it to the conditions:
```typescript
const orgId = requireOrganizationId(context);
const conditions = [
  eq(schema.inventoryItem.isActive, true),
  eq(schema.inventoryItem.organizationId, orgId),
];
```

**Step 3: Fix getLedger**

Same pattern — add org filter to the ledger query's WHERE clause.

**Step 4: Verify TypeScript**
```bash
bunx tsc --project packages/api/tsconfig.json --noEmit --declaration false --declarationMap false --composite false
```

**Step 5: Commit**
```bash
git add packages/api/src/routers/inventory.ts
git commit -m "fix(security): add organizationId filter to inventory getStockLevels + getLedger"
```

---

## Wave 2 — Input Validation

### Task 3: Add E.164 validation to notification phone numbers

**File:** `packages/api/src/routers/notifications.ts`

**Step 1: Find the `updateSettings` input schema** (around line 129–138). Locate the `fromNumber` and `whatsappNumber` fields.

**Step 2: Add regex validation**

Replace the bare `.optional()` with:
```typescript
fromNumber: z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g. +15550001234)")
  .optional()
  .nullable(),
whatsappNumber: z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g. +15550001234)")
  .optional()
  .nullable(),
```

**Step 3: Verify TypeScript**
```bash
bunx tsc --project packages/api/tsconfig.json --noEmit --declaration false --declarationMap false --composite false
```

**Step 4: Commit**
```bash
git add packages/api/src/routers/notifications.ts
git commit -m "fix(validation): enforce E.164 format for notification phone numbers"
```

---

### Task 4: Enforce HTTPS on webhook URLs

**File:** `packages/api/src/routers/webhooks.ts`

**Step 1: Find both URL validation sites** — `createEndpoint` input (line ~44) and `updateEndpoint` input (line ~73).

**Step 2: Add `.refine()` to both**

```typescript
url: z
  .string()
  .url("Must be a valid URL")
  .refine(
    (u) => u.startsWith("https://"),
    "Webhook URL must use HTTPS"
  ),
```

Apply this same pattern to both the create and update schemas.

**Step 3: Verify TypeScript**
```bash
bunx tsc --project packages/api/tsconfig.json --noEmit --declaration false --declarationMap false --composite false
```

**Step 4: Commit**
```bash
git add packages/api/src/routers/webhooks.ts
git commit -m "fix(validation): enforce HTTPS-only webhook URLs"
```

---

## Wave 3 — UX Patterns

### Task 5: Add AlertDialog to notification template delete

**File:** `apps/web/src/routes/dashboard.notifications.tsx`

**Step 1: Find the delete button** (around line 347–349). It currently looks like:
```tsx
onClick={() => deleteMutation.mutate({ id: t.id as string })}
```

**Step 2: Add a confirmation AlertDialog**

The project standard is `<AlertDialog>` with a `<AlertDialogTrigger>` wrapping the button. Follow the exact same pattern as `dashboard.webhooks.tsx:541` (`DeleteWebhookConfirmation`).

Add a `DeleteTemplateConfirmation` component near the top of the file:
```tsx
function DeleteTemplateConfirmation({
  templateId,
  templateName,
  onConfirm,
}: {
  templateId: string;
  templateName: string;
  onConfirm: (id: string) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Delete &quot;{templateName}&quot;? This cannot be undone and will stop
            this message from being sent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onConfirm(templateId)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Replace the bare delete button with `<DeleteTemplateConfirmation>`.

Make sure `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogTrigger` are all imported from `@/components/ui/alert-dialog`.

**Step 3: Verify TypeScript**
```bash
bunx tsc --project apps/web/tsconfig.json --noEmit
```

**Step 4: Commit**
```bash
git add apps/web/src/routes/dashboard.notifications.tsx
git commit -m "fix(ux): add AlertDialog confirmation to notification template delete"
```

---

### Task 6: Replace 11 plain-text loading states with Skeleton

**Files to fix (in order):**

| File | Line | Current | Replace with |
|------|------|---------|-------------|
| `dashboard.cash.tsx` | ~16 | `Loading cash control...` | Skeleton |
| `dashboard.kitchen.tsx` | ~134 | `Loading kitchen orders...` | Skeleton |
| `dashboard.labor.tsx` | ~118 | `Loading labor dashboard...` | Skeleton |
| `dashboard.production.tsx` | ~26 | `Loading production tracker...` | Skeleton |
| `dashboard.products.tsx` | ~881 | `Loading recipe...` | Skeleton |
| `dashboard.reports.tsx` | ~92 | `Loading reports...` | Skeleton |
| `dashboard.suppliers.tsx` | ~203 | `Loading suppliers...` | Skeleton |
| `dashboard.tables.tsx` | ~304 | Loader2 icon + text | Skeleton |
| `dashboard.waste.tsx` | ~317 | `Loading waste tracker...` | Skeleton |
| `dashboard.webhooks.tsx` | ~296 | `Loading webhooks...` | Skeleton |
| `dashboard.webhooks.tsx` | ~629 | `Loading deliveries...` | Skeleton |

**Step 1: For each file, find the loading state**

Look for patterns like:
```tsx
if (isLoading) return <div>Loading ...</div>
// or
if (isLoading) return <p>Loading...</p>
// or
if (isLoading) return <div className="flex..."><Loader2 .../> Loading...</div>
```

**Step 2: Replace with a consistent Skeleton pattern**

Use this standard pattern (adapt column count to match the page):
```tsx
if (isLoading) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

For pages with a table, use:
```tsx
if (isLoading) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
```

Make sure `import { Skeleton } from "@/components/ui/skeleton"` is present in each file.

**Step 3: Verify TypeScript after ALL replacements**
```bash
bunx tsc --project apps/web/tsconfig.json --noEmit
```

**Step 4: Commit**
```bash
git add apps/web/src/routes/dashboard.cash.tsx \
        apps/web/src/routes/dashboard.kitchen.tsx \
        apps/web/src/routes/dashboard.labor.tsx \
        apps/web/src/routes/dashboard.production.tsx \
        apps/web/src/routes/dashboard.products.tsx \
        apps/web/src/routes/dashboard.reports.tsx \
        apps/web/src/routes/dashboard.suppliers.tsx \
        apps/web/src/routes/dashboard.tables.tsx \
        apps/web/src/routes/dashboard.waste.tsx \
        apps/web/src/routes/dashboard.webhooks.tsx
git commit -m "fix(ux): replace all plain-text loading states with Skeleton components (11 files)"
```

---

## Wave 4 — Code Quality

### Task 7: Extract shared downloadCsv utility

**Step 1: Check the exact implementation in one of the files**

Read `apps/web/src/routes/dashboard.orders.tsx` lines 21–44. Copy the exact `downloadCsv` function body.

**Step 2: Create the shared utility**

Create `apps/web/src/lib/csv-export.ts`:
```typescript
/**
 * Triggers a browser download of a CSV file built from an array of row objects.
 * Column names come from the first row's keys.
 */
export function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[],
): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

> **Note:** Match the exact implementation from the source files — do not rewrite the logic.

**Step 3: Update the 4 consuming files**

In each of these files:
- `apps/web/src/routes/dashboard.orders.tsx`
- `apps/web/src/routes/dashboard.expenses.tsx`
- `apps/web/src/routes/dashboard.waste.tsx`
- `apps/web/src/routes/dashboard.timeclock.tsx`

Remove the local `downloadCsv` function definition and replace with:
```typescript
import { downloadCsv } from "@/lib/csv-export";
```

**Step 4: Verify TypeScript**
```bash
bunx tsc --project apps/web/tsconfig.json --noEmit
```

**Step 5: Commit**
```bash
git add apps/web/src/lib/csv-export.ts \
        apps/web/src/routes/dashboard.orders.tsx \
        apps/web/src/routes/dashboard.expenses.tsx \
        apps/web/src/routes/dashboard.waste.tsx \
        apps/web/src/routes/dashboard.timeclock.tsx
git commit -m "refactor: extract downloadCsv to shared lib/csv-export.ts (was duplicated in 4 files)"
```

---

### Task 8: Remove orphaned pos.tsx route

**File:** `apps/web/src/routes/pos.tsx`

**Step 1: Confirm it is truly unreachable**

```bash
grep -r '"/pos"' apps/web/src/ --include="*.tsx" --include="*.ts"
grep -r "href.*\"/pos\"" apps/web/src/ --include="*.tsx"
grep -r "to=\"/pos\"" apps/web/src/ --include="*.tsx"
```

Expected: zero results (confirming no navigation links point to `/pos`).

**Step 2: Delete the file**
```bash
rm apps/web/src/routes/pos.tsx
```

**Step 3: Verify the build still passes**
```bash
bunx tsc --project apps/web/tsconfig.json --noEmit
```

**Step 4: Commit**
```bash
git add -A
git commit -m "chore: remove orphaned pos.tsx route (unreachable — all POS nav goes to /dashboard/pos)"
```

---

### Task 9: Remove dead ErrorBoundary re-export from dashboard.tsx

**File:** `apps/web/src/routes/dashboard.tsx`

**Step 1: Read lines 15–23** — find the ErrorBoundary import and export.

**Step 2: Remove only the import and re-export**

Remove:
```typescript
import { ErrorBoundary } from "@/components/error-boundary";
```
And:
```typescript
export { ErrorBoundary };
```

**Step 3: Check if anything imports ErrorBoundary FROM dashboard.tsx**
```bash
grep -r "from.*routes/dashboard" apps/web/src/ --include="*.tsx" | grep ErrorBoundary
```

If any file imports it from there, update those imports to import directly from `@/components/error-boundary` instead.

**Step 4: Verify TypeScript**
```bash
bunx tsc --project apps/web/tsconfig.json --noEmit
```

**Step 5: Commit**
```bash
git add apps/web/src/routes/dashboard.tsx
git commit -m "chore: remove dead ErrorBoundary re-export from dashboard.tsx"
```

---

### Task 10: Fix Finance/Billing group naming between sidebar and command palette

**Files:**
- `apps/web/src/components/layout/app-sidebar.tsx`
- `apps/web/src/components/layout/command-palette.tsx`

**Step 1: Read both files** — find the group header label for the Finance section in each.

**Step 2: Decide on the canonical name**

The sidebar uses `"Finance & Billing"` as one group. The command palette splits it as `"Finance"` and `"Billing"`. Adopt the sidebar's `"Finance & Billing"` as the single canonical label in the command palette too. Merge the two command-palette groups into one heading.

**Step 3: Update command-palette.tsx**

Find the separate "Finance" and "Billing" `CommandGroup` sections and consolidate them under one:
```tsx
<CommandGroup heading="Finance & Billing">
  {/* all finance + billing items combined */}
</CommandGroup>
```

**Step 4: Verify TypeScript**
```bash
bunx tsc --project apps/web/tsconfig.json --noEmit
```

**Step 5: Commit**
```bash
git add apps/web/src/components/layout/command-palette.tsx
git commit -m "fix(ux): align command palette 'Finance & Billing' group name with sidebar"
```

---

## Final Steps

### Task 11: Full type check + rebuild + push

**Step 1: Full turbo type check**
```bash
bun run check-types 2>&1
```
Expected: all packages pass, 0 errors.

**Step 2: Rebuild Docker**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**Step 3: Health check**
```bash
sleep 10 && curl -sf https://pos.karetechsolutions.com/health
```
Expected: `{"status":"ok",...}`

**Step 4: Push to GitHub**
```bash
git push origin master
```

---

## Summary

| Wave | Tasks | Priority |
|------|-------|----------|
| Wave 1 — Security | T1: orders org isolation, T2: inventory org isolation | 🔴 Do first |
| Wave 2 — Validation | T3: E.164 phone validation, T4: HTTPS-only webhooks | 🟡 Second |
| Wave 3 — UX | T5: AlertDialog on template delete, T6: Skeleton x11 | 🟡 Third |
| Wave 4 — Quality | T7: extract downloadCsv, T8: remove pos.tsx, T9: ErrorBoundary, T10: Finance naming | 🟢 Last |
