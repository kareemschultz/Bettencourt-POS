# Invoices & Quotations Module - Design Document

**Date:** 2026-03-06
**Status:** Draft

## Overview

Quotations are created by clerical/accountant staff and can be converted into invoices. Invoices are restricted to executive users. Both track customer details, line items, and financial totals. Invoices additionally track payment details (cheque numbers, receipt numbers, date paid) with automatic status calculation.

---

## 1. Database Schema

New file: `packages/db/src/schema/invoice.ts`

### `invoice` table

```ts
export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    invoiceNumber: text("invoice_number").notNull().unique(),
    // Customer (optional FK + denormalized fields for non-registered customers)
    customerId: uuid("customer_id").references(() => customer.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerAddress: text("customer_address"),
    customerPhone: text("customer_phone"),
    // Line items as JSONB: Array<{ description, quantity, unitPrice, total }>
    items: jsonb("items").notNull().default([]),
    // Totals
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    // Status
    status: text("status").notNull().default("draft"),
    // Payment tracking
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    chequeNumber: text("cheque_number"),
    receiptNumber: text("receipt_number"),
    datePaid: timestamp("date_paid", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    // Metadata
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_invoice_org").on(table.organizationId),
    index("idx_invoice_location").on(table.locationId),
    index("idx_invoice_status").on(table.status),
    index("idx_invoice_customer").on(table.customerId),
    index("idx_invoice_created").on(table.createdAt),
  ],
);
```

**Status values:** `draft` | `sent` | `outstanding` | `paid` | `overpaid` | `cancelled`

**Status calculation logic** (in API layer, not DB):
- `amountPaid === 0` and status not manually set => `outstanding` (once sent)
- `amountPaid >= total` => `paid`
- `amountPaid > total` => `overpaid`
- `amountPaid > 0 && amountPaid < total` => `outstanding` (partial)

### `quotation` table

```ts
export const quotation = pgTable(
  "quotation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    quotationNumber: text("quotation_number").notNull().unique(),
    // Customer
    customerId: uuid("customer_id").references(() => customer.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerAddress: text("customer_address"),
    customerPhone: text("customer_phone"),
    // Line items as JSONB
    items: jsonb("items").notNull().default([]),
    // Totals
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    // Status & validity
    status: text("status").notNull().default("draft"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    // Conversion tracking
    convertedInvoiceId: uuid("converted_invoice_id").references(() => invoice.id, {
      onDelete: "set null",
    }),
    // Metadata
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_quotation_org").on(table.organizationId),
    index("idx_quotation_location").on(table.locationId),
    index("idx_quotation_status").on(table.status),
    index("idx_quotation_customer").on(table.customerId),
    index("idx_quotation_created").on(table.createdAt),
  ],
);
```

**Status values:** `draft` | `sent` | `accepted` | `rejected` | `expired` | `converted`

### `invoice_counter` / `quotation_counter` tables

Follow the same pattern as `daily_order_counter` but org-scoped (not daily):

```ts
export const invoiceCounter = pgTable("invoice_counter", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
});

export const quotationCounter = pgTable("quotation_counter", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
});
```

Number format: `INV-0001`, `QUO-0001` (auto-increment per org, padded to 4 digits).

### JSONB `items` Shape

```ts
type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number; // stored as number in JSONB
  total: number;     // quantity * unitPrice
};
```

### Relations

```ts
export const invoiceRelations = relations(invoice, ({ one }) => ({
  organization: one(organization, { fields: [invoice.organizationId], references: [organization.id] }),
  location: one(location, { fields: [invoice.locationId], references: [location.id] }),
  customer: one(customer, { fields: [invoice.customerId], references: [customer.id] }),
  createdByUser: one(user, { fields: [invoice.createdBy], references: [user.id] }),
}));

export const quotationRelations = relations(quotation, ({ one }) => ({
  organization: one(organization, { fields: [quotation.organizationId], references: [organization.id] }),
  location: one(location, { fields: [quotation.locationId], references: [location.id] }),
  customer: one(customer, { fields: [quotation.customerId], references: [customer.id] }),
  createdByUser: one(user, { fields: [quotation.createdBy], references: [user.id] }),
  convertedInvoice: one(invoice, { fields: [quotation.convertedInvoiceId], references: [invoice.id] }),
}));
```

### Schema index export

Add `export * from "./invoice"` to `packages/db/src/schema/index.ts`.

---

## 2. Permissions

### New permission resources

Add two new resource keys to the permissions JSONB structure:

| Resource      | Actions                     |
|---------------|-----------------------------|
| `quotations`  | `create`, `read`, `update`, `delete` |
| `invoices`    | `create`, `read`, `update`, `delete` |

### Role assignments (in `seed.ts`)

| Role           | `quotations`                    | `invoices`                      |
|----------------|----------------------------------|----------------------------------|
| **Executive**  | `["create","read","update","delete"]` | `["create","read","update","delete"]` |
| **Owner**      | `["create","read","update","delete"]` | `["create","read","update","delete"]` |
| **Manager**    | `["read"]`                       | `["read"]`                       |
| **Accountant** | `["create","read","update","delete"]` | `["read"]`                       |
| **Cashier**    | `[]`                             | `[]`                             |
| **Others**     | `[]`                             | `[]`                             |

The Accountant role serves as the "clerical staff" role. They get full CRUD on quotations but read-only on invoices. Executives get full access to both.

---

## 3. API Endpoints

New files: `packages/api/src/routers/quotations.ts`, `packages/api/src/routers/invoices.ts`

### Quotations Router

```ts
export const quotationsRouter = {
  list,            // permissionProcedure("quotations.read")
  getById,         // permissionProcedure("quotations.read")
  create,          // permissionProcedure("quotations.create")
  update,          // permissionProcedure("quotations.update")
  delete,          // permissionProcedure("quotations.delete") — soft: set status=cancelled
  convertToInvoice, // permissionProcedure("invoices.create") — requires invoice permission
};
```

**`convertToInvoice` logic:**
1. Validate quotation exists and status is `sent` or `accepted`
2. Generate next invoice number from `invoiceCounter`
3. Insert new invoice row, copying customer/items/totals from quotation
4. Set invoice status to `outstanding`
5. Update quotation: `status = "converted"`, `convertedInvoiceId = newInvoice.id`
6. Return the new invoice

### Invoices Router

```ts
export const invoicesRouter = {
  list,       // permissionProcedure("invoices.read")
  getById,    // permissionProcedure("invoices.read")
  create,     // permissionProcedure("invoices.create")
  update,     // permissionProcedure("invoices.update")
  delete,     // permissionProcedure("invoices.delete") — soft: set status=cancelled
  markPaid,   // permissionProcedure("invoices.update")
  export,     // permissionProcedure("invoices.read") — returns data formatted for print/PDF
};
```

**`markPaid` input:**
```ts
z.object({
  id: z.string().uuid(),
  amountPaid: z.string(), // numeric string, e.g. "15000.00"
  chequeNumber: z.string().optional(),
  receiptNumber: z.string().optional(),
  datePaid: z.string().datetime().optional(), // defaults to now
})
```

**`markPaid` logic:**
1. Update `amountPaid`, `chequeNumber`, `receiptNumber`, `datePaid`
2. Auto-calculate status:
   - `amountPaid >= total` => `"paid"`
   - `amountPaid > total` => `"overpaid"`
   - `amountPaid > 0 && amountPaid < total` => `"outstanding"`

### Registration

Add to `packages/api/src/routers/index.ts`:
```ts
import { quotationsRouter } from "./quotations";
import { invoicesRouter } from "./invoices";

// In appRouter:
quotations: quotationsRouter,
invoices: invoicesRouter,
```

### Input Schemas (shared)

```ts
const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const createInput = z.object({
  locationId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1),
  customerAddress: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
  subtotal: z.string(),
  taxTotal: z.string(),
  total: z.string(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),      // invoice only
  validUntil: z.string().datetime().optional(),    // quotation only
});
```

---

## 4. UI Pages

### Route Files

| File | Permission Gate |
|------|----------------|
| `apps/web/src/routes/dashboard.quotations.tsx` | `quotations.read` |
| `apps/web/src/routes/dashboard.invoices.tsx` | `invoices.read` |

### Quotations Page (`/dashboard/quotations`)

**Layout:** Same pattern as `dashboard.customers.tsx` — table list + side detail panel.

**Features:**
- Search/filter by customer name, quotation number, status
- Status badges: draft (gray), sent (blue), accepted (green), rejected (red), expired (amber), converted (purple)
- Create/Edit dialog with:
  - Customer selector (search existing or type name/address/phone manually)
  - Dynamic line items table (add/remove rows: description, qty, unit price, auto-calc total)
  - Auto-sum subtotal/tax/total
  - Valid-until date picker
  - Notes textarea
- Row actions: Edit, Convert to Invoice (shows confirmation, requires `invoices.create`)
- Print button opens a clean print layout (CSS `@media print`)

### Invoices Page (`/dashboard/invoices`)

**Layout:** Table list with expandable detail / side panel.

**Features:**
- Search/filter by customer name, invoice number, status
- Status badges: draft (gray), sent (blue), outstanding (amber), paid (green), overpaid (purple), cancelled (red)
- Create/Edit dialog (same line-item builder as quotations)
- Payment tracking panel (visible when invoice selected):
  - Amount paid input
  - Cheque number input
  - Receipt number input
  - Date paid picker
  - "Record Payment" button
- Print/Export button — professional invoice layout with:
  - Company header (from `receiptConfig`)
  - Invoice number, date, due date
  - Customer details block
  - Items table with columns: Description, Qty, Unit Price, Total
  - Subtotal / Tax / Total summary
  - Payment status and details
  - Footer with notes

### Navigation

Add to the dashboard sidebar (in `dashboard.tsx`):
- Under a "Finance" or "Accounting" section:
  - Quotations (icon: `FileText`)
  - Invoices (icon: `Receipt`)
- Conditionally show based on user permissions (same pattern as other nav items)

---

## 5. Workflow

```
[Clerical/Accountant]              [Executive]
       |                                |
  Create Quotation                      |
  (status: draft)                       |
       |                                |
  Send to Customer                      |
  (status: sent)                        |
       |                                |
  Customer Accepts                      |
  (status: accepted)                    |
       |                                |
       +--- Convert to Invoice -------->+
             (quotation: converted)     |
             (invoice: outstanding)     |
                                        |
                                   Record Payment
                                   (cheque #, receipt #, date)
                                        |
                                   Status auto-calculates:
                                   paid / overpaid / outstanding
```

---

## 6. Number Generation

Use atomic `UPDATE ... RETURNING` to avoid race conditions:

```ts
async function nextInvoiceNumber(orgId: string): Promise<string> {
  const [row] = await db
    .insert(invoiceCounter)
    .values({ organizationId: orgId, lastNumber: 1 })
    .onConflictDoUpdate({
      target: invoiceCounter.organizationId,
      set: { lastNumber: sql`${invoiceCounter.lastNumber} + 1` },
    })
    .returning({ lastNumber: invoiceCounter.lastNumber });
  return `INV-${String(row.lastNumber).padStart(4, "0")}`;
}
```

Same pattern for `nextQuotationNumber` with `QUO-` prefix.

---

## 7. Migration

Generate with: `bun drizzle-kit generate`

This will create the migration for:
- `invoice` table
- `quotation` table
- `invoice_counter` table
- `quotation_counter` table
- All indexes

---

## 8. Files to Create/Modify

### New Files
- `packages/db/src/schema/invoice.ts` — schema definitions
- `packages/api/src/routers/quotations.ts` — quotation endpoints
- `packages/api/src/routers/invoices.ts` — invoice endpoints
- `apps/web/src/routes/dashboard.quotations.tsx` — quotations UI
- `apps/web/src/routes/dashboard.invoices.tsx` — invoices UI

### Modified Files
- `packages/db/src/schema/index.ts` — add `export * from "./invoice"`
- `packages/api/src/routers/index.ts` — register new routers in `appRouter`
- `packages/db/src/seed.ts` — add `quotations` and `invoices` permissions to all roles
- `apps/web/src/routes/dashboard.tsx` — add nav items for Quotations and Invoices
