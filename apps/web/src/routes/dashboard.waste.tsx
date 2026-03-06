import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ChevronUp,
	Plus,
	Trash2,
	TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

const REASON_OPTIONS = [
	{ value: "spoilage", label: "Spoilage" },
	{ value: "over_prep", label: "Over-prep" },
	{ value: "expired", label: "Expired" },
	{ value: "dropped", label: "Dropped" },
	{ value: "other", label: "Other" },
] as const;

const REASON_COLORS: Record<string, string> = {
	spoilage: "bg-red-500/80",
	over_prep: "bg-amber-500/80",
	expired: "bg-orange-500/80",
	dropped: "bg-blue-500/80",
	other: "bg-gray-500/80",
};

function reasonLabel(reason: string): string {
	return REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason;
}

function startOfWeekGY(): string {
	const now = new Date(
		new Date().toLocaleString("en-US", { timeZone: "America/Guyana" }),
	);
	const day = now.getDay();
	const diff = now.getDate() - day + (day === 0 ? -6 : 1);
	const monday = new Date(now.setDate(diff));
	return monday.toISOString().split("T")[0];
}

function startOfMonthGY(): string {
	const today = todayGY();
	return `${today.slice(0, 8)}01`;
}

function thirtyDaysAgoGY(): string {
	const now = new Date(
		new Date().toLocaleString("en-US", { timeZone: "America/Guyana" }),
	);
	now.setDate(now.getDate() - 30);
	return now.toISOString().split("T")[0];
}

export default function WasteTrackingPage() {
	const today = todayGY();
	const monthStart = startOfMonthGY();
	const weekStart = startOfWeekGY();
	const queryClient = useQueryClient();

	const [startDate, setStartDate] = useState(monthStart);
	const [endDate, setEndDate] = useState(today);
	const [showForm, setShowForm] = useState(false);

	// Form state
	const [formProductName, setFormProductName] = useState("");
	const [formQuantity, setFormQuantity] = useState("");
	const [formUnit, setFormUnit] = useState("each");
	const [formReason, setFormReason] = useState<string>("spoilage");
	const [formCost, setFormCost] = useState("");
	const [formNotes, setFormNotes] = useState("");
	const [formInventoryItemId, setFormInventoryItemId] = useState<
		string | undefined
	>(undefined);

	// Queries
	const { data: summary, isLoading: loadingSummary } = useQuery(
		orpc.inventory.getWasteSummary.queryOptions({
			input: { startDate, endDate },
		}),
	);

	const { data: todaySummary } = useQuery(
		orpc.inventory.getWasteSummary.queryOptions({
			input: { startDate: today, endDate: today },
		}),
	);

	const { data: weekSummary } = useQuery(
		orpc.inventory.getWasteSummary.queryOptions({
			input: { startDate: weekStart, endDate: today },
		}),
	);

	const { data: monthSummary } = useQuery(
		orpc.inventory.getWasteSummary.queryOptions({
			input: { startDate: monthStart, endDate: today },
		}),
	);

	// 30-day trend (always last 30 days regardless of filter)
	const thirtyAgo = thirtyDaysAgoGY();
	const { data: trendSummary } = useQuery(
		orpc.inventory.getWasteSummary.queryOptions({
			input: { startDate: thirtyAgo, endDate: today },
		}),
	);

	// Monthly revenue for waste vs revenue %
	const { data: monthRevenue } = useQuery(
		orpc.analytics.getRevenueTrend.queryOptions({
			input: { days: 30 },
		}),
	);

	// Inventory items for autocomplete
	const { data: stockItems } = useQuery(
		orpc.inventory.getStockLevels.queryOptions({ input: {} }),
	);

	const monthRevenueTotal = useMemo(() => {
		if (!monthRevenue) return 0;
		return monthRevenue.reduce((sum, r) => sum + Number(r.revenue || 0), 0);
	}, [monthRevenue]);

	const wasteVsRevenuePct = useMemo(() => {
		const wasteCost = monthSummary?.totalWasteCost ?? 0;
		if (monthRevenueTotal <= 0) return 0;
		return Math.round((wasteCost / monthRevenueTotal) * 10000) / 100;
	}, [monthSummary, monthRevenueTotal]);

	// Mutation
	const logWasteMutation = useMutation(
		orpc.inventory.logWaste.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["inventory"] });
				queryClient.invalidateQueries({ queryKey: ["analytics"] });
				setFormProductName("");
				setFormQuantity("");
				setFormUnit("each");
				setFormReason("spoilage");
				setFormCost("");
				setFormNotes("");
				setFormInventoryItemId(undefined);
				setShowForm(false);
				toast.success("Waste logged successfully");
			},
			onError: (err: Error) => {
				toast.error(`Failed to log waste: ${err.message}`);
			},
		}),
	);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!formProductName.trim() || !formQuantity) return;

		logWasteMutation.mutate({
			organizationId: DEFAULT_ORG_ID,
			inventoryItemId: formInventoryItemId,
			productName: formProductName.trim(),
			quantity: formQuantity,
			unit: formUnit,
			estimatedCost: formCost || "0",
			reason: formReason as
				| "spoilage"
				| "over_prep"
				| "expired"
				| "dropped"
				| "other",
			notes: formNotes || undefined,
			loggedBy: "system", // Will be overridden by auth context in production
		});
	}

	function handleSelectInventoryItem(itemId: string) {
		const item = stockItems?.find((s) => s.inventoryItemId === itemId);
		if (item) {
			setFormInventoryItemId(itemId);
			setFormProductName(item.itemName);
			setFormUnit(item.unitOfMeasure);
			if (item.avgCost) {
				setFormCost(String(Number(item.avgCost)));
			}
		}
	}

	// Chart data
	const trendRows = trendSummary?.dailyTrend ?? [];
	const maxTrendCost = Math.max(...trendRows.map((r) => r.cost), 1);

	const byReason = summary?.byReason ?? [];
	const maxReasonCost = Math.max(...byReason.map((r) => r.cost), 1);

	const topItems = summary?.topItems ?? [];

	const isLoading = loadingSummary;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20 text-muted-foreground">
				Loading waste tracker...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-xl sm:text-2xl">
						<Trash2 className="size-5" />
						Food Waste Tracker
					</h1>
					<p className="text-muted-foreground text-sm">
						Track and reduce food waste to improve profitability
					</p>
				</div>
				<Button
					size="sm"
					onClick={() => setShowForm(!showForm)}
					className="gap-1"
				>
					{showForm ? (
						<ChevronUp className="size-4" />
					) : (
						<Plus className="size-4" />
					)}
					{showForm ? "Hide Form" : "Log Waste"}
				</Button>
			</div>

			{/* Date Range Picker */}
			<Card>
				<CardContent className="flex flex-wrap items-end gap-4 pt-4">
					<div className="flex flex-col gap-1">
						<label
							htmlFor="waste-start"
							className="font-medium text-muted-foreground text-xs"
						>
							Start Date
						</label>
						<input
							id="waste-start"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-3 text-sm"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="waste-end"
							className="font-medium text-muted-foreground text-xs"
						>
							End Date
						</label>
						<input
							id="waste-end"
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

			{/* Quick Log Form */}
			{showForm && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Plus className="size-4" />
							Log Waste Entry
						</CardTitle>
						<CardDescription className="text-xs">
							Record a new food waste incident
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<div className="flex flex-col gap-1">
								<label
									htmlFor="waste-item"
									className="font-medium text-muted-foreground text-xs"
								>
									Item
								</label>
								{stockItems && stockItems.length > 0 ? (
									<div className="flex flex-col gap-2 sm:flex-row">
										<select
											className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
											value={formInventoryItemId ?? ""}
											onChange={(e) => {
												if (e.target.value) {
													handleSelectInventoryItem(e.target.value);
												} else {
													setFormInventoryItemId(undefined);
													setFormProductName("");
												}
											}}
										>
											<option value="">
												-- Select from inventory (optional) --
											</option>
											{stockItems.map((item) => (
												<option
													key={item.inventoryItemId}
													value={item.inventoryItemId}
												>
													{item.itemName} ({item.sku})
												</option>
											))}
										</select>
										<input
											id="waste-item"
											type="text"
											placeholder="Or type product name"
											value={formProductName}
											onChange={(e) => {
												setFormProductName(e.target.value);
												setFormInventoryItemId(undefined);
											}}
											className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
											required
										/>
									</div>
								) : (
									<input
										id="waste-item"
										type="text"
										placeholder="Product name"
										value={formProductName}
										onChange={(e) => setFormProductName(e.target.value)}
										className="h-9 rounded-md border border-input bg-background px-3 text-sm"
										required
									/>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div className="flex flex-col gap-1">
									<label
										htmlFor="waste-qty"
										className="font-medium text-muted-foreground text-xs"
									>
										Quantity
									</label>
									<input
										id="waste-qty"
										type="number"
										step="0.01"
										min="0"
										placeholder="0"
										value={formQuantity}
										onChange={(e) => setFormQuantity(e.target.value)}
										className="h-9 rounded-md border border-input bg-background px-3 text-sm"
										required
									/>
								</div>
								<div className="flex flex-col gap-1">
									<label
										htmlFor="waste-unit"
										className="font-medium text-muted-foreground text-xs"
									>
										Unit
									</label>
									<input
										id="waste-unit"
										type="text"
										placeholder="each, lbs, oz..."
										value={formUnit}
										onChange={(e) => setFormUnit(e.target.value)}
										className="h-9 rounded-md border border-input bg-background px-3 text-sm"
										required
									/>
								</div>
								<div className="flex flex-col gap-1">
									<label
										htmlFor="waste-reason"
										className="font-medium text-muted-foreground text-xs"
									>
										Reason
									</label>
									<select
										id="waste-reason"
										value={formReason}
										onChange={(e) => setFormReason(e.target.value)}
										className="h-9 rounded-md border border-input bg-background px-3 text-sm"
										required
									>
										{REASON_OPTIONS.map((r) => (
											<option key={r.value} value={r.value}>
												{r.label}
											</option>
										))}
									</select>
								</div>
								<div className="flex flex-col gap-1">
									<label
										htmlFor="waste-cost"
										className="font-medium text-muted-foreground text-xs"
									>
										Est. Cost ($)
									</label>
									<input
										id="waste-cost"
										type="number"
										step="0.01"
										min="0"
										placeholder="0.00"
										value={formCost}
										onChange={(e) => setFormCost(e.target.value)}
										className="h-9 rounded-md border border-input bg-background px-3 text-sm"
									/>
								</div>
							</div>

							<div className="flex flex-col gap-1">
								<label
									htmlFor="waste-notes"
									className="font-medium text-muted-foreground text-xs"
								>
									Notes (optional)
								</label>
								<textarea
									id="waste-notes"
									placeholder="Additional details..."
									value={formNotes}
									onChange={(e) => setFormNotes(e.target.value)}
									rows={2}
									className="rounded-md border border-input bg-background px-3 py-2 text-sm"
								/>
							</div>

							<div className="flex justify-end">
								<Button
									type="submit"
									size="sm"
									disabled={logWasteMutation.isPending}
									className="gap-1"
								>
									<Trash2 className="size-4" />
									{logWasteMutation.isPending ? "Logging..." : "Log Waste"}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			)}

			{/* KPI Cards */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							{"Today's Waste"}
						</CardTitle>
						<Trash2 className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg text-red-600 sm:text-2xl dark:text-red-400">
							{formatGYD(todaySummary?.totalWasteCost ?? 0)}
						</div>
						<p className="text-muted-foreground text-xs">
							{todaySummary?.wasteCount ?? 0} incidents
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							This Week
						</CardTitle>
						<TrendingDown className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg text-red-600 sm:text-2xl dark:text-red-400">
							{formatGYD(weekSummary?.totalWasteCost ?? 0)}
						</div>
						<p className="text-muted-foreground text-xs">
							{weekSummary?.wasteCount ?? 0} incidents
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							This Month
						</CardTitle>
						<AlertTriangle className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-lg text-red-600 sm:text-2xl dark:text-red-400">
							{formatGYD(monthSummary?.totalWasteCost ?? 0)}
						</div>
						<p className="text-muted-foreground text-xs">
							{monthSummary?.wasteCount ?? 0} incidents
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-xs sm:text-sm">
							Waste vs Revenue
						</CardTitle>
						<TrendingDown className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className={`font-bold text-lg sm:text-2xl ${
								wasteVsRevenuePct > 5
									? "text-red-600 dark:text-red-400"
									: wasteVsRevenuePct > 2
										? "text-amber-600 dark:text-amber-400"
										: "text-green-600 dark:text-green-400"
							}`}
						>
							{wasteVsRevenuePct.toFixed(1)}%
						</div>
						<p className="text-muted-foreground text-xs">of monthly revenue</p>
					</CardContent>
				</Card>
			</div>

			{/* Waste by Reason + Top Items */}
			<div className="grid gap-4 lg:grid-cols-2">
				{/* Waste by Reason */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<AlertTriangle className="size-4" />
							Waste by Reason
						</CardTitle>
						<CardDescription className="text-xs">
							{startDate} to {endDate}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{byReason.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No waste data for this period.
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{byReason.map((row) => {
									const barWidth =
										maxReasonCost > 0 ? (row.cost / maxReasonCost) * 100 : 0;
									return (
										<div
											key={row.reason}
											className="flex items-center gap-2 text-xs"
										>
											<span className="w-20 shrink-0 font-medium capitalize">
												{reasonLabel(row.reason)}
											</span>
											<div className="relative flex-1">
												<div
													className={`h-6 rounded-sm transition-all ${REASON_COLORS[row.reason] || "bg-gray-500/80"}`}
													style={{ width: `${Math.max(barWidth, 1)}%` }}
												/>
											</div>
											<span className="w-8 shrink-0 text-right font-mono text-muted-foreground">
												{row.count}x
											</span>
											<span className="w-20 shrink-0 text-right font-medium font-mono">
												{formatGYD(row.cost)}
											</span>
										</div>
									);
								})}
								{/* Legend */}
								<div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
									{REASON_OPTIONS.map((r) => (
										<span key={r.value} className="flex items-center gap-1">
											<span
												className={`inline-block size-2 rounded-full ${REASON_COLORS[r.value]}`}
											/>
											{r.label}
										</span>
									))}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Top Wasted Items Table */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<TrendingDown className="size-4" />
							Top Wasted Items
						</CardTitle>
						<CardDescription className="text-xs">
							Top 10 by cost -- {startDate} to {endDate}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{topItems.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No waste data for this period.
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-left text-muted-foreground text-xs">
											<th className="pr-4 pb-2 font-medium">Product</th>
											<th className="pr-4 pb-2 text-right font-medium">
												Count
											</th>
											<th className="pr-4 pb-2 text-right font-medium">
												Total Cost
											</th>
											<th className="pb-2 text-right font-medium">
												Avg/Incident
											</th>
										</tr>
									</thead>
									<tbody>
										{topItems.map((item, i) => {
											const avgCost =
												item.count > 0 ? item.cost / item.count : 0;
											return (
												<tr
													key={i}
													className="border-border/50 border-b last:border-0"
												>
													<td className="py-1.5 pr-4 font-medium">
														{item.productName}
													</td>
													<td className="py-1.5 pr-4 text-right font-mono">
														{item.count}
													</td>
													<td className="py-1.5 pr-4 text-right font-mono">
														{formatGYD(item.cost)}
													</td>
													<td className="py-1.5 text-right font-mono">
														{formatGYD(Math.round(avgCost))}
													</td>
												</tr>
											);
										})}
									</tbody>
									{topItems.length > 1 && (
										<tfoot>
											<tr className="border-t-2 font-bold">
												<td className="pt-2 pr-4">Total</td>
												<td className="pt-2 pr-4 text-right font-mono">
													{topItems.reduce((s, i) => s + i.count, 0)}
												</td>
												<td className="pt-2 pr-4 text-right font-mono">
													{formatGYD(topItems.reduce((s, i) => s + i.cost, 0))}
												</td>
												<td className="pt-2 text-right font-mono">--</td>
											</tr>
										</tfoot>
									)}
								</table>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* 30-Day Trend Chart */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-1">
						<CardTitle className="flex items-center gap-2 text-base">
							<TrendingDown className="size-4" />
							30-Day Waste Trend
						</CardTitle>
						<CardDescription className="text-xs">
							Daily waste cost over the last 30 days
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
								const barWidth =
									maxTrendCost > 0 ? (row.cost / maxTrendCost) * 100 : 0;
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
												className="h-5 rounded-sm bg-red-500/70 transition-all"
												style={{ width: `${Math.max(barWidth, 0.5)}%` }}
											/>
										</div>
										<span className="w-8 shrink-0 text-right font-mono text-muted-foreground">
											{row.count}x
										</span>
										<span className="w-24 shrink-0 text-right font-medium font-mono">
											{formatGYD(row.cost)}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* High waste alert */}
			{wasteVsRevenuePct > 5 && (
				<Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30">
					<CardContent className="flex items-center gap-3 pt-4">
						<AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
						<div>
							<div className="font-semibold text-red-800 text-sm dark:text-red-300">
								High food waste detected
							</div>
							<div className="text-red-700 text-xs dark:text-red-400">
								This month&apos;s food waste is at{" "}
								{wasteVsRevenuePct.toFixed(1)}% of revenue. Industry best
								practice targets 2-5%. Review the top wasted items and reasons
								above for improvement opportunities.
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
