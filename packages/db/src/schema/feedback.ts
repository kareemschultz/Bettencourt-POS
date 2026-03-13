import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { customer } from "./customer";
import { order } from "./order";
import { organization } from "./organization";

export const customerFeedback = pgTable(
	"customer_feedback",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id),
		orderId: uuid("order_id").references(() => order.id),
		customerId: uuid("customer_id").references(() => customer.id),
		rating: integer("rating").notNull(), // 1-5
		foodRating: integer("food_rating"), // 1-5
		serviceRating: integer("service_rating"), // 1-5
		ambienceRating: integer("ambience_rating"), // 1-5
		comment: text("comment"),
		customerName: text("customer_name"),
		customerEmail: text("customer_email"),
		source: text("source").notNull().default("pos"), // pos, online, qr
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("feedback_org_idx").on(t.organizationId),
		index("feedback_order_idx").on(t.orderId),
		index("feedback_rating_idx").on(t.rating),
	],
);

export const customerFeedbackRelations = relations(
	customerFeedback,
	({ one }) => ({
		organization: one(organization, {
			fields: [customerFeedback.organizationId],
			references: [organization.id],
		}),
		order: one(order, {
			fields: [customerFeedback.orderId],
			references: [order.id],
		}),
		customer: one(customer, {
			fields: [customerFeedback.customerId],
			references: [customer.id],
		}),
	}),
);
