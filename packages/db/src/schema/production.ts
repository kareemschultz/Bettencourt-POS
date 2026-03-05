import { relations, sql } from "drizzle-orm";
import {
	date,
	index,
	integer,
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
		quantity: integer("quantity").notNull(),
		notes: text("notes"),
		logDate: date("log_date").notNull().default(sql`CURRENT_DATE`),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
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
