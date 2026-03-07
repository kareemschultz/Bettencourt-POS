import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── getSessions ─────────────────────────────────────────────────────────
const getSessions = permissionProcedure("shifts.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
				status: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = [];
		if (input.locationId) {
			conditions.push(eq(schema.cashSession.locationId, input.locationId));
		}
		if (input.status) {
			conditions.push(eq(schema.cashSession.status, input.status));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const sessions = await db
			.select({
				id: schema.cashSession.id,
				registerId: schema.cashSession.registerId,
				locationId: schema.cashSession.locationId,
				openedBy: schema.cashSession.openedBy,
				openedAt: schema.cashSession.openedAt,
				openingFloat: schema.cashSession.openingFloat,
				closedBy: schema.cashSession.closedBy,
				closedAt: schema.cashSession.closedAt,
				closingCount: schema.cashSession.closingCount,
				expectedCash: schema.cashSession.expectedCash,
				variance: schema.cashSession.variance,
				status: schema.cashSession.status,
				notes: schema.cashSession.notes,
				userName: schema.user.name,
			})
			.from(schema.cashSession)
			.leftJoin(schema.user, eq(schema.cashSession.openedBy, schema.user.id))
			.where(whereClause)
			.orderBy(desc(schema.cashSession.openedAt))
			.limit(50);

		return sessions;
	});

// ── openSession ─────────────────────────────────────────────────────────
const openSession = permissionProcedure("shifts.create")
	.input(
		z.object({
			locationId: z.string().uuid(),
			registerId: z.string().uuid(),
			userId: z.string(),
			openingFloat: z.string().default("0"),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.insert(schema.cashSession)
			.values({
				locationId: input.locationId,
				registerId: input.registerId,
				openedBy: input.userId,
				openingFloat: input.openingFloat,
				status: "open",
			})
			.returning({ id: schema.cashSession.id });

		return { id: rows[0]?.id, status: "open" };
	});

// ── closeSession ────────────────────────────────────────────────────────
const closeSession = permissionProcedure("shifts.update")
	.input(
		z.object({
			sessionId: z.string().uuid(),
			userId: z.string(),
			closingNotes: z.string().nullable().optional(),
			expectedCash: z.string().default("0"),
			actualCash: z.string().default("0"),
		}),
	)
	.handler(async ({ input }) => {
		const variance = Number(input.actualCash) - Number(input.expectedCash);

		await db
			.update(schema.cashSession)
			.set({
				status: "closed",
				closedAt: new Date(),
				closedBy: input.userId,
				closingCount: input.actualCash,
				expectedCash: input.expectedCash,
				variance: variance.toFixed(2),
				notes: input.closingNotes ?? null,
			})
			.where(eq(schema.cashSession.id, input.sessionId));

		return { status: "closed", variance };
	});

// ── createDrop ──────────────────────────────────────────────────────────
const createDrop = permissionProcedure("shifts.create")
	.input(
		z.object({
			cashSessionId: z.string().uuid(),
			amount: z.string(),
			userId: z.string(),
			reason: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const dropRows = await db
			.insert(schema.cashDrop)
			.values({
				cashSessionId: input.cashSessionId,
				amount: input.amount,
				userId: input.userId,
				reason: input.reason ?? null,
			})
			.returning({ id: schema.cashDrop.id });

		return { id: dropRows[0]?.id };
	});

// ── createPayout ────────────────────────────────────────────────────────
const createPayout = permissionProcedure("shifts.create")
	.input(
		z.object({
			cashSessionId: z.string().uuid(),
			amount: z.string(),
			userId: z.string(),
			reason: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const payoutRows = await db
			.insert(schema.cashPayout)
			.values({
				cashSessionId: input.cashSessionId,
				amount: input.amount,
				userId: input.userId,
				reason: input.reason,
			})
			.returning({ id: schema.cashPayout.id });

		return { id: payoutRows[0]?.id };
	});

// ── 7.1 approveVariance ─────────────────────────────────────────────────
const approveVariance = permissionProcedure("shifts.update")
	.input(
		z.object({
			sessionId: z.string().uuid(),
			approvedBy: z.string(),
			reason: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		await db
			.update(schema.cashSession)
			.set({
				varianceApprovedBy: input.approvedBy,
				varianceReason: input.reason,
				varianceApprovedAt: new Date(),
			})
			.where(eq(schema.cashSession.id, input.sessionId));

		return { status: "approved" };
	});

// ── 7.1 getVarianceHistory ──────────────────────────────────────────────
const getVarianceHistory = permissionProcedure("shifts.read")
	.input(
		z
			.object({
				startDate: z.string().optional(),
				endDate: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = [
			sql`${schema.cashSession.status} = 'closed'`,
			sql`${schema.cashSession.variance} IS NOT NULL`,
			sql`${schema.cashSession.variance}::numeric != 0`,
		];

		if (input.startDate) {
			conditions.push(
				sql`${schema.cashSession.closedAt} >= ${input.startDate}::timestamptz`,
			);
		}
		if (input.endDate) {
			conditions.push(
				sql`${schema.cashSession.closedAt} <= ${input.endDate}::timestamptz`,
			);
		}

		const rows = await db
			.select({
				id: schema.cashSession.id,
				openedBy: schema.cashSession.openedBy,
				closedAt: schema.cashSession.closedAt,
				expectedCash: schema.cashSession.expectedCash,
				closingCount: schema.cashSession.closingCount,
				variance: schema.cashSession.variance,
				varianceApprovedBy: schema.cashSession.varianceApprovedBy,
				varianceReason: schema.cashSession.varianceReason,
				varianceApprovedAt: schema.cashSession.varianceApprovedAt,
				userName: schema.user.name,
			})
			.from(schema.cashSession)
			.leftJoin(schema.user, eq(schema.cashSession.openedBy, schema.user.id))
			.where(and(...conditions))
			.orderBy(desc(schema.cashSession.closedAt))
			.limit(100);

		return rows;
	});

// ── 7.1 getReconciliationRules ──────────────────────────────────────────
const getReconciliationRules = permissionProcedure("shifts.read")
	.input(z.object({ organizationId: z.string().uuid() }))
	.handler(async ({ input }) => {
		const rows = await db
			.select()
			.from(schema.cashReconciliationRule)
			.where(
				eq(schema.cashReconciliationRule.organizationId, input.organizationId),
			)
			.limit(1);

		return rows[0] ?? null;
	});

// ── 7.1 updateReconciliationRules ───────────────────────────────────────
const updateReconciliationRules = permissionProcedure("shifts.update")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			maxVarianceAmount: z.string().optional(),
			requirePhotoEvidence: z.boolean().optional(),
			notifyManagers: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select()
			.from(schema.cashReconciliationRule)
			.where(
				eq(schema.cashReconciliationRule.organizationId, input.organizationId),
			)
			.limit(1);

		if (existing.length === 0) {
			const rows = await db
				.insert(schema.cashReconciliationRule)
				.values({
					organizationId: input.organizationId,
					maxVarianceAmount: input.maxVarianceAmount ?? "500",
					requirePhotoEvidence: input.requirePhotoEvidence ?? false,
					notifyManagers: input.notifyManagers ?? true,
				})
				.returning();
			return rows[0]!;
		}

		const updateData: Record<string, unknown> = {};
		if (input.maxVarianceAmount !== undefined)
			updateData.maxVarianceAmount = input.maxVarianceAmount;
		if (input.requirePhotoEvidence !== undefined)
			updateData.requirePhotoEvidence = input.requirePhotoEvidence;
		if (input.notifyManagers !== undefined)
			updateData.notifyManagers = input.notifyManagers;

		const rows = await db
			.update(schema.cashReconciliationRule)
			.set(updateData)
			.where(
				eq(schema.cashReconciliationRule.organizationId, input.organizationId),
			)
			.returning();

		return rows[0]!;
	});

// ── 7.3 initiateHandoff ────────────────────────────────────────────────
const initiateHandoff = permissionProcedure("shifts.create")
	.input(
		z.object({
			cashSessionId: z.string().uuid(),
			fromUserId: z.string(),
			toUserId: z.string(),
			countedAmount: z.string(),
			expectedAmount: z.string(),
			notes: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const variance = Number(input.countedAmount) - Number(input.expectedAmount);

		const rows = await db
			.insert(schema.shiftHandoff)
			.values({
				cashSessionId: input.cashSessionId,
				fromUserId: input.fromUserId,
				toUserId: input.toUserId,
				countedAmount: input.countedAmount,
				expectedAmount: input.expectedAmount,
				variance: variance.toFixed(2),
				status: "pending",
				notes: input.notes ?? null,
			})
			.returning({ id: schema.shiftHandoff.id });

		return { id: rows[0]?.id, status: "pending", variance };
	});

// ── 7.3 acceptHandoff ──────────────────────────────────────────────────
const acceptHandoff = permissionProcedure("shifts.update")
	.input(
		z.object({
			handoffId: z.string().uuid(),
		}),
	)
	.handler(async ({ input }) => {
		await db
			.update(schema.shiftHandoff)
			.set({ status: "accepted" })
			.where(eq(schema.shiftHandoff.id, input.handoffId));

		return { status: "accepted" };
	});

// ── 7.3 getHandoffs ────────────────────────────────────────────────────
const getHandoffs = permissionProcedure("shifts.read")
	.input(
		z
			.object({
				cashSessionId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = [];
		if (input.cashSessionId) {
			conditions.push(
				eq(schema.shiftHandoff.cashSessionId, input.cashSessionId),
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const result = await db.execute(
			sql`SELECT sh.*,
				fu.name as from_user_name,
				tu.name as to_user_name
			FROM shift_handoff sh
			LEFT JOIN "user" fu ON fu.id = sh.from_user_id
			LEFT JOIN "user" tu ON tu.id = sh.to_user_id
			${whereClause ? sql`WHERE ${whereClause}` : sql``}
			ORDER BY sh.created_at DESC
			LIMIT 50`,
		);

		return result.rows;
	});

// ── 7.4 createExpense ──────────────────────────────────────────────────
const createExpense = permissionProcedure("shifts.create")
	.input(
		z.object({
			cashSessionId: z.string().uuid().nullable().optional(),
			amount: z.string(),
			category: z.string(),
			description: z.string(),
			receiptPhotoUrl: z.string().nullable().optional(),
			authorizedBy: z.string(),
			createdBy: z.string(),
			organizationId: z.string().uuid(),
			supplierId: z.string().uuid().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.insert(schema.expense)
			.values({
				cashSessionId: input.cashSessionId ?? null,
				amount: input.amount,
				category: input.category,
				description: input.description,
				receiptPhotoUrl: input.receiptPhotoUrl ?? null,
				authorizedBy: input.authorizedBy,
				createdBy: input.createdBy,
				organizationId: input.organizationId,
				supplierId: input.supplierId ?? null,
			})
			.returning({ id: schema.expense.id });

		return { id: rows[0]?.id };
	});

// ── 7.4 getExpenses ────────────────────────────────────────────────────
const getExpenses = permissionProcedure("shifts.read")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
			supplierId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`SELECT e.*,
				au.name as authorized_by_name,
				cu.name as created_by_name,
				s.name as supplier_name
			FROM expense e
			LEFT JOIN "user" au ON au.id = e.authorized_by
			LEFT JOIN "user" cu ON cu.id = e.created_by
			LEFT JOIN supplier s ON s.id = e.supplier_id
			WHERE e.organization_id = ${input.organizationId}::uuid
				${input.startDate ? sql`AND e.created_at >= ${input.startDate}::timestamptz` : sql``}
				${input.endDate ? sql`AND e.created_at <= ${input.endDate}::timestamptz` : sql``}
				${input.supplierId ? sql`AND e.supplier_id = ${input.supplierId}::uuid` : sql``}
			ORDER BY e.created_at DESC
			LIMIT 200`,
		);

		return result.rows;
	});

// ── 7.4 getExpenseReport ───────────────────────────────────────────────
const getExpenseReport = permissionProcedure("shifts.read")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		// Daily expenses grouped by supplier with totals
		const result = await db.execute(
			sql`SELECT
				COALESCE(s.name, 'Unassigned') as supplier_name,
				e.supplier_id,
				e.category,
				COUNT(*)::int as count,
				SUM(e.amount::numeric)::text as total
			FROM expense e
			LEFT JOIN supplier s ON s.id = e.supplier_id
			WHERE e.organization_id = ${input.organizationId}::uuid
				${input.startDate ? sql`AND e.created_at >= ${input.startDate}::timestamptz` : sql``}
				${input.endDate ? sql`AND e.created_at <= ${input.endDate}::timestamptz` : sql``}
			GROUP BY s.name, e.supplier_id, e.category
			ORDER BY total DESC`,
		);

		const grandTotal = await db.execute(
			sql`SELECT SUM(amount::numeric)::text as total
			FROM expense
			WHERE organization_id = ${input.organizationId}::uuid
				${input.startDate ? sql`AND created_at >= ${input.startDate}::timestamptz` : sql``}
				${input.endDate ? sql`AND created_at <= ${input.endDate}::timestamptz` : sql``}`,
		);

		return {
			bySupplier: result.rows,
			grandTotal: grandTotal.rows[0]?.total ?? "0",
		};
	});

// ── 7.4 getExpenseCategories ────────────────────────────────────────────
const getExpenseCategories = permissionProcedure("shifts.read").handler(
	async () => {
		const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";
		return db
			.select({
				id: schema.expenseCategory.id,
				name: schema.expenseCategory.name,
			})
			.from(schema.expenseCategory)
			.where(eq(schema.expenseCategory.organizationId, DEFAULT_ORG_ID))
			.orderBy(schema.expenseCategory.name);
	},
);

// ── 7.4 createExpenseCategory ───────────────────────────────────────────
const createExpenseCategory = permissionProcedure("shifts.create")
	.input(z.object({ name: z.string().min(1).max(100) }))
	.handler(async ({ input }) => {
		const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";
		const [row] = await db
			.insert(schema.expenseCategory)
			.values({ name: input.name.trim(), organizationId: DEFAULT_ORG_ID })
			.returning();
		return row;
	});

// ── 7.4 deleteExpenseCategory ───────────────────────────────────────────
const deleteExpenseCategory = permissionProcedure("shifts.create")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.expenseCategory)
			.where(eq(schema.expenseCategory.id, input.id));
		return { success: true };
	});

// ── 7.4 updateExpense ──────────────────────────────────────────────────
const updateExpense = permissionProcedure("shifts.create")
	.input(
		z.object({
			expenseId: z.string().uuid(),
			amount: z.string(),
			category: z.string(),
			description: z.string(),
			supplierId: z.string().uuid().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		await db
			.update(schema.expense)
			.set({
				amount: input.amount,
				category: input.category,
				description: input.description,
				supplierId: input.supplierId ?? null,
			})
			.where(eq(schema.expense.id, input.expenseId));

		return { status: "updated" };
	});

// ── 7.4 deleteExpense ──────────────────────────────────────────────────
const deleteExpense = permissionProcedure("shifts.delete")
	.input(z.object({ expenseId: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.expense)
			.where(eq(schema.expense.id, input.expenseId));

		return { status: "deleted" };
	});

// ── 7.7 logNoSale ─────────────────────────────────────────────────────
const logNoSale = permissionProcedure("shifts.create")
	.input(
		z.object({
			cashSessionId: z.string().uuid(),
			userId: z.string(),
			reason: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.insert(schema.noSaleEvent)
			.values({
				cashSessionId: input.cashSessionId,
				userId: input.userId,
				reason: input.reason,
			})
			.returning({ id: schema.noSaleEvent.id });

		return { id: rows[0]?.id };
	});

// ── 7.7 getNoSaleReport ───────────────────────────────────────────────
const getNoSaleReport = permissionProcedure("shifts.read")
	.input(
		z
			.object({
				startDate: z.string().optional(),
				endDate: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const result = await db.execute(
			sql`SELECT
				nse.id, nse.cash_session_id, nse.reason, nse.created_at,
				u.name as user_name, u.id as user_id
			FROM no_sale_event nse
			LEFT JOIN "user" u ON u.id = nse.user_id
			WHERE 1=1
				${input.startDate ? sql`AND nse.created_at >= ${input.startDate}::timestamptz` : sql``}
				${input.endDate ? sql`AND nse.created_at <= ${input.endDate}::timestamptz` : sql``}
			ORDER BY nse.created_at DESC
			LIMIT 200`,
		);

		return result.rows;
	});

export const cashRouter = {
	getSessions,
	openSession,
	closeSession,
	createDrop,
	createPayout,
	// 7.1 Reconciliation
	approveVariance,
	getVarianceHistory,
	getReconciliationRules,
	updateReconciliationRules,
	// 7.3 Shift Handoff
	initiateHandoff,
	acceptHandoff,
	getHandoffs,
	// 7.4 Expense Tracking
	createExpense,
	updateExpense,
	getExpenses,
	getExpenseReport,
	getExpenseCategories,
	createExpenseCategory,
	deleteExpenseCategory,
	deleteExpense,
	// 7.7 No-Sale Drawer Tracking
	logNoSale,
	getNoSaleReport,
};
