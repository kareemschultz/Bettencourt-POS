ALTER TABLE "expense" ADD COLUMN IF NOT EXISTS "billable" boolean DEFAULT false NOT NULL;
ALTER TABLE "expense" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
ALTER TABLE "expense" ADD COLUMN IF NOT EXISTS "invoiced_at" timestamp with time zone;
ALTER TABLE "expense" ADD COLUMN IF NOT EXISTS "invoice_id" uuid;
ALTER TABLE "expense" ADD COLUMN IF NOT EXISTS "invoice_line_id" text;

ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "scheduled_send_at" timestamp with time zone;
ALTER TABLE "quotation" ADD COLUMN IF NOT EXISTS "scheduled_send_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "customer_payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "total_amount" numeric(12, 2) NOT NULL,
  "unapplied_amount" numeric(12, 2) NOT NULL,
  "payment_method" text NOT NULL,
  "reference_number" text,
  "date_paid" timestamp with time zone NOT NULL,
  "notes" text,
  "status" text DEFAULT 'open' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_payment_allocation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "customer_payment_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_payment_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "customer_payment_id" uuid NOT NULL,
  "action" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoice_lifecycle_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "expense" ADD CONSTRAINT "expense_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "expense" ADD CONSTRAINT "expense_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_customer_payment_id_customer_payment_id_fk" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_customer_payment_id_customer_payment_id_fk" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invoice_lifecycle_event" ADD CONSTRAINT "invoice_lifecycle_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "invoice_lifecycle_event" ADD CONSTRAINT "invoice_lifecycle_event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_expense_billable_uninvoiced" ON "expense" USING btree ("organization_id", "billable", "invoiced_at");
CREATE INDEX IF NOT EXISTS "idx_customer_payment_org_customer" ON "customer_payment" USING btree ("organization_id", "customer_id");
CREATE INDEX IF NOT EXISTS "idx_customer_payment_status" ON "customer_payment" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_payment_alloc_payment" ON "customer_payment_allocation" USING btree ("customer_payment_id");
CREATE INDEX IF NOT EXISTS "idx_payment_alloc_invoice" ON "customer_payment_allocation" USING btree ("invoice_id");
CREATE INDEX IF NOT EXISTS "idx_customer_payment_ledger_payment" ON "customer_payment_ledger" USING btree ("customer_payment_id");
CREATE INDEX IF NOT EXISTS "idx_customer_payment_ledger_created" ON "customer_payment_ledger" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_invoice_lifecycle_entity" ON "invoice_lifecycle_event" USING btree ("organization_id", "entity_type", "entity_id");
