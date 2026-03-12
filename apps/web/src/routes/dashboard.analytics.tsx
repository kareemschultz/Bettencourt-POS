import { useQuery } from "@tanstack/react-query";
import {
	BarChart3,
	Clock,
	DollarSign,
	Lightbulb,
	Package,
	TrendingUp,
	Users,
} from "lucide-react";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip as RechartsTooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type DayRange = 30 | 60 | 90;
type AbcView = "abc" | "departments";

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export default function AnalyticsPage() {
	const [revenueDays, setRevenueDays] = useState<DayRange>(30);
	const [abcView, setAbcView] = useState<AbcView>("abc");
	const [weeklyMetric, setWeeklyMetric] = useState<"revenue" | "orders">(
		"revenue",
	);

	const today = todayGY();
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);

	const { data: revenueTrend, isLoading: loadingRevenue } = useQuery(
		orpc.analytics.getRevenueTrend.queryOptions({
			input: { days: revenueDays },
		}),
	);
	const { data: hourlyPattern, isLoading: loadingHourly } = useQuery(
		orpc.analytics.getHourlyPattern.queryOptions({ input: undefined }),
	);
	const { data: dowPattern, isLoading: loadingDow } = useQuery(
		orpc.analytics.getDayOfWeekPattern.queryOptions({ input: undefined }),
	);
	const { data: abcData, isLoading: loadingAbc } = useQuery(
		orpc.analytics.getAbcAnalysis.queryOptions({ input: { days: 90 } }),
	);
	const { data: customerInsights, isLoading: loadingCustomer } = useQuery(
		orpc.analytics.getCustomerInsights.queryOptions({ input: undefined }),
	);
	const { data: laborData, isLoading: loadingLabor } = useQuery(
		orpc.analytics.getLaborCostRatio.queryOptions({ input: { days: 30 } }),
	);
	const { data: weeklyRaw } = useQuery(
		orpc.analytics.getWeeklyComparison.queryOptions({ input: undefined }),
	);
	const { data: deptData, isLoading: loadingDept } = useQuery(
		orpc.reports.getDepartmentProfitability.queryOptions({
			input: {
				startDate: `${thirtyDaysAgo}T00:00:00`,
				endDate: `${today}T23:59:59`,
			},
		}),
	);

	const isLoading =
		loadingRevenue ||
		loadingHourly ||
		loadingDow ||
		loadingAbc ||
		loadingCustomer ||
		loadingLabor ||
		loadingDept;

	if (isLoading) {
		return (
			<div className="flex flex-col gap-6 p-4 md:p-6">
				<div>
					<Skeleton className="h-8 w-56" />
					<Skeleton className="mt-1 h-4 w-80" />
				</div>
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
				<Skeleton className="h-64 rounded-lg" />
				<div className="grid gap-4 lg:grid-cols-2">
					<Skeleton className="h-64 rounded-lg" />
					<Skeleton className="h-64 rounded-lg" />
				</div>
				<Skeleton className="h-80 rounded-lg" />
			</div>
		);
	}

	const trendRows = (revenueTrend || []) as Record<string, unknown>[];
	const maxRevenue = Math.max(
		...trendRows.map((r) => Number(r.revenue) || 0),
		1,
	);

	const hourlyRows = (hourlyPattern || []) as Record<string, unknown>[];
	const maxHourlyRev = Math.max(
		...hourlyRows.map((r) => Number(r.avg_revenue) || 0),
		1,
	);

	const dowRows = (dowPattern || []) as Record<string, unknown>[];
	const maxDowRev = Math.max(
		...dowRows.map((r) => Number(r.avg_revenue) || 0),
		1,
	);

	const abcRows = (abcData || []) as Record<string, unknown>[];
	const deptRows = (deptData || []) as Record<string, unknown>[];
	const weeklyChartData = (weeklyRaw ?? []).map((d) => ({
		...d,
		thisWeekRevenue: Number(d.thisWeekRevenue),
		lastWeekRevenue: Number(d.lastWeekRevenue),
	}));
	const maxDeptRev = Math.max(
		...deptRows.map((r) => Number(r.revenue) || 0),
		1,
	);

	const ci = (customerInsights || {}) as Record<string, unknown>;
	const labor = (laborData || {}) as Record<string, unknown>;

	// ── Auto-generated business insights ──────────────────────────────
	const insights: string[] = [];
	const bestDow = dowRows.reduce(
		(best, r) =>
			Number(r.avg_revenue) > Number(best.avg_revenue ?? 0) ? r : best,
		dowRows[0] ?? {},
	);
	if (bestDow?.dow !== undefined) {
		insights.push(
			`${DAY_NAMES[Number(bestDow.dow)]} is your best day, averaging ${formatGYD(Number(bestDow.avg_revenue))} per day.`,
		);
	}
	const peakHour = hourlyRows.reduce(
		(best, r) =>
			Number(r.avg_revenue) > Number(best.avg_revenue ?? 0) ? r : best,
		hourlyRows[0] ?? {},
	);
	if (peakHour?.hour !== undefined) {
		const h = Number(peakHour.hour);
		insights.push(
			`Peak hour is ${h.toString().padStart(2, "0")}:00–${(h + 1).toString().padStart(2, "0")}:00 with avg ${formatGYD(Number(peakHour.avg_revenue))} revenue.`,
		);
	}
	if (abcRows[0]) {
		insights.push(
			`Top product: "${abcRows[0].product}" with ${formatGYD(Number(abcRows[0].revenue))} in sales (${Number(abcRows[0].percentage).toFixed(1)}% of revenue).`,
		);
	}
	const returnRate =
		Number(ci.total_customers) > 0
			? (Number(ci.returning_customers) / Number(ci.total_customers)) * 100
			: 0;
	if (ci.total_customers) {
		insights.push(
			`${returnRate.toFixed(0)}% of your ${Number(ci.total_customers)} customers are repeat visitors.`,
		);
	}
	if (labor.revenuePerLaborHour) {
		insights.push(
			`You generate ${formatGYD(Number(labor.revenuePerLaborHour))} per labor hour across ${Number(labor.totalHours || 0).toFixed(0)}h of work this month.`,
		);
	}
	const cRows = abcRows.filter((r) => r.category === "C");
	if (cRows.length > 0) {
		insights.push(
			`${cRows.length} product${cRows.length > 1 ? "s are" : " is"} in category C — consider reviewing ${cRows.length > 1 ? "them" : `"${cRows[0]!.product}"`} for menu optimization.`,
		);
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div>
				<h1 className="flex items-center gap-2 font-bold text-xl sm:text-2xl">
					<BarChart3 className="size-5" />
					Advanced Analytics
				</h1>
				<p className="text-muted-foreground text-sm">
					Deep insights into revenue, products, customers, and labor
				</p>
			</div>

			{/* ── Business Insights ──────────────────────────────────────── */}
			{insights.length > 0 && (
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Lightbulb className="size-4 text-primary" />
							Business Insights
						</CardTitle>
						<CardDescription className="text-xs">
							Auto-generated from your last 90 days of data
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="flex flex-col gap-2">
							{insights.map((insight, i) => (
								<li key={i} className="flex items-start gap-2 text-sm">
									<span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
									{insight}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			{/* Top summary cards */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Total Customers
						</CardTitle>
						<Users className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg sm:text-2xl">
							{Number(ci.total_customers || 0)}
						</div>
						<p className="text-muted-foreground text-xs">
							{Number(ci.returning_customers || 0)} returning
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Avg Lifetime Value
						</CardTitle>
						<DollarSign className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg sm:text-2xl">
							{formatGYD(Number(ci.avg_lifetime_value || 0))}
						</div>
						<p className="text-muted-foreground text-xs">
							Max: {formatGYD(Number(ci.max_lifetime_value || 0))}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Revenue/Labor Hour
						</CardTitle>
						<Clock className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg sm:text-2xl">
							{formatGYD(Number(labor.revenuePerLaborHour || 0))}
						</div>
						<p className="text-muted-foreground text-xs">
							{Number(labor.totalHours || 0).toFixed(1)}h total labor
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							ABC Products
						</CardTitle>
						<Package className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="flex gap-2 font-bold text-lg sm:text-2xl">
							<span className="text-green-600">
								{abcRows.filter((r) => r.category === "A").length}A
							</span>
							<span className="text-amber-600">
								{abcRows.filter((r) => r.category === "B").length}B
							</span>
							<span className="text-red-600">
								{abcRows.filter((r) => r.category === "C").length}C
							</span>
						</div>
						<p className="text-muted-foreground text-xs">
							{abcRows.length} products analyzed
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Revenue Trend */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-base">
								<TrendingUp className="size-4" />
								Revenue Trend
							</CardTitle>
							<CardDescription className="text-xs">
								Daily revenue for the last {revenueDays} days
							</CardDescription>
						</div>
						<div className="flex gap-1">
							{([30, 60, 90] as DayRange[]).map((d) => (
								<Button
									key={d}
									size="sm"
									variant={revenueDays === d ? "default" : "outline"}
									onClick={() => setRevenueDays(d)}
									className="h-7 px-2.5 text-xs"
								>
									{d}d
								</Button>
							))}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{trendRows.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No revenue data available.
						</p>
					) : (
						<div className="flex flex-col gap-1">
							{trendRows.map((row) => {
								const rev = Number(row.revenue) || 0;
								const pct = (rev / maxRevenue) * 100;
								return (
									<div
										key={row.date as string}
										className="flex items-center gap-2 text-xs"
									>
										<span className="w-20 shrink-0 font-mono text-muted-foreground">
											{(row.date as string).slice(5)}
										</span>
										<div className="flex-1">
											<div
												className="h-5 rounded-sm bg-primary/80 transition-all"
												style={{ width: `${Math.max(pct, 0.5)}%` }}
											/>
										</div>
										<span className="w-24 shrink-0 text-right font-medium font-mono">
											{formatGYD(rev)}
										</span>
										<span className="w-10 shrink-0 text-right text-muted-foreground">
											{String(row.order_count)}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Hourly + Day of Week */}
			<div className="grid gap-4 lg:grid-cols-2">
				{/* Hourly Pattern */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Clock className="size-4" />
							Hourly Sales Pattern
						</CardTitle>
						<CardDescription className="text-xs">
							Average revenue by hour (last 90 days)
						</CardDescription>
					</CardHeader>
					<CardContent>
						{hourlyRows.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No hourly data.
							</p>
						) : (
							<div className="flex flex-col gap-1">
								{hourlyRows.map((row) => {
									const rev = Number(row.avg_revenue) || 0;
									const pct = (rev / maxHourlyRev) * 100;
									const hour = Number(row.hour);
									const label = `${hour.toString().padStart(2, "0")}:00`;
									return (
										<div key={hour} className="flex items-center gap-2 text-xs">
											<span className="w-12 shrink-0 font-mono text-muted-foreground">
												{label}
											</span>
											<div className="flex-1">
												<div
													className="h-4 rounded-sm bg-blue-500/80 transition-all"
													style={{ width: `${Math.max(pct, 0.5)}%` }}
												/>
											</div>
											<span className="w-20 shrink-0 text-right font-mono">
												{formatGYD(rev)}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Day of Week Heatmap */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Day-of-Week Performance</CardTitle>
						<CardDescription className="text-xs">
							Average daily revenue by weekday (last 90 days)
						</CardDescription>
					</CardHeader>
					<CardContent>
						{dowRows.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No data.
							</p>
						) : (
							<div className="grid grid-cols-7 gap-2">
								{DAY_NAMES.map((dayName, i) => {
									const row = dowRows.find((r) => Number(r.dow) === i);
									const rev = row ? Number(row.avg_revenue) || 0 : 0;
									const orders = row ? Number(row.avg_orders) || 0 : 0;
									const intensity = maxDowRev > 0 ? rev / maxDowRev : 0;
									const bg =
										intensity > 0.75
											? "bg-green-600 text-white"
											: intensity > 0.5
												? "bg-green-400 text-white"
												: intensity > 0.25
													? "bg-green-200 text-green-900"
													: intensity > 0
														? "bg-green-100 text-green-800"
														: "bg-muted text-muted-foreground";
									return (
										<div
											key={dayName}
											className={`flex flex-col items-center justify-center rounded-md p-2 ${bg}`}
										>
											<span className="font-bold text-[10px] uppercase">
												{dayName.slice(0, 3)}
											</span>
											<span className="mt-1 font-semibold text-xs">
												{formatGYD(rev)}
											</span>
											<span className="text-[10px] opacity-80">
												{orders} orders
											</span>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Customer Insights + Labor Cost */}
			<div className="grid gap-4 lg:grid-cols-2">
				{/* Customer Insights */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Users className="size-4" />
							Customer Insights
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl text-green-600">
									{Number(ci.new_customers || 0)}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									New Customers
								</div>
								<div className="text-[10px] text-muted-foreground">
									(1 visit or less)
								</div>
							</div>
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl text-blue-600">
									{Number(ci.returning_customers || 0)}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Returning Customers
								</div>
								<div className="text-[10px] text-muted-foreground">
									(2+ visits)
								</div>
							</div>
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl">
									{formatGYD(Number(ci.avg_lifetime_value || 0))}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Avg Lifetime Value
								</div>
							</div>
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl">
									{Number(ci.avg_visits || 0)}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Avg Visits
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Labor Cost Ratio */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Clock className="size-4" />
							Labor vs Revenue (30 days)
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl">
									{Number(labor.totalHours || 0).toFixed(1)}h
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Total Labor Hours
								</div>
							</div>
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl">
									{formatGYD(Number(labor.totalRevenue || 0))}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Total Revenue
								</div>
							</div>
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl text-green-600">
									{formatGYD(Number(labor.revenuePerLaborHour || 0))}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Revenue per Labor Hour
								</div>
							</div>
							<div className="rounded-md border p-4 text-center">
								<div className="font-bold text-2xl">
									{Number(labor.uniqueEmployees || 0)}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Unique Employees
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Week-over-Week Comparison */}
			<Card>
				<CardContent className="p-4">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="font-semibold">This Week vs Last Week</h3>
						<div className="flex rounded-md border text-xs">
							<button
								type="button"
								className={`px-3 py-1 ${weeklyMetric === "revenue" ? "bg-muted font-medium" : ""}`}
								onClick={() => setWeeklyMetric("revenue")}
							>
								Revenue
							</button>
							<button
								type="button"
								className={`px-3 py-1 ${weeklyMetric === "orders" ? "bg-muted font-medium" : ""}`}
								onClick={() => setWeeklyMetric("orders")}
							>
								Orders
							</button>
						</div>
					</div>
					{weeklyChartData.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No weekly data available.
						</p>
					) : (
						<ResponsiveContainer width="100%" height={220}>
							<BarChart data={weeklyChartData} barGap={4}>
								<CartesianGrid strokeDasharray="3 3" vertical={false} />
								<XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
								<YAxis
									tick={{ fontSize: 11 }}
									tickFormatter={
										weeklyMetric === "revenue"
											? (v: number) => `$${(v / 1000).toFixed(0)}k`
											: undefined
									}
								/>
								<RechartsTooltip
									formatter={(value: number, name: string) =>
										weeklyMetric === "revenue"
											? [
													new Intl.NumberFormat("en-GY", {
														style: "currency",
														currency: "GYD",
													}).format(value),
													name,
												]
											: [value, name]
									}
								/>
								<Legend />
								<Bar
									dataKey={
										weeklyMetric === "revenue"
											? "thisWeekRevenue"
											: "thisWeekOrders"
									}
									name="This Week"
									fill="#0f766e"
									radius={[3, 3, 0, 0]}
								/>
								<Bar
									dataKey={
										weeklyMetric === "revenue"
											? "lastWeekRevenue"
											: "lastWeekOrders"
									}
									name="Last Week"
									fill="#94a3b8"
									radius={[3, 3, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					)}
				</CardContent>
			</Card>

			{/* ABC Analysis / Department Revenue toggle */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-base">
								<Package className="size-4" />
								{abcView === "abc"
									? "ABC Product Analysis"
									: "Department Revenue Breakdown"}
							</CardTitle>
							<CardDescription className="text-xs">
								{abcView === "abc"
									? "A = top 80% revenue, B = next 15%, C = bottom 5% (last 90 days)"
									: "Revenue and margin by department (last 30 days)"}
							</CardDescription>
						</div>
						<div className="flex gap-1">
							<Button
								size="sm"
								variant={abcView === "abc" ? "default" : "outline"}
								onClick={() => setAbcView("abc")}
								className="h-7 px-2.5 text-xs"
							>
								ABC Products
							</Button>
							<Button
								size="sm"
								variant={abcView === "departments" ? "default" : "outline"}
								onClick={() => setAbcView("departments")}
								className="h-7 px-2.5 text-xs"
							>
								Departments
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{abcView === "abc" ? (
						abcRows.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No product data available.
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-left text-muted-foreground text-xs">
											<th className="pr-4 pb-2 font-medium">Product</th>
											<th className="pr-4 pb-2 text-right font-medium">
												Revenue
											</th>
											<th className="pr-4 pb-2 text-right font-medium">
												Units
											</th>
											<th className="pr-4 pb-2 text-right font-medium">
												% of Total
											</th>
											<th className="pr-4 pb-2 text-right font-medium">
												Cumulative
											</th>
											<th className="pb-2 font-medium">Grade</th>
										</tr>
									</thead>
									<tbody>
										{abcRows.map((row, i) => {
											const cat = row.category as string;
											const badgeVariant =
												cat === "A"
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: cat === "B"
														? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
														: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
											return (
												<tr
													key={i}
													className="border-border/50 border-b last:border-0"
												>
													<td className="py-1.5 pr-4 font-medium">
														{row.product as string}
													</td>
													<td className="py-1.5 pr-4 text-right font-mono">
														{formatGYD(Number(row.revenue))}
													</td>
													<td className="py-1.5 pr-4 text-right">
														{String(row.units_sold)}
													</td>
													<td className="py-1.5 pr-4 text-right">
														{Number(row.percentage).toFixed(1)}%
													</td>
													<td className="py-1.5 pr-4 text-right">
														{Number(row.cumulative).toFixed(1)}%
													</td>
													<td className="py-1.5">
														<span
															className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold text-[10px] ${badgeVariant}`}
														>
															{cat}
														</span>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)
					) : deptRows.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No department data available.
						</p>
					) : (
						<div className="flex flex-col gap-3">
							{deptRows.map((dept, i) => {
								const rev = Number(dept.revenue) || 0;
								const margin = Number(dept.margin_percent) || 0;
								const pct = (rev / maxDeptRev) * 100;
								return (
									<div key={i} className="flex flex-col gap-1">
										<div className="flex items-center justify-between text-sm">
											<span className="font-medium">
												{String(dept.department)}
											</span>
											<div className="flex items-center gap-4 text-muted-foreground text-xs">
												<span className="font-mono font-semibold text-foreground">
													{formatGYD(rev)}
												</span>
												<span
													className={
														margin >= 60
															? "text-green-600"
															: margin >= 40
																? "text-amber-600"
																: "text-red-600"
													}
												>
													{margin.toFixed(1)}% margin
												</span>
											</div>
										</div>
										<div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full bg-primary/70 transition-all"
												style={{ width: `${Math.max(pct, 1)}%` }}
											/>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
