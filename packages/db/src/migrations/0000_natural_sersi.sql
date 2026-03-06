CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"user_name_snapshot" text,
	"role_snapshot" text,
	"location_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"action_type" text NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"diff_data" jsonb,
	"reason" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" uuid,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"two_factor_enabled" boolean DEFAULT false,
	"pin_hash" text,
	"hourly_rate" numeric(10, 2),
	"organization_id" uuid,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_drop" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"user_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_reconciliation_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"max_variance_amount" numeric(10, 2) DEFAULT '500' NOT NULL,
	"require_photo_evidence" boolean DEFAULT false NOT NULL,
	"notify_managers" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cash_reconciliation_rule_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "cash_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"register_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"opened_by" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_float" numeric(10, 2) DEFAULT '0' NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"closing_count" numeric(10, 2),
	"expected_cash" numeric(10, 2),
	"variance" numeric(10, 2),
	"variance_approved_by" text,
	"variance_reason" text,
	"variance_approved_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cash_session_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"receipt_photo_url" text,
	"authorized_by" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "no_sale_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_handoff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"counted_amount" numeric(10, 2) NOT NULL,
	"expected_amount" numeric(10, 2) NOT NULL,
	"variance" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_loyalty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"current_points" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"apply_to" text DEFAULT 'order' NOT NULL,
	"target_category_id" uuid,
	"target_product_id" uuid,
	"min_order_total" numeric(10, 2),
	"min_quantity" integer,
	"buy_quantity" integer,
	"get_quantity" integer,
	"is_auto_apply" boolean DEFAULT false NOT NULL,
	"schedule_type" text DEFAULT 'always' NOT NULL,
	"start_time" text,
	"end_time" text,
	"start_date" text,
	"end_date" text,
	"days_of_week" text,
	"promo_code" text,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stackable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"initial_balance" numeric(10, 2) NOT NULL,
	"current_balance" numeric(10, 2) NOT NULL,
	"customer_id" uuid,
	"purchased_by" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_card_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "gift_card_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_card_id" uuid NOT NULL,
	"order_id" uuid,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"processed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text DEFAULT 'Bettencourt''s Rewards' NOT NULL,
	"points_per_dollar" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_program_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"points_required" integer NOT NULL,
	"reward_type" text NOT NULL,
	"reward_value" numeric(10, 2) NOT NULL,
	"reward_product_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_loyalty_id" uuid NOT NULL,
	"order_id" uuid,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"receipt_header" text,
	"receipt_footer" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "receipt_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_name" text DEFAULT 'Bettencourt''s Food Inc.' NOT NULL,
	"tagline" text DEFAULT '''A True Guyanese Gem''',
	"address_line_1" text,
	"address_line_2" text,
	"phone" text,
	"footer_message" text DEFAULT 'Thank you for choosing Bettencourt''s!',
	"promo_message" text,
	"show_logo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_config_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hardware_config" jsonb DEFAULT '{}'::jsonb,
	"workflow_mode" text DEFAULT 'standard',
	"receipt_header_override" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"location_id" uuid,
	"clock_in" timestamp with time zone DEFAULT now() NOT NULL,
	"clock_out" timestamp with time zone,
	"break_minutes" text DEFAULT '0' NOT NULL,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"edited_by" text,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_component" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"combo_product_id" uuid NOT NULL,
	"component_name" text NOT NULL,
	"department_id" uuid,
	"allocated_price" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "combo_product_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "menu_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"days_of_week" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_schedule_product" (
	"menu_schedule_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"override_price" numeric(10, 2),
	CONSTRAINT "menu_schedule_product_menu_schedule_id_product_id_pk" PRIMARY KEY("menu_schedule_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "modifier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reporting_name" text,
	"reporting_category_id" uuid,
	"sku" text,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cost" numeric(10, 2) DEFAULT '0',
	"tax_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_barcode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"barcode" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_location" (
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_location_product_id_location_id_pk" PRIMARY KEY("product_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "product_modifier_group" (
	"product_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	CONSTRAINT "product_modifier_group_product_id_modifier_group_id_pk" PRIMARY KEY("product_id","modifier_group_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(10, 4) NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "register_department" (
	"register_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	CONSTRAINT "register_department_register_id_department_id_pk" PRIMARY KEY("register_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "reporting_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_order_counter" (
	"location_id" uuid NOT NULL,
	"counter_date" date DEFAULT CURRENT_DATE NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_order_counter_location_id_counter_date_pk" PRIMARY KEY("location_id","counter_date")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"register_id" uuid,
	"user_id" text,
	"order_number" text NOT NULL,
	"type" text DEFAULT 'sale' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"customer_id" uuid,
	"customer_name" text,
	"customer_phone" text,
	"delivery_address" text,
	"fulfillment_status" text DEFAULT 'none',
	"estimated_ready_at" timestamp with time zone,
	"table_id" uuid,
	"notes" text,
	"void_authorized_by" text,
	"void_reason" text,
	"void_authorized_at" timestamp with time zone,
	"is_split" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_line_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name_snapshot" text NOT NULL,
	"reporting_name_snapshot" text,
	"reporting_category_snapshot" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"modifiers_snapshot" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"voided" boolean DEFAULT false NOT NULL,
	"void_reason" text
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"tendered" numeric(10, 2),
	"change_given" numeric(10, 2) DEFAULT '0',
	"currency" text DEFAULT 'GYD' NOT NULL,
	"exchange_rate" numeric(10, 4),
	"reference" text,
	"split_group" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"original_order_id" uuid,
	"user_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"received_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_received" numeric(10, 2) NOT NULL,
	"lot_number" text,
	"expiry_date" date
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"unit_of_measure" text DEFAULT 'each' NOT NULL,
	"unit_conversion_factor" numeric(10, 4) DEFAULT '1',
	"preferred_supplier_id" uuid,
	"reorder_point" numeric(10, 2) DEFAULT '0',
	"min_level" numeric(10, 2) DEFAULT '0',
	"max_level" numeric(10, 2) DEFAULT '0',
	"bin_location" text,
	"lot_tracking" boolean DEFAULT false NOT NULL,
	"expiry_tracking" boolean DEFAULT false NOT NULL,
	"serial_tracking" boolean DEFAULT false NOT NULL,
	"avg_cost" numeric(10, 4) DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_item_barcode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"barcode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity_on_hand" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_count_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "purchase_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"approved_by" text,
	"notes" text,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity_ordered" numeric(10, 2) NOT NULL,
	"quantity_received" numeric(10, 2) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(10, 4) NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"type" text NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_count" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"type" text DEFAULT 'cycle' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"finalized_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock_count_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"system_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"counted_quantity" numeric(10, 2),
	"variance" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "stock_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"quantity_change" numeric(10, 2) NOT NULL,
	"before_quantity" numeric(10, 2) NOT NULL,
	"after_quantity" numeric(10, 2) NOT NULL,
	"user_id" text,
	"reference_type" text,
	"reference_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"approved_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"received_quantity" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"product_name" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"estimated_cost" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"logged_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"order_line_item_id" uuid,
	"product_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"modifiers" text,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_order_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"printer_target" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_layout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"section" text,
	"seats" integer DEFAULT 4 NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"shape" text DEFAULT 'square' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"current_order_id" uuid,
	"current_guests" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	"location_id" uuid,
	CONSTRAINT "user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "production_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"location_id" uuid,
	"logged_by_user_id" text,
	"entry_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text,
	"log_date" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drop" ADD CONSTRAINT "cash_drop_cash_session_id_cash_session_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drop" ADD CONSTRAINT "cash_drop_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payout" ADD CONSTRAINT "cash_payout_cash_session_id_cash_session_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payout" ADD CONSTRAINT "cash_payout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_reconciliation_rule" ADD CONSTRAINT "cash_reconciliation_rule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_register_id_register_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."register"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_opened_by_user_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_variance_approved_by_user_id_fk" FOREIGN KEY ("variance_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_cash_session_id_cash_session_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_authorized_by_user_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_sale_event" ADD CONSTRAINT "no_sale_event_cash_session_id_cash_session_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_sale_event" ADD CONSTRAINT "no_sale_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handoff" ADD CONSTRAINT "shift_handoff_cash_session_id_cash_session_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handoff" ADD CONSTRAINT "shift_handoff_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handoff" ADD CONSTRAINT "shift_handoff_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_loyalty" ADD CONSTRAINT "customer_loyalty_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_loyalty" ADD CONSTRAINT "customer_loyalty_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_rule" ADD CONSTRAINT "discount_rule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_gift_card_id_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_program" ADD CONSTRAINT "loyalty_program_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_tier" ADD CONSTRAINT "loyalty_tier_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_tier" ADD CONSTRAINT "loyalty_tier_reward_product_id_product_id_fk" FOREIGN KEY ("reward_product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transaction" ADD CONSTRAINT "loyalty_transaction_customer_loyalty_id_customer_loyalty_id_fk" FOREIGN KEY ("customer_loyalty_id") REFERENCES "public"."customer_loyalty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_config" ADD CONSTRAINT "receipt_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register" ADD CONSTRAINT "register_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_component" ADD CONSTRAINT "combo_component_combo_product_id_combo_product_id_fk" FOREIGN KEY ("combo_product_id") REFERENCES "public"."combo_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_component" ADD CONSTRAINT "combo_component_department_id_reporting_category_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."reporting_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_product" ADD CONSTRAINT "combo_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_schedule" ADD CONSTRAINT "menu_schedule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_schedule_product" ADD CONSTRAINT "menu_schedule_product_menu_schedule_id_menu_schedule_id_fk" FOREIGN KEY ("menu_schedule_id") REFERENCES "public"."menu_schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_schedule_product" ADD CONSTRAINT "menu_schedule_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier" ADD CONSTRAINT "modifier_modifier_group_id_modifier_group_id_fk" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_group" ADD CONSTRAINT "modifier_group_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_reporting_category_id_reporting_category_id_fk" FOREIGN KEY ("reporting_category_id") REFERENCES "public"."reporting_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_location" ADD CONSTRAINT "product_location_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_location" ADD CONSTRAINT "product_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_group" ADD CONSTRAINT "product_modifier_group_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_group" ADD CONSTRAINT "product_modifier_group_modifier_group_id_modifier_group_id_fk" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_department" ADD CONSTRAINT "register_department_register_id_register_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."register"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_department" ADD CONSTRAINT "register_department_department_id_reporting_category_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."reporting_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_category" ADD CONSTRAINT "reporting_category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_order_counter" ADD CONSTRAINT "daily_order_counter_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_register_id_register_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."register"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_void_authorized_by_user_id_fk" FOREIGN KEY ("void_authorized_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_item" ADD CONSTRAINT "order_line_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_item" ADD CONSTRAINT "order_line_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_original_order_id_order_id_fk" FOREIGN KEY ("original_order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_received_by_user_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_goods_receipt_id_goods_receipt_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_purchase_order_line_id_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_preferred_supplier_id_supplier_id_fk" FOREIGN KEY ("preferred_supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item_barcode" ADD CONSTRAINT "inventory_item_barcode_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_acknowledged_by_user_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_finalized_by_user_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_stock_count_id_stock_count_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_count"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_from_location_id_location_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_to_location_id_location_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_transfer_id_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_log" ADD CONSTRAINT "waste_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_log" ADD CONSTRAINT "waste_log_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_log" ADD CONSTRAINT "waste_log_logged_by_user_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_order_item" ADD CONSTRAINT "kitchen_order_item_ticket_id_kitchen_order_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."kitchen_order_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_order_item" ADD CONSTRAINT "kitchen_order_item_order_line_item_id_order_line_item_id_fk" FOREIGN KEY ("order_line_item_id") REFERENCES "public"."order_line_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_order_ticket" ADD CONSTRAINT "kitchen_order_ticket_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_order_ticket" ADD CONSTRAINT "kitchen_order_ticket_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_layout" ADD CONSTRAINT "table_layout_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_layout" ADD CONSTRAINT "table_layout_current_order_id_order_id_fk" FOREIGN KEY ("current_order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_role" ADD CONSTRAINT "custom_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_custom_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."custom_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_log" ADD CONSTRAINT "production_log_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_log" ADD CONSTRAINT "production_log_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_log" ADD CONSTRAINT "production_log_logged_by_user_id_user_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_user" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_type" ON "audit_log" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_id" ON "audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action_type" ON "audit_log" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_audit_log_location" ON "audit_log" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_cash_drop_session" ON "cash_drop" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "idx_cash_payout_session" ON "cash_payout" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "idx_cash_recon_rule_org" ON "cash_reconciliation_rule" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_cash_session_register" ON "cash_session" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "idx_cash_session_location" ON "cash_session" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_cash_session_status" ON "cash_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expense_session" ON "expense" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "idx_expense_org" ON "expense" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_created" ON "expense" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_no_sale_event_session" ON "no_sale_event" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "idx_no_sale_event_user" ON "no_sale_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shift_handoff_session" ON "shift_handoff" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "idx_shift_handoff_from" ON "shift_handoff" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "idx_shift_handoff_to" ON "shift_handoff" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "idx_customer_org" ON "customer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_customer_phone" ON "customer" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_org_phone" ON "customer" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_loyalty_unique" ON "customer_loyalty" USING btree ("customer_id","program_id");--> statement-breakpoint
CREATE INDEX "idx_discount_rule_org" ON "discount_rule" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_discount_rule_promo" ON "discount_rule" USING btree ("promo_code");--> statement-breakpoint
CREATE INDEX "idx_gift_card_org" ON "gift_card" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_gift_card_code" ON "gift_card" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_gift_card_txn_card" ON "gift_card_transaction" USING btree ("gift_card_id");--> statement-breakpoint
CREATE INDEX "idx_loyalty_tier_program" ON "loyalty_tier" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_loyalty_txn_customer" ON "loyalty_transaction" USING btree ("customer_loyalty_id");--> statement-breakpoint
CREATE INDEX "idx_location_org" ON "location" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_receipt_config_org" ON "receipt_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_register_location" ON "register" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_time_entry_user" ON "time_entry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_time_entry_org" ON "time_entry" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_combo_component_combo" ON "combo_component" USING btree ("combo_product_id");--> statement-breakpoint
CREATE INDEX "idx_combo_product_product" ON "combo_product" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_menu_schedule_org" ON "menu_schedule" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_modifier_group" ON "modifier" USING btree ("modifier_group_id");--> statement-breakpoint
CREATE INDEX "idx_modifier_group_org" ON "modifier_group" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_product_org" ON "product" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_product_category" ON "product" USING btree ("reporting_category_id");--> statement-breakpoint
CREATE INDEX "idx_product_sku" ON "product" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_product_barcode_product" ON "product_barcode" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_barcode_barcode" ON "product_barcode" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredient_product" ON "recipe_ingredient" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredient_item" ON "recipe_ingredient" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_reporting_category_org" ON "reporting_category" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_tax_rate_org" ON "tax_rate" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_order_org" ON "order" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_order_location" ON "order" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_order_register" ON "order" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "idx_order_user" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_order_status" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_order_created" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_order_line_item_order" ON "order_line_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_line_item_product" ON "order_line_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_payment_order" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_payment_method" ON "payment" USING btree ("method");--> statement-breakpoint
CREATE INDEX "idx_refund_order" ON "refund" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_refund_original_order" ON "refund" USING btree ("original_order_id");--> statement-breakpoint
CREATE INDEX "idx_goods_receipt_po" ON "goods_receipt" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_gr_line_receipt" ON "goods_receipt_line" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_org" ON "inventory_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_sku" ON "inventory_item" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_supplier" ON "inventory_item" USING btree ("preferred_supplier_id");--> statement-breakpoint
CREATE INDEX "idx_inv_barcode_item" ON "inventory_item_barcode" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inv_barcode_barcode" ON "inventory_item_barcode" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_inventory_stock_item_location" ON "inventory_stock" USING btree ("inventory_item_id","location_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_org" ON "purchase_order" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_supplier" ON "purchase_order" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_status" ON "purchase_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_po_line_po" ON "purchase_order_line" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_stock_alert_org" ON "stock_alert" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_stock_alert_item" ON "stock_alert" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_stock_count_org" ON "stock_count" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_stock_count_location" ON "stock_count" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_stock_count_line_count" ON "stock_count_line" USING btree ("stock_count_id");--> statement-breakpoint
CREATE INDEX "idx_stock_ledger_item" ON "stock_ledger" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_stock_ledger_location" ON "stock_ledger" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_stock_ledger_created" ON "stock_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_org" ON "supplier" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_org" ON "transfer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_from" ON "transfer" USING btree ("from_location_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_to" ON "transfer" USING btree ("to_location_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_line_transfer" ON "transfer_line" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "idx_waste_log_org" ON "waste_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_waste_log_item" ON "waste_log" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_waste_log_created" ON "waste_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_koi_ticket" ON "kitchen_order_item" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_koi_status" ON "kitchen_order_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kot_order" ON "kitchen_order_ticket" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_kot_location" ON "kitchen_order_ticket" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_kot_status" ON "kitchen_order_ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_table_layout_location" ON "table_layout" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_table_layout_status" ON "table_layout" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_custom_role_org" ON "custom_role" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_user" ON "user_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_role" ON "user_role" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_production_log_product" ON "production_log" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_production_log_location" ON "production_log" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_production_log_date" ON "production_log" USING btree ("log_date");--> statement-breakpoint
CREATE INDEX "idx_production_log_entry_type" ON "production_log" USING btree ("entry_type");