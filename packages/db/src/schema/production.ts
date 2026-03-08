import { relations, sql } from "drizzle-orm";
import {
	date,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { location } from "./organization";
import { product } from "./product";

// ── Production Log ─────────────────────────────────────────────────────

export const productionLog = pgTable(
	"production_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id").references(() => product.id),
		productName: text("product_name").notNull(),
		locationId: uuid("location_id").references(() => location.id),
		loggedByUserId: text("logged_by_user_id").references(() => user.id),
		entryType: text("entry_type").notNull(),
		workflow: text("workflow"), // "restaurant" | "bakery"
		quantity: integer("quantity").notNull(),
		notes: text("notes"),
		logDate: date("log_date").notNull().default(sql`CURRENT_DATE`),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_production_log_product").on(table.productId),
		index("idx_production_log_location").on(table.locationId),
		index("idx_production_log_date").on(table.logDate),
		index("idx_production_log_entry_type").on(table.entryType),
	],
);

// ── Relations ──────────────────────────────────────────────────────────

export const productionLogRelations = relations(productionLog, ({ one }) => ({
	product: one(product, {
		fields: [productionLog.productId],
		references: [product.id],
	}),
	location: one(location, {
		fields: [productionLog.locationId],
		references: [location.id],
	}),
	loggedByUser: one(user, {
		fields: [productionLog.loggedByUserId],
		references: [user.id],
	}),
}));

// ── Product Production Component ────────────────────────────────────────

export const productProductionComponent = pgTable(
	"product_production_component",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		componentName: text("component_name").notNull(),
		quantity: numeric("quantity", { precision: 10, scale: 4 })
			.notNull()
			.default("1"),
	},
	(table) => [index("idx_prod_component_product").on(table.productId)],
);

export const productProductionComponentRelations = relations(
	productProductionComponent,
	({ one }) => ({
		product: one(product, {
			fields: [productProductionComponent.productId],
			references: [product.id],
		}),
	}),
);
