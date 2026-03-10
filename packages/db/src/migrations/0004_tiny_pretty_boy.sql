CREATE TABLE "pin_login_rate_limit" (
	"ip_address" text PRIMARY KEY NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funding_source_org_name" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"period" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"credit_note_number" text NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid,
	"customer_name" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"amount_applied" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_counter" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"performed_by" text NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "invoice_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"reference_number" text,
	"cheque_number" text,
	"cheque_deposit_date" timestamp with time zone,
	"credit_note_id" uuid,
	"date_paid" timestamp with time zone NOT NULL,
	"notes" text,
	"is_reversal" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_type" text NOT NULL,
	"frequency" text NOT NULL,
	"next_run_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"template_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"customer_id" uuid,
	"supplier_id" uuid,
	"last_generated_at" timestamp with time zone,
	"total_generated" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"bill_number" text NOT NULL,
	"supplier_id" uuid,
	"supplier_name" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"due_date" timestamp with time zone,
	"issued_date" timestamp with time zone,
	"date_paid" timestamp with time zone,
	"payment_method" text,
	"payment_reference" text,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_bill_counter" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_bill_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_bill_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"reference_number" text,
	"date_paid" timestamp with time zone NOT NULL,
	"notes" text,
	"is_reversal" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "funding_source_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "agency_name" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "contact_person_name" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "contact_person_position" text;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "agency_name" text;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "contact_person_name" text;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "contact_person_position" text;--> statement-breakpoint
ALTER TABLE "funding_source" ADD CONSTRAINT "funding_source_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_counter" ADD CONSTRAINT "credit_note_counter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_event" ADD CONSTRAINT "finance_audit_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_event" ADD CONSTRAINT "finance_audit_event_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_credit_note_id_credit_note_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_note"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD CONSTRAINT "recurring_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD CONSTRAINT "recurring_template_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD CONSTRAINT "recurring_template_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD CONSTRAINT "recurring_template_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_counter" ADD CONSTRAINT "vendor_bill_counter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_payment" ADD CONSTRAINT "vendor_bill_payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_payment" ADD CONSTRAINT "vendor_bill_payment_vendor_bill_id_vendor_bill_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_payment" ADD CONSTRAINT "vendor_bill_payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pin_login_rate_limit_locked_until" ON "pin_login_rate_limit" USING btree ("locked_until");--> statement-breakpoint
CREATE INDEX "idx_pin_login_rate_limit_updated_at" ON "pin_login_rate_limit" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_funding_source_org" ON "funding_source" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_budget_org" ON "budget" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_budget_status" ON "budget" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_budget_period" ON "budget" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_credit_note_org" ON "credit_note" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_credit_note_invoice" ON "credit_note" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_credit_note_customer" ON "credit_note" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_credit_note_status" ON "credit_note" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_credit_note_number" ON "credit_note" USING btree ("credit_note_number");--> statement-breakpoint
CREATE INDEX "idx_finance_audit_org_entity" ON "finance_audit_event" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_finance_audit_performed_at" ON "finance_audit_event" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_payment_invoice" ON "invoice_payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payment_org" ON "invoice_payment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payment_date" ON "invoice_payment" USING btree ("date_paid");--> statement-breakpoint
CREATE INDEX "idx_recurring_template_org" ON "recurring_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_template_next_run" ON "recurring_template" USING btree ("next_run_date");--> statement-breakpoint
CREATE INDEX "idx_recurring_template_active" ON "recurring_template" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_org" ON "vendor_bill" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_supplier" ON "vendor_bill" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_status" ON "vendor_bill" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_number" ON "vendor_bill" USING btree ("bill_number");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_due" ON "vendor_bill" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_payment_bill" ON "vendor_bill_payment" USING btree ("vendor_bill_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_payment_org" ON "vendor_bill_payment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_bill_payment_date" ON "vendor_bill_payment" USING btree ("date_paid");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_funding_source_id_funding_source_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."funding_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_session_open_register" ON "cash_session" USING btree ("register_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "idx_expense_funding_source" ON "expense" USING btree ("funding_source_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_pin_hash_unique" UNIQUE("pin_hash");