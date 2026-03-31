CREATE TABLE "agency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"supervisor_name" text,
	"supervisor_position" text,
	"phone" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_pricelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"pricelist_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricelist_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricelist_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"rating" integer NOT NULL,
	"food_rating" integer,
	"service_rating" integer,
	"ambience_rating" integer,
	"comment" text,
	"customer_name" text,
	"customer_email" text,
	"source" text DEFAULT 'pos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_payment" (
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
--> statement-breakpoint
CREATE TABLE "customer_payment_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_payment_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_payment_id" uuid NOT NULL,
	"action" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lifecycle_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_template_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"generated_type" text NOT NULL,
	"generated_id" uuid,
	"status" text DEFAULT 'success' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"background_image" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"connection_type" text DEFAULT 'network' NOT NULL,
	"address" text,
	"paper_width" text DEFAULT '80mm' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"auto_cut" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printer_route" (
	"printer_id" uuid NOT NULL,
	"reporting_category_id" uuid NOT NULL,
	CONSTRAINT "printer_route_printer_id_reporting_category_id_pk" PRIMARY KEY("printer_id","reporting_category_id")
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"customer_email" text,
	"date" date NOT NULL,
	"time" time NOT NULL,
	"party_size" integer DEFAULT 2 NOT NULL,
	"table_id" uuid,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"user_id" text NOT NULL,
	"day_of_week" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"party_size" integer DEFAULT 1 NOT NULL,
	"estimated_wait_minutes" integer,
	"status" text DEFAULT 'waiting' NOT NULL,
	"notes" text,
	"notified_at" timestamp with time zone,
	"seated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "tax_rate" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "tax_rate" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "tax_rate" ALTER COLUMN "rate" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "tax_rate" ALTER COLUMN "rate" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "billable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "invoiced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "invoice_line_id" text;--> statement-breakpoint
ALTER TABLE "kitchen_order_item" ADD COLUMN "fired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kitchen_order_item" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kitchen_order_ticket" ADD COLUMN "station" text;--> statement-breakpoint
ALTER TABLE "table_layout" ADD COLUMN "floor_id" uuid;--> statement-breakpoint
ALTER TABLE "table_layout" ADD COLUMN "width" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "table_layout" ADD COLUMN "height" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tip_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tab_name" text;--> statement-breakpoint
ALTER TABLE "order_line_item" ADD COLUMN "course_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "tip_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "reporting_category" ADD COLUMN "pin_protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_note" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "scheduled_send_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "brand" text DEFAULT 'foods_inc' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "last_emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "last_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "scheduled_send_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "brand" text DEFAULT 'foods_inc' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD COLUMN "remaining_cycles" integer;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD COLUMN "price_automation_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_template" ADD COLUMN "price_automation_value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "agency" ADD CONSTRAINT "agency_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_pricelist" ADD CONSTRAINT "customer_pricelist_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_pricelist" ADD CONSTRAINT "customer_pricelist_pricelist_id_pricelist_id_fk" FOREIGN KEY ("pricelist_id") REFERENCES "public"."pricelist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricelist" ADD CONSTRAINT "pricelist_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricelist_item" ADD CONSTRAINT "pricelist_item_pricelist_id_pricelist_id_fk" FOREIGN KEY ("pricelist_id") REFERENCES "public"."pricelist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricelist_item" ADD CONSTRAINT "pricelist_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_customer_payment_id_customer_payment_id_fk" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "customer_payment_allocation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_customer_payment_id_customer_payment_id_fk" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lifecycle_event" ADD CONSTRAINT "invoice_lifecycle_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lifecycle_event" ADD CONSTRAINT "invoice_lifecycle_event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template_run" ADD CONSTRAINT "recurring_template_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template_run" ADD CONSTRAINT "recurring_template_run_template_id_recurring_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template_run" ADD CONSTRAINT "recurring_template_run_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floor" ADD CONSTRAINT "floor_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer" ADD CONSTRAINT "printer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer" ADD CONSTRAINT "printer_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_route" ADD CONSTRAINT "printer_route_printer_id_printer_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_route" ADD CONSTRAINT "printer_route_reporting_category_id_reporting_category_id_fk" FOREIGN KEY ("reporting_category_id") REFERENCES "public"."reporting_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_table_id_table_layout_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."table_layout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agency_org" ON "agency" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_agency_name" ON "agency" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_customer_pricelist_cust" ON "customer_pricelist" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_pricelist_uniq" ON "customer_pricelist" USING btree ("customer_id","pricelist_id");--> statement-breakpoint
CREATE INDEX "idx_pricelist_org" ON "pricelist" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_pricelist_item_list" ON "pricelist_item" USING btree ("pricelist_id");--> statement-breakpoint
CREATE INDEX "idx_pricelist_item_product" ON "pricelist_item" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pricelist_item_uniq" ON "pricelist_item" USING btree ("pricelist_id","product_id");--> statement-breakpoint
CREATE INDEX "feedback_org_idx" ON "customer_feedback" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "feedback_order_idx" ON "customer_feedback" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "feedback_rating_idx" ON "customer_feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_customer_payment_org_customer" ON "customer_payment" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_payment_status" ON "customer_payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_payment" ON "customer_payment_allocation" USING btree ("customer_payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_invoice" ON "customer_payment_allocation" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_customer_payment_ledger_payment" ON "customer_payment_ledger" USING btree ("customer_payment_id");--> statement-breakpoint
CREATE INDEX "idx_customer_payment_ledger_created" ON "customer_payment_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_lifecycle_entity" ON "invoice_lifecycle_event" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_run_template" ON "recurring_template_run" USING btree ("template_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_recurring_run_org" ON "recurring_template_run" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_floor_location" ON "floor" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_floor_active" ON "floor" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_printer_org" ON "printer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_printer_location" ON "printer" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_date" ON "reservation" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_reservation_location" ON "reservation" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_status" ON "reservation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shift_org_idx" ON "shift" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shift_user_idx" ON "shift" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "waitlist_org_idx" ON "waitlist_entry" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist_entry" USING btree ("status");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_layout" ADD CONSTRAINT "table_layout_floor_id_floor_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expense_billable_uninvoiced" ON "expense" USING btree ("organization_id","billable","invoiced_at");--> statement-breakpoint
CREATE INDEX "idx_customer_email" ON "customer" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_loyalty_txn_order" ON "loyalty_transaction" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_kot_station" ON "kitchen_order_ticket" USING btree ("station");--> statement-breakpoint
CREATE INDEX "idx_table_layout_floor" ON "table_layout" USING btree ("floor_id");