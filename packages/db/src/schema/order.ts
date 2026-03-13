import { relations, sql } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { customer } from "./customer";
import { location, organization, register } from "./organization";
import { product } from "./product";

// ── Order ──────────────────────────────────────────────────────────────

export const order = pgTable(
	"order",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id),
		registerId: uuid("register_id").references(() => register.id),
		userId: text("user_id").references(() => user.id),
		orderNumber: text("order_number").notNull(),
		type: text("type").notNull().default("sale"),
		status: text("status").notNull().default("open"),
		subtotal: numeric("subtotal", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		discountTotal: numeric("discount_total", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		taxTotal: numeric("tax_total", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
		tipAmount: numeric("tip_amount", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		tabName: text("tab_name"),
		customerId: uuid("customer_id").references(() => customer.id, {
			onDelete: "set null",
		}),
		customerName: text("customer_name"),
		customerPhone: text("customer_phone"),
		deliveryAddress: text("delivery_address"),
		fulfillmentStatus: text("fulfillment_status").default("none"),
		estimatedReadyAt: timestamp("estimated_ready_at", { withTimezone: true }),
		tableId: uuid("table_id"),
		notes: text("notes"),
		voidAuthorizedBy: text("void_authorized_by").references(() => user.id),
		voidReason: text("void_reason"),
		voidAuthorizedAt: timestamp("void_authorized_at", { withTimezone: true }),
		isSplit: boolean("is_split").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_order_org").on(table.organizationId),
		index("idx_order_location").on(table.locationId),
		index("idx_order_register").on(table.registerId),
		index("idx_order_user").on(table.userId),
		index("idx_order_customer").on(table.customerId),
		index("idx_order_status").on(table.status),
		index("idx_order_created").on(table.createdAt),
		index("idx_order_org_created").on(table.organizationId, table.createdAt),
	],
);

// ── Order Line Item ────────────────────────────────────────────────────

export const orderLineItem = pgTable(
	"order_line_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		productId: uuid("product_id").references(() => product.id, {
			onDelete: "set null",
		}),
		productNameSnapshot: text("product_name_snapshot").notNull(),
		reportingNameSnapshot: text("reporting_name_snapshot"),
		reportingCategorySnapshot: text("reporting_category_snapshot"),
		quantity: integer("quantity").notNull().default(1),
		unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
		discount: numeric("discount", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
		total: numeric("total", { precision: 10, scale: 2 }).notNull(),
		modifiersSnapshot: jsonb("modifiers_snapshot").default([]),
		notes: text("notes"),
		isComponent: boolean("is_component").notNull().default(false),
		voided: boolean("voided").notNull().default(false),
		voidReason: text("void_reason"),
		courseNumber: integer("course_number").notNull().default(1),
	},
	(table) => [
		index("idx_order_line_item_order").on(table.orderId),
		index("idx_order_line_item_product").on(table.productId),
	],
);

// ── Payment ────────────────────────────────────────────────────────────

export const payment = pgTable(
	"payment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		method: text("method").notNull().default("cash"),
		amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
		tendered: numeric("tendered", { precision: 10, scale: 2 }),
		changeGiven: numeric("change_given", { precision: 10, scale: 2 }).default(
			"0",
		),
		tipAmount: numeric("tip_amount", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		currency: text("currency").notNull().default("GYD"),
		exchangeRate: numeric("exchange_rate", { precision: 10, scale: 4 }),
		reference: text("reference"),
		splitGroup: integer("split_group"),
		status: text("status").notNull().default("completed"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_payment_order").on(table.orderId),
		index("idx_payment_method").on(table.method),
	],
);

// ── Refund ─────────────────────────────────────────────────────────────

export const refund = pgTable(
	"refund",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		originalOrderId: uuid("original_order_id").references(() => order.id),
		userId: text("user_id").references(() => user.id),
		amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
		reason: text("reason").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_refund_order").on(table.orderId),
		index("idx_refund_original_order").on(table.originalOrderId),
	],
);

// ── Daily Order Counter ────────────────────────────────────────────────

export const dailyOrderCounter = pgTable(
	"daily_order_counter",
	{
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		counterDate: date("counter_date").notNull().default(sql`CURRENT_DATE`),
		lastNumber: integer("last_number").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.locationId, table.counterDate] })],
);

// ── Relations ──────────────────────────────────────────────────────────

export const orderRelations = relations(order, ({ one, many }) => ({
	organization: one(organization, {
		fields: [order.organizationId],
		references: [organization.id],
	}),
	customer: one(customer, {
		fields: [order.customerId],
		references: [customer.id],
	}),
	location: one(location, {
		fields: [order.locationId],
		references: [location.id],
	}),
	register: one(register, {
		fields: [order.registerId],
		references: [register.id],
	}),
	user: one(user, {
		fields: [order.userId],
		references: [user.id],
		relationName: "orderUser",
	}),
	voidAuthorizedByUser: one(user, {
		fields: [order.voidAuthorizedBy],
		references: [user.id],
		relationName: "orderVoidAuthorizedBy",
	}),
	lineItems: many(orderLineItem),
	payments: many(payment),
	refunds: many(refund),
}));

export const orderLineItemRelations = relations(orderLineItem, ({ one }) => ({
	order: one(order, {
		fields: [orderLineItem.orderId],
		references: [order.id],
	}),
	product: one(product, {
		fields: [orderLineItem.productId],
		references: [product.id],
	}),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
	order: one(order, {
		fields: [payment.orderId],
		references: [order.id],
	}),
}));

export const refundRelations = relations(refund, ({ one }) => ({
	order: one(order, {
		fields: [refund.orderId],
		references: [order.id],
	}),
	originalOrder: one(order, {
		fields: [refund.originalOrderId],
		references: [order.id],
	}),
	user: one(user, {
		fields: [refund.userId],
		references: [user.id],
	}),
}));

export const dailyOrderCounterRelations = relations(
	dailyOrderCounter,
	({ one }) => ({
		location: one(location, {
			fields: [dailyOrderCounter.locationId],
			references: [location.id],
		}),
	}),
);
