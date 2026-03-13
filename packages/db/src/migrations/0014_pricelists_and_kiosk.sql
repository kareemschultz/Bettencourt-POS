-- Migration 0014: Customer pricelists (GAP-018) + schema additions for shift/waitlist/reservation/feedback
-- Reservation system
CREATE TABLE IF NOT EXISTS reservation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  location_id UUID REFERENCES location(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  party_size INTEGER NOT NULL DEFAULT 1,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  table_id UUID REFERENCES "table"(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservation_org ON reservation(organization_id);
CREATE INDEX IF NOT EXISTS idx_reservation_date ON reservation(reservation_date);

-- Shift scheduling
CREATE TABLE IF NOT EXISTS shift (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_org ON shift(organization_id);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  location_id UUID REFERENCES location(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  party_size INTEGER NOT NULL DEFAULT 1,
  estimated_wait INTEGER, -- minutes
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'seated', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_waitlist_org ON waitlist_entry(organization_id);

-- Customer feedback
CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  order_id UUID REFERENCES "order"(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_org ON customer_feedback(organization_id);

-- Pricelists (GAP-018)
CREATE TABLE IF NOT EXISTS pricelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pricelist_org ON pricelist(organization_id);

CREATE TABLE IF NOT EXISTS pricelist_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricelist_id UUID NOT NULL REFERENCES pricelist(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  UNIQUE (pricelist_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_pricelist_item_list ON pricelist_item(pricelist_id);
CREATE INDEX IF NOT EXISTS idx_pricelist_item_product ON pricelist_item(product_id);

CREATE TABLE IF NOT EXISTS customer_pricelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  pricelist_id UUID NOT NULL REFERENCES pricelist(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, pricelist_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_pricelist_cust ON customer_pricelist(customer_id);
