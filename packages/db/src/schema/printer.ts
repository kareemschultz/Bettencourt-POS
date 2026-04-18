import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { location, organization } from "./organization";
import { reportingCategory } from "./product";

export const printer = pgTable(
	"printer",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		connectionType: text("connection_type").notNull().default("network"),
		address: text("address"),
		paperWidth: text("paper_width").notNull().default("80mm"),
		isActive: boolean("is_active").notNull().default(true),
		autoCut: boolean("auto_cut").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_printer_org").on(table.organizationId),
		index("idx_printer_location").on(table.locationId),
	],
);

export const printerRoute = pgTable(
	"printer_route",
	{
		printerId: uuid("printer_id")
			.notNull()
			.references(() => printer.id, { onDelete: "cascade" }),
		reportingCategoryId: uuid("reporting_category_id")
			.notNull()
			.references(() => reportingCategory.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.printerId, table.reportingCategoryId] }),
	],
);

export const printerRelations = relations(printer, ({ one, many }) => ({
	organization: one(organization, {
		fields: [printer.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [printer.locationId],
		references: [location.id],
	}),
	routes: many(printerRoute),
}));

export const printerRouteRelations = relations(printerRoute, ({ one }) => ({
	printer: one(printer, {
		fields: [printerRoute.printerId],
		references: [printer.id],
	}),
	reportingCategory: one(reportingCategory, {
		fields: [printerRoute.reportingCategoryId],
		references: [reportingCategory.id],
	}),
}));
