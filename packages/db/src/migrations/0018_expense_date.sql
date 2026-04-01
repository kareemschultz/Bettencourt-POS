-- Migration 0018: Add expense_date to expense table
-- Separates "when the expense occurred" from "when the entry was created".
-- created_at remains the immutable audit timestamp.
-- expense_date is the user-supplied date of the actual expense.

ALTER TABLE expense
  ADD COLUMN expense_date date NOT NULL DEFAULT CURRENT_DATE;

-- Backfill existing rows: use the date portion of created_at in Guyana timezone
UPDATE expense
  SET expense_date = (created_at AT TIME ZONE 'America/Guyana')::date;

-- Index for date-range queries (replaces the created_at range filter)
CREATE INDEX idx_expense_expense_date ON expense (organization_id, expense_date);
