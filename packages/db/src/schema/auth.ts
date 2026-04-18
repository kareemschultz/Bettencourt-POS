import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	// username plugin
	username: text("username").unique(),
	displayUsername: text("display_username"),
	// admin plugin
	role: text("role").default("user"),
	banned: boolean("banned").default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	// two-factor plugin
	twoFactorEnabled: boolean("two_factor_enabled").default(false),
	// POS-specific columns
	pinHash: text("pin_hash").unique(),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
	organizationId: uuid("organization_id").references(() => organization.id),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// organization plugin
		activeOrganizationId: uuid("active_organization_id"),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

// ── PIN Login Rate Limit (shared across instances) ─────────────────────
export const pinLoginRateLimit = pgTable(
	"pin_login_rate_limit",
	{
		ipAddress: text("ip_address").primaryKey(),
		failCount: integer("fail_count").notNull().default(0),
		windowStartedAt: timestamp("window_started_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lockedUntil: timestamp("locked_until", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_pin_login_rate_limit_locked_until").on(table.lockedUntil),
		index("idx_pin_login_rate_limit_updated_at").on(table.updatedAt),
	],
);

// ── Two Factor (Better Auth two-factor plugin) ──────────────────────
export const twoFactor = pgTable("two_factor", {
	id: text("id").primaryKey(),
	secret: text("secret").notNull(),
	backupCodes: text("backup_codes").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

// ── Member (Better Auth organization plugin) ────────────────────────
export const member = pgTable(
	"member",
	{
		id: text("id").primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("member"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("member_organizationId_idx").on(table.organizationId),
		index("member_userId_idx").on(table.userId),
	],
);

// ── Invitation (Better Auth organization plugin) ────────────────────
export const invitation = pgTable(
	"invitation",
	{
		id: text("id").primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role").notNull().default("member"),
		status: text("status").notNull().default("pending"),
		expiresAt: timestamp("expires_at").notNull(),
		inviterId: text("inviter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("invitation_organizationId_idx").on(table.organizationId),
		index("invitation_email_idx").on(table.email),
	],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ one, many }) => ({
	sessions: many(session),
	accounts: many(account),
	members: many(member),
	organization: one(organization, {
		fields: [user.organizationId],
		references: [organization.id],
	}),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
	user: one(user, {
		fields: [twoFactor.userId],
		references: [user.id],
	}),
}));

export const memberRelations = relations(member, ({ one }) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id],
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id],
	}),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id],
	}),
	inviter: one(user, {
		fields: [invitation.inviterId],
		references: [user.id],
	}),
}));
