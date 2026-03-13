import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { customer } from "./customer";
import { organization } from "./organization";
import { product } from "./product";

// ── Pricelist ─────────────────────────────────────────────────────────
// Named price lists (e.g. "VIP", "Wholesale", "Staff", "Happy Hour")
// that can be assigned to customers for customer-specific pricing.

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

// ── Pricelist Item ────────────────────────────────────────────────────
// Per-product price overrides within a pricelist.

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
		price: numeric("price", { precision: 10, scale: 2 }).notNull(),
	},
	(table) => [
		uniqueIndex("idx_pricelist_item_unique").on(
			table.pricelistId,
			table.productId,
		),
		index("idx_pricelist_item_product").on(table.productId),
	],
);

// ── Customer ↔ Pricelist assignment ───────────────────────────────────
// Links a customer to a pricelist. One customer = one pricelist.
// If a customer has no pricelist, they get standard product.price.

// We add pricelistId directly to the customer table via a migration,
// but we also define a standalone join table for flexibility.

// ── Relations ─────────────────────────────────────────────────────────

export const pricelistRelations = relations(pricelist, ({ one, many }) => ({
	organization: one(organization, {
		fields: [pricelist.organizationId],
		references: [organization.id],
	}),
	items: many(pricelistItem),
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
