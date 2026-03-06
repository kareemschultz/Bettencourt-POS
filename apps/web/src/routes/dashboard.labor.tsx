import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	Clock,
	DollarSign,
	TrendingUp,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function laborColor(pct: number): string {
	if (pct <= 0) return "text-muted-foreground";
	if (pct < 25) return "text-green-600 dark:text-green-400";
	if (pct <= 35) return "text-amber-600 dark:text-amber-400";
	return "text-red-600 dark:text-red-400";
}

function laborBg(pct: number): string {
	if (pct <= 0) return "bg-muted";
	if (pct < 25) return "bg-green-500/80";
	if (pct <= 35) return "bg-amber-500/80";
	return "bg-red-500/80";
}

function startOfWeekGY(): string {
	const now = new Date(
		new Date().toLocaleString("en-US", { timeZone: "America/Guyana" }),
	);
	const day = now.getDay();
	const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
	const monday = new Date(now.setDate(diff));
	return monday.toISOString().split("T")[0];
}

function startOfMonthGY(): string {
	const today = todayGY();
	return `${today.slice(0, 8)}01`;
}

export default function LaborDashboardPage() {
	const today = todayGY();
	const monthStart = startOfMonthGY();

	const [startDate, setStartDate] = useState(monthStart);
	const [endDate, setEndDate] = useState(today);

	// Main labor details for selected range
	const { data: laborDetails, isLoading: loadingDetails } = useQuery(
		orpc.analytics.getLaborDetails.queryOptions({
			input: { startDate, endDate },
		}),
	);

	// 30-day trend
	const { data: laborTrend, isLoading: loadingTrend } = useQuery(
		orpc.analytics.getLaborTrend.queryOptions({ input: { days: 30 } }),
	);

	// By role for selected range
	const { data: laborByRole, isLoading: loadingRole } = useQuery(
		orpc.analytics.getLaborByRole.queryOptions({
			input: { startDate, endDate },
		}),
	);

	// Today's details
	const { data: todayDetails, isLoading: loadingToday } = useQuery(
		orpc.analytics.getLaborDetails.queryOptions({
			input: { startDate: today, endDate: today },
		}),
	);

	// This week details
	const weekStart = startOfWeekGY();
	const { data: weekDetails, isLoading: loadingWeek } = useQuery(
		orpc.analytics.getLaborDetails.queryOptions({
			input: { startDate: weekStart, endDate: today },
		}),
	);

	const isLoading =
		loadingDetails ||
		loadingTrend ||
		loadingRole ||
		loadingToday ||
		loadingWeek;

	// Compute revenue per labor hour from the selected range
	const revenuePerLaborHour = useMemo(() => {
		if (!laborDetails) return 0;
		const { totalHours, totalRevenue } = laborDetails.totals;
		return totalHours > 0
			? Math.round((totalRevenue / totalHours) * 100) / 100
			: 0;
	}, [laborDetails]);

	const trendRows = laborTrend || [];
	const _maxTrendCost = Math.max(
		...trendRows.map((r) => r.laborCost),
		...trendRows.map((r) => r.revenue),
		1,
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20 text-muted-foreground">
				Loading labor dashboard...
			</div>
		);
	}

	const todayPct = todayDetails?.totals.laborPercent ?? 0;
	const weekPct = weekDetails?.totals.laborPercent ?? 0;
	const monthPct = laborDetails?.totals.laborPercent ?? 0;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-xl sm:text-2xl">
						<DollarSign className="size-5" />
						Labor Cost Dashboard
					</h1>
					<p className="text-muted-foreground text-sm">
						Track labor costs against revenue -- target: 30% or less
					</p>
				</div>
			</div>

			{/* Date Range Picker */}
			<Card>
				<CardContent className="flex flex-wrap items-end gap-4 pt-4">
					<div className="flex flex-col gap-1">
						<label
							htmlFor="labor-start"
							className="font-medium text-muted-foreground text-xs"
						>
							Start Date
						</label>
						<input
							id="labor-start"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-3 text-sm"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="labor-end"
							className="font-medium text-muted-foreground text-xs"
						>
							End Date
						</label>
						<input
							id="labor-end"
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-3 text-sm"
						/>
					</div>
					<div className="flex gap-1">
						<Button
							size="sm"
							variant="outline"
							className="h-9 text-xs"
							onClick={() => {
								setStartDate(today);
								setEndDate(today);
							}}
						>
							Today
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-9 text-xs"
							onClick={() => {
								setStartDate(weekStart);
								setEndDate(today);
							}}
						>
							This Week
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-9 text-xs"
							onClick={() => {
								setStartDate(monthStart);
								setEndDate(today);
							}}
						>
							This Month
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* KPI Cards */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Today&apos;s Labor %
						</CardTitle>
						<Clock className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className={`font-bold text-lg sm:text-2xl ${laborColor(todayPct)}`}
						>
							{todayPct.toFixed(1)}%
						</div>
						<p className="text-muted-foreground text-xs">
							{formatGYD(todayDetails?.totals.totalCost ?? 0)} cost
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							This Week %
						</CardTitle>
						<TrendingUp className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className={`font-bold text-lg sm:text-2xl ${laborColor(weekPct)}`}
						>
							{weekPct.toFixed(1)}%
						</div>
						<p className="text-muted-foreground text-xs">
							{(weekDetails?.totals.totalHours ?? 0).toFixed(1)}h worked
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							This Month %
						</CardTitle>
						<Users className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className={`font-bold text-lg sm:text-2xl ${laborColor(monthPct)}`}
						>
							{monthPct.toFixed(1)}%
						</div>
						<p className="text-muted-foreground text-xs">
							{formatGYD(laborDetails?.totals.totalRevenue ?? 0)} revenue
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Revenue / Labor Hr
						</CardTitle>
						<DollarSign className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg sm:text-2xl">
							{formatGYD(revenuePerLaborHour)}
						</div>
						<p className="text-muted-foreground text-xs">
							{(laborDetails?.totals.totalHours ?? 0).toFixed(1)}h total
						</p>
					</CardContent>
				</Card>
			</div>

			{/* 30-Day Trend Chart */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-1">
						<CardTitle className="flex items-center gap-2 text-base">
							<TrendingUp className="size-4" />
							30-Day Labor % Trend
						</CardTitle>
						<CardDescription className="text-xs">
							Daily labor cost as percentage of revenue -- target line at 30%
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent>
					{trendRows.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No trend data available.
						</p>
					) : (
						<div className="flex flex-col gap-1">
							{trendRows.map((row) => {
								const pct = row.laborPercent;
								const barWidth = Math.min(pct, 100);
								const targetPos = 30; // 30% target line
								return (
									<div
										key={row.date}
										className="flex items-center gap-2 text-xs"
									>
										<span className="w-16 shrink-0 font-mono text-muted-foreground">
											{row.date.slice(5)}
										</span>
										<div className="relative flex-1">
											<div
												className={`h-5 rounded-sm transition-all ${laborBg(pct)}`}
												style={{ width: `${Math.max(barWidth, 0.5)}%` }}
											/>
											{/* 30% target line */}
											<div
												className="absolute top-0 h-5 w-px border-muted-foreground/50 border-l-2 border-dashed"
												style={{ left: `${targetPos}%` }}
												title="30% target"
											/>
										</div>
										<span
											className={`w-14 shrink-0 text-right font-medium font-mono ${laborColor(pct)}`}
										>
											{pct.toFixed(1)}%
										</span>
										<span className="w-24 shrink-0 text-right font-mono text-muted-foreground">
											{formatGYD(row.laborCost)}
										</span>
									</div>
								);
							})}
							{/* Legend */}
							<div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
								<span className="flex items-center gap-1">
									<span className="inline-block size-2 rounded-full bg-green-500" />{" "}
									&lt;25%
								</span>
								<span className="flex items-center gap-1">
									<span className="inline-block size-2 rounded-full bg-amber-500" />{" "}
									25-35%
								</span>
								<span className="flex items-center gap-1">
									<span className="inline-block size-2 rounded-full bg-red-500" />{" "}
									&gt;35%
								</span>
								<span className="flex items-center gap-1">
									<span className="inline-block h-3 w-px border-muted-foreground/50 border-l-2 border-dashed" />{" "}
									30% target
								</span>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Employee Breakdown + Role Summary */}
			<div className="grid gap-4 lg:grid-cols-3">
				{/* Employee Breakdown Table */}
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Users className="size-4" />
							Employee Breakdown
						</CardTitle>
						<CardDescription className="text-xs">
							{startDate} to {endDate}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{!laborDetails?.employees.length ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No employee data for this period.
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-left text-muted-foreground text-xs">
											<th className="pr-4 pb-2 font-medium">Name</th>
											<th className="pr-4 pb-2 font-medium">Role</th>
											<th className="pr-4 pb-2 text-right font-medium">
												Hours
											</th>
											<th className="pr-4 pb-2 text-right font-medium">Cost</th>
											<th className="pb-2 text-right font-medium">Cost/Hour</th>
										</tr>
									</thead>
									<tbody>
										{laborDetails.employees.map((emp, i) => {
											const costPerHour =
												emp.hours > 0 ? emp.cost / emp.hours : 0;
											return (
												<tr
													key={i}
													className="border-border/50 border-b last:border-0"
												>
													<td className="py-1.5 pr-4 font-medium">
														{emp.name}
													</td>
													<td className="py-1.5 pr-4">
														<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] capitalize">
															{emp.role}
														</span>
													</td>
													<td className="py-1.5 pr-4 text-right font-mono">
														{emp.hours.toFixed(1)}h
													</td>
													<td className="py-1.5 pr-4 text-right font-mono">
														{formatGYD(emp.cost)}
													</td>
													<td className="py-1.5 text-right font-mono">
														{formatGYD(Math.round(costPerHour))}
													</td>
												</tr>
											);
										})}
									</tbody>
									<tfoot>
										<tr className="border-t-2 font-bold">
											<td className="pt-2 pr-4" colSpan={2}>
												Total
											</td>
											<td className="pt-2 pr-4 text-right font-mono">
												{laborDetails.totals.totalHours.toFixed(1)}h
											</td>
											<td className="pt-2 pr-4 text-right font-mono">
												{formatGYD(laborDetails.totals.totalCost)}
											</td>
											<td className="pt-2 text-right font-mono">
												{formatGYD(
													laborDetails.totals.totalHours > 0
														? Math.round(
																laborDetails.totals.totalCost /
																	laborDetails.totals.totalHours,
															)
														: 0,
												)}
											</td>
										</tr>
									</tfoot>
								</table>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Role Summary Cards */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">By Role</CardTitle>
						<CardDescription className="text-xs">
							Hours and cost per role
						</CardDescription>
					</CardHeader>
					<CardContent>
						{!laborByRole?.length ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No role data.
							</p>
						) : (
							<div className="flex flex-col gap-3">
								{laborByRole.map((role) => (
									<div key={role.role} className="rounded-md border p-3">
										<div className="flex items-center justify-between">
											<span className="font-semibold text-sm capitalize">
												{role.role}
											</span>
											<span className="text-muted-foreground text-xs">
												{role.headcount} staff
											</span>
										</div>
										<div className="mt-2 grid grid-cols-2 gap-2 text-xs">
											<div>
												<div className="font-bold font-mono">
													{role.hours.toFixed(1)}h
												</div>
												<div className="text-muted-foreground">Hours</div>
											</div>
											<div className="text-right">
												<div className="font-bold font-mono">
													{formatGYD(role.cost)}
												</div>
												<div className="text-muted-foreground">Cost</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Month summary alert if over target */}
			{monthPct > 30 && (
				<Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
					<CardContent className="flex items-center gap-3 pt-4">
						<AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
						<div>
							<div className="font-semibold text-amber-800 text-sm dark:text-amber-300">
								Labor cost above target
							</div>
							<div className="text-amber-700 text-xs dark:text-amber-400">
								This month&apos;s labor is at {monthPct.toFixed(1)}% of revenue,
								above the 30% industry target. Consider reviewing schedules or
								increasing sales during high-labor shifts.
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
