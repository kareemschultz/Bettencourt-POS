# Bettencourt POS — Plan #2: Feature Build-Out Design

**Date:** 2026-03-05
**Approach:** Balanced Waves — each wave delivers both operational + revenue value
**Status:** IN PROGRESS

## Research Sources

Feature gap analysis from top 10 commercial POS systems (Square, Toast, Clover, Lightspeed, Shopify POS, Revel, Aloha, Heartland, SpotOn, TouchBistro) and top open-source POS systems (Odoo POS, UniCenta, Floreant, JEPOS, Chromis POS, Open Source Point of Sale).

- [Square Loyalty Program](https://squareup.com/us/en/software/loyalty) — points by visits/spend/items, multi-tier rewards, digital wallet pass, SMS notifications
- [Toast Auto-Apply Discounts](https://doc.toasttab.com/doc/platformguide/adminAutoApplyDiscounts.html) — time-window discounts, BOGO, auto-apply rules, min/max constraints
- [Square Shifts](https://squareup.com/us/en/staff/shifts) — clock in/out from POS, break tracking, overtime alerts, payroll export
- [SpotOn Gift Cards](https://www.spoton.com/solutions/gift-cards/) — sell/reload/redeem, digital + physical, balance tracking, no transaction fees
- [Square Split Check](https://squareup.com/help/us/en/article/8165-split-a-payment-and-check-with-square-for-restaurants) — by item, by seat, equal split, shared items
- [Square Online Ordering](https://squareup.com/us/en/online-ordering) — web ordering, pickup/delivery, kitchen printer integration
- USD/GYD exchange rate ~209.21 (stable), multi-currency common in Guyana businesses

## What Already Exists

- 49 database tables, 14 API routers, 15 frontend routes
- Full POS checkout (cart, payment, receipts with change calc)
- Products with departments, modifiers, barcodes, combos (schema)
- Inventory (stock levels, POs, transfers, stock counts)
- Cash sessions (open/close, drops, payouts, variance)
- Kitchen display with SSE real-time updates
- Production tracking (opening/reorder/closing)
- Reports (8 types), reconciliation, audit logs
- Auth with roles/permissions schema (enforcement partial)
- `taxRate` table (2 rates seeded, no UI)
- `order.discountTotal` field, manual discount dialog in POS
- `order.customerName/customerPhone` fields (no customer DB)

---

# WAVE 1: Quick Wins + Foundation

## 1.1 Tax Configuration UI

**Goal:** Let managers configure tax rates from the Settings page instead of requiring DB edits.

**Schema:** Already exists — `taxRate` table with `id`, `name`, `rate`, `isDefault`, `isInclusive`, `organizationId`.

**API:** New procedures in `settings.ts` router:
- `settings.getTaxRates` — list all tax rates for org
- `settings.createTaxRate` — create new rate (validate 0-100%)
- `settings.updateTaxRate` — update rate (auto-unset other defaults if marking as default)
- `settings.deleteTaxRate` — soft-check: reject if any products reference this rate

**Frontend:** New "Tax Rates" section in `dashboard.settings.tsx`:
- Table: Name | Rate % | Inclusive? | Default? | Actions (edit/delete)
- Add/Edit dialog with fields: name (text), rate (number 0-100), isInclusive (switch), isDefault (switch)
- Validation: name required, rate 0-100, only one default allowed
- Preview text: "A $1,000 item → $1,140 total" or "$1,000 (tax included: $123)"

**Files to create/modify:**
- `packages/api/src/routers/settings.ts` — add 4 procedures
- `apps/web/src/routes/dashboard.settings.tsx` — add TaxRatesSection component

---

## 1.2 Receipt Customization

**Goal:** Let managers customize receipt header, footer, and promo messages from Settings.

**Schema:** New table `receipt_config`:
```
receipt_config:
  id              uuid PK
  organizationId  uuid FK → organization (unique — one per org)
  businessName    text NOT NULL default "Bettencourt's Food Inc."
  tagline         text default "'A True Guyanese Gem'"
  addressLine1    text
  addressLine2    text
  phone           text
  footerMessage   text default "Thank you for choosing Bettencourt's!"
  promoMessage    text (nullable — shows below footer if set)
  showLogo        boolean default true
  createdAt       timestamp
  updatedAt       timestamp
```

**API:** New procedures in `settings.ts`:
- `settings.getReceiptConfig` — get org's receipt config (or return defaults)
- `settings.updateReceiptConfig` — upsert receipt config

**Frontend:** New "Receipt" section in `dashboard.settings.tsx`:
- Left side: form fields (business name, tagline, address, phone, footer, promo)
- Right side: live receipt preview (reuse `receipt-preview.tsx` structure)
- Save button with optimistic update

**Modify `receipt-preview.tsx`:**
- Accept optional `receiptConfig` prop
- Fall back to hardcoded values if not provided (backwards compatible)
- POS checkout fetches receipt config once and passes to preview

**Files to create/modify:**
- `packages/db/src/schema/organization.ts` — add `receiptConfig` table
- `packages/api/src/routers/settings.ts` — add 2 procedures
- `apps/web/src/routes/dashboard.settings.tsx` — add ReceiptConfigSection
- `apps/web/src/components/pos/receipt-preview.tsx` — accept config prop
- `apps/web/src/components/pos/pos-terminal.tsx` — fetch receipt config

---

## 1.3 Employee Time Clock

**Goal:** Employees clock in/out from the POS. Managers see hours, overtime, and can export for payroll.

**Schema:** New table `time_entry`:
```
time_entry:
  id              uuid PK
  userId          text FK → user
  locationId      uuid FK → location
  clockIn         timestamp NOT NULL
  clockOut        timestamp (nullable — null = currently clocked in)
  breakMinutes    integer default 0
  notes           text
  status          text default 'active' (active | completed | edited)
  editedBy        text FK → user (nullable — set if manager edits)
  organizationId  uuid FK → organization
  createdAt       timestamp
  updatedAt       timestamp
```

**API:** New router `timeclock.ts`:
- `timeclock.clockIn` — create entry with clockIn=now, validate no active shift
- `timeclock.clockOut` — set clockOut=now on active entry, calc duration
- `timeclock.getActiveShift` — get user's current active entry (if any)
- `timeclock.getShifts` — list shifts by date range, optional userId filter
- `timeclock.editEntry` — manager-only: edit clockIn/clockOut/breakMinutes, sets editedBy
- `timeclock.getSummary` — aggregate: total hours, overtime, by employee for date range

**Frontend:** New route `dashboard.timeclock.tsx`:
- **Employee view:** Large clock in/out button (color changes: green=clock in, red=clock out), current shift timer, break button
- **Manager view:** Table of today's shifts (employee, clock in, clock out, duration, status), weekly summary tab, edit capability
- **Sidebar:** Add "Time Clock" nav item with clock icon, visible to all roles

**Files to create/modify:**
- `packages/db/src/schema/organization.ts` — add `timeEntry` table
- `packages/api/src/routers/timeclock.ts` — new router (6 procedures)
- `packages/api/src/routers/index.ts` — register timeclock router
- `apps/web/src/routes/dashboard.timeclock.tsx` — new route page
- `apps/web/src/components/layout/app-sidebar.tsx` — add nav item

---

## 1.4 End-of-Day Report

**Goal:** One-page printable summary of the entire business day — sales, payments, cash, voids, production, labor.

**Schema:** No new tables. Aggregates from existing data.

**API:** New procedure in `reports.ts`:
- `reports.getEodReport` — accepts `date` param, returns:
  - Sales summary (total revenue, order count, avg ticket, items sold)
  - Payment breakdown (cash total, card total, gift card total, count per method)
  - Cash drawer (opening float, expected cash, counted cash, variance — from cash sessions)
  - Voids & refunds (count, total, by user name)
  - Top 10 products (name, qty sold, revenue)
  - Department breakdown (name, orders, revenue)
  - Labor summary (employee name, hours worked, overtime — from time_entry)
  - Production vs sales (product, produced, closing, expected sold, actual sold, variance)

**Frontend:** New route `dashboard.eod.tsx`:
- Date picker (defaults to today GYT)
- Sections matching the API response, styled for both screen and print
- "Print Report" button → `window.print()` with `@media print` CSS
- Compact layout: fits on 2-3 printed pages
- Color-coded variance indicators (green=balanced, red=off)

**Files to create/modify:**
- `packages/api/src/routers/reports.ts` — add `getEodReport` procedure
- `apps/web/src/routes/dashboard.eod.tsx` — new route page
- `apps/web/src/components/layout/app-sidebar.tsx` — add "EOD Report" nav item
- `apps/web/src/index.css` — add `@media print` styles

---

# WAVE 2: Customer & Revenue

## 2.1 Customer Database / CRM

**Goal:** Track customer profiles, purchase history, and contact info. Foundation for loyalty, gift cards, and marketing.

**Schema:** New tables:
```
customer:
  id              uuid PK
  organizationId  uuid FK → organization
  name            text NOT NULL
  phone           text (unique per org — primary identifier in Guyana)
  email           text (nullable)
  notes           text
  totalSpent      numeric(12,2) default 0
  visitCount      integer default 0
  lastVisitAt     timestamp
  createdAt       timestamp
  updatedAt       timestamp
  UNIQUE(organizationId, phone)
```

**Order table modification:**
- Add `customerId` FK (nullable) → customer table
- Existing `customerName`/`customerPhone` fields remain for denormalized receipt data

**API:** New router `customers.ts`:
- `customers.list` — paginated, search by name/phone
- `customers.getById` — profile + recent orders
- `customers.create` — validate phone uniqueness per org
- `customers.update` — edit name/phone/email/notes
- `customers.getHistory` — order history for customer
- `customers.search` — quick search by phone (for POS lookup)

**Frontend:**
- New route `dashboard.customers.tsx` — customer list with search, add/edit dialog
- Customer detail view: profile info, purchase history, total spent, visit count
- **POS integration:** Phone number lookup during checkout → auto-fill customer, link order to customer
- After checkout, auto-increment `visitCount` and `totalSpent`

**Files to create/modify:**
- `packages/db/src/schema/customer.ts` — new schema file
- `packages/db/src/schema/order.ts` — add customerId FK
- `packages/api/src/routers/customers.ts` — new router
- `packages/api/src/routers/index.ts` — register router
- `packages/api/src/routers/pos.ts` — update checkout to link customer
- `apps/web/src/routes/dashboard.customers.tsx` — new route
- `apps/web/src/components/pos/pos-terminal.tsx` — add customer lookup
- `apps/web/src/components/layout/app-sidebar.tsx` — add nav item

---

## 2.2 Loyalty / Rewards Program

**Goal:** Points-based loyalty program — earn points per dollar spent, redeem for discounts or free items. Inspired by Square Loyalty.

**Schema:** New tables:
```
loyalty_program:
  id              uuid PK
  organizationId  uuid FK → organization (unique — one program per org)
  name            text default "Bettencourt's Rewards"
  pointsPerDollar integer default 1 (earn 1 point per $1 spent)
  isActive        boolean default true
  createdAt       timestamp

loyalty_tier:
  id              uuid PK
  programId       uuid FK → loyalty_program
  name            text (e.g. "Free Drink", "10% Off")
  pointsRequired  integer (e.g. 50, 100, 200)
  rewardType      text (percentage_discount | fixed_discount | free_item)
  rewardValue     numeric (e.g. 10 for 10%, 500 for $500 off)
  rewardProductId uuid FK → product (nullable — for free_item type)
  sortOrder       integer
  createdAt       timestamp

customer_loyalty:
  id              uuid PK
  customerId      uuid FK → customer
  programId       uuid FK → loyalty_program
  currentPoints   integer default 0
  lifetimePoints  integer default 0
  createdAt       timestamp
  UNIQUE(customerId, programId)

loyalty_transaction:
  id              uuid PK
  customerLoyaltyId uuid FK → customer_loyalty
  orderId         uuid FK → order (nullable)
  type            text (earn | redeem | adjust)
  points          integer (positive for earn, negative for redeem)
  description     text
  createdAt       timestamp
```

**API:** New router `loyalty.ts`:
- `loyalty.getProgram` — get org's loyalty program + tiers
- `loyalty.updateProgram` — create/update program settings
- `loyalty.manageTiers` — CRUD for reward tiers
- `loyalty.getCustomerPoints` — get customer's current points + tier progress
- `loyalty.earnPoints` — called after checkout, calculates and awards points
- `loyalty.redeemReward` — deduct points, apply discount/free item to order
- `loyalty.getLeaderboard` — top loyalty customers

**Frontend:**
- Settings: "Loyalty Program" section — enable/disable, points per dollar, manage tiers
- POS: After customer lookup, show points balance and available rewards. "Redeem" button applies reward as discount.
- Customer profile: points history, tier progress bar
- New route `dashboard.loyalty.tsx` — program overview, member list, leaderboard

**Files to create/modify:**
- `packages/db/src/schema/customer.ts` — add loyalty tables
- `packages/api/src/routers/loyalty.ts` — new router
- `packages/api/src/routers/pos.ts` — integrate earn/redeem into checkout
- `apps/web/src/routes/dashboard.loyalty.tsx` — new route
- `apps/web/src/routes/dashboard.settings.tsx` — add loyalty config section
- `apps/web/src/components/pos/pos-terminal.tsx` — show points, redeem UI
- `apps/web/src/components/pos/payment-dialog.tsx` — apply loyalty reward

---

## 2.3 Discount Rules Engine

**Goal:** Automatic and scheduled discounts — happy hour, BOGO, volume discounts, promo codes. Inspired by Toast's auto-apply system.

**Schema:** New tables:
```
discount_rule:
  id              uuid PK
  organizationId  uuid FK → organization
  name            text NOT NULL (e.g. "Happy Hour", "BOGO Chicken")
  type            text (percentage | fixed | bogo | buy_x_get_y)
  value           numeric (e.g. 10 for 10%, 500 for $500 off)
  applyTo         text (order | item | category)
  targetCategoryId uuid FK → reportingCategory (nullable)
  targetProductId  uuid FK → product (nullable)

  -- Conditions
  minOrderTotal   numeric (nullable — minimum order to qualify)
  minQuantity     integer (nullable — min items for volume discount)
  buyQuantity     integer (nullable — for BOGO: buy X)
  getQuantity     integer (nullable — for BOGO: get Y free/discounted)

  -- Schedule
  isAutoApply     boolean default false
  scheduleType    text (always | time_window | date_range)
  startTime       time (nullable — e.g. 16:00 for happy hour)
  endTime         time (nullable — e.g. 18:00)
  startDate       date (nullable)
  endDate         date (nullable)
  daysOfWeek      text[] (nullable — e.g. ['monday','friday'])

  -- Promo code
  promoCode       text (nullable — if set, requires code entry)
  maxUses         integer (nullable — total redemption limit)
  currentUses     integer default 0

  isActive        boolean default true
  stackable       boolean default false (allow with other discounts)
  createdAt       timestamp
  updatedAt       timestamp
```

**API:** New router `discounts.ts`:
- `discounts.list` — all rules for org, with active/scheduled filter
- `discounts.create` — create rule with validation
- `discounts.update` — update rule
- `discounts.delete` — soft delete (set isActive=false)
- `discounts.getApplicable` — given a cart (items + total), return all auto-apply discounts that match right now
- `discounts.validatePromo` — check promo code, return discount if valid

**Frontend:**
- New route `dashboard.discounts.tsx` — discount rules list with status (Active/Scheduled/Expired)
- Add/Edit dialog: discount type selector, conditions, schedule builder, promo code field
- **POS integration:**
  - On cart change, call `getApplicable` → auto-show matching discounts with "Apply" button
  - Promo code input field in cart panel
  - Applied discounts shown as line items with trash icon to remove
  - Existing manual discount dialog remains for one-off discounts

**Files to create/modify:**
- `packages/db/src/schema/product.ts` — add `discountRule` table
- `packages/api/src/routers/discounts.ts` — new router
- `packages/api/src/routers/index.ts` — register router
- `apps/web/src/routes/dashboard.discounts.tsx` — new route
- `apps/web/src/components/pos/pos-terminal.tsx` — auto-apply logic
- `apps/web/src/components/pos/cart-panel.tsx` — show applied discounts, promo input
- `apps/web/src/components/layout/app-sidebar.tsx` — add nav item

---

## 2.4 Gift Cards

**Goal:** Sell, reload, and redeem gift cards at the POS. Digital-only (no physical card printing needed initially). Balance tracked in DB.

**Schema:** New tables:
```
gift_card:
  id              uuid PK
  organizationId  uuid FK → organization
  code            text UNIQUE NOT NULL (e.g. "GC-A3F8-K9X2" — 12 char)
  initialBalance  numeric(10,2) NOT NULL
  currentBalance  numeric(10,2) NOT NULL
  customerId      uuid FK → customer (nullable — optional link)
  purchasedBy     text FK → user (nullable — cashier who sold it)
  isActive        boolean default true
  expiresAt       timestamp (nullable)
  createdAt       timestamp

gift_card_transaction:
  id              uuid PK
  giftCardId      uuid FK → gift_card
  orderId         uuid FK → order (nullable)
  type            text (purchase | reload | redeem | refund)
  amount          numeric(10,2) NOT NULL
  balanceAfter    numeric(10,2) NOT NULL
  processedBy     text FK → user
  createdAt       timestamp
```

**API:** New router `giftcards.ts`:
- `giftcards.create` — generate code, set initial balance, create purchase transaction
- `giftcards.lookup` — find by code, return balance + transaction history
- `giftcards.reload` — add balance, create reload transaction
- `giftcards.redeem` — deduct from balance (partial OK), create redeem transaction
- `giftcards.list` — all gift cards with filters (active, low balance, expired)

**Payment integration:**
- Add "Gift Card" as payment method in `payment-dialog.tsx`
- Enter gift card code → lookup balance → apply up to balance as payment
- If gift card doesn't cover full amount, remaining goes to cash/card (split payment already exists)
- After checkout, create redeem transaction

**Frontend:**
- New route `dashboard.giftcards.tsx` — gift card list, sell new, lookup/reload
- POS: "Sell Gift Card" button → amount entry → generates code → prints receipt with code
- Payment dialog: "Gift Card" tab → enter code → shows balance → apply

**Files to create/modify:**
- `packages/db/src/schema/customer.ts` — add gift card tables
- `packages/api/src/routers/giftcards.ts` — new router
- `packages/api/src/routers/pos.ts` — integrate gift card payment
- `apps/web/src/routes/dashboard.giftcards.tsx` — new route
- `apps/web/src/components/pos/payment-dialog.tsx` — add gift card payment method
- `apps/web/src/components/pos/pos-terminal.tsx` — add "Sell Gift Card" action
- `apps/web/src/components/layout/app-sidebar.tsx` — add nav item

---

# WAVE 3: Operations

## 3.1 Multi-Currency (GYD/USD)

**Goal:** Accept USD payments alongside GYD. Exchange rate ~209 GYD per USD. Cashier enters USD amount, system converts and calculates change in both currencies.

**Schema changes:**
- `payment` table: add `currency` text default 'GYD', add `exchangeRate` numeric nullable
- Organization-level config: `defaultCurrency`, `acceptedCurrencies`, `usdToGydRate`

**API:**
- `settings.getExchangeRates` — get current rates
- `settings.updateExchangeRate` — manager sets daily USD/GYD rate
- Checkout: payment records store original currency + rate used

**Frontend:**
- Settings: "Currency" section — set USD/GYD rate, toggle USD acceptance
- Payment dialog: currency toggle (GYD/USD), auto-convert amounts, show change in both currencies
- Reports: show payments by currency

---

## 3.2 Stock Alerts & Auto-Reorder

**Goal:** Automatic low-stock notifications and one-click PO generation when inventory drops below threshold.

**Schema changes:**
- `inventoryItem`: add `reorderPoint` integer, `reorderQuantity` integer, `preferredSupplierId` FK
- New table `stock_alert`: `id`, `inventoryItemId`, `type` (low_stock|out_of_stock), `acknowledgedBy`, `acknowledgedAt`, `createdAt`

**API:**
- `inventory.getAlerts` — items below reorder point
- `inventory.acknowledgeAlert` — mark as seen
- `inventory.autoGeneratePO` — create PO from items below reorder point, grouped by supplier

**Frontend:**
- Dashboard: alert badge on sidebar "Inventory" nav showing count of low-stock items
- Inventory page: "Alerts" tab with list of items below threshold + "Generate PO" button
- Stock levels: reorder point and quantity fields in item edit dialog

---

## 3.3 Purchase Order Workflow

**Goal:** Full PO lifecycle — draft → submitted → partial receive → received. Currently POs exist but have no receive workflow.

**Schema:** Already have `purchaseOrder`, `purchaseOrderLine`, `goodsReceipt`, `goodsReceiptLine` tables.

**API:** Extend `inventory.ts`:
- `inventory.submitPO` — change status draft → submitted
- `inventory.receivePO` — create goods receipt, update stock levels via stock ledger
- `inventory.partialReceive` — receive some line items, PO goes to "partial" status
- `inventory.cancelPO` — cancel with reason

**Frontend:**
- PO detail page with line items, status badges, receive button
- Receive dialog: show expected vs received quantities per line item
- Auto-update inventory stock on receive

---

## 3.4 Modifier Groups with Min/Max

**Goal:** Required modifier selections (e.g. "Choose a side" — must pick 1-2) and max limits. Currently modifiers exist but have no min/max constraints.

**Schema changes:**
- `modifierGroup`: add `minSelections` integer default 0, `maxSelections` integer default 0 (0 = unlimited)
- `modifierGroup`: add `isRequired` boolean default false

**API:** Update `products.ts`:
- Modifier group CRUD includes min/max/required fields
- POS product fetch includes modifier constraints

**Frontend:**
- Product edit: modifier group form gets min/max/required fields
- POS modifier dialog: enforce min selections before allowing "Done", disable selections after max reached
- Visual indicators: "Required: choose 1-2" header on modifier group

---

# WAVE 4: Growth

## 4.1 Split Bills

**Goal:** Split a check by equal parts, by item, or by seat. Inspired by Square/Lightspeed.

**Design:**
- New "Split" button on cart panel (only when items exist)
- Three split modes:
  - **Equal split:** Enter number of ways → creates N sub-orders with equal amounts
  - **By item:** Drag/tap items to assign to different checks (Check A, Check B, etc.)
  - **Custom amount:** Enter specific amounts for each split
- Each split becomes its own payment → separate receipts
- Order remains as one parent order in DB, with payments linked

**Schema changes:**
- `payment` table: add `splitGroup` integer (nullable) — groups payments from same split
- `order` table: add `isSplit` boolean default false

---

## 4.2 Table Management

**Goal:** Visual floor plan with table status tracking for dine-in service.

**Schema:** `tableLayout` table already exists with `name`, `capacity`, `status`, `positionX`, `positionY`, `shape`.

**Enhance:**
- Add `orderId` FK (nullable) — currently assigned order
- Add `seatCount` integer for actual guests (vs capacity)

**Frontend:**
- `dashboard.tables.tsx` already exists as a stub — flesh out with:
  - Visual floor plan with draggable tables (circles/rectangles)
  - Color-coded status: green (available), amber (occupied), red (needs attention)
  - Tap table → see assigned order, timer since seated
  - Assign order to table from POS during checkout
  - Table management: add/remove/reposition tables
  - Floor plan editor (admin only)

---

## 4.3 Menu Scheduling

**Goal:** Different menus for different times of day (breakfast 6-11am, lunch 11am-3pm, dinner 3-10pm).

**Schema:** New table:
```
menu_schedule:
  id              uuid PK
  organizationId  uuid FK → organization
  name            text (e.g. "Breakfast Menu")
  startTime       time NOT NULL
  endTime         time NOT NULL
  daysOfWeek      text[] default all days
  isActive        boolean default true
  createdAt       timestamp

menu_schedule_product:
  menuScheduleId  uuid FK → menu_schedule
  productId       uuid FK → product
  overridePrice   numeric (nullable — different price for this menu)
  PRIMARY KEY (menuScheduleId, productId)
```

**API:**
- `products.getMenuSchedules` — CRUD for schedules
- `pos.getProducts` — filter by active schedule for current time

**Frontend:**
- Settings: "Menu Schedules" section — create schedules, assign products
- POS: product grid auto-filters based on current time + active schedules

---

## 4.4 Barcode Label Printing

**Goal:** Generate and print barcode labels for products (price tags, shelf labels).

**Design:**
- `products` page: "Print Labels" button → select products → choose label format
- Label formats: standard shelf label (name + price + barcode), small price tag
- Generate PDF with barcode images (Code128 or EAN-13)
- Uses browser print dialog → label printer
- Library: `bwip-js` for barcode generation in browser

---

# WAVE 5: Scale

## 5.1 Online Ordering

**Goal:** Customer-facing web page where customers can browse menu, place pickup/delivery orders. Orders flow into POS/kitchen.

**Design:**
- New public route (no auth): `/order` or subdomain
- Menu display from product data, filtered by availability
- Cart → checkout flow with customer name/phone/address
- Payment: cash on pickup or card (Stripe integration)
- Order creates entry in `order` table with `orderType=pickup|delivery`, `source=online`
- Kitchen display shows online orders with "ONLINE" badge
- SMS/notification to customer when order status changes (Phase 5.2)

---

## 5.2 SMS / WhatsApp Notifications

**Goal:** Automated notifications — order ready for pickup, delivery status, loyalty points earned.

**Design:**
- Integration: Twilio SMS API (WhatsApp Business API for later)
- Triggers: order ready (kitchen marks "ready"), delivery dispatched, loyalty points earned, birthday reward
- Settings: enable/disable per trigger, customize message templates
- Schema: `notification_log` table for tracking sent messages

---

## 5.3 Advanced Analytics Dashboard

**Goal:** Trend analysis, forecasting, ABC analysis, and deeper business insights beyond current reports.

**Design:**
- New route `dashboard.analytics.tsx`
- Charts: revenue trend (30/60/90 day), day-of-week heatmap, hourly patterns
- ABC analysis: classify products into A (top 20% revenue), B (next 30%), C (bottom 50%)
- Forecasting: simple moving average for next-week revenue prediction
- Customer insights: new vs returning, avg lifetime value
- Labor cost % of revenue (from time clock data)

---

## 5.4 Digital Menu Board

**Goal:** Customer-facing display showing live menu with prices, ideal for TV/monitor at counter.

**Design:**
- New public route: `/menu-board`
- Auto-scrolling product grid with images, names, prices
- Department sections with color-coded headers
- Respects menu schedules (shows current menu only)
- Auto-refreshes every 60s for price/availability changes
- Full-screen mode, no navigation chrome

---

# WAVE 6: Enterprise

## 6.1 Multi-Location Management

**Goal:** Centralized management of menu, pricing, and users across multiple Bettencourt's locations.

**Design:**
- `location` table already exists — add location switcher to dashboard header
- Centralized product catalog with per-location price overrides (`productLocation` table exists)
- Per-location reports and reconciliation
- Location-level settings (tax rates, receipt config, exchange rates)
- User assignment to locations (can work at multiple)

---

## 6.2 API / Webhook Integrations

**Goal:** Connect to external services — accounting (QuickBooks/Xero), delivery apps, custom integrations.

**Design:**
- Webhook system: configurable events (order.created, order.voided, inventory.low_stock)
- POST to configured URL with JSON payload
- Settings: manage webhook endpoints, view delivery logs
- API key authentication for external consumers (Better Auth API Key plugin)
- OpenAPI spec auto-generated by oRPC

---

## 6.3 Offline-First with Conflict Resolution

**Goal:** POS works fully offline — queue orders, sync when reconnected.

**Design:**
- IndexedDB for local product catalog, cart, and pending orders
- Service worker intercepts API calls when offline → queues in IndexedDB
- On reconnect: sequential sync with conflict detection
- Conflicts: last-write-wins for products/settings, append-only for orders
- Visual indicator: offline mode badge, pending sync count
- `lib/offline.ts` already exists with basic IndexedDB queue — extend it

---

## 6.4 Role-Based Dashboard Customization

**Goal:** Different home screens per role — cashier sees POS, manager sees reports, executive sees analytics.

**Design:**
- `dashboard._index.tsx` checks user role and renders role-specific widget layout
- Cashier: quick POS access, current shift info, recent orders
- Manager: today's sales, staff on shift, low stock alerts, cash drawer status
- Executive: revenue trends, multi-location overview, key metrics
- Admin: system health, user management, recent audit logs

---

# WAVE 7: Accounting & Checks/Balances

## 7.1 Daily Cash Reconciliation Workflow

**Goal:** Formal end-of-shift cash counting with mandatory variance explanation. If cash drawer is off by more than a threshold, manager must approve and log a reason. Tracks cashier accuracy over time.

**Schema changes:**
- `cash_session`: add `variance_approved_by` text FK → user (nullable), `variance_reason` text, `variance_approved_at` timestamp
- New table `cash_reconciliation_rule`: id, organizationId, maxVarianceAmount (auto-approve below this), requirePhotoEvidence boolean, notifyManagers boolean

**API:**
- `cash.approveVariance` — manager approves a cash session variance with reason
- `cash.getVarianceHistory` — historical variance data per cashier (accuracy tracking)
- `cash.getReconciliationRules` — get org's variance rules
- `cash.updateReconciliationRules` — update rules

**Frontend:**
- Cash close: if variance exceeds threshold → block close, require manager override
- Manager dashboard widget: pending variance approvals
- Cashier accuracy report: variance trend per employee

---

## 7.2 Void/Refund Authorization

**Goal:** Voids and refunds require manager PIN authorization. Creates audit trail with reason. Tracks void rate per cashier for loss prevention.

**Schema changes:**
- `order`: add `void_authorized_by` text FK → user, `void_reason` text, `void_authorized_at` timestamp

**API:**
- `orders.voidOrder` — enhanced: requires manager PIN verification, logs reason
- `orders.refundOrder` — enhanced: partial/full refund with reason, manager auth
- `orders.getVoidReport` — void frequency and amount by cashier

**Frontend:**
- Void button → dialog: reason dropdown (wrong item, customer request, prep error, other) + free text + manager PIN
- Refund flow: select items for partial refund, total for full, manager PIN
- Loss prevention report: void rate by cashier, flagged anomalies

---

## 7.3 Shift Handoff & Cash Count

**Goal:** When one cashier hands off a drawer to another mid-day, both must count. Creates accountability chain.

**Schema changes:**
- New table `shift_handoff`: id, cashSessionId, fromUserId, toUserId, countedAmount, expectedAmount, variance, notes, createdAt

**API:**
- `cash.initiateHandoff` — current cashier counts, creates handoff record
- `cash.acceptHandoff` — incoming cashier confirms count
- `cash.getHandoffs` — history for a cash session

**Frontend:**
- Cash control: "Handoff Drawer" button
- Count screen → compare to expected → both users acknowledge

---

## 7.4 Expense Tracking (Petty Cash)

**Goal:** Track small cash expenses paid from the register (cleaning supplies, emergency repairs, tips). Reduces expected cash and appears on EOD report.

**Schema:** New table:
```
expense:
  id              uuid PK
  cashSessionId   uuid FK → cash_session
  amount          numeric(10,2) NOT NULL
  category        text NOT NULL (supplies, repairs, tips, food_cost, other)
  description     text NOT NULL
  receiptPhotoUrl text (nullable)
  authorizedBy    text FK → user
  createdBy       text FK → user
  createdAt       timestamp
  organizationId  uuid FK → organization
```

**API:**
- `cash.createExpense` — log expense against active cash session
- `cash.getExpenses` — list expenses for session/date range
- `cash.getExpenseCategories` — summary by category
- `cash.deleteExpense` — manager-only: remove erroneous entry

**Frontend:**
- Cash control: "Log Expense" button → amount, category, description, optional photo
- EOD report: expenses section with category breakdown
- Monthly expense report

---

## 7.5 Daily Sales Journal / Accounting Export

**Goal:** Generate structured accounting data for bookkeeper — daily totals by account (sales, tax, discounts, refunds, payments by method, expenses). Exportable as CSV/PDF.

**Schema:** No new tables — aggregates existing data.

**API:**
- `reports.getSalesJournal` — structured double-entry format: date, account, debit, credit
  - Sales Revenue (credit)
  - Tax Collected (credit)
  - Cash Received (debit)
  - Card Payments (debit)
  - Discounts Given (debit — contra-revenue)
  - Refunds Issued (debit — contra-revenue)
  - Expenses (debit)

**Frontend:**
- New route `dashboard.journal.tsx` — daily journal with account breakdown
- Export buttons: CSV (for QuickBooks import), PDF (for bookkeeper)
- Monthly summary view with running totals

---

## 7.6 Inventory Valuation & COGS

**Goal:** Track cost of goods sold based on inventory costs. Shows profit margins per product and department.

**Schema changes:**
- Leverages existing `product.cost` and order data
- New view/procedure: COGS = SUM(quantity_sold * unit_cost) per period

**API:**
- `reports.getCOGS` — cost of goods sold for date range, by product/department
- `reports.getProfitMargins` — revenue vs cost per product, gross margin %
- `reports.getInventoryValuation` — current inventory value (qty * cost)

**Frontend:**
- New "Profit" report type in reports page
- Product profitability table: name, sold, revenue, cost, margin %
- Department-level margin summary
- Inventory valuation on hand

---

## 7.7 No-Sale Drawer Open Tracking

**Goal:** Log every time the cash drawer is opened without a sale (typically for making change). High no-sale rates are a theft indicator.

**Schema:** New table:
```
no_sale_event:
  id              uuid PK
  cashSessionId   uuid FK → cash_session
  userId          text FK → user
  reason          text (making_change, other)
  createdAt       timestamp
```

**API:**
- `cash.logNoSale` — record drawer open event
- `cash.getNoSaleReport` — frequency by cashier, flagged if above threshold

**Frontend:**
- POS: "No Sale" button (already common in POS systems) → logs event with reason
- Report: no-sale frequency per shift/cashier

---

# IMPLEMENTATION CHECKLIST

## Wave 1: Quick Wins + Foundation ✓ COMPLETE
- [x] 1.1.1 Add tax rate CRUD procedures to settings router
- [x] 1.1.2 Build TaxRatesSection component in settings page
- [x] 1.2.1 Create `receipt_config` table in schema
- [x] 1.2.2 Add receipt config API procedures
- [x] 1.2.3 Build ReceiptConfigSection with live preview
- [x] 1.2.4 Update receipt-preview.tsx to accept config prop
- [x] 1.3.1 Create `time_entry` table in schema
- [x] 1.3.2 Create timeclock router with 6 procedures
- [x] 1.3.3 Build dashboard.timeclock.tsx route page
- [x] 1.3.4 Add Time Clock to sidebar navigation
- [x] 1.4.1 Add getEodReport procedure to reports router
- [x] 1.4.2 Build dashboard.eod.tsx route page
- [x] 1.4.3 Add print-optimized CSS
- [x] 1.4.4 Add EOD Report to sidebar navigation

## Wave 2: Customer & Revenue
- [ ] 2.1.1 Create `customer` table in schema
- [ ] 2.1.2 Add customerId FK to order table
- [ ] 2.1.3 Create customers router with 6 procedures
- [ ] 2.1.4 Build dashboard.customers.tsx route page
- [ ] 2.1.5 Add customer lookup to POS terminal
- [ ] 2.2.1 Create loyalty schema tables (4 tables)
- [ ] 2.2.2 Create loyalty router with 7 procedures
- [ ] 2.2.3 Build dashboard.loyalty.tsx route page
- [ ] 2.2.4 Add loyalty config to settings page
- [ ] 2.2.5 Integrate earn/redeem into POS checkout flow
- [ ] 2.3.1 Create `discount_rule` table in schema
- [ ] 2.3.2 Create discounts router with 6 procedures
- [ ] 2.3.3 Build dashboard.discounts.tsx route page
- [ ] 2.3.4 Integrate auto-apply discounts into POS cart
- [ ] 2.3.5 Add promo code input to cart panel
- [ ] 2.4.1 Create gift card schema tables (2 tables)
- [ ] 2.4.2 Create giftcards router with 5 procedures
- [ ] 2.4.3 Build dashboard.giftcards.tsx route page
- [ ] 2.4.4 Add gift card payment method to payment dialog
- [ ] 2.4.5 Add "Sell Gift Card" flow to POS

## Wave 3: Operations
- [ ] 3.1.1 Add currency fields to payment table
- [ ] 3.1.2 Add exchange rate config to settings
- [ ] 3.1.3 Update payment dialog with currency toggle
- [ ] 3.1.4 Update reports to show payments by currency
- [ ] 3.2.1 Add reorder fields to inventory_item table
- [ ] 3.2.2 Create stock_alert table
- [ ] 3.2.3 Add alert procedures to inventory router
- [ ] 3.2.4 Build alerts tab in inventory page
- [ ] 3.2.5 Add alert badge to sidebar
- [ ] 3.3.1 Add PO workflow procedures (submit, receive, partial, cancel)
- [ ] 3.3.2 Build PO detail page with receive dialog
- [ ] 3.3.3 Auto-update stock on goods receipt
- [ ] 3.4.1 Add min/max/required fields to modifier_group
- [ ] 3.4.2 Update modifier group CRUD in products router
- [ ] 3.4.3 Enforce min/max in POS modifier dialog

## Wave 4: Growth
- [ ] 4.1.1 Add split fields to payment/order tables
- [ ] 4.1.2 Build split bill UI in cart panel (3 modes)
- [ ] 4.1.3 Generate separate receipts per split
- [ ] 4.2.1 Enhance tableLayout schema
- [ ] 4.2.2 Build visual floor plan component
- [ ] 4.2.3 Integrate table assignment with POS checkout
- [ ] 4.3.1 Create menu_schedule tables
- [ ] 4.3.2 Add schedule CRUD to products router
- [ ] 4.3.3 Filter POS products by active schedule
- [ ] 4.4.1 Add bwip-js dependency
- [ ] 4.4.2 Build label generation and print UI

## Wave 5: Scale
- [ ] 5.1.1 Create public /order route with menu display
- [ ] 5.1.2 Build online cart + checkout flow
- [ ] 5.1.3 Integrate online orders with kitchen display
- [ ] 5.2.1 Integrate Twilio SMS API
- [ ] 5.2.2 Build notification triggers and templates
- [ ] 5.2.3 Create notification_log table
- [ ] 5.3.1 Build analytics dashboard with trend charts
- [ ] 5.3.2 Implement ABC analysis
- [ ] 5.3.3 Add customer insights
- [ ] 5.4.1 Create public /menu-board route
- [ ] 5.4.2 Build auto-scrolling menu display

## Wave 6: Enterprise
- [ ] 6.1.1 Build location switcher in dashboard header
- [ ] 6.1.2 Add per-location settings and reports
- [ ] 6.2.1 Build webhook system (event dispatch + config UI)
- [ ] 6.2.2 Add API key management
- [ ] 6.3.1 Extend offline.ts with full order queuing
- [ ] 6.3.2 Build sync engine with conflict resolution
- [ ] 6.4.1 Build role-specific dashboard widgets

## Wave 7: Accounting & Checks/Balances
- [ ] 7.1.1 Add variance approval fields to cash_session
- [ ] 7.1.2 Create reconciliation rules table and API
- [ ] 7.1.3 Build variance approval workflow in cash control UI
- [ ] 7.1.4 Build cashier accuracy report
- [ ] 7.2.1 Add void authorization fields to order table
- [ ] 7.2.2 Enhance void/refund API with manager PIN auth
- [ ] 7.2.3 Build void authorization dialog with reason
- [ ] 7.2.4 Build loss prevention report
- [ ] 7.3.1 Create shift_handoff table
- [ ] 7.3.2 Build handoff API procedures
- [ ] 7.3.3 Build handoff UI in cash control
- [ ] 7.4.1 Create expense table
- [ ] 7.4.2 Build expense CRUD API
- [ ] 7.4.3 Build expense logging UI
- [ ] 7.4.4 Add expenses to EOD report
- [ ] 7.5.1 Build sales journal API procedure
- [ ] 7.5.2 Build dashboard.journal.tsx with CSV/PDF export
- [ ] 7.6.1 Build COGS and profit margin API procedures
- [ ] 7.6.2 Build profit/margin report UI
- [ ] 7.6.3 Build inventory valuation report
- [ ] 7.7.1 Create no_sale_event table
- [ ] 7.7.2 Build no-sale logging API and POS button
- [ ] 7.7.3 Build no-sale frequency report
