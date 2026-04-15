-- Junction table: one expense can belong to many categories
CREATE TABLE expense_category_link (
  expense_id UUID NOT NULL REFERENCES expense(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES expense_category(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, category_id)
);
CREATE INDEX idx_ecl_expense ON expense_category_link(expense_id);
CREATE INDEX idx_ecl_category ON expense_category_link(category_id);

-- Backfill: for each existing expense, find the matching expenseCategory row
-- (matched by name + org) and insert a link row
INSERT INTO expense_category_link (expense_id, category_id)
SELECT e.id, ec.id
FROM expense e
JOIN expense_category ec
  ON ec.name = e.category
 AND ec.organization_id = e.organization_id
WHERE e.category IS NOT NULL AND e.category != '';

-- Make the old column nullable (keep for backward-compat with existing reports; drop in a future migration)
ALTER TABLE expense ALTER COLUMN category DROP NOT NULL;
