import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── getEntries ──────────────────────────────────────────────────────────
// GET production logs for a date, plus running totals per product
const getEntries = permissionProcedure("orders.read")
	.input(
		z
			.object({
				date: z.string().optional(), // YYYY-MM-DD
				locationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const date = input.date || new Date().toISOString().slice(0, 10);

		// Get logs
		const logs = await db
			.select({
				id: schema.productionLog.id,
				productId: schema.productionLog.productId,
				productName: schema.productionLog.productName,
				locationId: schema.productionLog.locationId,
				loggedByUserId: schema.productionLog.loggedByUserId,
				entryType: schema.productionLog.entryType,
				quantity: schema.productionLog.quantity,
				notes: schema.productionLog.notes,
				logDate: schema.productionLog.logDate,
				createdAt: schema.productionLog.createdAt,
				loggedByName: schema.user.name,
			})
			.from(schema.productionLog)
			.leftJoin(
				schema.user,
				eq(schema.productionLog.loggedByUserId, schema.user.id),
			)
			.where(
				and(
					eq(schema.productionLog.logDate, date),
					input.locationId
						? eq(schema.productionLog.locationId, input.locationId)
						: undefined,
				),
			)
			.orderBy(desc(schema.productionLog.createdAt));

		// Running totals per product
		const conditions = [eq(schema.productionLog.logDate, date)];
		if (input.locationId) {
			conditions.push(eq(schema.productionLog.locationId, input.locationId));
		}

		const totals = await db.execute(
			sql`SELECT
				product_id,
				product_name,
				COALESCE(SUM(CASE WHEN entry_type = 'opening' THEN quantity ELSE 0 END), 0) as opening,
				COALESCE(SUM(CASE WHEN entry_type = 'reorder' THEN quantity ELSE 0 END), 0) as reorder,
				COALESCE(SUM(CASE WHEN entry_type = 'closing' THEN quantity ELSE 0 END), 0) as closing
			FROM production_log
			WHERE log_date = ${date}
			${input.locationId ? sql`AND location_id = ${input.locationId}` : sql``}
			GROUP BY product_id, product_name
			ORDER BY product_name`,
		);

		return { logs, totals: totals.rows, date };
	});

// ── createEntry ─────────────────────────────────────────────────────────
const createEntry = permissionProcedure("orders.update")
	.input(
		z.object({
			productId: z.string().uuid(),
			productName: z.string(),
			locationId: z.string().uuid().nullable().optional(),
			loggedByUserId: z.string().nullable().optional(),
			entryType: z.enum(["opening", "reorder", "closing"]),
			workflow: z.string().optional(),
			quantity: z.number().int(),
			notes: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const [row] = await db
			.insert(schema.productionLog)
			.values({
				productId: input.productId,
				productName: input.productName,
				locationId: input.locationId ?? null,
				loggedByUserId: input.loggedByUserId ?? null,
				entryType: input.entryType,
				workflow: input.workflow ?? null,
				quantity: input.quantity,
				notes: input.notes ?? null,
			})
			.returning();

		return row;
	});

// ── getReconciliation ───────────────────────────────────────────────────
// Production vs POS sales comparison per product
const getReconciliation = permissionProcedure("reports.read")
	.input(
		z.object({
			date: z.string().optional(),
			locationId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const date = input.date || new Date().toISOString().slice(0, 10);

		// Production totals per product
		const production = await db.execute(
			sql`SELECT
				product_id,
				product_name,
				COALESCE(SUM(CASE WHEN entry_type = 'opening' THEN quantity ELSE 0 END), 0)::int as opened,
				COALESCE(SUM(CASE WHEN entry_type = 'reorder' THEN quantity ELSE 0 END), 0)::int as reordered,
				COALESCE(SUM(CASE WHEN entry_type IN ('opening','reorder') THEN quantity ELSE 0 END), 0)::int as total_produced,
				COALESCE(SUM(CASE WHEN entry_type = 'closing' THEN quantity ELSE 0 END), 0)::int as closing_stock
			FROM production_log
			WHERE log_date = ${date}
			${input.locationId ? sql`AND location_id = ${input.locationId}` : sql``}
			GROUP BY product_id, product_name`,
		);

		// POS sales per product for the same date
		const sales = await db.execute(
			sql`SELECT
				oli.product_id,
				COALESCE(SUM(oli.quantity), 0)::int as actual_sold
			FROM order_line_item oli
			JOIN "order" o ON o.id = oli.order_id
			WHERE o.status = 'completed'
				AND DATE(o.created_at) = ${date}
			${input.locationId ? sql`AND o.location_id = ${input.locationId}` : sql``}
			GROUP BY oli.product_id`,
		);

		const salesMap = new Map(
			sales.rows.map((s: Record<string, unknown>) => [
				s.product_id as string,
				Number(s.actual_sold),
			]),
		);

		const reconciliation = production.rows.map((p: Record<string, unknown>) => {
			const expectedSold = Number(p.total_produced) - Number(p.closing_stock);
			const actualSold = salesMap.get(p.product_id as string) || 0;
			const variance = actualSold - expectedSold;
			return {
				productId: p.product_id,
				productName: p.product_name,
				opened: Number(p.opened),
				reordered: Number(p.reordered),
				totalProduced: Number(p.total_produced),
				closingStock: Number(p.closing_stock),
				expectedSold,
				actualSold,
				variance,
				status:
					variance === 0
						? "match"
						: Math.abs(variance) <= 2
							? "minor"
							: "discrepancy",
			};
		});

		return { reconciliation, date };
	});

// ── getReport ───────────────────────────────────────────────────────────
const getReport = permissionProcedure("reports.read")
	.input(
		z.object({
			date: z.string(),
			workflow: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

		const conditions: ReturnType<typeof eq>[] = [
			eq(schema.productionLog.logDate, input.date),
		];
		if (input.workflow) {
			conditions.push(eq(schema.productionLog.workflow, input.workflow));
		}

		const entries = await db
			.select({
				productId: schema.productionLog.productId,
				productName: schema.productionLog.productName,
				entryType: schema.productionLog.entryType,
				quantity: schema.productionLog.quantity,
			})
			.from(schema.productionLog)
			.where(and(...conditions));

		const byProduct = new Map<
			string,
			{ name: string; opening: number; reorder: number; closing: number }
		>();
		for (const e of entries) {
			const key = e.productId ?? e.productName;
			const cur = byProduct.get(key) ?? {
				name: e.productName,
				opening: 0,
				reorder: 0,
				closing: 0,
			};
			if (e.entryType === "opening") cur.opening += e.quantity;
			if (e.entryType === "reorder") cur.reorder += e.quantity;
			if (e.entryType === "closing") cur.closing += e.quantity;
			byProduct.set(key, cur);
		}

		// Get actual sold from completed orders on that date (Guyana is UTC-4)
		const dateStart = new Date(`${input.date}T00:00:00-04:00`);
		const dateEnd = new Date(`${input.date}T23:59:59-04:00`);

		const soldItems = await db
			.select({
				productId: schema.orderLineItem.productId,
				productName: schema.orderLineItem.productNameSnapshot,
				quantity: schema.orderLineItem.quantity,
			})
			.from(schema.orderLineItem)
			.innerJoin(
				schema.order,
				eq(schema.orderLineItem.orderId, schema.order.id),
			)
			.where(
				and(
					eq(schema.order.organizationId, DEFAULT_ORG_ID),
					eq(schema.order.status, "completed"),
					gte(schema.order.createdAt, dateStart),
					lte(schema.order.createdAt, dateEnd),
					eq(schema.orderLineItem.voided, false),
				),
			);

		const actualByProduct = new Map<string, number>();
		for (const s of soldItems) {
			const key = s.productId ?? s.productName;
			actualByProduct.set(key, (actualByProduct.get(key) ?? 0) + s.quantity);
		}

		const rows = Array.from(byProduct.entries()).map(([key, v]) => {
			const expected = v.opening + v.reorder - v.closing;
			const actual = actualByProduct.get(key) ?? 0;
			return {
				productId: key,
				productName: v.name,
				opening: v.opening,
				reorder: v.reorder,
				closing: v.closing,
				expected,
				actual,
				variance: actual - expected,
			};
		});

		return { rows, date: input.date };
	});

export const productionRouter = {
	getEntries,
	createEntry,
	getReconciliation,
	getReport,
};
