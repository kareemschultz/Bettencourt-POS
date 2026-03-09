import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Tooltip as RechartsTooltip,
	ResponsiveContainer,
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

// Compute default start date: Jan 1 of current year in Guyana timezone
function defaultStartDate(): string {
	const year = new Date()
		.toLocaleDateString("en-CA", { timeZone: "America/Guyana" })
		.slice(0, 4);
	return `${year}-01-01`;
}

// ── page ─────────────────────────────────────────────────────────────────

export default function TaxSummaryPage() {
	const [startDate, setStartDate] = useState(defaultStartDate());
	const [endDate, setEndDate] = useState(todayGY());

	const { data: taxRaw, isLoading } = useQuery(
		orpc.invoices.getTaxSummary.queryOptions({
			input: { startDate, endDate },
		}),
	);

	const tax = taxRaw as
		| {
				collected: string;
				paid: string;
				net: string;
				byMonth: Array<{ month: string; collected: string; paid: string }>;
		  }
		| undefined;

	const collected = Number(tax?.collected ?? "0");
	const paid = Number(tax?.paid ?? "0");
	const net = Number(tax?.net ?? "0");

	const chartData = (tax?.byMonth ?? []).map((row) => ({
		label: monthLabel(row.month),
		"Tax Collected": Number(row.collected),
		"Tax Paid": Number(row.paid),
	}));

	function handleExport() {
		downloadCsv(
			`tax-summary-${startDate}-to-${endDate}.csv`,
			(tax?.byMonth ?? []).map((row) => ({
				Month: row.month,
				"Tax Collected": row.collected,
				"Tax Paid": row.paid,
				Net: (Number(row.collected) - Number(row.paid)).toFixed(2),
			})),
		);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground tracking-tight">
						Tax Summary
					</h1>
					<p className="text-muted-foreground text-sm">
						VAT collected vs. tax paid for any period
					</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					className="gap-1 self-start sm:self-auto"
					onClick={handleExport}
				>
					<Download className="size-4" />
					Export CSV
				</Button>
			</div>

			{/* Period Selector */}
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<Label className="text-muted-foreground text-xs">From</Label>
					<Input
						type="date"
						value={startDate}
						onChange={(e) => setStartDate(e.target.value)}
						className="h-8 w-36 text-sm"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<Label className="text-muted-foreground text-xs">To</Label>
					<Input
						type="date"
						value={endDate}
						onChange={(e) => setEndDate(e.target.value)}
						className="h-8 w-36 text-sm"
					/>
				</div>
			</div>

			{/* KPI Cards */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{isLoading ? (
					<>
						<Skeleton className="h-24 rounded-lg" />
						<Skeleton className="h-24 rounded-lg" />
						<Skeleton className="h-24 rounded-lg" />
					</>
				) : (
					<>
						<Card>
							<CardContent className="flex flex-col gap-1 p-4">
								<p className="text-muted-foreground text-xs">Tax Collected</p>
								<p className="font-bold text-2xl text-green-600">
									{formatGYD(collected)}
								</p>
								<p className="text-muted-foreground text-xs">
									From paid invoices
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="flex flex-col gap-1 p-4">
								<p className="text-muted-foreground text-xs">Tax Paid</p>
								<p className="font-bold text-2xl text-orange-600">
									{formatGYD(paid)}
								</p>
								<p className="text-muted-foreground text-xs">
									From vendor bills &amp; expenses
								</p>
							</CardContent>
						</Card>
						<Card className={net >= 0 ? "border-blue-200" : "border-red-200"}>
							<CardContent className="flex flex-col gap-1 p-4">
								<p className="text-muted-foreground text-xs">
									Net Tax Liability
								</p>
								<p
									className={`font-bold text-2xl ${net >= 0 ? "text-blue-600" : "text-red-600"}`}
								>
									{formatGYD(net)}
								</p>
								<p className="text-muted-foreground text-xs">
									{net >= 0 ? "Amount owed to GRA" : "Overpaid — claim refund"}
								</p>
							</CardContent>
						</Card>
					</>
				)}
			</div>

			{/* Bar Chart */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm">
						Tax Collected vs Tax Paid — by Month
					</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<Skeleton className="h-56 w-full rounded-md" />
					) : chartData.length === 0 ? (
						<div className="flex h-56 items-center justify-center text-muted-foreground text-sm">
							No tax data for the selected period.
						</div>
					) : (
						<ResponsiveContainer width="100%" height={220}>
							<BarChart
								data={chartData}
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
									dataKey="Tax Collected"
									fill="hsl(var(--chart-1))"
									radius={[4, 4, 0, 0]}
								/>
								<Bar
									dataKey="Tax Paid"
									fill="hsl(var(--chart-2))"
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					)}
				</CardContent>
			</Card>

			{/* Monthly Breakdown Table */}
			<div className="rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="text-xs">Month</TableHead>
							<TableHead className="text-right text-xs">
								Tax Collected
							</TableHead>
							<TableHead className="text-right text-xs">Tax Paid</TableHead>
							<TableHead className="text-right text-xs">Net</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							Array.from({ length: 4 }).map((_, i) => (
								<TableRow key={i}>
									{Array.from({ length: 4 }).map((__, j) => (
										<TableCell key={j}>
											<Skeleton className="h-4 w-full rounded" />
										</TableCell>
									))}
								</TableRow>
							))
						) : (tax?.byMonth ?? []).length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="py-10 text-center text-muted-foreground text-sm"
								>
									No data for the selected period. Adjust the date range above.
								</TableCell>
							</TableRow>
						) : (
							<>
								{(tax?.byMonth ?? []).map((row, i) => {
									const rowNet = Number(row.collected) - Number(row.paid);
									return (
										<TableRow key={i} className="hover:bg-muted/50">
											<TableCell className="font-medium text-sm">
												{row.month}
											</TableCell>
											<TableCell className="text-right text-green-700 text-sm">
												{formatGYD(Number(row.collected))}
											</TableCell>
											<TableCell className="text-right text-orange-700 text-sm">
												{formatGYD(Number(row.paid))}
											</TableCell>
											<TableCell
												className={`text-right font-semibold text-sm ${rowNet >= 0 ? "text-blue-700" : "text-red-700"}`}
											>
												{formatGYD(rowNet)}
											</TableCell>
										</TableRow>
									);
								})}
								{/* Totals row */}
								<TableRow className="border-t-2 bg-muted/30 font-semibold">
									<TableCell className="text-sm">Total</TableCell>
									<TableCell className="text-right text-green-700 text-sm">
										{formatGYD(collected)}
									</TableCell>
									<TableCell className="text-right text-orange-700 text-sm">
										{formatGYD(paid)}
									</TableCell>
									<TableCell
										className={`text-right text-sm ${net >= 0 ? "text-blue-700" : "text-red-700"}`}
									>
										{formatGYD(net)}
									</TableCell>
								</TableRow>
							</>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
