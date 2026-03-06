import { useQuery } from "@tanstack/react-query";
import {
	ArrowUpDown,
	DollarSign,
	Download,
	Loader2,
	Percent,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type SortKey =
	| "name"
	| "department"
	| "units_sold"
	| "revenue"
	| "total_cost"
	| "margin"
	| "margin_percent"
	| "food_cost_percent"
	| "abc";
type SortDir = "asc" | "desc";

interface ProductRow {
	id: string;
	name: string;
	department: string;
	units_sold: number;
	revenue: number;
	total_cost: number;
	margin: number;
	margin_percent: number;
	food_cost_percent: number;
	abc: "A" | "B" | "C";
}

interface DepartmentRow {
	department: string;
	units_sold: number;
	revenue: number;
	total_cost: number;
	margin: number;
	margin_percent: number;
	food_cost_percent: number;
}

export default function ProfitabilityPage() {
	const today = todayGY();
	// Default to current month
	const monthStart = `${today.slice(0, 7)}-01`;

	const [startDate, setStartDate] = useState(monthStart);
	const [endDate, setEndDate] = useState(today);
	const [view, setView] = useState<"product" | "department">("product");
	const [sortKey, setSortKey] = useState<SortKey>("revenue");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	const startTs = `${startDate}T00:00:00-04:00`;
	const endTs = `${endDate}T23:59:59-04:00`;

	const { data: productData, isLoading: loadingProducts } = useQuery(
		orpc.reports.getMenuProfitability.queryOptions({
			input: { startDate: startTs, endDate: endTs },
		}),
	);

	const { data: deptData, isLoading: loadingDepts } = useQuery(
		orpc.reports.getDepartmentProfitability.queryOptions({
			input: { startDate: startTs, endDate: endTs },
		}),
	);

	const isLoading = loadingProducts || loadingDepts;
	const products = (productData ?? []) as ProductRow[];
	const departments = (deptData ?? []) as unknown as DepartmentRow[];

	// Summary calculations
	const summary = useMemo(() => {
		if (!products.length)
			return {
				foodCostPct: 0,
				avgMarginPct: 0,
				best: null as ProductRow | null,
				worst: null as ProductRow | null,
			};
		const totalRevenue = products.reduce((s, p) => s + Number(p.revenue), 0);
		const totalCost = products.reduce((s, p) => s + Number(p.total_cost), 0);
		const foodCostPct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
		const avgMarginPct =
			totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
		const sorted = [...products].sort(
			(a, b) => Number(b.margin_percent) - Number(a.margin_percent),
		);
		const best = sorted[0] ?? null;
		const worst = sorted[sorted.length - 1] ?? null;
		return { foodCostPct, avgMarginPct, best, worst };
	}, [products]);

	// Sorted products
	const sortedProducts = useMemo(() => {
		const rows = [...products];
		rows.sort((a, b) => {
			const aVal = a[sortKey];
			const bVal = b[sortKey];
			if (typeof aVal === "number" && typeof bVal === "number") {
				return sortDir === "asc" ? aVal - bVal : bVal - aVal;
			}
			const aStr = String(aVal);
			const bStr = String(bVal);
			return sortDir === "asc"
				? aStr.localeCompare(bStr)
				: bStr.localeCompare(aStr);
		});
		return rows;
	}, [products, sortKey, sortDir]);

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDir(sortDir === "asc" ? "desc" : "asc");
		} else {
			setSortKey(key);
			setSortDir("desc");
		}
	}

	function marginColor(pct: number): string {
		const v = Number(pct);
		if (v > 60) return "text-green-600 dark:text-green-400";
		if (v >= 40) return "text-amber-600 dark:text-amber-400";
		return "text-red-600 dark:text-red-400";
	}

	function abcBadge(abc: string) {
		if (abc === "A")
			return (
				<Badge className="border-green-300 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
					A
				</Badge>
			);
		if (abc === "B")
			return (
				<Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
					B
				</Badge>
			);
		return (
			<Badge className="border-red-300 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
				C
			</Badge>
		);
	}

	function exportCSV() {
		if (view === "product") {
			if (!products.length) {
				toast.error("No data to export");
				return;
			}
			const header =
				"Product,Department,Units Sold,Revenue,Cost,Margin,Margin %,Food Cost %,ABC";
			const rows = sortedProducts.map(
				(p) =>
					`"${p.name}","${p.department}",${Number(p.units_sold)},${Number(p.revenue).toFixed(2)},${Number(p.total_cost).toFixed(2)},${Number(p.margin).toFixed(2)},${Number(p.margin_percent).toFixed(1)},${Number(p.food_cost_percent).toFixed(1)},${p.abc}`,
			);
			const csvContent = [header, ...rows].join("\n");
			downloadCSV(
				csvContent,
				`menu-profitability-${startDate}-to-${endDate}.csv`,
			);
		} else {
			if (!departments.length) {
				toast.error("No data to export");
				return;
			}
			const header =
				"Department,Units Sold,Revenue,Cost,Margin,Margin %,Food Cost %";
			const rows = departments.map(
				(d) =>
					`"${d.department}",${Number(d.units_sold)},${Number(d.revenue).toFixed(2)},${Number(d.total_cost).toFixed(2)},${Number(d.margin).toFixed(2)},${Number(d.margin_percent).toFixed(1)},${Number(d.food_cost_percent).toFixed(1)}`,
			);
			const csvContent = [header, ...rows].join("\n");
			downloadCSV(
				csvContent,
				`department-profitability-${startDate}-to-${endDate}.csv`,
			);
		}
		toast.success("CSV exported successfully");
	}

	function downloadCSV(content: string, filename: string) {
		const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	const SortHeader = ({
		label,
		sortField,
	}: {
		label: string;
		sortField: SortKey;
	}) => (
		<TableHead
			className="cursor-pointer select-none hover:bg-muted/50"
			onClick={() => toggleSort(sortField)}
		>
			<span className="flex items-center gap-1">
				{label}
				<ArrowUpDown className="size-3 text-muted-foreground" />
			</span>
		</TableHead>
	);

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<TrendingUp className="size-6" /> Menu Item Profitability
					</h1>
					<p className="text-muted-foreground">
						Analyze profit margins and food cost percentages across your menu.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Input
						type="date"
						value={startDate}
						onChange={(e) => setStartDate(e.target.value)}
						className="w-auto"
						aria-label="Start date"
					/>
					<span className="text-muted-foreground">to</span>
					<Input
						type="date"
						value={endDate}
						onChange={(e) => setEndDate(e.target.value)}
						className="w-auto"
						aria-label="End date"
					/>
					<Button variant="outline" className="gap-2" onClick={exportCSV}>
						<Download className="size-4" /> CSV
					</Button>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					{/* Summary Cards */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
									<Percent className="size-4" /> Overall Food Cost %
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p
									className={`font-bold text-2xl ${marginColor(100 - summary.foodCostPct)}`}
								>
									{summary.foodCostPct.toFixed(1)}%
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
									<DollarSign className="size-4" /> Avg Margin %
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p
									className={`font-bold text-2xl ${marginColor(summary.avgMarginPct)}`}
								>
									{summary.avgMarginPct.toFixed(1)}%
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
									<TrendingUp className="size-4" /> Best Performer
								</CardTitle>
							</CardHeader>
							<CardContent>
								{summary.best ? (
									<>
										<p className="truncate font-bold text-lg">
											{summary.best.name}
										</p>
										<p className="text-green-600 text-sm dark:text-green-400">
											{Number(summary.best.margin_percent).toFixed(1)}% margin
										</p>
									</>
								) : (
									<p className="text-muted-foreground">No data</p>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
									<TrendingDown className="size-4" /> Worst Performer
								</CardTitle>
							</CardHeader>
							<CardContent>
								{summary.worst ? (
									<>
										<p className="truncate font-bold text-lg">
											{summary.worst.name}
										</p>
										<p className="text-red-600 text-sm dark:text-red-400">
											{Number(summary.worst.margin_percent).toFixed(1)}% margin
										</p>
									</>
								) : (
									<p className="text-muted-foreground">No data</p>
								)}
							</CardContent>
						</Card>
					</div>

					{/* View Toggle */}
					<div className="flex items-center gap-2">
						<Button
							variant={view === "product" ? "default" : "outline"}
							size="sm"
							onClick={() => setView("product")}
						>
							By Product
						</Button>
						<Button
							variant={view === "department" ? "default" : "outline"}
							size="sm"
							onClick={() => setView("department")}
						>
							By Department
						</Button>
					</div>

					{/* Product View */}
					{view === "product" && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">
									Product Profitability
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<SortHeader label="Product" sortField="name" />
												<SortHeader label="Dept" sortField="department" />
												<SortHeader label="Units" sortField="units_sold" />
												<SortHeader label="Revenue" sortField="revenue" />
												<SortHeader label="Cost" sortField="total_cost" />
												<SortHeader label="Margin $" sortField="margin" />
												<SortHeader
													label="Margin %"
													sortField="margin_percent"
												/>
												<SortHeader
													label="Food Cost %"
													sortField="food_cost_percent"
												/>
												<SortHeader label="ABC" sortField="abc" />
											</TableRow>
										</TableHeader>
										<TableBody>
											{sortedProducts.length === 0 ? (
												<TableRow>
													<TableCell
														colSpan={9}
														className="py-8 text-center text-muted-foreground"
													>
														No profitability data for this date range.
													</TableCell>
												</TableRow>
											) : (
												sortedProducts.map((p) => (
													<TableRow key={p.id}>
														<TableCell className="font-medium">
															{p.name}
														</TableCell>
														<TableCell>{p.department}</TableCell>
														<TableCell className="text-right font-mono">
															{Number(p.units_sold)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatGYD(Number(p.revenue))}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatGYD(Number(p.total_cost))}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatGYD(Number(p.margin))}
														</TableCell>
														<TableCell
															className={`text-right font-mono font-semibold ${marginColor(Number(p.margin_percent))}`}
														>
															{Number(p.margin_percent).toFixed(1)}%
														</TableCell>
														<TableCell className="text-right font-mono">
															{Number(p.food_cost_percent).toFixed(1)}%
														</TableCell>
														<TableCell className="text-center">
															{abcBadge(p.abc)}
														</TableCell>
													</TableRow>
												))
											)}
										</TableBody>
									</Table>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Department View */}
					{view === "department" && (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{departments.length === 0 ? (
								<Card className="col-span-full">
									<CardContent className="py-8 text-center text-muted-foreground">
										No department data for this date range.
									</CardContent>
								</Card>
							) : (
								departments.map((d) => (
									<Card key={d.department}>
										<CardHeader className="pb-2">
											<CardTitle className="text-lg">{d.department}</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2">
											<div className="flex justify-between">
												<span className="text-muted-foreground text-sm">
													Revenue
												</span>
												<span className="font-mono font-semibold">
													{formatGYD(Number(d.revenue))}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground text-sm">
													Cost
												</span>
												<span className="font-mono">
													{formatGYD(Number(d.total_cost))}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground text-sm">
													Margin
												</span>
												<span
													className={`font-mono font-semibold ${marginColor(Number(d.margin_percent))}`}
												>
													{formatGYD(Number(d.margin))} (
													{Number(d.margin_percent).toFixed(1)}%)
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground text-sm">
													Food Cost %
												</span>
												<span className="font-mono">
													{Number(d.food_cost_percent).toFixed(1)}%
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground text-sm">
													Units Sold
												</span>
												<span className="font-mono">
													{Number(d.units_sold)}
												</span>
											</div>
										</CardContent>
									</Card>
								))
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
