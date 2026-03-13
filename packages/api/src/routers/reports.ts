import { db } from "@Bettencourt-POS/db";
import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── getReport ───────────────────────────────────────────────────────────
// Handles multiple report types via the `type` input param
const getReport = permissionProcedure("reports.read")
	.input(
		z.object({
			type: z
				.enum([
					"summary",
					"sales-by-day",
					"department-totals",
					"product-sales",
					"cashier-activity",
					"sales-by-payment",
					"hourly-sales",
					"z-report",
					"voids",
					"production",
					"weekly-trend",
					"tips",
					"customer_analytics",
				])
				.default("summary"),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const startDate =
			input.startDate ||
			new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const endDate = input.endDate || new Date().toISOString();

		if (input.type === "summary") {
			const result = await db.execute(
				sql`SELECT
					COUNT(*) as total_orders,
					COALESCE(SUM(total), 0) as gross_revenue,
					COALESCE(SUM(discount_total), 0) as total_discounts,
					COALESCE(SUM(tax_total), 0) as total_tax,
					COALESCE(SUM(total), 0) as net_revenue,
					COALESCE(AVG(total), 0) as avg_order_value
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz`,
			);
			return result.rows[0];
		}

		if (input.type === "sales-by-day") {
			const result = await db.execute(
				sql`SELECT
					DATE(o.created_at) as date,
					COUNT(*) as orders,
					COALESCE(SUM(o.total), 0) as revenue
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY DATE(o.created_at)
				ORDER BY date ASC`,
			);
			return result.rows;
		}

		if (input.type === "department-totals") {
			const result = await db.execute(
				sql`SELECT
					oli.reporting_category_snapshot as department,
					COUNT(DISTINCT o.id) as order_count,
					SUM(oli.quantity) as items_sold,
					COALESCE(SUM(oli.total), 0) as revenue
				FROM order_line_item oli
				JOIN "order" o ON oli.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
					AND oli.voided = false
				AND oli.is_component = false
				GROUP BY oli.reporting_category_snapshot
				ORDER BY oli.reporting_category_snapshot ASC`,
			);
			return result.rows;
		}

		if (input.type === "product-sales") {
			const result = await db.execute(
				sql`SELECT
					oli.product_name_snapshot as product_name,
					oli.reporting_category_snapshot as department,
					SUM(oli.quantity) as quantity_sold,
					COALESCE(SUM(oli.total), 0) as revenue
				FROM order_line_item oli
				JOIN "order" o ON oli.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
					AND oli.voided = false
				AND oli.is_component = false
				GROUP BY oli.product_name_snapshot, oli.reporting_category_snapshot
				ORDER BY oli.product_name_snapshot ASC`,
			);
			return result.rows;
		}

		if (input.type === "cashier-activity") {
			const result = await db.execute(
				sql`SELECT
					COALESCE(u.name, 'Unknown') as cashier_name,
					o.user_id,
					COUNT(*) as orders_processed,
					COALESCE(SUM(o.total), 0) as total_revenue
				FROM "order" o
				LEFT JOIN "user" u ON o.user_id = u.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY u.name, o.user_id
				ORDER BY total_revenue DESC`,
			);
			return result.rows;
		}

		if (input.type === "sales-by-payment") {
			const result = await db.execute(
				sql`SELECT
					p.method,
					COUNT(*) as payment_count,
					COALESCE(SUM(p.amount), 0) as total_amount
				FROM payment p
				JOIN "order" o ON p.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY p.method
				ORDER BY total_amount DESC`,
			);
			return result.rows;
		}

		if (input.type === "hourly-sales") {
			const result = await db.execute(
				sql`SELECT
					EXTRACT(HOUR FROM o.created_at) as hour,
					COUNT(*) as orders,
					COALESCE(SUM(o.total), 0) as revenue
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY EXTRACT(HOUR FROM o.created_at)
				ORDER BY hour ASC`,
			);
			return result.rows;
		}

		if (input.type === "z-report") {
			const [
				summaryResult,
				productSalesResult,
				deptTotalsResult,
				cashierResult,
				paymentResult,
			] = await Promise.all([
				db.execute(
					sql`SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as grand_total
						FROM "order"
						WHERE status IN ('completed', 'closed')
							AND created_at >= ${startDate}::timestamptz
							AND created_at <= ${endDate}::timestamptz`,
				),
				db.execute(
					sql`SELECT oli.product_name_snapshot as product_name,
							oli.reporting_category_snapshot as department,
							SUM(oli.quantity) as qty,
							COALESCE(SUM(oli.total), 0) as revenue
						FROM order_line_item oli
						JOIN "order" o ON oli.order_id = o.id
						WHERE o.status IN ('completed', 'closed')
							AND o.created_at >= ${startDate}::timestamptz
							AND o.created_at <= ${endDate}::timestamptz
							AND oli.voided = false
							AND oli.is_component = false
						GROUP BY oli.product_name_snapshot, oli.reporting_category_snapshot
						ORDER BY oli.product_name_snapshot ASC`,
				),
				db.execute(
					sql`SELECT oli.reporting_category_snapshot as department,
							COALESCE(SUM(oli.total), 0) as revenue
						FROM order_line_item oli
						JOIN "order" o ON oli.order_id = o.id
						WHERE o.status IN ('completed', 'closed')
							AND o.created_at >= ${startDate}::timestamptz
							AND o.created_at <= ${endDate}::timestamptz
							AND oli.voided = false
							AND oli.is_component = false
						GROUP BY oli.reporting_category_snapshot
						ORDER BY oli.reporting_category_snapshot ASC`,
				),
				db.execute(
					sql`SELECT COALESCE(u.name, 'Unknown') as cashier_name,
							COUNT(*) as orders_processed,
							COALESCE(SUM(o.total), 0) as total_revenue
						FROM "order" o
						LEFT JOIN "user" u ON o.user_id = u.id
						WHERE o.status IN ('completed', 'closed')
							AND o.created_at >= ${startDate}::timestamptz
							AND o.created_at <= ${endDate}::timestamptz
						GROUP BY u.name
						ORDER BY total_revenue DESC`,
				),
				db.execute(
					sql`SELECT p.method, COALESCE(SUM(p.amount), 0) as total_amount
						FROM payment p
						JOIN "order" o ON p.order_id = o.id
						WHERE o.status IN ('completed', 'closed')
							AND o.created_at >= ${startDate}::timestamptz
							AND o.created_at <= ${endDate}::timestamptz
						GROUP BY p.method`,
				),
			]);

			return {
				summary: summaryResult.rows[0],
				productSales: productSalesResult.rows,
				departmentTotals: deptTotalsResult.rows,
				cashierActivity: cashierResult.rows,
				paymentBreakdown: paymentResult.rows,
			};
		}


		if (input.type === "tips") {
			const summaryResult = await db.execute(
				sql`SELECT
					COALESCE(SUM(o.tip_amount), 0)::numeric as total_tips,
					COALESCE(AVG(CASE WHEN o.tip_amount > 0 THEN o.tip_amount END), 0)::numeric as avg_tip,
					COUNT(*) FILTER (WHERE o.tip_amount > 0)::int as tipped_orders,
					COUNT(*)::int as total_orders,
					COALESCE(SUM(o.total), 0)::numeric as total_revenue
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz`,
			);

			const byEmployeeResult = await db.execute(
				sql`SELECT
					COALESCE(u.name, 'Unknown') as employee_name,
					o.user_id,
					COALESCE(SUM(o.tip_amount), 0)::numeric as tips_earned,
					COUNT(*) FILTER (WHERE o.tip_amount > 0)::int as tipped_orders,
					COUNT(*)::int as total_orders,
					COALESCE(AVG(CASE WHEN o.tip_amount > 0 THEN o.tip_amount END), 0)::numeric as avg_tip
				FROM "order" o
				LEFT JOIN "user" u ON o.user_id = u.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY u.name, o.user_id
				ORDER BY tips_earned DESC`,
			);

			const byMethodResult = await db.execute(
				sql`SELECT
					p.method,
					COALESCE(SUM(p.tip_amount), 0)::numeric as tips_total,
					COUNT(*) FILTER (WHERE p.tip_amount::numeric > 0)::int as tip_count
				FROM payment p
				INNER JOIN "order" o ON p.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY p.method
				ORDER BY tips_total DESC`,
			);

			return {
				summary: summaryResult.rows[0],
				byEmployee: byEmployeeResult.rows,
				byMethod: byMethodResult.rows,
			};
		}

		if (input.type === "voids") {
			const summaryResult = await db.execute(
				sql`SELECT
					COALESCE(u.name, 'Unknown') as user_name,
					o.user_id,
					COUNT(*)::int as void_count,
					COALESCE(SUM(o.total), 0)::numeric as voided_total,
					MAX(o.created_at) as last_void_at
				FROM "order" o
				LEFT JOIN "user" u ON u.id = o.user_id
				WHERE o.status IN ('voided', 'refunded')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY u.name, o.user_id
				ORDER BY void_count DESC`,
			);

			const detailsResult = await db.execute(
				sql`SELECT o.order_number, o.total, o.status, o.created_at, o.notes,
					COALESCE(u.name, 'Unknown') as user_name
				FROM "order" o
				LEFT JOIN "user" u ON u.id = o.user_id
				WHERE o.status IN ('voided', 'refunded')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				ORDER BY o.created_at DESC
				LIMIT 50`,
			);

			return {
				summary: summaryResult.rows,
				details: detailsResult.rows,
			};
		}

		if (input.type === "production") {
			const productionResult = await db.execute(
				sql`SELECT
					pl.product_id, pl.product_name,
					COALESCE(SUM(CASE WHEN pl.entry_type IN ('opening','reorder') THEN pl.quantity ELSE 0 END), 0)::int as produced,
					COALESCE(SUM(CASE WHEN pl.entry_type = 'closing' THEN pl.quantity ELSE 0 END), 0)::int as closing_stock
				FROM production_log pl
				WHERE pl.log_date >= ${startDate}::date AND pl.log_date <= ${endDate}::date
				GROUP BY pl.product_id, pl.product_name`,
			);

			const salesResult = await db.execute(
				sql`SELECT oli.product_id, COALESCE(SUM(oli.quantity), 0)::int as actual_sold
				FROM order_line_item oli
				JOIN "order" o ON o.id = oli.order_id
				WHERE o.status = 'completed'
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY oli.product_id`,
			);

			const salesMap = new Map(
				salesResult.rows.map((s: Record<string, unknown>) => [
					s.product_id as string,
					Number(s.actual_sold),
				]),
			);

			return productionResult.rows.map((p: Record<string, unknown>) => {
				const expected = Number(p.produced) - Number(p.closing_stock);
				const actual = salesMap.get(p.product_id as string) || 0;
				return {
					...p,
					expectedSold: expected,
					actualSold: actual,
					variance: actual - expected,
				};
			});
		}

		if (input.type === "weekly-trend") {
			const result = await db.execute(
				sql`SELECT
					DATE(o.created_at) as date,
					COUNT(*)::int as orders,
					COALESCE(SUM(o.total), 0)::numeric as revenue
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY DATE(o.created_at)
				ORDER BY date ASC`,
			);
			return result.rows;
		}


		if (input.type === "customer_analytics") {
			// KPI summary
			const kpiResult = await db.execute(
				sql`SELECT
					COUNT(*)::int as total_customers,
					COUNT(*) FILTER (WHERE c.created_at >= ${startDate}::timestamptz AND c.created_at <= ${endDate}::timestamptz)::int as new_customers,
					COALESCE(AVG(c.visit_count), 0)::numeric as avg_visits,
					COALESCE(AVG(c.total_spent), 0)::numeric as avg_lifetime_spend,
					COALESCE(SUM(c.total_spent), 0)::numeric as total_revenue_from_customers,
					COUNT(*) FILTER (WHERE c.visit_count > 1)::int as returning_customers
				FROM customer c`,
			);

			// Top customers by spend
			const topBySpendResult = await db.execute(
				sql`SELECT c.id, c.name, c.phone, c.email,
					c.total_spent::numeric, c.visit_count::int,
					c.last_visit_at,
					CASE WHEN c.visit_count > 0 THEN (c.total_spent / c.visit_count)::numeric ELSE 0 END as avg_order_value
				FROM customer c
				WHERE c.total_spent > 0
				ORDER BY c.total_spent DESC
				LIMIT 20`,
			);

			// Top customers by visit count
			const topByVisitsResult = await db.execute(
				sql`SELECT c.id, c.name, c.phone, c.email,
					c.total_spent::numeric, c.visit_count::int,
					c.last_visit_at,
					CASE WHEN c.visit_count > 0 THEN (c.total_spent / c.visit_count)::numeric ELSE 0 END as avg_order_value
				FROM customer c
				WHERE c.visit_count > 0
				ORDER BY c.visit_count DESC
				LIMIT 20`,
			);

			// Orders per day trend (new vs returning)
			const trendResult = await db.execute(
				sql`SELECT
					DATE(o.created_at) as date,
					COUNT(DISTINCT o.customer_id) FILTER (WHERE c.visit_count <= 1)::int as new_customers,
					COUNT(DISTINCT o.customer_id) FILTER (WHERE c.visit_count > 1)::int as returning_customers,
					COUNT(*)::int as total_orders,
					COALESCE(SUM(o.total), 0)::numeric as revenue
				FROM "order" o
				LEFT JOIN customer c ON c.id = o.customer_id
				WHERE o.status IN ('completed', 'closed')
					AND o.customer_id IS NOT NULL
					AND o.created_at >= ${startDate}::timestamptz
					AND o.created_at <= ${endDate}::timestamptz
				GROUP BY DATE(o.created_at)
				ORDER BY date ASC`,
			);

			// Spend distribution buckets
			const distributionResult = await db.execute(
				sql`SELECT
					CASE
						WHEN c.total_spent < 5000 THEN 'Under K'
						WHEN c.total_spent < 20000 THEN 'K-0K'
						WHEN c.total_spent < 50000 THEN '0K-0K'
						WHEN c.total_spent < 100000 THEN '0K-00K'
						ELSE '00K+'
					END as bucket,
					COUNT(*)::int as count,
					COALESCE(SUM(c.total_spent), 0)::numeric as total_spend
				FROM customer c
				WHERE c.total_spent > 0
				GROUP BY bucket
				ORDER BY MIN(c.total_spent) ASC`,
			);

			return {
				kpi: kpiResult.rows[0],
				topBySpend: topBySpendResult.rows,
				topByVisits: topByVisitsResult.rows,
				trend: trendResult.rows,
				spendDistribution: distributionResult.rows,
			};
		}

		throw new ORPCError("BAD_REQUEST", {
			message: "Unknown report type",
		});
	});

// ── getEodReport ─────────────────────────────────────────────────────
// End-of-Day report aggregating all business metrics for a single day.
const getEodReport = permissionProcedure("reports.read")
	.input(z.object({ date: z.string() }))
	.handler(async ({ input }) => {
		const dayStart = `${input.date}T00:00:00`;
		const dayEnd = `${input.date}T23:59:59`;

		const [
			salesResult,
			paymentResult,
			cashResult,
			voidsResult,
			topProductsResult,
			departmentResult,
			laborResult,
			expensesResult,
			productionResult,
			productionSalesResult,
		] = await Promise.all([
			// Sales summary
			db.execute(
				sql`SELECT
					COUNT(*)::int as order_count,
					COALESCE(SUM(total), 0)::numeric as total_revenue,
					COALESCE(AVG(total), 0)::numeric as avg_ticket,
					COALESCE(SUM(tax_total), 0)::numeric as total_tax,
					COALESCE(SUM(discount_total), 0)::numeric as total_discounts
				FROM "order"
				WHERE status IN ('completed', 'closed')
					AND created_at >= ${dayStart}::timestamptz
					AND created_at <= ${dayEnd}::timestamptz`,
			),

			// Payment breakdown
			db.execute(
				sql`SELECT
					p.method,
					COUNT(*)::int as count,
					COALESCE(SUM(p.amount), 0)::numeric as total
				FROM payment p
				JOIN "order" o ON p.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${dayStart}::timestamptz
					AND o.created_at <= ${dayEnd}::timestamptz
				GROUP BY p.method
				ORDER BY total DESC`,
			),

			// Cash drawer
			db.execute(
				sql`SELECT
					cs.id,
					cs.opening_float,
					cs.closing_count,
					cs.expected_cash,
					cs.variance,
					cs.status,
					COALESCE(u.name, 'Unknown') as opened_by_name,
					cs.opened_at,
					cs.closed_at
				FROM cash_session cs
				LEFT JOIN "user" u ON u.id = cs.opened_by
				WHERE cs.opened_at >= ${dayStart}::timestamptz
					AND cs.opened_at <= ${dayEnd}::timestamptz
				ORDER BY cs.opened_at DESC`,
			),

			// Voids & refunds
			db.execute(
				sql`SELECT
					COALESCE(u.name, 'Unknown') as user_name,
					COUNT(*)::int as void_count,
					COALESCE(SUM(o.total), 0)::numeric as voided_total
				FROM "order" o
				LEFT JOIN "user" u ON u.id = o.user_id
				WHERE o.status IN ('voided', 'refunded')
					AND o.created_at >= ${dayStart}::timestamptz
					AND o.created_at <= ${dayEnd}::timestamptz
				GROUP BY u.name
				ORDER BY void_count DESC`,
			),

			// Top 10 products
			db.execute(
				sql`SELECT
					oli.product_name_snapshot as product_name,
					SUM(oli.quantity)::int as qty_sold,
					COALESCE(SUM(oli.total), 0)::numeric as revenue
				FROM order_line_item oli
				JOIN "order" o ON oli.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${dayStart}::timestamptz
					AND o.created_at <= ${dayEnd}::timestamptz
					AND oli.voided = false
					AND oli.is_component = false
				GROUP BY oli.product_name_snapshot
				ORDER BY qty_sold DESC
				LIMIT 10`,
			),

			// Department breakdown
			db.execute(
				sql`SELECT
					COALESCE(oli.reporting_category_snapshot, 'Uncategorized') as department,
					COUNT(DISTINCT o.id)::int as order_count,
					COALESCE(SUM(oli.total), 0)::numeric as revenue
				FROM order_line_item oli
				JOIN "order" o ON oli.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${dayStart}::timestamptz
					AND o.created_at <= ${dayEnd}::timestamptz
					AND oli.voided = false
					AND oli.is_component = false
				GROUP BY oli.reporting_category_snapshot
				ORDER BY revenue DESC`,
			),

			// Labor summary from time_entry
			db.execute(
				sql`SELECT
					u.name as employee_name,
					COUNT(*)::int as shift_count,
					COALESCE(SUM(
						EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
						- CAST(te.break_minutes AS numeric) / 60
					), 0)::numeric(10,2) as net_hours
				FROM time_entry te
				LEFT JOIN "user" u ON u.id = te.user_id
				WHERE te.clock_in >= ${dayStart}::timestamptz
					AND te.clock_in <= ${dayEnd}::timestamptz
				GROUP BY u.name
				ORDER BY net_hours DESC`,
			),

			// Expenses for the day by category
			db.execute(
				sql`SELECT
					COALESCE(category, 'Uncategorized') as category,
					COALESCE(SUM(amount::numeric), 0)::numeric as total,
					COUNT(*)::int as count
				FROM expense
				WHERE created_at >= ${dayStart}::timestamptz
					AND created_at <= ${dayEnd}::timestamptz
				GROUP BY category
				ORDER BY total DESC`,
			),

			// Production for the day (opening + reorder vs closing)
			db.execute(
				sql`SELECT
					pl.product_name,
					COALESCE(SUM(CASE WHEN pl.entry_type IN ('opening','reorder') THEN pl.quantity ELSE 0 END), 0)::int as produced,
					COALESCE(SUM(CASE WHEN pl.entry_type = 'closing' THEN pl.quantity ELSE 0 END), 0)::int as closing_stock
				FROM production_log pl
				WHERE pl.log_date = ${input.date}::date
				GROUP BY pl.product_name
				ORDER BY produced DESC`,
			),

			// Actual sales for production products today
			db.execute(
				sql`SELECT
					oli.product_name_snapshot as product_name,
					COALESCE(SUM(oli.quantity), 0)::int as actual_sold
				FROM order_line_item oli
				JOIN "order" o ON o.id = oli.order_id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${dayStart}::timestamptz
					AND o.created_at <= ${dayEnd}::timestamptz
					AND oli.voided = false
				GROUP BY oli.product_name_snapshot`,
			),
		]);

		// Build production vs sales map
		const salesByProduct = new Map(
			productionSalesResult.rows.map((r: Record<string, unknown>) => [
				String(r.product_name),
				Number(r.actual_sold),
			]),
		);
		const productionVsSales = productionResult.rows.map(
			(p: Record<string, unknown>) => {
				const expected = Number(p.produced) - Number(p.closing_stock);
				const actual = salesByProduct.get(String(p.product_name)) ?? 0;
				return {
					product_name: String(p.product_name),
					produced: Number(p.produced),
					closing_stock: Number(p.closing_stock),
					expected_sold: expected,
					actual_sold: actual,
					variance: actual - expected,
				};
			},
		);

		const totalExpenses = expensesResult.rows.reduce(
			(s: number, r: Record<string, unknown>) => s + Number(r.total),
			0,
		);

		return {
			date: input.date,
			sales: salesResult.rows[0] ?? {
				order_count: 0,
				total_revenue: 0,
				avg_ticket: 0,
				total_tax: 0,
				total_discounts: 0,
			},
			payments: paymentResult.rows,
			cashSessions: cashResult.rows,
			voids: voidsResult.rows,
			topProducts: topProductsResult.rows,
			departments: departmentResult.rows,
			labor: laborResult.rows,
			expenses: expensesResult.rows,
			totalExpenses,
			productionVsSales,
		};
	});

// ── 7.6 getCOGS ─────────────────────────────────────────────────────────
// Cost of goods sold for a date range, using product.cost snapshot.
const getCOGS = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`SELECT
				COALESCE(SUM(
					oli.quantity * COALESCE(p.cost, 0)::numeric
				), 0)::numeric as total_cogs,
				COALESCE(SUM(oli.total), 0)::numeric as total_revenue,
				CASE
					WHEN COALESCE(SUM(oli.total), 0) = 0 THEN 0
					ELSE ROUND(
						(COALESCE(SUM(oli.total), 0) - COALESCE(SUM(oli.quantity * COALESCE(p.cost, 0)::numeric), 0))
						/ COALESCE(SUM(oli.total), 0) * 100,
						2
					)
				END as gross_margin_pct
			FROM order_line_item oli
			JOIN "order" o ON o.id = oli.order_id
			LEFT JOIN product p ON p.id = oli.product_id
			WHERE o.status IN ('completed', 'closed')
				AND o.created_at >= ${input.startDate}::timestamptz
				AND o.created_at <= ${input.endDate}::timestamptz
				AND oli.voided = false`,
		);
		return (
			result.rows[0] ?? { total_cogs: 0, total_revenue: 0, gross_margin_pct: 0 }
		);
	});

// ── 7.6 getProfitMargins ────────────────────────────────────────────────
// Revenue vs cost per product with gross margin %.
const getProfitMargins = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`SELECT
				oli.product_name_snapshot as product_name,
				oli.product_id,
				SUM(oli.quantity)::int as qty_sold,
				COALESCE(SUM(oli.total), 0)::numeric as revenue,
				COALESCE(SUM(oli.quantity * COALESCE(p.cost, 0)::numeric), 0)::numeric as cost,
				(COALESCE(SUM(oli.total), 0) - COALESCE(SUM(oli.quantity * COALESCE(p.cost, 0)::numeric), 0))::numeric as gross_profit,
				CASE
					WHEN COALESCE(SUM(oli.total), 0) = 0 THEN 0
					ELSE ROUND(
						(COALESCE(SUM(oli.total), 0) - COALESCE(SUM(oli.quantity * COALESCE(p.cost, 0)::numeric), 0))
						/ COALESCE(SUM(oli.total), 0) * 100,
						2
					)
				END as margin_pct
			FROM order_line_item oli
			JOIN "order" o ON o.id = oli.order_id
			LEFT JOIN product p ON p.id = oli.product_id
			WHERE o.status IN ('completed', 'closed')
				AND o.created_at >= ${input.startDate}::timestamptz
				AND o.created_at <= ${input.endDate}::timestamptz
				AND oli.voided = false
			GROUP BY oli.product_name_snapshot, oli.product_id
			ORDER BY revenue DESC`,
		);
		return result.rows;
	});

// ── 7.6 getInventoryValuation ───────────────────────────────────────────
// Current inventory value (qty on hand * avg cost).
const getInventoryValuation = permissionProcedure("reports.read").handler(
	async () => {
		const result = await db.execute(
			sql`SELECT
				ii.id,
				ii.name,
				ii.sku,
				ii.category,
				ii.unit_of_measure,
				COALESCE(ii.avg_cost, 0)::numeric as unit_cost,
				COALESCE(SUM(ist.quantity_on_hand), 0)::numeric as total_on_hand,
				(COALESCE(ii.avg_cost, 0)::numeric * COALESCE(SUM(ist.quantity_on_hand), 0)::numeric)::numeric as total_value
			FROM inventory_item ii
			LEFT JOIN inventory_stock ist ON ist.inventory_item_id = ii.id
			WHERE ii.is_active = true
			GROUP BY ii.id, ii.name, ii.sku, ii.category, ii.unit_of_measure, ii.avg_cost
			ORDER BY total_value DESC`,
		);
		return result.rows;
	},
);

// ── getMenuProfitability ─────────────────────────────────────────────
// Per-product profitability with ABC classification.
const getMenuProfitability = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
			departmentId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const deptFilter = input.departmentId
			? sql`AND p.reporting_category_id = ${input.departmentId}::uuid`
			: sql``;

		const result = await db.execute(
			sql`SELECT
				p.id,
				p.name,
				COALESCE(rc.name, 'Other') as department,
				SUM(oli.quantity)::numeric as units_sold,
				SUM(oli.total::numeric) as revenue,
				SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) as total_cost,
				SUM(oli.total::numeric) - SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) as margin,
				CASE WHEN SUM(oli.total::numeric) > 0
					THEN ROUND((1 - SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) / SUM(oli.total::numeric)) * 100, 1)
					ELSE 0 END as margin_percent,
				CASE WHEN SUM(oli.total::numeric) > 0
					THEN ROUND(SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) / SUM(oli.total::numeric) * 100, 1)
					ELSE 0 END as food_cost_percent
			FROM order_line_item oli
			JOIN "order" o ON o.id = oli.order_id
			JOIN product p ON p.id = oli.product_id
			LEFT JOIN reporting_category rc ON rc.id = p.reporting_category_id
			WHERE o.status IN ('completed', 'closed')
				AND o.created_at >= ${input.startDate}::timestamptz
				AND o.created_at <= ${input.endDate}::timestamptz
				AND oli.voided = false
				${deptFilter}
			GROUP BY p.id, p.name, rc.name
			ORDER BY revenue DESC`,
		);

		// ABC classification based on cumulative revenue %
		const rows = result.rows as Record<string, unknown>[];
		const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
		let cumulative = 0;
		const classified = rows.map((row) => {
			cumulative += Number(row.revenue);
			const cumulativePct =
				totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
			let abc: "A" | "B" | "C";
			if (cumulativePct <= 80) abc = "A";
			else if (cumulativePct <= 95) abc = "B";
			else abc = "C";
			return { ...row, abc };
		});

		return classified;
	});

// ── getDepartmentProfitability ──────────────────────────────────────
// Profitability aggregated by department (reporting category).
const getDepartmentProfitability = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`SELECT
				COALESCE(rc.name, 'Other') as department,
				SUM(oli.quantity)::numeric as units_sold,
				SUM(oli.total::numeric) as revenue,
				SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) as total_cost,
				SUM(oli.total::numeric) - SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) as margin,
				CASE WHEN SUM(oli.total::numeric) > 0
					THEN ROUND((1 - SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) / SUM(oli.total::numeric)) * 100, 1)
					ELSE 0 END as margin_percent,
				CASE WHEN SUM(oli.total::numeric) > 0
					THEN ROUND(SUM(oli.quantity * COALESCE(p.cost::numeric, 0)) / SUM(oli.total::numeric) * 100, 1)
					ELSE 0 END as food_cost_percent
			FROM order_line_item oli
			JOIN "order" o ON o.id = oli.order_id
			JOIN product p ON p.id = oli.product_id
			LEFT JOIN reporting_category rc ON rc.id = p.reporting_category_id
			WHERE o.status IN ('completed', 'closed')
				AND o.created_at >= ${input.startDate}::timestamptz
				AND o.created_at <= ${input.endDate}::timestamptz
				AND oli.voided = false
			GROUP BY rc.name
			ORDER BY revenue DESC`,
		);
		return result.rows;
	});

// ── getVarianceAnalysis ──────────────────────────────────────────────
// COGS variance: expected vs actual ingredient usage for a date range.
const getVarianceAnalysis = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`WITH expected_usage AS (
				SELECT
					ri.inventory_item_id,
					ii.name as ingredient_name,
					ri.unit,
					COALESCE(ii.avg_cost, 0)::numeric as avg_cost,
					COALESCE(SUM(oli.quantity * ri.quantity::numeric), 0)::numeric as expected_qty
				FROM recipe_ingredient ri
				JOIN inventory_item ii ON ii.id = ri.inventory_item_id
				LEFT JOIN order_line_item oli ON oli.product_id = ri.product_id AND oli.voided = false
				LEFT JOIN "order" o ON o.id = oli.order_id
					AND o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz
				GROUP BY ri.inventory_item_id, ii.name, ri.unit, ii.avg_cost
			),
			actual_usage AS (
				SELECT
					sl.inventory_item_id,
					COALESCE(SUM(ABS(sl.quantity_change::numeric)), 0)::numeric as actual_qty
				FROM stock_ledger sl
				WHERE sl.quantity_change::numeric < 0
					AND sl.created_at >= ${input.startDate}::timestamptz
					AND sl.created_at <= ${input.endDate}::timestamptz
				GROUP BY sl.inventory_item_id
			),
			waste AS (
				SELECT
					wl.inventory_item_id,
					COALESCE(SUM(wl.quantity::numeric), 0)::numeric as waste_qty
				FROM waste_log wl
				WHERE wl.inventory_item_id IS NOT NULL
					AND wl.created_at >= ${input.startDate}::timestamptz
					AND wl.created_at <= ${input.endDate}::timestamptz
				GROUP BY wl.inventory_item_id
			)
			SELECT
				eu.ingredient_name,
				eu.inventory_item_id as ingredient_id,
				eu.expected_qty as expected_usage,
				COALESCE(au.actual_qty, 0)::numeric as actual_usage,
				COALESCE(w.waste_qty, 0)::numeric as logged_waste,
				(COALESCE(au.actual_qty, 0) - eu.expected_qty - COALESCE(w.waste_qty, 0))::numeric as unaccounted,
				CASE WHEN eu.expected_qty > 0
					THEN ROUND(
						((COALESCE(au.actual_qty, 0) - eu.expected_qty - COALESCE(w.waste_qty, 0)) / eu.expected_qty) * 100,
						2
					)
					ELSE 0
				END as variance_percent,
				ROUND(
					(COALESCE(au.actual_qty, 0) - eu.expected_qty - COALESCE(w.waste_qty, 0)) * eu.avg_cost,
					2
				) as cost_impact,
				eu.unit
			FROM expected_usage eu
			LEFT JOIN actual_usage au ON au.inventory_item_id = eu.inventory_item_id
			LEFT JOIN waste w ON w.inventory_item_id = eu.inventory_item_id
			ORDER BY ABS(
				ROUND(
					(COALESCE(au.actual_qty, 0) - eu.expected_qty - COALESCE(w.waste_qty, 0)) * eu.avg_cost,
					2
				)
			) DESC`,
		);
		return result.rows;
	});

// ── getVarianceAlerts ───────────────────────────────────────────────
// Ingredients exceeding a variance threshold (default 10%).
const getVarianceAlerts = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
			threshold: z.number().default(10),
		}),
	)
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`WITH expected_usage AS (
				SELECT
					ri.inventory_item_id,
					ii.name as ingredient_name,
					ri.unit,
					COALESCE(ii.avg_cost, 0)::numeric as avg_cost,
					COALESCE(SUM(oli.quantity * ri.quantity::numeric), 0)::numeric as expected_qty
				FROM recipe_ingredient ri
				JOIN inventory_item ii ON ii.id = ri.inventory_item_id
				LEFT JOIN order_line_item oli ON oli.product_id = ri.product_id AND oli.voided = false
				LEFT JOIN "order" o ON o.id = oli.order_id
					AND o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz
				GROUP BY ri.inventory_item_id, ii.name, ri.unit, ii.avg_cost
			),
			actual_usage AS (
				SELECT
					sl.inventory_item_id,
					COALESCE(SUM(ABS(sl.quantity_change::numeric)), 0)::numeric as actual_qty
				FROM stock_ledger sl
				WHERE sl.quantity_change::numeric < 0
					AND sl.created_at >= ${input.startDate}::timestamptz
					AND sl.created_at <= ${input.endDate}::timestamptz
				GROUP BY sl.inventory_item_id
			),
			waste AS (
				SELECT
					wl.inventory_item_id,
					COALESCE(SUM(wl.quantity::numeric), 0)::numeric as waste_qty
				FROM waste_log wl
				WHERE wl.inventory_item_id IS NOT NULL
					AND wl.created_at >= ${input.startDate}::timestamptz
					AND wl.created_at <= ${input.endDate}::timestamptz
				GROUP BY wl.inventory_item_id
			),
			variance_data AS (
				SELECT
					eu.ingredient_name,
					eu.inventory_item_id as ingredient_id,
					eu.expected_qty as expected_usage,
					COALESCE(au.actual_qty, 0)::numeric as actual_usage,
					COALESCE(w.waste_qty, 0)::numeric as logged_waste,
					(COALESCE(au.actual_qty, 0) - eu.expected_qty - COALESCE(w.waste_qty, 0))::numeric as unaccounted,
					CASE WHEN eu.expected_qty > 0
						THEN ROUND(
							((COALESCE(au.actual_qty, 0) - eu.expected_qty - COALESCE(w.waste_qty, 0)) / eu.expected_qty) * 100,
							2
						)
						ELSE 0
					END as variance_percent,
					ROUND(
						(COALESCE(au.actual_qty, 0) - eu.expected_qty - COALESCE(w.waste_qty, 0)) * eu.avg_cost,
						2
					) as cost_impact,
					eu.unit
				FROM expected_usage eu
				LEFT JOIN actual_usage au ON au.inventory_item_id = eu.inventory_item_id
				LEFT JOIN waste w ON w.inventory_item_id = eu.inventory_item_id
			)
			SELECT * FROM variance_data
			WHERE ABS(variance_percent) > ${input.threshold}
			ORDER BY ABS(cost_impact) DESC`,
		);
		return result.rows;
	});

// ── getSvEReport ──────────────────────────────────────────────────────
// Sales vs Expense report: daily revenue minus expenses with breakdown
const getSvEReport = permissionProcedure("reports.read")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const startCondition = input.startDate
			? sql`AND o.created_at >= ${input.startDate}::timestamptz`
			: sql``;
		const endCondition = input.endDate
			? sql`AND o.created_at <= ${input.endDate}::timestamptz`
			: sql``;
		const expStartCondition = input.startDate
			? sql`AND e.created_at >= ${input.startDate}::timestamptz`
			: sql``;
		const expEndCondition = input.endDate
			? sql`AND e.created_at <= ${input.endDate}::timestamptz`
			: sql``;

		const salesResult = await db.execute(sql`
			SELECT
				COALESCE(SUM(o.total::numeric), 0)::text as total_sales,
				COUNT(*)::int as order_count
			FROM "order" o
			WHERE o.organization_id = ${input.organizationId}::uuid
				AND o.status = 'completed'
				${startCondition}
				${endCondition}
		`);

		const expensesResult = await db.execute(sql`
			SELECT
				COALESCE(SUM(e.amount::numeric), 0)::text as total_expenses,
				COUNT(*)::int as expense_count
			FROM expense e
			WHERE e.organization_id = ${input.organizationId}::uuid
				${expStartCondition}
				${expEndCondition}
		`);

		const expenseBySupplier = await db.execute(sql`
			SELECT
				COALESCE(s.name, 'Unassigned') as supplier_name,
				SUM(e.amount::numeric)::text as total
			FROM expense e
			LEFT JOIN supplier s ON s.id = e.supplier_id
			WHERE e.organization_id = ${input.organizationId}::uuid
				${expStartCondition}
				${expEndCondition}
			GROUP BY s.name
			ORDER BY SUM(e.amount::numeric) DESC
		`);

		const totalSales = Number(salesResult.rows[0]?.total_sales ?? 0);
		const totalExpenses = Number(expensesResult.rows[0]?.total_expenses ?? 0);
		const remainingRevenue = totalSales - totalExpenses;

		return {
			totalSales: totalSales.toFixed(2),
			totalExpenses: totalExpenses.toFixed(2),
			remainingRevenue: remainingRevenue.toFixed(2),
			orderCount: Number(salesResult.rows[0]?.order_count ?? 0),
			expenseCount: Number(expensesResult.rows[0]?.expense_count ?? 0),
			expenseBySupplier: expenseBySupplier.rows,
		};
	});

export const reportsRouter = {
	getReport,
	getEodReport,
	// 7.6 Inventory Valuation & COGS
	getCOGS,
	getProfitMargins,
	getInventoryValuation,
	// Menu Item Profitability
	getMenuProfitability,
	getDepartmentProfitability,
	// COGS Variance Analysis
	getVarianceAnalysis,
	getVarianceAlerts,
	// Sales vs Expense Report
	getSvEReport,
};
