import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const agency = pgTable(
	"agency",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		supervisorName: text("supervisor_name"),
		supervisorPosition: text("supervisor_position"),
		phone: text("phone"),
		address: text("address"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_agency_org").on(table.organizationId),
		index("idx_agency_name").on(table.name),
	],
);

export const agencyRelations = relations(agency, ({ one }) => ({
	organization: one(organization, {
		fields: [agency.organizationId],
		references: [organization.id],
	}),
}));
