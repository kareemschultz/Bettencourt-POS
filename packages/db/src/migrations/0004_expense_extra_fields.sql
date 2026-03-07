-- Add payment_method, reference_number, notes to expense table
ALTER TABLE expense
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS notes text;
