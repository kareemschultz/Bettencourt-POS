-- F-011: Enforce unique order number per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_number_org ON "order"(order_number, organization_id);

-- F-012: Add CHECK constraints for status/method columns
ALTER TABLE "order" ADD CONSTRAINT IF NOT EXISTS order_status_check
  CHECK (status IN ('open', 'completed', 'voided', 'refunded', 'pending'));

ALTER TABLE payment ADD CONSTRAINT IF NOT EXISTS payment_method_check
  CHECK (method IN ('cash', 'card', 'mobile_money', 'gift_card', 'credit', 'refund', 'pending'));

ALTER TABLE payment ADD CONSTRAINT IF NOT EXISTS payment_status_check
  CHECK (status IN ('pending', 'completed'));
