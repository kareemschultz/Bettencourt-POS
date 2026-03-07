CREATE TABLE "product_production_component" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"component_name" text NOT NULL,
	"quantity" numeric(10, 4) DEFAULT '1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"invoice_number" text NOT NULL,
	"customer_id" uuid,
	"customer_name" text NOT NULL,
	"customer_address" text,
	"customer_phone" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cheque_number" text,
	"receipt_number" text,
	"date_paid" timestamp with time zone,
	"due_date" timestamp with time zone,
	"cheque_deposit_date" timestamp with time zone,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_counter" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"quotation_number" text NOT NULL,
	"customer_id" uuid,
	"customer_name" text NOT NULL,
	"customer_address" text,
	"customer_phone" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"valid_until" timestamp with time zone,
	"converted_invoice_id" uuid,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_counter" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_product_barcode_barcode";--> statement-breakpoint
ALTER TABLE "product_barcode" ALTER COLUMN "barcode" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "protein_category_id" uuid;--> statement-breakpoint
ALTER TABLE "product_barcode" ADD COLUMN "format" varchar(20) DEFAULT 'code128' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_barcode" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "sales_rep" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "items_supplied" text;--> statement-breakpoint
ALTER TABLE "production_log" ADD COLUMN "workflow" text;--> statement-breakpoint
ALTER TABLE "product_production_component" ADD CONSTRAINT "product_production_component_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_counter" ADD CONSTRAINT "invoice_counter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_converted_invoice_id_invoice_id_fk" FOREIGN KEY ("converted_invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_counter" ADD CONSTRAINT "quotation_counter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prod_component_product" ON "product_production_component" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_org" ON "invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_customer" ON "invoice" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_status" ON "invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoice_number" ON "invoice" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "idx_invoice_created" ON "invoice" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_quotation_org" ON "quotation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_quotation_customer" ON "quotation" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_quotation_status" ON "quotation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotation_number" ON "quotation" USING btree ("quotation_number");--> statement-breakpoint
CREATE INDEX "idx_quotation_created" ON "quotation" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_protein_category_id_reporting_category_id_fk" FOREIGN KEY ("protein_category_id") REFERENCES "public"."reporting_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expense_supplier" ON "expense" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_product_protein_category" ON "product" USING btree ("protein_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_barcode_barcode_unique" ON "product_barcode" USING btree ("barcode");