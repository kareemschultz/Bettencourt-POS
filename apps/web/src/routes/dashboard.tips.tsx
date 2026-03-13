import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip as RechartsTooltip,
	XAxis,
	YAxis,
} from "recharts";
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
import { downloadCsv } from "@/lib/csv-export";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function defaultStartDate(): string {
	const d = new Date();
	d.setDate(d.getDate() - 30);
	return d.toISOString().slice(0, 10);
}

type TipSummary = {
	total_tips: string;
	avg_tip: string;
	tipped_orders: number;
	total_orders: number;
	total_revenue: string;
};

type EmployeeTip = {
	employee_name: string;
	user_id: string;
	tips_earned: string;
	tipped_orders: number;
	total_orders: number;
	avg_tip: string;
};

type MethodTip = {
	method: string;
	tips_total: string;
	tip_count: number;
};

export default function TipsReportPage() {
	const [startDate, setStartDate] = useState(defaultStartDate());
	const [endDate, setEndDate] = useState(todayGY());

	const { data: raw, isLoading } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "tips", startDate, endDate },
		}),
	);

	const data = raw as
		| { summary: TipSummary; byEmployee: EmployeeTip[]; byMethod: MethodTip[] }
		| undefined;

	const summary = data?.summary;
	const byEmployee = data?.byEmployee ?? [];
	const byMethod = data?.byMethod ?? [];

	const totalTips = Number(summary?.total_tips ?? 0);
	const avgTip = Number(summary?.avg_tip ?? 0);
	const tippedOrders = summary?.tipped_orders ?? 0;
	const totalOrders = summary?.total_orders ?? 0;
	const totalRevenue = Number(summary?.total_revenue ?? 0);
	const tipPercentage = totalRevenue > 0 ? (totalTips / totalRevenue) * 100 : 0;

	const chartData = byEmployee.map((e) => ({
		name: e.employee_name,
		tips: Number(e.tips_earned),
		orders: e.tipped_orders,
	}));

	function handleExport() {
		downloadCsv(
			`tips-report-${startDate}-to-${endDate}.csv`,
			byEmployee.map((e) => ({
				Employee: e.employee_name,
				"Tips Earned": e.tips_earned,
				"Tipped Orders": e.tipped_orders,
				"Total Orders": e.total_orders,
				"Avg Tip": Number(e.avg_tip).toFixed(2),
			})),
		);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Tip Report</h1>
					<p className="text-muted-foreground text-sm">
						Gratuity tracking and employee tip breakdown
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
						disabled={byEmployee.length === 0}
					>
						<Download className="mr-1 size-3.5" />
						CSV
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
							<CardTitle className="text-muted-foreground text-xs font-normal">Total Tips</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{formatGYD(totalTips)}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">Avg Tip</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{formatGYD(avgTip)}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">Tipped Orders</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{tippedOrders}
								<span className="ml-1 font-normal text-muted-foreground text-sm">
									/ {totalOrders}
								</span>
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">Tip %</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{tipPercentage.toFixed(1)}%</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">Revenue</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{formatGYD(totalRevenue)}</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Charts and Tables */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Tips by Employee chart */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Tips by Employee</CardTitle>
					</CardHeader>
					<CardContent>
						{chartData.length > 0 ? (
							<ResponsiveContainer width="100%" height={300}>
								<BarChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="name" tick={{ fontSize: 12 }} />
									<YAxis tick={{ fontSize: 12 }} />
									<RechartsTooltip
										formatter={(value: number) => formatGYD(value)}
									/>
									<Bar dataKey="tips" name="Tips" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						) : (
							<p className="py-12 text-center text-muted-foreground text-sm">
								No tip data for this period
							</p>
						)}
					</CardContent>
				</Card>

				{/* Tips by Payment Method */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Tips by Payment Method</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Method</TableHead>
									<TableHead className="text-right">Tips</TableHead>
									<TableHead className="text-right">Count</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{byMethod.length === 0 ? (
									<TableRow>
										<TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
											No data
										</TableCell>
									</TableRow>
								) : (
									byMethod.map((m) => (
										<TableRow key={m.method}>
											<TableCell className="capitalize">{m.method.replace("_", " ")}</TableCell>
											<TableCell className="text-right">{formatGYD(Number(m.tips_total))}</TableCell>
											<TableCell className="text-right">{m.tip_count}</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			{/* Employee Detail Table */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Employee Tip Breakdown</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Employee</TableHead>
								<TableHead className="text-right">Tips Earned</TableHead>
								<TableHead className="text-right">Tipped Orders</TableHead>
								<TableHead className="text-right">Total Orders</TableHead>
								<TableHead className="text-right">Avg Tip</TableHead>
								<TableHead className="text-right">Tip Rate</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{byEmployee.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
										No tip data for this period
									</TableCell>
								</TableRow>
							) : (
								<>
									{byEmployee.map((e) => (
										<TableRow key={e.user_id}>
											<TableCell className="font-medium">{e.employee_name}</TableCell>
											<TableCell className="text-right">{formatGYD(Number(e.tips_earned))}</TableCell>
											<TableCell className="text-right">{e.tipped_orders}</TableCell>
											<TableCell className="text-right">{e.total_orders}</TableCell>
											<TableCell className="text-right">{formatGYD(Number(e.avg_tip))}</TableCell>
											<TableCell className="text-right">
												{e.total_orders > 0
													? `${((e.tipped_orders / e.total_orders) * 100).toFixed(0)}%`
													: "–"}
											</TableCell>
										</TableRow>
									))}
									{/* Totals row */}
									<TableRow className="border-t-2 font-bold">
										<TableCell>Total</TableCell>
										<TableCell className="text-right">{formatGYD(totalTips)}</TableCell>
										<TableCell className="text-right">{tippedOrders}</TableCell>
										<TableCell className="text-right">{totalOrders}</TableCell>
										<TableCell className="text-right">{formatGYD(avgTip)}</TableCell>
										<TableCell className="text-right">
											{totalOrders > 0
												? `${((tippedOrders / totalOrders) * 100).toFixed(0)}%`
												: "–"}
										</TableCell>
									</TableRow>
								</>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
