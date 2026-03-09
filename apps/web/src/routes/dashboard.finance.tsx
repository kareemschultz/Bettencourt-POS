import { useQuery } from "@tanstack/react-query";
import {
	BarChart2,
	Building2,
	CircleDollarSign,
	Download,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	Tooltip as RechartsTooltip,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

// ── helpers ──────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
	"01": "Jan",
	"02": "Feb",
	"03": "Mar",
	"04": "Apr",
	"05": "May",
	"06": "Jun",
	"07": "Jul",
	"08": "Aug",
	"09": "Sep",
	"10": "Oct",
	"11": "Nov",
	"12": "Dec",
};

function monthLabel(yyyyMm: string): string {
	const [, mm] = yyyyMm.split("-");
	return MONTH_LABELS[mm ?? ""] ?? yyyyMm;
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		paid: "bg-green-100 text-green-800",
		active: "bg-green-100 text-green-800",
		sent: "bg-blue-100 text-blue-800",
		received: "bg-blue-100 text-blue-800",
		outstanding: "bg-amber-100 text-amber-800",
		partially_paid: "bg-amber-100 text-amber-800",
		overdue: "bg-red-100 text-red-800",
		voided: "bg-gray-100 text-gray-800",
		cancelled: "bg-gray-100 text-gray-800",
		draft: "bg-gray-100 text-gray-500",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
		>
			{status.replace(/_/g, " ")}
		</span>
	);
}

// ── page ─────────────────────────────────────────────────────────────────

export default function FinanceDashboardPage() {
	const navigate = useNavigate();

	const { data: dashRaw, isLoading: loadingDash } = useQuery(
		orpc.invoices.getFinanceDashboard.queryOptions({ input: {} }),
	);

	const dash = dashRaw as
		| {
				totalReceivable: string;
				totalPayable: string;
				overdueInvoices: { count: number; total: string };
				overdueVendorBills: { count: number; total: string };
				cashFlow30Days: string;
				revenueByMonth: Array<{ month: string; total: string }>;
				expenseByMonth: Array<{ month: string; total: string }>;
				topCustomersByRevenue: Array<{
					customerName: string;
					customerId: string | null;
					total: string;
				}>;
				topSuppliersBySpend: Array<{
					supplierName: string;
					supplierId: string | null;
					total: string;
				}>;
		  }
		| undefined;

	// Recent invoices (last 5)
	const { data: invoicesRaw, isLoading: loadingInvoices } = useQuery(
		orpc.invoices.list.queryOptions({
			input: { limit: 5, offset: 0 },
		}),
	);
	const recentInvoices =
		(
			invoicesRaw as
				| {
						invoices: Array<{
							id: string;
							invoiceNumber: string;
							customerName: string;
							total: string;
							status: string;
							createdAt: string;
						}>;
				  }
				| undefined
		)?.invoices ?? [];

	// Recent vendor bills (last 5)
	const { data: billsRaw, isLoading: loadingBills } = useQuery(
		orpc.vendorBills.list.queryOptions({
			input: { limit: 5, offset: 0 },
		}),
	);
	const recentBills =
		(
			billsRaw as
				| {
						items: Array<{
							id: string;
							billNumber: string;
							supplierName: string;
							total: string;
							status: string;
							dueDate: string | null;
						}>;
				  }
				| undefined
		)?.items ?? [];

	// Build chart data by merging revenue + expense months
	const allMonths = new Set<string>();
	for (const r of dash?.revenueByMonth ?? []) allMonths.add(r.month);
	for (const e of dash?.expenseByMonth ?? []) allMonths.add(e.month);
	const sortedMonths = Array.from(allMonths).sort();

	const revenueMap = new Map(
		(dash?.revenueByMonth ?? []).map((r) => [r.month, Number(r.total)]),
	);
	const expenseMap = new Map(
		(dash?.expenseByMonth ?? []).map((e) => [e.month, Number(e.total)]),
	);

	const barChartData = sortedMonths.map((m) => ({
		label: monthLabel(m),
		Revenue: revenueMap.get(m) ?? 0,
		Expenses: expenseMap.get(m) ?? 0,
	}));

	const lineChartData = sortedMonths.map((m) => ({
		label: monthLabel(m),
		"Net Cash Flow": (revenueMap.get(m) ?? 0) - (expenseMap.get(m) ?? 0),
	}));

	// Derive Revenue MTD from last revenue entry
	const currentYYYYMM = new Date()
		.toLocaleDateString("en-CA", { timeZone: "America/Guyana" })
		.slice(0, 7);
	const revenueMTD = Number(
		(dash?.revenueByMonth ?? []).find((r) => r.month === currentYYYYMM)
			?.total ?? "0",
	);
	const cashFlow30 = Number(dash?.cashFlow30Days ?? "0");

	const KPI_CARDS = [
		{
			label: "Total Receivable",
			value: Number(dash?.totalReceivable ?? "0"),
			colorClass: "text-blue-600",
			icon: <CircleDollarSign className="size-5 text-blue-500" />,
			navigateTo: "/dashboard/invoices",
		},
		{
			label: "Total Payable",
			value: Number(dash?.totalPayable ?? "0"),
			colorClass: "text-orange-600",
			icon: <Building2 className="size-5 text-orange-500" />,
			navigateTo: "/dashboard/vendor-bills",
		},
		{
			label: `Overdue AR (${dash?.overdueInvoices?.count ?? 0})`,
			value: Number(dash?.overdueInvoices?.total ?? "0"),
			colorClass: "text-red-600",
			icon: <TrendingDown className="size-5 text-red-500" />,
			navigateTo: "/dashboard/invoices",
		},
		{
			label: `Overdue AP (${dash?.overdueVendorBills?.count ?? 0})`,
			value: Number(dash?.overdueVendorBills?.total ?? "0"),
			colorClass: "text-red-600",
			icon: <TrendingDown className="size-5 text-red-500" />,
			navigateTo: "/dashboard/vendor-bills",
		},
		{
			label: "Net Cash Flow 30d",
			value: cashFlow30,
			colorClass: cashFlow30 >= 0 ? "text-green-600" : "text-red-600",
			icon:
				cashFlow30 >= 0 ? (
					<TrendingUp className="size-5 text-green-500" />
				) : (
					<TrendingDown className="size-5 text-red-500" />
				),
			navigateTo: "/dashboard/expenses",
		},
		{
			label: "Revenue MTD",
			value: revenueMTD,
			colorClass: "text-green-600",
			icon: <BarChart2 className="size-5 text-green-500" />,
			navigateTo: "/dashboard/invoices",
		},
	];

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div>
				<h1 className="font-bold text-2xl text-foreground tracking-tight">
					Finance Dashboard
				</h1>
				<p className="text-muted-foreground text-sm">
					Overview of receivables, payables, and cash flow
				</p>
			</div>

			{/* KPI Strip */}
			<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
				{loadingDash
					? Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-24 rounded-lg" />
						))
					: KPI_CARDS.map((card) => (
							<Card
								key={card.label}
								className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
								onClick={() => navigate(card.navigateTo)}
							>
								<CardContent className="flex flex-col gap-1 p-4">
									<div className="flex items-center justify-between">
										<p className="text-muted-foreground text-xs">
											{card.label}
										</p>
										{card.icon}
									</div>
									<p className={`font-bold text-xl ${card.colorClass}`}>
										{formatGYD(card.value)}
									</p>
								</CardContent>
							</Card>
						))}
			</div>

			{/* Charts */}
			<div className="grid gap-4 lg:grid-cols-2">
				{/* Revenue vs Expenses */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">
							Revenue vs Expenses — Last 12 Months
						</CardTitle>
					</CardHeader>
					<CardContent>
						{loadingDash ? (
							<Skeleton className="h-52 w-full rounded-md" />
						) : barChartData.length === 0 ? (
							<div className="flex h-52 items-center justify-center text-muted-foreground text-sm">
								No data yet
							</div>
						) : (
							<ResponsiveContainer width="100%" height={200}>
								<BarChart
									data={barChartData}
									margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										vertical={false}
										className="stroke-border"
									/>
									<XAxis
										dataKey="label"
										tick={{ fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{ fontSize: 11 }}
										axisLine={false}
										tickLine={false}
										tickFormatter={(v: number) =>
											v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
										}
									/>
									<RechartsTooltip
										formatter={(
											value: number | undefined,
											name: string | undefined,
										) => [formatGYD(value ?? 0), name ?? ""]}
										contentStyle={{
											fontSize: 12,
											borderRadius: 8,
											border: "1px solid hsl(var(--border))",
											background: "hsl(var(--card))",
											color: "hsl(var(--foreground))",
										}}
									/>
									<Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
									<Bar
										dataKey="Revenue"
										fill="hsl(var(--chart-1))"
										radius={[4, 4, 0, 0]}
									/>
									<Bar
										dataKey="Expenses"
										fill="hsl(var(--chart-2))"
										radius={[4, 4, 0, 0]}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</CardContent>
				</Card>

				{/* Net Cash Flow Trend */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">
							Net Cash Flow Trend — Last 12 Months
						</CardTitle>
					</CardHeader>
					<CardContent>
						{loadingDash ? (
							<Skeleton className="h-52 w-full rounded-md" />
						) : lineChartData.length === 0 ? (
							<div className="flex h-52 items-center justify-center text-muted-foreground text-sm">
								No data yet
							</div>
						) : (
							<ResponsiveContainer width="100%" height={200}>
								<LineChart
									data={lineChartData}
									margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										vertical={false}
										className="stroke-border"
									/>
									<XAxis
										dataKey="label"
										tick={{ fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{ fontSize: 11 }}
										axisLine={false}
										tickLine={false}
										tickFormatter={(v: number) =>
											v >= 1000
												? `$${(v / 1000).toFixed(0)}k`
												: v <= -1000
													? `-$${(Math.abs(v) / 1000).toFixed(0)}k`
													: `$${v}`
										}
									/>
									<RechartsTooltip
										formatter={(
											value: number | undefined,
											name: string | undefined,
										) => [formatGYD(value ?? 0), name ?? ""]}
										contentStyle={{
											fontSize: 12,
											borderRadius: 8,
											border: "1px solid hsl(var(--border))",
											background: "hsl(var(--card))",
											color: "hsl(var(--foreground))",
										}}
									/>
									<Line
										type="monotone"
										dataKey="Net Cash Flow"
										stroke="hsl(var(--chart-3))"
										strokeWidth={2}
										dot={{ r: 3 }}
										activeDot={{ r: 5 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Recent Activity */}
			<div className="grid gap-4 lg:grid-cols-2">
				{/* Recent Invoices */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-sm">
							<Download className="size-4 text-muted-foreground" />
							Recent Invoices
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						{loadingInvoices ? (
							<div className="flex flex-col gap-2 p-4">
								{Array.from({ length: 5 }).map((_, i) => (
									<Skeleton key={i} className="h-8 w-full rounded" />
								))}
							</div>
						) : recentInvoices.length === 0 ? (
							<div className="py-8 text-center text-muted-foreground text-sm">
								No invoices yet.{" "}
								<button
									type="button"
									className="cursor-pointer text-primary hover:underline"
									onClick={() => navigate("/dashboard/invoices")}
								>
									Create one
								</button>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="text-xs">Invoice #</TableHead>
										<TableHead className="text-xs">Customer</TableHead>
										<TableHead className="text-right text-xs">Amount</TableHead>
										<TableHead className="text-xs">Status</TableHead>
										<TableHead className="text-xs">Date</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{recentInvoices.map((inv) => (
										<TableRow
											key={inv.id}
											className="cursor-pointer hover:bg-muted/60"
											onClick={() => navigate("/dashboard/invoices")}
										>
											<TableCell className="font-mono text-xs">
												{inv.invoiceNumber}
											</TableCell>
											<TableCell className="max-w-28 truncate text-xs">
												{inv.customerName}
											</TableCell>
											<TableCell className="text-right font-semibold text-xs">
												{formatGYD(Number(inv.total))}
											</TableCell>
											<TableCell>
												<StatusBadge status={inv.status} />
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{new Date(inv.createdAt).toLocaleDateString("en-GY", {
													month: "short",
													day: "numeric",
												})}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				{/* Recent Vendor Bills */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-sm">
							<Building2 className="size-4 text-muted-foreground" />
							Recent Vendor Bills
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						{loadingBills ? (
							<div className="flex flex-col gap-2 p-4">
								{Array.from({ length: 5 }).map((_, i) => (
									<Skeleton key={i} className="h-8 w-full rounded" />
								))}
							</div>
						) : recentBills.length === 0 ? (
							<div className="py-8 text-center text-muted-foreground text-sm">
								No vendor bills yet.{" "}
								<button
									type="button"
									className="cursor-pointer text-primary hover:underline"
									onClick={() => navigate("/dashboard/vendor-bills")}
								>
									Add one
								</button>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="text-xs">Bill #</TableHead>
										<TableHead className="text-xs">Supplier</TableHead>
										<TableHead className="text-right text-xs">Amount</TableHead>
										<TableHead className="text-xs">Status</TableHead>
										<TableHead className="text-xs">Due</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{recentBills.map((bill) => (
										<TableRow
											key={bill.id}
											className="cursor-pointer hover:bg-muted/60"
											onClick={() => navigate("/dashboard/vendor-bills")}
										>
											<TableCell className="font-mono text-xs">
												{bill.billNumber}
											</TableCell>
											<TableCell className="max-w-28 truncate text-xs">
												{bill.supplierName}
											</TableCell>
											<TableCell className="text-right font-semibold text-xs">
												{formatGYD(Number(bill.total))}
											</TableCell>
											<TableCell>
												<StatusBadge status={bill.status} />
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{bill.dueDate
													? new Date(bill.dueDate).toLocaleDateString("en-GY", {
															month: "short",
															day: "numeric",
														})
													: "—"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
