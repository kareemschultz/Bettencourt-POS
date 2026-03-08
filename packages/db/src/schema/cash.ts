import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { supplier } from "./inventory";
import { location, organization, register } from "./organization";

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
		openedAt: timestamp("opened_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		openingFloat: numeric("opening_float", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		closedBy: text("closed_by").references(() => user.id),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		closingCount: numeric("closing_count", { precision: 10, scale: 2 }),
		expectedCash: numeric("expected_cash", { precision: 10, scale: 2 }),
		variance: numeric("variance", { precision: 10, scale: 2 }),
		varianceApprovedBy: text("variance_approved_by").references(() => user.id),
		varianceReason: text("variance_reason"),
		varianceApprovedAt: timestamp("variance_approved_at", {
			withTimezone: true,
		}),
		status: text("status").notNull().default("open"),
		notes: text("notes"),
	},
	(table) => [
		index("idx_cash_session_register").on(table.registerId),
		index("idx_cash_session_location").on(table.locationId),
		index("idx_cash_session_status").on(table.status),
		uniqueIndex("uq_cash_session_open_register")
			.on(table.registerId)
			.where(sql`status = 'open'`),
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
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
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
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("idx_cash_payout_session").on(table.cashSessionId)],
);

// ── Cash Reconciliation Rule ──────────────────────────────────────────

export const cashReconciliationRule = pgTable(
	"cash_reconciliation_rule",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.unique()
			.references(() => organization.id, { onDelete: "cascade" }),
		maxVarianceAmount: numeric("max_variance_amount", {
			precision: 10,
			scale: 2,
		})
			.notNull()
			.default("500"),
		requirePhotoEvidence: boolean("require_photo_evidence")
			.notNull()
			.default(false),
		notifyManagers: boolean("notify_managers").notNull().default(true),
	},
	(table) => [index("idx_cash_recon_rule_org").on(table.organizationId)],
);

// ── Shift Handoff ─────────────────────────────────────────────────────

export const shiftHandoff = pgTable(
	"shift_handoff",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cashSessionId: uuid("cash_session_id")
			.notNull()
			.references(() => cashSession.id, { onDelete: "cascade" }),
		fromUserId: text("from_user_id")
			.notNull()
			.references(() => user.id),
		toUserId: text("to_user_id")
			.notNull()
			.references(() => user.id),
		countedAmount: numeric("counted_amount", {
			precision: 10,
			scale: 2,
		}).notNull(),
		expectedAmount: numeric("expected_amount", {
			precision: 10,
			scale: 2,
		}).notNull(),
		variance: numeric("variance", { precision: 10, scale: 2 }).notNull(),
		status: text("status").notNull().default("pending"),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_shift_handoff_session").on(table.cashSessionId),
		index("idx_shift_handoff_from").on(table.fromUserId),
		index("idx_shift_handoff_to").on(table.toUserId),
	],
);

// ── Expense ───────────────────────────────────────────────────────────

export const expense = pgTable(
	"expense",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cashSessionId: uuid("cash_session_id").references(() => cashSession.id, {
			onDelete: "cascade",
		}),
		amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
		category: text("category").notNull(),
		description: text("description").notNull(),
		receiptPhotoUrl: text("receipt_photo_url"),
		paymentMethod: text("payment_method"),
		referenceNumber: text("reference_number"),
		notes: text("notes"),
		authorizedBy: text("authorized_by")
			.notNull()
			.references(() => user.id),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		supplierId: uuid("supplier_id").references(() => supplier.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("idx_expense_session").on(table.cashSessionId),
		index("idx_expense_org").on(table.organizationId),
		index("idx_expense_created").on(table.createdAt),
		index("idx_expense_supplier").on(table.supplierId),
		index("idx_expense_org_created").on(table.organizationId, table.createdAt),
	],
);

// ── Expense Category ──────────────────────────────────────────────────

export const expenseCategory = pgTable(
	"expense_category",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		index("idx_expense_category_org").on(table.organizationId),
		unique("expense_category_org_name").on(table.organizationId, table.name),
	],
);

// ── No-Sale Event ─────────────────────────────────────────────────────

export const noSaleEvent = pgTable(
	"no_sale_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cashSessionId: uuid("cash_session_id")
			.notNull()
			.references(() => cashSession.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		reason: text("reason").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_no_sale_event_session").on(table.cashSessionId),
		index("idx_no_sale_event_user").on(table.userId),
	],
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
	varianceApprovedByUser: one(user, {
		fields: [cashSession.varianceApprovedBy],
		references: [user.id],
		relationName: "cashSessionVarianceApprovedBy",
	}),
	drops: many(cashDrop),
	payouts: many(cashPayout),
	handoffs: many(shiftHandoff),
	expenses: many(expense),
	noSaleEvents: many(noSaleEvent),
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

export const cashReconciliationRuleRelations = relations(
	cashReconciliationRule,
	({ one }) => ({
		organization: one(organization, {
			fields: [cashReconciliationRule.organizationId],
			references: [organization.id],
		}),
	}),
);

export const shiftHandoffRelations = relations(shiftHandoff, ({ one }) => ({
	cashSession: one(cashSession, {
		fields: [shiftHandoff.cashSessionId],
		references: [cashSession.id],
	}),
	fromUser: one(user, {
		fields: [shiftHandoff.fromUserId],
		references: [user.id],
		relationName: "handoffFrom",
	}),
	toUser: one(user, {
		fields: [shiftHandoff.toUserId],
		references: [user.id],
		relationName: "handoffTo",
	}),
}));

export const expenseRelations = relations(expense, ({ one }) => ({
	cashSession: one(cashSession, {
		fields: [expense.cashSessionId],
		references: [cashSession.id],
	}),
	authorizedByUser: one(user, {
		fields: [expense.authorizedBy],
		references: [user.id],
		relationName: "expenseAuthorizedBy",
	}),
	createdByUser: one(user, {
		fields: [expense.createdBy],
		references: [user.id],
		relationName: "expenseCreatedBy",
	}),
	organization: one(organization, {
		fields: [expense.organizationId],
		references: [organization.id],
	}),
	supplier: one(supplier, {
		fields: [expense.supplierId],
		references: [supplier.id],
	}),
}));

export const noSaleEventRelations = relations(noSaleEvent, ({ one }) => ({
	cashSession: one(cashSession, {
		fields: [noSaleEvent.cashSessionId],
		references: [cashSession.id],
	}),
	user: one(user, {
		fields: [noSaleEvent.userId],
		references: [user.id],
	}),
}));
