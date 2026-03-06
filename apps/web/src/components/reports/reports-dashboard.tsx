import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDownAZ,
	Ban,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Download,
	LayoutGrid,
	LineChart as LineChartIcon,
	Package,
	Printer,
	User,
} from "lucide-react";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface ReportsDashboardProps {
	departmentTotals: Record<string, unknown>[];
	productSales: Record<string, unknown>[];
	dailySales: Record<string, unknown>[];
	paymentMethods: Record<string, unknown>[];
	cashierActivity: Record<string, unknown>[];
}

function fmt(n: number) {
	return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

type SortMode = "alphabetical" | "department";

export function ReportsDashboard({
	departmentTotals,
	productSales,
	dailySales,
	paymentMethods,
	cashierActivity,
}: ReportsDashboardProps) {
	const [productSortMode, setProductSortMode] =
		useState<SortMode>("department");
	const [expandedCashier, setExpandedCashier] = useState<string | null>(null);
	const [reportTab, setReportTab] = useState("overview");

	const totalRevenue = departmentTotals.reduce(
		(s, d) => s + Number(d.revenue || 0),
		0,
	);
	const totalOrders = departmentTotals.reduce(
		(s, d) => s + Number(d.order_count || 0),
		0,
	);
	const totalItems = departmentTotals.reduce(
		(s, d) => s + Number(d.items_sold || 0),
		0,
	);

	const deptChartData = departmentTotals.map((d) => ({
		name: (d.department as string) || "Uncategorized",
		revenue: Number(d.revenue || 0),
		items: Number(d.items_sold || 0),
	}));

	const dailyChartData = dailySales.map((d) => ({
		date: new Date(d.date as string).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		}),
		revenue: Number(d.revenue || 0),
		orders: Number(d.orders || 0),
	}));

	const paymentChartData = paymentMethods.map((p) => ({
		name:
			((p.method as string) || "").charAt(0).toUpperCase() +
			((p.method as string) || "").slice(1),
		value: Number(p.total || p.total_amount || 0),
	}));

	// Sort products based on mode
	const sortedProducts = [...productSales].sort((a, b) => {
		if (productSortMode === "alphabetical") {
			return ((a.product_name as string) || "").localeCompare(
				(b.product_name as string) || "",
			);
		}
		const deptCmp = ((a.department as string) || "").localeCompare(
			(b.department as string) || "",
		);
		if (deptCmp !== 0) return deptCmp;
		return ((a.product_name as string) || "").localeCompare(
			(b.product_name as string) || "",
		);
	});

	// Group by department for grouped view
	const productsByDept: Record<string, typeof productSales> = {};
	if (productSortMode === "department") {
		for (const p of sortedProducts) {
			const dept = (p.department as string) || "Uncategorized";
			if (!productsByDept[dept]) productsByDept[dept] = [];
			productsByDept[dept].push(p);
		}
	}

	// Cashier chart data
	const cashierChartData = cashierActivity.map((c) => ({
		name: (c.cashier_name as string) || "Unknown",
		revenue: Number(c.total_revenue || 0),
		orders: Number(c.orders_processed || 0),
	}));

	function exportCSV() {
		const rows = [
			["Department", "Orders", "Items Sold", "Revenue"],
			...departmentTotals.map((d) => [
				d.department || "Uncategorized",
				d.order_count || 0,
				d.items_sold || 0,
				Number(d.revenue || 0),
			]),
			["TOTAL", totalOrders, totalItems, totalRevenue],
			[""],
			["Product", "Department", "Qty Sold", "Revenue"],
			...productSales.map((p) => [
				p.product_name,
				p.department || "Uncategorized",
				p.quantity_sold || 0,
				Number(p.revenue || 0),
			]),
			[""],
			["Cashier", "Bills", "Revenue", "Avg Order"],
			...cashierActivity.map((c) => [
				c.cashier_name,
				c.orders_processed || 0,
				Number(c.total_revenue || 0),
				Number(c.orders_processed || 0) > 0
					? Math.round(
							Number(c.total_revenue || 0) / Number(c.orders_processed),
						)
					: 0,
			]),
		];
		const csv = rows.map((r) => r.join(",")).join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `bettencourt-report-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Header + Export Actions */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-semibold text-foreground text-lg">Sales Reports</h2>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5 text-xs"
						onClick={exportCSV}
					>
						<Download className="size-3.5" />
						Export CSV
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5 text-xs"
						onClick={() => window.print()}
					>
						<Printer className="size-3.5" />
						Print Z-Report
					</Button>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Total Revenue
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl text-foreground">
							{formatGYD(totalRevenue)}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Total Orders
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl text-foreground">{totalOrders}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Items Sold
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl text-foreground">{totalItems}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">
							Avg Order
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl text-foreground">
							{totalOrders > 0 ? formatGYD(totalRevenue / totalOrders) : "$0"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Report Tabs */}
			<Tabs value={reportTab} onValueChange={setReportTab}>
				<TabsList className="w-full justify-start overflow-x-auto">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="cashier" className="gap-1.5">
						<User className="size-3.5" />
						Sales by Cashier
					</TabsTrigger>
					<TabsTrigger value="products">Product Sales</TabsTrigger>
					<TabsTrigger value="voids" className="gap-1.5">
						<Ban className="size-3.5" />
						Voids/Refunds
					</TabsTrigger>
					<TabsTrigger value="production" className="gap-1.5">
						<Package className="size-3.5" />
						Production
					</TabsTrigger>
					<TabsTrigger value="trends" className="gap-1.5">
						<LineChartIcon className="size-3.5" />
						Trends
					</TabsTrigger>
				</TabsList>

				{/* =========== Overview Tab =========== */}
				<TabsContent value="overview" className="mt-4 flex flex-col gap-6">
					{/* Charts Row */}
					<div className="grid gap-6 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Daily Sales</CardTitle>
							</CardHeader>
							<CardContent>
								{dailyChartData.length > 0 ? (
									<ResponsiveContainer width="100%" height={250}>
										<BarChart data={dailyChartData}>
											<CartesianGrid
												strokeDasharray="3 3"
												className="stroke-border"
											/>
											<XAxis dataKey="date" className="text-xs" />
											<YAxis
												className="text-xs"
												tickFormatter={(v) => `$${v}`}
											/>
											<Tooltip
												formatter={(value) => formatGYD(Number(value))}
											/>
											<Bar
												dataKey="revenue"
												fill="var(--chart-1)"
												radius={[4, 4, 0, 0]}
											/>
										</BarChart>
									</ResponsiveContainer>
								) : (
									<p className="py-12 text-center text-muted-foreground text-sm">
										No sales data yet
									</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Payment Methods</CardTitle>
							</CardHeader>
							<CardContent>
								{paymentChartData.length > 0 ? (
									<ResponsiveContainer width="100%" height={250}>
										<PieChart>
											<Pie
												data={paymentChartData}
												cx="50%"
												cy="50%"
												innerRadius={50}
												outerRadius={90}
												paddingAngle={4}
												dataKey="value"
												label={({ name, percent }) =>
													`${name} ${((percent ?? 0) * 100).toFixed(0)}%`
												}
												labelLine={false}
											>
												{paymentChartData.map((_, i) => (
													<Cell
														key={i}
														fill={CHART_COLORS[i % CHART_COLORS.length]}
													/>
												))}
											</Pie>
											<Tooltip
												formatter={(value) => formatGYD(Number(value))}
											/>
										</PieChart>
									</ResponsiveContainer>
								) : (
									<p className="py-12 text-center text-muted-foreground text-sm">
										No payment data yet
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Department Totals */}
					<Card>
						<CardHeader>
							<CardTitle>Department Totals</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto rounded-lg border border-border">
								<Table className="min-w-[480px]">
									<TableHeader>
										<TableRow>
											<TableHead>Department</TableHead>
											<TableHead className="text-right">Orders</TableHead>
											<TableHead className="text-right">Items Sold</TableHead>
											<TableHead className="text-right">Revenue</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{departmentTotals.length === 0 ? (
											<TableRow>
												<TableCell colSpan={4} className="h-16 text-center">
													No data
												</TableCell>
											</TableRow>
										) : (
											<>
												{departmentTotals.map((row, i) => (
													<TableRow key={i}>
														<TableCell className="font-medium">
															{(row.department as string) || "Uncategorized"}
														</TableCell>
														<TableCell className="text-right">
															{String(row.order_count || 0)}
														</TableCell>
														<TableCell className="text-right">
															{String(row.items_sold || 0)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatGYD(Number(row.revenue || 0))}
														</TableCell>
													</TableRow>
												))}
												<TableRow className="bg-muted/50 font-bold">
													<TableCell>Grand Total</TableCell>
													<TableCell className="text-right">
														{totalOrders}
													</TableCell>
													<TableCell className="text-right">
														{totalItems}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatGYD(totalRevenue)}
													</TableCell>
												</TableRow>
											</>
										)}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>

					{/* Revenue by Department Bar Chart */}
					{deptChartData.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Revenue by Department</CardTitle>
							</CardHeader>
							<CardContent>
								<ResponsiveContainer
									width="100%"
									height={Math.max(300, deptChartData.length * 40)}
								>
									<BarChart data={deptChartData} layout="vertical">
										<CartesianGrid
											strokeDasharray="3 3"
											className="stroke-border"
										/>
										<XAxis
											type="number"
											className="text-xs"
											tickFormatter={(v) => `$${v}`}
										/>
										<YAxis
											dataKey="name"
											type="category"
											width={100}
											className="text-[10px] sm:text-xs"
										/>
										<Tooltip formatter={(value) => formatGYD(Number(value))} />
										<Bar
											dataKey="revenue"
											fill="var(--chart-2)"
											radius={[0, 4, 4, 0]}
										/>
									</BarChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* =========== Sales by Cashier Tab =========== */}
				<TabsContent value="cashier" className="mt-4 flex flex-col gap-6">
					{cashierChartData.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Revenue by Cashier</CardTitle>
							</CardHeader>
							<CardContent>
								<ResponsiveContainer
									width="100%"
									height={Math.max(200, cashierChartData.length * 50)}
								>
									<BarChart data={cashierChartData} layout="vertical">
										<CartesianGrid
											strokeDasharray="3 3"
											className="stroke-border"
										/>
										<XAxis
											type="number"
											className="text-xs"
											tickFormatter={(v) => `$${v}`}
										/>
										<YAxis
											dataKey="name"
											type="category"
											width={100}
											className="text-[10px] sm:text-xs"
										/>
										<Tooltip formatter={(value) => formatGYD(Number(value))} />
										<Bar
											dataKey="revenue"
											fill="var(--chart-1)"
											radius={[0, 4, 4, 0]}
										/>
									</BarChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader>
							<CardTitle>Cashier Breakdown</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto rounded-lg border border-border">
								<Table className="min-w-[520px]">
									<TableHeader>
										<TableRow>
											<TableHead className="w-8" />
											<TableHead>Cashier</TableHead>
											<TableHead className="text-right">Bills</TableHead>
											<TableHead className="text-right">Revenue</TableHead>
											<TableHead className="text-right">Avg Order</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{cashierActivity.length === 0 ? (
											<TableRow>
												<TableCell colSpan={5} className="h-16 text-center">
													No cashier data
												</TableCell>
											</TableRow>
										) : (
											<>
												{cashierActivity.map((row, i) => {
													const cashierName = row.cashier_name as string;
													const orders = Number(row.orders_processed || 0);
													const revenue = Number(row.total_revenue || 0);
													const avg = orders > 0 ? revenue / orders : 0;
													const isExpanded = expandedCashier === cashierName;

													return (
														<TableRow
															key={i}
															className="cursor-pointer hover:bg-muted/50"
															onClick={() =>
																setExpandedCashier(
																	isExpanded ? null : cashierName,
																)
															}
														>
															<TableCell className="w-8 px-2">
																{isExpanded ? (
																	<ChevronDown className="size-4 text-muted-foreground" />
																) : (
																	<ChevronRight className="size-4 text-muted-foreground" />
																)}
															</TableCell>
															<TableCell className="font-medium">
																{cashierName}
															</TableCell>
															<TableCell className="text-right">
																{orders}
															</TableCell>
															<TableCell className="text-right font-mono">
																{formatGYD(revenue)}
															</TableCell>
															<TableCell className="text-right font-mono">
																{formatGYD(avg)}
															</TableCell>
														</TableRow>
													);
												})}
												<TableRow className="bg-muted/50 font-bold">
													<TableCell />
													<TableCell>All Cashiers</TableCell>
													<TableCell className="text-right">
														{totalOrders}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatGYD(totalRevenue)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{totalOrders > 0
															? formatGYD(totalRevenue / totalOrders)
															: "$0"}
													</TableCell>
												</TableRow>
											</>
										)}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* =========== Product Sales Tab =========== */}
				<TabsContent value="products" className="mt-4 flex flex-col gap-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle>Product Sales</CardTitle>
							<div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
								<Button
									variant={
										productSortMode === "department" ? "default" : "ghost"
									}
									size="sm"
									className="h-7 gap-1.5 px-2.5 text-xs"
									onClick={() => setProductSortMode("department")}
								>
									<LayoutGrid className="size-3" />
									By Department
								</Button>
								<Button
									variant={
										productSortMode === "alphabetical" ? "default" : "ghost"
									}
									size="sm"
									className="h-7 gap-1.5 px-2.5 text-xs"
									onClick={() => setProductSortMode("alphabetical")}
								>
									<ArrowDownAZ className="size-3" />
									A-Z
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<div className="rounded-lg border border-border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Product</TableHead>
											{productSortMode === "alphabetical" && (
												<TableHead>Department</TableHead>
											)}
											<TableHead className="text-right">Qty Sold</TableHead>
											<TableHead className="text-right">Revenue</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{productSales.length === 0 ? (
											<TableRow>
												<TableCell colSpan={4} className="h-16 text-center">
													No data
												</TableCell>
											</TableRow>
										) : productSortMode === "department" ? (
											Object.entries(productsByDept).map(([dept, products]) => {
												const deptTotal = products.reduce(
													(s, p) => s + Number(p.revenue || 0),
													0,
												);
												const deptQty = products.reduce(
													(s, p) => s + Number(p.quantity_sold || 0),
													0,
												);
												return (
													<TableRow key={`dept-${dept}`} className="contents">
														<TableCell
															colSpan={3}
															className="bg-muted/30 font-semibold text-foreground"
														>
															{dept}
															<span className="ml-2 font-normal text-muted-foreground text-xs">
																({deptQty} items, {formatGYD(deptTotal)})
															</span>
														</TableCell>
														{products.map((row, i) => (
															<TableRow key={`${dept}-${i}`}>
																<TableCell className="pl-6 font-medium">
																	{row.product_name as string}
																</TableCell>
																<TableCell className="text-right">
																	{String(row.quantity_sold || 0)}
																</TableCell>
																<TableCell className="text-right font-mono">
																	{formatGYD(Number(row.revenue || 0))}
																</TableCell>
															</TableRow>
														))}
													</TableRow>
												);
											})
										) : (
											sortedProducts.map((row, i) => (
												<TableRow key={i}>
													<TableCell className="font-medium">
														{row.product_name as string}
													</TableCell>
													<TableCell className="text-muted-foreground text-sm">
														{(row.department as string) || "-"}
													</TableCell>
													<TableCell className="text-right">
														{String(row.quantity_sold || 0)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatGYD(Number(row.revenue || 0))}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* =========== Voids/Refunds Tab =========== */}
				<TabsContent value="voids" className="mt-4 flex flex-col gap-6">
					<VoidRefundReport />
				</TabsContent>

				{/* =========== Production vs Sales Tab =========== */}
				<TabsContent value="production" className="mt-4 flex flex-col gap-6">
					<ProductionReport />
				</TabsContent>

				{/* =========== Trends Tab =========== */}
				<TabsContent value="trends" className="mt-4 flex flex-col gap-6">
					<WeeklyTrendReport />
				</TabsContent>
			</Tabs>
		</div>
	);
}

/* Void/Refund sub-report (oRPC) */
function VoidRefundReport() {
	const sevenDaysAgo = new Date(
		Date.now() - 7 * 24 * 60 * 60 * 1000,
	).toISOString();
	const now = new Date().toISOString();
	const { data } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "voids", startDate: sevenDaysAgo, endDate: now },
		}),
	);

	const result = data as
		| {
				summary?: Record<string, unknown>[];
				details?: Record<string, unknown>[];
		  }
		| undefined;
	const summary = result?.summary || [];
	const details = result?.details || [];

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Void/Refund Summary (Last 7 Days)</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead className="text-right">Count</TableHead>
								<TableHead className="text-right">Total Voided</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{summary.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="py-8 text-center text-muted-foreground"
									>
										No voids or refunds
									</TableCell>
								</TableRow>
							) : (
								summary.map((row: Record<string, unknown>, i: number) => {
									const count = Number(row.void_count || 0);
									const flagged = count > 3;
									return (
										<TableRow key={i}>
											<TableCell className="font-medium">
												{row.user_name as string}
											</TableCell>
											<TableCell className="text-right font-mono">
												{count}
											</TableCell>
											<TableCell className="text-right font-mono">
												{fmt(Number(row.voided_total || 0))}
											</TableCell>
											<TableCell>
												{flagged ? (
													<Badge
														variant="destructive"
														className="gap-1 text-[10px]"
													>
														<AlertTriangle className="size-2.5" /> Flagged
													</Badge>
												) : (
													<Badge variant="secondary" className="text-[10px]">
														Normal
													</Badge>
												)}
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{details.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Recent Void/Refund Details</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Order #</TableHead>
									<TableHead>User</TableHead>
									<TableHead>Type</TableHead>
									<TableHead className="text-right">Amount</TableHead>
									<TableHead>Time</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{details.map((d: Record<string, unknown>, i: number) => (
									<TableRow key={i}>
										<TableCell className="font-medium font-mono text-xs">
											#{d.order_number as string}
										</TableCell>
										<TableCell className="text-sm">
											{d.user_name as string}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													d.status === "voided" ? "destructive" : "outline"
												}
												className="text-[10px]"
											>
												{d.status as string}
											</Badge>
										</TableCell>
										<TableCell className="text-right font-mono">
											{fmt(Number(d.total || 0))}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(d.created_at as string).toLocaleString([], {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</>
	);
}

/* Production vs Sales sub-report */
function ProductionReport() {
	const today = todayGY();
	const { data } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "production", startDate: today, endDate: today },
		}),
	);
	const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Production vs Sales (Today)</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Product</TableHead>
							<TableHead className="text-right">Produced</TableHead>
							<TableHead className="text-right">Closing</TableHead>
							<TableHead className="text-right">Expected</TableHead>
							<TableHead className="text-right">Actual Sold</TableHead>
							<TableHead className="text-right">Variance</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="py-8 text-center text-muted-foreground"
								>
									No production data for today
								</TableCell>
							</TableRow>
						) : (
							items.map((p: Record<string, unknown>, i: number) => {
								const v = Number(p.variance || 0);
								return (
									<TableRow key={i}>
										<TableCell className="font-medium">
											{p.product_name as string}
										</TableCell>
										<TableCell className="text-right font-mono">
											{String(p.produced)}
										</TableCell>
										<TableCell className="text-right font-mono">
											{String(p.closing_stock)}
										</TableCell>
										<TableCell className="text-right font-mono">
											{String(p.expectedSold)}
										</TableCell>
										<TableCell className="text-right font-mono">
											{String(p.actualSold)}
										</TableCell>
										<TableCell className="text-right">
											{v === 0 ? (
												<CheckCircle2 className="ml-auto size-4 text-emerald-600" />
											) : (
												<span
													className={`font-bold font-mono ${v < 0 ? "text-red-600" : "text-amber-600"}`}
												>
													{v > 0 ? "+" : ""}
													{v}
												</span>
											)}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

/* Weekly Trend sub-report */
function WeeklyTrendReport() {
	const { data } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "weekly-trend" },
		}),
	);
	const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
	const chartData = items.map((d: Record<string, unknown>) => ({
		date: new Date(d.date as string).toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		}),
		revenue: Number(d.revenue || 0),
		orders: Number(d.orders || 0),
	}));

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Weekly Revenue Trend</CardTitle>
				</CardHeader>
				<CardContent>
					{chartData.length > 0 ? (
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={chartData}>
								<CartesianGrid
									strokeDasharray="3 3"
									className="stroke-border"
								/>
								<XAxis dataKey="date" className="text-xs" />
								<YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
								<Tooltip
									formatter={(value, name) => [
										name === "revenue" ? fmt(Number(value)) : value,
										name === "revenue" ? "Revenue" : "Orders",
									]}
								/>
								<Legend />
								<Line
									type="monotone"
									dataKey="revenue"
									stroke="var(--chart-1)"
									strokeWidth={2}
									dot={{ r: 4 }}
									name="Revenue"
								/>
								<Line
									type="monotone"
									dataKey="orders"
									stroke="var(--chart-2)"
									strokeWidth={2}
									dot={{ r: 4 }}
									name="Orders"
									yAxisId={0}
								/>
							</LineChart>
						</ResponsiveContainer>
					) : (
						<p className="py-12 text-center text-muted-foreground text-sm">
							No data for the past week
						</p>
					)}
				</CardContent>
			</Card>

			{/* Peak Hours Heatmap */}
			<PeakHoursHeatmap />
		</>
	);
}

/* Peak Hours Heatmap */
function PeakHoursHeatmap() {
	const sevenDaysAgo = new Date(
		Date.now() - 7 * 24 * 60 * 60 * 1000,
	).toISOString();
	const now = new Date().toISOString();
	const { data } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "hourly-sales", startDate: sevenDaysAgo, endDate: now },
		}),
	);
	const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

	// Build hours 6-22
	const hours = Array.from({ length: 17 }, (_, i) => i + 6);
	const maxRevenue = Math.max(
		...items.map((h: Record<string, unknown>) => Number(h.revenue || 0)),
		1,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Peak Hours (Last 7 Days)</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-17 gap-1">
					{hours.map((hour) => {
						const match = items.find(
							(h: Record<string, unknown>) => Number(h.hour) === hour,
						);
						const revenue = match ? Number(match.revenue || 0) : 0;
						const orders = match ? Number(match.orders || 0) : 0;
						const intensity = revenue / maxRevenue;
						const bg =
							intensity === 0
								? "bg-muted"
								: intensity < 0.25
									? "bg-emerald-100 dark:bg-emerald-900/30"
									: intensity < 0.5
										? "bg-emerald-300 dark:bg-emerald-700/50"
										: intensity < 0.75
											? "bg-amber-400 dark:bg-amber-600/60"
											: "bg-red-500 dark:bg-red-700/60";

						return (
							<div
								key={hour}
								className={`flex flex-col items-center rounded p-1.5 ${bg}`}
								title={`${hour}:00 - ${orders} orders, ${fmt(revenue)}`}
							>
								<span className="font-bold text-[9px]">{hour}</span>
								<span className="text-[8px]">{orders > 0 ? orders : "-"}</span>
							</div>
						);
					})}
				</div>
				<div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
					<span className="inline-block size-3 rounded bg-muted" /> Low
					<span className="inline-block size-3 rounded bg-emerald-300 dark:bg-emerald-700/50" />{" "}
					Medium
					<span className="inline-block size-3 rounded bg-amber-400 dark:bg-amber-600/60" />{" "}
					High
					<span className="inline-block size-3 rounded bg-red-500 dark:bg-red-700/60" />{" "}
					Peak
				</div>
			</CardContent>
		</Card>
	);
}
