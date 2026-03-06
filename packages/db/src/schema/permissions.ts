import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { location, organization } from "./organization";

// ── Custom Role ────────────────────────────────────────────────────────

export const customRole = pgTable(
	"custom_role",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		permissions: jsonb("permissions").notNull().default({}),
		isSystem: boolean("is_system").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("idx_custom_role_org").on(table.organizationId)],
);

// ── User Role ──────────────────────────────────────────────────────────

export const userRole = pgTable(
	"user_role",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		roleId: uuid("role_id")
			.notNull()
			.references(() => customRole.id, { onDelete: "cascade" }),
		locationId: uuid("location_id").references(() => location.id),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.roleId] }),
		index("idx_user_role_user").on(table.userId),
		index("idx_user_role_role").on(table.roleId),
	],
);

// ── Relations ──────────────────────────────────────────────────────────

export const customRoleRelations = relations(customRole, ({ one, many }) => ({
	organization: one(organization, {
		fields: [customRole.organizationId],
		references: [organization.id],
	}),
	userRoles: many(userRole),
}));

export const userRoleRelations = relations(userRole, ({ one }) => ({
	user: one(user, {
		fields: [userRole.userId],
		references: [user.id],
	}),
	role: one(customRole, {
		fields: [userRole.roleId],
		references: [customRole.id],
	}),
	location: one(location, {
		fields: [userRole.locationId],
		references: [location.id],
	}),
}));
