import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { location, organization } from "./organization";

export const shift = pgTable(
	"shift",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id").references(() => location.id, {
			onDelete: "set null",
		}),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		dayOfWeek: text("day_of_week").notNull(), // monday, tuesday, ...
		startTime: text("start_time").notNull(), // HH:mm
		endTime: text("end_time").notNull(), // HH:mm
		notes: text("notes"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		index("shift_org_idx").on(t.organizationId),
		index("shift_user_idx").on(t.userId),
	],
);

export const shiftRelations = relations(shift, ({ one }) => ({
	organization: one(organization, {
		fields: [shift.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [shift.locationId],
		references: [location.id],
	}),
	user: one(user, {
		fields: [shift.userId],
		references: [user.id],
	}),
}));
