-- Add brand column to invoice and quotation tables
-- Allows selecting which company (Foods Inc. vs Home Style) appears on the document

ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "brand" text NOT NULL DEFAULT 'foods_inc';
ALTER TABLE "quotation" ADD COLUMN IF NOT EXISTS "brand" text NOT NULL DEFAULT 'foods_inc';
