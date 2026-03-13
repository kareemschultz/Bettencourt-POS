import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { order, orderLineItem } from "./order";
import { location } from "./organization";

// ── Floor ──────────────────────────────────────────────────────────────

export const floor = pgTable(
	"floor",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		backgroundImage: text("background_image"),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_floor_location").on(table.locationId),
		index("idx_floor_active").on(table.isActive),
	],
);

// ── Table Layout ───────────────────────────────────────────────────────

export const tableLayout = pgTable(
	"table_layout",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		floorId: uuid("floor_id").references(() => floor.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		section: text("section"),
		seats: integer("seats").notNull().default(4),
		positionX: integer("position_x").notNull().default(0),
		positionY: integer("position_y").notNull().default(0),
		width: integer("width").notNull().default(100),
		height: integer("height").notNull().default(100),
		shape: text("shape").notNull().default("square"),
		status: text("status").notNull().default("available"),
		currentOrderId: uuid("current_order_id").references(() => order.id),
		currentGuests: integer("current_guests"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_table_layout_location").on(table.locationId),
		index("idx_table_layout_floor").on(table.floorId),
		index("idx_table_layout_status").on(table.status),
	],
);

// ── Kitchen Order Ticket ───────────────────────────────────────────────

export const kitchenOrderTicket = pgTable(
	"kitchen_order_ticket",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id),
		status: text("status").notNull().default("pending"),
		printerTarget: text("printer_target"),
		station: text("station"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_kot_order").on(table.orderId),
		index("idx_kot_location").on(table.locationId),
		index("idx_kot_station").on(table.station),
		index("idx_kot_status").on(table.status),
	],
);

// ── Kitchen Order Item ─────────────────────────────────────────────────

export const kitchenOrderItem = pgTable(
	"kitchen_order_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ticketId: uuid("ticket_id")
			.notNull()
			.references(() => kitchenOrderTicket.id, { onDelete: "cascade" }),
		orderLineItemId: uuid("order_line_item_id").references(
			() => orderLineItem.id,
		),
		productName: text("product_name").notNull(),
		quantity: integer("quantity").notNull().default(1),
		modifiers: text("modifiers"),
		notes: text("notes"),
		status: text("status").notNull().default("pending"),
		firedAt: timestamp("fired_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_koi_ticket").on(table.ticketId),
		index("idx_koi_status").on(table.status),
	],
);

// ── Relations ──────────────────────────────────────────────────────────

export const floorRelations = relations(floor, ({ one, many }) => ({
	location: one(location, {
		fields: [floor.locationId],
		references: [location.id],
	}),
	tables: many(tableLayout),
}));

export const tableLayoutRelations = relations(tableLayout, ({ one }) => ({
	location: one(location, {
		fields: [tableLayout.locationId],
		references: [location.id],
	}),
	floor: one(floor, {
		fields: [tableLayout.floorId],
		references: [floor.id],
	}),
	currentOrder: one(order, {
		fields: [tableLayout.currentOrderId],
		references: [order.id],
	}),
}));

export const kitchenOrderTicketRelations = relations(
	kitchenOrderTicket,
	({ one, many }) => ({
		order: one(order, {
			fields: [kitchenOrderTicket.orderId],
			references: [order.id],
		}),
		location: one(location, {
			fields: [kitchenOrderTicket.locationId],
			references: [location.id],
		}),
		items: many(kitchenOrderItem),
	}),
);

export const kitchenOrderItemRelations = relations(
	kitchenOrderItem,
	({ one }) => ({
		ticket: one(kitchenOrderTicket, {
			fields: [kitchenOrderItem.ticketId],
			references: [kitchenOrderTicket.id],
		}),
		orderLineItem: one(orderLineItem, {
			fields: [kitchenOrderItem.orderLineItemId],
			references: [orderLineItem.id],
		}),
	}),
);
