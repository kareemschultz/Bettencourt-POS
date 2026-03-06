import { useQuery } from "@tanstack/react-query";
import {
	BarChart3,
	Clock,
	DollarSign,
	Package,
	TrendingUp,
	Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

type DayRange = 30 | 60 | 90;

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

	const isLoading =
		loadingRevenue ||
		loadingHourly ||
		loadingDow ||
		loadingAbc ||
		loadingCustomer ||
		loadingLabor;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20 text-muted-foreground">
				Loading analytics...
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

	const ci = (customerInsights || {}) as Record<string, unknown>;
	const labor = (laborData || {}) as Record<string, unknown>;

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

			{/* ABC Analysis */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Package className="size-4" />
						ABC Product Analysis
					</CardTitle>
					<CardDescription className="text-xs">
						A = top 80% revenue, B = next 15%, C = bottom 5% (last 90 days)
					</CardDescription>
				</CardHeader>
				<CardContent>
					{abcRows.length === 0 ? (
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
										<th className="pr-4 pb-2 text-right font-medium">Units</th>
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
					)}
				</CardContent>
			</Card>
		</div>
	);
}
