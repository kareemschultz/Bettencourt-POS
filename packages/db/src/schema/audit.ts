import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { location } from "./organization";

// ── Audit Log ──────────────────────────────────────────────────────────

export const auditLog = pgTable(
	"audit_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").references(() => user.id),
		userNameSnapshot: text("user_name_snapshot"),
		roleSnapshot: text("role_snapshot"),
		locationId: uuid("location_id").references(() => location.id),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id"),
		actionType: text("action_type").notNull(),
		beforeData: jsonb("before_data"),
		afterData: jsonb("after_data"),
		diffData: jsonb("diff_data"),
		reason: text("reason"),
		ipAddress: text("ip_address"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_audit_log_user").on(table.userId),
		index("idx_audit_log_entity_type").on(table.entityType),
		index("idx_audit_log_entity_id").on(table.entityId),
		index("idx_audit_log_action_type").on(table.actionType),
		index("idx_audit_log_location").on(table.locationId),
		index("idx_audit_log_created").on(table.createdAt),
	],
);

// ── Relations ──────────────────────────────────────────────────────────

export const auditLogRelations = relations(auditLog, ({ one }) => ({
	user: one(user, {
		fields: [auditLog.userId],
		references: [user.id],
	}),
	location: one(location, {
		fields: [auditLog.locationId],
		references: [location.id],
	}),
}));
