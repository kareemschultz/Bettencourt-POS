import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const webhookEndpoint = pgTable(
	"webhook_endpoint",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		name: text("name").notNull(),
		secret: text("secret"),
		events: jsonb("events").$type<string[]>().notNull().default([]),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("idx_webhook_endpoint_org").on(table.organizationId)],
);

export const webhookDelivery = pgTable(
	"webhook_delivery",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		endpointId: uuid("endpoint_id")
			.notNull()
			.references(() => webhookEndpoint.id, { onDelete: "cascade" }),
		event: text("event").notNull(),
		payload: jsonb("payload").notNull(),
		statusCode: integer("status_code"),
		responseBody: text("response_body"),
		duration: integer("duration_ms"),
		success: boolean("success").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_webhook_delivery_endpoint").on(table.endpointId),
		index("idx_webhook_delivery_created").on(table.createdAt),
	],
);

// ── Relations ──────────────────────────────────────────────────────────

export const webhookEndpointRelations = relations(
	webhookEndpoint,
	({ many }) => ({
		deliveries: many(webhookDelivery),
	}),
);

export const webhookDeliveryRelations = relations(
	webhookDelivery,
	({ one }) => ({
		endpoint: one(webhookEndpoint, {
			fields: [webhookDelivery.endpointId],
			references: [webhookEndpoint.id],
		}),
	}),
);
