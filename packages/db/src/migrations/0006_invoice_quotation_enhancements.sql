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
