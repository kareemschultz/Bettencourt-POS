-- Add is_component flag to order_line_item to distinguish combo component lines
-- from parent lines. Component lines are excluded from revenue reports to prevent
-- double-counting: the parent combo line already carries the full price.
ALTER TABLE "order_line_item"
  ADD COLUMN IF NOT EXISTS "is_component" boolean NOT NULL DEFAULT false;
