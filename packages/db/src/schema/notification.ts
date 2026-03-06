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

// ── Notification Templates ─────────────────────────────────────────────
// Configurable message templates for SMS/WhatsApp notifications.
// Each template corresponds to a trigger event (e.g., order ready, delivery dispatched).

export const notificationTemplate = pgTable(
	"notification_template",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		event: text("event").notNull(), // e.g., "order.ready", "order.delivered", "loyalty.earned"
		name: text("name").notNull(), // Human-readable name
		description: text("description"), // Helper text explaining when this triggers
		channel: text("channel").notNull().default("sms"), // "sms" | "whatsapp" | "both"
		messageTemplate: text("message_template").notNull(), // Supports {{orderNumber}}, {{customerName}}, etc.
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_notification_template_org").on(table.organizationId),
		index("idx_notification_template_event").on(table.event),
	],
);

// ── Notification Log ───────────────────────────────────────────────────
// Tracks every notification sent (or attempted) for audit and debugging.

export const notificationLog = pgTable(
	"notification_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		templateId: uuid("template_id").references(() => notificationTemplate.id, {
			onDelete: "set null",
		}),
		event: text("event").notNull(),
		channel: text("channel").notNull(), // "sms" | "whatsapp"
		recipient: text("recipient").notNull(), // Phone number
		message: text("message").notNull(), // Final rendered message
		status: text("status").notNull().default("pending"), // "pending" | "sent" | "delivered" | "failed"
		externalId: text("external_id"), // Twilio SID or similar
		errorMessage: text("error_message"),
		metadata: jsonb("metadata").default({}), // Order ID, customer ID, etc.
		cost: integer("cost"), // Cost in cents (for tracking Twilio spend)
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_notification_log_org").on(table.organizationId),
		index("idx_notification_log_status").on(table.status),
		index("idx_notification_log_created").on(table.createdAt),
	],
);

// ── Notification Settings ──────────────────────────────────────────────
// Organization-level SMS/WhatsApp configuration (Twilio credentials, etc.)

export const notificationSettings = pgTable("notification_settings", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.unique()
		.references(() => organization.id, { onDelete: "cascade" }),
	provider: text("provider").notNull().default("twilio"), // "twilio" | "vonage" | etc.
	accountSid: text("account_sid"), // Encrypted in production
	authToken: text("auth_token"), // Encrypted in production
	fromNumber: text("from_number"), // Twilio phone number
	whatsappNumber: text("whatsapp_number"), // WhatsApp Business number
	isActive: boolean("is_active").notNull().default(false),
	dailyLimit: integer("daily_limit").notNull().default(500),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

// ── Relations ──────────────────────────────────────────────────────────

export const notificationTemplateRelations = relations(
	notificationTemplate,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [notificationTemplate.organizationId],
			references: [organization.id],
		}),
		logs: many(notificationLog),
	}),
);

export const notificationLogRelations = relations(
	notificationLog,
	({ one }) => ({
		organization: one(organization, {
			fields: [notificationLog.organizationId],
			references: [organization.id],
		}),
		template: one(notificationTemplate, {
			fields: [notificationLog.templateId],
			references: [notificationTemplate.id],
		}),
	}),
);

export const notificationSettingsRelations = relations(
	notificationSettings,
	({ one }) => ({
		organization: one(organization, {
			fields: [notificationSettings.organizationId],
			references: [organization.id],
		}),
	}),
);
