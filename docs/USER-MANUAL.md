# Bettencourt's POS — Complete User Manual

**For:** Shakira & Staff at Bettencourt's Food Inc.
**System:** Bettencourt POS at https://pos.karetechsolutions.com
**Last Updated:** March 2026

---

## Table of Contents

1. [Getting Started — Logging In](#1-getting-started--logging-in)
2. [Dashboard (Home)](#2-dashboard-home)
3. [New Sale (Taking Orders)](#3-new-sale-taking-orders)
4. [Orders](#4-orders)
5. [Kitchen Display System (KDS)](#5-kitchen-display-system-kds)
6. [Production Dashboard](#6-production-dashboard)
7. [Cash Control](#7-cash-control)
8. [Inventory](#8-inventory)
9. [Stock Alerts](#9-stock-alerts)
10. [Waste & Shrinkage Log](#10-waste--shrinkage-log)
11. [Stock Variance Report](#11-stock-variance-report)
12. [Suppliers](#12-suppliers)
13. [Labels](#13-labels)
14. [Reports](#14-reports)
15. [Analytics](#15-analytics)
16. [Daily Sales Journal](#16-daily-sales-journal)
17. [Cash Reconciliation](#17-cash-reconciliation)
18. [Profitability](#18-profitability)
19. [Profit & Loss Statement](#19-profit--loss-statement)
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
34. [Menu Calendar](#34-menu-calendar)
35. [Tables](#35-tables)
36. [Notifications](#36-notifications)
37. [Webhooks](#37-webhooks)
38. [Menu Board (TV Display)](#38-menu-board-tv-display)
39. [Online Ordering](#39-online-ordering)
40. [Kiosk Mode](#40-kiosk-mode)
41. [QR Code Table Ordering](#41-qr-code-table-ordering)
42. [Tips Report](#42-tips-report)
43. [Void & Comp Report](#43-void--comp-report)
44. [Customer Analytics](#44-customer-analytics)
45. [Reservations](#45-reservations)
46. [Waitlist](#46-waitlist)
47. [Customer Feedback](#47-customer-feedback)
48. [Shift Scheduling](#48-shift-scheduling)
49. [Price Lists](#49-price-lists)
50. [Printer Configuration](#50-printer-configuration)
51. [Finance Module (Bettencourt Finance)](#51-finance-module-bettencourt-finance)
52. [Backup & Restore](#52-backup--restore)
53. [User Management](#53-user-management)
54. [Frequently Asked Questions](#54-frequently-asked-questions)
55. [Getting Help](#55-getting-help)


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
Use the left sidebar to move between sections. Navigation is grouped into logical areas:

- **Operations** — New Sale, Orders, Kitchen Display, Production Board, Time Clock
- **Inventory** — Inventory, Stock Alerts, Waste & Shrinkage, Stock Variance, Suppliers, Labels
- **Finance** — Cash Control, Expenses, Discounts, Profit & Loss, Daily Sales Journal, Cash Reconciliation, Currency Rates
- **Insights** — Reports, Analytics, EOD Report, Labor Cost, Profitability
- **Customers** — Customers, Loyalty Program, Gift Cards
- **Sales** — Quotations, Invoices
- **System** — Settings, Locations, Webhooks, Notifications, Audit Log

> The sidebar only shows sections your role has permission to access. Cashiers see fewer options than managers.

### Quick Navigation — Command Palette (Ctrl+K)

Press **Ctrl+K** (or **Cmd+K** on Mac) from anywhere in the dashboard to open the **command palette** — a fast search bar that lets you jump to any page instantly.

**How to use:**
1. Press **Ctrl+K** — the palette opens with a search box
2. Start typing any page name (e.g., "inventory", "cash", "reports")
3. The list filters instantly — use arrow keys or click to navigate
4. Press **Enter** to go to the highlighted page

The command palette shows only the pages your role can access — the same as the sidebar. It's the fastest way to navigate the system, especially on a busy shift.

---

## 3. New Sale (Taking Orders)

**Navigate to:** New Sale (or click "Open POS" from the Dashboard)

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

### Keyboard Shortcut

Press **Ctrl+K** (Cmd+K on Mac) from the New Sale screen or anywhere in the dashboard to open the command palette and jump to any section instantly.

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

Click any order row to open the full detail dialog, which shows:

**Transaction Info**
- Cashier who processed the order
- Location and register
- Order type (Walk-in, Pickup, Delivery)
- Table number (for dine-in)
- Whether the bill was split

**Customer Info** (when provided)
- Customer name, phone number, delivery address

**Items**
- Every item with quantity, price, and any modifiers (e.g. "extra spicy")
- Voided items are shown with a strikethrough
- Item-level notes are shown in italics

**Payments**
- Payment method (cash or card)
- For cash: amount tendered and change given back

**Totals**
- Subtotal, discount (if any), tax, and grand total

**Void Info** (for voided orders only)
- Reason for void, who authorized it, and when

### Printing a Receipt / PDF

Inside the order detail dialog, click **Print PDF** (bottom left) to open a formatted receipt in a new browser tab. Click **Print / Save as PDF** inside that tab to save or print.

### Voiding an Order

1. Click the order row to open its detail
2. Click **Void** (bottom right — only visible on Completed orders)
3. Type a **reason** (required)
4. Click **Confirm Void**

The order is marked Voided, all payments are reversed, and if cash was tendered, the cash session total is automatically corrected.

> Only managers (Admin / Executive role) can void completed orders.

### Refunding an Order

1. Click the order row to open its detail
2. Click **Refund** (bottom right)
3. The full amount is pre-filled — change it for a **partial refund**
4. Enter a **reason** (required)
5. Click **Confirm Refund**

The order status changes to Refunded and a refund payment record is created automatically for accounting.

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

**Columns:**

| Column | What it means |
|--------|---------------|
| Opening | Quantity made at start of day |
| Reorder | Mid-day top-up batches |
| Closing | Leftover / unsold at end of day |
| Expected | Opening + Reorder − Closing (should have been sold) |
| Actual | What the POS actually rang up |
| **% Sold** | Actual ÷ Expected × 100 (how much of what was made actually sold) |
| Variance | Actual − Expected (negative = short, positive = over) |

**Row sorting:** Rows are sorted by urgency — shortages (negative variance) appear first so you can spot problems immediately, followed by overages, then balanced items.

**Colour-coded variance badges:**
- **Grey (0)** — balanced: sales match production exactly
- **Red (negative)** — short: more was rung up than produced — investigate
- **Amber (positive)** — over: more was produced than sold (possible waste or leftover)

**Closing column** is highlighted in amber whenever there is unsold stock at the end of the day.

A **Totals row** at the bottom sums all columns so you can see the overall picture at a glance.

> **Legend (shown below the table):** Closing = leftover at end of day. % Sold = Actual ÷ Expected. Combo sales are split into components in both columns.

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

Manage your full list of suppliers and vendors.

Your complete vendor list from the Vendor Register is already loaded in the system — 67 suppliers including Alabama Trading, Ansa McAl, Bank DIH Ltd, Royal Chicken-Mohamed Farms, Namilco, GPL, GT&T, GWI, and all others.

### Adding a New Supplier

1. Click **New Supplier**
2. Enter: Name, Contact Person, Phone, Email, Address
3. Assign categories (e.g. Food & Beverage, Utilities, Cleaning Supplies) to make expense filtering easier
4. Click **Save**

### Editing a Supplier

Click a supplier's name or the edit icon to update their details (phone, address, contact person, etc.).

### How Suppliers Are Used

- **Purchase Orders** — select the supplier when creating a new PO
- **Inventory Items** — each item can have a preferred supplier for auto-generating POs
- **Expenses** — supplier cards appear at the top of the Expenses page for one-click filtering
- **Stock Alerts** — if an item has a preferred supplier set, you can auto-generate a PO directly from the alert

### Vendor Detail Page

Click any supplier card to open the **Vendor Detail page** for that vendor. You can also reach it by clicking the vendor name badge in the Expenses table.

#### What you'll see

**Summary Cards** — Six cards at the top update automatically when you change the time period:
- **Period Spend** — Total amount paid to this vendor in the selected period
- **vs. Previous Period** — Whether spend went up (↑) or down (↓) compared to the prior equivalent window
- **All-Time Spend** — Total amount paid since the first transaction
- **Avg Transaction** — Average expense amount for the period
- **Last Purchase** — When you last purchased from this vendor
- **Largest Expense** — The single largest purchase in the selected period

**Period Filter** — Select from: Today, This Week, This Month (default), Last Month, This Quarter, Last Quarter, This Year, or All Time.

**Charts**
- *Monthly Spend Trend* — Bar chart showing the last 12 months of spend
- *Spend by Category* — Horizontal bar chart showing which categories this vendor appears in for the selected period

**Transaction Table** — Full list of expenses for this vendor in the selected period.
- Use the **search box** to filter by description or reference number
- Use the **Category filter** to narrow by expense category
- Click the **Date** or **Amount** column headers to sort
- A ⚠️ warning icon appears next to possible duplicate transactions (same amount within 7 days)
- The footer shows the total count and sum for the filtered results

#### Actions

| Button | What it does |
|---|---|
| **Edit Vendor** | Go back to Suppliers list to edit this vendor |
| **+ Add Expense** | Open a form to record a new expense for this vendor (vendor pre-filled) |
| **View Statement** | Preview a vendor statement in a popup modal |
| **Print Statement** | Generate and download a PDF vendor statement |
| **Export CSV** | Download the filtered transactions as a CSV file |

> **Tip:** Press `Esc` to return to the Suppliers list.

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

### Summary Cards (Quick Filter)

At the top of the page are **clickable summary cards** showing your expense totals:

- **All Expenses** card — shows the grand total for the selected period and a **"+X% vs last month"** indicator so you can see at a glance whether spending is up or down. Click it to reset to viewing all expenses.
- **Supplier cards** (up to 3) — show the total spent with each top supplier. **Click any supplier card to instantly filter the expense table below to show only that supplier's entries** — full date, category, description, and amount detail.

The active card is highlighted with a ring so you always know which filter is in effect.

### Adding an Expense

1. Click **Add Expense** (top right)
2. Enter the **amount** (GYD)
3. Select the **supplier** (optional — your full vendor list is pre-loaded). The system will **automatically suggest the category** based on what you charged to that supplier before.
4. Select the **category** from the list below
5. Enter a **description** of what the expense was for
6. Select the **payment method** — Cash, Card, Bank Transfer, Cheque, or Other
7. Enter the **receipt / reference number** (invoice # or receipt # from the supplier — optional but recommended)
8. Add any **notes** (optional — e.g. "receipt in green folder")
9. **Take or upload a receipt photo** — click the upload box to attach a picture of the physical receipt (JPEG, PNG, or WebP — max 5 MB). A thumbnail will appear in the form for confirmation.
10. Click **Save Expense**

> **Tip:** If you enter the same amount for the same supplier on the same day as a previous entry, the system will show a warning. This helps you avoid double-entry mistakes.

### Expense Categories

| Category | When to use |
|----------|-------------|
| Food & Beverage Supplies | Chicken, fish, vegetables, cooking ingredients |
| Beverages | Soft drinks, Vita Malt, beer, water bottles |
| Cleaning Supplies | Bleach, detergent, mop heads, gloves |
| Office Supplies | Pens, printer paper, staplers |
| Repairs & Maintenance | Fridge repairs, plumbing, pest control |
| Delivery & Transport | Gas for vans, courier costs |
| Utilities | Electricity (GPL), Water (GWI), Gas (Massy), Phone (GT&T) |
| Marketing & Advertising | Facebook ads, flyers, signage |
| Staff Meals | Food provided to staff during shifts |
| Vehicle Maintenance | Oil changes, tyres, brake pads for company vehicles |
| CEO Drawings | Money taken out of the business by the CEO |
| GM Drawings | Money taken out of the business by the General Manager |
| Owner Drawings | Money taken out by the owner personally |
| COO Drawings | Money taken out by the COO |
| Miscellaneous | Anything that doesn't fit another category |

> **Drawings** are withdrawals — money the owner or a manager takes out for personal use. They are tracked here as expenses so the P&L always shows the true profit left in the business.

### Filtering Expenses

Use the controls at the top to narrow down what you see:
- **From / To** date range — the page opens showing **the current month** by default so you always see your latest activity
- **Quick date buttons** — Today, This Week, This Month, Last Month
- **Supplier** dropdown
- **Category** dropdown
- **Category breakdown pills** — click a category pill (below the summary cards) to filter by that category

### Viewing Full Details

Click any expense row to open a read-only detail dialog showing all fields including notes, receipt number, who recorded it, and who authorized it. If a **receipt photo** was uploaded, a thumbnail is shown — click it to view the full image. The **Edit** button inside the dialog opens the edit form.

### Editing or Deleting an Expense

- **Pencil icon** on any row — edit all fields including payment method, ref #, and notes
- **Trash icon** — delete with a confirmation prompt

### Exporting

- **Export CSV** — downloads all currently filtered expenses with every field
- **Print PDF** — opens a **branded expense report** in a new tab showing: KPI summary (total, # entries, top category, top supplier), color-coded category breakdown bars, the full expense table with category dot indicators, grand total strip, and signature lines. Use the in-page "Print / Save as PDF" button to print or save.

Expenses feed into the **P&L Statement** automatically under "Operating Expenses".

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

Create professional price quotations for catering, events, or corporate orders. Quotations print as a dedicated PDF with a QUOTATION stamp, validity countdown, Terms & Conditions, and signature blocks.

### Creating a Quotation

1. Click **New Quotation**
2. Enter customer name, phone, address, and **Valid Until** date
3. (Optional) open **Agency / Organization** and set a **Department**
4. Add line items (description, quantity, unit price — totals auto-calculate)
5. In the **Tax & Discount** box, set:
   - Tax Rate (%) and Tax Mode (whole invoice or per-line)
   - Discount type (percent or fixed GYD amount) and value
6. Enter **Terms & Conditions** (appears on the PDF)
7. Add **Notes** and your name in **Prepared By**
8. Click **Create**

### More Actions Menu (click ••• on any quotation row)

| Button | What it does |
|--------|-------------|
| Print / Save PDF | Opens professional QUOTATION PDF in new tab |
| Edit | Modify the quotation |
| Mark Sent | Moves status from Draft → Sent |
| Duplicate | Creates a new draft copy |
| Revise | Creates a numbered revision (R2, R3…) linked to original |
| To Invoice | Converts to a formal invoice (Sent/Accepted only) |

### Quotation Statuses

- **Draft** — created, not yet sent
- **Sent** — sent to customer (Mark Sent or converted)
- **Accepted** — customer agreed to the price
- **Rejected** — customer declined
- **Expired** — past the Valid Until date
- **Converted** — turned into an invoice

---

## 29. Invoices

**Navigate to:** Dashboard → Invoices

Manage formal invoices for catering, corporate orders, or accounts receivable. Supports VAT, discounts, payment terms, and cheque tracking.

### Aging Summary Cards (top of page)

Four cards show at a glance:
- **Outstanding** — total unpaid balance across all invoices
- **Overdue** — unpaid invoices past their due date (red if any)
- **Paid This Month** — total payments collected this calendar month
- **Drafts** — number of unfinished draft invoices

### Creating an Invoice

1. Click **New Invoice**
2. Enter customer details (name, phone, address)
3. Set **Issued Date** and **Due Date**
4. (Optional) set a custom invoice number and open **Agency / Organization**
5. Add line items
6. Set Tax Rate, Discount, **Payment Terms** (Due on Receipt / Net 15 / Net 30 / Net 60), and **Department**
7. Enter your name in **Prepared By** (optional)
8. Click **Create**

You can edit the invoice number later while editing the invoice.

### Recording a Payment

1. Click the invoice row to open the detail panel
2. In **Record Payment**, enter:
   - **Amount Paid** (can be partial)
   - Cheque Number and Receipt Number (optional)
   - Date Paid and Cheque Deposit Date
3. Click **Record Payment**

### More Actions Menu

| Button | What it does |
|--------|-------------|
| Print / Save PDF | Opens professional INVOICE PDF in new tab |
| Edit Invoice | Modify the invoice |
| Mark as Sent | Moves Draft → Sent |
| Duplicate | Creates a new draft copy |

### Invoice Statuses

- **Draft** — not yet sent
- **Sent** — sent to customer
- **Outstanding** — sent but unpaid
- **Paid** — fully paid
- **Overpaid** — payment exceeds total
- **Cancelled** — voided

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

**Navigate to:** Dashboard → System → Notifications

Send SMS and WhatsApp messages to customers automatically when events happen — e.g., "Your order is ready!" or "You earned loyalty points."

### How Notifications Work

1. **Provider** — The system uses **Twilio** to send SMS and WhatsApp messages. Twilio credentials must be configured before notifications will send.
2. **Templates** — Each event type has a customizable message template with variables like `{{customerName}}` and `{{orderNumber}}`.
3. **Channels** — Each template can send via **SMS**, **WhatsApp**, or **both**.
4. **Log** — Every message sent (or that failed to send) is recorded in the **Notification Log** tab.

### Setting Up Twilio (Admin Only)

> Ask KareTech Solutions to set up Twilio if you haven't already.

1. Go to **Notifications → Settings** tab
2. Enter your **Twilio Account SID** and **Auth Token** (from your Twilio console)
3. Enter your **From Number** (the Twilio phone number that sends SMS, must be E.164 format: `+15550001234`)
4. Optionally enter a **WhatsApp Number** (same E.164 format, e.g. `+15550009999`)
5. Set a **Daily Limit** (default 500) — stops sending if too many messages go out in a day
6. Click **Save** and toggle **Active** to enable

### Managing Message Templates

Go to the **Templates** tab to see all configured message templates.

**Available events:**
| Event | When it triggers |
|---|---|
| `order.ready` | When staff marks an order as "Ready" |
| `order.refunded` | When a refund is processed |
| `loyalty.earned` | When a customer earns loyalty points |
| `loyalty.redeemed` | When a customer redeems loyalty points |

**Template variables you can use:**
- `{{customerName}}` — Customer's first name
- `{{orderNumber}}` — Order reference (e.g., GT-012)
- `{{total}}` — Order total in GYD
- `{{points}}` — Points earned or redeemed
- `{{totalPoints}}` — Customer's new total points
- `{{refundAmount}}` — Amount refunded

**Editing a template:**
1. Click the template name in the Templates tab
2. Edit the message text — use variables in double curly braces
3. Change the **Channel** (SMS / WhatsApp / Both)
4. Toggle **Active** — inactive templates won't send
5. Click **Save**

### Notification Log

The **Log** tab shows every message the system has tried to send:
- **Delivered** — Successfully received by the customer's phone
- **Sent** — Sent to Twilio, awaiting delivery confirmation
- **Failed** — Twilio returned an error (e.g., invalid number, daily limit reached)
- **Pending** — Queued but not yet sent

> If a customer says they didn't receive a notification, check the Log tab and look for error messages on their phone number.

---

## 37. Webhooks

**Navigate to:** Dashboard → System → Webhooks

Webhooks let the POS automatically notify other software systems (accounting tools, Slack, spreadsheets, etc.) whenever something happens — like an order completing or stock running low.

> **For Shakira:** Webhooks are an advanced feature usually set up by KareTech Solutions to connect your POS to tools like QuickBooks or Zapier.

### What Are Webhooks?

When an event happens in the POS (e.g., an order is paid), the system sends a **POST request** with the event data to a URL you configure. The receiving system (QuickBooks, Slack, a custom script, etc.) can then react automatically.

### Adding a Webhook Endpoint

1. Go to **Webhooks** and click **Add Endpoint**
2. Enter a **Name** (e.g., "QuickBooks Sales Feed")
3. Enter the **URL** — this is provided by the external service (**must start with `https://`**)
4. Select the **Events** to subscribe to (see list below)
5. Optionally enter a **Secret** — used to verify that the request came from your POS (HMAC-SHA256 signature)
6. Click **Save**

### Available Events

| Event | When it fires |
|---|---|
| `order.completed` | An order is paid and completed |
| `order.refunded` | A refund is processed |
| `order.voided` | An order is voided |
| `inventory.low_stock` | An inventory item drops below its minimum threshold |
| `inventory.out_of_stock` | An inventory item reaches zero |
| `*` (wildcard) | All events |

### Delivery Log

The **Delivery Log** tab shows every webhook send attempt for each endpoint:
- **Status code** — HTTP response from the receiving server (200 = success, 5xx = server error)
- **Duration** — How long the request took (ms)
- **Success/Failed** — Whether the delivery was acknowledged

If a delivery failed, click on it to see the full error response.

### Webhook Security (Signatures)

When you set a **Secret** on an endpoint, the POS signs each request with an HMAC-SHA256 signature sent in the `X-Webhook-Signature` header. The receiving system can verify this to confirm the request is authentic.

### Toggling an Endpoint On/Off

Click the **Active** toggle next to any endpoint to temporarily pause deliveries without deleting the endpoint.

---

## 38. Menu Board (TV Display)

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

## 39. Online Ordering

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

## 40. Kiosk Mode

**Access at:** `/kiosk` — open on a dedicated tablet or touch-screen facing customers.

The Kiosk allows customers to **browse the menu and place their own orders** without staff assistance — ideal for walk-in counter service.

### How It Works

1. A staff member or manager opens `/kiosk` on the tablet
2. The kiosk displays the full menu with images, prices, and categories
3. The customer taps items to add them to the cart
4. They can select modifiers (size, toppings, etc.) when prompted
5. At checkout the customer chooses **Pickup** or **Dine-In** and enters their name
6. The order is sent directly to the kitchen (KDS) and appears in Orders

### Managing the Kiosk Menu

- Only products marked **Active** appear on the kiosk
- Items marked out-of-stock via the **86 system** are hidden automatically in real-time
- Categories and display order are controlled from **Settings → Categories**

> **Tip:** Keep the kiosk tablet plugged in and set to never sleep. Use a wall-mount stand for the best customer experience.

---

## 41. QR Code Table Ordering

Customers at a table can scan a **QR code** to view the menu and place orders from their own phone.

### Setting Up Table QR Codes

1. Go to **Tables** in the dashboard
2. Click **Print QR Codes** (top right)
3. Print and laminate the QR codes
4. Place each QR code on the matching table

### How It Works for Customers

1. Customer scans the QR code with their phone camera
2. The menu opens in their browser — no app download required
3. They browse, add items to their cart, and tap **Place Order**
4. The order goes straight to the kitchen (KDS) linked to their table
5. Staff can see the order in **Orders** with the table number

### Managing QR Orders

QR orders appear in the **Orders** list tagged with the table number and **QR** source. They can be managed like any other dine-in order.

---

## 42. Tips Report

**Navigate to:** Dashboard → Tips Report

The Tips Report shows all tip amounts collected across a date range — broken down by employee and payment method.

### Reading the Report

| Column | Meaning |
|--------|---------|
| Employee | Cashier who processed the order |
| Orders | Number of orders with tips |
| Total Tips | Sum of all tip amounts |
| Cash Tips | Tips paid in cash |
| Card Tips | Tips paid by card |
| Avg Tip | Average tip per tipping order |

### Using the Report

- Use the **date range** picker at the top to filter by period
- Click **Export CSV** to download for payroll processing
- Use the **Payment Method** tab to see tips broken down by cash vs. card vs. online

> **Important:** The system records the tip amount entered at payment time. If a cashier adjusts a tip after the fact, the original amount is used.

---

## 43. Void & Comp Report

**Navigate to:** Dashboard → Voids

The Void & Comp Report shows all voided orders and comped (complimentary) items within a date range — with employee breakdown and reasons.

### What It Shows

- **Total Void Value** — the dollar amount removed from sales through voids
- **Void Count** — number of orders or items voided
- **By Employee** — which staff member authorized each void
- **Void Reason** — the reason entered when the void was approved

### Filtering

- Filter by **date range**, **employee**, or **reason**
- Toggle between **Order Voids** (entire orders voided) and **Item Voids** (individual items removed from open orders)

### Export

Click **Export CSV** to download void data for review or auditing.

> Only managers (Admin / Executive) can authorize voids. All voids are also logged in the **Audit Log**.

---

## 44. Customer Analytics

**Navigate to:** Dashboard → Customer Analytics

Gives you a deeper view of your customer base beyond basic sales numbers.

### Key Metrics (top cards)

| Metric | What It Means |
|--------|--------------|
| Total Customers | Unique customers who purchased in the period |
| Returning Customers | Customers who visited more than once |
| Retention Rate | % of customers who came back |
| Avg Customer Lifetime Value (CLV) | Average total spend per customer |
| Avg Visits | Average number of visits per customer |

### Charts

- **Spend Distribution** — pie chart showing what % of customers are in each spend bracket (e.g., 0–500, 500–2000, 2000+ GYD)
- **Visit Trend** — line chart showing new vs. returning customers over time

### Top Customers Tables

- **Top by Spend** — customers who have spent the most total
- **Top by Visits** — your most frequent customers

Use this page to identify VIP customers for loyalty rewards or special promotions.

---

## 45. Reservations

**Navigate to:** Dashboard → Reservations

Manage future bookings for tables or events.

### Creating a Reservation

1. Click **New Reservation**
2. Enter:
   - Customer name and phone number
   - Date and time
   - Party size (number of guests)
   - Table (optional — can assign later)
   - Notes (e.g., "Birthday — needs cake")
3. Click **Save**

### Reservation Statuses

| Status | Meaning |
|--------|---------|
| Confirmed | Booking is confirmed |
| Seated | Customer has arrived and is at their table |
| Completed | Visit is done |
| Cancelled | Booking was cancelled |
| No-Show | Customer did not arrive |

### Managing Reservations

- Use the **date picker** to view reservations for a specific day
- Click any reservation to update its status, assign a table, or add notes
- Confirmed reservations show on the **Tables** page so floor staff know which tables to hold

---

## 46. Waitlist

**Navigate to:** Dashboard → Waitlist

Manage walk-in customers who are waiting for a table.

### Adding to Waitlist

1. Click **Add to Waitlist**
2. Enter customer name, phone number, and party size
3. The system records the time they joined the waitlist
4. Click **Save**

### Waitlist Actions

| Action | When to Use |
|--------|------------|
| **Seat** | Customer is ready — moves them off the waitlist |
| **Notify** | Sends the customer an SMS when their table is ready |
| **No-Show** | Remove without seating if they left |
| **Remove** | Cancel the waitlist entry |

### Estimated Wait Time

The system calculates average table turnover to estimate how long each party will wait. This estimate is shown next to each entry.

---

## 47. Customer Feedback

**Navigate to:** Dashboard → Feedback

View and manage customer feedback submitted through the POS or kiosk.

### What Customers Can Rate

Customers can leave a star rating (1–5) and a written comment after their order.

### Reading the Feedback Page

- **Average Rating** card shows your overall score for the selected period
- **Rating Distribution** shows how many 1-star, 2-star, etc. reviews you received
- Each feedback entry shows: date, order number, rating, and comment

### Filtering

Filter feedback by **date range**, **rating** (e.g., show only 1–2 star reviews to find problems), or **keyword** in the comments.

---

## 48. Shift Scheduling

**Navigate to:** Dashboard → Shifts

Create and manage weekly staff schedules.

### Adding a Shift

1. Click **Add Shift**
2. Select the **staff member** from the dropdown
3. Choose the **day of week** (Monday–Sunday)
4. Enter **start time** and **end time** (24-hour format, e.g., 08:00–16:00)
5. Add optional **notes** (e.g., "Open register")
6. Click **Save**

### Viewing the Schedule

Shifts are displayed in a weekly grid sorted by day and time. Use the **Location** filter to view schedules per location.

### Editing or Removing a Shift

Click the pencil icon to edit a shift, or the trash icon to remove it. Changes take effect immediately — there is no publish/draft step.

> **Note:** The Shift Schedule shows *planned* hours. For *actual* clocked hours, use the **Time Clock** page.

---

## 49. Price Lists

**Navigate to:** Dashboard → Price Lists

Price Lists allow you to set **different prices for the same products** in different contexts — for example, a **dine-in** price vs. a **takeaway** price, or a **wholesale** price for corporate customers.

### Creating a Price List

1. Click **New Price List**
2. Enter a name (e.g., "Dine-In", "Wholesale")
3. Add products and their prices in this list
4. Click **Save**

### Assigning a Price List

- Price Lists can be assigned to specific **customers** (so they always get their special price)
- They can also be applied manually at the POS when starting an order

### How Prices Override

When a price list is active for an order, the product price from the list replaces the standard price. If a product is not in the price list, its default price is used.

---

## 50. Printer Configuration

**Navigate to:** Dashboard → Printers

Configure receipt printers, kitchen ticket printers, and label printers connected to the system.

### Printer Types

| Type | Purpose |
|------|---------|
| **Receipt** | Customer receipts at the POS counter |
| **Kitchen** | Order tickets printed in the kitchen |
| **Label** | Item labels (e.g., for packaged goods) |

### Adding a Printer

1. Click **Add Printer**
2. Enter a name and select the type
3. Choose connection method:
   - **USB** — connected directly to this device (uses WebUSB)
   - **Network** — enter the printer's IP address and port
4. Select the paper width (80mm is standard for POS printers)
5. Click **Save & Test** to print a test receipt

### Printer Settings

- **Auto-Print** — automatically prints a receipt after every sale
- **Kitchen Copy** — sends a copy to the kitchen printer
- **Logo** — upload your logo to print at the top of receipts

> **Troubleshooting:** If the printer shows "Offline", check the USB cable or network connection. For network printers, make sure the printer is on the same WiFi network as the POS device.

---

## 51. Finance Module (Bettencourt Finance)

The **Finance** section of the sidebar gives you a complete accounting and billing system — comparable to QuickBooks or Peachtree — built right into the POS.

### Finance Dashboard (`/dashboard/finance`)
Your one-page financial overview. Shows:
- **Total Receivable** — total owed by all customers
- **Total Payable** — total owed to all suppliers
- **Overdue AR / AP** — overdue invoices and bills with totals
- **Net Cash Flow (30 days)** — money in minus money out
- **Revenue this month** — invoice payments received

Plus revenue vs expenses charts and quick-view of recent invoices and vendor bills.

### Invoices (`/dashboard/invoices`)
Create invoices for catering jobs, corporate lunches, events, or any sale on credit.

**To record a payment on an invoice:**
1. Find the invoice → click the green payment icon
2. Choose: Cash, Cheque, Bank Transfer, or Mobile Money
3. Enter the amount and date
4. The invoice status updates automatically (Partial → Paid)

Each invoice shows a **Payment History** with every payment ever made — nothing is deleted.
Use the **More Actions (•••)** menu for Mark Sent, Duplicate, Print / Save PDF, reminder copy, and delete.
Invoices also support **Department**, **Agency / Organization** details, and editable invoice numbers.

**To create a credit note** from an invoice: click **Create Credit Note** on any paid or partial invoice.

### Credit Notes (`/dashboard/credit-notes`)
Use credit notes to reduce a customer's balance — for price corrections, errors, or loyalty adjustments.

1. Create credit note → use the searchable invoice combobox to link to original invoice
2. Set department (optional) and add adjustment item(s)
3. **Issue** it (changes status from Draft → Issued)
4. **Apply to Invoice** — select the customer's invoice and enter the amount to offset

Credit notes also include **Print / Save PDF** in the **More Actions (•••)** menu.

### Vendor Bills (`/dashboard/vendor-bills`)
Track what the restaurant owes to suppliers (Family Food, Albadar, WJ Enterprise, etc.).

1. Create a bill when you receive goods → add line items and department (optional)
2. Record payments as you pay the supplier using the **Pay** button
3. Use **More Actions (•••)** for edit, PDF, and delete options
4. Overdue bills (past due date) show a red badge automatically

### Recurring Templates (`/dashboard/recurring`)
Set up automatic monthly invoices (e.g., Banks DIH monthly cafeteria) or recurring expenses (rent).

- **Generate Next** creates the document and advances the schedule
- **Pause** stops generation without deleting the template

### Aging Report (`/dashboard/aging`)
Shows how long invoices and vendor bills have been outstanding — grouped into Current, 1–30, 31–60, 61–90, and 90+ day buckets. Export to CSV for your accountant.

### Customer Statements (`/dashboard/customer-statements`)
Select a customer and a date range to see their full account history — every invoice, payment, and credit note with a running balance. Print or export to PDF.

### Tax Summary (`/dashboard/tax-summary`)
Compares VAT collected on sales vs VAT paid on purchases. Shows the net tax liability for any period. Useful for preparing VAT returns.

### Budgets (`/dashboard/budgets`)
Set monthly spending targets per category (Food Cost, Utilities, Rent, etc.).

- Progress bars show how much of each budget has been used
- Red = over budget, Amber = approaching limit, Green = safe
- The **Budget vs Actual** view shows exact variances in GYD
- Each budget card has a **More Actions (•••)** menu for edit/delete

### Daily Expense Summary
On the **Expenses** page, switch to **Daily Summary** view to see expenses exactly like the handwritten "Expense Summary Form" — grouped by funding source (Renatta, CEO, Pastry Section, Miss Bonita, QuickServe).

Click **Print Daily Summary** to generate a printable form with signature lines (Prepared By / Checked By / Authorized By).

**To assign a funding source to an expense:** when adding or editing an expense, select who provided the cash from the **Funding Source** dropdown. Click **Manage Sources** to add new sources.

---

## 52. Backup & Restore

The system automatically backs up all data every night at midnight. Up to 7 days of backups are stored.

**To access:** Settings → Backup & Restore (admin and executive only)

### Download a Backup
Go to **Backup & Restore** → click **Download** next to any backup in the list.

### Backup Now
Click **Backup Now** to create an immediate backup at any time.

### Restore from a Listed Backup
1. Go to **Backup & Restore**
2. Click **Restore** next to the backup you want
3. Read the confirmation dialog — it shows what data will be restored
4. Click **Yes, Restore**
5. A snapshot of your current data is saved automatically before the restore begins
6. Refresh the page after restore completes

### Restore from a File
Upload a previously downloaded `.json.gz` backup file using the "Restore from File" section at the bottom of the page.

### Backup Health Indicator
- **Green dot** — a backup was created in the last 24 hours (healthy)
- **Yellow dot** — last backup is 25–48 hours old (check connection)
- **Red dot** — no backup in 48+ hours, or no backups at all (urgent)

---

## 53. User Management

### My Profile
Every staff member can access their own profile by clicking their name in the bottom-left corner of the sidebar and selecting **My Profile**.

**On your profile you can:**
- View your name, email, role, and last login time
- **Change your password** — enter your current password, then set a new one. A strength indicator shows Weak / Fair / Strong
- **Change your PIN** — enter a 4–8 digit numeric PIN for quick POS login
- **Sign out all other devices** — removes sessions from all other browsers/devices except your current one

### Admin User Management (Settings → Users)
Admins can manage all staff accounts from **Settings → Users**:

- **Last Login** column shows when each user last logged in (or "Never")
- **Edit** — update a staff member's name and email
- **Reset Password** — set a temporary password with a copy-to-clipboard button to share via WhatsApp/SMS
- **Set PIN** — assign or clear a 4–8 digit PIN for any staff member
- **Revoke All Sessions** — immediately signs out all devices for that user (useful when offboarding)
- **Delete** — permanently removes the user account (requires confirmation)

### Invite by Email
When creating a new user, toggle **Invite by email** to send the staff member a link to set their own password. If email is not configured, you must set a password manually.

### Forgot Password
On the login screen, click **Forgot password?** below the password field. Enter your email address and you will receive a reset link to set a new password.

---

## 54. Frequently Asked Questions

**Q: A customer wants a refund. How do I process it?**
Go to **Orders** → find the order → click **Refund**. Enter the amount to refund and confirm. The refund is logged against the original payment method.

**Q: The till is short (or over). What do I do?**
When closing the shift, enter the actual cash count. The system records the variance. Report discrepancies to the manager. The Audit Log and no-sale event log can help explain what happened.

**Q: How do I void an order that's already been paid?**
Go to **Operations → Orders** → open the order → click **Void Order** → confirm. Only managers can void completed orders.

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
Yes. The system is mobile-responsive and works on tablets. The New Sale screen is designed to work on 10" and larger screens for the best experience.

**Q: How do I set up the menu board TV?**
Open a browser on the TV, go to https://pos.karetechsolutions.com/menu-board, and click the fullscreen button.

**Q: Customers want to order online. Where do they go?**
Send them to **https://pos.karetechsolutions.com/order** — or make a link/button on your WhatsApp or Facebook page.

**Q: Is there a faster way to navigate between sections?**
Yes — press **Ctrl+K** (or **Cmd+K** on Mac) anywhere in the dashboard to open the command palette. Start typing any section name and press Enter to jump there instantly.

**Q: A customer didn't receive their SMS notification. How do I check?**
Go to **System → Notifications → Log** tab and search for their phone number. The log shows whether the message was delivered, failed, or had an error. Check for typos in the phone number.

**Q: How do I connect the POS to QuickBooks or another accounting system?**
Go to **System → Webhooks** and add a new endpoint with the URL provided by your accounting software or integration (e.g., a Zapier webhook URL). Select the events you want to sync (e.g., `order.completed`). Contact KareTech Solutions for help setting this up.

---

## 55. Getting Help

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
