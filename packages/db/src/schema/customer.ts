import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { product } from "./product";

// ── Customer ──────────────────────────────────────────────────────────

export const customer = pgTable(
	"customer",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		phone: text("phone"),
		email: text("email"),
		notes: text("notes"),
		totalSpent: numeric("total_spent", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		visitCount: integer("visit_count").notNull().default(0),
		lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_customer_org").on(table.organizationId),
		index("idx_customer_phone").on(table.phone),
		index("idx_customer_email").on(table.email),
		uniqueIndex("idx_customer_org_phone").on(table.organizationId, table.phone),
	],
);

// ── Loyalty Program ───────────────────────────────────────────────────

export const loyaltyProgram = pgTable("loyalty_program", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.unique()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull().default("Bettencourt's Rewards"),
	pointsPerDollar: integer("points_per_dollar").notNull().default(1),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// ── Loyalty Tier ──────────────────────────────────────────────────────

export const loyaltyTier = pgTable(
	"loyalty_tier",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		programId: uuid("program_id")
			.notNull()
			.references(() => loyaltyProgram.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		pointsRequired: integer("points_required").notNull(),
		rewardType: text("reward_type").notNull(), // percentage_discount | fixed_discount | free_item
		rewardValue: numeric("reward_value", { precision: 10, scale: 2 }).notNull(),
		rewardProductId: uuid("reward_product_id").references(() => product.id, {
			onDelete: "set null",
		}),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("idx_loyalty_tier_program").on(table.programId)],
);

// ── Customer Loyalty ──────────────────────────────────────────────────

export const customerLoyalty = pgTable(
	"customer_loyalty",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => customer.id, { onDelete: "cascade" }),
		programId: uuid("program_id")
			.notNull()
			.references(() => loyaltyProgram.id, { onDelete: "cascade" }),
		currentPoints: integer("current_points").notNull().default(0),
		lifetimePoints: integer("lifetime_points").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_customer_loyalty_unique").on(
			table.customerId,
			table.programId,
		),
	],
);

// ── Loyalty Transaction ───────────────────────────────────────────────

export const loyaltyTransaction = pgTable(
	"loyalty_transaction",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		customerLoyaltyId: uuid("customer_loyalty_id")
			.notNull()
			.references(() => customerLoyalty.id, { onDelete: "cascade" }),
		orderId: uuid("order_id"),
		type: text("type").notNull(), // earn | redeem | adjust
		points: integer("points").notNull(),
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_loyalty_txn_customer").on(table.customerLoyaltyId),
		index("idx_loyalty_txn_order").on(table.orderId),
	],
);

// ── Gift Card ─────────────────────────────────────────────────────────

export const giftCard = pgTable(
	"gift_card",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		code: text("code").notNull().unique(),
		initialBalance: numeric("initial_balance", {
			precision: 10,
			scale: 2,
		}).notNull(),
		currentBalance: numeric("current_balance", {
			precision: 10,
			scale: 2,
		}).notNull(),
		customerId: uuid("customer_id").references(() => customer.id, {
			onDelete: "set null",
		}),
		purchasedBy: text("purchased_by"),
		isActive: boolean("is_active").notNull().default(true),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_gift_card_org").on(table.organizationId),
		index("idx_gift_card_code").on(table.code),
	],
);

// ── Gift Card Transaction ─────────────────────────────────────────────

export const giftCardTransaction = pgTable(
	"gift_card_transaction",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		giftCardId: uuid("gift_card_id")
			.notNull()
			.references(() => giftCard.id, { onDelete: "cascade" }),
		orderId: uuid("order_id"),
		type: text("type").notNull(), // purchase | reload | redeem | refund
		amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
		balanceAfter: numeric("balance_after", {
			precision: 10,
			scale: 2,
		}).notNull(),
		processedBy: text("processed_by"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("idx_gift_card_txn_card").on(table.giftCardId)],
);

// ── Discount Rule ─────────────────────────────────────────────────────

export const discountRule = pgTable(
	"discount_rule",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").notNull(), // percentage | fixed | bogo | buy_x_get_y
		value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
		applyTo: text("apply_to").notNull().default("order"), // order | item | category
		targetCategoryId: uuid("target_category_id"),
		targetProductId: uuid("target_product_id"),

		// Conditions
		minOrderTotal: numeric("min_order_total", { precision: 10, scale: 2 }),
		minQuantity: integer("min_quantity"),
		buyQuantity: integer("buy_quantity"),
		getQuantity: integer("get_quantity"),

		// Schedule
		isAutoApply: boolean("is_auto_apply").notNull().default(false),
		scheduleType: text("schedule_type").notNull().default("always"), // always | time_window | date_range
		startTime: text("start_time"), // HH:MM format
		endTime: text("end_time"),
		startDate: text("start_date"), // YYYY-MM-DD format
		endDate: text("end_date"),
		daysOfWeek: text("days_of_week"), // comma-separated: mon,tue,wed

		// Promo code
		promoCode: text("promo_code"),
		maxUses: integer("max_uses"),
		currentUses: integer("current_uses").notNull().default(0),

		isActive: boolean("is_active").notNull().default(true),
		stackable: boolean("stackable").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_discount_rule_org").on(table.organizationId),
		index("idx_discount_rule_promo").on(table.promoCode),
	],
);

// ── Relations ──────────────────────────────────────────────────────────

export const customerRelations = relations(customer, ({ one, many }) => ({
	organization: one(organization, {
		fields: [customer.organizationId],
		references: [organization.id],
	}),
	loyaltyMemberships: many(customerLoyalty),
	giftCards: many(giftCard),
}));

export const loyaltyProgramRelations = relations(
	loyaltyProgram,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [loyaltyProgram.organizationId],
			references: [organization.id],
		}),
		tiers: many(loyaltyTier),
		members: many(customerLoyalty),
	}),
);

export const loyaltyTierRelations = relations(loyaltyTier, ({ one }) => ({
	program: one(loyaltyProgram, {
		fields: [loyaltyTier.programId],
		references: [loyaltyProgram.id],
	}),
	rewardProduct: one(product, {
		fields: [loyaltyTier.rewardProductId],
		references: [product.id],
	}),
}));

export const customerLoyaltyRelations = relations(
	customerLoyalty,
	({ one, many }) => ({
		customer: one(customer, {
			fields: [customerLoyalty.customerId],
			references: [customer.id],
		}),
		program: one(loyaltyProgram, {
			fields: [customerLoyalty.programId],
			references: [loyaltyProgram.id],
		}),
		transactions: many(loyaltyTransaction),
	}),
);

export const loyaltyTransactionRelations = relations(
	loyaltyTransaction,
	({ one }) => ({
		customerLoyalty: one(customerLoyalty, {
			fields: [loyaltyTransaction.customerLoyaltyId],
			references: [customerLoyalty.id],
		}),
	}),
);

export const giftCardRelations = relations(giftCard, ({ one, many }) => ({
	organization: one(organization, {
		fields: [giftCard.organizationId],
		references: [organization.id],
	}),
	customer: one(customer, {
		fields: [giftCard.customerId],
		references: [customer.id],
	}),
	transactions: many(giftCardTransaction),
}));

export const giftCardTransactionRelations = relations(
	giftCardTransaction,
	({ one }) => ({
		giftCard: one(giftCard, {
			fields: [giftCardTransaction.giftCardId],
			references: [giftCard.id],
		}),
	}),
);

export const discountRuleRelations = relations(discountRule, ({ one }) => ({
	organization: one(organization, {
		fields: [discountRule.organizationId],
		references: [organization.id],
	}),
}));

// ── Pricelist (GAP-018) ───────────────────────────────────────────────

export const pricelist = pgTable(
	"pricelist",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("idx_pricelist_org").on(table.organizationId)],
);

export const pricelistItem = pgTable(
	"pricelist_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		pricelistId: uuid("pricelist_id")
			.notNull()
			.references(() => pricelist.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		price: numeric("price", { precision: 12, scale: 2 }).notNull(),
	},
	(table) => [
		index("idx_pricelist_item_list").on(table.pricelistId),
		index("idx_pricelist_item_product").on(table.productId),
		uniqueIndex("idx_pricelist_item_uniq").on(
			table.pricelistId,
			table.productId,
		),
	],
);

// Link customers to pricelists
export const customerPricelist = pgTable(
	"customer_pricelist",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => customer.id, { onDelete: "cascade" }),
		pricelistId: uuid("pricelist_id")
			.notNull()
			.references(() => pricelist.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_customer_pricelist_cust").on(table.customerId),
		uniqueIndex("idx_customer_pricelist_uniq").on(
			table.customerId,
			table.pricelistId,
		),
	],
);

export const pricelistRelations = relations(pricelist, ({ one, many }) => ({
	organization: one(organization, {
		fields: [pricelist.organizationId],
		references: [organization.id],
	}),
	items: many(pricelistItem),
	customers: many(customerPricelist),
}));

export const pricelistItemRelations = relations(pricelistItem, ({ one }) => ({
	pricelist: one(pricelist, {
		fields: [pricelistItem.pricelistId],
		references: [pricelist.id],
	}),
	product: one(product, {
		fields: [pricelistItem.productId],
		references: [product.id],
	}),
}));

export const customerPricelistRelations = relations(
	customerPricelist,
	({ one }) => ({
		customer: one(customer, {
			fields: [customerPricelist.customerId],
			references: [customer.id],
		}),
		pricelist: one(pricelist, {
			fields: [customerPricelist.pricelistId],
			references: [pricelist.id],
		}),
	}),
);
