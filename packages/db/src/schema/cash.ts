import { relations } from "drizzle-orm";
import {
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { location, register } from "./organization";

// ── Cash Session ───────────────────────────────────────────────────────

export const cashSession = pgTable(
	"cash_session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		registerId: uuid("register_id")
			.notNull()
			.references(() => register.id),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id),
		openedBy: text("opened_by")
			.notNull()
			.references(() => user.id),
		openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
		openingFloat: numeric("opening_float", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		closedBy: text("closed_by").references(() => user.id),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		closingCount: numeric("closing_count", { precision: 10, scale: 2 }),
		expectedCash: numeric("expected_cash", { precision: 10, scale: 2 }),
		variance: numeric("variance", { precision: 10, scale: 2 }),
		status: text("status").notNull().default("open"),
		notes: text("notes"),
	},
	(table) => [
		index("idx_cash_session_register").on(table.registerId),
		index("idx_cash_session_location").on(table.locationId),
		index("idx_cash_session_status").on(table.status),
	],
);

// ── Cash Drop ──────────────────────────────────────────────────────────

export const cashDrop = pgTable(
	"cash_drop",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cashSessionId: uuid("cash_session_id")
			.notNull()
			.references(() => cashSession.id, { onDelete: "cascade" }),
		amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		reason: text("reason"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_cash_drop_session").on(table.cashSessionId)],
);

// ── Cash Payout ────────────────────────────────────────────────────────

export const cashPayout = pgTable(
	"cash_payout",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cashSessionId: uuid("cash_session_id")
			.notNull()
			.references(() => cashSession.id, { onDelete: "cascade" }),
		amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		reason: text("reason").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_cash_payout_session").on(table.cashSessionId)],
);

// ── Relations ──────────────────────────────────────────────────────────

export const cashSessionRelations = relations(cashSession, ({ one, many }) => ({
	register: one(register, {
		fields: [cashSession.registerId],
		references: [register.id],
	}),
	location: one(location, {
		fields: [cashSession.locationId],
		references: [location.id],
	}),
	openedByUser: one(user, {
		fields: [cashSession.openedBy],
		references: [user.id],
		relationName: "cashSessionOpenedBy",
	}),
	closedByUser: one(user, {
		fields: [cashSession.closedBy],
		references: [user.id],
		relationName: "cashSessionClosedBy",
	}),
	drops: many(cashDrop),
	payouts: many(cashPayout),
}));

export const cashDropRelations = relations(cashDrop, ({ one }) => ({
	cashSession: one(cashSession, {
		fields: [cashDrop.cashSessionId],
		references: [cashSession.id],
	}),
	user: one(user, {
		fields: [cashDrop.userId],
		references: [user.id],
	}),
}));

export const cashPayoutRelations = relations(cashPayout, ({ one }) => ({
	cashSession: one(cashSession, {
		fields: [cashPayout.cashSessionId],
		references: [cashSession.id],
	}),
	user: one(user, {
		fields: [cashPayout.userId],
		references: [user.id],
	}),
}));
