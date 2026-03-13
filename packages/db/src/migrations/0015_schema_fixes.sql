-- Migration 0015: Schema audit fixes
-- Applied via db:push. This file documents the changes for reference.

-- 1. Fix tax_rate precision: numeric(5,4) max 9.9999 → numeric(6,2) supports up to 9999.99%
--    Guyana VAT is 14% or 16.5% — previously overflowed the column
ALTER TABLE product ALTER COLUMN tax_rate TYPE numeric(6,2);
ALTER TABLE tax_rate ALTER COLUMN rate TYPE numeric(6,2);

-- 2. Fix shift.is_active: text ("true"/"false") → proper boolean
ALTER TABLE shift ALTER COLUMN is_active TYPE boolean USING (is_active = 'true');
ALTER TABLE shift ALTER COLUMN is_active SET DEFAULT true;

-- 3. Add missing CASCADE on shift foreign keys
ALTER TABLE shift DROP CONSTRAINT IF EXISTS shift_organization_id_organization_id_fk;
ALTER TABLE shift ADD CONSTRAINT shift_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE shift DROP CONSTRAINT IF EXISTS shift_location_id_location_id_fk;
ALTER TABLE shift ADD CONSTRAINT shift_location_id_fk
    FOREIGN KEY (location_id) REFERENCES location(id) ON DELETE SET NULL;

-- 4. Add missing user FK on shift.user_id
ALTER TABLE shift ADD CONSTRAINT shift_user_id_fk
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- 5. Add missing CASCADE on waitlist_entry foreign keys
ALTER TABLE waitlist_entry DROP CONSTRAINT IF EXISTS waitlist_entry_organization_id_organization_id_fk;
ALTER TABLE waitlist_entry ADD CONSTRAINT waitlist_entry_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE waitlist_entry DROP CONSTRAINT IF EXISTS waitlist_entry_location_id_location_id_fk;
ALTER TABLE waitlist_entry ADD CONSTRAINT waitlist_entry_location_id_fk
    FOREIGN KEY (location_id) REFERENCES location(id) ON DELETE SET NULL;

-- 6. Add missing CASCADE on customer_feedback.organization_id
ALTER TABLE customer_feedback DROP CONSTRAINT IF EXISTS customer_feedback_organization_id_organization_id_fk;
ALTER TABLE customer_feedback ADD CONSTRAINT customer_feedback_organization_id_fk
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

-- 7. Add index on customer.email for lookup performance
CREATE INDEX IF NOT EXISTS idx_customer_email ON customer(email);

-- 8. Add index on loyalty_transaction.order_id
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_order ON loyalty_transaction(order_id);
