CREATE TABLE "expense_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_expense_category_org" ON "expense_category" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_org_name" ON "expense_category" USING btree ("organization_id","name");
--> statement-breakpoint
-- Seed default categories for the main organization
INSERT INTO "expense_category" ("name", "organization_id") VALUES
	('Food & Beverage Supplies', 'a0000000-0000-4000-8000-000000000001'),
	('Cleaning Supplies', 'a0000000-0000-4000-8000-000000000001'),
	('Office Supplies', 'a0000000-0000-4000-8000-000000000001'),
	('Repairs & Maintenance', 'a0000000-0000-4000-8000-000000000001'),
	('Delivery & Transport', 'a0000000-0000-4000-8000-000000000001'),
	('Utilities', 'a0000000-0000-4000-8000-000000000001'),
	('Marketing & Advertising', 'a0000000-0000-4000-8000-000000000001'),
	('Staff Meals', 'a0000000-0000-4000-8000-000000000001'),
	('Miscellaneous', 'a0000000-0000-4000-8000-000000000001'),
	('Vehicle Maintenance', 'a0000000-0000-4000-8000-000000000001'),
	('CEO Drawings', 'a0000000-0000-4000-8000-000000000001'),
	('GM Drawings', 'a0000000-0000-4000-8000-000000000001'),
	('Owner Drawings', 'a0000000-0000-4000-8000-000000000001'),
	('COO Drawings', 'a0000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;
