# Bettencourt POS — System Handover Document

**Prepared by:** KareTech Solutions
**Date:** April 2026
**Version:** 1.0

---

## 1. System Overview

Bettencourt POS is a cloud-based point-of-sale and business management system purpose-built for Bettencourt Foods Inc. and the Home Style restaurant brand. It is a comprehensive system covering daily sales operations, kitchen management, inventory control, financial accounting, customer loyalty, and reporting.

**System URL:** [pos.bettencourtgy.com](https://pos.bettencourtgy.com)
**User Manual:** [pos.bettencourtgy.com/manual/](https://pos.bettencourtgy.com/manual/)
**Technology:** React, Hono.js, PostgreSQL, hosted on KareTech managed infrastructure

---

## 2. System Access

### Login Methods

| Method | Who Uses It | How |
|--------|------------|-----|
| **PIN Login** | Cashiers, kitchen staff, warehouse | Enter 4-8 digit PIN on login screen |
| **Email Login** | Managers, administrators, executives | Click "Sign in with Email", enter email and password |

### User Management

Administrators manage all user accounts at **Settings → Users**:
- Create new users with name, email, role, and PIN
- Reset PINs for staff who forget theirs
- Assign built-in roles (Cashier, Kitchen, Warehouse, Accountant, Admin, Executive) or custom roles
- Deactivate users who leave the organisation

### Security

- PIN login is rate-limited: 5 failed attempts triggers a 60-second lockout per IP address
- All actions are recorded in the immutable Audit Log
- Supervisor approval (manager PIN) is required for sensitive operations like large discounts and order voids
- Session cookies are secure and expire after inactivity

---

## 3. Feature Summary

### Point of Sale
- New Sale terminal with product grid, cart, modifiers, and combo products
- Multiple payment methods: Cash (with GYD quick-cash buttons), Card, Gift Card, Split Payment
- Order types: Dine In (table assignment), Takeaway, Delivery
- Hold and retrieve orders
- Discount presets with supervisor approval for large discounts
- Receipt printing via network thermal printers (ESC/POS)
- Menu schedules for time-based product availability

### Kitchen Display System (KDS)
- Real-time order tickets with colour-coded wait times
- Department filtering (Meals, Pastry, Beverages)
- Course-based firing for multi-course dine-in service
- Per-item status tracking (preparing, ready, served)

### Production & Check Off
- Daily production logging (Opening, Reorder, Closing entries)
- Combo product component splitting
- Production vs Sales variance report
- Waste logging with reasons and cost tracking

### Inventory & Stock Management
- Stock levels with reorder points and automatic low-stock alerts
- Stock movements (received, used, wasted, adjusted)
- Purchase orders with goods receipt workflow
- Stock counts (physical count vs expected)
- Inter-location transfers
- Barcode support for products and inventory items
- Labels printing

### Cash Control
- Open/close shifts with starting cash count
- Cash drops (moving excess to safe)
- Payouts (petty cash, delivery fees)
- No-sale events (drawer opens without transaction)
- End-of-shift reconciliation (expected vs actual cash count)
- Shift handoffs between managers

### Finance & Accounting
- **Invoices** — create, send, record payments (cash, cheque, bank transfer, mobile money), payment history with reversals, unapplied payment allocation
- **Quotations** — professional PDFs with validity countdown, revisions, convert to invoice
  - Accept/Reject workflow with one-click buttons and status badges (ACCEPTED / REJECTED / EXPIRED)
  - Auto-expiry when validity date passes
  - Government/Agency mode: structured fields for Ministry, Department, Division, Department Details, and Order Placed By — all fields carry over automatically on conversion to invoice
  - Rich item descriptions with bold, underline, and bullet list formatting in PDF output
- **Credit Notes** — issue and apply to invoices, partial or full
- **Vendor Bills** — accounts payable tracking with payment recording
- **Recurring Templates** — auto-generate invoices, expenses, or vendor bills on schedule
- **Aging Reports** — receivable and payable aging by bucket (current, 1-30, 31-60, 61-90, 90+ days)
- **Customer Statements** — per-customer transaction history with running balance
- **Tax Summary** — VAT collected vs VAT paid, net tax liability
- **Budgets** — category budgets with actual vs budgeted tracking and alerts
- **P&L Statement** — revenue, COGS, gross profit, expenses, labor, net profit/loss

### Expenses
- Daily expense recording with categories, suppliers, payment methods, and receipt photo upload
- Funding source tracking (General Cash, CEO, Pastry Section, etc.)
- Daily Summary mode with printable branded form
- Duplicate expense warnings
- CSV export and PDF reports
- Feeds automatically into P&L Statement

### Customers & Loyalty
- Customer database with contact details, order history, and delivery addresses
- Loyalty program with tiered points (Bronze, Silver, Gold)
- Gift cards with balance tracking and transaction history
- Discount presets (percentage or fixed amount, with minimum order thresholds)
- Price lists for customer-specific pricing (wholesale, VIP, staff)
- Customer statements and payment ledger
- Agency/organization management for corporate clients

### Suppliers & Vendors
- Pre-loaded vendor register (67 suppliers)
- Vendor detail page with spend analytics, trend charts, and category breakdowns
- Print vendor statements as PDF
- Export transactions as CSV
- Linked to purchase orders, inventory, expenses, and stock alerts

### Reports & Analytics
- 13 core report types (sales, department totals, cashier activity, hourly sales, Z-report, voids, production, weekly trend, tips, customer analytics, etc.)
- Advanced analytics: revenue trends, hourly patterns, day-of-week performance, ABC analysis
- Sales journal (line-by-line transaction record)
- Cash reconciliation with variance tracking
- Profitability analysis by product and department
- Labor cost tracking and analysis
- End of Day (EOD) printable report
- CSV export on all major reports

### Staff & Administration
- Time clock (clock in/out with manager editing)
- Shift handoffs between managers
- Audit log (immutable, non-deletable record of all system changes)
- Menu schedules (time-based product availability)
- Custom roles with granular permissions (30+ resource categories)

### Integrations
- **Webhooks** — POST events to external systems (Zapier, QuickBooks, Slack, etc.) with HMAC signature verification
- **SMS/WhatsApp Notifications** — via Twilio (order ready, loyalty earned, refund processed)
- **Online Ordering** — public page for customer orders (pickup/delivery)
- **Menu Board** — public TV display of active products and prices

### Additional Features
- Floor plans and table layout management
- Table reservations and walk-in waitlist
- Delivery order management with fulfillment tracking
- Data backup and restore (automatic nightly + manual)
- Desktop app (Tauri) for offline-capable POS terminals
- Multi-location support
- Multi-brand support (Foods Inc. and Home Style)

---

## 4. Infrastructure & Hosting

| Item | Details |
|------|---------|
| **Hosting** | KareTech Solutions managed infrastructure (Hetzner Cloud, Germany) |
| **Domain** | pos.bettencourtgy.com (SSL encrypted) |
| **Database** | PostgreSQL (managed by KareTech) |
| **Backups** | Automated nightly backups, retained for 7 days, plus manual backup capability |
| **Uptime** | Monitored by KareTech Solutions |
| **Reverse Proxy** | Pangolin (SSL termination, routing, security) |

All infrastructure is managed by KareTech Solutions. No server access or technical knowledge is required from Bettencourt staff.

---

## 5. Support & Maintenance

| Item | Details |
|------|---------|
| **Provider** | KareTech Solutions |
| **Contact** | Kareem Schultz |
| **Website** | [karetechsolutions.com](https://karetechsolutions.com) |
| **Support Channels** | Phone, WhatsApp, Email |
| **Response Time** | As per service agreement |
| **System Updates** | Deployed by KareTech with advance notice |
| **Maintenance Windows** | Non-business hours when possible |

### How to Request Support

1. Describe the issue: what were you doing, what happened, what did you expect
2. Note the date and time
3. Include a screenshot if possible
4. Contact Kareem via WhatsApp or phone

---

## 6. Data Ownership

- All business data (orders, customers, inventory, financial records, staff data) belongs to Bettencourt Foods Inc.
- Data can be exported via CSV from any report or list view in the system
- Full database backups are available on request
- Customer data is handled in accordance with applicable data protection requirements

---

## 7. Training Resources

| Resource | Location |
|----------|----------|
| **User Manual** | [pos.bettencourtgy.com/manual/](https://pos.bettencourtgy.com/manual/) |
| **FAQ** | [pos.bettencourtgy.com/manual/docs/faq](https://pos.bettencourtgy.com/manual/docs/faq) |
| **Role-specific guides** | Each section of the manual is tagged by role |
| **On-site training** | Available from KareTech Solutions on request |
| **Remote training** | Available via video call |

### Quick Start by Role

| Role | First Steps |
|------|------------|
| **Cashier** | Log in with PIN → New Sale → take orders → process payments |
| **Kitchen Staff** | Log in with PIN → Kitchen Display → prepare orders → mark ready |
| **Warehouse** | Log in with PIN → Inventory → manage stock levels and purchase orders |
| **Accountant** | Log in with email → Finance Dashboard → invoices, expenses, reports |
| **Manager** | Log in with email → Dashboard → overview, settings, reports, user management |

---

## 8. Delivered Features Summary

The following modules have been designed, built, and deployed as part of the Bettencourt POS project:

1. Point of Sale (POS) terminal with full payment processing
2. Kitchen Display System (KDS) with course-based firing
3. Production and check-off board with combo product handling
4. Inventory management with purchase orders, goods receipts, and stock alerts
5. Cash control with shift management and reconciliation
6. Complete finance suite (invoices, quotations, credit notes, vendor bills, recurring templates)
   - Quotation Accept/Reject workflow, auto-expiry, government agency fields (Ministry, Department, Division, Department Details)
   - All government fields carry through quotation → invoice conversion automatically
7. Expense tracking with funding sources and daily summary forms
8. Aging reports, customer statements, and tax summary
9. Budget management with category tracking and alerts
10. Customer database with loyalty program, gift cards, and price lists
11. Supplier directory with vendor analytics and spend tracking
12. 13 report types plus advanced analytics and profitability analysis
13. Staff management with time clock, wage tracking, and audit log
14. Webhook and notification integrations (SMS/WhatsApp via Twilio)
15. Online ordering and public menu board
16. Floor plan and table management with reservations and waitlist
17. Data backup and restore with automatic nightly backups
18. Desktop application for offline-capable POS terminals
19. Multi-location and multi-brand support
20. Custom roles with granular permission control

---

## 9. Glossary

| Term | Meaning |
|------|---------|
| **POS** | Point of Sale — the screen where orders are taken and payments processed |
| **KDS** | Kitchen Display System — the kitchen screen showing active orders |
| **EOD** | End of Day — the daily closing report |
| **GYD** | Guyana Dollar — the currency used throughout the system |
| **VAT** | Value Added Tax — included in product prices (Guyana uses VAT-inclusive pricing) |
| **P&L** | Profit and Loss Statement |
| **COGS** | Cost of Goods Sold — raw material/ingredient costs |
| **AR** | Accounts Receivable — money owed to you by customers |
| **AP** | Accounts Payable — money you owe to suppliers |

---

*This document was prepared by KareTech Solutions as part of the Bettencourt POS system handover. For questions or clarifications, contact Kareem Schultz at KareTech Solutions.*
