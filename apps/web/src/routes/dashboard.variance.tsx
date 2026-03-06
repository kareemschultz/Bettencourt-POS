import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	GitCompareArrows,
	Loader2,
	Search,
	TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface VarianceRow {
	ingredient_name: string;
	ingredient_id: string;
	expected_usage: number;
	actual_usage: number;
	logged_waste: number;
	unaccounted: number;
	variance_percent: number;
	cost_impact: number;
	unit: string;
}

function varianceColor(pct: number): string {
	const abs = Math.abs(pct);
	if (abs < 5) return "text-green-600 dark:text-green-400";
	if (abs <= 10) return "text-amber-600 dark:text-amber-400";
	return "text-red-600 dark:text-red-400";
}

function varianceBg(pct: number): string {
	const abs = Math.abs(pct);
	if (abs < 5) return "";
	if (abs <= 10) return "bg-amber-50 dark:bg-amber-950/20";
	return "bg-red-50 dark:bg-red-950/20";
}

export default function VarianceAnalysisPage() {
	const today = todayGY();
	const monthStart = `${today.slice(0, 7)}-01`;

	const [startDate, setStartDate] = useState(monthStart);
	const [endDate, setEndDate] = useState(today);

	const startTs = `${startDate}T00:00:00-04:00`;
	const endTs = `${endDate}T23:59:59-04:00`;

	const { data: varianceData, isLoading: loadingVariance } = useQuery(
		orpc.reports.getVarianceAnalysis.queryOptions({
			input: { startDate: startTs, endDate: endTs },
		}),
	);

	const { data: alertData, isLoading: loadingAlerts } = useQuery(
		orpc.reports.getVarianceAlerts.queryOptions({
			input: { startDate: startTs, endDate: endTs, threshold: 10 },
		}),
	);

	const isLoading = loadingVariance || loadingAlerts;
	const rows = (varianceData ?? []) as unknown as VarianceRow[];
	const alerts = (alertData ?? []) as unknown as VarianceRow[];

	// Sort by abs(costImpact) desc
	const sortedRows = useMemo(() => {
		return [...rows].sort(
			(a, b) =>
				Math.abs(Number(b.cost_impact)) - Math.abs(Number(a.cost_impact)),
		);
	}, [rows]);

	// Summary calculations
	const summary = useMemo(() => {
		if (!rows.length)
			return { totalUnaccounted: 0, itemsOverThreshold: 0, avgVariancePct: 0 };
		const totalUnaccounted = rows.reduce(
			(s, r) => s + Number(r.cost_impact),
			0,
		);
		const itemsOverThreshold = alerts.length;
		const avgVariancePct =
			rows.length > 0
				? rows.reduce((s, r) => s + Math.abs(Number(r.variance_percent)), 0) /
					rows.length
				: 0;
		return { totalUnaccounted, itemsOverThreshold, avgVariancePct };
	}, [rows, alerts]);

	function avgColor(pct: number): string {
		if (pct < 5) return "text-green-600 dark:text-green-400";
		if (pct <= 10) return "text-amber-600 dark:text-amber-400";
		return "text-red-600 dark:text-red-400";
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<GitCompareArrows className="size-6" />
						COGS Variance Analysis
					</h1>
					<p className="text-muted-foreground">
						Compare expected vs actual ingredient usage to identify shrinkage
					</p>
				</div>
			</div>

			{/* Date Range Picker */}
			<Card>
				<CardContent className="flex flex-wrap items-end gap-4 pt-4">
					<div className="flex flex-col gap-1">
						<label
							htmlFor="variance-start"
							className="font-medium text-muted-foreground text-xs"
						>
							Start Date
						</label>
						<input
							id="variance-start"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-3 text-sm"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="variance-end"
							className="font-medium text-muted-foreground text-xs"
						>
							End Date
						</label>
						<input
							id="variance-end"
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
								const weekStart = (() => {
									const now = new Date(
										new Date().toLocaleString("en-US", {
											timeZone: "America/Guyana",
										}),
									);
									const day = now.getDay();
									const diff = now.getDate() - day + (day === 0 ? -6 : 1);
									const monday = new Date(now.setDate(diff));
									return monday.toISOString().split("T")[0];
								})();
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

			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					{/* Summary Cards */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
									<TrendingDown className="size-4" />
									Total Unaccounted Variance
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p
									className={`font-bold text-2xl ${summary.totalUnaccounted > 0 ? "text-red-600 dark:text-red-400" : summary.totalUnaccounted < 0 ? "text-green-600 dark:text-green-400" : "text-foreground"}`}
								>
									{formatGYD(Math.abs(summary.totalUnaccounted))}
								</p>
								<p className="text-muted-foreground text-xs">
									{summary.totalUnaccounted > 0
										? "Over-usage (loss)"
										: summary.totalUnaccounted < 0
											? "Under-usage (gain)"
											: "No variance"}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
									<AlertTriangle className="size-4" />
									Items Over Threshold
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex items-center gap-2">
									<p className="font-bold text-2xl">
										{summary.itemsOverThreshold}
									</p>
									{summary.itemsOverThreshold > 0 && (
										<Badge variant="destructive">
											{summary.itemsOverThreshold} alert
											{summary.itemsOverThreshold !== 1 ? "s" : ""}
										</Badge>
									)}
								</div>
								<p className="text-muted-foreground text-xs">
									Exceeding 10% variance
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
									<GitCompareArrows className="size-4" />
									Average Variance %
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p
									className={`font-bold text-2xl ${avgColor(summary.avgVariancePct)}`}
								>
									{summary.avgVariancePct.toFixed(1)}%
								</p>
								<p className="text-muted-foreground text-xs">
									{summary.avgVariancePct < 5
										? "Within acceptable range"
										: summary.avgVariancePct <= 10
											? "Needs attention"
											: "Critical -- investigate"}
								</p>
							</CardContent>
						</Card>
					</div>

					{/* Variance Table */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<Search className="size-4" />
								Ingredient Variance Detail
							</CardTitle>
							<CardDescription className="text-xs">
								{startDate} to {endDate} -- sorted by cost impact
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Ingredient</TableHead>
											<TableHead className="text-right">Expected</TableHead>
											<TableHead className="text-right">Actual</TableHead>
											<TableHead className="text-right">Waste</TableHead>
											<TableHead className="text-right">Unaccounted</TableHead>
											<TableHead className="text-right">Variance %</TableHead>
											<TableHead className="text-right">Cost Impact</TableHead>
											<TableHead className="text-center">Action</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{sortedRows.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={8}
													className="py-8 text-center text-muted-foreground"
												>
													No variance data for this date range. Ensure recipe
													ingredients are configured.
												</TableCell>
											</TableRow>
										) : (
											sortedRows.map((row) => {
												const pct = Number(row.variance_percent);
												return (
													<TableRow
														key={row.ingredient_id}
														className={varianceBg(pct)}
													>
														<TableCell className="font-medium">
															{row.ingredient_name}
															<span className="ml-1 text-muted-foreground text-xs">
																({row.unit})
															</span>
														</TableCell>
														<TableCell className="text-right font-mono">
															{Number(row.expected_usage).toFixed(2)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{Number(row.actual_usage).toFixed(2)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{Number(row.logged_waste).toFixed(2)}
														</TableCell>
														<TableCell className="text-right font-mono font-semibold">
															{Number(row.unaccounted).toFixed(2)}
														</TableCell>
														<TableCell
															className={`text-right font-mono font-semibold ${varianceColor(pct)}`}
														>
															{pct > 0 ? "+" : ""}
															{pct.toFixed(1)}%
														</TableCell>
														<TableCell
															className={`text-right font-mono font-semibold ${Number(row.cost_impact) > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
														>
															{formatGYD(Math.abs(Number(row.cost_impact)))}
														</TableCell>
														<TableCell className="text-center">
															<Button
																size="sm"
																variant="ghost"
																className="h-7 text-xs"
																onClick={() => {
																	window.location.href = `/dashboard/inventory?tab=ledger&item=${row.ingredient_id}`;
																}}
															>
																Investigate
															</Button>
														</TableCell>
													</TableRow>
												);
											})
										)}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>

					{/* Alert Section */}
					{alerts.length > 0 && (
						<Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
							<CardContent className="flex items-start gap-3 pt-4">
								<AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
								<div>
									<div className="font-semibold text-amber-800 text-sm dark:text-amber-300">
										{alerts.length} ingredient{alerts.length !== 1 ? "s" : ""}{" "}
										exceed{alerts.length === 1 ? "s" : ""} 10% variance
										threshold
									</div>
									<div className="mt-1 text-amber-700 text-xs dark:text-amber-400">
										The following items have significant unaccounted usage and
										should be investigated for potential shrinkage, theft, or
										recipe portioning issues:
									</div>
									<ul className="mt-2 space-y-1">
										{alerts.map((a) => (
											<li
												key={a.ingredient_id}
												className="flex items-center gap-2 text-amber-800 text-xs dark:text-amber-300"
											>
												<span className="font-medium">{a.ingredient_name}</span>
												<Badge
													variant="outline"
													className="border-amber-400 text-amber-700 dark:text-amber-300"
												>
													{Number(a.variance_percent) > 0 ? "+" : ""}
													{Number(a.variance_percent).toFixed(1)}%
												</Badge>
												<span className="text-amber-600 dark:text-amber-400">
													({formatGYD(Math.abs(Number(a.cost_impact)))} impact)
												</span>
											</li>
										))}
									</ul>
								</div>
							</CardContent>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
