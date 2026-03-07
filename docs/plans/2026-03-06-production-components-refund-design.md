# Design: Production Component Mapping + Refund Button
**Date:** 2026-03-06
**Status:** Approved — proceeding to implementation

---

## Background

Shakira's feedback (voice note + WhatsApp):
1. The Production Report should show individual production items (Rice, Baked Chicken, Cookup, etc.) separately — even though the POS sells them as combos ("Fried Rice and Baked Chicken" as one item). Staff track production physically by component ("we sent 20 baked chicken to the front, 25 portions of fried rice").
2. A Refund button is needed in the Orders dashboard for completed orders. The POS already has item deletion from cart before payment. Backend void/refund is already fully implemented.

---

## Feature 1: Production Component Mapping

### Schema
New table in `packages/db/src/schema/production.ts`:

```sql
product_production_component (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  quantity     DECIMAL(10,4) NOT NULL DEFAULT 1
)
-- index on product_id
```

### Production Component Mappings (Bettencourt's menu)

| POS Product | Component 1 | Component 2 |
|---|---|---|
| Fried Rice and Baked Chicken | Fried Rice | Baked Chicken |
| Raisin Rice with Pineapple Chicken | Raisin Rice | Pineapple Chicken |
| Vegetable Rice with Sweet and Sour Chicken | Veg Rice | Sweet & Sour Chicken |
| Chowmein/Baked Chicken | Chowmein | Baked Chicken |
| Chowmein/Fry Chicken | Chowmein | Fry Chicken |
| Caribbean Rice B/Chicken | Caribbean Rice | Baked Chicken |
| Caribbean Rice F/Chicken | Caribbean Rice | Fry Chicken |
| Cookup/Baked Chicken | Cookup | Baked Chicken |
| Mac Cheese W/ Baked Chick | Mac & Cheese | Baked Chicken |
| Cookup Baked Snapper | Cookup | Baked Snapper |
| Cookup Fry Snapper | Cookup | Fry Snapper |
| Anyrice / Curry Beef | Rice | Curry Beef |
| Cook Up BBQ | Cookup | BBQ Chicken |
| Cook-up Fc | Cookup | Fry Chicken |
| Curry Chicken | Curry Chicken | — |
| Curry Snapper | Curry Snapper | — |
| Veg. Chowmein | Veg Chowmein | — |
| Veg. Meal/Dholl | Veg Meal | Dholl |
| Veg. Rice | Veg Rice | — |
| Veggie Cookup | Veggie Cookup | — |
| Cup Dhal | Cup Dhal | — |

Single-component items track as-is (1:1 mapping by name).
Bakery/beverage items need no mapping — they're not in the production log.

### Backend Changes

**`productionRouter`** — two new procedures:
- `production.getComponents({ productId })` — list components for a product
- `production.setComponents({ productId, components: [{componentName, quantity}] })` — replace all components (delete + insert)

**`production.getReport`** — modify actual sold calculation:
1. Load component mappings for all sold products in one query
2. For each sold order line item: if product has components, distribute qty×component.quantity to each componentName; else attribute directly to productId/productName
3. Match production log entries against component names

### Frontend — Products Page
Add **"Production"** tab to the edit product dialog (alongside "Details" and "Recipe" tabs). Shows:
- List of current components (name + quantity + remove button)
- Add component form (text + number inputs)
- Save button
- Empty state: "No components — this product tracks as one unit in the report"

### Production Report
No UI changes needed. Automatically shows correct component breakdown once mappings are set.

---

## Feature 2: Refund Button in Orders Dashboard

### What's already built
- `refund` table ✅
- `ordersRouter.refund` procedure ✅ (marks order "refunded", creates negative payment record, audit logs)
- `ordersRouter.void` + Void button in OrdersTable ✅

### What's missing
Refund button in `OrdersTable` for completed orders.

### Design
Add a Refund button next to the Void button for `status === "completed"` orders. Opens an AlertDialog with:
- Order total pre-filled (read-only display)
- Optional partial amount input (defaults to full total)
- Required reason text input
- Calls `orpc.orders.refund` mutation on confirm

Order status changes to "refunded" and appears with outline badge (already styled).

---

## Implementation Order
1. Schema + migration (production_component table)
2. Backend: getComponents + setComponents procedures
3. Backend: modify getReport to expand through mappings
4. Frontend: Products page "Production" tab
5. Seed: production component mappings for all menu items
6. Frontend: Refund button in OrdersTable
7. Build, seed, deploy
