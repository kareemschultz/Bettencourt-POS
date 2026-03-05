import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const organization = pgTable("organization", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logo: text("logo"),
	settings: jsonb("settings").default({}),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const location = pgTable(
	"location",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		address: text("address"),
		phone: text("phone"),
		timezone: text("timezone").notNull().default("America/New_York"),
		receiptHeader: text("receipt_header"),
		receiptFooter: text("receipt_footer"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("idx_location_org").on(table.organizationId)],
);

export const register = pgTable(
	"register",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		hardwareConfig: jsonb("hardware_config").default({}),
		workflowMode: text("workflow_mode").default("standard"),
		receiptHeaderOverride: text("receipt_header_override"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_register_location").on(table.locationId)],
);

// ── Relations ──────────────────────────────────────────────────────────

export const organizationRelations = relations(organization, ({ many }) => ({
	locations: many(location),
	registers: many(register),
}));

export const locationRelations = relations(location, ({ one, many }) => ({
	organization: one(organization, {
		fields: [location.organizationId],
		references: [organization.id],
	}),
	registers: many(register),
}));

export const registerRelations = relations(register, ({ one }) => ({
	location: one(location, {
		fields: [register.locationId],
		references: [location.id],
	}),
}));
