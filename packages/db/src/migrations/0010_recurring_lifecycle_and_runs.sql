ALTER TABLE "recurring_template" ADD COLUMN IF NOT EXISTS "start_date" timestamp with time zone;
ALTER TABLE "recurring_template" ADD COLUMN IF NOT EXISTS "remaining_cycles" integer;
ALTER TABLE "recurring_template" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
ALTER TABLE "recurring_template" ADD COLUMN IF NOT EXISTS "price_automation_mode" text DEFAULT 'none' NOT NULL;
ALTER TABLE "recurring_template" ADD COLUMN IF NOT EXISTS "price_automation_value" numeric(12, 2) DEFAULT '0' NOT NULL;

CREATE TABLE IF NOT EXISTS "recurring_template_run" (
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

DO $$ BEGIN
 ALTER TABLE "recurring_template_run" ADD CONSTRAINT "recurring_template_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "recurring_template_run" ADD CONSTRAINT "recurring_template_run_template_id_recurring_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_template"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "recurring_template_run" ADD CONSTRAINT "recurring_template_run_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_recurring_run_template" ON "recurring_template_run" USING btree ("template_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_recurring_run_org" ON "recurring_template_run" USING btree ("organization_id","created_at");
