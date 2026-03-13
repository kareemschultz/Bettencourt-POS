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
ALTER TABLE "order" ADD COLUMN "tip_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tab_name" text;
--> statement-breakpoint
ALTER TABLE "order_line_item" ADD COLUMN "course_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "tip_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "kitchen_order_item" ADD COLUMN "fired_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "kitchen_order_item" ADD COLUMN "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "kitchen_order_ticket" ADD COLUMN "station" text;
--> statement-breakpoint
ALTER TABLE "table_layout" ADD COLUMN "floor_id" uuid;
--> statement-breakpoint
ALTER TABLE "table_layout" ADD COLUMN "width" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE "table_layout" ADD COLUMN "height" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE "floor" ADD CONSTRAINT "floor_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "printer" ADD CONSTRAINT "printer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "printer" ADD CONSTRAINT "printer_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "printer_route" ADD CONSTRAINT "printer_route_printer_id_printer_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "printer_route" ADD CONSTRAINT "printer_route_reporting_category_id_reporting_category_id_fk" FOREIGN KEY ("reporting_category_id") REFERENCES "public"."reporting_category"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "table_layout" ADD CONSTRAINT "table_layout_floor_id_floor_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floor"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_floor_location" ON "floor" USING btree ("location_id");
--> statement-breakpoint
CREATE INDEX "idx_floor_active" ON "floor" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "idx_printer_org" ON "printer" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_printer_location" ON "printer" USING btree ("location_id");
--> statement-breakpoint
CREATE INDEX "idx_kot_station" ON "kitchen_order_ticket" USING btree ("station");
--> statement-breakpoint
CREATE INDEX "idx_table_layout_floor" ON "table_layout" USING btree ("floor_id");
