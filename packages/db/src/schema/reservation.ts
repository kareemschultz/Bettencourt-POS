import { relations } from "drizzle-orm";
import {
	date,
	index,
	integer,
	pgTable,
	text,
	time,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { tableLayout } from "./kitchen";
import { location, organization } from "./organization";

export const reservation = pgTable(
	"reservation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		customerName: text("customer_name").notNull(),
		customerPhone: text("customer_phone"),
		customerEmail: text("customer_email"),
		date: date("date").notNull(),
		time: time("time").notNull(),
		partySize: integer("party_size").notNull().default(2),
		tableId: uuid("table_id").references(() => tableLayout.id, {
			onDelete: "set null",
		}),
		status: text("status").notNull().default("confirmed"),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_reservation_date").on(table.date),
		index("idx_reservation_location").on(table.locationId),
		index("idx_reservation_status").on(table.status),
	],
);

export const reservationRelations = relations(reservation, ({ one }) => ({
	organization: one(organization, {
		fields: [reservation.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [reservation.locationId],
		references: [location.id],
	}),
	table: one(tableLayout, {
		fields: [reservation.tableId],
		references: [tableLayout.id],
	}),
}));
