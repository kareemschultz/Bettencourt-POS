import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowRight,
	Banknote,
	BarChart3,
	ChefHat,
	ClipboardList,
	Clock,
	CreditCard,
	DollarSign,
	Factory,
	ShoppingBag,
	ShoppingCart,
	TrendingUp,
	Users,
	UtensilsCrossed,
	Warehouse,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { Link } from "react-router";

// Lazy-load Recharts (351 KB) so it doesn't block the initial dashboard bundle.
// The chart only renders after data loads anyway, so Suspense adds zero visible delay.
const HourlySalesChart = lazy(() =>
	import("@/components/dashboard/hourly-sales-chart").then((m) => ({
		default: m.HourlySalesChart,
	})),
);

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";
import { mapRoleToSidebarRole } from "./dashboard";

// ── Types ───────────────────────────────────────────────────────────────
interface HourlyData {
	hour: string;
	orders: number;
	revenue: number;
}

// ── Executive / Admin Dashboard ─────────────────────────────────────────
function ExecutiveDashboard() {
	const { data: session } = authClient.useSession();
	const { data } = useQuery(
		orpc.dashboard.getSummary.queryOptions({ input: undefined }),
	);

	const stats = data?.stats || { order_count: 0, revenue: 0, avg_order: 0 };
	const productCount = data?.productCount || 0;
	const openShifts = data?.openShifts || 0;
	const recentOrders = (data?.recentOrders || []) as Record<string, unknown>[];
	const topProducts = (data?.topProducts || []) as Record<string, unknown>[];
	const paymentBreakdown = (data?.paymentBreakdown || []) as Record<
		string,
		unknown
	>[];
	const voidCount = data?.voidCount || 0;

	const hourlySales = (data?.hourlySales || []) as Record<string, unknown>[];
	const hourlyData: HourlyData[] = Array.from({ length: 24 }, (_, i) => {
		const match = hourlySales.find((h) => Number(h.hour) === i);
		return {
			hour: `${i.toString().padStart(2, "0")}:00`,
			orders: match ? Number(match.orders) : 0,
			revenue: match ? Number(match.revenue) : 0,
		};
	}).filter((h) => h.hour >= "06:00" && h.hour <= "22:00");

	const cashTotal = paymentBreakdown.find((p) => p.method === "cash");
	const cardTotal = paymentBreakdown.find((p) => p.method === "card");

	const statusColors: Record<string, string> = {
		completed:
			"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		voided: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
		held: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	};

	return (
		<>
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-balance font-bold text-xl sm:text-2xl">
						Welcome back, {session?.user?.name || "User"}
					</h1>
					<p className="text-muted-foreground text-sm">
						{"Here's what's happening at Bettencourt's today."}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm">
						<Link to="/dashboard/pos" prefetch="intent" className="gap-1.5">
							<ShoppingCart className="size-3.5" /> Open POS
						</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to="/dashboard/reports" className="gap-1.5">
							<BarChart3 className="size-3.5" /> Reports
						</Link>
					</Button>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
				<Card className="border-emerald-500/20">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							{"Today's Revenue"}
						</CardTitle>
						<div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
							<DollarSign className="size-4 text-emerald-500" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-emerald-400 text-lg sm:text-2xl">
							{formatGYD(Number(stats.revenue))}
						</div>
						<p className="text-muted-foreground text-xs">
							From {String(stats.order_count)} orders
						</p>
					</CardContent>
				</Card>

				<Card className="border-blue-500/20">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Orders Today
						</CardTitle>
						<div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
							<ShoppingCart className="size-4 text-blue-500" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-blue-400 text-lg sm:text-2xl">
							{String(stats.order_count)}
						</div>
						<p className="text-muted-foreground text-xs">
							Avg {formatGYD(Number(stats.avg_order))}
						</p>
					</CardContent>
				</Card>

				<Card className="border-violet-500/20">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Active Products
						</CardTitle>
						<div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10">
							<TrendingUp className="size-4 text-violet-500" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg text-violet-400 sm:text-2xl">
							{productCount}
						</div>
						<p className="text-muted-foreground text-xs">
							Across all departments
						</p>
					</CardContent>
				</Card>

				<Card className="border-amber-500/20">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Open Shifts
						</CardTitle>
						<div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
							<Users className="size-4 text-amber-500" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-amber-400 text-lg sm:text-2xl">
							{openShifts}
						</div>
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<span>Active registers</span>
							{voidCount > 0 && (
								<Badge variant="destructive" className="gap-0.5 text-[10px]">
									<AlertTriangle className="size-2.5" /> {voidCount} void
									{voidCount > 1 ? "s" : ""}
								</Badge>
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Hourly Sales Chart */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Hourly Sales</CardTitle>
					<CardDescription className="text-xs">
						Revenue and order count by hour today (6AM - 10PM)
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Suspense
						fallback={
							<div className="h-[220px] animate-pulse rounded-lg bg-muted sm:h-[260px]" />
						}
					>
						<HourlySalesChart data={hourlyData} />
					</Suspense>
				</CardContent>
			</Card>

			{/* Quick Actions */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Link to="/dashboard/pos" className="group">
					<Card className="transition-colors group-hover:border-emerald-500/50 group-hover:bg-emerald-500/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
								<ShoppingBag className="size-5 text-emerald-500" />
							</div>
							<span className="font-medium text-xs">New Sale</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/kitchen" className="group">
					<Card className="transition-colors group-hover:border-orange-500/50 group-hover:bg-orange-500/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10">
								<UtensilsCrossed className="size-5 text-orange-500" />
							</div>
							<span className="font-medium text-xs">Kitchen</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/inventory" className="group">
					<Card className="transition-colors group-hover:border-blue-500/50 group-hover:bg-blue-500/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
								<Warehouse className="size-5 text-blue-500" />
							</div>
							<span className="font-medium text-xs">Inventory</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/cash" className="group">
					<Card className="transition-colors group-hover:border-violet-500/50 group-hover:bg-violet-500/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10">
								<DollarSign className="size-5 text-violet-500" />
							</div>
							<span className="font-medium text-xs">Cash Mgmt</span>
						</CardContent>
					</Card>
				</Link>
			</div>

			{/* Bottom section: Recent Orders + Top Products + Payment */}
			<div className="grid gap-4 lg:grid-cols-3">
				{/* Recent Orders */}
				<Card className="lg:col-span-2">
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="text-base">Recent Orders</CardTitle>
						<Link
							to="/dashboard/orders"
							className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
						>
							View all <ArrowRight className="size-3" />
						</Link>
					</CardHeader>
					<CardContent>
						{recentOrders.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No orders today yet.
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{recentOrders.map((order) => (
									<div
										key={order.order_number as string}
										className="flex items-center justify-between rounded-md border border-border px-3 py-2"
									>
										<div className="flex items-center gap-2">
											<span className="font-bold font-mono text-xs sm:text-sm">
												#{order.order_number as string}
											</span>
											<span
												className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium text-[10px] ${statusColors[order.status as string] || "bg-muted text-muted-foreground"}`}
											>
												{order.status as string}
											</span>
											{order.order_type != null &&
												(order.order_type as string) !== "dine_in" && (
													<Badge variant="outline" className="text-[10px]">
														{(order.order_type as string).replace("_", " ")}
													</Badge>
												)}
										</div>
										<div className="flex items-center gap-2 sm:gap-4">
											<span className="hidden text-muted-foreground text-xs sm:inline">
												{order.user_name as string}
											</span>
											<span className="font-semibold text-xs sm:text-sm">
												{formatGYD(Number(order.total))}
											</span>
											<span className="text-[10px] text-muted-foreground sm:text-xs">
												{new Date(
													order.created_at as string,
												).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</span>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Right column: Top Products + Payment Breakdown */}
				<div className="flex flex-col gap-4">
					{/* Top Sellers */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">Top Sellers Today</CardTitle>
						</CardHeader>
						<CardContent>
							{topProducts.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-xs">
									No sales data yet.
								</p>
							) : (
								<div className="flex flex-col gap-2">
									{topProducts.map((p, i) => (
										<div key={i} className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<span className="flex size-5 items-center justify-center rounded-full bg-primary/10 font-bold text-[10px] text-primary">
													{i + 1}
												</span>
												<span className="text-sm">{p.name as string}</span>
											</div>
											<div className="flex items-center gap-3">
												<Badge variant="secondary" className="text-[10px]">
													{String(p.qty)} sold
												</Badge>
												<span className="font-mono text-xs">
													{formatGYD(Number(p.revenue))}
												</span>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Payment Breakdown */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">Payments</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-3 rounded-md border border-border p-3">
									<div className="flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
										<Banknote className="size-4 text-green-600 dark:text-green-400" />
									</div>
									<div className="flex-1">
										<p className="font-medium text-sm">Cash</p>
										<p className="text-[10px] text-muted-foreground">
											{(cashTotal?.count as number) || 0} txns
										</p>
									</div>
									<p className="font-bold font-mono text-sm">
										{formatGYD(Number(cashTotal?.total || 0))}
									</p>
								</div>
								<div className="flex items-center gap-3 rounded-md border border-border p-3">
									<div className="flex size-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
										<CreditCard className="size-4 text-blue-600 dark:text-blue-400" />
									</div>
									<div className="flex-1">
										<p className="font-medium text-sm">Card</p>
										<p className="text-[10px] text-muted-foreground">
											{(cardTotal?.count as number) || 0} txns
										</p>
									</div>
									<p className="font-bold font-mono text-sm">
										{formatGYD(Number(cardTotal?.total || 0))}
									</p>
								</div>
								<div className="rounded-md bg-muted/50 p-3">
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground text-xs">
											Total Collected
										</span>
										<span className="font-bold font-mono text-sm">
											{formatGYD(Number(stats.revenue))}
										</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}

// ── Cashier Dashboard ───────────────────────────────────────────────────
function CashierDashboard() {
	const { data: session } = authClient.useSession();
	const { data } = useQuery(
		orpc.dashboard.getSummary.queryOptions({ input: undefined }),
	);

	const recentOrders = (data?.recentOrders || []).slice(0, 5) as Record<
		string,
		unknown
	>[];

	return (
		<>
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-balance font-bold text-xl sm:text-2xl">
						Welcome back, {session?.user?.name || "User"}
					</h1>
					<p className="text-muted-foreground text-sm">
						Your quick-access register dashboard — start a sale, check recent
						orders, or clock in/out.
					</p>
				</div>
			</div>

			{/* Prominent POS Button */}
			<Link to="/dashboard/pos">
				<Card className="border-primary/30 bg-primary/5 transition-colors hover:border-primary hover:bg-primary/10">
					<CardContent className="flex items-center gap-4 p-6">
						<div className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
							<ShoppingCart className="size-7" />
						</div>
						<div className="flex-1">
							<h2 className="font-bold text-lg">Open Point of Sale</h2>
							<p className="text-muted-foreground text-sm">
								Start a new transaction
							</p>
						</div>
						<ArrowRight className="size-5 text-muted-foreground" />
					</CardContent>
				</Card>
			</Link>

			{/* Shift Info */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-base">Current Shift</CardTitle>
					<Clock className="size-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No active cash session found. Open Cash Management to start a new
						shift, count your drawer, and begin taking orders.
					</p>
					<Button asChild size="sm" variant="outline" className="mt-3">
						<Link to="/dashboard/cash" className="gap-1.5">
							<DollarSign className="size-3.5" /> Cash Management
						</Link>
					</Button>
				</CardContent>
			</Card>

			{/* Recent Orders (simplified) */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-base">Recent Orders</CardTitle>
					<Link
						to="/dashboard/orders"
						className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
					>
						View all <ArrowRight className="size-3" />
					</Link>
				</CardHeader>
				<CardContent>
					{recentOrders.length === 0 ? (
						<p className="py-6 text-center text-muted-foreground text-sm">
							No orders yet.
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{recentOrders.map((order) => (
								<div
									key={order.order_number as string}
									className="flex items-center justify-between rounded-md border border-border px-3 py-2"
								>
									<span className="font-bold font-mono text-xs sm:text-sm">
										#{order.order_number as string}
									</span>
									<div className="flex items-center gap-3">
										<span className="font-semibold text-xs sm:text-sm">
											{formatGYD(Number(order.total))}
										</span>
										<span className="text-[10px] text-muted-foreground sm:text-xs">
											{new Date(order.created_at as string).toLocaleTimeString(
												[],
												{ hour: "2-digit", minute: "2-digit" },
											)}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Quick Actions */}
			<div className="grid grid-cols-3 gap-3">
				<Link to="/dashboard/pos" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<ShoppingBag className="size-6 text-primary" />
							<span className="font-medium text-xs">New Sale</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/orders" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<ClipboardList className="size-6 text-primary" />
							<span className="font-medium text-xs">Orders</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/timeclock" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<Clock className="size-6 text-primary" />
							<span className="font-medium text-xs">Time Clock</span>
						</CardContent>
					</Card>
				</Link>
			</div>
		</>
	);
}

// ── Kitchen / Production Dashboard ──────────────────────────────────────
function KitchenDashboard() {
	const { data: session } = authClient.useSession();

	const { data: tickets = [] } = useQuery({
		...orpc.kitchen.getActiveTickets.queryOptions({ input: {} }),
		refetchInterval: 30000,
	});

	const activeCount = tickets.filter(
		(t: Record<string, unknown>) =>
			t.status === "pending" || t.status === "preparing",
	).length;

	return (
		<>
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-balance font-bold text-xl sm:text-2xl">
						Welcome back, {session?.user?.name || "User"}
					</h1>
					<p className="text-muted-foreground text-sm">
						Monitor kitchen tickets, manage production runs, and track
						preparation progress.
					</p>
				</div>
			</div>

			{/* Prominent Kitchen Display Link */}
			<Link to="/dashboard/kitchen">
				<Card className="border-primary/30 bg-primary/5 transition-colors hover:border-primary hover:bg-primary/10">
					<CardContent className="flex items-center gap-4 p-6">
						<div className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
							<ChefHat className="size-7" />
						</div>
						<div className="flex-1">
							<h2 className="font-bold text-lg">Kitchen Display</h2>
							<p className="text-muted-foreground text-sm">
								View and manage active tickets
							</p>
						</div>
						<ArrowRight className="size-5 text-muted-foreground" />
					</CardContent>
				</Card>
			</Link>

			{/* Prominent Production Link */}
			<Link to="/dashboard/production">
				<Card className="border-orange-300/30 bg-orange-50/50 transition-colors hover:border-orange-400 hover:bg-orange-50 dark:border-orange-500/20 dark:bg-orange-950/20 dark:hover:border-orange-500/40 dark:hover:bg-orange-950/30">
					<CardContent className="flex items-center gap-4 p-6">
						<div className="flex size-14 items-center justify-center rounded-xl bg-orange-500 text-white">
							<Factory className="size-7" />
						</div>
						<div className="flex-1">
							<h2 className="font-bold text-lg">Production</h2>
							<p className="text-muted-foreground text-sm">
								Manage food production runs
							</p>
						</div>
						<ArrowRight className="size-5 text-muted-foreground" />
					</CardContent>
				</Card>
			</Link>

			{/* Active Tickets Count */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-base">Active Kitchen Tickets</CardTitle>
					<UtensilsCrossed className="size-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-4">
						<div className="font-bold text-3xl">{activeCount}</div>
						<p className="text-muted-foreground text-sm">
							{activeCount === 0
								? "No active tickets right now."
								: `ticket${activeCount !== 1 ? "s" : ""} pending or in preparation.`}
						</p>
					</div>
					<Button asChild size="sm" variant="outline" className="mt-3">
						<Link to="/dashboard/kitchen" className="gap-1.5">
							<ChefHat className="size-3.5" /> Open Kitchen Display
						</Link>
					</Button>
				</CardContent>
			</Card>

			{/* Quick Action: Time Clock */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<Link to="/dashboard/kitchen" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<ChefHat className="size-6 text-primary" />
							<span className="font-medium text-xs">Kitchen</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/production" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<Factory className="size-6 text-primary" />
							<span className="font-medium text-xs">Production</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/timeclock" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<Clock className="size-6 text-primary" />
							<span className="font-medium text-xs">Time Clock</span>
						</CardContent>
					</Card>
				</Link>
			</div>
		</>
	);
}

function WarehouseDashboard() {
	return (
		<>
			<div className="flex flex-col gap-2">
				<h1 className="text-balance font-bold text-xl sm:text-2xl">
					Inventory Workspace
				</h1>
				<p className="text-muted-foreground text-sm">
					Monitor stock, product data, alerts, and supplier activity from one
					place.
				</p>
			</div>

			<Link to="/dashboard/inventory">
				<Card className="border-blue-500/30 bg-blue-500/5 transition-colors hover:border-blue-500/60 hover:bg-blue-500/10">
					<CardContent className="flex items-center gap-4 p-6">
						<div className="flex size-14 items-center justify-center rounded-xl bg-blue-500 text-white">
							<Warehouse className="size-7" />
						</div>
						<div className="flex-1">
							<h2 className="font-bold text-lg">Open Inventory Control</h2>
							<p className="text-muted-foreground text-sm">
								Review levels, transfers, and purchase workflow.
							</p>
						</div>
						<ArrowRight className="size-5 text-muted-foreground" />
					</CardContent>
				</Card>
			</Link>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Link to="/dashboard/inventory" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<Warehouse className="size-6 text-primary" />
							<span className="font-medium text-xs">Inventory</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/products" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<ShoppingBag className="size-6 text-primary" />
							<span className="font-medium text-xs">Products</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/stock-alerts" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<AlertTriangle className="size-6 text-primary" />
							<span className="font-medium text-xs">Stock Alerts</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/suppliers" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<Users className="size-6 text-primary" />
							<span className="font-medium text-xs">Suppliers</span>
						</CardContent>
					</Card>
				</Link>
			</div>
		</>
	);
}

function AccountantDashboard() {
	return (
		<>
			<div className="flex flex-col gap-2">
				<h1 className="text-balance font-bold text-xl sm:text-2xl">
					Finance Workspace
				</h1>
				<p className="text-muted-foreground text-sm">
					Jump into reporting, reconciliation, invoicing, and journal review.
				</p>
			</div>

			<Link to="/dashboard/reports">
				<Card className="border-emerald-500/30 bg-emerald-500/5 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10">
					<CardContent className="flex items-center gap-4 p-6">
						<div className="flex size-14 items-center justify-center rounded-xl bg-emerald-500 text-white">
							<BarChart3 className="size-7" />
						</div>
						<div className="flex-1">
							<h2 className="font-bold text-lg">Open Financial Reports</h2>
							<p className="text-muted-foreground text-sm">
								Analyze sales, margins, labor, and performance trends.
							</p>
						</div>
						<ArrowRight className="size-5 text-muted-foreground" />
					</CardContent>
				</Card>
			</Link>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Link to="/dashboard/reports" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<BarChart3 className="size-6 text-primary" />
							<span className="font-medium text-xs">Reports</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/invoices" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<Banknote className="size-6 text-primary" />
							<span className="font-medium text-xs">Invoices</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/reconciliation" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<DollarSign className="size-6 text-primary" />
							<span className="font-medium text-xs">Reconcile</span>
						</CardContent>
					</Card>
				</Link>
				<Link to="/dashboard/journal" className="group">
					<Card className="transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
						<CardContent className="flex flex-col items-center gap-2 p-4">
							<ClipboardList className="size-6 text-primary" />
							<span className="font-medium text-xs">Journal</span>
						</CardContent>
					</Card>
				</Link>
			</div>
		</>
	);
}

// ── Main Page Export ────────────────────────────────────────────────────
export default function DashboardIndexPage() {
	const { data: userProfile, isLoading } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-6 p-4 md:p-6">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-7 w-56" />
					<Skeleton className="h-4 w-80" />
				</div>
				<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
				<Skeleton className="h-64 rounded-lg" />
			</div>
		);
	}

	const role = mapRoleToSidebarRole(userProfile?.roleName || "Cashier");

	let content: React.ReactNode;
	switch (role) {
		case "executive":
		case "admin":
			content = <ExecutiveDashboard />;
			break;
		case "warehouse":
			content = <WarehouseDashboard />;
			break;
		case "accountant":
			content = <AccountantDashboard />;
			break;
		case "checkoff":
			content = <KitchenDashboard />;
			break;
		default:
			content = <CashierDashboard />;
			break;
	}

	return <div className="flex flex-col gap-6 p-4 md:p-6">{content}</div>;
}
