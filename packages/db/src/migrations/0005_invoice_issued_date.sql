-- Add issued_date column to invoice table
-- Allows invoices to have an explicit issued date separate from created_at

ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "issued_date" timestamptz;
