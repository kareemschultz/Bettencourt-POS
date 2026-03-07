# Bettencourt's POS — Complete User Manual

**For:** Shakira & Staff at Bettencourt's Food Inc.
**System:** Bettencourt POS at https://pos.karetechsolutions.com
**Last Updated:** March 2026

---

## Table of Contents

1. [Getting Started — Logging In](#1-getting-started--logging-in)
2. [Dashboard (Home)](#2-dashboard-home)
3. [POS Terminal (Taking Orders)](#3-pos-terminal-taking-orders)
4. [Orders](#4-orders)
5. [Kitchen Display System (KDS)](#5-kitchen-display-system-kds)
6. [Production Dashboard](#6-production-dashboard)
7. [Cash Control](#7-cash-control)
8. [Inventory](#8-inventory)
9. [Stock Alerts](#9-stock-alerts)
10. [Waste Log](#10-waste-log)
11. [Variance Report](#11-variance-report)
12. [Suppliers](#12-suppliers)
13. [Labels](#13-labels)
14. [Reports](#14-reports)
15. [Analytics](#15-analytics)
16. [Sales Journal](#16-sales-journal)
17. [Reconciliation](#17-reconciliation)
18. [Profitability](#18-profitability)
19. [P&L Statement](#19-pl-statement)
20. [Labor Cost](#20-labor-cost)
21. [End of Day (EOD) Report](#21-end-of-day-eod-report)
22. [Expenses](#22-expenses)
23. [Currency Rates](#23-currency-rates)
24. [Customers](#24-customers)
25. [Loyalty Program](#25-loyalty-program)
26. [Discounts](#26-discounts)
27. [Gift Cards](#27-gift-cards)
28. [Quotations](#28-quotations)
29. [Invoices](#29-invoices)
30. [Time Clock](#30-time-clock)
31. [Settings](#31-settings)
32. [Locations](#32-locations)
33. [Audit Log](#33-audit-log)
34. [Menu Schedules](#34-menu-schedules)
35. [Tables](#35-tables)
36. [Notifications](#36-notifications)
37. [Menu Board (TV Display)](#37-menu-board-tv-display)
38. [Online Ordering](#38-online-ordering)
39. [Frequently Asked Questions](#39-frequently-asked-questions)
40. [Getting Help](#40-getting-help)

---

## 1. Getting Started — Logging In

Go to **https://pos.karetechsolutions.com** in any web browser.

### PIN Login (Quick — for cashiers & kitchen staff)

1. On the login screen, enter your 4–8 digit PIN
2. Tap **Login**

> If your PIN doesn't work, ask the manager to check it in Settings → Users.

### Email Login (For managers and administrators)

1. Click **Sign in with Email** on the login screen
2. Enter your email address and password
3. Click **Sign In**

### Logging Out

Click your name at the bottom of the left sidebar, then click **Sign Out**.

---

## 2. Dashboard (Home)

After logging in, you see the **Dashboard** — your daily overview.

**What you see:**
- Today's total sales, total orders, and average order value
- Hourly sales chart (bars = revenue, line = order count)
- Top-selling products for today
- Quick-action cards to start common tasks

**Sidebar Navigation:**
Use the left sidebar to move between sections. You can search the sidebar by typing in the search box at the top.

> The sidebar only shows sections your role has permission to access. Cashiers see fewer options than managers.

---

## 3. POS Terminal (Taking Orders)

**Navigate to:** POS Terminal (or click "Open POS" from the Dashboard)

This is the main screen for taking orders. It has two main parts:
- **Left/Center:** Product grid organized by category
- **Right panel:** The current order cart

### Starting a New Order

The POS opens with an empty cart ready to go. If you have an order in progress, click **+ New** (top of cart) to start a fresh order.

### Browsing Products

- Category tabs run across the top of the product grid
- Click a category tab to filter to those products
- Use the **Search** bar above the grid to find a product by name

### Adding Items to the Cart

- Click any product button to add it once
- Click again to add another unit
- If a product has **modifiers** (e.g., spice level, size, add-ons), a popup appears — select your options and click **Add to Cart**

### Editing Cart Items

In the cart on the right:
- Click **+** or **-** next to an item to change quantity
- Click the **pencil icon** (or the item name) to edit quantity or add a note
- Click the **trash icon** to remove an item
- Click **Add Note** on a line item to add a special instruction (e.g., "no onions")

### Applying a Discount

1. With items in the cart, click **Discount**
2. Choose from your saved discount presets, or enter a custom amount (percentage or fixed $)
3. The discount appears in the cart total

> Discounts require manager permission if they exceed the cashier's limit.

### Applying a Modifier Override / Supervisor Approval

If a discount or action requires manager approval, a dialog box will ask for a manager PIN or email login to authorize.

### Selecting Order Type

At the top of the cart, you can select the order type:
- **Dine In** — for table orders
- **Takeaway** — for counter pickup
- **Delivery** — for delivery orders (prompts for customer name, phone, address)

### Processing Payment

1. Review the cart items and total
2. Click **Charge**
3. The payment dialog opens — choose method(s):
   - **Cash** — enter the amount the customer hands you; the system shows the change due
   - **Card** — confirm the amount, process on your physical card terminal
   - **Gift Card** — enter the gift card number; it deducts from the card balance
   - **Split Payment** — click **Add Payment** to split across multiple methods (e.g., part cash, part card)
4. Click **Complete Order**

The order is saved. A receipt preview appears.

### Printing a Receipt

After payment, the receipt preview shows automatically. Click **Print** to send it to your printer.

### Split Bill

After completing an order, the receipt preview has a **Split** button:
1. Click **Split**
2. Choose how to split:
   - **Equal Split** — divide total evenly among N people
   - **By Item** — assign specific items to each person
   - **Custom Amounts** — enter custom dollar amounts per person
3. Each split portion can be paid separately

### Holding an Order

Click **Hold** (at the bottom of the cart) to save the order without charging. You can retrieve held orders later by clicking the **Held Orders** button (stack icon at top of cart).

### Voiding an Item (Before Payment)

Click the trash icon next to any cart item to remove it. This does not record a void — the item simply hasn't been charged yet.

### Voiding an Order After Payment

Go to **Orders**, find the order, click it, then click **Void Order**. See [Section 4 — Orders](#4-orders).

### Linking a Customer to an Order

Click **Add Customer** in the cart area, search by name or phone, and select the customer. Their loyalty points will be updated automatically when the order completes.

---

## 4. Orders

**Navigate to:** Dashboard → Orders

### Viewing Orders

- All orders are listed with order number, date, total, and status
- **Status colors:** Green = Completed, Yellow = Open/Held, Red = Voided, Blue = Refunded
- Use the **search bar** to find by order number or customer name
- Use **date filters** to view a specific day or date range
- Use the **status filter** to show only voided orders, refunds, etc.

### Viewing Order Details

Click any order row to open its details:
- All items with quantities and line totals
- Payment method(s) used
- Customer name (if linked)
- Cashier who processed it
- Timestamps

### Voiding an Order

1. Open the order details
2. Click **Void Order**
3. A confirmation dialog appears — click **Confirm Void**
4. The order is marked as voided and removed from sales totals

> Only managers can void completed orders. Cashiers can remove items before payment.

### Refunding an Order

1. Open the order details
2. Click **Refund**
3. Enter the refund amount (can be partial)
4. Confirm
5. The refund is recorded and the order status changes to Refunded

---

## 5. Kitchen Display System (KDS)

**Navigate to:** Dashboard → Kitchen Display

The KDS is designed to be shown on a screen in the kitchen. It displays all active orders in real time.

### How It Works

- Each order appears as a **ticket** showing: order number, time received, items, and any special notes
- Tickets are colored by how long they've been waiting:
  - **Gray/White** — fresh order
  - **Yellow** — waiting more than a few minutes
  - **Red** — waiting too long
- Click an individual item to mark it as **prepared** (it dims/checks off)
- When all items on a ticket are prepared, click **Mark Ready** — the ticket turns green and the server is notified

### Filtering by Department

The KDS can show tickets for your specific station. Use the department filter at the top to show only "Meals", "Pastry", etc.

### Auto-Refresh

The KDS automatically refreshes every few seconds. No manual refresh needed.

---

## 6. Production Dashboard (Check Off)

**Navigate to:** Dashboard → Production

Used by kitchen and bakery managers to log how much was produced each day and compare it against what the POS actually sold.

### Workflow Tabs

At the top of the screen there are two tabs:
- **Restaurant → Food** — shows all food products (soups, mains, sides, etc.)
- **Bakery → Pastry** — shows all bakery/pastry products

Only products belonging to the selected workflow are shown, so the kitchen and bakery teams can work independently without interfering with each other.

### Entry Types

The three coloured buttons at the top select what you are logging:

| Button | Colour | When to use |
|--------|--------|-------------|
| **Opening** | Blue | First thing in the morning — how much you made for the day |
| **Reorder** | Amber | Mid-day top-up when you cook more |
| **Closing** | Green | End of day — leftover / damage / spoilage |

### Logging a Product

1. Tap the entry type (Opening / Reorder / Closing)
2. Optionally use the department pills to filter to a specific section
3. Tap any product card — a number pad dialog opens
4. Enter the quantity using the numpad, quick-quantity buttons (5 / 10 / 20 / 25 / 50), or the +/− fine-tune buttons
5. Add a note if needed (e.g. "burnt batch")
6. Tap **Log** to save

After saving, the product card shows a "Made" badge with the running total for the day.

### Combo Products (Split Items)

Some products — like "Fried Rice and Baked Chicken" or "Cookup Baked Snapper" — are combos made up of two individual items. These cards show an amber **stacked layers** icon and a "splits into components" label.

When you log a quantity for a combo product, the system **automatically splits it** into its individual components:

> *Example: Log 10 × "Fried Rice and Baked Chicken" (Opening)*
> The system records:
> → 10 × Fried Rice (Opening)
> → 10 × Baked Chicken (Opening)

Before you confirm, the dialog shows exactly how the split will be recorded, and the button reads **"Split X → N items"** so you always know what will happen.

This means the Production Report can correctly compare what was made (each individual component) against what the POS sold — even when customers order the combo version.

### Production Report

**Navigate to:** Dashboard → Production Report

Compares what the kitchen logged (Opening + Reorder − Closing = Expected Sold) against what the POS terminal actually rang up as sold. Use the **Restaurant / Bakery** tabs and the date picker to select the period.

Colour-coded variance badges show:
- **Grey (0)** — balanced: sales match production
- **Red (negative)** — short: more was rung up than produced
- **Amber (positive)** — over: more was produced than sold (possible waste)

The report can be printed using the **Print** button.

---

## 7. Cash Control

**Navigate to:** Dashboard → Cash Control

Manages cash drawer sessions (shifts), cash drops, payouts, and no-sale events.

### Opening a Shift

Do this at the start of each working day or when a new cashier takes over:

1. Click **Open Shift**
2. Count the starting cash in the drawer and enter the amount
3. Click **Open Shift**

> The system tracks all sales and cash movements during the shift.

### Recording a Cash Drop

When the drawer has too much cash and you want to move some to the safe:

1. Click **Cash Drop**
2. Enter the amount you're removing
3. Enter a reason (e.g., "moved to safe")
4. Click **Record Drop**

### Recording a Payout

When you pay someone from the cash drawer (e.g., petty cash for a delivery fee):

1. Click **Payout**
2. Enter the amount paid out
3. Enter who/why (e.g., "supplier delivery fee")
4. Click **Record Payout**

### No Sale / Opening the Drawer Without a Transaction

When you need to open the drawer without processing a sale (e.g., to give change, at manager request):

1. Click **No Sale**
2. Enter a reason (optional but recommended)
3. Click **Log No Sale**

> Every drawer-open event is logged for security. All no-sale events appear in the Cash Control audit trail.

### Closing a Shift

At the end of the day or shift:

1. Click **Close Shift**
2. Count all the cash in the drawer
3. Enter the actual cash count
4. The system shows **Expected** vs. **Actual** cash
5. Any difference is recorded as overage (too much) or shortage (too little)
6. Click **Close Shift**

### Shift History

Below the current shift, a table shows all past shifts with:
- Who opened/closed
- Opening float
- Expected cash
- Actual cash counted
- Variance (over/short)

Use the date range filters to view shifts from specific periods.

---

## 8. Inventory

**Navigate to:** Dashboard → Inventory

Manages raw materials and ingredients (not finished food products — those are in Products/Settings).

### Viewing Stock Levels

The main inventory tab shows all items with:
- Current stock on hand
- Unit of measure (kg, liters, units, etc.)
- Reorder point (minimum level before alert triggers)
- Status indicator

### Adding a Stock Movement

Record when stock arrives, is used, wasted, or adjusted:

1. Click **Add Movement** (or use the form next to an item)
2. Select the item
3. Choose movement type:
   - **Received** — new stock delivered from supplier
   - **Used** — consumed in cooking/production
   - **Wasted** — spoiled or thrown out (use Waste Log for detailed waste tracking)
   - **Adjustment** — manual correction to match physical count
4. Enter the quantity
5. Add a note/reason
6. Click **Save**

### Stock Ledger

Click any inventory item to see its full ledger — a history of every movement (received, used, wasted, adjusted) with timestamps and the person who recorded it.

### Stock Counts

**Tab: Stock Counts**

Used for physical counts (counting actual stock on hand):

1. Click **New Count**
2. Select the items to count
3. Enter the physical quantity you counted for each item
4. Submit — the system records the variance between expected and actual

### Purchase Orders

**Tab: Purchase Orders**

Create and track orders to suppliers:

1. Click **New Purchase Order**
2. Select the supplier
3. Add items and quantities needed
4. Save as **Draft** or set status to **Ordered** (sent to supplier)
5. When goods arrive, click **Receive** on the order to update inventory

### Transfers

**Tab: Transfers**

Move stock between locations (e.g., from main store to another branch):

1. Click **New Transfer**
2. Select: From Location → To Location
3. Add items and quantities
4. Submit the transfer

---

## 9. Stock Alerts

**Navigate to:** Dashboard → Stock Alerts

> You will see a **number badge** on this menu item in the sidebar when there are unacknowledged alerts.

### What Are Stock Alerts?

When an inventory item's stock level falls to or below its **reorder point**, an alert is automatically generated. This reminds you to reorder or produce more before you run out.

### Viewing Alerts

Alerts are shown with:
- Item name
- Current stock level
- Reorder point
- Alert type (Low Stock or Out of Stock)
- Whether it's been acknowledged

Use the **filter** at the top to toggle between All alerts and Unacknowledged only.

### Acknowledging an Alert

Click **Acknowledge** next to an alert to mark it as seen/handled. This removes the sidebar badge count.

### Auto-Generate Purchase Order

For items with a preferred supplier set, click **Auto PO** to automatically create a purchase order for that item.

---

## 10. Waste Log

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

The waste log table shows all recorded waste events with:
- Date and time
- Item name
- Quantity and unit
- Reason
- Who recorded it
- Estimated cost value of the waste

### Waste Summary

A summary at the top shows total waste cost for the selected period. Use the date filter to compare week-over-week or month-over-month waste.

---

## 11. Variance Report

**Navigate to:** Dashboard → Variance

Compares **expected** stock (calculated from sales and production) vs. **actual** stock (from physical counts). Unexplained differences may indicate waste, theft, or data entry errors.

- Green = within tolerance
- Red = significant variance requiring investigation

Click any item to see the detailed movement history and identify where the variance occurred.

---

## 12. Suppliers

**Navigate to:** Dashboard → Suppliers

Manage your list of suppliers/vendors.

### Adding a Supplier

1. Click **New Supplier**
2. Enter: Name, Contact Person, Phone, Email, Address
3. Click **Save**

### Editing a Supplier

Click a supplier's name in the list to edit their details.

Suppliers are linked to inventory items and used when creating purchase orders.

---

## 13. Labels

**Navigate to:** Dashboard → Labels

Print price labels or shelf labels for products.

1. Search for or select products to label
2. Choose a label format (price tag, shelf label, etc.)
3. Click **Print Labels**

---

## 14. Reports

**Navigate to:** Dashboard → Reports

The main reports hub with multiple sub-reports.

### Sales Report

Shows sales totals for any date range:
- Total revenue, number of orders, average order value
- Breakdown by payment method (cash vs. card vs. gift card)
- Sales by department/category
- Top-selling products

Use the **date picker** to select Today, Yesterday, This Week, This Month, or a custom range.

### How to Export

Look for the **Export** or **Download** button on reports that support it.

---

## 15. Analytics

**Navigate to:** Dashboard → Analytics

Advanced sales analytics with trend charts:

- Revenue trend over time (daily/weekly/monthly view)
- Order volume trend
- Category performance breakdown
- Comparison to previous period (e.g., this week vs. last week)

Great for spotting trends — busiest days, peak hours, which departments are growing.

---

## 16. Sales Journal

**Navigate to:** Dashboard → Sales Journal

A detailed, line-by-line record of every transaction — like an accounting journal.

Each entry shows:
- Transaction date and time
- Order number
- Items sold
- Gross amount, discounts, taxes, net amount
- Payment method

Useful for accounting and reconciling with your bank or payment processor.

---

## 17. Reconciliation

**Navigate to:** Dashboard → Reconciliation

Reconcile daily sales against cash counted and payment processor reports. Used to ensure books match reality.

1. Select the date to reconcile
2. The system shows: Expected cash, card totals, gift card totals
3. Enter your actual counts from the payment processor and physical cash count
4. Any difference is flagged for review

---

## 18. Profitability

**Navigate to:** Dashboard → Profitability

Shows profit margins by product and department:

- Revenue per product
- Estimated cost (based on inventory)
- Gross profit and margin %

Helps identify which menu items are most profitable and which may need a price review.

---

## 19. P&L Statement

**Navigate to:** Dashboard → P&L Statement

A full Profit & Loss statement for any period:

- **Revenue:** Total sales
- **Cost of Goods Sold (COGS):** Ingredient costs
- **Gross Profit**
- **Operating Expenses:** Staff, utilities, etc. (from Expenses)
- **Net Profit/Loss**

---

## 20. Labor Cost

**Navigate to:** Dashboard → Labor Cost

Tracks labor costs based on time clock data:

- Staff hours worked per day/week
- Hourly rates and total wages
- Labor cost as a % of revenue

This helps manage staffing costs relative to sales.

---

## 21. End of Day (EOD) Report

**Navigate to:** Dashboard → End of Day

A printable end-of-day summary report designed for reconciliation and record-keeping:

- Total sales for the day
- Breakdown by payment method
- Cash drawer summary (opening float, drops, payouts, expected closing)
- Top items sold
- Shift summary (who worked, when)

Click **Print Report** to print the EOD report. This is designed to print on a full page.

---

## 22. Expenses

**Navigate to:** Dashboard → Expenses

Track business expenses (non-COGS) such as utilities, rent, staff meals, repairs, etc.

### Adding an Expense

1. Click **New Expense**
2. Select the category (Utilities, Rent, Supplies, etc.)
3. Enter the amount, date, and description
4. Optionally add a receipt reference number
5. Click **Save**

### Viewing Expenses

Filter expenses by:
- Date range
- Category
- Amount range

The total is shown at the top. Expenses feed into the P&L Statement automatically.

---

## 23. Currency Rates

**Navigate to:** Dashboard → Currency

Bettencourt's operates in Guyana Dollars (GYD). This section lets you manage exchange rates for other currencies if customers pay in USD, CAD, etc.

- Set the current exchange rate for each supported currency
- Rates are used in the POS when processing foreign currency payments

---

## 24. Customers

**Navigate to:** Dashboard → Customers

Manage your customer database.

### Adding a Customer

1. Click **New Customer**
2. Enter:
   - Name (required)
   - Phone number (required)
   - Email (optional)
   - Date of birth (optional, for birthday offers)
3. Click **Save**

### Finding a Customer

Use the search bar to find customers by name or phone number.

### Customer Profile

Click a customer's name to see their profile:
- Contact details
- Order history
- Loyalty points balance and tier
- Gift card balances

### Linking a Customer to an Order

In the POS Terminal, click **Add Customer** in the cart, search by name or phone, and select the customer before completing the order.

---

## 25. Loyalty Program

**Navigate to:** Dashboard → Loyalty Program

Manages your customer loyalty (points) program.

### How It Works

- Customers earn points on every order (configured by admin)
- Points accumulate toward tiers: Bronze, Silver, Gold
- Each tier may have different earn rates or benefits

### Viewing Members

The loyalty dashboard shows:
- All enrolled customers
- Their current points balance
- Their tier (Bronze/Silver/Gold)
- Last activity date

Click any member to see their full points history — every transaction that earned or redeemed points.

### Tiers

Click **Tiers** tab to manage tier definitions:
- Tier name (e.g., Silver)
- Minimum points required
- Points multiplier (e.g., earn 1.5x points at Silver tier)

### Redeeming Points

In the POS Terminal, when a loyalty customer is linked to an order, a **Redeem Points** option appears at checkout. Enter the number of points to redeem (subject to minimum redemption rules).

---

## 26. Discounts

**Navigate to:** Dashboard → Discounts

Create and manage saved discount presets used in the POS Terminal.

### Creating a Discount

1. Click **New Discount**
2. Enter:
   - **Name** — what cashiers will see (e.g., "Staff Discount", "Senior 10%")
   - **Type** — Percentage or Fixed Amount
   - **Value** — e.g., 10 for 10%, or 500 for $500 off
   - **Minimum Order** — optional, minimum cart total to qualify
   - **Active** — toggle on/off
3. Click **Save**

Discounts appear as quick-select buttons in the POS payment/discount flow.

---

## 27. Gift Cards

**Navigate to:** Dashboard → Gift Cards

Issue and manage gift cards.

### Issuing a Gift Card

1. Click **Issue Gift Card**
2. Enter or generate a unique code
3. Enter the starting balance (e.g., $5,000 GYD)
4. Process payment for the gift card amount in the POS
5. Click **Issue**

The gift card is now active and can be used at any register.

### Viewing Gift Cards

The list shows all issued gift cards with:
- Card code
- Original balance
- Current remaining balance
- Status (Active / Depleted / Voided)

Click any card to see its transaction history (purchases and redemptions).

### Redeeming a Gift Card

In the POS Terminal, choose **Gift Card** as a payment method and enter the card code. The system checks the balance and deducts accordingly.

---

## 28. Quotations

**Navigate to:** Dashboard → Quotations

Create price quotations for catering orders, events, or large orders.

### Creating a Quotation

1. Click **New Quotation**
2. Add customer name and contact details
3. Add line items (products, quantities, prices)
4. Set validity date
5. Add notes or terms
6. Click **Save as Draft** or **Send**

### Converting to an Invoice

Once a quotation is accepted, click **Convert to Invoice** to create an invoice based on the quotation.

---

## 29. Invoices

**Navigate to:** Dashboard → Invoices

Manage formal invoices for catering, corporate orders, or accounts.

### Creating an Invoice

1. Click **New Invoice**
2. Add customer details and line items
3. Set the due date
4. Click **Save** or **Send**

### Invoice Status

- **Draft** — not yet sent
- **Sent** — sent to customer
- **Paid** — payment received
- **Overdue** — past due date

---

## 30. Time Clock

**Navigate to:** Dashboard → Time Clock

All staff clock in and out here.

### Clocking In

1. Go to Time Clock
2. Find your name in the list or use the search bar
3. Click **Clock In**
4. Your clock-in time is recorded

### Clocking Out

1. Go to Time Clock
2. Find your entry
3. Click **Clock Out**
4. Your total hours for the shift are calculated

### Manager View

Managers see all staff time entries:
- Click any entry to edit the clock-in or clock-out time (for corrections)
- Filter by date range to see hours for a specific period
- Time data feeds into the Labor Cost report

---

## 31. Settings

**Navigate to:** Dashboard → Settings

> Settings are restricted to Managers and Administrators only.

Settings has multiple tabs:

### Products Tab

Manage all products sold at the POS.

**Adding a Product:**
1. Click **New Product**
2. Enter:
   - Name
   - Price (GYD)
   - Department/Category
   - Tax rate (select from defined rates)
   - Modifier groups (if applicable)
   - Available at which register(s)
3. Click **Save**

**Editing a Product:**
Click the product name to open it. Change any fields and click **Save**.

**Deactivating a Product:**
Toggle the **Active** switch off. Inactive products are hidden from the POS grid but remain in order history.

### Categories (Departments) Tab

Organize products into departments (e.g., Chicken, Fish, Pastry, Beverages).

**Adding a Category:**
1. Click **New Category**
2. Enter a name and sort order (controls order in POS tabs)
3. Click **Save**

### Modifiers Tab

Modifier groups let customers customize products (e.g., "Spice Level: Mild / Medium / Hot", "Add-ons: Extra Sauce").

**Creating a Modifier Group:**
1. Click **New Group**
2. Enter the group name (e.g., "Spice Level")
3. Set:
   - **Min selections** — minimum the customer must choose (0 = optional)
   - **Max selections** — maximum allowed (1 = single choice, 3+ = multi-select)
4. Add modifier options:
   - Name (e.g., "Mild", "Hot")
   - Additional price (0 if free)
5. Click **Save**

**Linking Modifiers to Products:**
Open a product, find the Modifier Groups field, and add the groups that apply to that product.

### Users Tab

Manage staff accounts.

**Adding a New User:**
1. Click **New User**
2. Enter: Name, Email, Role, PIN (4–8 digits)
3. Click **Save**
4. The user can log in immediately

**Roles:**
- **Cashier** — POS access, can take orders and process payments
- **Admin** — all cashier abilities plus reports, settings, inventory
- **Executive** — full access including all financial reports and user management
- **Kitchen/Checkoff** — KDS and production access only
- **Warehouse** — inventory and purchase order access only
- **Accountant** — reports and expenses access only

**Resetting a PIN:**
Click a user's name → change the PIN field → Save.

### Registers Tab

Manage POS registers (terminals).

**Adding a Register:**
1. Click **New Register**
2. Enter a name (e.g., "Meals POS", "Pastry Counter")
3. Assign a location
4. Click **Save**

### Tax Rates Tab

Define sales tax rates.

**Adding a Tax Rate:**
1. Click **New Rate**
2. Enter a name (e.g., "VAT 16%") and the rate (e.g., 16)
3. Set as default if it applies to most products
4. Click **Save**

### Receipt Configuration Tab

Customize what prints on customer receipts.

Fields you can set:
- Business name
- Tagline / slogan
- Address line 1 and line 2
- Phone number
- Footer message (e.g., "Thank you for choosing Bettencourt's!")
- Promotional message (printed at the bottom)

### Tables Tab

If you use table numbers for dine-in orders:

1. Add tables with a name/number and capacity
2. Tables appear in the POS when order type is set to Dine In

---

## 32. Locations

**Navigate to:** Dashboard → Locations

Manage your store locations. Bettencourt's currently operates from a single location, but the system supports multiple branches.

- View current location details (name, address)
- Each location has its own registers and cash sessions

> Contact your system administrator (KareTech) to add a new location.

---

## 33. Audit Log

**Navigate to:** Dashboard → Audit Log

A full history of all system changes — who did what and when. This cannot be edited.

**What it tracks:**
- User logins and logouts
- Orders created, voided, or refunded
- Product and price changes
- Settings changes
- User account changes
- Cash session events (opens, closes, drops, payouts, no-sale)

Use the filters to search by user, action type, or date range.

> If you need to investigate a discrepancy or suspicious activity, the Audit Log is the first place to check.

---

## 34. Menu Schedules

**Navigate to:** Dashboard → Menu Schedules

Schedule which products are available at different times of day (e.g., breakfast menu 6am–11am, lunch menu 11am–4pm).

**Creating a Schedule:**
1. Click **New Schedule**
2. Enter a name (e.g., "Breakfast")
3. Set the days and time range (start time → end time)
4. Select which products or categories are available during this schedule
5. Click **Save**

When the POS is active, only the products matching the current time window will appear.

---

## 35. Tables

**Navigate to:** Dashboard → Tables

View and manage your dine-in table layout.

- See which tables are occupied and which are free
- Assign orders to specific tables
- Move an order from one table to another
- Tables link to the POS Terminal for dine-in orders

---

## 36. Notifications

**Navigate to:** Dashboard → Notifications

Manage in-app notification settings. Configure which events trigger notifications and who receives them (e.g., notify the manager when a void occurs, or when stock drops below minimum).

---

## 37. Menu Board (TV Display)

**Access at:** https://pos.karetechsolutions.com/menu-board

This is a public page (no login required) designed to be displayed on a TV screen facing customers.

**Features:**
- Shows all active products grouped by department
- Products display name, price, and image (if set)
- Automatically refreshes every 60 seconds to reflect price changes
- **Fullscreen button** (top right) — click to go full screen on a TV
- **Auto-scroll** — the page slowly scrolls so customers see all items; it pauses when touched or hovered

**Setting Up on a TV:**
1. Open a browser on the TV or connected device
2. Go to https://pos.karetechsolutions.com/menu-board
3. Click the fullscreen button
4. The display will stay current as long as the browser tab is open

---

## 38. Online Ordering

**Access at:** https://pos.karetechsolutions.com/order

A public page (no login required) that customers can use from their phone or computer to place orders for pickup or delivery.

### How It Works (Customer View)

1. Customer visits the order page
2. Browses the menu — organized by department with category filter pills at top
3. Adds items to their cart (with a quantity control on each product card)
4. At checkout:
   - Selects **Pickup** or **Delivery**
   - Enters name and phone number
   - For delivery: enters delivery address
   - Reviews their order and adds special instructions per item
5. Clicks **Place Order**
6. Gets an order number confirmation

The order appears in the POS system as a new order for staff to fulfill.

### Managing Online Orders in the POS

Online orders appear in the Orders list tagged as "Pickup" or "Delivery". The KDS also shows them for kitchen staff.

---

## 39. Frequently Asked Questions

**Q: A customer wants a refund. How do I process it?**
Go to **Orders** → find the order → click **Refund**. Enter the amount to refund and confirm. The refund is logged against the original payment method.

**Q: The till is short (or over). What do I do?**
When closing the shift, enter the actual cash count. The system records the variance. Report discrepancies to the manager. The Audit Log and no-sale event log can help explain what happened.

**Q: How do I void an order that's already been paid?**
Go to **Orders** → open the order → click **Void Order** → confirm. Only managers can void completed orders.

**Q: A product is sold out. How do I hide it from the POS?**
Go to **Settings → Products** → find the product → toggle **Active** to off. It disappears from the POS grid immediately.

**Q: How do I add a new staff member?**
Go to **Settings → Users → New User**. Set their name, email, role, and PIN. They can log in immediately.

**Q: How do I reset a staff member's PIN?**
Go to **Settings → Users** → click the user's name → change the PIN → Save.

**Q: How do I see yesterday's sales?**
Go to **Reports → Sales Report**. Use the date picker to select yesterday.

**Q: How do I print the end-of-day summary?**
Go to **End of Day** and click **Print Report**.

**Q: How do I see which cashier processed a specific order?**
Open the order in **Orders** — the "Served by" field shows the cashier's name.

**Q: How do I track a gift card balance?**
Go to **Gift Cards**, search by card code, and click it to see the current balance and transaction history.

**Q: A customer says their loyalty points are wrong.**
Go to **Loyalty Program**, find the customer, and click their name to see the full points history. Each transaction that earned or redeemed points is listed.

**Q: How do I change a product's price?**
Go to **Settings → Products** → click the product → change the price → Save. The new price takes effect in the POS immediately.

**Q: How do I see what staff member opened/closed the cash drawer?**
Go to **Cash Control → Shift History** and click a shift to see who opened and closed it, with timestamps. For no-sale events, check the **Audit Log**.

**Q: The POS isn't loading. What should I try?**
1. Refresh the page (press F5 or Ctrl+R)
2. Check your internet connection
3. Try a different browser
4. If nothing works, contact KareTech Solutions

**Q: Can I use the POS on a tablet or phone?**
Yes. The system is mobile-responsive and works on tablets. The POS Terminal is designed to work on 10" and larger screens for the best experience.

**Q: How do I set up the menu board TV?**
Open a browser on the TV, go to https://pos.karetechsolutions.com/menu-board, and click the fullscreen button.

**Q: Customers want to order online. Where do they go?**
Send them to **https://pos.karetechsolutions.com/order** — or make a link/button on your WhatsApp or Facebook page.

---

## 40. Getting Help

For technical support or system questions:

**KareTech Solutions**
- Developer: Kareem Schultz
- Website: karetechsolutions.com
- System URL: https://pos.karetechsolutions.com

**If something is wrong with the system:**
1. Write down exactly what you were doing and what happened
2. Note the date and time
3. Contact Kareem with that information so he can investigate quickly

---

*End of User Manual*
