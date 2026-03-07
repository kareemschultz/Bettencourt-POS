import { useQuery } from "@tanstack/react-query";
import { DollarSign, Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function firstOfMonth(): string {
	const t = todayGY();
	return `${t.slice(0, 8)}01`;
}

function pctChange(current: number, previous: number): number | null {
	if (previous === 0) return current === 0 ? null : 100;
	return ((current - previous) / Math.abs(previous)) * 100;
}

function ChangeIndicator({
	current,
	previous,
	invert = false,
}: {
	current: number;
	previous: number;
	invert?: boolean;
}) {
	const pct = pctChange(current, previous);
	if (pct === null) return null;
	// For costs/expenses, a decrease is good (invert=true)
	const isGood = invert ? pct <= 0 : pct >= 0;
	const color = isGood ? "text-emerald-600" : "text-red-600";
	const sign = pct >= 0 ? "+" : "";
	return (
		<span className={`ml-2 font-medium text-xs ${color}`}>
			({sign}
			{pct.toFixed(1)}%)
		</span>
	);
}

export default function PnlPage() {
	const today = todayGY();
	const [startDate, setStartDate] = useState(firstOfMonth());
	const [endDate, setEndDate] = useState(today);

	const startTs = `${startDate}T00:00:00-04:00`;
	const endTs = `${endDate}T23:59:59-04:00`;

	const { data, isLoading } = useQuery(
		orpc.journal.getProfitAndLoss.queryOptions({
			input: { startDate: startTs, endDate: endTs },
		}),
	);

	function handlePrint() {
		window.print();
	}

	function exportCSV() {
		if (!data) return;
		const lines: string[] = ["Category,Item,Amount"];
		lines.push(`Revenue,Gross Sales,${data.revenue.grossSales.toFixed(2)}`);
		lines.push(`Revenue,Less: Discounts,-${data.revenue.discounts.toFixed(2)}`);
		lines.push(`Revenue,Less: Refunds,-${data.revenue.refunds.toFixed(2)}`);
		lines.push(`Revenue,Net Revenue,${data.revenue.netRevenue.toFixed(2)}`);
		lines.push(`COGS,Cost of Goods Sold,-${data.cogs.total.toFixed(2)}`);
		lines.push(`COGS,Gross Profit,${data.cogs.grossProfit.toFixed(2)}`);
		for (const item of data.expenses.items) {
			lines.push(`Expenses,"${item.category}",-${item.amount.toFixed(2)}`);
		}
		lines.push(`Expenses,Total Expenses,-${data.expenses.total.toFixed(2)}`);
		lines.push(`Labor,Labor Cost,-${data.labor.cost.toFixed(2)}`);
		lines.push(`Bottom Line,NET PROFIT,${data.netProfit.toFixed(2)}`);
		const content = lines.join("\n");
		const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `bettencourt-pnl-${startDate}-to-${endDate}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("P&L exported as CSV");
	}

	const prev = data?.previousPeriod;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Screen header */}
			<div className="flex items-center justify-between print:hidden">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<DollarSign className="size-6" /> Profit & Loss Statement
					</h1>
					<p className="text-muted-foreground">
						Income statement with period-over-period comparison.
					</p>
				</div>
				<div className="flex items-center gap-3">
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
					<Button variant="outline" className="gap-2" onClick={handlePrint}>
						<Printer className="size-4" /> Print
					</Button>
					<Button
						variant="outline"
						className="gap-2"
						onClick={exportCSV}
						disabled={!data}
					>
						<Download className="size-4" /> CSV
					</Button>
				</div>
			</div>

			{/* Print header */}
			<div className="mb-6 hidden border-b pb-4 print:block">
				<div className="flex items-start justify-between">
					<div>
						<h1 className="font-bold text-xl">Bettencourt's Food Inc.</h1>
						<p className="text-muted-foreground text-sm">
							Main Location, Georgetown, Guyana
						</p>
					</div>
					<div className="text-right">
						<p className="font-bold text-base">Profit & Loss Statement</p>
						<p className="text-sm">
							{startDate} to {endDate}
						</p>
						<p className="text-muted-foreground text-xs">
							Generated: {new Date().toLocaleString("en-GY")}
						</p>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : data ? (
				<Card className="print:border print:shadow-none">
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							Period: {startDate} to {endDate}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-1 font-mono text-sm">
							{/* Revenue */}
							<div className="mb-1 font-bold text-base">Revenue</div>
							<Row
								label="Gross Sales"
								amount={data.revenue.grossSales}
								indent
								prev={prev?.grossSales}
							/>
							<Row
								label="Less: Discounts"
								amount={-data.revenue.discounts}
								indent
								prev={prev ? -prev.discounts : undefined}
								invert
							/>
							<Row
								label="Less: Refunds"
								amount={-data.revenue.refunds}
								indent
								prev={prev ? -prev.refunds : undefined}
								invert
							/>
							<Separator />
							<Row
								label="Net Revenue"
								amount={data.revenue.netRevenue}
								bold
								prev={prev?.netRevenue}
							/>

							<Spacer />

							{/* COGS */}
							<Row
								label="Cost of Goods Sold"
								amount={-data.cogs.total}
								prev={prev ? -prev.cogs : undefined}
								invert
							/>
							<Separator />
							<Row
								label="Gross Profit"
								amount={data.cogs.grossProfit}
								bold
								pct={data.cogs.grossMarginPercent}
								prev={prev?.grossProfit}
							/>

							<Spacer />

							{/* Operating Expenses */}
							<div className="mb-1 font-bold text-base">Operating Expenses</div>
							{data.expenses.items.map((item) => (
								<Row
									key={item.category}
									label={item.category}
									amount={-item.amount}
									indent
								/>
							))}
							{data.expenses.items.length === 0 && (
								<div className="pl-6 text-muted-foreground italic">
									No expenses recorded
								</div>
							)}
							<Separator />
							<Row
								label="Total Expenses"
								amount={-data.expenses.total}
								bold
								prev={prev ? -prev.totalExpenses : undefined}
								invert
							/>

							<Spacer />

							{/* Labor */}
							<Row
								label={`Labor Cost (${data.labor.hours.toFixed(1)} hrs)`}
								amount={-data.labor.cost}
								prev={prev ? -prev.laborCost : undefined}
								invert
							/>

							<Separator double />

							{/* Net Profit */}
							<div className="flex items-baseline justify-between pt-1">
								<span className="font-bold text-base">NET PROFIT</span>
								<span className="flex items-baseline gap-2">
									<span
										className={`font-bold text-base ${data.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}
									>
										{formatGYD(data.netProfit)}
									</span>
									<span className="text-muted-foreground text-xs">
										{data.netProfitPercent.toFixed(1)}%
									</span>
									{prev != null && (
										<ChangeIndicator
											current={data.netProfit}
											previous={prev.netProfit}
										/>
									)}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			) : null}

			{/* Print footer */}
			<div className="mt-8 hidden border-t pt-2 text-center text-muted-foreground text-xs print:block">
				Bettencourt's Food Inc. · Confidential Financial Report ·{" "}
				{new Date().toLocaleString("en-GY")}
			</div>
		</div>
	);
}

/* ── Reusable P&L row components ────────────────────────────────────── */

function Row({
	label,
	amount,
	indent,
	bold,
	pct,
	prev,
	invert,
}: {
	label: string;
	amount: number;
	indent?: boolean;
	bold?: boolean;
	pct?: number;
	prev?: number;
	invert?: boolean;
}) {
	return (
		<div
			className={`flex items-baseline justify-between ${bold ? "font-bold" : ""}`}
		>
			<span className={indent ? "pl-6" : ""}>{label}</span>
			<span className="flex items-baseline gap-1">
				<span>
					{amount < 0 ? `(${formatGYD(Math.abs(amount))})` : formatGYD(amount)}
				</span>
				{pct != null && (
					<span className="ml-1 text-muted-foreground text-xs">
						{pct.toFixed(1)}%
					</span>
				)}
				{prev != null && (
					<ChangeIndicator current={amount} previous={prev} invert={invert} />
				)}
			</span>
		</div>
	);
}

function Separator({ double }: { double?: boolean }) {
	return (
		<div
			className={`border-t ${double ? "border-t-2 border-double" : ""} my-1 border-muted-foreground/30`}
		/>
	);
}

function Spacer() {
	return <div className="h-3" />;
}
