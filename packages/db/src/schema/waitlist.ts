import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { location, organization } from "./organization";

export const waitlistEntry = pgTable(
	"waitlist_entry",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id").references(() => location.id, {
			onDelete: "set null",
		}),
		customerName: text("customer_name").notNull(),
		customerPhone: text("customer_phone"),
		partySize: integer("party_size").notNull().default(1),
		estimatedWaitMinutes: integer("estimated_wait_minutes"),
		status: text("status").notNull().default("waiting"), // waiting, notified, seated, cancelled, no_show
		notes: text("notes"),
		notifiedAt: timestamp("notified_at", { withTimezone: true }),
		seatedAt: timestamp("seated_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		index("waitlist_org_idx").on(t.organizationId),
		index("waitlist_status_idx").on(t.status),
	],
);

export const waitlistEntryRelations = relations(waitlistEntry, ({ one }) => ({
	organization: one(organization, {
		fields: [waitlistEntry.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [waitlistEntry.locationId],
		references: [location.id],
	}),
}));
