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
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
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
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
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
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("idx_register_location").on(table.locationId)],
);

// ── Receipt Config ────────────────────────────────────────────────────

export const receiptConfig = pgTable(
	"receipt_config",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.unique()
			.references(() => organization.id, { onDelete: "cascade" }),
		businessName: text("business_name")
			.notNull()
			.default("Bettencourt's Homestyle Diner"),
		tagline: text("tagline").default("'A True Guyanese Gem'"),
		addressLine1: text("address_line_1"),
		addressLine2: text("address_line_2"),
		phone: text("phone"),
		footerMessage: text("footer_message").default(
			"Thank you for choosing Bettencourt's!",
		),
		promoMessage: text("promo_message"),
		showLogo: boolean("show_logo").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("idx_receipt_config_org").on(table.organizationId)],
);

// ── Time Entry ────────────────────────────────────────────────────────

export const timeEntry = pgTable(
	"time_entry",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").notNull(),
		locationId: uuid("location_id").references(() => location.id, {
			onDelete: "set null",
		}),
		clockIn: timestamp("clock_in", { withTimezone: true })
			.notNull()
			.defaultNow(),
		clockOut: timestamp("clock_out", { withTimezone: true }),
		breakMinutes: text("break_minutes").notNull().default("0"),
		notes: text("notes"),
		status: text("status").notNull().default("active"),
		editedBy: text("edited_by"),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_time_entry_user").on(table.userId),
		index("idx_time_entry_org").on(table.organizationId),
	],
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
