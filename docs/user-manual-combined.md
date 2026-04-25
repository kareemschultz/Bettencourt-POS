---
pdf_options:
  format: A4
  margin: 20mm 15mm
  displayHeaderFooter: true
  headerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#999;">Bettencourt POS User Manual</div>'
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#999;">Page <span class="pageNumber"></span> of <span class="totalPages"></span> — KareTech Solutions</div>'
stylesheet: []
---

# Bettencourt POS
# User Manual

**Version:** April 2026
**System URL:** pos.karetechsolutions.com
**Prepared by:** KareTech Solutions

---



## Logging In

### PIN Login (All Staff)

1. Open **pos.karetechsolutions.com** in your browser (or launch the desktop app)
2. Enter your **PIN** (4–8 digits assigned by your manager)
3. Click **Log In**

> **Note:** 
After **5 failed PIN attempts**, your IP is locked out for 60 seconds. Wait and try again, or use email login if you are a manager.


### Email Login (Managers & Administrators)

1. Click **Sign in with Email** below the PIN field
2. Enter your email address and password
3. Click **Log In**

---

## Dashboard Overview

After logging in, you land on your **default start page** (configurable in Settings → My Workspace). The dashboard shows summary cards and quick links relevant to your role.

### Sidebar Navigation

The sidebar is organised into groups:
- **Operations** — New Sale, Orders, Cash Control, Kitchen Display
- **Inventory** — Stock, Purchase Orders, Transfers, Stock Alerts, Suppliers
- **Finance** — Finance Dashboard, Invoices, Credit Notes, Vendor Bills, Recurring, Quotations, Aging, Statements, Tax Summary, Budgets
- **Insights** — Reports, Analytics
- **Customers** — Customer List, Loyalty Program, Gift Cards
- **Sales** — Public Menu Board, Online Ordering
- **System** — Settings, Users, Webhooks, Notifications, Audit Log, Backup

> The sidebar only shows sections your role has access to.

### Command Palette (Ctrl+K)

Press **Ctrl+K** to open a quick search. Type the name of any page (e.g., "Inventory", "Reports", "Settings") to jump there instantly.

---

## Staff Roles

| Role | Access | Default Start Page |
|------|--------|-------------------|
| **Cashier** | POS, orders, time clock | New Sale |
| **Kitchen / Checkoff** | KDS and production | Kitchen Display |
| **Warehouse** | Inventory, purchase orders, stock alerts | Inventory |
| **Accountant** | Reports, expenses, invoices, vendor bills | Finance Dashboard |
| **Admin / Manager** | All of the above + settings, products, users | Dashboard |
| **Executive / Owner** | Full unrestricted access | Dashboard |
| **Custom Roles** | Tailored permissions across 30+ categories | As configured |

Custom roles can be created by administrators in Settings → Roles. See [Settings](/docs/settings) for details.

---

## Desktop App

For dedicated POS terminals or locations with intermittent internet, the **desktop app** provides the same interface as a standalone Windows application with offline capability. See [Desktop App](/docs/desktop-app).

---

## Sync Status Indicator

A small dot in the top bar shows the system's connection status:
- **Green** — fully connected, all data in sync
- **Yellow** — connection intermittent, some actions may be delayed
- **Red** — offline, limited functionality (desktop app only)

---

## Desktop App

For dedicated POS terminals, the **Bettencourt POS Desktop App** runs as a standalone Windows application with offline capability. It provides the same interface as the browser but runs without browser distractions and can continue taking orders when internet connectivity drops.

See [Desktop App](/docs/desktop-app) for installation and offline mode details.

---

## Custom Roles

In addition to the six built-in roles, administrators can create **custom roles** with granular permissions across 30+ resource categories. This allows for combinations like "Senior Cashier" (cashier + limited report access) or "Finance Manager" (invoices + reports + no POS).

Custom roles are managed at **Settings → Roles**. See [Settings](/docs/settings#custom-roles) for the full guide.



---




**Navigate to:** New Sale (Operations → New Sale, or click "Open POS" from the Dashboard)

The POS has two main parts:
- **Left/Center** — product grid organized by category
- **Right panel** — the current order cart

---

## Starting a New Order

The POS opens with an empty cart ready to go. If you have an order in progress, click **+ New** (top of cart) to start a fresh order.

---

## Browsing Products

- Category tabs run across the top of the product grid
- Click a category tab to filter to those products
- Use the **Search** bar above the grid to find a product by name
- Products with a stacked layers icon are **combo products** (e.g., a meal deal with multiple components)

### Menu Schedules

Products may be restricted to certain times of day (e.g., breakfast items only show before 11:00 AM). Menu schedules are configured by managers in Settings → Menu Schedules. The POS automatically shows only products available for the current time window.

---

## Adding Items to the Cart

- Click any product button to add it once
- Click again to add another unit
- If a product has **modifiers** (e.g., spice level, size, add-ons), a popup appears — select your options and click **Add to Cart**

### Combo Products

Combo products bundle multiple items together (e.g., "Lunch Special: Main + Side + Drink"). When you add a combo:
- The combo appears as a single line item in the cart at the combo price
- Production tracking automatically splits the combo into its individual components for the kitchen

---

## Editing Cart Items

In the cart on the right:
- Click **+** or **−** next to an item to change quantity
- Click the **pencil icon** (or the item name) to edit quantity or add a note
- Click the **trash icon** to remove an item
- Click **Add Note** on a line item to add a special instruction (e.g., "no onions")

---

## Applying a Discount

1. With items in the cart, click **Discount**
2. Choose from your saved discount presets (e.g., Staff Discount 10%, Senior 10%), or enter a custom amount (percentage or fixed GYD)
3. The discount appears in the cart total

> Discounts exceeding the cashier's limit require **supervisor approval** — a dialog prompts for a manager PIN.

---

## Supervisor Approval

Certain actions require manager authorization:
- Discounts exceeding the cashier's configured limit
- Price overrides on products
- Voiding items after they have been sent to the kitchen

When required, a dialog appears asking for a **Manager PIN** or email login. Once approved, the action proceeds and is logged in the audit trail.

---

## Selecting Order Type

At the top of the cart, select the order type:
- **Walk-in / Dine In** — for table orders (select a table from the dropdown or floor plan)
- **Takeaway** — for counter pickup
- **Delivery** — prompts for customer name, phone, and delivery address

### Table Assignment (Dine In)

When order type is **Dine In**, select a table from the dropdown. The table status changes to "Occupied" on the floor plan. See [Floor Plans & Table Layout](/docs/floor-plan) for more on table management.

---

## Processing Payment

1. Review the cart items and total
2. Click **Charge**
3. The payment dialog opens — choose method(s):
   - **Cash** — enter the amount the customer hands you; the system shows the change due. Quick-cash buttons for common GYD denominations: **$100, $500, $1,000, $2,000, $5,000**
   - **Card** — confirm the amount, process on your physical card terminal
   - **Gift Card** — enter the gift card number; it deducts from the card balance
   - **Split Payment** — click **Add Payment** to split across multiple methods
4. Click **Complete Order**

The order is saved and a receipt preview appears.

### VAT Display

Guyana uses VAT-inclusive pricing. The cart shows "Incl. VAT: $X" as an informational line — it does not change the total. This can be toggled per terminal via the VAT display setting.

---

## Printing a Receipt

After payment, click **Print** on the receipt preview. Receipts print to the configured receipt printer (see [Printers](/docs/printers)).

---

## Split Bill

After completing an order, the receipt preview has a **Split** button:
1. Click **Split**
2. Choose how to split:
   - **Equal Split** — divide total evenly among N people
   - **By Item** — assign specific items to each person
   - **Custom Amounts** — enter custom dollar amounts per person
3. Each split portion can be paid separately

---

## Holding an Order

Click **Hold** (at the bottom of the cart) to save the order without charging. Retrieve held orders by clicking the **Held Orders** button (stack icon at top of cart).

---

## Voiding Items

- **Before payment:** Click the trash icon next to a cart item to remove it. No void record is created.
- **After payment:** Go to **Orders**, open the order, and click **Void Order**. See [Orders](/docs/orders).

---

## Linking a Customer to an Order

Click **Add Customer** in the cart, search by name or phone, and select the customer. Benefits:
- Loyalty points earned automatically when the order completes
- If the customer has a **price list** assigned, their custom prices apply immediately
- Delivery address is pulled from the customer profile for delivery orders



---




**Navigate to:** Dashboard → Orders

---

## Order List

The orders table shows all transactions for the selected filters. Each row displays:

| Column | Description |
|--------|-------------|
| Order # | Unique order number (e.g. ORD-0042) |
| Status | Completed, Open, Held, Voided, or Refunded |
| Type | Walk-in / Dine-in, Pickup, or Delivery |
| Cashier | Staff member who processed the order |
| Customer | Customer name and phone (if provided) |
| Total | Order total in GYD |
| Time | Time the order was created |

Click any row to open the full order detail dialog.

---

## Filtering Orders

Use the controls above the table to narrow results:

- **Search** — by order number or customer name
- **Type filter** — All Types, Walk-in/Dine-in, Pickup, Delivery
- **Status filter** — All, Completed, Open, Voided, Refunded, Held
- **From / To date** — view orders for a specific day or range

The order count at the right of the filter bar updates instantly as you type.

---

## Order Detail Dialog

Click any row to open the full detail view. The dialog is organised into sections:

### Header
- Order number and creation timestamp
- Status badge (Completed / Voided / Refunded / etc.)
- Fulfillment status badge (Preparing / Ready / Picked Up / Delivered) when applicable

### Transaction Information
| Field | Description |
|-------|-------------|
| Cashier | Staff member who rang up the order |
| Location | Which branch the order was taken at |
| Register | Which register (e.g. Register 1) |
| Order Type | Walk-in, Pickup, or Delivery |
| Table | Table number (dine-in only) |
| Split Order | Shown if the bill was split |
| Closed At | Timestamp when the order was finalised |

### Customer (shown when available)
- Customer name, phone number, and delivery address

### Notes
- Order-level notes shown in an amber box (if any were added)

### Items
A table of every line item:
- Product name with modifiers shown as grey chips
- Item-level notes in italics below the product
- Voided items shown with a strikethrough and a red **Voided** badge
- Columns: Product, Qty, Price, Disc. (discount), Total

### Payments
Each payment shows:
- Method (Cash or Card) with an icon
- Amount
- For cash payments: **Tendered** amount and **Change given**
- Voided payments are dimmed with a red **Voided** badge

### Totals
- Subtotal
- Discount (shown in red, only if applied)
- Tax / 16.5% VAT (only if non-zero)
- **Total** (bold)

### Void Information (voided orders only)
A red box showing:
- Void reason
- Authorized by (manager who approved it)
- Date and time voided

---

## Printing / Exporting

### Print PDF
In the order detail dialog, click **Print PDF** (bottom left) to open a formatted receipt in a new browser tab. Click **Print / Save as PDF** inside that tab to save it or send it to a printer.

The PDF includes: order number, date, cashier, location, register, customer info, all line items with modifiers, payment breakdown with change given, totals, and void information if applicable.

### Print Orders PDF (List Report)
On the main Orders page, click **Print PDF** (top right) to open a formatted orders report in a new tab. The report includes:
- Total order count and grand total
- Breakdown by status (Completed, Voided, Refunded, etc.)
- Full orders table with order #, date/time, type, cashier, customer, status, and total
- Active filters shown at the top of the report

Click **Print / Save as PDF** inside the tab to save or print.

### Export CSV
On the main Orders page, click **Export** (top right) to download the currently filtered orders as a CSV file with: Order #, Status, Type, Total, Cashier, Customer, Date.

---

## Voiding an Order

> Only admins and executives can void orders. Voiding is final and logged in the audit trail.

1. Click the order row to open the detail dialog
2. Click **Void** (bottom right — only visible on Completed orders)
3. Enter a **reason** in the text field (required)
4. Click **Confirm Void**

The order status changes to **Voided**, all payments are voided, and if there was a cash payment, the cash session expected total is adjusted automatically.

---

## Refunding an Order

> Only completed orders can be refunded.

1. Click the order row to open the detail dialog
2. Click **Refund** (bottom right)
3. The full order total is pre-filled — change the amount for a **partial refund**
4. Enter a **reason** (required)
5. Click **Confirm Refund**

The order status changes to **Refunded** and a negative payment record is created in the system for accounting purposes.

> Refunds and voids both appear in the **P&L Statement** and **Sales Reports** so the numbers always balance.

---

## Open Tabs

**Navigate to:** Dashboard → Orders (filter by Open status)

Open tabs are orders that have been started but not yet completed or paid. They stay active until the customer is ready to settle.

- View all open tabs from the Orders page by filtering to **Open** status
- Each tab shows items added so far, running total, and the cashier who started it
- Add items to an open tab by retrieving it from the **Held Orders** list in the POS

---

## Order Transfers

Orders can be transferred between registers or locations:

1. Open the order detail
2. Click **Transfer**
3. Select the target register or location
4. The order moves and appears on the target register

This is useful when a customer starts an order at one counter and moves to another, or for centralised order management across registers.

---

## Fulfillment Status

Delivery and pickup orders show a **fulfillment status** alongside the payment status:

| Status | Meaning |
|--------|---------|
| **Preparing** | Kitchen is working on the order |
| **Ready** | Order is prepared and waiting for pickup/dispatch |
| **Dispatched** | Order has left the premises (delivery only) |
| **Delivered** | Order has been delivered to the customer |

Update the fulfillment status from the order detail view as the order progresses through preparation and delivery.



---




## Kitchen Display System (KDS)

**Navigate to:** Dashboard → Kitchen Display

The Kitchen Display shows all active orders as tickets in real time. Kitchen staff use it to track what needs to be prepared and mark items as ready.

### Layout

Each ticket shows:
- Order number and time received
- All items in the order with special notes
- Modifiers shown as grey chips below item names

### Department Filter

Use the filter tabs at the top of the KDS to view only orders for a specific department (e.g., "Meals", "Pastry", "Beverages"). This is useful when different kitchen stations handle different departments.

### Colour Coding by Wait Time

| Colour | Meaning |
|--------|---------|
| Grey/White | Fresh order, just received |
| Yellow | Order is waiting longer than expected |
| Red | Order has been waiting too long — needs immediate attention |

### Marking Items as Prepared

Click an item on a ticket to mark it as prepared (dims/checks off the item). When all items are prepared, click **Mark Ready** — the ticket turns green and the front-of-house is notified.

### Course-Based Ordering

For multi-course meals, items are grouped by course on the KDS. Kitchen staff can **fire** items by course — preparing starters first, then mains when the table is ready.

### Auto-Refresh

The KDS refreshes automatically every few seconds. No manual refresh is needed.

---

## Tables

**Navigate to:** Dashboard → Tables

### Table Layout View

View your dining area visually with tables showing their status:
- **Available** (green) — ready for seating
- **Occupied** (red) — active order in progress
- **Reserved** (blue) — booked for an upcoming reservation

### Assigning Orders to Tables

When creating a **Dine In** order at the POS, select a table from the dropdown. The table status changes to "Occupied" on the floor plan.

### Moving Orders Between Tables

If a party needs to move:
1. Click the occupied table
2. Click **Move Order**
3. Select the new table
4. Table statuses update automatically

### Clearing Tables

After a party leaves and the bill is settled, click the occupied table → **Clear Table** to return it to "Available" status.

### Configuring Tables

Add and manage tables in **Settings → Tables**. Set table names/numbers and capacity. See [Floor Plans & Table Layout](/docs/floor-plan) for the full guide on floor configuration.



---




## Production Dashboard (Check Off)

**Navigate to:** Dashboard → Production

Used by kitchen and bakery managers to log how much was produced each day and compare it against what the POS actually sold.

### Workflow Tabs

At the top there are two tabs:
- **Restaurant → Food** — soups, mains, sides, drinks
- **Bakery → Pastry** — all bakery and pastry products

Only products belonging to the selected workflow are shown, so the kitchen and bakery teams can work independently.

### Entry Types

| Button | Colour | When to use |
|--------|--------|-------------|
| **Opening** | Blue | First thing in the morning — how much you made for the day |
| **Reorder** | Amber | Mid-day top-up when you cook more |
| **Closing** | Green | End of day — leftover / damage / spoilage |

### Logging a Product

1. Tap the entry type (Opening / Reorder / Closing)
2. Optionally use the department pills to filter to a specific section
3. Tap any product card — a number pad dialog opens
4. Enter the quantity using the numpad, quick-quantity buttons (5 / 10 / 20 / 25 / 50), or +/− fine-tune buttons
5. Add a note if needed (e.g., "burnt batch")
6. Tap **Log** to save

After saving, the product card shows a badge with the running total for the day.

### Combo Products (Split Items)

Some products — like "Fried Rice and Baked Chicken" or "Cookup Baked Snapper" — are combos made up of two individual items. These cards show an amber **stacked layers** icon.

**Opening entries** always split automatically into all components:

> *Example: Log 10 × "Fried Rice and Baked Chicken" (Opening)*
> The system records:
> → 10 × Fried Rice (Opening)
> → 10 × Baked Chicken (Opening)

**Reorder and Closing entries** give you a choice — sometimes you only topped up one component, not both. After tapping the quantity, you will see:

- **All equally** — splits the quantity across all components, same as Opening
- **Individual component buttons** (e.g. "Fried Rice", "Baked Chicken") — tap one to log only that component

> *Example: You made 5 more Baked Chicken mid-day (no extra Fried Rice needed)*
> Tap **Baked Chicken** → logs 5 × Baked Chicken (Reorder) only

The button label updates to show exactly what will be recorded (e.g. "Log 5 → Baked Chicken") so there is no ambiguity before you confirm.

---

## Production Report

**Navigate to:** Dashboard → Production Report

Compares what the kitchen logged against what the POS actually sold.

### Columns

| Column | What it means |
|--------|---------------|
| Opening | Quantity made at start of day |
| Reorder | Mid-day top-up batches |
| Closing | Leftover / unsold at end of day |
| Expected | Opening + Reorder − Closing |
| Actual | What the POS actually sold |
| **% Sold** | Actual ÷ Expected × 100 |
| Variance | Actual − Expected |

### Row Sorting

Rows are sorted by urgency:
1. **Shortages** (negative variance) — appear first so you can spot problems immediately
2. **Overages** (positive variance) — produced more than sold
3. **Balanced** (zero variance) — at the bottom

### Variance Colour Codes

| Colour | Meaning |
|--------|---------|
| **Grey (0)** | Balanced — sales match production exactly |
| **Red (negative)** | Short — more was rung up than produced |
| **Amber (positive)** | Over — more was produced than sold (possible waste) |

The **Closing column** is highlighted in amber whenever there is unsold stock remaining at end of day.

A **Totals row** at the bottom sums all columns for an at-a-glance overview.

> **Legend (shown below the table):** Closing = leftover at end of day. % Sold = Actual ÷ Expected. Combo sales are split into components in both columns.

Click **Print** to print the report.

---

## Waste Log

**Navigate to:** Dashboard → Waste Log

Tracks food and ingredient waste in detail for cost control.

### Recording Waste

1. Click **Log Waste**
2. Select the item (product or ingredient)
3. Enter the quantity wasted
4. Select the reason:
   - Expired
   - Overcooked
   - Dropped/Damaged
   - Overproduced
   - Other
5. Optionally add a note
6. Click **Save**

### Viewing Waste History

The waste log table shows all recorded waste events with date, item, quantity, reason, who recorded it, and estimated cost value.

A **summary at the top** shows total waste cost for the selected period. Use the date filter to compare week-over-week or month-over-month.

---

## Variance Report

**Navigate to:** Dashboard → Variance

Compares **expected** stock (calculated from sales and production) vs. **actual** stock (from physical counts). Unexplained differences may indicate waste, theft, or data entry errors.

- **Green** = within tolerance
- **Red** = significant variance requiring investigation

Click any item to see the detailed movement history and identify where the variance occurred.



---




**Navigate to:** Dashboard → Cash Control

Manages cash drawer sessions (shifts), cash drops, payouts, and no-sale events.

---

## Opening a Shift

Do this at the start of each working day or when a new cashier takes over:

1. Click **Open Shift**
2. Count the starting cash in the drawer and enter the amount
3. Click **Open Shift**

> The system tracks all sales and cash movements during the shift.

---

## Recording a Cash Drop

When the drawer has too much cash and you want to move some to the safe:

1. Click **Cash Drop**
2. Enter the amount you're removing
3. Enter a reason (e.g., "moved to safe")
4. Click **Record Drop**

---

## Recording a Payout

When you pay someone from the cash drawer (e.g., petty cash for a delivery fee):

1. Click **Payout**
2. Enter the amount paid out
3. Enter who/why (e.g., "supplier delivery fee")
4. Click **Record Payout**

---

## No Sale / Opening the Drawer Without a Transaction

When you need to open the drawer without processing a sale:

1. Click **No Sale**
2. Enter a reason (optional but recommended)
3. Click **Log No Sale**

> Every drawer-open event is logged for security. All no-sale events appear in the Cash Control audit trail.

---

## Closing a Shift

At the end of the day or shift:

1. Click **Close Shift**
2. Count all the cash in the drawer
3. Enter the actual cash count
4. The system shows **Expected** vs. **Actual** cash
5. Any difference is recorded as overage (too much) or shortage (too little)
6. Click **Close Shift**

---

## Shift History

Below the current shift, a table shows all past shifts with:
- Who opened/closed
- Opening float
- Expected cash
- Actual cash counted
- Variance (over/short)

Use the date range filters to view shifts from specific periods.



---




## Inventory

**Navigate to:** Dashboard → Inventory

Manages raw materials and ingredients (not finished food products — those are in **Settings → Products**).

### Viewing Stock Levels

The main inventory tab shows all items with current stock on hand, unit of measure, reorder point, and status indicator.

### Adding a Stock Movement

1. Click **Add Movement**
2. Select the item
3. Choose movement type:
   - **Received** — new stock delivered from supplier
   - **Used** — consumed in cooking/production
   - **Wasted** — spoiled or thrown out
   - **Adjustment** — manual correction to match physical count
4. Enter the quantity and a note/reason
5. Click **Save**

### Stock Ledger

Click any inventory item to see its full ledger — a history of every movement with timestamps and the person who recorded it.

### Barcode Support

Inventory items can have barcodes assigned. When scanning a barcode at the POS or during stock counts, the system looks up the item automatically. Add barcodes under the item's detail view.

---

## Stock Counts

**Tab: Stock Counts**

Used for physical counts (counting actual stock on hand):

1. Click **New Count**
2. Select the items to count
3. Enter the physical quantity for each item
4. Submit — the system records the variance between expected and actual

---

## Purchase Orders

**Tab: Purchase Orders**

1. Click **New Purchase Order**
2. Select the supplier
3. Add items and quantities needed
4. Save as **Draft** or set to **Ordered** (sent to supplier)
5. When goods arrive, click **Receive** on the order to update inventory

### Goods Receipts

When receiving a purchase order:

1. Click **Receive** on an ordered PO
2. Enter the actual quantities received (may differ from ordered quantities)
3. Submit — inventory levels are updated immediately
4. The goods receipt is recorded with a timestamp and the receiving user

---

## Transfers

**Tab: Transfers**

Move stock between locations:

1. Click **New Transfer**
2. Select: From Location → To Location
3. Add items and quantities
4. Submit

---

## Waste Logging

**Navigate to:** Dashboard → Waste Log (or via Inventory → Waste tab)

Track and manage food waste for cost control:

1. Click **Log Waste**
2. Select the item
3. Enter quantity
4. Choose a reason: Expired, Overcooked, Dropped/Damaged, Overproduced, or Other
5. Add an optional note
6. Click **Save**

The waste log table shows: date, item, quantity, reason, recorded by, and estimated cost value. You can **edit** or **delete** waste entries if corrections are needed.

### Waste Summary

View waste totals at the top of the page:
- **Total waste cost** for the selected period
- **By department** breakdown to identify which areas generate the most waste
- Use date filters for week-over-week or month-over-month comparison

---

## Inventory Valuation

View the total value of your current stock based on item costs and quantities on hand. This feeds into the P&L Statement under Cost of Goods Sold.

---

## Stock Alerts

**Navigate to:** Dashboard → Stock Alerts

> You will see a **number badge** on this menu item in the sidebar when there are unacknowledged alerts.

When an inventory item falls to or below its **reorder point**, an alert is automatically generated.

### Viewing & Acknowledging Alerts

Alerts show the item name, current stock level, reorder point, and alert type (Low Stock or Out of Stock).

- Use the filter to toggle between All and Unacknowledged alerts
- Click **Acknowledge** to mark an alert as seen/handled — this removes the sidebar badge

### Auto-Generate Purchase Order

For items with a preferred supplier set, click **Auto PO** to automatically create a purchase order with the item and suggested reorder quantity.

---

## Product Recipes & Components

Products can have **recipes** (ingredient lists) that link to inventory items. When a product is sold, the recipe components can be used to track ingredient consumption.

**Combo products** (e.g., "Fried Rice & Chicken Meal") are products composed of multiple sub-products. Components are:
- Automatically split for production tracking on the checkoff board
- Used for inventory deduction calculations
- Managed under the product's detail view in Settings → Products

---

## Labels

**Navigate to:** Dashboard → Labels

Print price labels or shelf labels for products.

1. Search for or select products to label
2. Choose a label format (price tag, shelf label, etc.)
3. Click **Print Labels**



---




**Navigate to:** Dashboard → Expenses

Track business expenses (non-COGS) such as utilities, rent, staff meals, repairs, etc.

---

## Summary Cards (Quick Filter)

At the top of the page are **clickable summary cards** showing your expense totals for the selected period:

- **All Expenses** card — shows the grand total and a **"+X% vs last month"** badge so you can instantly see whether spending is up or down compared to the previous month. Click it to reset to viewing all entries.
- **Supplier cards** (up to 3) — show the total spent with each top supplier.

**Click any supplier card to instantly filter the expense table to show only that supplier's entries.** The active card is highlighted with a ring so you always know which filter is in effect.

---

## Category Breakdown

Below the supplier cards is a **spending-by-category** row showing the total for each category as clickable pills. Click any pill to filter the table to that category only. Click again to clear.

---

## Filtering Expenses

Use the controls at the top to narrow down what you see:

- **From / To** date fields — the page opens showing **the current month** by default so you always see relevant data
- **Quick range** buttons — **Today**, **This Week**, **This Month**, **Last Month** — instantly set the date range with one click
- **Supplier** dropdown — filter by a specific supplier
- **Category** dropdown — filter by a specific expense category

---

## Managing Categories

Your expense categories are fully customisable. Click the **Categories** button (top right) to open the category manager:

- **Add a category** — type the name and click **Add** (or press Enter)
- **Delete a category** — click the trash icon next to any category; a confirmation prompt appears before deletion

Default categories provided out-of-the-box:
- Food & Beverage Supplies
- Cleaning Supplies
- Office Supplies
- Repairs & Maintenance
- Delivery & Transport
- Utilities
- Marketing & Advertising
- Staff Meals
- Vehicle Maintenance
- CEO Drawings
- GM Drawings
- Owner Drawings
- COO Drawings
- Miscellaneous

> **Drawings** categories (CEO / GM / Owner / COO) are used to record money taken out of the business by executives or owners. These appear in the P&L under Operating Expenses.

Category names must be unique per organisation.

---

## Adding an Expense

1. Click **Add Expense** (top right)
2. Enter the **amount** (GYD)
3. Select the **supplier** (optional) — the system will **auto-fill the category** based on your most recent expense for that supplier
4. Select the **category** from your managed list
5. Enter a **description** of what the expense was for
6. Select the **payment method** — Cash, Card, Bank Transfer, Cheque, or Other
7. Enter the **receipt or reference number** (invoice # or receipt # from the supplier — optional but recommended for audit)
8. Add any **notes** — e.g. "receipt in green folder", "approved verbally by Shakira" (optional)
9. **Upload a receipt photo** — click the upload area to attach a JPEG, PNG, or WebP image (max 5 MB). A thumbnail preview appears; click **Remove** to clear it.
10. Click **Save Expense**

> **Duplicate warning:** If you enter an expense with the same amount and supplier on the same day as an existing entry, the system will warn you before saving. This helps prevent accidental double-entry.

---

## Viewing Full Transaction Details

Click anywhere on an expense row to open a read-only details dialog showing:

| Field | Description |
|-------|-------------|
| Date & Time | Full timestamp including weekday |
| Amount | Large, bold GYD amount |
| Category | Expense category |
| Supplier | Supplier name (if linked) |
| Payment Method | How the expense was paid |
| Receipt / Ref # | Invoice or receipt number |
| Description | Full description (no truncation) |
| Notes | Internal notes (only shown if present) |
| Receipt Photo | Attached photo (click to open full size) — only shown if uploaded |
| Recorded By | Staff member who entered it |
| Authorized By | Manager who approved it |

The **Edit** button in the details dialog opens the edit form directly.

---

## Editing or Deleting an Expense

Each row in the expense table has:
- **Pencil icon** — click to open the edit dialog and correct any field (all fields including payment method, ref #, and notes are editable)
- **Trash icon** — click to delete; a confirmation prompt appears before deletion

---

## Exporting

**Export CSV** (top right) — downloads the current filtered expenses as a CSV file including all fields: date, category, description, amount, supplier, payment method, ref #, notes, recorded by, authorized by.

**Print PDF** — opens a **professional branded expense report** in a new browser tab featuring:
- Dark slate header with logo and period
- KPI summary row: Total Spent, # Entries, Top Category, Top Supplier
- Color-coded category breakdown bars with percentages
- Grouped or flat expense table with category dot indicators
- Grand total strip and signature lines (Prepared By / Checked By / Authorized By)
- In-page Print and Close buttons (no automatic print dialog)

---

## Expense Table

The table shows every entry for the selected period with:

| Column | Description |
|--------|-------------|
| Date | Date and time the expense was recorded |
| Supplier | Supplier name (if linked), shown as a colour-coded badge — **click the badge** to open the [Vendor Detail page](/docs/suppliers#vendor-detail-page) for that supplier |
| Category | Expense category |
| Description | What the expense was for (truncated — click row for full text) |
| Amount | Expense amount in GYD |
| Authorized By | The manager who authorized it |

---

> Expenses feed into the **P&L Statement** automatically under "Operating Expenses".



---




**Navigate to:** Dashboard → Finance section (sidebar)

Bettencourt Finance is a full accounting and billing suite built into the POS. It covers everything from customer invoices and vendor bills to aging reports, budgets, and Shakira's daily expense summary form.

---

## Finance Dashboard

**Route:** `/dashboard/finance`

The Finance Dashboard gives a real-time overview of your financial position:

| Card | What it shows |
|------|--------------|
| **Total Receivable** | Sum of all unpaid customer invoice balances |
| **Total Payable** | Sum of all outstanding vendor bill balances |
| **Overdue AR** | Count + total of overdue customer invoices |
| **Overdue AP** | Count + total of overdue vendor bills |
| **Net Cash Flow (30d)** | Payments received minus vendor payments and expenses in the last 30 days |
| **Revenue MTD** | Invoice payments received this calendar month |

Below the KPI strip you'll find:
- **Revenue vs Expenses** stacked bar chart (last 12 months)
- **5 most recent invoices** quick-view table
- **5 most recent vendor bills** quick-view table

---

## Invoices

**Route:** `/dashboard/invoices`

Create and manage customer invoices for catering, corporate lunches, events, and ongoing accounts.

### Creating an Invoice
1. Click **New Invoice**
2. Enter customer name (or select from the customer list)
3. (Optional) open **Agency / Organization** details and set **Department**
4. Add line items (description, quantity, unit price)
5. Set due date and payment terms
6. (Optional) set a custom invoice number
7. Click **Save as Draft** or **Send** to issue it immediately

### Recording a Payment
1. Find the invoice in the table
2. Click the green payment button on the row (card icon)
3. Enter amount, payment method (Cash / Cheque / Bank Transfer / Mobile Money), optional reference number, and date paid
4. Click **Record** — the invoice status updates automatically

### More Actions Menu (•••)
- Mark Sent (for drafts)
- Duplicate Invoice
- Print / Save PDF
- Copy Reminder
- Delete (permission-gated)

### Payment Methods Supported
- **Cash** — direct cash payment
- **Cheque** — enter cheque number and expected deposit date
- **Bank Transfer** — enter reference/transaction number
- **Mobile Money** — for digital payment apps

### Payment History
Each invoice has a collapsible **Payment History** section showing every payment recorded, including reversals. This is the complete ledger for that invoice.

### Creating a Credit Note from an Invoice
On any paid or partially-paid invoice, click **Create Credit Note** to open the credit note form pre-filled with the customer's details.

### Invoice Status Flow
```
draft → sent → partial → paid
                       ↘ overdue (if past due date)
         ↘ voided (any stage)
```

---

## Credit Notes

**Route:** `/dashboard/credit-notes`

Credit notes reduce a customer's outstanding balance — used for price corrections, loyalty discounts, or returned goods.

### Creating a Credit Note
1. Click **New Credit Note**
2. Use the searchable **Invoice combobox** to select the original invoice (optional but recommended)
3. Set **Department** (optional)
4. Add line items describing the adjustment
5. Click **Save** (creates in Draft status)

### Issuing a Credit Note
A credit note must be **Issued** before it can be applied. Click **Issue** in the action menu.

### Applying to an Invoice
1. On an issued credit note, click **Apply to Invoice**
2. Select the target invoice
3. Enter the amount to apply (can be partial)
4. Click **Apply** — the invoice balance reduces accordingly

### More Actions Menu (•••)
- Issue Credit Note (draft only)
- Print / Save PDF
- Delete / Void (status + permission dependent)

### Credit Note Status Flow
```
draft → issued → applied (fully used)
      ↘ voided
```

---

## Vendor Bills

**Route:** `/dashboard/vendor-bills`

Vendor bills track what Bettencourt's owes to suppliers like Family Food International, Albadar Grocery, WJ Enterprise, etc.

### Creating a Vendor Bill
1. Click **New Vendor Bill**
2. Select supplier from the dropdown
3. Add line items (e.g., "Chicken 50 lbs", "Rice 100 lbs")
4. Set issued date, due date, and **Department** (optional)
5. Click **Save**

### Recording a Payment on a Bill
1. Click **Pay** on the bill row (when balance is due)
2. Enter amount, method, and reference
3. Bill status updates to **Partially Paid** or **Paid** automatically

### More Actions Menu (•••)
- Edit Vendor Bill
- Print / Save PDF
- Delete Vendor Bill (permission-gated)

### Overdue Bills
Bills past their due date automatically show a red **Overdue** badge. The **Overdue AP** KPI on the Finance Dashboard always reflects the current overdue total.

### Vendor Bill Status Flow
```
draft → received → partial → paid
                           ↘ overdue
              ↘ voided
```

### Payment History
Each vendor bill has a full payment history ledger. Payments are never deleted — a reversal creates a negative entry.

---

## Recurring Templates

**Route:** `/dashboard/recurring`

Recurring templates auto-generate invoices, expenses, or vendor bills on a schedule.

### Creating a Template
1. Click **New Template**
2. Choose type: **Invoice**, **Expense**, or **Vendor Bill**
3. Fill in the template data (customer/supplier, line items, amounts)
4. Set frequency: Weekly / Bi-weekly / Monthly / Quarterly / Annually
5. Set the next run date

### Generating the Next Document
Click **Generate Next** on any active template. This creates the actual document from the template data and advances the next run date.

### Pause / Resume
Templates can be **paused** (no generation) and **resumed** at any time. The next run date is preserved when paused.

---

## Aging Report

**Route:** `/dashboard/aging`

The Aging Report shows how long invoices and vendor bills have been outstanding.

### Receivables Tab (Customers)
Unpaid customer invoices grouped by how overdue they are:

| Bucket | Description |
|--------|-------------|
| Current | Not yet due |
| 1–30 days | Up to one month overdue |
| 31–60 days | 1–2 months overdue |
| 61–90 days | 2–3 months overdue |
| 90+ days | More than 3 months overdue |

### Payables Tab (Suppliers)
Same aging breakdown but for vendor bills — shows what Bettencourt's owes and for how long.

Use the **Export CSV** button to download the aging report for accountant review.

---

## Customer Statements

**Route:** `/dashboard/customer-statements`

A customer statement shows every invoice, payment, and credit note for a specific customer in a date range, with a running balance.

### Generating a Statement
1. Select a customer from the dropdown
2. Set the date range (Start Date → End Date)
3. The statement loads automatically

### Statement Columns
| Column | Description |
|--------|-------------|
| Date | Transaction date |
| Description | Invoice #, Payment, Credit Note # |
| Reference | Invoice number or payment reference |
| Debit | Amount owed (invoice issued) |
| Credit | Amount paid or credit applied |
| Balance | Running outstanding balance |

### Printing a Statement
Click **Print Statement** to open a print-ready PDF version — same format as the vendor statement PDF.

---

## Tax Summary

**Route:** `/dashboard/tax-summary`

The Tax Summary compares VAT collected on sales invoices vs VAT paid on purchases (vendor bills + expenses).

### KPI Cards
- **Tax Collected** — VAT from paid invoices in the selected period
- **Tax Paid** — VAT from vendor bills and expenses
- **Net Tax Liability** — Collected minus Paid (what needs to be remitted)

### Period Selector
Switch between Monthly, Quarterly, and Annual views. The bar chart shows month-by-month breakdown.

---

## Budgets

**Route:** `/dashboard/budgets`

Budgets let you set spending targets per category and track actual vs budgeted amounts.

### Creating a Budget
1. Click **New Budget**
2. Name it (e.g., "March 2026 Operating Budget")
3. Set period: Monthly, Quarterly, or Annual
4. Set start and end dates
5. Add categories with:
   - **Category name** (Food Cost, Utilities, Rent, etc.)
   - **Budgeted amount** (GYD)
   - **Alert threshold** (% — e.g., 85 means alert when 85% used)

### Budget vs Actual View
Click a budget to see the full comparison:
- **Progress bars** (green = safe, amber = approaching limit, red = over budget)
- **Grouped bar chart** — budgeted vs actual per category
- **Variance table** — exact difference in GYD and percentage

---

## Expenses & Funding Sources

**Route:** `/dashboard/expenses`

The expense page has been enhanced with **Funding Sources** — who provided the cash for each expense.

### Funding Sources
Shakira's team uses multiple cash sources:
- **General Cash** — main operating cash
- **Renatta** — cash from Renatta
- **CEO** — cash from CEO
- **Pastry Section** — pastry department fund
- **Miss Bonita** — cash from Miss Bonita
- **QuickServe** — QuickServe location cash

When recording an expense, select the appropriate **Funding Source** from the dropdown. This is optional but required for the Daily Summary report.

### Managing Funding Sources
Click **Manage Sources** in the expense form to add, rename, or deactivate funding sources.

### Daily Summary View
Switch to **Daily Summary** mode (toggle at top of page) to see Shakira's expense form layout:
- Select a date using the date picker
- Expenses appear **grouped by funding source**
- Each section shows vendor, category, description, and amount
- Section subtotal per funding source
- Grand total at the bottom

### Printing the Daily Summary
Click **Print Daily Summary** to generate a printable form matching Shakira's handwritten "Bettencourt's Diner Expense Summary Form" — with signature lines for Prepared By / Checked By / Authorized By.

---

## Roles & Permissions

| Role | Finance Dashboard | Invoices / Bills / Credits | Aging / Statements / Tax | Budgets |
|------|------------------|---------------------------|-------------------------|---------|
| **Executive / Admin** | Full access | Full CRUD | Full read + export | Full CRUD |
| **Accountant** | Full access | Create, read, update | Full read + export | Read only |
| **Cashier / Warehouse** | No access | No access | No access | No access |

Accountants land on the Finance Dashboard by default when they log in.



---




**Navigate to:** Dashboard → Suppliers

Manage your full list of suppliers and vendors.

Your complete vendor list from the Vendor Register is already loaded in the system — 67 suppliers including Alabama Trading, Ansa McAl, Bank DIH Ltd, Royal Chicken-Mohamed Farms, Namilco, GPL, GT&T, GWI, and all others.

---

## Adding a New Supplier

1. Click **New Supplier**
2. Enter: Name, Contact Person, Phone, Email, Address
3. Assign categories (e.g. Food & Beverage, Utilities, Cleaning Supplies) to make expense filtering easier
4. Click **Save**

---

## Editing a Supplier

Click a supplier's name or the edit icon to update their details (phone, address, contact person, etc.).

---

## How Suppliers Are Used

- **Purchase Orders** — select the supplier when creating a new PO
- **Inventory Items** — each item can have a preferred supplier for auto-generating POs
- **Expenses** — supplier cards appear at the top of the Expenses page for one-click filtering
- **Stock Alerts** — if an item has a preferred supplier set, you can auto-generate a PO directly from the alert

---

## Vendor Detail Page

Click any supplier card to open the **Vendor Detail page** for that vendor. You can also reach it by clicking the vendor name badge in the Expenses table.

### Summary Cards

Six cards at the top update automatically when you change the time period:

| Card | Description |
|---|---|
| **Period Spend** | Total amount paid to this vendor in the selected period |
| **vs. Previous Period** | Whether spend went up (↑) or down (↓) compared to the prior equivalent window |
| **All-Time Spend** | Total amount paid since the first transaction |
| **Avg Transaction** | Average expense amount for the period |
| **Last Purchase** | When you last purchased from this vendor |
| **Largest Expense** | The single largest purchase in the selected period |

### Period Filter

Select from: **Today**, **This Week**, **This Month** (default), **Last Month**, **This Quarter**, **Last Quarter**, **This Year**, or **All Time**.

### Charts

- **Monthly Spend Trend** — Bar chart showing the last 12 months of spend
- **Spend by Category** — Horizontal bar chart showing which categories this vendor appears in for the selected period

### Transaction Table

Full list of expenses for this vendor in the selected period.

- Use the **search box** to filter by description or reference number
- Use the **Category filter** to narrow by expense category
- Click the **Date** or **Amount** column headers to sort
- A ⚠️ warning icon appears next to possible duplicate transactions (same amount within 7 days)
- The footer shows the total count and sum for the filtered results

### Actions

| Button | What it does |
|---|---|
| **Edit Vendor** | Go back to Suppliers list to edit this vendor |
| **+ Add Expense** | Open a form to record a new expense for this vendor (vendor pre-filled) |
| **View Statement** | Preview a vendor statement in a popup modal |
| **Print Statement** | Generate and download a PDF vendor statement |
| **Export CSV** | Download the filtered transactions as a CSV file |

> **Tip:** Press `Esc` to return to the Suppliers list.



---




## Reports

**Navigate to:** Dashboard → Reports

The main reports hub with multiple sub-reports and charts.

### Sales Report

Shows sales totals for any date range:
- Total revenue, number of orders, average order value
- Breakdown by payment method (cash vs. card vs. gift card)
- Sales by department/category
- Top-selling products

Use the date preset buttons (Today / Last 7 Days / Last 30 Days / Custom) to select the period.

### Report Types

The system generates 13 core report types:

| Report | Description |
|--------|-------------|
| Summary | Overall sales totals and averages |
| Sales by Day | Daily revenue breakdown |
| Department Totals | Revenue by department/category |
| Product Sales | Individual product performance |
| Cashier Activity | Sales per cashier |
| Sales by Payment | Cash vs card vs gift card breakdown |
| Hourly Sales | Revenue by hour of day |
| Z-Report | End-of-day financial summary (register closure report) |
| Voids | All voided orders with reasons and authorizers |
| Production | Production vs sales comparison |
| Weekly Trend | Week-over-week revenue comparison |
| Tips | Tip amounts collected by cashier and payment method |
| Customer Analytics | New vs returning customers, lifetime value |

### Exporting

Look for the **Export** or **Download CSV** button on any report tab that supports it.

---

## Analytics

**Navigate to:** Dashboard → Analytics

Advanced sales analytics with trend charts:
- Revenue trend over 30/60/90 days
- Hourly sales patterns (busiest times of day)
- Day-of-week performance (busiest days)
- ABC product analysis (A = top sellers, C = slow movers)
- Customer insights (new vs returning, frequency)
- Labor cost ratio vs. revenue
- Weekly comparison (this week vs last week)

Great for spotting trends — busiest days, peak hours, which departments are growing.

---

## Sales Journal

**Navigate to:** Dashboard → Sales Journal

A detailed, line-by-line record of every transaction — like an accounting journal. Each entry shows:
- Transaction date and time
- Order number
- Items sold
- Gross amount, discounts, taxes, net amount
- Payment method

Useful for accounting and reconciling with your bank or payment processor.

---

## Reconciliation

**Navigate to:** Dashboard → Reconciliation

Reconcile daily sales against cash counted and payment processor reports.

1. Select the date to reconcile
2. The system shows: Expected cash, card totals, gift card totals
3. Enter your actual counts from the payment processor and physical cash count
4. Any difference is flagged for review

### Reconciliation Rules

Configure tolerance thresholds in **Settings** — set acceptable variance amounts before a discrepancy triggers a warning.

---

## Variance Analysis

**Navigate to:** Dashboard → Variance

Compare expected stock levels (based on sales and production data) against actual stock (from physical counts):
- **Green** — within tolerance
- **Red** — significant variance requiring investigation

Click any item to see its detailed movement history and identify where discrepancies occurred.

---

## Profitability

**Navigate to:** Dashboard → Profitability

Shows profit margins by product and department:
- Revenue per product
- Estimated cost (based on inventory)
- Gross profit and margin %
- Food cost percentage
- ABC classification

Helps identify which menu items are most profitable and which may need a price review. Filter by product or department view, and export to CSV.

---

## P&L Statement

**Navigate to:** Dashboard → P&L Statement

A full Profit & Loss statement for any period:

| Line | Description |
|------|-------------|
| Revenue | Total sales |
| Cost of Goods Sold (COGS) | Ingredient costs |
| **Gross Profit** | Revenue minus COGS |
| Operating Expenses | From the Expenses module (utilities, rent, etc.) |
| Labor | From time clock data |
| **Net Profit / Loss** | Gross Profit minus Expenses minus Labor |

---

## Labor Cost

**Navigate to:** Dashboard → Labor Cost

Tracks labor costs based on time clock data:
- Staff hours worked per day/week
- Hourly rates and total wages
- Labor cost as a % of revenue
- Breakdown by role
- Labor trend over time

This helps manage staffing costs relative to sales.

---

## Tips Report

**Navigate to:** Dashboard → Tips

Track tip amounts across all orders:
- Tips by cashier
- Tips by payment method
- Total tips for the selected period

---

## End of Day (EOD) Report

**Navigate to:** Dashboard → End of Day

A printable end-of-day summary designed for reconciliation and record-keeping:

- Total sales for the day
- Breakdown by payment method
- Cash drawer summary (opening float, drops, payouts, expected closing)
- Top items sold
- Shift summary (who worked, when)
- Department totals

**To print:** Click **Print** in the top right. Select a date using the date picker to view any past day.

---

## Currency Rates

**Navigate to:** Dashboard → Currency

Bettencourt's operates in Guyana Dollars (GYD). This section lets you manage exchange rates for other currencies if customers pay in USD, CAD, etc.

- Set the current exchange rate for each supported currency
- Rates are used in the POS when processing foreign currency payments



---




## Customers

**Navigate to:** Dashboard → Customers

### Adding a Customer

1. Click **New Customer**
2. Enter:
   - Name (required)
   - Phone number (required)
   - Email (optional)
   - Date of birth (optional, for birthday offers)
   - Address (optional, used for delivery orders)
3. Click **Save**

### Finding a Customer

Use the search bar to find customers by name or phone number.

### Customer Profile

Click a customer's name to see their profile:
- Contact details
- Order history (all past orders linked to this customer)
- Loyalty points balance and tier
- Gift card balances
- Price list assignment (if any)

### Linking a Customer to an Order

In New Sale, click **Add Customer** in the cart, search by name or phone, and select the customer before completing the order.

---

## Customer Statements

**Navigate to:** Dashboard → Customer Statements

Generate a detailed financial statement for any customer showing all invoices, payments, and credit notes in a date range with a running balance.

### Generating a Statement

1. Select a customer from the dropdown
2. Set the date range (Start Date → End Date)
3. The statement loads automatically

### Statement Columns

| Column | Description |
|--------|-------------|
| Date | Transaction date |
| Description | Invoice #, Payment, Credit Note # |
| Reference | Invoice number or payment reference |
| Debit | Amount owed (invoice issued) |
| Credit | Amount paid or credit applied |
| Balance | Running outstanding balance |

### Printing a Statement

Click **Print Statement** to open a print-ready PDF version.

---

## Customer Payment Ledger

Each customer has a complete **payment ledger** showing every financial transaction:
- Payments received (applied and unapplied)
- Invoice charges
- Credit note applications
- Running balance

Access the ledger from the customer profile or via the Finance section.

### Unapplied Payments

If a customer pays without specifying which invoice the payment is for, the system records an **unapplied payment**. Later, use **Allocate Payment** to apply it to specific invoices.

### Customer Balance Summary

View all customers with outstanding balances at a glance. Useful for accounts receivable management and follow-up on overdue accounts.

---

## Customer Analytics

**Navigate to:** Dashboard → Customer Analytics

Insights into customer behaviour:
- **New vs Returning** customers over time
- **Customer lifetime value** — total spend per customer
- **Visit frequency** — how often customers return
- **Top spenders** — highest-value customers

---

## Agencies & Organizations

**Navigate to:** Dashboard → Agencies (or via the quotation/invoice form)

Agencies represent business clients, government departments, or organizations that place orders:

1. Click **New Agency** (or create one directly from the quotation/invoice form)
2. Enter: Agency Name, Contact Person, Position
3. Click **Save**

Agencies can be linked to quotations and invoices. When selected, the agency name and contact person appear on the PDF alongside the individual customer name.

---

## Loyalty Program

**Navigate to:** Dashboard → Loyalty Program

### How It Works

- Customers earn points on every order (rate configured by admin)
- Points accumulate toward tiers: Bronze, Silver, Gold
- Each tier may have different earn rates or benefits

### Viewing Members

The loyalty dashboard shows all enrolled customers, their points balance, tier, and last activity date.

Click any member to see their full points history — every transaction that earned or redeemed points.

### Managing Tiers

Click the **Tiers** tab to manage tier definitions:
- Tier name (e.g., Silver)
- Minimum points required
- Points multiplier (e.g., earn 1.5x points at Silver tier)

### Redeeming Points

In New Sale, when a loyalty customer is linked to an order, a **Redeem Points** option appears at checkout. Enter the number of points to redeem.

### Leaderboard

The loyalty leaderboard ranks customers by total points earned, showing your most engaged customers.

---

## Discounts

**Navigate to:** Dashboard → Discounts

Create and manage saved discount presets used in New Sale.

### Creating a Discount

1. Click **New Discount**
2. Enter:
   - **Name** — what cashiers will see (e.g., "Staff Discount", "Senior 10%")
   - **Type** — Percentage or Fixed Amount
   - **Value** — e.g., 10 for 10%, or 500 for $500 off
   - **Minimum Order** — optional minimum cart total to qualify
   - **Active** — toggle on/off
3. Click **Save**

Discounts appear as quick-select buttons in the POS discount flow.

### Promotional Codes

Discount rules can include promotional code validation. When a customer presents a promo code, the cashier enters it at checkout and the system validates eligibility before applying the discount.

---

## Gift Cards

**Navigate to:** Dashboard → Gift Cards

### Issuing a Gift Card

1. Click **Issue Gift Card**
2. Enter or generate a unique code
3. Enter the starting balance (e.g., $5,000 GYD)
4. Process payment for the gift card amount in the POS
5. Click **Issue**

The gift card is now active and can be used at any register.

### Viewing Gift Cards

The list shows all issued gift cards with code, original balance, current balance, and status (Active / Depleted / Voided).

Click any card to see its transaction history (purchases and redemptions).

### Redeeming a Gift Card

In New Sale, choose **Gift Card** as a payment method and enter the card code. The system checks the balance and deducts accordingly.

### Transferring Balance

Gift card balances can be transferred between cards if needed.

---

## Price Lists

Assign customer-specific pricing for wholesale, VIP, or staff purchases. See the full guide: [Price Lists](/docs/pricelists)



---




## Quotations

**Navigate to:** Dashboard → Quotations

Create professional price quotations for catering orders, events, or large corporate requests. Quotations are printed as a separate PDF with a QUOTATION stamp, validity countdown, Terms & Conditions, and signature blocks.

### Creating a Quotation

1. Click **New Quotation**
2. Choose customer type: **Individual** or **Agency/Organization**
3. Fill in customer name, phone, address, and **Valid Until** date
4. (Optional) set **Agency Name**, **Contact Person**, and **Department** tag
5. Add line items with description, quantity, and unit price
6. Adjust tax rate, tax mode, and discount in the settings bar
7. Add Terms & Conditions and Notes (optional — T&Cs pull from your default settings)
8. Enter **Prepared By** (your name) — appears on the PDF
9. Click **Create**

### Tax & Discount Settings (Form)

| Field | Options | Description |
|-------|---------|-------------|
| Tax Rate | Any % | VAT percentage applied to all items |
| Tax Mode | Whole invoice / Per line / VAT-inclusive | Whether one rate applies to everything, each line can be exempt, or prices already include VAT |
| Discount Type | Percent / Fixed | Percentage discount or fixed GYD amount |
| Discount Value | Number | The discount amount |

The live **Totals** section shows Subtotal → Discount → VAT → **Total** as you type.

> **Note:** 
For VAT-inclusive pricing (Guyana standard), set Tax Mode to **VAT-inclusive**. The system extracts the tax component from each price using the formula: price × rate ÷ (1 + rate). The total stays the same — the receipt just shows the embedded VAT amount.


### Quotation Statuses

| Status | Description |
|--------|-------------|
| **Draft** | Created but not sent |
| **Sent** | Marked as sent to customer |
| **Accepted** | Customer has accepted the quotation |
| **Rejected** | Customer declined |
| **Expired** | Past the valid until date |
| **Converted** | Turned into an invoice |
| **Cancelled** | Soft-deleted / cancelled |

### Workflow Actions

Each quotation row includes a **More Actions** menu (•••) for common workflow actions:

- **Print / Save PDF** — opens a professional QUOTATION PDF in a new tab (ready to print or save)
- **Edit** — modify the quotation
- **Mark Sent** — moves status from Draft → Sent (only on drafts)
- **Accept** — marks the quotation as accepted by the customer
- **Reject** — marks the quotation as declined
- **Duplicate** — creates a new draft copy with a fresh quotation number
- **Revise** — creates a numbered revision (e.g. `-R2`, `-R3`) linked to the original
- **Convert to Invoice** — converts to an invoice (available when Sent or Accepted)
- **Cancel** — soft-deletes the quotation

### Revisions

When you revise a quotation, the system creates a new draft linked to the original via `parentQuotationId`. Revision numbers increment automatically (QUO-0042-R2, QUO-0042-R3, etc.). The revision badge appears on the PDF header so the customer can see which version they are reviewing.

### Quotation Expiry

Quotations with a **Valid Until** date that has passed are considered expired. The PDF shows a clear "EXPIRED" message and the validity countdown reflects this. The status badge on the dashboard list also shows the expired state.

### Scheduled Sending

Set a **Scheduled Send** date when creating or editing a quotation. The system will flag the quotation for sending at the specified date and time.

### PDF Output

The PDF includes:
- Brand-aware logo and company details (Foods Inc. or Home Style)
- QUOTATION stamp badge with quotation number and revision tag (if applicable)
- Validity countdown ("Valid for X more days" or "EXPIRED")
- Bill To section with customer name, agency, contact person, phone, and address
- "Prepared by" attribution
- Itemized line table with quantities, unit cost, and line totals
- Tax column (when per-line tax mode is used)
- Subtotal, discount (shown in red), VAT, and total breakdown in a highlighted box
- Notes section (italic, red text)
- Terms & Conditions section
- Signature blocks for "Received By" and "Authorized By"
- "This is a quotation only — not a tax invoice" footer disclaimer
- **Ink Saver** toggle — switch the PDF to greyscale for lower printing costs

---

## Invoices

**Navigate to:** Dashboard → Invoices

Manage formal invoices for catering, corporate orders, or accounts receivable. Invoices support VAT, discounts, payment terms, cheque tracking, and full payment history.

### Creating an Invoice

1. Click **New Invoice**
2. Fill in customer details (name, phone, address)
3. Set **Issued Date** and **Due Date**
4. (Optional) set a custom invoice number and open **Agency / Organization** details
5. Add line items
6. Adjust tax rate, discount, payment terms, and **Department**
7. Add **Prepared By** name (optional)
8. Click **Create**

### Aging Summary Cards

At the top of the page, four cards show:
- **Outstanding** — total unpaid balance
- **Overdue** — unpaid past due date (shown in red if > 0)
- **Paid This Month** — cash collected this month
- **Drafts** — count of draft invoices

### Invoice Statuses

| Status | Description |
|--------|-------------|
| **Draft** | Not yet sent |
| **Sent** | Sent to customer |
| **Outstanding** | Past due and unpaid |
| **Paid** | Fully paid |
| **Overpaid** | Paid more than total |
| **Cancelled** | Voided/cancelled |

### Recording a Payment

1. Click an invoice row to open the detail panel
2. In the **Record Payment** card at the bottom, enter:
   - **Amount Paid** — partial or full payment
   - **Payment Method** — Cash, Cheque, Bank Transfer, or Mobile Money
   - **Cheque Number** — optional
   - **Receipt Number** — optional
   - **Date Paid** — defaults to today
   - **Cheque Deposit Date** — if applicable
3. Click **Record Payment**

### Payment History & Reversals

Each invoice has a collapsible **Payment History** section showing every payment recorded, including reversals. Payments are never deleted — a reversal creates a negative entry for a complete audit trail.

### Unapplied Payments

If a customer pays without specifying an invoice, record an **unapplied payment** from the customer's payment ledger. Later, allocate it to specific invoices as needed.

### Creating a Credit Note from an Invoice

On any paid or partially-paid invoice, click **Create Credit Note** to open the credit note form pre-filled with the customer's details.

### Converting a Quotation to an Invoice

From the Quotations page, click **Convert to Invoice** on any Sent or Accepted quotation. The system creates a new invoice pre-filled with the quotation's customer details, line items, tax settings, and discount. The original quotation status changes to "Converted" with a link to the generated invoice.

### More Actions Menu (•••)

- **Print / Save PDF** — professional INVOICE PDF with company letterhead
- **Edit Invoice** — modify the invoice
- **Mark as Sent** — moves Draft → Sent
- **Duplicate** — creates a new draft copy of the invoice
- **Copy Reminder** — copies a payment reminder message to clipboard
- **Delete** — permission-gated

### PDF Output

The invoice PDF includes:
- Dark header band with logo, INVOICE stamp, number, issued/due dates, payment terms, and status badge
- Bill To section with customer details
- Itemized line table
- Subtotal, discount, VAT breakdown, total, amount paid, and **Balance Due**
- Payment history table (date, method, reference, amount) if payments have been recorded
- Payment Instructions (bank name, account, reference) — if configured in Settings → Documents
- Notes section
- Footer with generation timestamp

---

## Document Settings

**Navigate to:** Settings → Documents

Configure invoice and quotation defaults:

| Setting | Description |
|---------|-------------|
| Default Tax Rate | Pre-fills the tax rate on new documents |
| Default Tax Mode | Whole invoice, per-line, or VAT-inclusive |
| Default Payment Terms | Due on Receipt / Net 15 / Net 30 / Net 60 |
| Default Discount Type | Percent or fixed |
| Company TIN | Appears on PDFs |
| Bank Name / Account / Branch | Payment instructions on invoice PDFs |
| Payment Instructions | Free-text payment notes |
| Default Quotation Terms | Pre-fills T&Cs on new quotations |
| Invoice Footer Note | Custom footer text on invoice PDFs |
| Quotation Footer Note | Custom footer text on quotation PDFs |



---




**Navigate to:** Dashboard → Settings

> Settings are restricted to **Managers and Administrators** only.

---

## Products Tab

Manage all products sold at the POS.

### Adding a Product

1. Click **New Product**
2. Enter:
   - Name
   - Price (GYD)
   - Department/Category
   - Tax rate
   - Barcode (optional — for scanner input)
   - Modifier groups (if applicable)
   - Recipe/components (for combo products)
3. Click **Save**

### Editing a Product

Click the product name → change any fields → click **Save**. Price changes take effect immediately on the POS.

### Deactivating a Product

Toggle the **Active** switch off. Inactive products are hidden from the POS grid but remain in order history and reports.

### Combo Products

Combo products bundle multiple items at a package price:
1. Create a new product
2. In the **Components** section, add the individual products and quantities that make up the combo
3. Set the combo price (typically less than buying components individually)
4. The POS shows it as one item; production tracking splits it into components automatically

---

## Categories (Departments) Tab

Organize products into departments (e.g., Chicken, Fish, Pastry, Beverages).

### Adding a Category

1. Click **New Category**
2. Enter a name and sort order (controls order of tabs in the POS)
3. Click **Save**

---

## Modifiers Tab

Modifier groups let customers customize products (e.g., "Spice Level: Mild / Medium / Hot").

### Creating a Modifier Group

1. Click **New Group**
2. Enter the group name
3. Set:
   - **Min selections** — 0 = optional
   - **Max selections** — 1 = single choice, 3+ = multi-select
4. Add modifier options (name + price)
5. Click **Save**

### Linking Modifiers to Products

Open a product → find the Modifier Groups field → add the groups that apply.

---

## Users Tab

Manage staff accounts.

### Adding a New User

1. Click **New User**
2. Enter: Name, Email, Role, PIN (4–8 digits)
3. Click **Save**
4. The user can log in immediately

### Built-in Roles

| Role | Access |
|------|--------|
| **Cashier** | POS, orders, time clock |
| **Admin** | Cashier abilities + reports, settings, inventory |
| **Executive** | Full access including all financial reports and user management |
| **Kitchen/Checkoff** | KDS and production access only |
| **Warehouse** | Inventory and purchase order access only |
| **Accountant** | Reports and expenses access only |

### Custom Roles

For more granular control, create custom roles:
1. Go to **Settings → Roles**
2. Click **New Role**
3. Name the role and select permissions from 30+ resource categories (e.g., orders.read, products.write, invoices.create, reports.view)
4. Save the role and assign it to users

Custom roles allow you to create combinations not covered by the built-in roles — for example, a "Shift Supervisor" who can access POS, orders, cash control, and limited reports but not full settings.

### Resetting a PIN

Click a user's name → change the PIN field → Save.

---

## Registers Tab

Manage POS registers (terminals).

1. Click **New Register**
2. Enter a name (e.g., "Meals POS", "Pastry Counter")
3. Assign a location
4. Click **Save**

---

## Tax Rates Tab

Define sales tax rates.

1. Click **New Rate**
2. Enter a name (e.g., "VAT 16%") and the rate percentage
3. Set as default if it applies to most products
4. Click **Save**

---

## Receipt Configuration Tab

Customize what prints on customer receipts:
- Business name
- Tagline / slogan
- Address lines
- Phone number
- Footer message (e.g., "Thank you for choosing Bettencourt's!")
- Promotional message (printed at the bottom of the receipt)

---

## Document Settings Tab

Configure defaults for invoices and quotations. See [Quotations & Invoices → Document Settings](/docs/commerce) for the full list of options including tax rates, payment terms, TIN, bank details, and footer notes.

---

## Tables Tab

Add and manage dine-in tables:

1. Add tables with a name/number and capacity
2. Tables appear in the POS when order type is set to Dine In
3. See [Floor Plans & Table Layout](/docs/floor-plan) for visual table management

---

## Currency & Exchange Rates

**Navigate to:** Settings → Currency

Guyana operates in GYD. If you accept foreign currency payments (USD, CAD, etc.), set exchange rates here. The POS will convert foreign amounts to GYD at the configured rate.

---

## Workspace Preferences

**Navigate to:** Dashboard → Settings → My Workspace (or Settings → Users → select yourself)

Each user can choose a **default landing page** — the first page they see after logging in.

Available options: Dashboard, New Sale, Orders, Kitchen Display, Inventory, Reports, Cash Control, Invoices.

The preference is saved per user and per device. Cashiers on a fixed register might set New Sale as their default; kitchen staff might prefer Kitchen Display.

---

## Locations

**Navigate to:** Dashboard → Locations (under System)

Manage your store locations. Each location has its own registers, cash sessions, and inventory.

- View current location details (name, address)
- Contact KareTech Solutions to add a new location

---

## Printers

**Navigate to:** Dashboard → Settings → Printers

Configure receipt printers and print routing (which departments print to which printer). See the full guide: [Receipt Printers & Print Routing](/docs/printers)

---

## Webhooks

**Navigate to:** Dashboard → System → Webhooks

Connect the POS to external systems (accounting software, Slack, Zapier, etc.) by sending automatic POST requests when events happen. See the full guide: [Webhooks](/docs/webhooks)

---

## Notifications (SMS / WhatsApp)

**Navigate to:** Dashboard → System → Notifications

Send automatic SMS or WhatsApp messages to customers when their order is ready, when they earn loyalty points, or when a refund is processed. See the full guide: [Notifications](/docs/notifications)

---

## Backup

**Navigate to:** Dashboard → System → Backup

Manage database backups and restore from snapshots. See the full guide: [Backup & Restore](/docs/backup)



---




**Navigate to:** Dashboard → Settings → Printers

> Printer management is restricted to **Managers and Administrators**.

Bettencourt POS supports ESC/POS thermal printers connected over your local network. Print routing lets you send different departments to different printers — for example, food orders to the kitchen printer and beverages to the bar printer, while the receipt printer handles customer receipts.

---

## Adding a Printer

1. Click **New Printer**
2. Fill in the fields:

| Field | Description |
|-------|-------------|
| **Name** | A recognisable label (e.g., "Kitchen Printer", "Bar Printer", "Main Receipt") |
| **Connection Type** | Select **Network** for a network-connected printer |
| **IP Address / Hostname** | The printer's IP address on your local network (e.g., `192.168.1.50`) |
| **Paper Width** | **80mm** (most thermal printers) or **58mm** for narrow receipt rolls |
| **Auto Cut** | Toggle on to automatically cut paper after each print |
| **Location** | The store location this printer belongs to |

3. Click **Save**

> **Note:** 
To find your printer's IP address, print a self-test page from the printer (usually by holding the Feed button on power-up). The IP address is printed on the test sheet.


---

## Setting Up Print Routes

Print routes define which product department prints to which printer. Without a route, all items print to whichever printer the POS uses by default.

### Assigning Departments to a Printer

1. Open a printer from the list
2. In the **Print Routes** section, click **Edit Routes**
3. Select one or more departments (e.g., "Chicken", "Fish", "Beverages")
4. Click **Save Routes**

Each department can only be routed to one printer at a time.

### Common Routing Example

| Printer | Departments Routed |
|---------|-------------------|
| Kitchen Printer | Chicken, Fish, Pastry, Specials |
| Bar Printer | Beverages, Juices |
| Main Receipt | (used for customer receipts — no department routes needed) |

---

## Test Print

To verify a printer is reachable and printing correctly:

1. Open the printer from the list
2. Click **Test Print**
3. The printer should immediately print a short test page showing the printer name, connection type, paper width, and timestamp

---

## Troubleshooting

### Printer Not Responding

1. Confirm the printer is powered on and connected to the same network as the POS
2. Try pinging the printer's IP address from any device on the network
3. Check that the IP address entered in the POS matches what is printed on the printer's test page
4. Some printers require a static IP — check your router's DHCP reservations

### Garbled Output or Strange Characters

- Confirm the printer supports **ESC/POS** command set (most modern thermal printers do)
- Try switching the **Paper Width** setting to match your actual paper roll (58mm vs 80mm)

### Kitchen Printer Not Printing Orders

- Confirm the relevant departments have a route assigned to the kitchen printer (Settings → Printers → open the printer → Print Routes)
- Confirm the printer's **Active** toggle is on
- Run a **Test Print** to verify the printer is reachable

---

## QZ Tray (Browser Printing)

For environments where the POS runs in a standard web browser on a Windows machine, **QZ Tray** enables direct communication between the browser and USB or network printers without a print dialog.

QZ Tray must be installed on each Windows terminal that needs direct printing. Contact KareTech Solutions to arrange installation and configuration.



---




**Navigate to:** Dashboard → Price Lists

> Price list management requires **Admin** or **Executive** role.

Price lists let you offer different prices to different customers. Use them for wholesale pricing, VIP discounts, staff pricing, or any scenario where certain customers pay differently from the standard menu price.

---

## How Pricing Works

When a customer is linked to an order at the POS, the system checks for a price list assignment:

1. **Customer has a price list** → uses the price list price for each product
2. **Product not in the price list** → falls back to the standard product price
3. **No customer linked** → always uses the standard product price

---

## Creating a Price List

1. Click **New Price List**
2. Enter a **Name** (e.g., "Wholesale", "VIP", "Staff Pricing")
3. Click **Save**

### Adding Products to a Price List

1. Open the price list
2. Click **Add Items**
3. Search and select products
4. Set the custom price for each product (in GYD)
5. Click **Save**

You can add as many or as few products as needed. Only products explicitly added get custom pricing; everything else uses the standard price.

---

## Assigning a Price List to a Customer

1. Go to **Customers**
2. Open a customer profile
3. In the **Price List** field, select the desired price list
4. Click **Save**

Once assigned, the POS automatically applies that customer's prices whenever they are linked to an order.

---

## Removing a Price List Assignment

1. Open the customer profile
2. Clear the **Price List** field
3. Click **Save**

The customer will revert to standard pricing on their next order.

---

## Common Use Cases

| Price List | Purpose |
|-----------|---------|
| Wholesale | Reduced prices for bulk buyers or business accounts |
| VIP | Loyalty reward pricing for top-tier customers |
| Staff | Discounted meals for employees |
| Corporate | Negotiated rates for corporate catering clients |

---

## Tips

- Price lists stack with loyalty discounts — a VIP customer with a price list AND loyalty points can benefit from both
- Review price lists periodically to ensure they reflect current costs and margins
- You can create multiple price lists but each customer can only be assigned one at a time



---




**Navigate to:** Dashboard → Tables

> Floor plan configuration requires **Admin** or **Executive** role.

The floor plan gives you a visual overview of your dining area. See which tables are occupied, reserved, or available at a glance, and manage dine-in orders directly from the layout.

---

## Setting Up Floors

If your location has multiple dining areas (e.g., main floor, patio, upstairs), create a floor for each:

1. Go to **Tables**
2. Click **New Floor**
3. Enter a **Name** (e.g., "Main Floor", "Patio", "Private Room")
4. Click **Save**

Switch between floors using the tabs at the top of the table layout.

---

## Adding Tables

1. Select the floor
2. Click **Add Table**
3. Enter:
   - **Table Name/Number** (e.g., "T1", "Patio 3", "VIP Booth")
   - **Capacity** (number of seats)
4. Click **Save**

Tables appear on the layout with their name and capacity. You can add tables in bulk using the **Batch Add** option.

---

## Table Status

Each table shows a colour-coded status:

| Status | Colour | Meaning |
|--------|--------|---------|
| **Available** | Green | Ready for seating |
| **Occupied** | Red | Active order in progress |
| **Reserved** | Blue | Reserved for an upcoming booking |

---

## Managing Tables During Service

### Assigning an Order to a Table

When creating a **Dine In** order at the POS:

1. Select order type **Dine In**
2. Choose a table from the dropdown (or click a table on the floor plan)
3. Complete the order as usual

The table status changes to **Occupied** and shows the order total.

### Moving an Order Between Tables

If a party needs to move:

1. Click the occupied table
2. Click **Move Order**
3. Select the new table
4. The order transfers and table statuses update automatically

### Clearing a Table

After a party leaves and the bill is settled:

1. Click the occupied table
2. Click **Clear Table**
3. The table returns to **Available** status

---

## Tips

- Set up your tables to match the physical layout of your restaurant for easy reference during busy service
- Use meaningful table names that staff recognise (e.g., "Window 1", "Corner Booth")
- Review table capacity settings to ensure reservation sizing works correctly



---




## Time Clock

**Navigate to:** Dashboard → Time Clock

All staff clock in and out through the time clock.

### Clocking In/Out

1. Find your name in the staff list
2. Click **Clock In** when starting your shift
3. Click **Clock Out** when ending your shift

### Manager View

Managers can:
- View all staff clock records with date range filters
- Edit clock-in and clock-out times for corrections (e.g., if a staff member forgot to clock out)
- View total hours worked per staff member for any period
- Time clock data feeds directly into the **Labor Cost** report (Reports → Labor Cost)

### Wage Tracking

Each staff member can have an hourly rate set in their user profile. Combined with time clock data, the system calculates:
- Total wages per employee for any period
- Overall labour cost as a percentage of revenue
- Labour breakdown by role (see Reports → Labor Cost)

---

## Shift Handoffs

When one manager hands off to another during the day:

1. The outgoing manager clicks **Initiate Handoff** from the shift view
2. Select the incoming manager
3. The incoming manager receives a handoff notification
4. Click **Accept Handoff** to take over the shift

Handoffs are logged with timestamps and both managers' names, creating a clear chain of responsibility for the cash drawer throughout the day.

---

## Audit Log

**Navigate to:** Dashboard → Audit Log

A complete, read-only history of all system changes. The audit log cannot be edited or deleted.

### What Is Tracked

- Logins and logouts
- Orders created, voided, and refunded
- Product and price changes
- Settings changes
- User account changes (created, edited, PIN resets)
- Cash session events (opens, closes, drops, payouts, no-sale)
- Invoice and quotation changes
- Payment recordings and reversals
- Financial audit events (invoice lifecycle, credit note applications)

### Filtering

Use the filters to narrow the audit log:
- **User** — which staff member performed the action
- **Action type** — login, order, product, payment, etc.
- **Entity type** — filter by specific record types (order, invoice, product, etc.)
- **Date range** — from/to date picker

The audit log is the first place to check for discrepancies, suspicious activity, or investigating till variances.

---

## Menu Schedules

**Navigate to:** Settings → Menu Schedules

Control which products are available at different times of day.

### Creating a Schedule

1. Click **New Schedule**
2. Enter a name (e.g., "Breakfast", "Lunch", "Dinner")
3. Set the active days (Mon-Sun)
4. Set the time range (e.g., 06:00 to 11:00)
5. Select the products or categories available during this window
6. Click **Save**

When a schedule is active, the POS only shows products matching the current time window. Products outside any active schedule remain hidden.

---

## Custom Roles & Permissions

**Navigate to:** Settings → Roles

Beyond the six built-in roles (Cashier, Admin, Executive, Kitchen, Warehouse, Accountant), you can create custom roles with granular permissions across 30+ resource categories.

See [Settings → Custom Roles](/docs/settings#custom-roles) for the full guide.

---

## Notifications

**Navigate to:** Dashboard → System → Notifications

Full documentation: [Notifications](/docs/notifications)

Quick reference: Twilio credentials in Settings tab, edit templates with variables ({{customerName}}, {{orderNumber}}), view Log tab for message status.

---

## Webhooks

**Navigate to:** Dashboard → System → Webhooks

Full documentation: [Webhooks](/docs/webhooks)

Quick reference: add endpoint URL + select events, view delivery history (status code, response, duration), optional secret for HMAC verification.



---




**Navigate to:** Dashboard → System → Webhooks

> **For Shakira:** Webhooks are an advanced feature used to connect your POS to tools like QuickBooks, Slack, or Zapier. KareTech Solutions can set these up for you.

Webhooks let the POS automatically send data to another system whenever something happens — an order completes, stock runs low, a refund is processed. The POS sends an HTTP POST request with event details in JSON format to any URL you configure.

---

## Adding a Webhook Endpoint

1. Click **Add Endpoint**
2. Enter a **Name** (e.g., "QuickBooks Sales Feed", "Slack Inventory Alerts")
3. Paste the **URL** provided by the external service
4. Select one or more **Events** to subscribe to
5. Optionally enter a **Secret** — a shared key used to verify payloads (see Security below)
6. Click **Save**

The endpoint is immediately active and will receive events in real time.

---

## Available Events

| Event | When it fires |
|-------|---------------|
| `order.completed` | An order is fully paid |
| `order.voided` | An order is voided after payment |
| `order.refunded` | A refund is processed |
| `inventory.low_stock` | An inventory item drops below its reorder point |
| `inventory.out_of_stock` | An inventory item reaches zero |
| `cash_session.opened` | A cash shift is opened |
| `cash_session.closed` | A cash shift is closed |
| `production.logged` | A production log entry is saved |

---

## Delivery Log

The **Delivery Log** tab shows every send attempt for each endpoint:

| Column | Meaning |
|--------|---------|
| **Event** | Which event triggered the delivery |
| **Status Code** | HTTP response (200 = success, 5xx = server error, — = connection failed) |
| **Duration** | How long the request took in milliseconds |
| **Result** | Green = success, Red = failed |
| **Timestamp** | When it was sent |

Click any row to see the full request payload and the server's response body.

If a delivery failed, fix the endpoint URL and test again using the **Ping** button on the endpoint card.

---

## Webhook Security (Signatures)

When you set a **Secret** on an endpoint, every request includes an `X-Webhook-Signature` header containing an HMAC-SHA256 signature of the request body. The receiving system can verify this signature to confirm the request came from your POS and wasn't tampered with.

Example signature header:
```
X-Webhook-Signature: sha256=abc123...
```

Most integration platforms (Zapier, Make, n8n) handle signature verification automatically when you paste the secret into their settings.

---

## Toggling an Endpoint

Click the **Active** toggle next to any endpoint to pause deliveries without deleting the endpoint. Useful if an external system is temporarily down.

---

## Example Payload

Every webhook payload follows this structure:

```json
{
  "event": "order.completed",
  "timestamp": "2026-03-08T14:30:00.000Z",
  "data": {
    "orderId": "f1000000-...",
    "orderNumber": "GT-042",
    "total": "4400",
    "items": [
      { "name": "Fried Rice and Baked Chicken", "quantity": 2, "unitPrice": "2200" }
    ]
  }
}
```



---




**Navigate to:** Dashboard → System → Notifications

Send automated SMS or WhatsApp messages to customers when events happen — like when their takeaway order is ready, when they earn loyalty points, or when a refund is processed.

The system uses **Twilio** as the SMS and WhatsApp provider. Credentials must be configured before messages will send.

---

## How It Works

1. **Settings** — Connect your Twilio account (Account SID, Auth Token, phone number)
2. **Templates** — Customize the message text for each event type
3. **Automatic sending** — The POS sends the right template when a matching event occurs
4. **Log** — Every message (sent or failed) is recorded for review

---

## Setting Up Twilio (Admin Only)

> If you don't have a Twilio account, contact KareTech Solutions. They can set one up for you.

1. Go to **Notifications → Settings** tab
2. Enter your **Account SID** and **Auth Token** (from [twilio.com/console](https://twilio.com/console))
3. Enter your **From Number** — the Twilio phone number that sends SMS (e.g. `+15550001234`)
4. Optionally enter a **WhatsApp Number** if you use Twilio's WhatsApp Business API
5. Set a **Daily Limit** (default: 500) — the system stops sending if this count is reached in a day
6. Toggle **Active** to enable
7. Click **Save**

---

## Message Templates

Go to the **Templates** tab to see and edit all configured messages.

### Available Events

| Event | When the message sends |
|-------|------------------------|
| `order.ready` | When staff marks an order as Ready for pickup |
| `loyalty.earned` | When a customer earns loyalty points |
| `loyalty.redeemed` | When a customer redeems loyalty points at checkout |
| `order.refunded` | When a refund is processed for a customer's order |

### Template Variables

Use these placeholders in message text — they are filled in automatically:

| Variable | Replaced with |
|----------|---------------|
| `{{customerName}}` | Customer's first name |
| `{{orderNumber}}` | Order reference number (e.g. GT-042) |
| `{{total}}` | Order total in GYD |
| `{{points}}` | Points earned or redeemed |
| `{{totalPoints}}` | Customer's new running points total |
| `{{refundAmount}}` | Amount refunded in GYD |

### Editing a Template

1. Click the template name
2. Edit the message body — use variables in double curly braces
3. Set the **Channel**: SMS, WhatsApp, or Both
4. Toggle **Active** — inactive templates never send
5. Click **Save**

### Example Template

```
Hi {{customerName}}, your order #{{orderNumber}} is ready for pickup at Bettencourt's! 🍽️
```

> SMS messages are limited to 160 characters per segment. Longer messages are split and charged as multiple segments.

---

## Notification Log

The **Log** tab records every notification the system has attempted:

| Status | Meaning |
|--------|---------|
| **Delivered** | Successfully received by the customer's phone (confirmed by carrier) |
| **Sent** | Dispatched to Twilio — delivery confirmation pending |
| **Failed** | Error from Twilio (e.g., invalid phone number, daily limit reached) |
| **Pending** | Queued but not yet sent |

### Troubleshooting a Failed Notification

1. Open the **Log** tab and find the entry for the customer
2. Click the row to expand and see the **Error Message** from Twilio
3. Common causes:
   - Phone number not in international format (should start with country code, e.g. `+592...`)
   - Daily message limit reached — increase the limit in Settings
   - Twilio account suspended or out of credit
   - Customer's carrier blocking the message

---

## SMS vs WhatsApp

| | SMS | WhatsApp |
|-|-----|----------|
| **Requires** | Twilio From Number | Twilio WhatsApp Business number |
| **Cost** | Per message (varies by country) | Per session (24-hour window) |
| **Character limit** | 160 per segment | 4,096 characters |
| **Delivery** | Works on any phone | Requires customer has WhatsApp |
| **Best for** | Broad reach | Richer messages, media |



---




## Menu Board (TV Display)

**Access at:** [pos.karetechsolutions.com/menu-board](https://pos.karetechsolutions.com/menu-board)

This is a **public page** (no login required) designed to be displayed on a TV screen facing customers.

### Features

- Shows all active products grouped by department
- Products display name and price
- Automatically refreshes every 60 seconds to reflect price changes
- **Fullscreen button** (top right) — click to go full screen on a TV
- **Auto-scroll** — the page slowly scrolls so customers see all items; it pauses when touched or hovered

### Setting Up on a TV

1. Open a browser on the TV or connected device
2. Go to [pos.karetechsolutions.com/menu-board](https://pos.karetechsolutions.com/menu-board)
3. Click the fullscreen button
4. The display stays current as long as the browser tab is open

---

## Online Ordering

**Access at:** [pos.karetechsolutions.com/order](https://pos.karetechsolutions.com/order)

A **public page** (no login required) that customers can use from their phone or computer to place orders for pickup or delivery.

### How It Works (Customer View)

1. Customer visits the order page
2. Browses the menu — organized by department with category filter pills at top
3. Adds items to their cart
4. At checkout:
   - Selects **Pickup** or **Delivery**
   - Enters name and phone number
   - For delivery: enters delivery address
   - Reviews order and adds special instructions per item
5. Clicks **Place Order**
6. Gets an order number confirmation

The order appears in the POS system as a new order for staff to fulfill.

### Managing Online Orders in the POS

Online orders appear in the **Orders** list tagged as "Pickup" or "Delivery". The KDS also shows them for kitchen staff.

### Sharing with Customers

Send customers to **[pos.karetechsolutions.com/order](https://pos.karetechsolutions.com/order)** — or add a link/button on your WhatsApp or Facebook page.



---




**Navigate to:** Dashboard → Reservations / Dashboard → Waitlist

> Reservations and waitlist features require **Admin** or **Executive** role.

---

## Reservations

### Creating a Reservation

1. Go to **Reservations**
2. Click **New Reservation**
3. Fill in the details:

| Field | Description |
|-------|-------------|
| **Customer Name** | Guest name for the reservation |
| **Phone** | Contact number |
| **Date** | Reservation date |
| **Time** | Expected arrival time |
| **Party Size** | Number of guests |
| **Table** | Optionally pre-assign a table |
| **Notes** | Special requests (dietary needs, celebrations, etc.) |

4. Click **Save**

### Viewing Upcoming Reservations

The reservation list shows all upcoming bookings sorted by date and time. Each entry displays the customer name, party size, time, assigned table (if any), and status.

### Managing Reservations

- **Edit** — change details (time, party size, table assignment)
- **Cancel** — remove the reservation
- **Seat** — when the guest arrives, seat them at their assigned table (or choose a different one)

---

## Waitlist

The waitlist manages walk-in customers waiting for a table during busy periods.

### Adding to the Waitlist

1. Go to **Waitlist**
2. Click **Add to Waitlist**
3. Enter the customer's **Name**, **Phone**, **Party Size**, and any **Notes**
4. Click **Save**

The customer joins the queue with a timestamp. The list shows their position and estimated wait.

### Seating from the Waitlist

When a table becomes available:

1. Find the next customer on the waitlist
2. Click **Seat** to assign them a table
3. The entry is removed from the waitlist

### Position Lookup

If a customer asks about their position, use the search field to find them by name or phone number. Their current position in the queue is displayed.

---

## Integration with Floor Plan

Reservations and the waitlist work together with the floor plan (see [Floor Plans & Table Layout](/docs/floor-plan)):

- Reserved tables show a "Reserved" badge on the floor plan
- Occupied tables cannot be double-booked
- Seating a reservation or waitlist entry automatically marks the table as occupied



---




**Navigate to:** Dashboard → Orders (filter by Delivery type)

---

## Delivery Orders

### Creating a Delivery Order at the POS

1. Start a **New Sale**
2. Set order type to **Delivery**
3. Link or create a customer (the delivery address is pulled from the customer profile)
4. Add items to the cart
5. Process payment
6. The order is tagged as **Delivery** and appears in Orders and on the Kitchen Display

### Delivery Address

When order type is set to **Delivery**, the system pulls the address from the linked customer profile. If the customer has no address on file, you will be prompted to enter one.

To update a customer's delivery address:
1. Go to **Customers**
2. Open the profile
3. Update the **Address** field
4. Click **Save**

---

## Tracking Delivery Status

Delivery orders show a **fulfilment status** badge alongside the payment status:

| Status | Meaning |
|--------|---------|
| **Preparing** | Kitchen is working on the order |
| **Ready** | Order is prepared and waiting for pickup/dispatch |
| **Dispatched** | Order has left the premises |
| **Delivered** | Order has been delivered to the customer |

Update the status from the order detail view as the order progresses.

---

## Platform Integration

For businesses receiving orders from external delivery platforms, the system can display platform orders alongside regular POS orders.

### Viewing Platform Orders

1. Go to **Orders**
2. Filter by **Delivery** type
3. Platform orders are tagged with the platform name

### Processing a Platform Order

Platform orders appear in the same workflow as regular orders. They show on the Kitchen Display and follow the same preparation and status-tracking flow.

---

## Tips

- Always verify the delivery address before dispatching
- Use the **Notes** field on orders for special delivery instructions (gate code, landmark, etc.)
- Track delivery times in the order history to identify bottlenecks



---




## What Is the Desktop App?

The Bettencourt POS desktop app is a standalone Windows application built with Tauri. It provides the same interface as the browser version but runs as a native application with offline capability.

---

## When to Use the Desktop App

| Scenario | Best Option |
|----------|------------|
| Reliable internet connection | Browser (Chrome recommended) |
| Intermittent internet | Desktop app (queues transactions offline) |
| Dedicated POS terminal (no browser distractions) | Desktop app |
| Multiple tabs/services needed alongside POS | Browser |

---

## Installation

1. Download the installer from the link provided by KareTech Solutions
2. Run the installer on your Windows machine
3. Follow the setup wizard
4. The app will launch and connect to your POS server automatically

> **Note:** 
The desktop app connects to the same server as the browser version. All data stays in sync — orders placed on the desktop app appear everywhere, and vice versa.


---

## Offline Mode

When internet connectivity drops:

- The app switches to **offline mode** automatically
- You can continue taking orders and processing cash payments
- A yellow sync indicator appears in the top bar
- Once connectivity returns, all queued transactions sync automatically

**What works offline:**
- Taking new orders (cash payment)
- Viewing the product catalogue
- Viewing recent order history (locally cached)

**What requires connectivity:**
- Card payment processing
- Real-time inventory updates
- Kitchen display synchronisation
- Reports and analytics

---

## Updates

The desktop app checks for updates on startup. When a new version is available, it downloads and installs automatically. No action is required from the user.

---

## Support

If the desktop app fails to connect or behaves unexpectedly:

1. Check your internet connection
2. Restart the application
3. If the issue persists, try the browser version at **pos.karetechsolutions.com** to confirm the server is accessible
4. Contact KareTech Solutions for further assistance



---




> **Note:** 
This page is for developers integrating external systems with Bettencourt POS. For day-to-day usage, see the relevant feature pages in this manual.


---

## Overview

Bettencourt POS exposes an RPC-based API built on oRPC (OpenAPI-compatible Remote Procedure Call). All API calls go through a single endpoint with structured request/response payloads.

**Base URL:** `https://pos.karetechsolutions.com`

---

## Authentication

### PIN Login (Staff)

```
POST /api/auth/pin-login
Content-Type: application/json

{ "pin": "1234", "organizationId": "..." }
```

Returns a session cookie. Rate-limited to **5 failed attempts per IP** with a **60-second lockout**.

### Email Login (Managers)

Standard email/password authentication via the login page. Returns a session cookie used for subsequent API calls.

All API requests must include the session cookie (`credentials: "include"` for fetch, or `Cookie` header).

---

## API Endpoint

All business logic is accessed via:

```
POST /api/trpc/<router>.<procedure>
Content-Type: application/json
```

### Major Router Groups

| Router | Purpose | Key Procedures |
|--------|---------|---------------|
| **pos** | Point of sale operations | getProducts, checkout |
| **orders** | Order management | list, getById, voidOrder, refund |
| **cash** | Cash sessions | openSession, closeSession, createDrop, createPayout |
| **products** | Product catalogue | list, create, update, delete |
| **inventory** | Stock management | getStockLevels, getLedger, logWaste |
| **invoices** | Accounts receivable | list, create, recordPayment, getPaymentHistory |
| **quotations** | Proposals | list, create, convertToInvoice, revise |
| **credit-notes** | Credit memos | create, applyToInvoice, void |
| **vendor-bills** | Accounts payable | list, create, recordPayment |
| **customers** | Customer database | list, search, create, getCustomerStatement |
| **loyalty** | Loyalty program | earnPoints, redeem, getLeaderboard |
| **giftcards** | Gift cards | issue, redeem, getBalance |
| **reports** | Reporting | getReport, getEodReport |
| **analytics** | Business intelligence | getRevenueTrend, getAbcAnalysis |
| **timeclock** | Staff time tracking | clockIn, clockOut, getHistory |
| **audit** | Audit trail | list (with filtering) |
| **webhooks** | Integration endpoints | listEndpoints, createEndpoint |
| **notifications** | SMS/WhatsApp alerts | send, listTemplates |
| **settings** | Configuration | getOrganization, updatePosSettings |
| **kitchen** | Kitchen display | getActiveTickets, updateItemStatus |
| **production** | Production logs | logProduction, getProductionVsSalesReport |
| **recurring** | Recurring templates | createTemplate, generateNext |
| **printers** | Print management | list, create, testPrint, setRoutes |
| **discounts** | Discount rules | list, create, validatePromo |
| **pricelists** | Dynamic pricing | list, create, assignCustomerPricelist |
| **agencies** | Agency/org management | list, create, update |
| **tables** | Table/floor management | list, updateTableStatus, clearTable |
| **reservations** | Booking management | list, create, update |
| **waitlist** | Walk-in queue | list, create, lookupPosition |

---

## Webhooks

For event-driven integration, use webhooks instead of polling. See [Webhooks](/docs/webhooks) for setup instructions.

**Available events:**
- `order.completed`, `order.voided`, `order.refunded`
- `inventory.low_stock`, `inventory.out_of_stock`
- `cash_session.opened`, `cash_session.closed`
- `production.logged`

Each webhook delivery includes an `X-Webhook-Signature` header (HMAC-SHA256) if a secret is configured.

---

## Health Check

```
GET /health
```

Returns `200 OK` when the server is running. Use this for uptime monitoring.

---

## Rate Limiting

- PIN login: 5 attempts per IP, 60-second lockout
- General API: no hard rate limit, but excessive requests may be throttled

---

## Support

For API integration assistance, contact KareTech Solutions. Custom webhook events or API extensions can be arranged as part of your service agreement.



---




**Navigate to:** Dashboard → System → Backup

> Backup management requires **Admin** or **Executive** role.

Bettencourt POS automatically backs up your data every night at midnight (Guyana time). You can also create manual backups at any time and restore from any saved snapshot.

---

## Backup Status

The status card at the top shows:

- **Health indicator** (green/yellow/red dot):
  - **Green** — last backup is less than 25 hours old (healthy)
  - **Yellow** — last backup is 25 to 48 hours old (attention needed)
  - **Red** — no backups or last backup is older than 48 hours (action required)
- **Last backup timestamp**
- **Next scheduled backup** — midnight tonight (Guyana time)

---

## Creating a Manual Backup

1. Click **Backup Now**
2. Wait for the backup to complete (usually a few seconds)
3. The new backup appears in the history table

> **Note:** 
Create a manual backup before making major changes such as bulk product updates, price changes, or data imports.


---

## Backup History

The history table shows all available backups with:

| Column | Description |
|--------|-------------|
| **File** | Backup filename (with "pre-restore" badge if it was created automatically before a restore) |
| **Created** | Date and time the backup was created |
| **Size** | File size (e.g., 2.3 MB) |
| **Contents** | Summary of records (e.g., "342 orders, 89 products, 45 customers") |
| **Actions** | Download or Restore buttons |

Up to **7 regular backups** are kept (oldest are automatically removed). Pre-restore snapshots are kept until manually removed.

---

## Downloading a Backup

Click the **Download** button on any backup row to save the `.json.gz` file to your computer. Keep downloaded backups in a safe location as an additional off-site copy.

---

## Restoring from a Backup

> **Note:** 
Restoring a backup **replaces all current data** with the backup contents. This action cannot be undone (though a pre-restore snapshot is saved automatically).


### Restore from History

1. Click **Restore** on the desired backup row
2. Review the confirmation dialog (shows backup date and contents summary)
3. Click **Yes, Restore**
4. Wait for the restore to complete
5. Refresh your browser when prompted

### Restore from File

If you have a previously downloaded `.json.gz` backup file:

1. Scroll to **Restore from File**
2. Click **Choose File** and select your `.json.gz` backup
3. Click **Restore from File**
4. Confirm in the dialog
5. Refresh your browser when prompted

In both cases, a **pre-restore snapshot** of your current data is created automatically before the restore begins, so you can roll back if needed.

---

## Best Practices

- Verify the health indicator is green each morning
- Download a backup before any major data changes
- Keep at least one recent backup downloaded to an external location (USB drive or cloud storage)
- After restoring, verify key data (recent orders, customer records, inventory levels) to confirm the restore was successful



---




### How do I process a refund?

Go to **Orders** → find the completed order → click **Refund**. Enter the refund amount (full or partial) and a reason. The refund is recorded and reflected in reports.

### What do I do about a till variance?

At the end of your shift, enter the actual cash count during shift close. The system compares Expected vs Actual and records the variance (overage or shortage). Report significant variances to your manager.

### How do I void a paid order?

Go to **Orders** → find the order → click **Void Order**. Only Admins and Executives can void. Enter a reason. The void is permanent and logged in the audit trail.

### How do I hide a sold-out product?

Go to **Settings → Products** → find the product → toggle **Active** off. The product disappears from the POS grid but remains in order history.

### How do I add a new staff member?

Go to **Settings → Users → New User**. Enter name, email, role, and PIN (4-8 digits). They can log in immediately.

### How do I reset a staff member's PIN?

Go to **Settings → Users** → click the user → change the PIN field → Save.

### How do I view past sales?

Go to **Reports → Sales Report** → use the date picker to select any past period. Filter by department, payment method, or cashier.

### How do I print the End of Day summary?

Go to **Reports → End of Day** → select the date → click **Print**. You can print any past day's summary.

### How can I find which cashier handled a specific order?

Go to **Orders** → open the order → the "Served by" field shows which cashier processed it.

### How do I check a gift card balance?

Go to **Gift Cards** → search by the gift card code. The card shows original balance, current balance, and full transaction history.

### Why isn't a customer earning loyalty points?

Go to **Loyalty Program** → search for the customer → check their points history. Ensure the customer was linked to the order before checkout (Add Customer in the cart). Points only accrue on completed orders.

### How do I change a product price?

Go to **Settings → Products** → click the product → update the price → Save. The new price takes effect immediately on the POS.

### How can I see who opened or closed the cash drawer?

Go to **Cash Control → Shift History** for shift opens/closes. For no-sale drawer openings, check the **Audit Log** (filter by "no-sale").

### How do I see a breakdown of expenses by supplier?

Go to **Expenses** → click a supplier card at the top to filter all expenses from that supplier. Or click a vendor badge in the table to open the Vendor Detail page with charts and analytics.

### The POS is not loading — what should I do?

1. Press F5 to refresh the browser
2. Check your internet connection
3. Try a different browser (Chrome recommended)
4. If using the desktop app, check the sync indicator
5. Contact KareTech Solutions if the issue persists

### Can I use the system on a tablet or phone?

Yes. The interface is responsive and works on screens 10 inches and larger. For the best experience on a dedicated terminal, use the desktop app or a full browser on a laptop/desktop.

### What is the Ctrl+K shortcut?

Ctrl+K opens the **Command Palette** — a quick search that lets you jump to any page in the system instantly. Type "Orders", "Inventory", "Reports", etc.

### I entered my PIN wrong too many times. What now?

After 5 failed PIN attempts, there is a 60-second lockout per IP. Wait 60 seconds and try again. Alternatively, use email login (managers only). If you have forgotten your PIN, ask a manager to reset it in Settings → Users.

### An SMS notification shows "Failed" — what happened?

Go to **Notifications → Log** tab → search for the phone number. Common causes: phone number not in international format, daily sending limit reached, Twilio account suspended, or carrier blocking. Verify the phone format starts with +592 for Guyana.

### How do I connect the POS to my accounting software?

Go to **System → Webhooks** → add an endpoint with the URL from your accounting platform. Select the events to send (order completed, payment recorded, etc.). Contact KareTech Solutions for custom integration setup.

### How do I set my default startup page?

Go to **Settings → My Workspace** → select your preferred landing page from the dropdown (Dashboard, New Sale, Orders, Kitchen Display, etc.).

### How do I display the menu on a TV?

Navigate to **pos.karetechsolutions.com/menu-board** on a browser connected to your TV → click the fullscreen button. The menu refreshes automatically.

### How do I share the online ordering link?

Your online ordering page is at **pos.karetechsolutions.com/order**. Share this link via WhatsApp, Facebook, or print it as a QR code for in-store display.

---

## New Features FAQ

### How do I create a recurring invoice?

Go to **Finance → Recurring Templates → New Template**. Choose type "Invoice", fill in the customer and line items, set the frequency (weekly, monthly, etc.), and set the next run date. Click **Generate Next** each cycle to create the actual invoice from the template.

### How do I assign a price list to a customer?

Go to **Customers** → open the customer profile → select a price list in the **Price List** field → Save. The customer will automatically receive their custom prices at the POS. See [Price Lists](/docs/pricelists).

### What are combo products and how do they work?

Combo products bundle multiple items at a package price (e.g., "Lunch Deal: Main + Side + Drink"). Create one in **Settings → Products** by adding components. The POS shows it as a single item at the combo price, while production tracking splits it into individual components for the kitchen.

### How do I set up receipt printers?

Go to **Settings → Printers → New Printer**. Enter the printer name, IP address, and paper width. Then set up **Print Routes** to control which departments print to which printer. See [Printers](/docs/printers) for the full guide.

### Can I use the system offline?

Yes, with the **desktop app** (Tauri). It runs as a standalone Windows application and continues taking cash orders when internet drops. Transactions sync automatically when connectivity returns. See [Desktop App](/docs/desktop-app).

### How do I generate a customer statement?

Go to **Finance → Customer Statements** → select the customer → set a date range. The statement shows all invoices, payments, and credit notes with a running balance. Click **Print Statement** for a PDF.

### How do I back up my data?

Go to **System → Backup**. The system backs up automatically every night at midnight. You can also click **Backup Now** for an immediate snapshot. Download any backup as a `.json.gz` file for off-site storage. See [Backup & Restore](/docs/backup).

**Q: How do I create a recurring invoice?**

Go to **Finance → Recurring Templates → New Template**. Choose "Invoice" as the type, fill in the customer and line items, then set the frequency (weekly, monthly, quarterly, etc.). Click **Generate Next** each time you need to create the next invoice from the template.

---

**Q: How do I give a customer special pricing (wholesale, VIP)?**

Go to **Price Lists → New Price List**, add products with custom prices, then assign the price list to the customer in their profile. Whenever that customer is linked to an order at the POS, their special prices apply automatically.

---

**Q: What are combo products and how do they work?**

Combo products are menu items made of multiple components (e.g., "Fried Rice & Chicken Meal" = rice + chicken + drink). They sell as one item at one price, but the kitchen checkoff board splits them into individual components for preparation tracking.

---

**Q: How do I set up receipt printers?**

Go to **Settings → Printers → New Printer**. Enter the printer's name, IP address, and paper width. Then set up print routes to direct different departments (meals, beverages, etc.) to specific printers. See [Printers](/docs/printers) for the full guide.

---

**Q: Can I use the system offline?**

Yes. The desktop app (Tauri) supports offline mode. You can continue taking cash orders when the internet is down. Transactions sync automatically when connectivity returns. See [Desktop App](/docs/desktop-app) for details.

---

**Q: How do I generate a customer statement?**

Go to **Finance → Customer Statements**, select the customer from the dropdown, set the date range, and the statement loads automatically. Click **Print Statement** for a PDF version.

---

**Q: How do I back up my data?**

Go to **System → Backup**. Backups run automatically every night at midnight. You can also click **Backup Now** for a manual backup, and download any backup to your computer. See [Backup](/docs/backup) for the full guide.

---

**Q: How do I make a reservation?**

Go to **Reservations → New Reservation**. Enter the customer name, phone, date, time, party size, and any special notes. See [Reservations](/docs/reservations) for the full guide.



---


