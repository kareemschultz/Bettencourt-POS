# Comprehensive Mock Data — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add fully correlated demo/mock data covering every scenario the POS supports — combos, modifiers, discounts, VAT, gift cards, loyalty redemption, stock alerts, USD payments — so any role can log in and see realistic, meaningful data across all 37 dashboard pages.

**Architecture:** All changes are additive inserts to `packages/db/src/seed.ts`. Each task adds one feature domain, keeps deterministic IDs (hex pattern `XX000000-0000-4000-8000-NNNNNNNNNNNN`), and uses `onConflictDoNothing()` so re-seeding is idempotent. New extended orders use `ORDER_EXT` e1–e20 slots (cleanup already wired). The cleanup DELETE block at the top of the seed already handles ORDER_EXT IDs.

**Tech Stack:** Bun, Drizzle ORM, PostgreSQL, TypeScript, `packages/db/src/seed.ts`

**Key existing IDs** (already defined in seed.ts — DO NOT redefine):
- `ORG_ID`, `LOC_ID`, `LOC_QUICK_SERVE`
- `REG.meals`, `REG.pastry`, `REG.beverage`, `REG.quickServe`
- `DEPT.*` (chicken, fish, beef, veggie, pastries, beverages, sides, localJuice, meatCookup, boxes, specials, snacks, duck, mutton)
- `PROD.*` (all ~30 products)
- `USER.*` (admin, bonita, cashier, production, anna, carl, renatta)
- `CUST(n)` helper → `ca000000-0000-4000-8000-{n padded}`
- `CLOY(n)` → customer_loyalty IDs; `LOYALTY_PROG` → loyalty program ID
- `ORDER_EXT.e1–e20` → f1000000-...-000000000015 through -000000000028
- `MGRP.*` (spiceLevel, proteinAddon, extras, cookStyle)
- `INV_ITEM.*` (chicken, rice, flour, oil, sugar, snapper, beef, coconut, onions, garlic, peppers, noodles, tamarind, softDrinks, water)
- `TABLE.*` (t1–t12)
- `daysAgo(n, hour)` helper

**Before starting:** Run `wc -l packages/db/src/seed.ts` to confirm line count (~8782). All new code goes BEFORE the final `console.log("Seed complete!")` line and `process.exit(0)`.

**After each task:** Run type check: `bunx tsc --project packages/db/tsconfig.json --noEmit 2>&1 | head -20`

---

## Task 1: Combo Products — comboProduct + comboComponent rows

**File:** `packages/db/src/seed.ts`

**Context:** The `comboProduct` table links a product to a combo record. The `comboComponent` table lists named components (with allocated prices) for each combo. A combo ordered at POS creates a parent line item (isComponent: false) plus one `orderLineItem` per component (isComponent: true) so revenue reports can split sales by department.

**Step 1: Add new COMBO ID constants** after the existing `const MGRP = {...}` block (around line 7986):

```typescript
// Combo product IDs
const COMBO = {
  familyMeal: "cb000000-0000-4000-8000-000000000001",
  duoSpecial: "cb000000-0000-4000-8000-000000000002",
  fishFriday: "cb000000-0000-4000-8000-000000000003",
} as const;

// comboProduct row IDs (the bridge table between product and combo)
const CPROD = {
  familyMeal: "cb100000-0000-4000-8000-000000000001",
  duoSpecial: "cb100000-0000-4000-8000-000000000002",
  fishFriday: "cb100000-0000-4000-8000-000000000003",
} as const;
```

**Step 2: Add 3 combo products** — these are new entries in the `product` table. Add this insert BEFORE the `comboProduct` inserts:

```typescript
console.log("  -> Combo Products");
// Insert the product records first
await db
  .insert(schema.product)
  .values([
    {
      id: COMBO.familyMeal,
      organizationId: ORG_ID,
      name: "Family Meal Deal",
      reportingName: "Family Meal Deal",
      reportingCategoryId: DEPT.specials,
      price: "8500",
      taxRate: "0",
      sortOrder: 1,
    },
    {
      id: COMBO.duoSpecial,
      organizationId: ORG_ID,
      name: "Duo Special",
      reportingName: "Duo Special",
      reportingCategoryId: DEPT.specials,
      price: "5500",
      taxRate: "0",
      sortOrder: 2,
    },
    {
      id: COMBO.fishFriday,
      organizationId: ORG_ID,
      name: "Fish Friday Combo",
      reportingName: "Fish Friday Combo",
      reportingCategoryId: DEPT.specials,
      price: "6000",
      taxRate: "0",
      sortOrder: 3,
    },
  ])
  .onConflictDoNothing();

// Create comboProduct bridge rows
await db
  .insert(schema.comboProduct)
  .values([
    { id: CPROD.familyMeal, productId: COMBO.familyMeal },
    { id: CPROD.duoSpecial, productId: COMBO.duoSpecial },
    { id: CPROD.fishFriday, productId: COMBO.fishFriday },
  ])
  .onConflictDoNothing();

// Create combo components (named sub-portions with allocated prices)
const CC = (n: number) =>
  `cb200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
await db
  .insert(schema.comboComponent)
  .values([
    // Family Meal Deal: 4 portions Fried Rice/B.Chicken + 2 Drinks + 2 Sponge Cake
    // Allocated: 6000 food + 1600 drinks + 900 pastry = 8500
    {
      id: CC(1),
      comboProductId: CPROD.familyMeal,
      componentName: "Fried Rice / Baked Chicken × 4",
      departmentId: DEPT.chicken,
      allocatedPrice: "6000",
    },
    {
      id: CC(2),
      comboProductId: CPROD.familyMeal,
      componentName: "1L Drink × 2",
      departmentId: DEPT.beverages,
      allocatedPrice: "1600",
    },
    {
      id: CC(3),
      comboProductId: CPROD.familyMeal,
      componentName: "Sponge Cake × 2",
      departmentId: DEPT.pastries,
      allocatedPrice: "900",
    },
    // Duo Special: 2 meals + 2 drinks
    // Allocated: 4400 food + 1100 drinks = 5500
    {
      id: CC(4),
      comboProductId: CPROD.duoSpecial,
      componentName: "Any Meal × 2",
      departmentId: DEPT.chicken,
      allocatedPrice: "4400",
    },
    {
      id: CC(5),
      comboProductId: CPROD.duoSpecial,
      componentName: "12oz Drink × 2",
      departmentId: DEPT.beverages,
      allocatedPrice: "1100",
    },
    // Fish Friday: 2 Fish meals + 2 drinks
    // Allocated: 4800 fish + 1200 drinks = 6000
    {
      id: CC(6),
      comboProductId: CPROD.fishFriday,
      componentName: "Cookup Fish × 2",
      departmentId: DEPT.fish,
      allocatedPrice: "4800",
    },
    {
      id: CC(7),
      comboProductId: CPROD.fishFriday,
      componentName: "1L Drink × 2",
      departmentId: DEPT.beverages,
      allocatedPrice: "1200",
    },
  ])
  .onConflictDoNothing();
```

**Step 3:** Run type check:
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bunx tsc --project packages/db/tsconfig.json --noEmit 2>&1 | head -30
```
Fix any errors (likely none — this is pure inserts).

**Step 4:** Commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add 3 combo products with components (Family Meal, Duo Special, Fish Friday)"
```

---

## Task 2: Orders Using Combos (isComponent: true line items)

**File:** `packages/db/src/seed.ts`

**Context:** When a combo is ordered, the POS creates one parent line item (the combo itself, `isComponent: false`) PLUS one child line item per component (`isComponent: true`). The child lines carry the allocated price. Reports exclude `isComponent: true` lines from revenue to avoid double-counting. The combo line item gets `unitPrice = combo.price`.

**Step 1:** Use ORDER_EXT slots e1, e2, e3 for three combo orders. Add these BEFORE the "Seed complete!" line:

```typescript
// ── Combo Order Examples ─────────────────────────────────────────────
console.log("  -> Orders with combo products");
const ELI = (n: number) =>
  `f6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Order e1: GT-024 — Family Meal Deal (daysAgo 2, table t3, completed)
await db
  .insert(schema.order)
  .values([
    {
      id: ORDER_EXT.e1,
      organizationId: ORG_ID,
      locationId: LOC_ID,
      registerId: REG.meals,
      userId: USER.cashier,
      customerId: CUST(3),          // Anita Ramsaroop — frequent customer
      orderNumber: "GT-024",
      type: "sale",
      status: "completed",
      subtotal: "8500",
      taxTotal: "0",
      total: "8500",
      createdAt: daysAgo(2, 12),
    },
    // Order e2: GT-025 — Duo Special + extra item
    {
      id: ORDER_EXT.e2,
      organizationId: ORG_ID,
      locationId: LOC_ID,
      registerId: REG.meals,
      userId: USER.admin,
      customerId: CUST(7),          // Sheila — Gold tier
      orderNumber: "GT-025",
      type: "sale",
      status: "completed",
      subtotal: "5500",
      taxTotal: "0",
      total: "5500",
      createdAt: daysAgo(1, 13),
    },
    // Order e3: GT-026 — Fish Friday (open/in-progress at table)
    {
      id: ORDER_EXT.e3,
      organizationId: ORG_ID,
      locationId: LOC_ID,
      registerId: REG.meals,
      userId: USER.cashier,
      orderNumber: "GT-026",
      type: "sale",
      status: "open",
      subtotal: "12000",
      taxTotal: "0",
      total: "12000",
      tableId: TABLE.t3,
      createdAt: daysAgo(0, 11),
    },
  ])
  .onConflictDoNothing();

// Line items for GT-024: Family Meal Deal
await db
  .insert(schema.orderLineItem)
  .values([
    // Parent combo line (isComponent: false)
    {
      id: ELI(1),
      orderId: ORDER_EXT.e1,
      productId: COMBO.familyMeal,
      productNameSnapshot: "Family Meal Deal",
      reportingCategorySnapshot: "Specials",
      quantity: 1,
      unitPrice: "8500",
      total: "8500",
      isComponent: false,
    },
    // Component lines (isComponent: true — excluded from revenue reports)
    {
      id: ELI(2),
      orderId: ORDER_EXT.e1,
      productId: PROD.friedRiceBakedChicken,
      productNameSnapshot: "Fried Rice / Baked Chicken × 4",
      reportingCategorySnapshot: "Chicken",
      quantity: 4,
      unitPrice: "1500",
      total: "6000",
      isComponent: true,
    },
    {
      id: ELI(3),
      orderId: ORDER_EXT.e1,
      productId: PROD.drink1Lt,
      productNameSnapshot: "1L Drink × 2",
      reportingCategorySnapshot: "Beverages",
      quantity: 2,
      unitPrice: "800",
      total: "1600",
      isComponent: true,
    },
    {
      id: ELI(4),
      orderId: ORDER_EXT.e1,
      productId: PROD.spongeCake,
      productNameSnapshot: "Sponge Cake × 2",
      reportingCategorySnapshot: "Pastries",
      quantity: 2,
      unitPrice: "450",
      total: "900",
      isComponent: true,
    },
  ])
  .onConflictDoNothing();

// Payment for GT-024
await db
  .insert(schema.payment)
  .values({
    orderId: ORDER_EXT.e1,
    method: "cash",
    amount: "8500",
    tendered: "10000",
    changeGiven: "1500",
    currency: "GYD",
    status: "completed",
  })
  .onConflictDoNothing();

// Line items for GT-025: Duo Special
await db
  .insert(schema.orderLineItem)
  .values([
    {
      id: ELI(10),
      orderId: ORDER_EXT.e2,
      productId: COMBO.duoSpecial,
      productNameSnapshot: "Duo Special",
      reportingCategorySnapshot: "Specials",
      quantity: 1,
      unitPrice: "5500",
      total: "5500",
      isComponent: false,
    },
    {
      id: ELI(11),
      orderId: ORDER_EXT.e2,
      productId: PROD.curryChicken,
      productNameSnapshot: "Any Meal × 2 (Curry Chicken)",
      reportingCategorySnapshot: "Chicken",
      quantity: 2,
      unitPrice: "2200",
      total: "4400",
      isComponent: true,
    },
    {
      id: ELI(12),
      orderId: ORDER_EXT.e2,
      productId: PROD.drink12oz,
      productNameSnapshot: "12oz Drink × 2",
      reportingCategorySnapshot: "Beverages",
      quantity: 2,
      unitPrice: "550",
      total: "1100",
      isComponent: true,
    },
  ])
  .onConflictDoNothing();

await db
  .insert(schema.payment)
  .values({
    orderId: ORDER_EXT.e2,
    method: "card",
    amount: "5500",
    tendered: "5500",
    changeGiven: "0",
    currency: "GYD",
    status: "completed",
  })
  .onConflictDoNothing();

// Line items for GT-026: 2× Fish Friday (open table order)
await db
  .insert(schema.orderLineItem)
  .values([
    {
      id: ELI(20),
      orderId: ORDER_EXT.e3,
      productId: COMBO.fishFriday,
      productNameSnapshot: "Fish Friday Combo",
      reportingCategorySnapshot: "Specials",
      quantity: 2,
      unitPrice: "6000",
      total: "12000",
      isComponent: false,
    },
    {
      id: ELI(21),
      orderId: ORDER_EXT.e3,
      productId: PROD.cookupBakedSnapper,
      productNameSnapshot: "Cookup Fish × 2",
      reportingCategorySnapshot: "Fish",
      quantity: 4,
      unitPrice: "2400",
      total: "9600",
      isComponent: true,
    },
    {
      id: ELI(22),
      orderId: ORDER_EXT.e3,
      productId: PROD.drink1Lt,
      productNameSnapshot: "1L Drink × 2",
      reportingCategorySnapshot: "Beverages",
      quantity: 4,
      unitPrice: "600",
      total: "2400",
      isComponent: true,
    },
  ])
  .onConflictDoNothing();
```

**Step 2:** Verify type check, then commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add 3 orders with combo line items (isComponent: true for components)"
```

---

## Task 3: Orders with modifiersSnapshot Populated

**File:** `packages/db/src/seed.ts`

**Context:** `modifiersSnapshot` is a JSONB column on `order_line_item`. It stores an array of applied modifiers: `[{ name: "Hot", price: "0" }, { name: "Extra Rice", price: "300" }]`. The `unitPrice` and `total` must already include the modifier prices. Modifier groups and modifiers already exist in the seed (MGRP.*).

**Step 1:** Add 2 orders with modifiers. Use ORDER_EXT slots e4, e5:

```typescript
// ── Orders with modifier selections ──────────────────────────────────
console.log("  -> Orders with modifiers");

await db
  .insert(schema.order)
  .values([
    {
      id: ORDER_EXT.e4,
      organizationId: ORG_ID,
      locationId: LOC_ID,
      registerId: REG.meals,
      userId: USER.cashier,
      customerId: CUST(1),           // Priya Singh
      orderNumber: "GT-027",
      type: "sale",
      status: "completed",
      // 1× Curry Chicken + Extra Rice (300) + 1× curryBeef + Hot modifier (free)
      subtotal: "4700",
      taxTotal: "0",
      total: "4700",
      createdAt: daysAgo(1, 12),
    },
    {
      id: ORDER_EXT.e5,
      organizationId: ORG_ID,
      locationId: LOC_ID,
      registerId: REG.meals,
      userId: USER.admin,
      orderNumber: "GT-028",
      type: "sale",
      status: "completed",
      // 2× Chowmein/Baked Chicken + Extra Chicken (500 each) = 2×2700
      subtotal: "5400",
      taxTotal: "0",
      total: "5400",
      createdAt: daysAgo(0, 13),
    },
  ])
  .onConflictDoNothing();

await db
  .insert(schema.orderLineItem)
  .values([
    // GT-027: Curry Chicken — Spice: Hot (free), Extras: Extra Rice (+300)
    {
      id: ELI(30),
      orderId: ORDER_EXT.e4,
      productId: PROD.curryChicken,
      productNameSnapshot: "Curry Chicken",
      reportingCategorySnapshot: "Chicken",
      quantity: 1,
      unitPrice: "2300",              // 2000 base + 300 Extra Rice
      total: "2300",
      modifiersSnapshot: [
        { name: "Hot", price: "0" },
        { name: "Extra Rice", price: "300" },
      ],
    },
    // GT-027: Curry Beef — Spice: Medium (free)
    {
      id: ELI(31),
      orderId: ORDER_EXT.e4,
      productId: PROD.curryBeef,
      productNameSnapshot: "Anyrice / Curry Beef",
      reportingCategorySnapshot: "Beef",
      quantity: 1,
      unitPrice: "2400",
      total: "2400",
      modifiersSnapshot: [
        { name: "Medium", price: "0" },
      ],
    },
    // GT-028: Chowmein/Baked Chicken — Extras: Extra Chicken (+500 each)
    {
      id: ELI(32),
      orderId: ORDER_EXT.e5,
      productId: PROD.chowmeinBakedChicken,
      productNameSnapshot: "Chowmein/Baked Chicken",
      reportingCategorySnapshot: "Chicken",
      quantity: 2,
      unitPrice: "2700",              // 2200 base + 500 Extra Chicken
      total: "5400",
      modifiersSnapshot: [
        { name: "Extra Chicken", price: "500" },
      ],
    },
  ])
  .onConflictDoNothing();

await db
  .insert(schema.payment)
  .values([
    {
      orderId: ORDER_EXT.e4,
      method: "cash",
      amount: "4700",
      tendered: "5000",
      changeGiven: "300",
      currency: "GYD",
      status: "completed",
    },
    {
      orderId: ORDER_EXT.e5,
      method: "card",
      amount: "5400",
      tendered: "5400",
      changeGiven: "0",
      currency: "GYD",
      status: "completed",
    },
  ])
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add orders with modifiersSnapshot populated (spice, extras)"
```

---

## Task 4: Order with Discount Applied + Order with VAT (taxTotal > 0)

**File:** `packages/db/src/seed.ts`

**Context:** The `discountTotal` field on `order` holds the total discount applied. Beverages have `taxRate: 0.16` (set by seed). When an order includes beverages, `taxTotal` should reflect 16% on the beverage subtotal. Currently ALL orders have `taxTotal: 0` — even the beverage-only order (GT-012). This task adds both scenarios.

**Step 1:** Use ORDER_EXT slots e6 (discount), e7 (VAT-inclusive beverage order):

```typescript
// ── Discount order + VAT order ────────────────────────────────────────
console.log("  -> Discount order + VAT beverage order");

await db
  .insert(schema.order)
  .values([
    {
      id: ORDER_EXT.e6,
      organizationId: ORG_ID,
      locationId: LOC_ID,
      registerId: REG.meals,
      userId: USER.cashier,
      customerId: CUST(4),          // Khalid Khan
      orderNumber: "GT-029",
      type: "sale",
      status: "completed",
      // 2× Curry Chicken = 4000 - 10% discount = 400 off = 3600
      subtotal: "4000",
      discountTotal: "400",
      taxTotal: "0",
      total: "3600",
      notes: "Staff & family discount applied",
      createdAt: daysAgo(1, 14),
    },
    {
      id: ORDER_EXT.e7,
      organizationId: ORG_ID,
      locationId: LOC_ID,
      registerId: REG.beverage,
      userId: USER.cashier,
      orderNumber: "GT-030",
      type: "sale",
      status: "completed",
      // 4× 1Lt Drink (600 each) = 2400 subtotal; VAT 16% = 384; total = 2784
      subtotal: "2400",
      taxTotal: "384",
      total: "2784",
      notes: "VAT applied to packaged beverages",
      createdAt: daysAgo(0, 10),
    },
  ])
  .onConflictDoNothing();

await db
  .insert(schema.orderLineItem)
  .values([
    // GT-029: Discounted order
    {
      id: ELI(40),
      orderId: ORDER_EXT.e6,
      productId: PROD.curryChicken,
      productNameSnapshot: "Curry Chicken",
      reportingCategorySnapshot: "Chicken",
      quantity: 2,
      unitPrice: "2000",
      discount: "400",               // 10% off 2×2000
      total: "3600",
    },
    // GT-030: VAT order — beverages
    {
      id: ELI(41),
      orderId: ORDER_EXT.e7,
      productId: PROD.drink1Lt,
      productNameSnapshot: "1 Lt Drink",
      reportingCategorySnapshot: "Beverages",
      quantity: 4,
      unitPrice: "600",
      tax: "384",                    // 16% VAT on 2400
      total: "2784",
    },
  ])
  .onConflictDoNothing();

await db
  .insert(schema.payment)
  .values([
    {
      orderId: ORDER_EXT.e6,
      method: "cash",
      amount: "3600",
      tendered: "4000",
      changeGiven: "400",
      currency: "GYD",
      status: "completed",
    },
    {
      orderId: ORDER_EXT.e7,
      method: "cash",
      amount: "2784",
      tendered: "3000",
      changeGiven: "216",
      currency: "GYD",
      status: "completed",
    },
  ])
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add discount order (GT-029) and VAT beverage order (GT-030)"
```

---

## Task 5: USD/FX Payment Order

**File:** `packages/db/src/seed.ts`

**Context:** The `payment` table has `currency`, `exchangeRate`, `amount` (in GYD), and `tendered` (in the foreign currency). A USD payment stores `currency: "USD"`, `exchangeRate` = GYD/USD rate (approx 210), and `amount` in GYD (the ledger currency), while `tendered` is in USD. This is a real scenario at Bettencourt's since tourists pay in USD.

**Step 1:** Use ORDER_EXT slot e8:

```typescript
// ── USD/FX Payment order ──────────────────────────────────────────────
console.log("  -> USD foreign exchange payment order");

await db
  .insert(schema.order)
  .values({
    id: ORDER_EXT.e8,
    organizationId: ORG_ID,
    locationId: LOC_ID,
    registerId: REG.meals,
    userId: USER.cashier,
    customerName: "Tourist (USD)",
    orderNumber: "GT-031",
    type: "sale",
    status: "completed",
    // 1× Family Meal Deal = 8500 GYD; paid ~$41 USD @ 210 rate
    subtotal: "8500",
    taxTotal: "0",
    total: "8500",
    notes: "Paid in USD @ 210 GYD/USD",
    createdAt: daysAgo(3, 13),
  })
  .onConflictDoNothing();

await db
  .insert(schema.orderLineItem)
  .values([
    {
      id: ELI(50),
      orderId: ORDER_EXT.e8,
      productId: COMBO.familyMeal,
      productNameSnapshot: "Family Meal Deal",
      reportingCategorySnapshot: "Specials",
      quantity: 1,
      unitPrice: "8500",
      total: "8500",
      isComponent: false,
    },
    {
      id: ELI(51),
      orderId: ORDER_EXT.e8,
      productId: PROD.friedRiceBakedChicken,
      productNameSnapshot: "Fried Rice / Baked Chicken × 4",
      reportingCategorySnapshot: "Chicken",
      quantity: 4,
      unitPrice: "1500",
      total: "6000",
      isComponent: true,
    },
    {
      id: ELI(52),
      orderId: ORDER_EXT.e8,
      productId: PROD.drink1Lt,
      productNameSnapshot: "1L Drink × 2",
      reportingCategorySnapshot: "Beverages",
      quantity: 2,
      unitPrice: "800",
      total: "1600",
      isComponent: true,
    },
    {
      id: ELI(53),
      orderId: ORDER_EXT.e8,
      productId: PROD.spongeCake,
      productNameSnapshot: "Sponge Cake × 2",
      reportingCategorySnapshot: "Pastries",
      quantity: 2,
      unitPrice: "450",
      total: "900",
      isComponent: true,
    },
  ])
  .onConflictDoNothing();

// USD payment: tendered = 45 USD, amount = 45×210 = 9450 GYD, change = 950 GYD
await db
  .insert(schema.payment)
  .values({
    orderId: ORDER_EXT.e8,
    method: "cash",
    amount: "8500",                 // ledger amount in GYD
    tendered: "45",                 // tendered in USD
    changeGiven: "950",             // change in GYD (9450 - 8500)
    currency: "USD",
    exchangeRate: "210.0000",
    status: "completed",
  })
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add GT-031 USD/FX payment example"
```

---

## Task 6: Loyalty Redemption Order + loyaltyTransaction redeem record

**File:** `packages/db/src/seed.ts`

**Context:** A loyalty redemption: a customer uses accumulated points for a discount. The `discountTotal` on the order equals the redeemed value (1 point = $1 GYD). A `loyaltyTransaction` row of `type: "redeem"` logs it. The customer's `currentPoints` in `customerLoyalty` should be reduced accordingly.

**Step 1:** Use ORDER_EXT slot e9. Customer: Sheila (CUST(7)) — she has Gold status (2000+ points):

```typescript
// ── Loyalty Redemption order ──────────────────────────────────────────
console.log("  -> Loyalty redemption order");
const CLOY_7 = "1c000000-0000-4000-8000-000000000007"; // Sheila's loyalty ID

await db
  .insert(schema.order)
  .values({
    id: ORDER_EXT.e9,
    organizationId: ORG_ID,
    locationId: LOC_ID,
    registerId: REG.meals,
    userId: USER.cashier,
    customerId: CUST(7),            // Sheila Bacchus — Gold member
    orderNumber: "GT-032",
    type: "sale",
    status: "completed",
    // 3× Fried Rice/Baked Chicken = 6600 - 500 pts redeemed = 6100
    subtotal: "6600",
    discountTotal: "500",
    taxTotal: "0",
    total: "6100",
    notes: "500 loyalty points redeemed",
    createdAt: daysAgo(0, 12),
  })
  .onConflictDoNothing();

await db
  .insert(schema.orderLineItem)
  .values({
    id: ELI(60),
    orderId: ORDER_EXT.e9,
    productId: PROD.friedRiceBakedChicken,
    productNameSnapshot: "Fried Rice and Baked Chicken",
    reportingCategorySnapshot: "Chicken",
    quantity: 3,
    unitPrice: "2200",
    discount: "500",                // loyalty discount
    total: "6100",
  })
  .onConflictDoNothing();

await db
  .insert(schema.payment)
  .values({
    orderId: ORDER_EXT.e9,
    method: "cash",
    amount: "6100",
    tendered: "6500",
    changeGiven: "400",
    currency: "GYD",
    status: "completed",
  })
  .onConflictDoNothing();

// Loyalty transaction: redeem 500 points
const LTXN = (n: number) =>
  `1d000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
await db
  .insert(schema.loyaltyTransaction)
  .values({
    id: LTXN(100),
    customerLoyaltyId: CLOY_7,
    orderId: ORDER_EXT.e9,
    type: "redeem",
    points: -500,
    description: "Redeemed 500 pts for GYD$500 discount on GT-032",
  })
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add loyalty redemption order GT-032 and loyaltyTransaction redeem record"
```

---

## Task 7: Gift Cards (3 cards with transactions)

**File:** `packages/db/src/seed.ts`

**Context:** `giftCard` has `code` (alphanumeric), `initialBalance`, `currentBalance`, `customerId` (optional). `giftCardTransaction` has `type: "purchase" | "reload" | "redeem" | "refund"`. Show 3 scenarios: active with full balance, partially used, and fully redeemed.

**Step 1:**

```typescript
// ── Gift Cards ────────────────────────────────────────────────────────
console.log("  -> Gift Cards");
const GC = (n: number) =>
  `gc000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const GCT = (n: number) =>
  `gd000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

await db
  .insert(schema.giftCard)
  .values([
    {
      id: GC(1),
      organizationId: ORG_ID,
      code: "BETT-2024-GIFT",
      initialBalance: "5000",
      currentBalance: "5000",       // Untouched — full balance
      purchasedBy: "Marcus De Souza",
      customerId: CUST(10),
      isActive: true,
    },
    {
      id: GC(2),
      organizationId: ORG_ID,
      code: "BETT-PRIYA-500",
      initialBalance: "10000",
      currentBalance: "3400",       // Partially used (6600 spent)
      customerId: CUST(1),          // Priya Singh's gift card
      purchasedBy: "Priya Singh",
      isActive: true,
    },
    {
      id: GC(3),
      organizationId: ORG_ID,
      code: "BETT-XMAS-2024",
      initialBalance: "2500",
      currentBalance: "0",          // Fully redeemed
      isActive: false,
      purchasedBy: "Office Group",
    },
  ])
  .onConflictDoNothing();

await db
  .insert(schema.giftCardTransaction)
  .values([
    // GC(1): Initial purchase
    {
      id: GCT(1),
      giftCardId: GC(1),
      type: "purchase",
      amount: "5000",
      balanceAfter: "5000",
      processedBy: USER.cashier,
    },
    // GC(2): Initial purchase + 2 redemptions
    {
      id: GCT(2),
      giftCardId: GC(2),
      type: "purchase",
      amount: "10000",
      balanceAfter: "10000",
      processedBy: USER.cashier,
    },
    {
      id: GCT(3),
      giftCardId: GC(2),
      orderId: ORDER.o3,             // linked to GT-003
      type: "redeem",
      amount: "4400",
      balanceAfter: "5600",
      processedBy: USER.cashier,
    },
    {
      id: GCT(4),
      giftCardId: GC(2),
      orderId: ORDER.o10,            // linked to GT-010
      type: "redeem",
      amount: "2200",
      balanceAfter: "3400",
      processedBy: USER.admin,
    },
    // GC(3): Purchase + full redemption
    {
      id: GCT(5),
      giftCardId: GC(3),
      type: "purchase",
      amount: "2500",
      balanceAfter: "2500",
      processedBy: USER.cashier,
    },
    {
      id: GCT(6),
      giftCardId: GC(3),
      type: "redeem",
      amount: "2500",
      balanceAfter: "0",
      processedBy: USER.cashier,
    },
  ])
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add 3 gift cards with purchase/redeem transaction history"
```

---

## Task 8: Stock Alerts (low-stock scenarios)

**File:** `packages/db/src/seed.ts`

**Context:** `stockAlert` has `inventoryItemId`, `type` (`low_stock` | `out_of_stock`), and optional `acknowledgedBy`/`acknowledgedAt`. These appear in the Inventory dashboard's alert section. Add 3 alerts: one acknowledged (old), one unacknowledged low-stock, one unacknowledged out-of-stock.

**Also:** Update the stock level for 2 items to be at or below reorder point so the alerts make sense visually:

```typescript
// ── Stock Alerts ──────────────────────────────────────────────────────
console.log("  -> Stock Alerts");
const SA = (n: number) =>
  `sa000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// First set snapper stock to below reorder point (30) to make alert realistic
await db
  .update(schema.inventoryStock)
  .set({ quantityOnHand: "8" })
  .where(
    sql`inventory_item_id = ${INV_ITEM.snapper} AND location_id = ${LOC_ID}`,
  );
// Set beef to 0 for out-of-stock alert
await db
  .update(schema.inventoryStock)
  .set({ quantityOnHand: "0" })
  .where(
    sql`inventory_item_id = ${INV_ITEM.beef} AND location_id = ${LOC_ID}`,
  );

await db
  .insert(schema.stockAlert)
  .values([
    // Acknowledged old alert (peppers went low, was fixed)
    {
      id: SA(1),
      organizationId: ORG_ID,
      inventoryItemId: INV_ITEM.peppers,
      type: "low_stock",
      acknowledgedBy: USER.admin,
      acknowledgedAt: daysAgo(3, 9),
    },
    // Active: Red Snapper below reorder point (8 lbs, reorder at 30)
    {
      id: SA(2),
      organizationId: ORG_ID,
      inventoryItemId: INV_ITEM.snapper,
      type: "low_stock",
    },
    // Active: Stewing Beef out of stock
    {
      id: SA(3),
      organizationId: ORG_ID,
      inventoryItemId: INV_ITEM.beef,
      type: "out_of_stock",
    },
  ])
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add stock alerts (low_stock for snapper, out_of_stock for beef)"
```

---

## Task 9: Recipe Ingredients (link products to inventory)

**File:** `packages/db/src/seed.ts`

**Context:** `recipeIngredient` links a product to one or more `inventoryItem` rows with quantity and unit. This enables cost tracking and automated stock deduction reporting. Add ingredients for the top 5 products.

```typescript
// ── Recipe Ingredients ────────────────────────────────────────────────
console.log("  -> Recipe Ingredients");
const RI = (n: number) =>
  `ri000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

await db
  .insert(schema.recipeIngredient)
  .values([
    // Fried Rice / Baked Chicken: chicken (0.5 lb) + rice (0.3 lb) + oil (0.05 gal)
    { id: RI(1), productId: PROD.friedRiceBakedChicken, inventoryItemId: INV_ITEM.chicken, quantity: "0.5", unit: "lb" },
    { id: RI(2), productId: PROD.friedRiceBakedChicken, inventoryItemId: INV_ITEM.rice, quantity: "0.3", unit: "lb" },
    { id: RI(3), productId: PROD.friedRiceBakedChicken, inventoryItemId: INV_ITEM.oil, quantity: "0.05", unit: "gal" },
    // Cookup / Baked Chicken: chicken (0.5 lb) + rice (0.25 lb) + onions (0.1 lb)
    { id: RI(4), productId: PROD.cookupBakedChicken, inventoryItemId: INV_ITEM.chicken, quantity: "0.5", unit: "lb" },
    { id: RI(5), productId: PROD.cookupBakedChicken, inventoryItemId: INV_ITEM.rice, quantity: "0.25", unit: "lb" },
    { id: RI(6), productId: PROD.cookupBakedChicken, inventoryItemId: INV_ITEM.onions, quantity: "0.1", unit: "lb" },
    // Curry Chicken: chicken (0.5 lb) + garlic (0.05 lb) + peppers (0.03 lb)
    { id: RI(7), productId: PROD.curryChicken, inventoryItemId: INV_ITEM.chicken, quantity: "0.5", unit: "lb" },
    { id: RI(8), productId: PROD.curryChicken, inventoryItemId: INV_ITEM.garlic, quantity: "0.05", unit: "lb" },
    { id: RI(9), productId: PROD.curryChicken, inventoryItemId: INV_ITEM.peppers, quantity: "0.03", unit: "lb" },
    // Cookup Baked Snapper: snapper (0.6 lb) + rice (0.25 lb) + onions (0.1 lb)
    { id: RI(10), productId: PROD.cookupBakedSnapper, inventoryItemId: INV_ITEM.snapper, quantity: "0.6", unit: "lb" },
    { id: RI(11), productId: PROD.cookupBakedSnapper, inventoryItemId: INV_ITEM.rice, quantity: "0.25", unit: "lb" },
    { id: RI(12), productId: PROD.cookupBakedSnapper, inventoryItemId: INV_ITEM.onions, quantity: "0.1", unit: "lb" },
    // Sponge Cake: flour (0.5 lb) + sugar (0.3 lb) + coconut (0.5 each) + oil (0.02 gal)
    { id: RI(13), productId: PROD.spongeCake, inventoryItemId: INV_ITEM.flour, quantity: "0.5", unit: "lb" },
    { id: RI(14), productId: PROD.spongeCake, inventoryItemId: INV_ITEM.sugar, quantity: "0.3", unit: "lb" },
    { id: RI(15), productId: PROD.spongeCake, inventoryItemId: INV_ITEM.coconut, quantity: "0.5", unit: "each" },
    // Chowmein/Baked Chicken: noodles + chicken + oil
    { id: RI(16), productId: PROD.chowmeinBakedChicken, inventoryItemId: INV_ITEM.noodles, quantity: "0.3", unit: "lb" },
    { id: RI(17), productId: PROD.chowmeinBakedChicken, inventoryItemId: INV_ITEM.chicken, quantity: "0.5", unit: "lb" },
    { id: RI(18), productId: PROD.chowmeinBakedChicken, inventoryItemId: INV_ITEM.oil, quantity: "0.04", unit: "gal" },
    // Tamarind Juice: tamarind + sugar + water
    { id: RI(19), productId: PROD.tamarindJuice, inventoryItemId: INV_ITEM.tamarind, quantity: "0.2", unit: "lb" },
    { id: RI(20), productId: PROD.tamarindJuice, inventoryItemId: INV_ITEM.sugar, quantity: "0.1", unit: "lb" },
  ])
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add recipe ingredients linking 7 products to inventory items"
```

---

## Task 10: Menu Schedule + Product Barcodes

**File:** `packages/db/src/seed.ts`

**Context:** `menuSchedule` defines time windows (e.g., Lunch Menu Mon–Fri 11am–2pm) that can override product availability or prices. `menuScheduleProduct` links products to schedules with optional `overridePrice`. `productBarcode` stores barcodes for scanning.

```typescript
// ── Menu Schedule ─────────────────────────────────────────────────────
console.log("  -> Menu Schedule");
const MS_ID = "ms000000-0000-4000-8000-000000000001";
await db
  .insert(schema.menuSchedule)
  .values({
    id: MS_ID,
    organizationId: ORG_ID,
    name: "Lunch Special (Mon–Fri 11am–2pm)",
    startTime: "11:00",
    endTime: "14:00",
    daysOfWeek: "1,2,3,4,5",      // Mon–Fri
    isActive: true,
  })
  .onConflictDoNothing();

// Link 3 products with lunch override prices (slight discount)
await db
  .insert(schema.menuScheduleProduct)
  .values([
    {
      menuScheduleId: MS_ID,
      productId: PROD.friedRiceBakedChicken,
      overridePrice: "2000",       // normally 2200
    },
    {
      menuScheduleId: MS_ID,
      productId: PROD.curryChicken,
      overridePrice: "1800",       // normally 2000
    },
    {
      menuScheduleId: MS_ID,
      productId: PROD.vegChowmein,
      overridePrice: "1300",       // normally 1500
    },
  ])
  .onConflictDoNothing();

// ── Product Barcodes ──────────────────────────────────────────────────
console.log("  -> Product Barcodes");
const PBC = (n: number) =>
  `bc000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

await db
  .insert(schema.productBarcode)
  .values([
    { id: PBC(1), productId: PROD.drink1Lt, barcode: "6009601200019", format: "ean13", isPrimary: true },
    { id: PBC(2), productId: PROD.drink12oz, barcode: "6009601200026", format: "ean13", isPrimary: true },
    { id: PBC(3), productId: PROD.coke, barcode: "5449000000996", format: "ean13", isPrimary: true },
    { id: PBC(4), productId: PROD.water, barcode: "6001007906020", format: "ean13", isPrimary: true },
    { id: PBC(5), productId: PROD.vitaMalt, barcode: "5010112116200", format: "ean13", isPrimary: true },
    { id: PBC(6), productId: PROD.xlEnergy, barcode: "6009601200033", format: "ean13", isPrimary: true },
  ])
  .onConflictDoNothing();
```

**Step 2:** Type check + commit:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add lunch menu schedule with price overrides + product barcodes"
```

---

## Task 11: Clean Up Cleanup Section + Final Verification

**File:** `packages/db/src/seed.ts`

**Context:** The seed's cleanup section at line ~1836 deletes stale transactional data before re-seeding. It uses prefix-pattern DELETEs. The new combo orders use ORDER_EXT IDs (already cleaned). The new ELI() IDs use prefix `f6000000` — this must be added to cleanup so re-seeding doesn't accumulate duplicates. The GC/GCT/SA/RI/CC rows are static (onConflictDoNothing is enough — no cleanup needed since they don't have timestamps to "go stale").

**Step 1:** Find the cleanup block (around line 1840–1886). Add after the existing `DELETE FROM order_line_item` line:

```typescript
// Clean new ELI f6000000 combo order line items
await db.execute(
  sql`DELETE FROM order_line_item WHERE id::text LIKE 'f6000000%'`,
);
```

And before the `ORDER_EXT` order deletes, ensure the ELI f6000000 lines are deleted first (children before parents).

**Step 2:** Full type check across all packages:
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun run check-types 2>&1 | tail -10
```
Expected: `4 successful, 4 total` — zero errors.

**Step 3:** Apply seed to the running database:
```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
bun --cwd packages/db run db:seed 2>&1
```
Watch for any errors. If a table doesn't exist (relation missing), run `bun --cwd packages/db run db:push` first.

**Step 4:** Rebuild Docker with the new seed data baked in:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**Step 5:** Verify health:
```bash
sleep 8 && curl -sf https://pos.karetechsolutions.com/health
```

**Step 6:** Commit the cleanup fix + push:
```bash
git add packages/db/src/seed.ts
git commit -m "seed: add f6000000 cleanup to re-seed cleanup block"
git push origin master
```

---

## Summary of What Each Demo Scenario Proves

| Scenario | Order | Table populated |
|---|---|---|
| Combo meal ordered | GT-024, GT-025, GT-026 | `combo_product`, `combo_component`, `order_line_item.is_component` |
| Modifier applied | GT-027, GT-028 | `order_line_item.modifiers_snapshot` |
| Discount order | GT-029 | `order.discount_total`, `order_line_item.discount` |
| VAT/tax applied | GT-030 | `order.tax_total`, `order_line_item.tax` |
| USD payment | GT-031 | `payment.currency=USD`, `payment.exchange_rate` |
| Loyalty redemption | GT-032 | `loyalty_transaction.type=redeem`, `order.discount_total` |
| Gift cards | BETT-2024-GIFT etc. | `gift_card`, `gift_card_transaction` |
| Stock alerts | Snapper + Beef | `stock_alert` |
| Recipe costs | 7 products | `recipe_ingredient` |
| Lunch schedule | Weekdays 11–2 | `menu_schedule`, `menu_schedule_product` |
| Barcodes | 6 beverages | `product_barcode` |
