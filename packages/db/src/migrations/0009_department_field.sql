-- Add department tracking to finance documents
ALTER TABLE "invoice" ADD COLUMN "department" text;
ALTER TABLE "quotation" ADD COLUMN "department" text;
ALTER TABLE "credit_note" ADD COLUMN "department" text;
ALTER TABLE "vendor_bill" ADD COLUMN "department" text;
