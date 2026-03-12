import { db } from "@Bettencourt-POS/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── getRevenueTrend ─────────────────────────────────────────────────
// Daily revenue for last N days (default 30)
const getRevenueTrend = permissionProcedure("reports.read")
	.input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`SELECT
				DATE(o.created_at AT TIME ZONE 'America/Guyana') as date,
				COALESCE(SUM(o.total), 0)::numeric as revenue,
				COUNT(*)::int as order_count
			FROM "order" o
			WHERE o.status IN ('completed', 'closed')
				AND o.created_at >= (NOW() AT TIME ZONE 'America/Guyana' - ${`${input.days} days`}::interval)
			GROUP BY DATE(o.created_at AT TIME ZONE 'America/Guyana')
			ORDER BY date ASC`,
		);
		return result.rows as Record<string, unknown>[];
	});

// ── getHourlyPattern ────────────────────────────────────────────────
// Average revenue by hour of day (0-23)
const getHourlyPattern = permissionProcedure("reports.read").handler(
	async () => {
		const result = await db.execute(
			sql`WITH hourly_daily AS (
				SELECT
					DATE(o.created_at AT TIME ZONE 'America/Guyana') as day,
					EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Guyana')::int as hour,
					COALESCE(SUM(o.total), 0)::numeric as revenue,
					COUNT(*)::int as order_count
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= NOW() - INTERVAL '90 days'
				GROUP BY day, hour
			)
			SELECT
				hour,
				ROUND(AVG(revenue), 2)::numeric as avg_revenue,
				ROUND(AVG(order_count))::int as avg_orders
			FROM hourly_daily
			GROUP BY hour
			ORDER BY hour ASC`,
		);
		return result.rows as Record<string, unknown>[];
	},
);

// ── getDayOfWeekPattern ─────────────────────────────────────────────
// Average revenue by day of week
const getDayOfWeekPattern = permissionProcedure("reports.read").handler(
	async () => {
		const result = await db.execute(
			sql`WITH daily AS (
				SELECT
					DATE(o.created_at AT TIME ZONE 'America/Guyana') as day,
					EXTRACT(DOW FROM o.created_at AT TIME ZONE 'America/Guyana')::int as dow,
					COALESCE(SUM(o.total), 0)::numeric as revenue,
					COUNT(*)::int as order_count
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= NOW() - INTERVAL '90 days'
				GROUP BY day, dow
			)
			SELECT
				dow,
				CASE dow
					WHEN 0 THEN 'Sunday'
					WHEN 1 THEN 'Monday'
					WHEN 2 THEN 'Tuesday'
					WHEN 3 THEN 'Wednesday'
					WHEN 4 THEN 'Thursday'
					WHEN 5 THEN 'Friday'
					WHEN 6 THEN 'Saturday'
				END as day_name,
				ROUND(AVG(revenue), 2)::numeric as avg_revenue,
				ROUND(AVG(order_count))::int as avg_orders,
				COUNT(*)::int as weeks_sampled
			FROM daily
			GROUP BY dow
			ORDER BY dow ASC`,
		);
		return result.rows as Record<string, unknown>[];
	},
);

// ── getAbcAnalysis ──────────────────────────────────────────────────
// Classify products: A (top 20% revenue), B (next 30%), C (bottom 50%)
const getAbcAnalysis = permissionProcedure("reports.read")
	.input(
		z.object({ days: z.number().int().min(1).max(365).default(90) }).optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const days = rawInput?.days ?? 90;
		const result = await db.execute(
			sql`WITH product_revenue AS (
				SELECT
					oli.product_name_snapshot as product,
					COALESCE(SUM(oli.total), 0)::numeric as revenue,
					SUM(oli.quantity)::int as units_sold
				FROM order_line_item oli
				JOIN "order" o ON oli.order_id = o.id
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= (NOW() - ${`${days} days`}::interval)
					AND oli.voided = false
				GROUP BY oli.product_name_snapshot
			),
			total AS (
				SELECT COALESCE(SUM(revenue), 0) as grand_total FROM product_revenue
			),
			ranked AS (
				SELECT
					pr.product,
					pr.revenue,
					pr.units_sold,
					CASE WHEN t.grand_total > 0
						THEN ROUND(pr.revenue / t.grand_total * 100, 2)
						ELSE 0
					END as percentage,
					SUM(pr.revenue) OVER (ORDER BY pr.revenue DESC) as running_total,
					t.grand_total
				FROM product_revenue pr
				CROSS JOIN total t
				ORDER BY pr.revenue DESC
			)
			SELECT
				product,
				revenue,
				units_sold,
				percentage,
				CASE WHEN grand_total > 0
					THEN ROUND(running_total / grand_total * 100, 2)
					ELSE 0
				END as cumulative,
				CASE
					WHEN grand_total > 0 AND running_total / grand_total <= 0.80 THEN 'A'
					WHEN grand_total > 0 AND running_total / grand_total <= 0.95 THEN 'B'
					ELSE 'C'
				END as category
			FROM ranked
			ORDER BY revenue DESC`,
		);
		return result.rows as Record<string, unknown>[];
	});

// ── getCustomerInsights ─────────────────────────────────────────────
// New vs returning customers, avg lifetime value
const getCustomerInsights = permissionProcedure("reports.read").handler(
	async () => {
		const result = await db.execute(
			sql`SELECT
				COUNT(*) FILTER (WHERE visit_count <= 1)::int as new_customers,
				COUNT(*) FILTER (WHERE visit_count > 1)::int as returning_customers,
				COUNT(*)::int as total_customers,
				ROUND(COALESCE(AVG(total_spent::numeric), 0), 2)::numeric as avg_lifetime_value,
				ROUND(COALESCE(AVG(visit_count::numeric), 0), 1)::numeric as avg_visits,
				COALESCE(MAX(total_spent::numeric), 0)::numeric as max_lifetime_value
			FROM customer`,
		);
		return result.rows[0] as Record<string, unknown>;
	},
);

// ── getLaborCostRatio ───────────────────────────────────────────────
// Labor hours from time_entry vs revenue
const getLaborCostRatio = permissionProcedure("reports.read")
	.input(
		z.object({ days: z.number().int().min(1).max(365).default(30) }).optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const days = rawInput?.days ?? 30;
		const [laborResult, revenueResult] = await Promise.all([
			db.execute(
				sql`SELECT
					COALESCE(SUM(
						EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
						- CAST(te.break_minutes AS numeric) / 60
					), 0)::numeric(10,2) as total_hours,
					COUNT(DISTINCT te.user_id)::int as unique_employees,
					COUNT(*)::int as total_shifts
				FROM time_entry te
				WHERE te.clock_in >= (NOW() - ${`${days} days`}::interval)`,
			),
			db.execute(
				sql`SELECT
					COALESCE(SUM(o.total), 0)::numeric as total_revenue,
					COUNT(*)::int as total_orders
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= (NOW() - ${`${days} days`}::interval)`,
			),
		]);

		const labor = laborResult.rows[0] as Record<string, unknown>;
		const revenue = revenueResult.rows[0] as Record<string, unknown>;
		const totalHours = Number(labor.total_hours) || 0;
		const totalRevenue = Number(revenue.total_revenue) || 0;

		return {
			totalHours,
			uniqueEmployees: Number(labor.unique_employees) || 0,
			totalShifts: Number(labor.total_shifts) || 0,
			totalRevenue,
			totalOrders: Number(revenue.total_orders) || 0,
			revenuePerLaborHour:
				totalHours > 0
					? Math.round((totalRevenue / totalHours) * 100) / 100
					: 0,
			laborCostRatio:
				totalRevenue > 0
					? Math.round((totalHours / totalRevenue) * 10000) / 100
					: 0,
		};
	});

// ── getLaborDetails ──────────────────────────────────────────────────
// Detailed labor breakdown by day and employee for a date range
const getLaborDetails = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const [dailyResult, employeeResult, revenueResult] = await Promise.all([
			db.execute(
				sql`SELECT
					DATE(te.clock_in AT TIME ZONE 'America/Guyana') as date,
					COALESCE(SUM(
						EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
						- CAST(te.break_minutes AS numeric) / 60
					), 0)::numeric(10,2) as hours_worked,
					COALESCE(SUM(
						(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
						- CAST(te.break_minutes AS numeric) / 60)
						* COALESCE(u.hourly_rate::numeric, 150)
					), 0)::numeric(10,2) as labor_cost
				FROM time_entry te
				JOIN "user" u ON te.user_id = u.id
				WHERE DATE(te.clock_in AT TIME ZONE 'America/Guyana') >= ${input.startDate}::date
					AND DATE(te.clock_in AT TIME ZONE 'America/Guyana') <= ${input.endDate}::date
				GROUP BY DATE(te.clock_in AT TIME ZONE 'America/Guyana')
				ORDER BY date ASC`,
			),
			db.execute(
				sql`SELECT
					u.name,
					u.role,
					COALESCE(SUM(
						EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
						- CAST(te.break_minutes AS numeric) / 60
					), 0)::numeric(10,2) as hours,
					COALESCE(SUM(
						(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
						- CAST(te.break_minutes AS numeric) / 60)
						* COALESCE(u.hourly_rate::numeric, 150)
					), 0)::numeric(10,2) as cost
				FROM time_entry te
				JOIN "user" u ON te.user_id = u.id
				WHERE DATE(te.clock_in AT TIME ZONE 'America/Guyana') >= ${input.startDate}::date
					AND DATE(te.clock_in AT TIME ZONE 'America/Guyana') <= ${input.endDate}::date
				GROUP BY u.id, u.name, u.role
				ORDER BY cost DESC`,
			),
			db.execute(
				sql`SELECT
					DATE(o.created_at AT TIME ZONE 'America/Guyana') as date,
					COALESCE(SUM(o.total), 0)::numeric as revenue
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND DATE(o.created_at AT TIME ZONE 'America/Guyana') >= ${input.startDate}::date
					AND DATE(o.created_at AT TIME ZONE 'America/Guyana') <= ${input.endDate}::date
				GROUP BY DATE(o.created_at AT TIME ZONE 'America/Guyana')
				ORDER BY date ASC`,
			),
		]);

		const revenueByDate = new Map<string, number>();
		for (const row of revenueResult.rows as Record<string, unknown>[]) {
			revenueByDate.set(String(row.date), Number(row.revenue) || 0);
		}

		const daily = (dailyResult.rows as Record<string, unknown>[]).map((row) => {
			const date = String(row.date);
			const hoursWorked = Number(row.hours_worked) || 0;
			const laborCost = Number(row.labor_cost) || 0;
			const revenue = revenueByDate.get(date) || 0;
			const laborPercent =
				revenue > 0 ? Math.round((laborCost / revenue) * 10000) / 100 : 0;
			return { date, hoursWorked, laborCost, revenue, laborPercent };
		});

		const employees = (employeeResult.rows as Record<string, unknown>[]).map(
			(row) => ({
				name: String(row.name),
				role: String(row.role || "user"),
				hours: Number(row.hours) || 0,
				cost: Number(row.cost) || 0,
			}),
		);

		const totalHours = employees.reduce((sum, e) => sum + e.hours, 0);
		const totalCost = employees.reduce((sum, e) => sum + e.cost, 0);
		const totalRevenue = daily.reduce((sum, d) => sum + d.revenue, 0);
		const laborPercent =
			totalRevenue > 0
				? Math.round((totalCost / totalRevenue) * 10000) / 100
				: 0;

		return {
			daily,
			employees,
			totals: { totalHours, totalCost, totalRevenue, laborPercent },
		};
	});

// ── getLaborTrend ───────────────────────────────────────────────────
// Daily labor % for last N days
const getLaborTrend = permissionProcedure("reports.read")
	.input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`WITH labor_daily AS (
				SELECT
					DATE(te.clock_in AT TIME ZONE 'America/Guyana') as date,
					COALESCE(SUM(
						(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
						- CAST(te.break_minutes AS numeric) / 60)
						* COALESCE(u.hourly_rate::numeric, 150)
					), 0)::numeric(10,2) as labor_cost
				FROM time_entry te
				JOIN "user" u ON te.user_id = u.id
				WHERE te.clock_in >= (NOW() AT TIME ZONE 'America/Guyana' - ${`${input.days} days`}::interval)
				GROUP BY DATE(te.clock_in AT TIME ZONE 'America/Guyana')
			),
			revenue_daily AS (
				SELECT
					DATE(o.created_at AT TIME ZONE 'America/Guyana') as date,
					COALESCE(SUM(o.total), 0)::numeric as revenue
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= (NOW() AT TIME ZONE 'America/Guyana' - ${`${input.days} days`}::interval)
				GROUP BY DATE(o.created_at AT TIME ZONE 'America/Guyana')
			)
			SELECT
				COALESCE(l.date, r.date) as date,
				COALESCE(r.revenue, 0)::numeric as revenue,
				COALESCE(l.labor_cost, 0)::numeric as labor_cost,
				CASE WHEN COALESCE(r.revenue, 0) > 0
					THEN ROUND(COALESCE(l.labor_cost, 0) / r.revenue * 100, 2)
					ELSE 0
				END::numeric as labor_percent
			FROM labor_daily l
			FULL OUTER JOIN revenue_daily r ON l.date = r.date
			ORDER BY date ASC`,
		);
		return (result.rows as Record<string, unknown>[]).map((row) => ({
			date: String(row.date),
			laborPercent: Number(row.labor_percent) || 0,
			revenue: Number(row.revenue) || 0,
			laborCost: Number(row.labor_cost) || 0,
		}));
	});

// ── getLaborByRole ──────────────────────────────────────────────────
// Group labor by user role for a date range
const getLaborByRole = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const result = await db.execute(
			sql`SELECT
				COALESCE(u.role, 'user') as role,
				COALESCE(SUM(
					EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
					- CAST(te.break_minutes AS numeric) / 60
				), 0)::numeric(10,2) as hours,
				COALESCE(SUM(
					(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
					- CAST(te.break_minutes AS numeric) / 60)
					* COALESCE(u.hourly_rate::numeric, 150)
				), 0)::numeric(10,2) as cost,
				COUNT(DISTINCT te.user_id)::int as headcount
			FROM time_entry te
			JOIN "user" u ON te.user_id = u.id
			WHERE DATE(te.clock_in AT TIME ZONE 'America/Guyana') >= ${input.startDate}::date
				AND DATE(te.clock_in AT TIME ZONE 'America/Guyana') <= ${input.endDate}::date
			GROUP BY u.role
			ORDER BY cost DESC`,
		);
		return (result.rows as Record<string, unknown>[]).map((row) => ({
			role: String(row.role),
			hours: Number(row.hours) || 0,
			cost: Number(row.cost) || 0,
			headcount: Number(row.headcount) || 0,
		}));
	});

// ── getWeeklyComparison ─────────────────────────────────────────────
// Returns this week vs last week sales by day (Mon–Sun), Guyana timezone.
const getWeeklyComparison = permissionProcedure("orders.read").handler(
	async () => {
		const result = await db.execute(sql`
			WITH week_data AS (
				SELECT
					DATE(created_at AT TIME ZONE 'America/Guyana') as day,
					COALESCE(SUM(total), 0)::numeric as revenue,
					COUNT(*)::int as orders
				FROM "order"
				WHERE status IN ('completed', 'closed')
					AND created_at AT TIME ZONE 'America/Guyana'
						>= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date - interval '13 days'
				GROUP BY DATE(created_at AT TIME ZONE 'America/Guyana')
			),
			this_week AS (
				SELECT
					generate_series(
						date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date),
						date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date) + interval '6 days',
						interval '1 day'
					)::date AS day
			),
			last_week AS (
				SELECT
					generate_series(
						date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date) - interval '7 days',
						date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guyana')::date) - interval '1 day',
						interval '1 day'
					)::date AS day
			)
			SELECT
				tw.day::text as "thisWeekDay",
				lw.day::text as "lastWeekDay",
				TO_CHAR(tw.day, 'Dy') as "dayLabel",
				COALESCE(wd_this.revenue, 0)::text as "thisWeekRevenue",
				COALESCE(wd_last.revenue, 0)::text as "lastWeekRevenue",
				COALESCE(wd_this.orders, 0)::int as "thisWeekOrders",
				COALESCE(wd_last.orders, 0)::int as "lastWeekOrders"
			FROM this_week tw
			JOIN last_week lw ON tw.day = lw.day + interval '7 days'
			LEFT JOIN week_data wd_this ON wd_this.day = tw.day
			LEFT JOIN week_data wd_last ON wd_last.day = lw.day
			ORDER BY tw.day
		`);

		return result.rows as Array<{
			thisWeekDay: string;
			lastWeekDay: string;
			dayLabel: string;
			thisWeekRevenue: string;
			lastWeekRevenue: string;
			thisWeekOrders: number;
			lastWeekOrders: number;
		}>;
	},
);

export const analyticsRouter = {
	getRevenueTrend,
	getHourlyPattern,
	getDayOfWeekPattern,
	getAbcAnalysis,
	getCustomerInsights,
	getLaborCostRatio,
	getLaborDetails,
	getLaborTrend,
	getLaborByRole,
	getWeeklyComparison,
};
