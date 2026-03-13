import { db } from "@Bettencourt-POS/db";
import { sql } from "drizzle-orm";
import { permissionProcedure } from "../index";

// ── getSummary ─────────────────────────────────────────────────────────
// Aggregated dashboard data: today's stats, recent orders, top products,
// payment breakdown, hourly sales, open shifts, void count
const getSummary = permissionProcedure("orders.read").handler(async () => {
	// Use Guyana timezone (UTC-4) so "today" matches local business day
	const today = new Date().toLocaleDateString("en-CA", {
		timeZone: "America/Guyana",
	});

	const [
		statsResult,
		productCountResult,
		openShiftsResult,
		recentOrdersResult,
		topProductsResult,
		paymentBreakdownResult,
		voidCountResult,
		hourlySalesResult,
		expensesTodayResult,
		openInvoicesResult,
		overdueInvoicesResult,
		lowStockResult,
	] = await Promise.all([
		// Today's stats
		db.execute(
			sql`SELECT
					COUNT(*)::int as order_count,
					COALESCE(SUM(total), 0)::numeric as revenue,
					COALESCE(AVG(total), 0)::numeric as avg_order
				FROM "order"
				WHERE status IN ('completed', 'closed')
					AND DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`,
		),
		// Active products count
		db.execute(
			sql`SELECT COUNT(*)::int as cnt FROM product WHERE is_active = true`,
		),
		// Open cash sessions
		db.execute(
			sql`SELECT COUNT(*)::int as cnt FROM cash_session WHERE status = 'open'`,
		),
		// Recent orders (last 10)
		db.execute(
			sql`SELECT o.order_number, o.total, o.status, o.created_at, o.type as order_type,
					COALESCE(u.name, 'Unknown') as user_name
				FROM "order" o
				LEFT JOIN "user" u ON u.id = o.user_id
				WHERE DATE(o.created_at AT TIME ZONE 'America/Guyana') = ${today}
				ORDER BY o.created_at DESC
				LIMIT 10`,
		),
		// Top products today
		db.execute(
			sql`SELECT oli.product_name_snapshot as name,
					SUM(oli.quantity)::int as qty,
					COALESCE(SUM(oli.total), 0)::numeric as revenue
				FROM order_line_item oli
				JOIN "order" o ON o.id = oli.order_id
				WHERE o.status IN ('completed', 'closed')
					AND DATE(o.created_at AT TIME ZONE 'America/Guyana') = ${today}
					AND oli.voided = false
				GROUP BY oli.product_name_snapshot
				ORDER BY qty DESC
				LIMIT 8`,
		),
		// Payment breakdown
		db.execute(
			sql`SELECT p.method,
					COUNT(*)::int as count,
					COALESCE(SUM(p.amount), 0)::numeric as total
				FROM payment p
				JOIN "order" o ON o.id = p.order_id
				WHERE o.status IN ('completed', 'closed')
					AND DATE(o.created_at AT TIME ZONE 'America/Guyana') = ${today}
				GROUP BY p.method`,
		),
		// Void count today
		db.execute(
			sql`SELECT COUNT(*)::int as cnt FROM "order"
				WHERE status = 'voided' AND DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`,
		),
		// Hourly sales
		db.execute(
			sql`SELECT
					EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Guyana')::int as hour,
					COUNT(*)::int as orders,
					COALESCE(SUM(o.total), 0)::numeric as revenue
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND DATE(o.created_at AT TIME ZONE 'America/Guyana') = ${today}
				GROUP BY EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Guyana')
				ORDER BY hour`,
		),
		// Expenses today
		db.execute(
			sql`SELECT COALESCE(SUM(amount), 0)::numeric as total
				FROM expense
				WHERE DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`,
		),
		// Open invoices count + total outstanding
		db.execute(
			sql`SELECT COUNT(*)::int as cnt,
					COALESCE(SUM(total - amount_paid), 0)::numeric as outstanding
				FROM invoice
				WHERE status IN ('sent', 'partial')`,
		),
		// Overdue invoices count
		db.execute(
			sql`SELECT COUNT(*)::int as cnt
				FROM invoice
				WHERE status IN ('sent', 'partial')
					AND due_date < NOW()`,
		),
		// Low / out-of-stock alerts count
		db.execute(
			sql`SELECT COUNT(*)::int as cnt
				FROM stock_alert
				WHERE acknowledged_at IS NULL
					AND type IN ('low_stock', 'out_of_stock')`,
		),
	]);

	return {
		stats: statsResult.rows[0] as Record<string, unknown>,
		productCount: Number(
			(productCountResult.rows[0] as Record<string, unknown>).cnt,
		),
		openShifts: Number(
			(openShiftsResult.rows[0] as Record<string, unknown>).cnt,
		),
		recentOrders: recentOrdersResult.rows as Record<string, unknown>[],
		topProducts: topProductsResult.rows as Record<string, unknown>[],
		paymentBreakdown: paymentBreakdownResult.rows as Record<string, unknown>[],
		voidCount: Number((voidCountResult.rows[0] as Record<string, unknown>).cnt),
		hourlySales: hourlySalesResult.rows as Record<string, unknown>[],
		// Financial Pulse
		expensesToday: String(
			(expensesTodayResult.rows[0] as Record<string, unknown>).total ?? "0",
		),
		openInvoicesCount: Number(
			(openInvoicesResult.rows[0] as Record<string, unknown>).cnt ?? 0,
		),
		openInvoicesTotal: String(
			(openInvoicesResult.rows[0] as Record<string, unknown>).outstanding ?? "0",
		),
		overdueInvoicesCount: Number(
			(overdueInvoicesResult.rows[0] as Record<string, unknown>).cnt ?? 0,
		),
		lowStockCount: Number(
			(lowStockResult.rows[0] as Record<string, unknown>).cnt ?? 0,
		),
	};
});

export const dashboardRouter = {
	getSummary,
};
