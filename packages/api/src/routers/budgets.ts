import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── budget category schema ──────────────────────────────────────────────

const budgetCategorySchema = z.object({
	category: z.string().min(1),
	budgeted: z.string(),
	alertThreshold: z.number().min(0).max(100),
});

// ── list ───────────────────────────────────────────────────────────────

const list = permissionProcedure("reports.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);

		const budgets = await db
			.select()
			.from(schema.budget)
			.where(eq(schema.budget.organizationId, orgId))
			.orderBy(desc(schema.budget.createdAt));

		return budgets;
	});

// ── getById ────────────────────────────────────────────────────────────

const getById = permissionProcedure("reports.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const rows = await db
			.select()
			.from(schema.budget)
			.where(
				and(
					eq(schema.budget.id, input.id),
					eq(schema.budget.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Budget not found" });
		}

		const budget = rows[0]!;
		const categories =
			(budget.categories as Array<{
				category: string;
				budgeted: string;
				alertThreshold: number;
			}>) ?? [];

		// Query actual spending per category for the budget period
		const actualByCategory = await db
			.select({
				category: schema.expense.category,
				actual: sql<string>`COALESCE(SUM(${schema.expense.amount}), 0)::text`,
			})
			.from(schema.expense)
			.where(
				and(
					eq(schema.expense.organizationId, orgId),
					gte(schema.expense.createdAt, budget.startDate),
					lte(schema.expense.createdAt, budget.endDate),
				),
			)
			.groupBy(schema.expense.category);

		const actualMap = new Map<string, string>(
			actualByCategory
				.filter(
					(r): r is { category: string; actual: string } => r.category !== null,
				)
				.map((r) => [r.category, r.actual]),
		);

		const enrichedCategories = categories.map((cat) => ({
			...cat,
			actual: actualMap.get(cat.category) ?? "0",
		}));

		return {
			...budget,
			categories: enrichedCategories,
		};
	});

// ── create ─────────────────────────────────────────────────────────────

const create = permissionProcedure("reports.create")
	.input(
		z.object({
			name: z.string().min(1),
			period: z.enum(["monthly", "quarterly", "annually"]),
			startDate: z.string(),
			endDate: z.string(),
			categories: z.array(budgetCategorySchema),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const createdBy = context.session.user.id;

		const rows = await db
			.insert(schema.budget)
			.values({
				organizationId: orgId,
				name: input.name,
				period: input.period,
				startDate: new Date(input.startDate),
				endDate: new Date(input.endDate),
				categories: input.categories,
				createdBy,
			})
			.returning();

		return rows[0]!;
	});

// ── update ─────────────────────────────────────────────────────────────

const update = permissionProcedure("reports.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			period: z.enum(["monthly", "quarterly", "annually"]).optional(),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
			status: z.enum(["active", "closed"]).optional(),
			categories: z.array(budgetCategorySchema).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select({ id: schema.budget.id })
			.from(schema.budget)
			.where(
				and(
					eq(schema.budget.id, input.id),
					eq(schema.budget.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Budget not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.period !== undefined) updates.period = input.period;
		if (input.startDate !== undefined)
			updates.startDate = new Date(input.startDate);
		if (input.endDate !== undefined) updates.endDate = new Date(input.endDate);
		if (input.status !== undefined) updates.status = input.status;
		if (input.categories !== undefined) updates.categories = input.categories;

		await db
			.update(schema.budget)
			.set(updates)
			.where(
				and(
					eq(schema.budget.id, input.id),
					eq(schema.budget.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── delete ─────────────────────────────────────────────────────────────

const remove = permissionProcedure("reports.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select({ id: schema.budget.id })
			.from(schema.budget)
			.where(
				and(
					eq(schema.budget.id, input.id),
					eq(schema.budget.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Budget not found" });
		}

		await db
			.delete(schema.budget)
			.where(
				and(
					eq(schema.budget.id, input.id),
					eq(schema.budget.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── getBudgetVsActual ──────────────────────────────────────────────────

const getBudgetVsActual = permissionProcedure("reports.read")
	.input(z.object({ budgetId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const rows = await db
			.select()
			.from(schema.budget)
			.where(
				and(
					eq(schema.budget.id, input.budgetId),
					eq(schema.budget.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Budget not found" });
		}

		const budget = rows[0]!;
		const categories =
			(budget.categories as Array<{
				category: string;
				budgeted: string;
				alertThreshold: number;
			}>) ?? [];

		// Get actual spending per category in the budget period
		const actualByCategory = await db
			.select({
				category: schema.expense.category,
				actual: sql<string>`COALESCE(SUM(${schema.expense.amount}), 0)::text`,
			})
			.from(schema.expense)
			.where(
				and(
					eq(schema.expense.organizationId, orgId),
					gte(schema.expense.createdAt, budget.startDate),
					lte(schema.expense.createdAt, budget.endDate),
				),
			)
			.groupBy(schema.expense.category);

		const actualMap = new Map<string, string>(
			actualByCategory
				.filter(
					(r): r is { category: string; actual: string } => r.category !== null,
				)
				.map((r) => [r.category, r.actual]),
		);

		const result = categories.map((cat) => {
			const budgeted = Number(cat.budgeted);
			const actual = Number(actualMap.get(cat.category) ?? "0");
			const variance = budgeted - actual;
			const percentUsed =
				budgeted > 0 ? Math.round((actual / budgeted) * 10000) / 100 : 0;

			return {
				category: cat.category,
				budgeted: cat.budgeted,
				actual: actual.toFixed(2),
				variance: variance.toFixed(2),
				percentUsed,
			};
		});

		return result;
	});

// ── getCurrentMonthBudgets ─────────────────────────────────────────────
// Compares current-month budget amounts against actual expense totals per category.
// Aggregates all active budgets for the current month across the organization.
const getCurrentMonthBudgets = permissionProcedure("reports.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const now = new Date();
		const year = now
			.toLocaleString("en-CA", {
				timeZone: "America/Guyana",
				year: "numeric",
			})
			.slice(0, 4);
		const mon = now
			.toLocaleString("en-CA", {
				timeZone: "America/Guyana",
				month: "2-digit",
			})
			.slice(-2);
		const month = `${year}-${mon}`;

		const result = await db.execute(sql`
			SELECT
				cat->>'category' as category,
				(cat->>'budgeted')::numeric as budgeted,
				COALESCE(SUM(e.amount), 0)::numeric as actual,
				((cat->>'budgeted')::numeric - COALESCE(SUM(e.amount), 0))::numeric as variance
			FROM budget b,
				jsonb_array_elements(b.categories) as cat
			LEFT JOIN expense e ON e.category = cat->>'category'
				AND e.organization_id = b.organization_id
				AND EXTRACT(YEAR  FROM e.created_at AT TIME ZONE 'America/Guyana') = ${Number(year)}
				AND EXTRACT(MONTH FROM e.created_at AT TIME ZONE 'America/Guyana') = ${Number(mon)}
			WHERE b.organization_id = ${orgId}
				AND b.status = 'active'
			GROUP BY cat->>'category', (cat->>'budgeted')::numeric
			ORDER BY category
		`);

		const rows = result.rows as Array<{
			category: string;
			budgeted: string;
			actual: string;
			variance: string;
		}>;

		const totalBudgeted = rows.reduce((s, r) => s + Number(r.budgeted), 0);
		const totalActual = rows.reduce((s, r) => s + Number(r.actual), 0);

		return {
			rows,
			totalBudgeted: totalBudgeted.toString(),
			totalActual: totalActual.toString(),
			totalVariance: (totalBudgeted - totalActual).toString(),
			month,
		};
	});

// ── router export ──────────────────────────────────────────────────────

export const budgetsRouter = {
	list,
	getById,
	create,
	update,
	delete: remove,
	getBudgetVsActual,
	getCurrentMonthBudgets,
};
