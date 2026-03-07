# Production Component Mapping + Refund Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the production report show individual components (Rice, Baked Chicken, Cookup, etc.) that staff track physically, even though the POS sells them as combos. Also add a Refund button to the orders dashboard.

**Architecture:** New `product_production_component` table maps POS product → production component names with quantities. The `getReport` procedure expands order line item sales through these mappings when building the "actual sold" tally. Products without mappings continue working 1:1. The refund button in `OrdersTable` calls the already-complete `ordersRouter.refund` backend.

**Tech Stack:** Bun, Drizzle ORM + PostgreSQL, oRPC, React Router, TanStack Query, shadcn/ui

---

### Task 1: Add `product_production_component` table to schema

**Files:**
- Modify: `packages/db/src/schema/production.ts`

The schema already exports `productionLog`. Add the new table and its relation at the bottom of the file.

**Step 1: Add the table and relation**

Open `packages/db/src/schema/production.ts`. After the existing `productionLogRelations` block, append:

```ts
// ── Product Production Component ────────────────────────────────────────

export const productProductionComponent = pgTable(
	"product_production_component",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		componentName: text("component_name").notNull(),
		quantity: numeric("quantity", { precision: 10, scale: 4 })
			.notNull()
			.default("1"),
	},
	(table) => [
		index("idx_prod_component_product").on(table.productId),
	],
);

export const productProductionComponentRelations = relations(
	productProductionComponent,
	({ one }) => ({
		product: one(product, {
			fields: [productProductionComponent.productId],
			references: [product.id],
		}),
	}),
);
```

Also add `productProductionComponent` to the product's relations import. In `packages/db/src/schema/product.ts`, the `productRelations` block currently has `recipeIngredients: many(recipeIngredient)`. This is in a separate file so you don't need to modify it — Drizzle will infer from the forward reference.

**Step 2: Verify TypeScript compiles**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run typecheck 2>&1 | head -30
```

Expected: no new errors.

---

### Task 2: Generate and run DB migration

**Files:**
- Created automatically in: `packages/db/src/migrations/`

**Step 1: Generate migration**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS/packages/db
bun run db:generate
```

Expected: new SQL file in `src/migrations/` containing `CREATE TABLE "product_production_component"`.

**Step 2: Apply migration to production DB**

```bash
bun run db:migrate
```

Expected: migration runs without error.

**Step 3: Commit**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
git add packages/db/src/schema/production.ts packages/db/src/migrations/
git commit -m "feat: add product_production_component schema and migration"
```

---

### Task 3: Add `getComponents` and `setComponents` to production router

**Files:**
- Modify: `packages/api/src/routers/production.ts`

**Step 1: Add `inArray` to the drizzle import**

At the top of the file, change:
```ts
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
```
to:
```ts
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
```

**Step 2: Add the two new procedures** before the `export const productionRouter` line:

```ts
// ── getComponents ────────────────────────────────────────────────────────
const getComponents = permissionProcedure("products.read")
	.input(z.object({ productId: z.string().uuid() }))
	.handler(async ({ input }) => {
		return db
			.select({
				id: schema.productProductionComponent.id,
				componentName: schema.productProductionComponent.componentName,
				quantity: schema.productProductionComponent.quantity,
			})
			.from(schema.productProductionComponent)
			.where(
				eq(schema.productProductionComponent.productId, input.productId),
			)
			.orderBy(schema.productProductionComponent.componentName);
	});

// ── setComponents ────────────────────────────────────────────────────────
const setComponents = permissionProcedure("products.update")
	.input(
		z.object({
			productId: z.string().uuid(),
			components: z.array(
				z.object({
					componentName: z.string().min(1),
					quantity: z.string(),
				}),
			),
		}),
	)
	.handler(async ({ input }) => {
		await db
			.delete(schema.productProductionComponent)
			.where(
				eq(schema.productProductionComponent.productId, input.productId),
			);
		if (input.components.length > 0) {
			await db.insert(schema.productProductionComponent).values(
				input.components.map((c) => ({
					productId: input.productId,
					componentName: c.componentName,
					quantity: c.quantity,
				})),
			);
		}
		return { success: true };
	});
```

**Step 3: Add to the router export**

Change:
```ts
export const productionRouter = {
	getEntries,
	createEntry,
	getReconciliation,
	getReport,
};
```
to:
```ts
export const productionRouter = {
	getEntries,
	createEntry,
	getReconciliation,
	getReport,
	getComponents,
	setComponents,
};
```

**Step 4: Verify TypeScript**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

**Step 5: Commit**

```bash
git add packages/api/src/routers/production.ts
git commit -m "feat: add getComponents and setComponents to production router"
```

---

### Task 4: Modify `getReport` to expand sold items through component mappings

**Files:**
- Modify: `packages/api/src/routers/production.ts` — the `getReport` handler

**Step 1: Replace the `getReport` handler**

Find the `getReport` handler (starts at `const getReport = permissionProcedure("reports.read")`). Replace it entirely with:

```ts
// ── getReport ───────────────────────────────────────────────────────────
const getReport = permissionProcedure("reports.read")
	.input(
		z.object({
			date: z.string(),
			workflow: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

		const conditions: ReturnType<typeof eq>[] = [
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

		const byProduct = new Map<
			string,
			{ name: string; opening: number; reorder: number; closing: number }
		>();
		for (const e of entries) {
			const key = e.productName; // always key by name for production log
			const cur = byProduct.get(key) ?? {
				name: e.productName,
				opening: 0,
				reorder: 0,
				closing: 0,
			};
			if (e.entryType === "opening") cur.opening += e.quantity;
			if (e.entryType === "reorder") cur.reorder += e.quantity;
			if (e.entryType === "closing") cur.closing += e.quantity;
			byProduct.set(key, cur);
		}

		// Get actual sold from completed orders on that date (Guyana is UTC-4)
		const dateStart = new Date(`${input.date}T00:00:00-04:00`);
		const dateEnd = new Date(`${input.date}T23:59:59-04:00`);

		const soldItems = await db
			.select({
				productId: schema.orderLineItem.productId,
				productName: schema.orderLineItem.productNameSnapshot,
				quantity: schema.orderLineItem.quantity,
			})
			.from(schema.orderLineItem)
			.innerJoin(
				schema.order,
				eq(schema.orderLineItem.orderId, schema.order.id),
			)
			.where(
				and(
					eq(schema.order.organizationId, DEFAULT_ORG_ID),
					eq(schema.order.status, "completed"),
					gte(schema.order.createdAt, dateStart),
					lte(schema.order.createdAt, dateEnd),
					eq(schema.orderLineItem.voided, false),
				),
			);

		// Load component mappings for all sold product IDs
		const soldProductIds = [
			...new Set(soldItems.map((s) => s.productId).filter(Boolean)),
		] as string[];

		const componentRows =
			soldProductIds.length > 0
				? await db
						.select({
							productId: schema.productProductionComponent.productId,
							componentName: schema.productProductionComponent.componentName,
							quantity: schema.productProductionComponent.quantity,
						})
						.from(schema.productProductionComponent)
						.where(
							inArray(
								schema.productProductionComponent.productId,
								soldProductIds,
							),
						)
				: [];

		// Build map: productId → components[]
		const componentMap = new Map<
			string,
			{ componentName: string; quantity: number }[]
		>();
		for (const c of componentRows) {
			const list = componentMap.get(c.productId) ?? [];
			list.push({ componentName: c.componentName, quantity: Number(c.quantity) });
			componentMap.set(c.productId, list);
		}

		// Tally actual sold, expanding through components
		const actualByName = new Map<string, number>();
		for (const s of soldItems) {
			const components = s.productId ? componentMap.get(s.productId) : undefined;
			if (components && components.length > 0) {
				// Expand: each component gets qty * component.quantity
				for (const c of components) {
					const prev = actualByName.get(c.componentName) ?? 0;
					actualByName.set(c.componentName, prev + s.quantity * c.quantity);
				}
			} else {
				// No mapping — attribute directly to product name
				const key = s.productName;
				actualByName.set(key, (actualByName.get(key) ?? 0) + s.quantity);
			}
		}

		const rows = Array.from(byProduct.entries()).map(([, v]) => {
			const expected = v.opening + v.reorder - v.closing;
			const actual = actualByName.get(v.name) ?? 0;
			return {
				productId: v.name, // used as React key in frontend
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

**Step 2: Verify TypeScript**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

**Step 3: Commit**

```bash
git add packages/api/src/routers/production.ts
git commit -m "feat: expand production report actual-sold through component mappings"
```

---

### Task 5: Add "Production" tab to Products edit dialog

**Files:**
- Modify: `apps/web/src/routes/dashboard.products.tsx`

The file already has a `RecipeTab` component as a reference pattern. We'll add a `ProductionTab` component using the same approach.

**Step 1: Add `ProductionTab` component**

Find the `RecipeTab` function in `dashboard.products.tsx`. Insert the following `ProductionTab` component immediately before `RecipeTab`:

```tsx
// ── ProductionTab ───────────────────────────────────────────────────────
function ProductionTab({ productId }: { productId: string }) {
	const queryClient = useQueryClient();
	const [localComponents, setLocalComponents] = useState<
		{ componentName: string; quantity: string }[] | null
	>(null);
	const [addName, setAddName] = useState("");
	const [addQty, setAddQty] = useState("1");

	const { data: saved = [], isLoading } = useQuery(
		orpc.production.getComponents.queryOptions({ input: { productId } }),
	);

	const components: { componentName: string; quantity: string }[] =
		localComponents ??
		saved.map((c) => ({
			componentName: c.componentName,
			quantity: String(c.quantity),
		}));

	const saveComponents = useMutation(
		orpc.production.setComponents.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.production.getComponents.queryOptions({
						input: { productId },
					}).queryKey,
				});
				setLocalComponents(null);
				toast.success("Production components saved");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to save components"),
		}),
	);

	function handleAdd() {
		const name = addName.trim();
		if (!name) return;
		setLocalComponents([...components, { componentName: name, quantity: addQty || "1" }]);
		setAddName("");
		setAddQty("1");
	}

	function handleRemove(idx: number) {
		setLocalComponents(components.filter((_, i) => i !== idx));
	}

	function handleSave() {
		saveComponents.mutate({ productId, components });
	}

	if (isLoading) return <p className="py-4 text-center text-muted-foreground text-sm">Loading...</p>;

	const isDirty = localComponents !== null;

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground text-sm">
				Map this POS item to individual production components. When this product
				is sold, each component's actual count increases in the Production Report.
			</p>

			{components.length === 0 ? (
				<p className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
					No components — this product tracks as one unit in the report.
				</p>
			) : (
				<div className="rounded-md border">
					<table className="w-full text-sm">
						<thead className="bg-muted/50">
							<tr>
								<th className="p-2 text-left font-medium">Component Name</th>
								<th className="p-2 text-center font-medium">Qty</th>
								<th className="w-10 p-2" />
							</tr>
						</thead>
						<tbody>
							{components.map((c, i) => (
								<tr key={i} className="border-t">
									<td className="p-2">{c.componentName}</td>
									<td className="p-2 text-center">{c.quantity}</td>
									<td className="p-2">
										<Button
											variant="ghost"
											size="icon"
											className="size-7 text-destructive hover:text-destructive"
											onClick={() => handleRemove(i)}
										>
											<X className="size-3.5" />
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Add row */}
			<div className="flex gap-2">
				<Input
					placeholder="Component name (e.g. Rice)"
					value={addName}
					onChange={(e) => setAddName(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleAdd()}
					className="flex-1"
				/>
				<Input
					type="number"
					step="0.25"
					min="0.25"
					placeholder="Qty"
					value={addQty}
					onChange={(e) => setAddQty(e.target.value)}
					className="w-20"
				/>
				<Button variant="outline" size="sm" onClick={handleAdd} disabled={!addName.trim()}>
					Add
				</Button>
			</div>

			<div className="flex justify-end">
				<Button
					size="sm"
					disabled={!isDirty || saveComponents.isPending}
					onClick={handleSave}
				>
					{saveComponents.isPending ? "Saving..." : "Save Components"}
				</Button>
			</div>
		</div>
	);
}
```

**Step 2: Add `X` to lucide imports**

Find the lucide-react import in `dashboard.products.tsx`. It will look something like:
```ts
import { Edit2, Package, Plus, Search, Trash2 } from "lucide-react";
```
Add `X` to the list: `import { Edit2, Package, Plus, Search, Trash2, X } from "lucide-react";`

**Step 3: Add "Production" tab trigger and content to the edit dialog**

Find the Tabs block inside the edit dialog — it currently has "Details" and "Recipe" tabs:
```tsx
<TabsList>
  <TabsTrigger value="details">Details</TabsTrigger>
  <TabsTrigger value="recipe">Recipe</TabsTrigger>
</TabsList>
```
Change to:
```tsx
<TabsList>
  <TabsTrigger value="details">Details</TabsTrigger>
  <TabsTrigger value="recipe">Recipe</TabsTrigger>
  <TabsTrigger value="production">Production</TabsTrigger>
</TabsList>
```

Then after the `<TabsContent value="recipe">` block, add:
```tsx
<TabsContent value="production" className="mt-4">
  <ProductionTab productId={editingId} />
</TabsContent>
```

**Step 4: Verify TypeScript**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run typecheck 2>&1 | grep -E "error|Error" | head -20
```

**Step 5: Commit**

```bash
git add apps/web/src/routes/dashboard.products.tsx
git commit -m "feat: add Production components tab to product edit dialog"
```

---

### Task 6: Seed production component mappings

**Files:**
- Modify: `packages/db/src/seed.ts`

**Step 1: Add cleanup delete at the top of the seed function**

Find the block of cleanup deletes (they all use `like` or specific IDs). After the last cleanup delete, add:

```ts
await db.delete(schema.productProductionComponent).where(
  sql`1=1`,
);
```

This ensures the seed is idempotent — it wipes and re-inserts components each run.

**Step 2: Add a new seed section after the existing inventory/production sections**

Find "Section 19" or the area after purchase orders. Add a new section:

```ts
// ── Section 19j: Production Component Mappings ──────────────────────────
console.log("  -> Production Component Mappings");
await db.insert(schema.productProductionComponent).values([
  // Fried Rice and Baked Chicken
  { productId: PROD.friedRiceBakedChicken, componentName: "Fried Rice", quantity: "1" },
  { productId: PROD.friedRiceBakedChicken, componentName: "Baked Chicken", quantity: "1" },
  // Raisin Rice with Pineapple Chicken
  { productId: PROD.raisinRicePineapple, componentName: "Raisin Rice", quantity: "1" },
  { productId: PROD.raisinRicePineapple, componentName: "Pineapple Chicken", quantity: "1" },
  // Vegetable Rice with Sweet and Sour Chicken
  { productId: PROD.vegRiceSweetSour, componentName: "Veg Rice", quantity: "1" },
  { productId: PROD.vegRiceSweetSour, componentName: "Sweet & Sour Chicken", quantity: "1" },
  // Chowmein/Baked Chicken
  { productId: PROD.chowmeinBakedChicken, componentName: "Chowmein", quantity: "1" },
  { productId: PROD.chowmeinBakedChicken, componentName: "Baked Chicken", quantity: "1" },
  // Chowmein/Fry Chicken
  { productId: PROD.chowmeinFryChicken, componentName: "Chowmein", quantity: "1" },
  { productId: PROD.chowmeinFryChicken, componentName: "Fry Chicken", quantity: "1" },
  // Caribbean Rice B/Chicken
  { productId: PROD.caribbeanRiceBChicken, componentName: "Caribbean Rice", quantity: "1" },
  { productId: PROD.caribbeanRiceBChicken, componentName: "Baked Chicken", quantity: "1" },
  // Caribbean Rice F/Chicken
  { productId: PROD.caribbeanRiceFChicken, componentName: "Caribbean Rice", quantity: "1" },
  { productId: PROD.caribbeanRiceFChicken, componentName: "Fry Chicken", quantity: "1" },
  // Cookup/Baked Chicken
  { productId: PROD.cookupBakedChicken, componentName: "Cookup", quantity: "1" },
  { productId: PROD.cookupBakedChicken, componentName: "Baked Chicken", quantity: "1" },
  // Mac Cheese W/ Baked Chick
  { productId: PROD.macCheeseBakedChick, componentName: "Mac & Cheese", quantity: "1" },
  { productId: PROD.macCheeseBakedChick, componentName: "Baked Chicken", quantity: "1" },
  // Cookup Baked Snapper
  { productId: PROD.cookupBakedSnapper, componentName: "Cookup", quantity: "1" },
  { productId: PROD.cookupBakedSnapper, componentName: "Baked Snapper", quantity: "1" },
  // Cookup Fry Snapper
  { productId: PROD.cookupFrySnapper, componentName: "Cookup", quantity: "1" },
  { productId: PROD.cookupFrySnapper, componentName: "Fry Snapper", quantity: "1" },
  // Anyrice / Curry Beef
  { productId: PROD.curryBeef, componentName: "Rice", quantity: "1" },
  { productId: PROD.curryBeef, componentName: "Curry Beef", quantity: "1" },
  // Cook Up BBQ
  { productId: PROD.cookUpBBQ, componentName: "Cookup", quantity: "1" },
  { productId: PROD.cookUpBBQ, componentName: "BBQ Chicken", quantity: "1" },
  // Cook-up Fc
  { productId: PROD.cookUpFc, componentName: "Cookup", quantity: "1" },
  { productId: PROD.cookUpFc, componentName: "Fry Chicken", quantity: "1" },
  // Veg. Meal/Dholl (two-component)
  { productId: PROD.vegMealDholl, componentName: "Veg Meal", quantity: "1" },
  { productId: PROD.vegMealDholl, componentName: "Dholl", quantity: "1" },
]).onConflictDoNothing();
```

Note: Single-component items (Curry Chicken, Curry Snapper, Veg Chowmein, Veg Rice, Veggie Cookup, Cup Dhal) are intentionally omitted — they track as-is since their production log name matches their product name.

**Step 3: Run seed locally to verify**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run db:seed 2>&1 | grep -E "Component|error|Error"
```

Expected: `-> Production Component Mappings` appears, no errors.

**Step 4: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat: seed production component mappings for all Bettencourt menu items"
```

---

### Task 7: Add Refund button to OrdersTable

**Files:**
- Modify: `apps/web/src/components/orders/orders-table.tsx`

The void button pattern is already there. We model the refund button identically.

**Step 1: Add `RotateCcw` to lucide imports**

The current import is `import { Ban, Banknote, ... } from "lucide-react"`. Add `RotateCcw`:
```ts
import { Ban, Banknote, ChevronDown, ChevronRight, Clock, CreditCard, Filter, RotateCcw, Search, ShoppingBag, Truck } from "lucide-react";
```

**Step 2: Add refund state and mutation** alongside the existing `voidReason`/`voidMutation` declarations:

```ts
const [refundReason, setRefundReason] = useState("");
const [refundAmount, setRefundAmount] = useState("");

const refundMutation = useMutation(
  orpc.orders.refund.mutationOptions({
    onSuccess: (_result, variables) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === variables.id ? { ...o, status: "refunded" } : o,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order refunded");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to refund order");
    },
  }),
);

function handleRefund(orderId: string, total: number) {
  const amt = refundAmount ? Number(refundAmount) : total;
  refundMutation.mutate({ id: orderId, reason: refundReason, amount: amt });
  setRefundReason("");
  setRefundAmount("");
}
```

**Step 3: Add Refund button** in the table row action cell, right after the Void AlertDialog closing tag (`</AlertDialog>`). The whole action cell currently only shows the void button for `status === "completed"`. Change it to:

```tsx
{canVoid && (
  <TableCell>
    <div className="flex items-center gap-1">
      {order.status === "completed" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-destructive text-xs hover:text-destructive"
            >
              <Ban className="size-3" />
              Void
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Void Order {order.order_number}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will void the order totalling{" "}
                {formatGYD(Number(order.total))} and reverse
                any cash session entries. This action is
                logged in the audit trail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="Reason for voiding (required)"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setVoidReason("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!voidReason.trim() || voidMutation.isPending}
                onClick={() => handleVoid(order.id)}
              >
                {voidMutation.isPending ? "Voiding..." : "Confirm Void"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {order.status === "completed" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-amber-600 hover:text-amber-700"
              onClick={() => setRefundAmount(String(order.total))}
            >
              <RotateCcw className="size-3" />
              Refund
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Refund Order {order.order_number}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Full order total is {formatGYD(Number(order.total))}.
                Enter a partial amount for partial refunds.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3">
              <Input
                type="number"
                placeholder={`Amount (default: ${order.total})`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <Input
                placeholder="Reason for refund (required)"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setRefundReason("");
                  setRefundAmount("");
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 text-white hover:bg-amber-700"
                disabled={!refundReason.trim() || refundMutation.isPending}
                onClick={() => handleRefund(order.id, Number(order.total))}
              >
                {refundMutation.isPending ? "Refunding..." : "Confirm Refund"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  </TableCell>
)}
```

**Step 4: Verify TypeScript**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run typecheck 2>&1 | grep -E "error|Error" | head -20
```

**Step 5: Commit**

```bash
git add apps/web/src/components/orders/orders-table.tsx
git commit -m "feat: add Refund button to orders table for completed orders"
```

---

### Task 8: Build, seed, and deploy

**Step 1: Full TypeScript check**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run typecheck 2>&1 | grep -c "error TS"
```

Expected: `0`

**Step 2: Push to GitHub**

```bash
git push origin master
```

**Step 3: Rebuild Docker container**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
docker compose -f docker-compose.prod.yml up -d --build
```

Wait for container to be healthy.

**Step 4: Re-run seed**

```bash
bun run db:seed
```

Expected: `-> Production Component Mappings` in output, `Seed complete!`

**Step 5: Smoke test**
- Open https://pos.karetechsolutions.com/dashboard/production-report → verify today's rows show component names (Rice, Baked Chicken, Cookup, etc.) if any production logs exist
- Open https://pos.karetechsolutions.com/dashboard/products → edit any restaurant item → verify "Production" tab appears and shows saved components
- Open https://pos.karetechsolutions.com/dashboard/orders → find a completed order → verify both Void and Refund buttons appear
