import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, UserCheck, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv-export";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function defaultStartDate(): string {
	const d = new Date();
	d.setDate(d.getDate() - 90);
	return d.toISOString().slice(0, 10);
}

type KPI = {
	total_customers: number;
	new_customers: number;
	avg_visits: string;
	avg_lifetime_spend: string;
	total_revenue_from_customers: string;
	returning_customers: number;
};

type CustomerRow = {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	total_spent: string;
	visit_count: number;
	last_visit_at: string | null;
	avg_order_value: string;
};

type TrendRow = {
	date: string;
	new_customers: number;
	returning_customers: number;
	total_orders: number;
	revenue: string;
};

type DistributionRow = {
	bucket: string;
	count: number;
	total_spend: string;
};

export default function CustomerAnalyticsPage() {
	const [startDate, setStartDate] = useState(defaultStartDate());
	const [endDate, setEndDate] = useState(todayGY());

	const { data: raw, isLoading } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "customer_analytics", startDate, endDate },
		}),
	);

	const data = raw as
		| {
				kpi: KPI;
				topBySpend: CustomerRow[];
				topByVisits: CustomerRow[];
				trend: TrendRow[];
				spendDistribution: DistributionRow[];
		  }
		| undefined;

	const kpi = data?.kpi;
	const topBySpend = data?.topBySpend ?? [];
	const topByVisits = data?.topByVisits ?? [];
	const trend = data?.trend ?? [];
	const distribution = data?.spendDistribution ?? [];

	const retentionRate =
		kpi && kpi.total_customers > 0
			? ((kpi.returning_customers / kpi.total_customers) * 100).toFixed(1)
			: "0";

	function handleExport() {
		downloadCsv(
			`customer-analytics-${startDate}-to-${endDate}.csv`,
			topBySpend.map((c) => ({
				Name: c.name,
				Phone: c.phone || "",
				Email: c.email || "",
				"Total Spent": c.total_spent,
				Visits: c.visit_count,
				"Avg Order": c.avg_order_value,
				"Last Visit": c.last_visit_at
					? new Date(c.last_visit_at).toLocaleDateString()
					: "",
			})),
		);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Customer Analytics
					</h1>
					<p className="text-muted-foreground text-sm">
						Customer insights, retention, and lifetime value
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5">
						<Label className="text-xs">From</Label>
						<Input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="h-8 w-36 text-xs"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<Label className="text-xs">To</Label>
						<Input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="h-8 w-36 text-xs"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExport}
						disabled={topBySpend.length === 0}
					>
						<Download className="mr-1 size-3.5" /> CSV
					</Button>
				</div>
			</div>

			{/* KPI Cards */}
			{isLoading ? (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs font-normal">
								<Users className="size-3.5" /> Total Customers
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{kpi?.total_customers ?? 0}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs font-normal">
								<UserPlus className="size-3.5" /> New (Period)
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl text-green-600">
								{kpi?.new_customers ?? 0}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs font-normal">
								<UserCheck className="size-3.5" /> Retention Rate
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{retentionRate}%</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs font-normal">
								<TrendingUp className="size-3.5" /> Avg Visits
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{kpi ? Number(kpi.avg_visits).toFixed(1) : "–"}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">
								Avg Lifetime Spend
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{kpi ? formatGYD(Number(kpi.avg_lifetime_spend)) : "–"}
							</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Spend Distribution */}
			{distribution.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							Customer Spend Distribution
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-end gap-2">
							{distribution.map((d) => {
								const maxCount = Math.max(
									...distribution.map((r) => r.count),
								);
								const heightPct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
								return (
									<div
										key={d.bucket}
										className="flex flex-1 flex-col items-center gap-1"
									>
										<span className="text-muted-foreground text-xs">
											{d.count}
										</span>
										<div
											className="w-full rounded-t bg-primary/80"
											style={{
												height: `${Math.max(heightPct, 4)}px`,
												minHeight: "4px",
												maxHeight: "120px",
											}}
										/>
										<span className="text-center text-muted-foreground text-xs">
											{d.bucket}
										</span>
										<span className="text-center text-muted-foreground text-xs">
											{formatGYD(Number(d.total_spend))}
										</span>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* New vs Returning Trend */}
			{trend.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							New vs Returning Customers (Daily)
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="max-h-[200px] overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Date</TableHead>
										<TableHead className="text-right">New</TableHead>
										<TableHead className="text-right">Returning</TableHead>
										<TableHead className="text-right">Orders</TableHead>
										<TableHead className="text-right">Revenue</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{trend.slice(-30).map((t) => (
										<TableRow key={t.date}>
											<TableCell className="text-muted-foreground text-xs">
												{new Date(t.date).toLocaleDateString("en-GY", {
													month: "short",
													day: "numeric",
												})}
											</TableCell>
											<TableCell className="text-right text-green-600">
												{t.new_customers}
											</TableCell>
											<TableCell className="text-right text-blue-600">
												{t.returning_customers}
											</TableCell>
											<TableCell className="text-right">
												{t.total_orders}
											</TableCell>
											<TableCell className="text-right">
												{formatGYD(Number(t.revenue))}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Top Customers Tabs */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Top Customers</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="spend">
						<TabsList>
							<TabsTrigger value="spend">By Spend</TabsTrigger>
							<TabsTrigger value="visits">By Visits</TabsTrigger>
						</TabsList>
						<TabsContent value="spend">
							<CustomerTable rows={topBySpend} />
						</TabsContent>
						<TabsContent value="visits">
							<CustomerTable rows={topByVisits} />
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}

function CustomerTable({ rows }: { rows: CustomerRow[] }) {
	if (rows.length === 0) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				No customer data available
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Customer</TableHead>
					<TableHead>Contact</TableHead>
					<TableHead className="text-right">Total Spent</TableHead>
					<TableHead className="text-right">Visits</TableHead>
					<TableHead className="text-right">Avg Order</TableHead>
					<TableHead className="text-right">Last Visit</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((c) => (
					<TableRow key={c.id}>
						<TableCell className="font-medium">{c.name}</TableCell>
						<TableCell className="text-muted-foreground text-xs">
							{c.phone || c.email || "–"}
						</TableCell>
						<TableCell className="text-right font-medium">
							{formatGYD(Number(c.total_spent))}
						</TableCell>
						<TableCell className="text-right">
							{c.visit_count}
							{c.visit_count >= 10 && (
								<Badge
									variant="secondary"
									className="ml-1 bg-green-100 text-green-800 text-xs"
								>
									VIP
								</Badge>
							)}
						</TableCell>
						<TableCell className="text-right text-muted-foreground">
							{formatGYD(Number(c.avg_order_value))}
						</TableCell>
						<TableCell className="text-right text-muted-foreground text-xs">
							{c.last_visit_at
								? new Date(c.last_visit_at).toLocaleDateString()
								: "–"}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
