# Invoice & Quotation Full Revamp — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete revamp of invoice and quotation pages — fix PDF printing, add tax/discount/payment terms, product/customer auto-complete, aging summary, duplicate, professional Blob-URL PDF documents, and a settings page section for document defaults.

**Architecture:** Blob URL PDFs (same pattern as orders) replace `window.print()`. New DB columns for financial fields. New `invoice_document_settings` table for org-wide defaults. All UI rewritten with full feature parity to top invoicing tools.

**Tech Stack:** React Router v7, oRPC, Drizzle ORM, Postgres, Tailwind, shadcn/ui, Bun

---

## Context: Key Files

| File | Purpose |
|---|---|
| `packages/db/src/schema/invoice.ts` | Drizzle schema for invoice + quotation tables |
| `packages/db/src/migrations/` | SQL migration files (next: `0006_`) |
| `packages/api/src/routers/invoices.ts` | Invoice oRPC router |
| `packages/api/src/routers/quotations.ts` | Quotation oRPC router |
| `packages/api/src/routers/settings.ts` | Settings router (add document settings here) |
| `apps/web/src/routes/dashboard.invoices.tsx` | Invoice page |
| `apps/web/src/routes/dashboard.quotations.tsx` | Quotation page |
| `apps/web/src/routes/dashboard.settings.tsx` | Settings page (add section here) |
| `apps/web/src/index.css` | Global print CSS |
| `apps/web/public/images/bettencourts-logo.png` | Logo for PDF embedding |

## Constants

```
DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001"
DEFAULT_LOC_ID = "b0000000-0000-4000-8000-000000000001"
GY VAT rate = 16.5%
```

---

## Task 1: DB Schema — New Columns + Invoice Document Settings Table

**Files:**
- Modify: `packages/db/src/schema/invoice.ts`
- Create: `packages/db/src/migrations/0006_invoice_quotation_enhancements.sql`

**Step 1: Add new columns to invoice schema**

In `packages/db/src/schema/invoice.ts`, add these fields to the `invoice` table (after `notes`):

```ts
discountType: text("discount_type").notNull().default("percent"), // 'percent' | 'fixed'
discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
taxMode: text("tax_mode").notNull().default("invoice"), // 'invoice' | 'line'
taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("16.5"),
paymentTerms: text("payment_terms").notNull().default("due_on_receipt"),
// 'due_on_receipt' | 'net_15' | 'net_30' | 'net_60' | 'custom'
preparedBy: text("prepared_by"),
```

Add to `quotation` table (after `notes`):

```ts
discountType: text("discount_type").notNull().default("percent"),
discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
taxMode: text("tax_mode").notNull().default("invoice"),
taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("16.5"),
termsAndConditions: text("terms_and_conditions"),
parentQuotationId: uuid("parent_quotation_id").references((): AnyPgColumn => quotation.id, { onDelete: "set null" }),
preparedBy: text("prepared_by"),
```

Note: `AnyPgColumn` is imported from `drizzle-orm/pg-core`.

**Step 2: Add invoice_document_settings table** (after quotation table in same file):

```ts
export const invoiceDocumentSettings = pgTable("invoice_document_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).notNull().default("16.5"),
  defaultTaxMode: text("default_tax_mode").notNull().default("invoice"),
  defaultPaymentTerms: text("default_payment_terms").notNull().default("due_on_receipt"),
  defaultDiscountType: text("default_discount_type").notNull().default("percent"),
  companyTin: text("company_tin"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  bankBranch: text("bank_branch"),
  paymentInstructions: text("payment_instructions"),
  defaultQuotationTerms: text("default_quotation_terms"),
  invoiceFooterNote: text("invoice_footer_note"),
  quotationFooterNote: text("quotation_footer_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

Export it from `packages/db/src/schema/index.ts` alongside the other exports.

**Step 3: Create migration SQL**

Create `packages/db/src/migrations/0006_invoice_quotation_enhancements.sql`:

```sql
-- Invoice enhancements
ALTER TABLE "invoice"
  ADD COLUMN IF NOT EXISTS "discount_type" text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS "discount_value" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_mode" text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2) NOT NULL DEFAULT 16.5,
  ADD COLUMN IF NOT EXISTS "payment_terms" text NOT NULL DEFAULT 'due_on_receipt',
  ADD COLUMN IF NOT EXISTS "prepared_by" text;

-- Quotation enhancements
ALTER TABLE "quotation"
  ADD COLUMN IF NOT EXISTS "discount_type" text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS "discount_value" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_mode" text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2) NOT NULL DEFAULT 16.5,
  ADD COLUMN IF NOT EXISTS "terms_and_conditions" text,
  ADD COLUMN IF NOT EXISTS "parent_quotation_id" uuid REFERENCES "quotation"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "prepared_by" text;

-- Invoice document settings table
CREATE TABLE IF NOT EXISTS "invoice_document_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL UNIQUE REFERENCES "organization"("id") ON DELETE CASCADE,
  "default_tax_rate" numeric(5,2) NOT NULL DEFAULT 16.5,
  "default_tax_mode" text NOT NULL DEFAULT 'invoice',
  "default_payment_terms" text NOT NULL DEFAULT 'due_on_receipt',
  "default_discount_type" text NOT NULL DEFAULT 'percent',
  "company_tin" text,
  "bank_name" text,
  "bank_account" text,
  "bank_branch" text,
  "payment_instructions" text,
  "default_quotation_terms" text,
  "invoice_footer_note" text,
  "quotation_footer_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Seed default settings row for the default org
INSERT INTO "invoice_document_settings" ("organization_id", "default_tax_rate")
VALUES ('a0000000-0000-4000-8000-000000000001', 16.5)
ON CONFLICT ("organization_id") DO NOTHING;
```

**Step 4: Apply migration to live DB**

```bash
docker exec kt-central-db psql -U postgres -d bettencourt_pos \
  -f /dev/stdin < packages/db/src/migrations/0006_invoice_quotation_enhancements.sql
```

**Step 5: Verify**
```bash
docker exec kt-central-db psql -U postgres -d bettencourt_pos \
  -c "\d invoice" | grep discount
# Should show: discount_type, discount_value
```

**Step 6: Commit**
```bash
git add packages/db/src/schema/invoice.ts packages/db/src/migrations/0006_invoice_quotation_enhancements.sql
git commit -m "feat(db): add tax/discount/payment fields and invoice_document_settings table"
```

---

## Task 2: Invoice Document Settings — Router & Settings Page

**Files:**
- Modify: `packages/api/src/routers/settings.ts`
- Modify: `apps/web/src/routes/dashboard.settings.tsx`

**Step 1: Add getDocumentSettings and updateDocumentSettings to settings router**

In `packages/api/src/routers/settings.ts`, add at the bottom before the export:

```ts
// ── getDocumentSettings ───────────────────────────────────────────────
const getDocumentSettings = permissionProcedure("settings.read")
  .input(z.object({}).optional())
  .handler(async () => {
    const rows = await db
      .select()
      .from(schema.invoiceDocumentSettings)
      .where(eq(schema.invoiceDocumentSettings.organizationId, DEFAULT_ORG_ID))
      .limit(1);

    // Auto-create if missing
    if (rows.length === 0) {
      const inserted = await db
        .insert(schema.invoiceDocumentSettings)
        .values({ organizationId: DEFAULT_ORG_ID })
        .returning();
      return inserted[0]!;
    }
    return rows[0]!;
  });

// ── updateDocumentSettings ────────────────────────────────────────────
const updateDocumentSettings = permissionProcedure("settings.update")
  .input(z.object({
    defaultTaxRate: z.number().min(0).max(100).optional(),
    defaultTaxMode: z.enum(["invoice", "line"]).optional(),
    defaultPaymentTerms: z.string().optional(),
    defaultDiscountType: z.enum(["percent", "fixed"]).optional(),
    companyTin: z.string().optional(),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    bankBranch: z.string().optional(),
    paymentInstructions: z.string().optional(),
    defaultQuotationTerms: z.string().optional(),
    invoiceFooterNote: z.string().optional(),
    quotationFooterNote: z.string().optional(),
  }))
  .handler(async ({ input }) => {
    const updates: Record<string, unknown> = {};
    if (input.defaultTaxRate !== undefined) updates.defaultTaxRate = String(input.defaultTaxRate);
    if (input.defaultTaxMode !== undefined) updates.defaultTaxMode = input.defaultTaxMode;
    if (input.defaultPaymentTerms !== undefined) updates.defaultPaymentTerms = input.defaultPaymentTerms;
    if (input.defaultDiscountType !== undefined) updates.defaultDiscountType = input.defaultDiscountType;
    if (input.companyTin !== undefined) updates.companyTin = input.companyTin;
    if (input.bankName !== undefined) updates.bankName = input.bankName;
    if (input.bankAccount !== undefined) updates.bankAccount = input.bankAccount;
    if (input.bankBranch !== undefined) updates.bankBranch = input.bankBranch;
    if (input.paymentInstructions !== undefined) updates.paymentInstructions = input.paymentInstructions;
    if (input.defaultQuotationTerms !== undefined) updates.defaultQuotationTerms = input.defaultQuotationTerms;
    if (input.invoiceFooterNote !== undefined) updates.invoiceFooterNote = input.invoiceFooterNote;
    if (input.quotationFooterNote !== undefined) updates.quotationFooterNote = input.quotationFooterNote;

    await db
      .insert(schema.invoiceDocumentSettings)
      .values({ organizationId: DEFAULT_ORG_ID, ...updates })
      .onConflictDoUpdate({
        target: schema.invoiceDocumentSettings.organizationId,
        set: updates,
      });

    return { success: true };
  });
```

Export both from the settings router object.

**Step 2: Add "Invoice & Quotation" section to settings page**

In `apps/web/src/routes/dashboard.settings.tsx`, add a new card section with:
- Default Tax Rate (number input, %)
- Default Tax Mode (Select: Invoice-level / Per-line)
- Default Payment Terms (Select)
- Company TIN (text)
- Bank Name (text)
- Bank Account Number (text)
- Bank Branch (text)
- Payment Instructions (textarea — shown on invoice PDFs)
- Default Quotation Terms (textarea — auto-filled on new quotations)
- Invoice Footer Note (text)
- Quotation Footer Note (text)

Use a `useMutation(orpc.settings.updateDocumentSettings.mutationOptions(...))` with toast feedback. Load current values via `useQuery(orpc.settings.getDocumentSettings.queryOptions(...))`.

**Step 3: Commit**
```bash
git add packages/api/src/routers/settings.ts apps/web/src/routes/dashboard.settings.tsx
git commit -m "feat(settings): add invoice/quotation document settings section"
```

---

## Task 3: Invoice Router — All New Fields + Duplicate + getSummary

**Files:**
- Modify: `packages/api/src/routers/invoices.ts`

**Step 1: Update `create` input schema**

Add to the z.object in `create`:
```ts
discountType: z.enum(["percent", "fixed"]).optional(),
discountValue: z.string().optional(),
taxMode: z.enum(["invoice", "line"]).optional(),
taxRate: z.string().optional(),
paymentTerms: z.string().optional(),
preparedBy: z.string().optional(),
```

Update the `.values({...})` block to include:
```ts
discountType: input.discountType ?? "percent",
discountValue: input.discountValue ?? "0",
taxMode: input.taxMode ?? "invoice",
taxRate: input.taxRate ?? "16.5",
paymentTerms: input.paymentTerms ?? "due_on_receipt",
preparedBy: input.preparedBy ?? null,
```

**Step 2: Update `update` input schema + handler** — same new fields, add to `updates` map.

**Step 3: Add `duplicate` procedure**

```ts
const duplicate = permissionProcedure("invoices.create")
  .input(z.object({ id: z.string().uuid(), createdBy: z.string() }))
  .handler(async ({ input }) => {
    const existing = await db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.id, input.id))
      .limit(1);

    if (existing.length === 0) throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    const src = existing[0]!;
    const invoiceNumber = await nextInvoiceNumber(DEFAULT_ORG_ID);

    const rows = await db.insert(schema.invoice).values({
      organizationId: src.organizationId,
      locationId: src.locationId,
      invoiceNumber,
      customerName: src.customerName,
      customerAddress: src.customerAddress,
      customerPhone: src.customerPhone,
      customerId: src.customerId,
      items: src.items,
      subtotal: src.subtotal,
      taxTotal: src.taxTotal,
      total: src.total,
      status: "draft",
      discountType: src.discountType,
      discountValue: src.discountValue,
      taxMode: src.taxMode,
      taxRate: src.taxRate,
      paymentTerms: src.paymentTerms,
      notes: src.notes,
      createdBy: input.createdBy,
    }).returning();

    return rows[0]!;
  });
```

**Step 4: Add `getSummary` procedure**

```ts
const getSummary = permissionProcedure("invoices.read")
  .input(z.object({}).optional())
  .handler(async () => {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN total::numeric - amount_paid::numeric ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') AND due_date < NOW() THEN total::numeric - amount_paid::numeric ELSE 0 END), 0) as total_overdue,
        COALESCE(SUM(CASE WHEN status = 'paid' AND date_paid >= date_trunc('month', NOW()) THEN amount_paid::numeric ELSE 0 END), 0) as paid_this_month,
        COUNT(CASE WHEN status = 'draft' THEN 1 END)::int as draft_count,
        COUNT(CASE WHEN status NOT IN ('paid','cancelled') AND due_date < NOW() THEN 1 END)::int as overdue_count
      FROM invoice
      WHERE organization_id = ${DEFAULT_ORG_ID}
    `);
    return result.rows[0] ?? {};
  });
```

**Step 5: Export new procedures** — add `duplicate`, `getSummary` to the `invoicesRouter` export object.

**Step 6: Commit**
```bash
git add packages/api/src/routers/invoices.ts
git commit -m "feat(api): invoice duplicate, getSummary, tax/discount/paymentTerms fields"
```

---

## Task 4: Quotation Router — New Fields + Duplicate + Revision

**Files:**
- Modify: `packages/api/src/routers/quotations.ts`

**Step 1: Update `create` + `update` schemas** — same fields as invoice minus `paymentTerms`, plus:
```ts
termsAndConditions: z.string().optional(),
parentQuotationId: z.string().uuid().optional(),
preparedBy: z.string().optional(),
```

**Step 2: Add `duplicate` procedure** — same pattern as invoice duplicate but for quotation table, using `nextQuotationNumber()`.

**Step 3: Add `revise` procedure**

```ts
const revise = permissionProcedure("quotations.create")
  .input(z.object({ id: z.string().uuid(), createdBy: z.string() }))
  .handler(async ({ input }) => {
    const existing = await db.select().from(schema.quotation)
      .where(eq(schema.quotation.id, input.id)).limit(1);
    if (existing.length === 0) throw new ORPCError("NOT_FOUND", { message: "Not found" });
    const src = existing[0]!;

    // Determine revision suffix: look for existing revisions
    const revisions = await db.select({ num: schema.quotation.quotationNumber })
      .from(schema.quotation)
      .where(eq(schema.quotation.parentQuotationId, input.id));
    const revNum = revisions.length + 2; // v2, v3, etc.

    const quotationNumber = await nextQuotationNumber(DEFAULT_ORG_ID);

    const rows = await db.insert(schema.quotation).values({
      organizationId: src.organizationId,
      locationId: src.locationId,
      quotationNumber: `${quotationNumber}-R${revNum}`,
      customerName: src.customerName,
      customerAddress: src.customerAddress,
      customerPhone: src.customerPhone,
      customerId: src.customerId,
      items: src.items,
      subtotal: src.subtotal,
      taxTotal: src.taxTotal,
      total: src.total,
      status: "draft",
      discountType: src.discountType,
      discountValue: src.discountValue,
      taxMode: src.taxMode,
      taxRate: src.taxRate,
      termsAndConditions: src.termsAndConditions,
      parentQuotationId: input.id,
      notes: src.notes,
      createdBy: input.createdBy,
    }).returning();

    return rows[0]!;
  });
```

**Step 4: Add `markSent` procedure** (for both invoices and quotations):
In invoices.ts:
```ts
const markSent = permissionProcedure("invoices.update")
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input }) => {
    await db.update(schema.invoice).set({ status: "sent" })
      .where(and(eq(schema.invoice.id, input.id), eq(schema.invoice.status, "draft")));
    return { success: true };
  });
```
Same pattern in quotations.ts.

**Step 5: Export** `duplicate`, `revise`, `markSent` from quotations router; `markSent` from invoices router.

**Step 6: Commit**
```bash
git add packages/api/src/routers/quotations.ts packages/api/src/routers/invoices.ts
git commit -m "feat(api): quotation duplicate/revise/markSent, invoice markSent"
```

---

## Task 5: PDF Builders — Invoice PDF (Professional Blob URL)

**Files:**
- Create: `apps/web/src/lib/pdf/invoice-pdf.ts`

**Step 1: Create the file**

```ts
import type { InvoiceRow } from "@/routes/dashboard.invoices"
// (re-export the type or copy it here)

type DocSettings = {
  companyTin?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankBranch?: string | null
  paymentInstructions?: string | null
  invoiceFooterNote?: string | null
}

export async function openInvoicePdf(invoice: InvoiceRow, settings: DocSettings = {}) {
  const logoBase64 = await fetchLogoBase64()
  const html = buildInvoiceHtml(invoice, settings, logoBase64)
  const blob = new Blob([html], { type: "text/html" })
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
  setTimeout(() => URL.revokeObjectURL(url), 15_000)
}

async function fetchLogoBase64(): Promise<string> {
  try {
    const resp = await fetch("/images/bettencourts-logo.png")
    const buf = await resp.arrayBuffer()
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
    return `data:image/png;base64,${b64}`
  } catch {
    return ""
  }
}
```

**Step 2: Implement `buildInvoiceHtml`**

The HTML should use the layout from the design doc. Key CSS:

```css
/* Header band */
.header { background: #1e293b; color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: flex-start; }
.logo-area { display: flex; align-items: center; gap: 16px; }
.logo { height: 52px; width: auto; }
.company-name { font-size: 18px; font-weight: 700; }
.company-sub { font-size: 11px; opacity: 0.75; margin-top: 2px; }
.doc-type { font-size: 22px; font-weight: 800; letter-spacing: 0.15em; text-align: right; }
.doc-number { font-size: 13px; font-family: monospace; margin-top: 4px; }
.doc-meta { font-size: 11px; margin-top: 2px; opacity: 0.85; }

/* Bill-to */
.bill-to-section { padding: 20px 32px; border-bottom: 1px solid #e2e8f0; }
.section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
.customer-name { font-size: 14px; font-weight: 600; }
.customer-sub { font-size: 11px; color: #475569; margin-top: 2px; }

/* Table */
.items-table { width: 100%; border-collapse: collapse; margin: 0; }
.items-table thead tr { background: #f8fafc; }
.items-table th { padding: 10px 16px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; text-align: left; }
.items-table th.right { text-align: right; }
.items-table td { padding: 10px 16px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.items-table td.right { text-align: right; font-variant-numeric: tabular-nums; }
.items-table tr:last-child td { border-bottom: none; }
.items-table tr:nth-child(even) { background: #f8fafc; }

/* Totals */
.totals-section { padding: 16px 32px; display: flex; justify-content: flex-end; border-top: 1px solid #e2e8f0; }
.totals-table { min-width: 280px; }
.totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
.totals-row.separator { border-top: 1px solid #cbd5e1; margin-top: 6px; padding-top: 10px; }
.totals-row.grand { font-size: 14px; font-weight: 700; }
.totals-row.balance { font-size: 15px; font-weight: 800; }
.totals-row.balance .amount { color: #dc2626; }
.totals-row.balance.paid .amount { color: #16a34a; }

/* Payment instructions */
.payment-section { padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
.payment-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
.payment-detail { font-size: 11px; color: #334155; }

/* Footer */
.footer { padding: 12px 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
```

The `buildInvoiceHtml` function returns a full `<!DOCTYPE html>` document string. Compute totals inline:

```ts
function buildInvoiceHtml(invoice: InvoiceRow, settings: DocSettings, logo: string): string {
  const items = Array.isArray(invoice.items) ? invoice.items as LineItem[] : []
  const subtotal = Number(invoice.subtotal)
  const discountAmt = invoice.discountType === "percent"
    ? subtotal * Number(invoice.discountValue ?? 0) / 100
    : Number(invoice.discountValue ?? 0)
  const taxableBase = subtotal - discountAmt
  const taxAmt = Number(invoice.taxTotal) // already computed by API
  const total = Number(invoice.total)
  const paid = Number(invoice.amountPaid)
  const balance = total - paid
  const isFullyPaid = balance <= 0

  const issuedStr = invoice.issuedDate
    ? new Date(invoice.issuedDate).toLocaleDateString("en-GY")
    : new Date(invoice.createdAt).toLocaleDateString("en-GY")
  const dueStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-GY") : null
  const termsLabel: Record<string, string> = {
    due_on_receipt: "Due on Receipt",
    net_15: "Net 15",
    net_30: "Net 30",
    net_60: "Net 60",
    custom: "Custom",
  }

  const logoHtml = logo ? `<img src="${logo}" class="logo" alt="Logo" />` : ""

  const itemRows = items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${fmtGYD(item.unitPrice)}</td>
      ${invoice.taxMode === "line" ? `<td class="right">${(item as Record<string,unknown>).tax_exempt ? "Exempt" : `${invoice.taxRate}%`}</td>` : ""}
      <td class="right">${fmtGYD(item.total)}</td>
    </tr>
  `).join("")

  const paymentBlock = (settings.bankName || settings.paymentInstructions) ? `
    <div class="payment-section">
      <div class="payment-title">Payment Instructions</div>
      ${settings.bankName ? `<div class="payment-detail"><strong>Bank:</strong> ${settings.bankName}${settings.bankBranch ? ` (${settings.bankBranch})` : ""}</div>` : ""}
      ${settings.bankAccount ? `<div class="payment-detail"><strong>Account:</strong> ${settings.bankAccount}</div>` : ""}
      <div class="payment-detail"><strong>Reference:</strong> ${invoice.invoiceNumber}</div>
      ${settings.paymentInstructions ? `<div class="payment-detail" style="margin-top:6px">${settings.paymentInstructions}</div>` : ""}
    </div>` : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${invoice.invoiceNumber} — Bettencourt's Food Inc.</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #1e293b; }
  .wrapper { max-width: 794px; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
  /* [full CSS from step 2 above] */
  @media print {
    @page { margin: 0; }
    body { background: white; }
    .wrapper { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <!-- Header band -->
  <div class="header">
    <div class="logo-area">
      ${logoHtml}
      <div>
        <div class="company-name">Bettencourt's Food Inc.</div>
        <div class="company-sub">Main Location, Georgetown, Guyana</div>
        <div class="company-sub">Tel: +592 000-0000${settings.companyTin ? ` &nbsp;·&nbsp; TIN: ${settings.companyTin}` : ""}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="doc-type">INVOICE</div>
      <div class="doc-number">${invoice.invoiceNumber}</div>
      <div class="doc-meta">Issued: ${issuedStr}</div>
      ${dueStr ? `<div class="doc-meta">Due: ${dueStr}</div>` : ""}
      <div class="doc-meta">Terms: ${termsLabel[invoice.paymentTerms ?? "due_on_receipt"] ?? invoice.paymentTerms}</div>
    </div>
  </div>

  <!-- Bill To -->
  <div class="bill-to-section">
    <div class="section-label">Bill To</div>
    <div class="customer-name">${invoice.customerName}</div>
    ${invoice.customerPhone ? `<div class="customer-sub">${invoice.customerPhone}</div>` : ""}
    ${invoice.customerAddress ? `<div class="customer-sub">${invoice.customerAddress}</div>` : ""}
  </div>

  <!-- Items table -->
  <div style="padding: 0 0">
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Unit Price</th>
          ${invoice.taxMode === "line" ? "<th class='right'>Tax</th>" : ""}
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="totals-section">
    <div class="totals-table">
      <div class="totals-row"><span>Subtotal</span><span>${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="totals-row"><span>Discount${invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span style="color:#dc2626">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="totals-row"><span>Tax (${invoice.taxRate}%)</span><span>${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="totals-row separator grand"><span>Total</span><span>${fmtGYD(total)}</span></div>
      ${paid > 0 ? `<div class="totals-row"><span>Amount Paid</span><span style="color:#16a34a">-${fmtGYD(paid)}</span></div>` : ""}
      <div class="totals-row ${isFullyPaid ? "balance paid" : "balance"}">
        <span>Balance Due</span>
        <span class="amount">${fmtGYD(Math.max(balance, 0))}</span>
      </div>
    </div>
  </div>

  ${paymentBlock}

  <!-- Notes -->
  ${invoice.notes ? `<div style="padding:16px 32px;font-size:12px;color:#475569"><strong>Notes:</strong> ${invoice.notes}</div>` : ""}

  <!-- Footer -->
  <div class="footer">
    Bettencourt's Food Inc. &nbsp;·&nbsp; Thank you for your business &nbsp;·&nbsp; ${new Date().toLocaleString("en-GY")}
    ${invoice.preparedBy ? `&nbsp;·&nbsp; Prepared by: ${invoice.preparedBy}` : ""}
  </div>
</div>
</body>
</html>`
}

function fmtGYD(amount: number): string {
  return new Intl.NumberFormat("en-GY", { style: "currency", currency: "GYD", minimumFractionDigits: 2 }).format(amount)
}
```

**Step 3: Commit**
```bash
git add apps/web/src/lib/pdf/invoice-pdf.ts
git commit -m "feat(pdf): professional invoice Blob URL PDF builder"
```

---

## Task 6: PDF Builder — Quotation PDF

**Files:**
- Create: `apps/web/src/lib/pdf/quotation-pdf.ts`

**Step 1: Create the file** — same pattern as invoice-pdf.ts but with:
- "QUOTATION" stamp badge instead of plain "INVOICE" text in header:
  ```html
  <div style="border:2.5px solid #fff;border-radius:4px;padding:4px 14px;display:inline-block;margin-bottom:8px">
    <div style="font-size:18px;font-weight:800;letter-spacing:0.2em">QUOTATION</div>
  </div>
  ```
- "Valid Until" instead of "Due Date"
- "Valid for X more days" computed from `validUntil - today`
- T&C section before signature:
  ```html
  <div class="tc-section">
    <div class="section-label">Terms & Conditions</div>
    <div class="tc-text">${termsAndConditions}</div>
  </div>
  ```
- Two-column signature section at bottom:
  ```html
  <div class="sig-section">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Authorized By — Bettencourt's Food Inc.</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Accepted By — Customer Signature & Date</div>
    </div>
  </div>
  ```

CSS additions:
```css
.tc-section { padding: 16px 32px; border-top: 1px solid #e2e8f0; }
.tc-text { font-size: 11px; color: #475569; margin-top: 6px; line-height: 1.6; white-space: pre-wrap; }
.sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding: 32px 32px 24px; border-top: 1px solid #e2e8f0; }
.sig-line { border-bottom: 1.5px solid #1e293b; padding-bottom: 40px; margin-bottom: 8px; }
.sig-label { font-size: 10px; color: #475569; }
```

**Step 2: Commit**
```bash
git add apps/web/src/lib/pdf/quotation-pdf.ts
git commit -m "feat(pdf): professional quotation Blob URL PDF builder with stamp and signatures"
```

---

## Task 7: Invoice Page — Full Revamp

**Files:**
- Modify: `apps/web/src/routes/dashboard.invoices.tsx`

This is a substantial rewrite. Work section by section:

**Step 1: Update types**

Add to `InvoiceForm`:
```ts
discountType: "percent" | "fixed"
discountValue: string
taxMode: "invoice" | "line"
taxRate: string
paymentTerms: string
preparedBy: string
```

Add to `InvoiceRow`:
```ts
discountType: string
discountValue: string
taxMode: string
taxRate: string
paymentTerms: string
preparedBy: string | null
```

Update `emptyForm` to include defaults (loaded from document settings query).

**Step 2: Add document settings query**

```ts
const { data: docSettings } = useQuery(
  orpc.settings.getDocumentSettings.queryOptions({ input: {} })
)
```

Use `docSettings` to pre-fill `emptyForm` defaults when opening a new invoice.

**Step 3: Add aging summary cards** (above the table)

```tsx
const { data: summary } = useQuery(orpc.invoices.getSummary.queryOptions({ input: {} }))
const s = (summary ?? {}) as Record<string, unknown>

// Render 4 stat cards:
// Total Outstanding | Overdue (red if > 0) | Paid This Month | Draft Count
```

**Step 4: Add date range filter**

Add `dateFrom` and `dateTo` state. Pass to `list` query. Add two date inputs to the filter bar.

**Step 5: Add Outstanding Balance column** to the list table

```tsx
<TableHead className="text-right text-xs">Balance</TableHead>
// In row:
<TableCell className="text-right font-mono text-xs">
  {Number(inv.total) - Number(inv.amountPaid) > 0
    ? <span className="text-destructive">{formatGYD(Number(inv.total) - Number(inv.amountPaid))}</span>
    : <span className="text-green-600">Paid</span>}
</TableCell>
```

**Step 6: Add Overdue badge** to detail panel (below status badge):

```tsx
{selectedInvoice.dueDate &&
 new Date(selectedInvoice.dueDate) < new Date() &&
 !["paid", "cancelled"].includes(selectedInvoice.status) && (
   <Badge className="bg-red-100 text-red-800 text-[10px]">OVERDUE</Badge>
)}
```

**Step 7: Add Mark as Sent + Duplicate buttons** to detail panel action area

**Step 8: Add product auto-complete on line items**

When user types in description field, query `orpc.products.list` (debounced 300ms). Show a small dropdown below the field. On select, fill description + unit price.

Simple approach:
```tsx
const [productSearch, setProductSearch] = useState<Record<number, string>>({})
const activeLineIdx = useRef<number | null>(null)

const { data: productResults } = useQuery(
  orpc.products.list.queryOptions({
    input: { search: productSearch[activeLineIdx.current ?? -1] ?? "", limit: 5 }
  }),
  { enabled: !!productSearch[activeLineIdx.current ?? -1] }
)
```

Show results in a `Popover` or absolute div positioned below the input.

**Step 9: Add customer auto-complete on customer name field**

Same pattern using `orpc.customers.list`.

**Step 10: Add tax settings bar to form**

Above the line items table, add a compact settings row:
```tsx
<div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/40 p-2 text-sm">
  <div className="flex items-center gap-1.5">
    <span className="text-muted-foreground text-xs">Tax mode:</span>
    <Select value={form.taxMode} onValueChange={...}>
      <SelectItem value="invoice">Invoice-level</SelectItem>
      <SelectItem value="line">Per-line</SelectItem>
    </Select>
  </div>
  <div className="flex items-center gap-1.5">
    <span className="text-muted-foreground text-xs">Rate:</span>
    <Input className="h-7 w-16 text-xs" value={form.taxRate} onChange={...} />
    <span className="text-xs">%</span>
  </div>
  <div className="flex items-center gap-1.5">
    <span className="text-muted-foreground text-xs">Discount:</span>
    <Select value={form.discountType} onValueChange={...}>
      <SelectItem value="percent">%</SelectItem>
      <SelectItem value="fixed">GYD</SelectItem>
    </Select>
    <Input className="h-7 w-20 text-xs" value={form.discountValue} onChange={...} />
  </div>
  <div className="flex items-center gap-1.5">
    <span className="text-muted-foreground text-xs">Terms:</span>
    <Select value={form.paymentTerms} onValueChange={...}>
      <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
      <SelectItem value="net_15">Net 15</SelectItem>
      <SelectItem value="net_30">Net 30</SelectItem>
      <SelectItem value="net_60">Net 60</SelectItem>
    </Select>
  </div>
</div>
```

**Step 11: Update totals computation in form** to include discount + tax:

```ts
const subtotal = form.items.reduce((s, i) => s + i.total, 0)
const discountAmt = form.discountType === "percent"
  ? subtotal * Number(form.discountValue || 0) / 100
  : Number(form.discountValue || 0)
const taxableBase = subtotal - discountAmt
const taxAmt = Number(form.taxRate || 0) / 100 * taxableBase
const total = taxableBase + taxAmt
```

Pass `taxTotal: String(taxAmt), total: String(total)` to create/update mutation.

**Step 12: Replace Print button** with call to `openInvoicePdf(selectedInvoice, docSettings)` from `@/lib/pdf/invoice-pdf`.

**Step 13: Commit**
```bash
git add apps/web/src/routes/dashboard.invoices.tsx
git commit -m "feat(ui): invoice page full revamp — aging summary, tax/discount, auto-complete, PDF"
```

---

## Task 8: Quotation Page — Full Revamp

**Files:**
- Modify: `apps/web/src/routes/dashboard.quotations.tsx`

Follow same pattern as Task 7 but for quotations:

**Step 1: Update types** — add `discountType`, `discountValue`, `taxMode`, `taxRate`, `termsAndConditions`, `parentQuotationId`, `preparedBy` to `QuotationForm` and `QuotationRow`.

**Step 2: Add docSettings query** — same as invoices.

**Step 3: Add tax settings bar + discount** — same compact settings row (no payment terms for quotations).

**Step 4: Add T&C textarea** to form (after notes):

```tsx
<div className="flex flex-col gap-1.5">
  <Label>Terms & Conditions</Label>
  <Textarea
    placeholder="Auto-filled from Settings if configured..."
    value={form.termsAndConditions}
    onChange={(e) => setForm(f => ({ ...f, termsAndConditions: e.target.value }))}
    className="h-24 resize-none text-xs"
  />
</div>
```

**Step 5: Add product + customer auto-complete** — same pattern as invoices.

**Step 6: Add Mark as Sent + Duplicate + Revise buttons** on the detail panel.

**Step 7: Add validity countdown** to detail panel:

```tsx
{selectedQuotation.validUntil && (
  <p className="text-xs text-muted-foreground">
    {(() => {
      const days = Math.ceil((new Date(selectedQuotation.validUntil).getTime() - Date.now()) / 86400000)
      return days > 0 ? `Valid for ${days} more day${days !== 1 ? "s" : ""}` : "Expired"
    })()}
  </p>
)}
```

**Step 8: Replace Print button** with call to `openQuotationPdf(selectedQuotation, docSettings)`.

**Step 9: Commit**
```bash
git add apps/web/src/routes/dashboard.quotations.tsx
git commit -m "feat(ui): quotation page full revamp — T&C, revise, auto-complete, PDF"
```

---

## Task 9: TypeScript Check + Screenshot Verification + Build + Deploy

**Step 1: TypeScript check**
```bash
bunx tsc -p apps/web/tsconfig.json --noEmit 2>&1 | head -20
```
Fix any errors before proceeding.

**Step 2: Screenshot the invoice PDF**

Use Playwright MCP to:
1. Navigate to `https://pos.karetechsolutions.com`
2. Log in (demo or admin)
3. Navigate to Invoices → select an invoice
4. Click "Print / Save PDF"
5. Take screenshot of the new tab

**Step 3: Screenshot the quotation PDF** — same flow for quotations.

**Step 4: Build + deploy**
```bash
docker compose -f docker-compose.prod.yml build --no-cache 2>&1 | tail -5
docker compose -f docker-compose.prod.yml up -d
sleep 5 && docker logs kt-bettencourt-pos --tail 5
```

**Step 5: Push to GitHub**
```bash
git push origin master
```

**Step 6: Update docs**
- Update `apps/fumadocs/content/docs/invoices.mdx` — document all new fields
- Update `docs/USER-MANUAL.md` §4 Invoices and §5 Quotations sections
- Commit: `git commit -m "docs: update invoices/quotations user manual and fumadocs"`

---

## Checklist Summary

- [ ] Task 1: DB migration applied + schema updated
- [ ] Task 2: Document settings in Settings page
- [ ] Task 3: Invoice router — new fields + duplicate + getSummary + markSent
- [ ] Task 4: Quotation router — new fields + duplicate + revise + markSent
- [ ] Task 5: Invoice PDF builder (professional Blob URL)
- [ ] Task 6: Quotation PDF builder (Blob URL with stamp + signature)
- [ ] Task 7: Invoice page full revamp
- [ ] Task 8: Quotation page full revamp
- [ ] Task 9: TS check + screenshots + build + deploy + docs
