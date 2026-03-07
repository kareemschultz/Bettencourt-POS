# Mock Data Expansion + QoL Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Populate all empty pages with realistic mock data (production report 14 days, waste log 30 days, timeclock 14 days, invoices/quotations/discounts) and add CSV export + prev/next navigation + print buttons.

**Architecture:** Two independent agent tracks running in parallel. Agent A owns `packages/db/src/seed.ts` exclusively. Agent B owns frontend route/component files exclusively. No file overlap = no merge conflicts.

**Tech Stack:** Drizzle ORM inserts in seed.ts, React + oRPC query data for frontend, native `Blob` + `URL.createObjectURL` for CSV download, `window.print()` for print.

---

## Agent Assignment

| Agent | Tasks | Files Owned |
|-------|-------|-------------|
| **Agent A** | 1–6 | `packages/db/src/seed.ts` only |
| **Agent B** | 7–11 | `apps/web/src/routes/dashboard.orders.tsx`, `dashboard.expenses.tsx`, `dashboard.waste.tsx`, `dashboard.timeclock.tsx`, `dashboard.production-report.tsx`, `dashboard.eod.tsx` |

---

## AGENT A: Mock Data Expansion

### Task 1: Production Log — 14-Day Historical Data

**File:** `packages/db/src/seed.ts`

Find the comment `// 20. Audit Logs` and insert the following block **before it** (after the closing of the existing `19b` block at line ~3538):

```typescript
	// 19c. Production Logs — 14 days of historical check-off data (loop-based)
	console.log("  -> Production Logs (14-day history)");
	{
		// Products covered in restaurant workflow
		const restaurantItems = [
			{ id: PROD.friedRiceBakedChicken, name: "Fried Rice and Baked Chicken", reorderQty: 30, closingVariance: [-2, 0, 3, 0, -1, 0, 2, 0, -3, 1, 0, -1, 0, 2] },
			{ id: PROD.curryChicken, name: "Curry Chicken", reorderQty: 20, closingVariance: [0, 1, 0, -1, 2, 0, 0, -2, 1, 0, 3, 0, -1, 0] },
			{ id: PROD.chowmeinBakedChicken, name: "Chowmein/Baked Chicken", reorderQty: 15, closingVariance: [0, 0, -1, 2, 0, 1, 0, 0, -2, 0, 0, 1, 0, -1] },
			{ id: PROD.cookupBakedSnapper, name: "Cookup Baked Snapper", reorderQty: 12, closingVariance: [0, 2, 0, -1, 0, 0, 1, 0, 0, -2, 0, 1, 0, 0] },
			{ id: PROD.vegRice, name: "Veg. Rice", reorderQty: 10, closingVariance: [1, 0, 0, 0, -1, 0, 2, 0, 0, 1, 0, 0, -1, 0] },
			{ id: PROD.curryBeef, name: "Anyrice / Curry Beef", reorderQty: 8, closingVariance: [0, 0, 1, 0, 0, -1, 0, 2, 0, 0, 0, -1, 1, 0] },
			{ id: PROD.chowmeinFryChicken, name: "Chowmein/Fry Chicken", reorderQty: 18, closingVariance: [0, -1, 0, 1, 0, 0, -2, 0, 1, 0, 0, 2, 0, -1] },
			{ id: PROD.cookupFrySnapper, name: "Cookup Fry Snapper", reorderQty: 10, closingVariance: [-1, 0, 0, 1, 0, 2, 0, -1, 0, 0, 1, 0, -2, 0] },
			{ id: PROD.raisinRicePineapple, name: "Raisin Rice/Pineapple Chicken", reorderQty: 14, closingVariance: [0, 0, -1, 0, 1, 0, 0, -2, 0, 1, 0, 0, 2, 0] },
			{ id: PROD.currySnapper, name: "Curry Snapper", reorderQty: 8, closingVariance: [0, 1, 0, -1, 0, 0, 1, 0, 2, 0, -1, 0, 0, 1] },
		];
		const bakeryItems = [
			{ id: PROD.spongeCake, name: "Sponge Cake", reorderQty: 10, closingVariance: [0, 1, 0, -1, 2, 0, 0, 1, 0, -1, 0, 2, 0, 0] },
			{ id: PROD.coconutBuns, name: "Coconut Buns", reorderQty: 24, closingVariance: [2, 0, 0, -1, 0, 3, 0, 0, -2, 0, 1, 0, 0, -1] },
			{ id: PROD.bakedCustard, name: "Baked Custard", reorderQty: 6, closingVariance: [0, -1, 1, 0, 0, 1, 0, -1, 0, 0, 2, 0, -1, 0] },
		];

		let pdN = 51; // Continue from PD(50)
		const PD_HIST = (n: number) =>
			`fe000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

		for (let daysBack = 2; daysBack <= 15; daysBack++) {
			const dayIdx = daysBack - 2; // 0-13
			const histDate = new Date(Date.now() - daysBack * 86400000)
				.toISOString()
				.split("T")[0]!;

			// Restaurant workflow
			for (const item of restaurantItems) {
				const opening = dayIdx % 3 === 0 ? 1 : 0; // occasional leftover
				const reorder = item.reorderQty + (dayIdx % 5 === 0 ? 5 : 0); // occasional surge
				const closingBase = Math.max(0, Math.floor(reorder * 0.1));
				const closing = Math.max(0, closingBase + item.closingVariance[dayIdx]);

				await db
					.insert(schema.productionLog)
					.values([
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "opening",
							quantity: opening,
							workflow: "restaurant",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "reorder",
							quantity: reorder,
							notes: dayIdx % 5 === 0 ? "High demand day" : null,
							workflow: "restaurant",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "closing",
							quantity: closing,
							notes: closing > 3 ? "Overproduced" : null,
							workflow: "restaurant",
							logDate: histDate,
						},
					])
					.onConflictDoNothing();
			}

			// Bakery workflow
			for (const item of bakeryItems) {
				const opening = dayIdx % 4 === 0 ? 2 : 0;
				const reorder = item.reorderQty + (dayIdx % 7 === 0 ? 4 : 0);
				const closing = Math.max(0, 1 + item.closingVariance[dayIdx]);

				await db
					.insert(schema.productionLog)
					.values([
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "opening",
							quantity: opening,
							workflow: "bakery",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "reorder",
							quantity: reorder,
							workflow: "bakery",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "closing",
							quantity: closing,
							workflow: "bakery",
							logDate: histDate,
						},
					])
					.onConflictDoNothing();
			}
		}
	}
```

Also add cleanup for these IDs in the `// -> Cleaning stale transactional seed data` block (find the existing `DELETE FROM production_log WHERE id::text LIKE 'fe000000%'` line — it already covers PD_HIST since they share the `fe000000` prefix). No additional cleanup needed.

**Verify:** After seeding, open Production Report in browser. Switch to a date 5 days ago. Should show 10 restaurant items with varied balanced/short/over variances.

---

### Task 2: Waste Log — 30 Days of Data

**File:** `packages/db/src/seed.ts`

Add a cleanup line to the transactional cleanup block (find `// -> Cleaning stale transactional seed data`):

```typescript
	await db.execute(sql`DELETE FROM waste_log WHERE id::text LIKE 'ec000000%'`);
```

Then add this section before `// 20. Audit Logs`:

```typescript
	// 19d. Waste Log — 30 days of varied entries
	console.log("  -> Waste Log");
	const WL = (n: number) =>
		`ec000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

	const wasteEntries = [
		// Day 0 (today)
		{ id: WL(1), daysBack: 0, hour: 15, product: "Curry Chicken", qty: "2", unit: "each", cost: "1200", reason: "spoilage", invItem: INV_ITEM.chicken, notes: "Left out too long" },
		{ id: WL(2), daysBack: 0, hour: 16, product: "White Rice", qty: "1.5", unit: "lb", cost: "180", reason: "over_prep", invItem: INV_ITEM.rice },
		// Day 1
		{ id: WL(3), daysBack: 1, hour: 17, product: "Fried Rice/Baked Chicken", qty: "3", unit: "each", cost: "1800", reason: "over_prep", invItem: INV_ITEM.chicken, notes: "Overproduced" },
		{ id: WL(4), daysBack: 1, hour: 18, product: "Coconut Buns", qty: "6", unit: "each", cost: "360", reason: "expired", invItem: INV_ITEM.coconut },
		// Day 2
		{ id: WL(5), daysBack: 2, hour: 14, product: "Whole Chicken", qty: "1", unit: "lb", cost: "450", reason: "spoilage", invItem: INV_ITEM.chicken },
		{ id: WL(6), daysBack: 2, hour: 16, product: "Sponge Cake", qty: "2", unit: "each", cost: "480", reason: "dropped", invItem: null, notes: "Staff accident" },
		{ id: WL(7), daysBack: 2, hour: 17, product: "Tamarind Juice", qty: "1", unit: "each", cost: "300", reason: "expired" },
		// Day 3
		{ id: WL(8), daysBack: 3, hour: 15, product: "Red Snapper", qty: "0.5", unit: "lb", cost: "400", reason: "spoilage", invItem: INV_ITEM.snapper },
		{ id: WL(9), daysBack: 3, hour: 17, product: "Cookup Fry Snapper", qty: "2", unit: "each", cost: "1400", reason: "over_prep" },
		// Day 4
		{ id: WL(10), daysBack: 4, hour: 16, product: "Veg. Rice", qty: "4", unit: "each", cost: "480", reason: "over_prep", notes: "Made too much for lunch" },
		{ id: WL(11), daysBack: 4, hour: 14, product: "Vegetable Oil", qty: "0.5", unit: "gal", cost: "600", reason: "other", invItem: INV_ITEM.oil, notes: "Spilled during cooking" },
		// Day 5
		{ id: WL(12), daysBack: 5, hour: 17, product: "Curry Chicken", qty: "4", unit: "each", cost: "2400", reason: "over_prep", invItem: INV_ITEM.chicken },
		{ id: WL(13), daysBack: 5, hour: 18, product: "Baked Custard", qty: "3", unit: "each", cost: "720", reason: "expired" },
		// Day 6
		{ id: WL(14), daysBack: 6, hour: 15, product: "White Rice", qty: "2", unit: "lb", cost: "240", reason: "spoilage", invItem: INV_ITEM.rice },
		{ id: WL(15), daysBack: 6, hour: 17, product: "Chowmein Noodles", qty: "0.5", unit: "lb", cost: "100", reason: "expired", invItem: INV_ITEM.noodles },
		// Day 7
		{ id: WL(16), daysBack: 7, hour: 14, product: "Fried Rice/Baked Chicken", qty: "2", unit: "each", cost: "1200", reason: "over_prep" },
		{ id: WL(17), daysBack: 7, hour: 16, product: "Coconut Buns", qty: "8", unit: "each", cost: "480", reason: "over_prep", invItem: INV_ITEM.coconut },
		{ id: WL(18), daysBack: 7, hour: 18, product: "Stewing Beef", qty: "0.3", unit: "lb", cost: "210", reason: "spoilage", invItem: INV_ITEM.beef },
		// Day 9
		{ id: WL(19), daysBack: 9, hour: 15, product: "Curry Snapper", qty: "3", unit: "each", cost: "2100", reason: "over_prep" },
		{ id: WL(20), daysBack: 9, hour: 17, product: "Yellow Onions", qty: "1", unit: "lb", cost: "180", reason: "spoilage", invItem: INV_ITEM.onions },
		// Day 11
		{ id: WL(21), daysBack: 11, hour: 16, product: "Sponge Cake", qty: "1", unit: "each", cost: "240", reason: "dropped", notes: "Customer rejected" },
		{ id: WL(22), daysBack: 11, hour: 17, product: "Whole Chicken", qty: "2", unit: "lb", cost: "900", reason: "expired", invItem: INV_ITEM.chicken },
		// Day 14
		{ id: WL(23), daysBack: 14, hour: 14, product: "Curry Beef", qty: "5", unit: "each", cost: "1500", reason: "over_prep" },
		{ id: WL(24), daysBack: 14, hour: 16, product: "All-Purpose Flour", qty: "1", unit: "lb", cost: "80", reason: "spoilage", invItem: INV_ITEM.flour },
		// Day 17
		{ id: WL(25), daysBack: 17, hour: 15, product: "Veg. Meal/Dholl", qty: "3", unit: "each", cost: "360", reason: "over_prep" },
		{ id: WL(26), daysBack: 17, hour: 17, product: "Red Snapper", qty: "1", unit: "lb", cost: "800", reason: "spoilage", invItem: INV_ITEM.snapper },
		// Day 20
		{ id: WL(27), daysBack: 20, hour: 16, product: "Coconut Buns", qty: "12", unit: "each", cost: "720", reason: "expired" },
		{ id: WL(28), daysBack: 20, hour: 18, product: "Brown Sugar", qty: "0.5", unit: "lb", cost: "75", reason: "other", invItem: INV_ITEM.sugar, notes: "Contaminated by moisture" },
		// Day 23
		{ id: WL(29), daysBack: 23, hour: 14, product: "Chowmein/Fry Chicken", qty: "4", unit: "each", cost: "2400", reason: "over_prep" },
		// Day 26
		{ id: WL(30), daysBack: 26, hour: 16, product: "Tamarind Pulp", qty: "0.5", unit: "lb", cost: "175", reason: "spoilage", invItem: INV_ITEM.tamarind },
	] as const;

	await db
		.insert(schema.wasteLog)
		.values(
			wasteEntries.map((e) => ({
				id: e.id,
				organizationId: ORG_ID,
				inventoryItemId: ("invItem" in e && e.invItem) ? e.invItem : null,
				productName: e.product,
				quantity: e.qty,
				unit: e.unit,
				estimatedCost: e.cost,
				reason: e.reason,
				notes: ("notes" in e ? e.notes : null) ?? null,
				loggedBy: USER.admin,
				createdAt: daysAgo(e.daysBack, e.hour),
			})),
		)
		.onConflictDoNothing();
```

**Verify:** Open Waste Tracker page. Should show KPI cards populated, waste by reason chart, 30-day trend bars, and entries in the log table.

---

### Task 3: Timeclock — 14 Days of Shifts

**File:** `packages/db/src/seed.ts`

Add cleanup:
```typescript
	await db.execute(sql`DELETE FROM time_entry WHERE id::text LIKE 'ed000000%'`);
```

Add section before `// 20. Audit Logs`:

```typescript
	// 19e. Time Entries (Timeclock shifts) — 14 days
	console.log("  -> Time Entries");
	const TE = (n: number) =>
		`ed000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

	// Shift patterns: [userId, clockInHour, durationHours, breakMins]
	// Each day: 3-4 employees per day
	const shiftPatterns = [
		// daysBack=0 (today): one active shift (no clockOut)
		{ id: TE(1), userId: USER.cashier, daysBack: 0, clockInHour: 8, clockOutHour: null, breakMins: "0" },
		{ id: TE(2), userId: USER.anna, daysBack: 0, clockInHour: 8, clockOutHour: null, breakMins: "0" },
		{ id: TE(3), userId: USER.production, daysBack: 0, clockInHour: 7, clockOutHour: null, breakMins: "0" },
		// daysBack=1
		{ id: TE(4), userId: USER.cashier, daysBack: 1, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(5), userId: USER.anna, daysBack: 1, clockInHour: 8, clockOutHour: 16, breakMins: "30" },
		{ id: TE(6), userId: USER.production, daysBack: 1, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		{ id: TE(7), userId: USER.carl, daysBack: 1, clockInHour: 12, clockOutHour: 20, breakMins: "30" },
		// daysBack=2
		{ id: TE(8), userId: USER.cashier, daysBack: 2, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(9), userId: USER.production, daysBack: 2, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		{ id: TE(10), userId: USER.bonita, daysBack: 2, clockInHour: 9, clockOutHour: 17, breakMins: "60" },
		// daysBack=3
		{ id: TE(11), userId: USER.cashier, daysBack: 3, clockInHour: 8, clockOutHour: 18, breakMins: "30" },
		{ id: TE(12), userId: USER.anna, daysBack: 3, clockInHour: 8, clockOutHour: 16, breakMins: "30" },
		{ id: TE(13), userId: USER.production, daysBack: 3, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		{ id: TE(14), userId: USER.renatta, daysBack: 3, clockInHour: 10, clockOutHour: 18, breakMins: "30" },
		// daysBack=4
		{ id: TE(15), userId: USER.carl, daysBack: 4, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(16), userId: USER.production, daysBack: 4, clockInHour: 7, clockOutHour: 14, breakMins: "0" },
		{ id: TE(17), userId: USER.anna, daysBack: 4, clockInHour: 9, clockOutHour: 17, breakMins: "30" },
		// daysBack=5
		{ id: TE(18), userId: USER.cashier, daysBack: 5, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(19), userId: USER.production, daysBack: 5, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		{ id: TE(20), userId: USER.bonita, daysBack: 5, clockInHour: 9, clockOutHour: 18, breakMins: "60" },
		{ id: TE(21), userId: USER.carl, daysBack: 5, clockInHour: 12, clockOutHour: 20, breakMins: "30" },
		// daysBack=6
		{ id: TE(22), userId: USER.cashier, daysBack: 6, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(23), userId: USER.anna, daysBack: 6, clockInHour: 8, clockOutHour: 16, breakMins: "30" },
		// daysBack=7
		{ id: TE(24), userId: USER.cashier, daysBack: 7, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(25), userId: USER.production, daysBack: 7, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		{ id: TE(26), userId: USER.renatta, daysBack: 7, clockInHour: 10, clockOutHour: 19, breakMins: "30" },
		// daysBack=8
		{ id: TE(27), userId: USER.carl, daysBack: 8, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(28), userId: USER.production, daysBack: 8, clockInHour: 7, clockOutHour: 14, breakMins: "0" },
		// daysBack=9
		{ id: TE(29), userId: USER.cashier, daysBack: 9, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(30), userId: USER.anna, daysBack: 9, clockInHour: 8, clockOutHour: 16, breakMins: "30" },
		{ id: TE(31), userId: USER.production, daysBack: 9, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		// daysBack=10
		{ id: TE(32), userId: USER.bonita, daysBack: 10, clockInHour: 9, clockOutHour: 17, breakMins: "60" },
		{ id: TE(33), userId: USER.carl, daysBack: 10, clockInHour: 12, clockOutHour: 20, breakMins: "30" },
		// daysBack=11
		{ id: TE(34), userId: USER.cashier, daysBack: 11, clockInHour: 8, clockOutHour: 18, breakMins: "30", notes: "Stayed late" },
		{ id: TE(35), userId: USER.production, daysBack: 11, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		// daysBack=12
		{ id: TE(36), userId: USER.anna, daysBack: 12, clockInHour: 8, clockOutHour: 16, breakMins: "30" },
		{ id: TE(37), userId: USER.renatta, daysBack: 12, clockInHour: 10, clockOutHour: 18, breakMins: "30" },
		// daysBack=13
		{ id: TE(38), userId: USER.cashier, daysBack: 13, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(39), userId: USER.production, daysBack: 13, clockInHour: 7, clockOutHour: 15, breakMins: "0" },
		// daysBack=14
		{ id: TE(40), userId: USER.carl, daysBack: 14, clockInHour: 8, clockOutHour: 17, breakMins: "30" },
		{ id: TE(41), userId: USER.anna, daysBack: 14, clockInHour: 8, clockOutHour: 16, breakMins: "30" },
	];

	await db
		.insert(schema.timeEntry)
		.values(
			shiftPatterns.map((s) => {
				const clockIn = daysAgo(s.daysBack, s.clockInHour);
				const clockOut = s.clockOutHour !== null
					? daysAgo(s.daysBack, s.clockOutHour)
					: null;
				return {
					id: s.id,
					userId: s.userId,
					locationId: LOC_ID,
					organizationId: ORG_ID,
					clockIn,
					clockOut,
					breakMinutes: s.breakMins,
					status: clockOut ? "completed" : "active",
					notes: ("notes" in s ? s.notes : null) ?? null,
				};
			}),
		)
		.onConflictDoNothing();
```

**Verify:** Open Timeclock page → Shift History tab. Should show shifts for multiple employees across 14 days. Today's tab should show 3 active (clocked-in) entries.

---

### Task 4: Invoices and Quotations

**File:** `packages/db/src/seed.ts`

Add cleanup:
```typescript
	await db.execute(sql`DELETE FROM invoice WHERE id::text LIKE 'ee000000%'`);
	await db.execute(sql`DELETE FROM quotation WHERE id::text LIKE 'ef000000%'`);
	// Reset counter so seed numbers are predictable
	await db.execute(sql`INSERT INTO invoice_counter (organization_id, last_number) VALUES (${ORG_ID}, 15) ON CONFLICT (organization_id) DO UPDATE SET last_number = 15`);
	await db.execute(sql`INSERT INTO quotation_counter (organization_id, last_number) VALUES (${ORG_ID}, 8) ON CONFLICT (organization_id) DO UPDATE SET last_number = 8`);
```

Add section before `// 20. Audit Logs`:

```typescript
	// 19f. Invoices
	console.log("  -> Invoices");
	const INV = (n: number) =>
		`ee000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

	await db
		.insert(schema.invoice)
		.values([
			{
				id: INV(1),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0001",
				customerId: CUST(3), // Anita Ramsaroop
				customerName: "Anita Ramsaroop",
				customerPhone: "592-600-1003",
				items: JSON.stringify([
					{ description: "Catering — Office Lunch (15 pax)", quantity: 15, unitPrice: 2200, total: 33000 },
					{ description: "Assorted Beverages", quantity: 15, unitPrice: 300, total: 4500 },
				]),
				subtotal: "37500",
				taxTotal: "0",
				total: "37500",
				status: "paid",
				amountPaid: "37500",
				dueDate: daysAgo(20, 12),
				datePaid: daysAgo(18, 10),
				createdBy: USER.admin,
				createdAt: daysAgo(25, 9),
			},
			{
				id: INV(2),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0002",
				customerName: "Ministry of Education",
				customerAddress: "Carifesta Avenue, Georgetown",
				items: JSON.stringify([
					{ description: "Staff Appreciation Lunch (30 pax)", quantity: 30, unitPrice: 2200, total: 66000 },
					{ description: "Dessert Trays", quantity: 5, unitPrice: 2400, total: 12000 },
				]),
				subtotal: "78000",
				taxTotal: "0",
				total: "78000",
				status: "paid",
				amountPaid: "78000",
				dueDate: daysAgo(15, 12),
				datePaid: daysAgo(14, 14),
				createdBy: USER.admin,
				createdAt: daysAgo(20, 10),
			},
			{
				id: INV(3),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0003",
				customerId: CUST(1), // Priya Singh
				customerName: "Priya Singh",
				customerPhone: "592-600-1001",
				items: JSON.stringify([
					{ description: "Birthday Party Catering (20 pax)", quantity: 20, unitPrice: 2500, total: 50000 },
					{ description: "Sponge Cake (large)", quantity: 2, unitPrice: 3500, total: 7000 },
				]),
				subtotal: "57000",
				taxTotal: "0",
				total: "57000",
				status: "partial",
				amountPaid: "30000",
				dueDate: daysAgo(5, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(12, 10),
			},
			{
				id: INV(4),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0004",
				customerName: "Guyana Revenue Authority",
				customerAddress: "200-201 Camp Street, Georgetown",
				items: JSON.stringify([
					{ description: "Corporate Lunch (50 pax)", quantity: 50, unitPrice: 2200, total: 110000 },
					{ description: "Beverages (assorted)", quantity: 50, unitPrice: 300, total: 15000 },
				]),
				subtotal: "125000",
				taxTotal: "0",
				total: "125000",
				status: "sent",
				amountPaid: "0",
				dueDate: daysAgo(-7, 12), // Due in 7 days
				createdBy: USER.admin,
				createdAt: daysAgo(3, 9),
			},
			{
				id: INV(5),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0005",
				customerName: "Banks DIH Limited",
				customerAddress: "Thirst Park, Georgetown",
				items: JSON.stringify([
					{ description: "Monthly Cafeteria Service — Feb 2026", quantity: 1, unitPrice: 280000, total: 280000 },
				]),
				subtotal: "280000",
				taxTotal: "0",
				total: "280000",
				status: "overdue",
				amountPaid: "0",
				dueDate: daysAgo(10, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(40, 9),
			},
			{
				id: INV(6),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0006",
				customerId: CUST(2),
				customerName: "Rajesh Persaud",
				customerPhone: "592-600-1002",
				items: JSON.stringify([
					{ description: "Wedding Reception Catering (80 pax)", quantity: 80, unitPrice: 3500, total: 280000 },
					{ description: "Wedding Cake (3-tier)", quantity: 1, unitPrice: 25000, total: 25000 },
					{ description: "Bar Package", quantity: 80, unitPrice: 500, total: 40000 },
				]),
				subtotal: "345000",
				taxTotal: "0",
				total: "345000",
				status: "draft",
				amountPaid: "0",
				dueDate: daysAgo(-14, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(1, 14),
			},
			{
				id: INV(7),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0007",
				customerName: "University of Guyana",
				items: JSON.stringify([
					{ description: "Graduation Dinner (120 pax)", quantity: 120, unitPrice: 2800, total: 336000 },
				]),
				subtotal: "336000",
				taxTotal: "0",
				total: "336000",
				status: "paid",
				amountPaid: "336000",
				datePaid: daysAgo(30, 14),
				dueDate: daysAgo(35, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(50, 9),
			},
			{
				id: INV(8),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0008",
				customerName: "Digicel Guyana",
				items: JSON.stringify([
					{ description: "Staff Lunch x 25 — Weekly (4 weeks)", quantity: 100, unitPrice: 2200, total: 220000 },
				]),
				subtotal: "220000",
				taxTotal: "0",
				total: "220000",
				status: "partial",
				amountPaid: "110000",
				dueDate: daysAgo(3, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(30, 9),
			},
		])
		.onConflictDoNothing();

	// 19g. Quotations
	console.log("  -> Quotations");
	const QUOT = (n: number) =>
		`ef000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

	await db
		.insert(schema.quotation)
		.values([
			{
				id: QUOT(1),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0001",
				customerName: "Guyana Power & Light",
				items: JSON.stringify([
					{ description: "Corporate Lunch Package (40 pax/day, 22 days)", quantity: 880, unitPrice: 2200, total: 1936000 },
				]),
				subtotal: "1936000",
				taxTotal: "0",
				total: "1936000",
				status: "sent",
				validUntil: daysAgo(-10, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(5, 10),
			},
			{
				id: QUOT(2),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0002",
				customerId: CUST(4),
				customerName: "Khalid Khan",
				items: JSON.stringify([
					{ description: "Anniversary Dinner (30 pax)", quantity: 30, unitPrice: 3000, total: 90000 },
					{ description: "Custom Anniversary Cake", quantity: 1, unitPrice: 15000, total: 15000 },
				]),
				subtotal: "105000",
				taxTotal: "0",
				total: "105000",
				status: "draft",
				validUntil: daysAgo(-7, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(1, 11),
			},
			{
				id: QUOT(3),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0003",
				customerName: "Hand-in-Hand Insurance",
				items: JSON.stringify([
					{ description: "Team Building Lunch (60 pax)", quantity: 60, unitPrice: 2500, total: 150000 },
				]),
				subtotal: "150000",
				taxTotal: "0",
				total: "150000",
				status: "accepted",
				convertedInvoiceId: INV(4),
				validUntil: daysAgo(-5, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(7, 9),
			},
			{
				id: QUOT(4),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0004",
				customerName: "GTT (Guyana Telephone & Telegraph)",
				items: JSON.stringify([
					{ description: "Monthly Staff Catering — 35 pax", quantity: 770, unitPrice: 2200, total: 1694000 },
				]),
				subtotal: "1694000",
				taxTotal: "0",
				total: "1694000",
				status: "declined",
				validUntil: daysAgo(2, 12),
				notes: "Client went with competitor",
				createdBy: USER.admin,
				createdAt: daysAgo(15, 9),
			},
			{
				id: QUOT(5),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0005",
				customerName: "Private Client — Wedding",
				items: JSON.stringify([
					{ description: "Wedding Buffet (150 pax)", quantity: 150, unitPrice: 4000, total: 600000 },
					{ description: "3-tier Wedding Cake", quantity: 1, unitPrice: 35000, total: 35000 },
					{ description: "Beverages Package", quantity: 150, unitPrice: 500, total: 75000 },
				]),
				subtotal: "710000",
				taxTotal: "0",
				total: "710000",
				status: "sent",
				validUntil: daysAgo(-21, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(2, 14),
			},
		])
		.onConflictDoNothing();
```

**Verify:** Open Invoices page — should show 8 invoices. Open Quotations page — should show 5 quotations with varied statuses.

---

### Task 5: Discount Rules + Extra Orders (30-day coverage)

**File:** `packages/db/src/seed.ts`

Add cleanup:
```typescript
	await db.execute(sql`DELETE FROM discount_rule WHERE id::text LIKE 'ab000000%'`);
```

Add section before `// 20. Audit Logs`:

```typescript
	// 19h. Discount Rules
	console.log("  -> Discount Rules");
	const DR = (n: number) =>
		`ab000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

	await db
		.insert(schema.discountRule)
		.values([
			{
				id: DR(1),
				organizationId: ORG_ID,
				name: "Happy Hour 10% Off",
				type: "percentage",
				value: "10",
				applyTo: "order",
				isAutoApply: true,
				scheduleType: "time_window",
				startTime: "14:00",
				endTime: "16:00",
				daysOfWeek: "mon,tue,wed,thu,fri",
				isActive: true,
			},
			{
				id: DR(2),
				organizationId: ORG_ID,
				name: "Senior Citizen Discount",
				type: "percentage",
				value: "15",
				applyTo: "order",
				isAutoApply: false,
				scheduleType: "always",
				promoCode: "SENIOR15",
				isActive: true,
			},
			{
				id: DR(3),
				organizationId: ORG_ID,
				name: "Large Order $500 Off",
				type: "fixed",
				value: "500",
				applyTo: "order",
				minOrderTotal: "10000",
				isAutoApply: true,
				scheduleType: "always",
				isActive: true,
			},
			{
				id: DR(4),
				organizationId: ORG_ID,
				name: "Staff Meal Discount",
				type: "percentage",
				value: "50",
				applyTo: "order",
				promoCode: "STAFF50",
				isAutoApply: false,
				scheduleType: "always",
				isActive: true,
			},
			{
				id: DR(5),
				organizationId: ORG_ID,
				name: "Weekend Special 5% Off",
				type: "percentage",
				value: "5",
				applyTo: "order",
				isAutoApply: true,
				scheduleType: "time_window",
				daysOfWeek: "sat,sun",
				isActive: true,
			},
			{
				id: DR(6),
				organizationId: ORG_ID,
				name: "Buy 5 Meals Get 1 Free",
				type: "bogo",
				value: "100",
				applyTo: "item",
				buyQuantity: 5,
				getQuantity: 1,
				isAutoApply: false,
				scheduleType: "always",
				isActive: false, // Inactive — for demo variety
			},
			{
				id: DR(7),
				organizationId: ORG_ID,
				name: "Loyalty VIP $200 Off",
				type: "fixed",
				value: "200",
				applyTo: "order",
				promoCode: "VIP200",
				minOrderTotal: "5000",
				maxUses: 100,
				currentUses: 23,
				isAutoApply: false,
				scheduleType: "always",
				isActive: true,
			},
			{
				id: DR(8),
				organizationId: ORG_ID,
				name: "Grand Opening 20% Off",
				type: "percentage",
				value: "20",
				applyTo: "order",
				isAutoApply: false,
				scheduleType: "date_range",
				startDate: "2026-01-01",
				endDate: "2026-01-31",
				isActive: false,
			},
		])
		.onConflictDoNothing();
```

Also add 30 extra orders (days 7–30) to boost analytics. In the ORDER dict at the top of seed, they are already at o1-o20. We need new IDs. Add a new const block near the ORDER dict:

```typescript
// Extended orders (days 7-30) for analytics depth
const ORDER_EXT = {
	e1: "f1000000-0000-4000-8000-000000000015",
	e2: "f1000000-0000-4000-8000-000000000016",
	e3: "f1000000-0000-4000-8000-000000000017",
	e4: "f1000000-0000-4000-8000-000000000018",
	e5: "f1000000-0000-4000-8000-000000000019",
	e6: "f1000000-0000-4000-8000-00000000001a",
	e7: "f1000000-0000-4000-8000-00000000001b",
	e8: "f1000000-0000-4000-8000-00000000001c",
	e9: "f1000000-0000-4000-8000-00000000001d",
	e10: "f1000000-0000-4000-8000-00000000001e",
	e11: "f1000000-0000-4000-8000-00000000001f",
	e12: "f1000000-0000-4000-8000-000000000020",
	e13: "f1000000-0000-4000-8000-000000000021",
	e14: "f1000000-0000-4000-8000-000000000022",
	e15: "f1000000-0000-4000-8000-000000000023",
	e16: "f1000000-0000-4000-8000-000000000024",
	e17: "f1000000-0000-4000-8000-000000000025",
	e18: "f1000000-0000-4000-8000-000000000026",
	e19: "f1000000-0000-4000-8000-000000000027",
	e20: "f1000000-0000-4000-8000-000000000028",
} as const;
```

Add to the cleanup section:
```typescript
	const seedOrderExtIds = Object.values(ORDER_EXT);
	await db.delete(schema.order).where(inArray(schema.order.id, seedOrderExtIds));
```

Then add a section before `// 20. Audit Logs`:

```typescript
	// 19i. Extended Orders (days 7-30 for analytics coverage)
	console.log("  -> Extended Orders (analytics coverage)");
	await db
		.insert(schema.order)
		.values([
			{ id: ORDER_EXT.e1, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-021", type: "sale", status: "completed", subtotal: "8800", taxTotal: "0", total: "8800", createdAt: daysAgo(7, 11) },
			{ id: ORDER_EXT.e2, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.pastry, userId: USER.anna, orderNumber: "GT-022", type: "sale", status: "completed", subtotal: "3600", taxTotal: "0", total: "3600", createdAt: daysAgo(7, 13) },
			{ id: ORDER_EXT.e3, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-023", type: "sale", status: "completed", subtotal: "6600", taxTotal: "0", total: "6600", createdAt: daysAgo(8, 12) },
			{ id: ORDER_EXT.e4, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.beverage, userId: USER.carl, orderNumber: "GT-024", type: "sale", status: "completed", subtotal: "2400", taxTotal: "0", total: "2400", createdAt: daysAgo(9, 10) },
			{ id: ORDER_EXT.e5, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-025", type: "sale", status: "completed", subtotal: "11000", taxTotal: "0", total: "11000", createdAt: daysAgo(9, 13) },
			{ id: ORDER_EXT.e6, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.anna, orderNumber: "GT-026", type: "sale", status: "completed", subtotal: "7400", taxTotal: "0", total: "7400", createdAt: daysAgo(10, 11) },
			{ id: ORDER_EXT.e7, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.pastry, userId: USER.cashier, orderNumber: "GT-027", type: "sale", status: "completed", subtotal: "4200", taxTotal: "0", total: "4200", createdAt: daysAgo(11, 12) },
			{ id: ORDER_EXT.e8, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.carl, orderNumber: "GT-028", type: "sale", status: "completed", subtotal: "9900", taxTotal: "0", total: "9900", createdAt: daysAgo(12, 11) },
			{ id: ORDER_EXT.e9, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-029", type: "sale", status: "completed", subtotal: "6600", taxTotal: "0", total: "6600", createdAt: daysAgo(13, 10) },
			{ id: ORDER_EXT.e10, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.beverage, userId: USER.anna, orderNumber: "GT-030", type: "sale", status: "completed", subtotal: "1800", taxTotal: "0", total: "1800", createdAt: daysAgo(14, 14) },
			{ id: ORDER_EXT.e11, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-031", type: "sale", status: "completed", subtotal: "8800", taxTotal: "0", total: "8800", createdAt: daysAgo(15, 12) },
			{ id: ORDER_EXT.e12, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.carl, orderNumber: "GT-032", type: "sale", status: "completed", subtotal: "13200", taxTotal: "0", total: "13200", createdAt: daysAgo(16, 11) },
			{ id: ORDER_EXT.e13, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.anna, orderNumber: "GT-033", type: "sale", status: "completed", subtotal: "7400", taxTotal: "0", total: "7400", createdAt: daysAgo(17, 13) },
			{ id: ORDER_EXT.e14, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.pastry, userId: USER.cashier, orderNumber: "GT-034", type: "sale", status: "completed", subtotal: "2700", taxTotal: "0", total: "2700", createdAt: daysAgo(18, 10) },
			{ id: ORDER_EXT.e15, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.carl, orderNumber: "GT-035", type: "sale", status: "completed", subtotal: "9300", taxTotal: "0", total: "9300", createdAt: daysAgo(20, 11) },
			{ id: ORDER_EXT.e16, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-036", type: "sale", status: "completed", subtotal: "6600", taxTotal: "0", total: "6600", createdAt: daysAgo(22, 12) },
			{ id: ORDER_EXT.e17, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.anna, orderNumber: "GT-037", type: "sale", status: "completed", subtotal: "11000", taxTotal: "0", total: "11000", createdAt: daysAgo(24, 11) },
			{ id: ORDER_EXT.e18, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-038", type: "sale", status: "completed", subtotal: "8800", taxTotal: "0", total: "8800", createdAt: daysAgo(26, 13) },
			{ id: ORDER_EXT.e19, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.carl, orderNumber: "GT-039", type: "sale", status: "completed", subtotal: "7400", taxTotal: "0", total: "7400", createdAt: daysAgo(28, 10) },
			{ id: ORDER_EXT.e20, organizationId: ORG_ID, locationId: LOC_ID, registerId: REG.meals, userId: USER.cashier, orderNumber: "GT-040", type: "sale", status: "completed", subtotal: "9900", taxTotal: "0", total: "9900", createdAt: daysAgo(30, 12) },
		])
		.onConflictDoNothing();

	// Payments for extended orders
	const PM_EXT = (n: number) =>
		`f3000000-0000-4000-8000-${String(n + 20).padStart(12, "0")}`;
	await db
		.insert(schema.payment)
		.values([
			{ id: PM_EXT(1), orderId: ORDER_EXT.e1, method: "cash", amount: "8800", tendered: "10000", changeGiven: "1200", status: "completed", createdAt: daysAgo(7, 11) },
			{ id: PM_EXT(2), orderId: ORDER_EXT.e2, method: "card", amount: "3600", reference: "TXN-100", status: "completed", createdAt: daysAgo(7, 13) },
			{ id: PM_EXT(3), orderId: ORDER_EXT.e3, method: "cash", amount: "6600", tendered: "7000", changeGiven: "400", status: "completed", createdAt: daysAgo(8, 12) },
			{ id: PM_EXT(4), orderId: ORDER_EXT.e4, method: "cash", amount: "2400", tendered: "2500", changeGiven: "100", status: "completed", createdAt: daysAgo(9, 10) },
			{ id: PM_EXT(5), orderId: ORDER_EXT.e5, method: "card", amount: "11000", reference: "TXN-101", status: "completed", createdAt: daysAgo(9, 13) },
			{ id: PM_EXT(6), orderId: ORDER_EXT.e6, method: "cash", amount: "7400", tendered: "8000", changeGiven: "600", status: "completed", createdAt: daysAgo(10, 11) },
			{ id: PM_EXT(7), orderId: ORDER_EXT.e7, method: "cash", amount: "4200", tendered: "5000", changeGiven: "800", status: "completed", createdAt: daysAgo(11, 12) },
			{ id: PM_EXT(8), orderId: ORDER_EXT.e8, method: "card", amount: "9900", reference: "TXN-102", status: "completed", createdAt: daysAgo(12, 11) },
			{ id: PM_EXT(9), orderId: ORDER_EXT.e9, method: "cash", amount: "6600", tendered: "7000", changeGiven: "400", status: "completed", createdAt: daysAgo(13, 10) },
			{ id: PM_EXT(10), orderId: ORDER_EXT.e10, method: "cash", amount: "1800", tendered: "2000", changeGiven: "200", status: "completed", createdAt: daysAgo(14, 14) },
			{ id: PM_EXT(11), orderId: ORDER_EXT.e11, method: "card", amount: "8800", reference: "TXN-103", status: "completed", createdAt: daysAgo(15, 12) },
			{ id: PM_EXT(12), orderId: ORDER_EXT.e12, method: "cash", amount: "13200", tendered: "14000", changeGiven: "800", status: "completed", createdAt: daysAgo(16, 11) },
			{ id: PM_EXT(13), orderId: ORDER_EXT.e13, method: "cash", amount: "7400", tendered: "8000", changeGiven: "600", status: "completed", createdAt: daysAgo(17, 13) },
			{ id: PM_EXT(14), orderId: ORDER_EXT.e14, method: "card", amount: "2700", reference: "TXN-104", status: "completed", createdAt: daysAgo(18, 10) },
			{ id: PM_EXT(15), orderId: ORDER_EXT.e15, method: "cash", amount: "9300", tendered: "10000", changeGiven: "700", status: "completed", createdAt: daysAgo(20, 11) },
			{ id: PM_EXT(16), orderId: ORDER_EXT.e16, method: "cash", amount: "6600", tendered: "7000", changeGiven: "400", status: "completed", createdAt: daysAgo(22, 12) },
			{ id: PM_EXT(17), orderId: ORDER_EXT.e17, method: "card", amount: "11000", reference: "TXN-105", status: "completed", createdAt: daysAgo(24, 11) },
			{ id: PM_EXT(18), orderId: ORDER_EXT.e18, method: "cash", amount: "8800", tendered: "9000", changeGiven: "200", status: "completed", createdAt: daysAgo(26, 13) },
			{ id: PM_EXT(19), orderId: ORDER_EXT.e19, method: "cash", amount: "7400", tendered: "8000", changeGiven: "600", status: "completed", createdAt: daysAgo(28, 10) },
			{ id: PM_EXT(20), orderId: ORDER_EXT.e20, method: "card", amount: "9900", reference: "TXN-106", status: "completed", createdAt: daysAgo(30, 12) },
		])
		.onConflictDoNothing();
```

---

### Task 6: Run Seed and Verify All Pages

**Commands:**
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run db:seed
```

Expected console output should include all new sections:
```
  -> Production Logs (14-day history)
  -> Waste Log
  -> Time Entries
  -> Invoices
  -> Quotations
  -> Discount Rules
  -> Extended Orders (analytics coverage)
```

**Commit:**
```bash
git add packages/db/src/seed.ts
git commit -m "feat: comprehensive mock data — production history, waste log, timeclock, invoices, quotations, discounts, 30-day orders"
```

---

## AGENT B: Quality of Life Enhancements

### Task 7: CSV Export Utility + Orders Page Export

Add a CSV download utility inline to each page (no shared file needed — keep it simple, each page gets a self-contained function).

**File:** `apps/web/src/routes/dashboard.orders.tsx`

Add this helper function before the component and add a download button:

```typescript
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = String(r[h] ?? "");
          return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

In the JSX, add a `Download` button next to the `<h1>Orders</h1>`:

```tsx
import { Download } from "lucide-react";
// ...
<div className="flex items-center gap-2">
  <h1 className="font-bold text-2xl">Orders</h1>
  <Button
    size="sm"
    variant="outline"
    className="ml-auto gap-1"
    onClick={() =>
      downloadCsv(
        `orders-${new Date().toISOString().slice(0, 10)}.csv`,
        orders.map((o) => ({
          Order: o.order_number,
          Status: o.status,
          Type: o.order_type,
          Total: o.total,
          Cashier: o.user_name ?? "",
          Customer: o.customer_name ?? "",
          Date: o.created_at,
        })),
      )
    }
  >
    <Download className="size-4" />
    Export
  </Button>
</div>
```

---

### Task 8: CSV Export on Expenses, Waste, and Timeclock Pages

**File:** `apps/web/src/routes/dashboard.expenses.tsx`

Add the same `downloadCsv` helper above the component. Then near the top of the JSX `<div className="flex items-center justify-between">`, add:

```tsx
<Button size="sm" variant="outline" className="gap-1" onClick={() =>
  downloadCsv(`expenses-${todayGY()}.csv`, expenses.map(e => ({
    Date: new Date(e.created_at).toLocaleDateString("en-GY"),
    Category: e.category,
    Description: e.description,
    Amount: e.amount,
    Supplier: e.supplier_name ?? "",
  })))
}>
  <Download className="size-4" />
  Export
</Button>
```

**File:** `apps/web/src/routes/dashboard.waste.tsx`

Add `downloadCsv` helper above the component. In the header section, add export button that downloads `logEntries`:

```tsx
<Button size="sm" variant="outline" className="gap-1" onClick={() =>
  downloadCsv(`waste-${todayGY()}.csv`, (logEntries as Array<{
    createdAt: string; productName: string; quantity: string; unit: string;
    estimatedCost: string; reason: string; userName: string | null;
  }>).map(e => ({
    Date: new Date(e.createdAt).toLocaleDateString("en-GY"),
    Item: e.productName,
    Qty: `${e.quantity} ${e.unit}`,
    Reason: e.reason,
    Cost: e.estimatedCost,
    LoggedBy: e.userName ?? "",
  })))
}>
  <Download className="size-4" />
  Export
</Button>
```

**File:** `apps/web/src/routes/dashboard.timeclock.tsx`

Find where `todayShifts` or `historyShifts` are displayed. Add export button in the Shift History tab panel:

The timeclock page queries `orpc.timeclock.getShifts`. Expose the raw shift data through a download:

```tsx
<Button size="sm" variant="outline" className="gap-1" onClick={() =>
  downloadCsv(`timeclock-${dateRange.start}-to-${dateRange.end}.csv`,
    (historyShifts ?? []).map((s: {
      user_name: string; clock_in: string; clock_out: string | null;
      break_minutes: string; duration_minutes: number;
    }) => ({
      Employee: s.user_name,
      ClockIn: new Date(s.clock_in).toLocaleString("en-GY"),
      ClockOut: s.clock_out ? new Date(s.clock_out).toLocaleString("en-GY") : "Active",
      Break: `${s.break_minutes}min`,
      Duration: `${Math.floor((s.duration_minutes ?? 0) / 60)}h ${(s.duration_minutes ?? 0) % 60}m`,
    })))
}>
  <Download className="size-4" />
  Export CSV
</Button>
```

---

### Task 9: Prev/Next Day Navigation on Production Report

**File:** `apps/web/src/routes/dashboard.production-report.tsx`

Replace the date `<Input>` with a date navigator:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";

// In the date control section, replace the plain Input with:
<div className="flex items-center gap-1">
  <Button
    size="icon"
    variant="outline"
    className="size-8"
    onClick={() => {
      const d = new Date(date);
      d.setDate(d.getDate() - 1);
      setDate(d.toISOString().split("T")[0]);
    }}
  >
    <ChevronLeft className="size-4" />
  </Button>
  <Input
    type="date"
    value={date}
    onChange={(e) => setDate(e.target.value)}
    className="w-36"
  />
  <Button
    size="icon"
    variant="outline"
    className="size-8"
    disabled={date >= todayGY()}
    onClick={() => {
      const d = new Date(date);
      d.setDate(d.getDate() + 1);
      setDate(d.toISOString().split("T")[0]);
    }}
  >
    <ChevronRight className="size-4" />
  </Button>
</div>
```

Also add a "Today" shortcut button:
```tsx
<Button
  size="sm"
  variant={date === todayGY() ? "default" : "outline"}
  onClick={() => setDate(todayGY())}
>
  Today
</Button>
```

---

### Task 10: Print Buttons on EOD + Production Report

**File:** `apps/web/src/routes/dashboard.eod.tsx`

The page already imports `Printer`. Find the existing `<Button>` with the Printer icon (it likely has `onClick={() => toast.info(...)}` or similar). Replace with:

```tsx
<Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
  <Printer className="size-4" />
  Print
</Button>
```

**File:** `apps/web/src/routes/dashboard.production-report.tsx`

Add a print button in the header next to the workflow toggle:

```tsx
import { Printer } from "lucide-react";
// ...
<Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
  <Printer className="size-4" />
  Print
</Button>
```

**File:** `apps/web/src/routes/dashboard.pnl.tsx`

Same pattern — the page already imports `Printer` and `Download`. Ensure the Printer button calls `window.print()`.

---

### Task 11: Commit QoL Changes and Deploy

```bash
git add apps/web/src/routes/dashboard.orders.tsx \
        apps/web/src/routes/dashboard.expenses.tsx \
        apps/web/src/routes/dashboard.waste.tsx \
        apps/web/src/routes/dashboard.timeclock.tsx \
        apps/web/src/routes/dashboard.production-report.tsx \
        apps/web/src/routes/dashboard.eod.tsx \
        apps/web/src/routes/dashboard.pnl.tsx
git commit -m "feat: QoL — CSV export on orders/expenses/waste/timeclock, prev/next day navigation, print buttons"
```

Then redeploy:
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
docker compose -f docker-compose.prod.yml up -d --build
```

After container is healthy, re-run seed against the live DB:
```bash
bun run db:seed
```

---

## Final Verification Checklist

| Page | Expected Result |
|------|----------------|
| Production Report | Shows 10+ items per day, navigate with ◀ ▶, varied balanced/short/over variances for past 14 days |
| Food Waste | KPIs populated, 30-day trend chart visible, waste by reason chart shows 5 categories |
| Timeclock | Shift History shows 14 days, 3 active entries today, Export CSV works |
| Invoices | 8 invoices: 3 paid, 1 partial, 1 sent, 1 overdue, 1 draft, 1 paid |
| Quotations | 5 quotations: sent, draft, accepted, declined, sent |
| Discounts | 8 discount rules with varied types and schedules |
| Orders | 40+ orders over 30 days, Export CSV button works |
| Analytics | Revenue trend chart shows 30 days of data |
| EOD Report | Print button works (opens browser print dialog) |
