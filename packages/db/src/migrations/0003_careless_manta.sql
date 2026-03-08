CREATE TABLE "expense_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "expense_category_org_name" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "invoice_document_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"default_tax_rate" numeric(5, 2) DEFAULT '16.5' NOT NULL,
	"default_tax_mode" text DEFAULT 'invoice' NOT NULL,
	"default_payment_terms" text DEFAULT 'due_on_receipt' NOT NULL,
	"default_discount_type" text DEFAULT 'percent' NOT NULL,
	"company_tin" text,
	"bank_name" text,
	"bank_account" text,
	"bank_branch" text,
	"payment_instructions" text,
	"default_quotation_terms" text,
	"invoice_footer_note" text,
	"quotation_footer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_document_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "production_log" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "reference_number" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "order_line_item" ADD COLUMN "is_component" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "issued_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "discount_type" text DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "discount_value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "tax_mode" text DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "tax_rate" numeric(5, 2) DEFAULT '16.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "payment_terms" text DEFAULT 'due_on_receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "prepared_by" text;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "discount_type" text DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "discount_value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "tax_mode" text DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "tax_rate" numeric(5, 2) DEFAULT '16.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "terms_and_conditions" text;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "parent_quotation_id" uuid;--> statement-breakpoint
ALTER TABLE "quotation" ADD COLUMN "prepared_by" text;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_document_settings" ADD CONSTRAINT "invoice_document_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expense_category_org" ON "expense_category" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_parent_quotation_id_quotation_id_fk" FOREIGN KEY ("parent_quotation_id") REFERENCES "public"."quotation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expense_org_created" ON "expense" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_order_customer" ON "order" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_order_org_created" ON "order" USING btree ("organization_id","created_at");