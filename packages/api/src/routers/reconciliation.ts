import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── getDailyReconciliation ──────────────────────────────────────────────
// Aggregates all daily reconciliation data:
// sales vs payments, cash vs expected, production vs actual
const getDailyReconciliation = permissionProcedure("reports.read")
	.input(
		z
			.object({
				date: z.string().optional(), // YYYY-MM-DD
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const date = input.date || new Date().toISOString().slice(0, 10);

		// 1. POS Sales Total vs Payment Receipts Total
		const salesResult = await db.execute(
			sql`SELECT
				COUNT(*)::int as order_count,
				COALESCE(SUM(total), 0)::numeric as total_sales,
				COALESCE(SUM(subtotal), 0)::numeric as total_subtotal,
				COALESCE(SUM(tax_total), 0)::numeric as total_tax,
				COALESCE(SUM(discount_total), 0)::numeric as total_discount,
				COALESCE(SUM(CASE WHEN status = 'voided' THEN total ELSE 0 END), 0)::numeric as voided_total,
				COUNT(CASE WHEN status = 'voided' THEN 1 END)::int as void_count
			FROM "order"
			WHERE DATE(created_at) = ${date} AND status IN ('completed', 'voided')`,
		);
		const salesRow = salesResult.rows[0] as Record<string, unknown>;

		const paymentsResult = await db.execute(
			sql`SELECT
				COALESCE(SUM(CASE WHEN p.method = 'cash' AND p.status = 'completed' THEN p.amount ELSE 0 END), 0)::numeric as cash_total,
				COALESCE(SUM(CASE WHEN p.method = 'card' AND p.status = 'completed' THEN p.amount ELSE 0 END), 0)::numeric as card_total,
				COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)::numeric as payment_total
			FROM payment p
			JOIN "order" o ON o.id = p.order_id
			WHERE DATE(o.created_at) = ${date}`,
		);
		const paymentsRow = paymentsResult.rows[0] as Record<string, unknown>;

		const salesVsPayments = {
			totalSales: Number(salesRow.total_sales),
			paymentTotal: Number(paymentsRow.payment_total),
			cashTotal: Number(paymentsRow.cash_total),
			cardTotal: Number(paymentsRow.card_total),
			variance:
				Number(paymentsRow.payment_total) - Number(salesRow.total_sales),
			orderCount: Number(salesRow.order_count),
			voidCount: Number(salesRow.void_count),
			voidedTotal: Number(salesRow.voided_total),
		};

		// 2. Cash Sessions -- drawer vs expected
		const cashSessionsResult = await db.execute(
			sql`SELECT
				cs.id,
				r.name as register_name,
				cs.opening_float::numeric,
				cs.closing_count::numeric,
				cs.expected_cash::numeric,
				cs.variance::numeric,
				cs.status,
				u.name as opened_by_name,
				cs.opened_at,
				cs.closed_at
			FROM cash_session cs
			JOIN register r ON r.id = cs.register_id
			LEFT JOIN "user" u ON u.id = cs.opened_by
			WHERE DATE(cs.opened_at) = ${date}
			ORDER BY cs.opened_at`,
		);

		// 3. Department cross-check
		const departmentResult = await db.execute(
			sql`SELECT
				COALESCE(oli.reporting_category_snapshot, 'Uncategorized') as department,
				COUNT(DISTINCT o.id)::int as order_count,
				COALESCE(SUM(oli.total), 0)::numeric as line_item_total
			FROM order_line_item oli
			JOIN "order" o ON o.id = oli.order_id
			WHERE DATE(o.created_at) = ${date} AND o.status = 'completed'
			GROUP BY oli.reporting_category_snapshot
			ORDER BY line_item_total DESC`,
		);

		// 4. Void/Refund summary
		const voidResult = await db.execute(
			sql`SELECT
				u.name as user_name,
				COUNT(*)::int as void_count,
				COALESCE(SUM(o.total), 0)::numeric as voided_total
			FROM "order" o
			LEFT JOIN "user" u ON u.id = o.user_id
			WHERE DATE(o.created_at) = ${date} AND o.status = 'voided'
			GROUP BY u.name
			ORDER BY void_count DESC`,
		);

		// 5. Production vs sales
		const productionResult = await db.execute(
			sql`SELECT
				pl.product_id, pl.product_name,
				COALESCE(SUM(CASE WHEN pl.entry_type IN ('opening','reorder') THEN pl.quantity ELSE 0 END), 0)::int as produced,
				COALESCE(SUM(CASE WHEN pl.entry_type = 'closing' THEN pl.quantity ELSE 0 END), 0)::int as closing_stock
			FROM production_log pl
			WHERE pl.log_date = ${date}
			GROUP BY pl.product_id, pl.product_name`,
		);

		let productionVsSales: Array<Record<string, unknown>> = [];
		if (productionResult.rows.length > 0) {
			const productIds = productionResult.rows.map(
				(p: Record<string, unknown>) => p.product_id as string,
			);

			const actualSalesRows = await db
				.select({
					productId: schema.orderLineItem.productId,
					actualSold:
						sql<number>`COALESCE(SUM(${schema.orderLineItem.quantity}), 0)::int`.as(
							"actual_sold",
						),
				})
				.from(schema.orderLineItem)
				.innerJoin(
					schema.order,
					eq(schema.orderLineItem.orderId, schema.order.id),
				)
				.where(
					and(
						sql`DATE(${schema.order.createdAt}) = ${date}`,
						eq(schema.order.status, "completed"),
						inArray(schema.orderLineItem.productId, productIds),
					),
				)
				.groupBy(schema.orderLineItem.productId);

			const salesMap = new Map(
				actualSalesRows.map((s) => [
					s.productId as string,
					Number(s.actualSold),
				]),
			);

			productionVsSales = productionResult.rows.map(
				(p: Record<string, unknown>) => {
					const expectedSold = Number(p.produced) - Number(p.closing_stock);
					const actualSold = salesMap.get(p.product_id as string) || 0;
					return {
						productName: p.product_name,
						produced: Number(p.produced),
						closingStock: Number(p.closing_stock),
						expectedSold,
						actualSold,
						variance: actualSold - expectedSold,
					};
				},
			);
		}

		return {
			date,
			salesVsPayments,
			cashSessions: cashSessionsResult.rows,
			departmentTotals: departmentResult.rows,
			voidSummary: voidResult.rows,
			productionVsSales,
		};
	});

export const reconciliationRouter = {
	getDailyReconciliation,
};
