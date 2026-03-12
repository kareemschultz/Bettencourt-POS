ALTER TABLE "reporting_category" ADD COLUMN IF NOT EXISTS "pin_protected" boolean DEFAULT false NOT NULL;
