-- Pricelist table
CREATE TABLE IF NOT EXISTS "pricelist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_pricelist_org" ON "pricelist" ("organization_id");

-- Pricelist item (per-product price overrides)
CREATE TABLE IF NOT EXISTS "pricelist_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pricelist_id" uuid NOT NULL REFERENCES "pricelist"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "product"("id") ON DELETE CASCADE,
  "price" numeric(10, 2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_pricelist_item_unique" ON "pricelist_item" ("pricelist_id", "product_id");
CREATE INDEX IF NOT EXISTS "idx_pricelist_item_product" ON "pricelist_item" ("product_id");

-- Add pricelist_id to customer
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "pricelist_id" uuid REFERENCES "pricelist"("id") ON DELETE SET NULL;
