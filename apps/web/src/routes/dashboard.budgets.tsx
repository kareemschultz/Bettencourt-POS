import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronUp,
	Edit2,
	MoreHorizontal,
	Plus,
	Trash2,
	TrendingUp,
	X,
} from "lucide-react";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// ── Types ────────────────────────────────────────────────────────────────────

interface BudgetCategory {
	category: string;
	budgeted: string;
	alertThreshold: number;
}

interface BudgetForm {
	name: string;
	period: "monthly" | "quarterly" | "annually";
	startDate: string;
	endDate: string;
	categories: BudgetCategory[];
}

interface BudgetRow {
	id: string;
	name: string;
	period: string;
	startDate: string | null;
	endDate: string | null;
	status: string;
	categories: BudgetCategory[];
	createdAt: string;
}

interface BudgetVsActualRow {
	category: string;
	budgeted: string;
	actual: string;
	variance: string;
	percentUsed: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const QUICK_CATEGORIES = [
	"Food Supplies",
	"Beverages",
	"Utilities",
	"Staff",
	"Cleaning",
	"Rent",
	"Transport",
	"Maintenance",
];

const PERIOD_LABELS: Record<string, string> = {
	monthly: "Monthly",
	quarterly: "Quarterly",
	annually: "Annually",
};

const emptyForm: BudgetForm = {
	name: "",
	period: "monthly",
	startDate: todayGY(),
	endDate: "",
	categories: [{ category: "", budgeted: "0", alertThreshold: 80 }],
};

// ── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
	const color =
		percent > 100
			? "bg-red-500"
			: percent > 75
				? "bg-amber-500"
				: "bg-green-500";
	return (
		<div className="h-2 w-full rounded-full bg-gray-200">
			<div
				className={`h-2 rounded-full ${color} transition-all`}
				style={{ width: `${Math.min(percent, 100)}%` }}
			/>
		</div>
	);
}

function statusBadgeClass(status: string): string {
	switch (status) {
		case "active":
			return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
		case "closed":
			return "bg-secondary text-secondary-foreground";
		default:
			return "bg-secondary text-secondary-foreground";
	}
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
	const queryClient = useQueryClient();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<BudgetForm>(emptyForm);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);

	// ── Queries ──────────────────────────────────────────────────────────────

	const { data: budgetsRaw, isLoading: loadingBudgets } = useQuery(
		orpc.budgets.list.queryOptions({ input: {} }),
	);
	const { data: monthlyBudgetData } = useQuery(
		orpc.budgets.getCurrentMonthBudgets.queryOptions({ input: {} }),
	);
	const budgets = (budgetsRaw as BudgetRow[] | undefined) ?? [];

	// Placeholder UUID used when no budget is expanded; query is disabled in that case.
	const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000000";
	const { data: detailRaw, isLoading: loadingDetail } = useQuery(
		orpc.budgets.getBudgetVsActual.queryOptions({
			input: { budgetId: expandedId ?? PLACEHOLDER_UUID },
			enabled: !!expandedId,
		}),
	);
	const budgetVsActual = (detailRaw as BudgetVsActualRow[] | undefined) ?? [];

	// ── Mutations ────────────────────────────────────────────────────────────

	const createMut = useMutation(
		orpc.budgets.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.budgets.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Budget created");
			},
			onError: (e) => toast.error(e.message || "Failed to create budget"),
		}),
	);

	const updateMut = useMutation(
		orpc.budgets.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.budgets.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Budget updated");
			},
			onError: (e) => toast.error(e.message || "Failed to update budget"),
		}),
	);

	const deleteMut = useMutation(
		orpc.budgets.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.budgets.list.queryOptions({ input: {} }).queryKey,
				});
				toast.success("Budget deleted");
			},
			onError: (e) => toast.error(e.message || "Failed to delete budget"),
		}),
	);

	// ── Handlers ─────────────────────────────────────────────────────────────

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(budget: BudgetRow) {
		setEditingId(budget.id);
		setForm({
			name: budget.name,
			period: budget.period as "monthly" | "quarterly" | "annually",
			startDate: budget.startDate ? (budget.startDate.split("T")[0] ?? "") : "",
			endDate: budget.endDate ? (budget.endDate.split("T")[0] ?? "") : "",
			categories: Array.isArray(budget.categories) ? budget.categories : [],
		});
		setDialogOpen(true);
	}

	function handleSave() {
		const categories = form.categories.filter((c) => c.category.trim() !== "");
		if (editingId) {
			updateMut.mutate({
				id: editingId,
				name: form.name,
				period: form.period,
				startDate: form.startDate || undefined,
				endDate: form.endDate || undefined,
				categories,
			});
		} else {
			createMut.mutate({
				name: form.name,
				period: form.period,
				startDate: form.startDate || todayGY(),
				endDate: form.endDate || todayGY(),
				categories,
			});
		}
	}

	function addCategory() {
		setForm((f) => ({
			...f,
			categories: [
				...f.categories,
				{ category: "", budgeted: "0", alertThreshold: 80 },
			],
		}));
	}

	function removeCategory(index: number) {
		setForm((f) => ({
			...f,
			categories: f.categories.filter((_, i) => i !== index),
		}));
	}

	function updateCategory(
		index: number,
		field: keyof BudgetCategory,
		value: string | number,
	) {
		setForm((f) => {
			const cats = [...f.categories];
			cats[index] = { ...cats[index]!, [field]: value };
			return { ...f, categories: cats };
		});
	}

	function addQuickCategory(name: string) {
		// Don't add if already present
		if (form.categories.some((c) => c.category === name)) return;
		setForm((f) => ({
			...f,
			categories: [
				...f.categories.filter((c) => c.category.trim() !== ""),
				{ category: name, budgeted: "0", alertThreshold: 80 },
			],
		}));
	}

	function toggleExpand(id: string) {
		setExpandedId((prev) => (prev === id ? null : id));
	}

	// ── Recharts data ─────────────────────────────────────────────────────────

	const chartData = budgetVsActual.map((r) => ({
		category: r.category,
		Budgeted: Number(r.budgeted),
		Actual: Number(r.actual),
	}));

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<TrendingUp className="size-6" />
						Budgets
					</h1>
					<p className="text-muted-foreground text-sm">
						Track spending against budgets by category
					</p>
				</div>
				<Button onClick={openCreate} className="gap-2">
					<Plus className="size-4" />
					New Budget
				</Button>
			</div>

			{/* Budget list */}
			{loadingBudgets ? (
				<div className="flex flex-col gap-4">
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className="h-48 w-full rounded-lg" />
					))}
				</div>
			) : budgets.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
						<TrendingUp className="size-12 opacity-20" />
						<p className="font-medium text-base">No budgets yet</p>
						<p className="text-sm">
							Create your first budget to start tracking spending by category.
						</p>
						<Button onClick={openCreate} variant="outline" className="gap-2">
							<Plus className="size-4" />
							New Budget
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="flex flex-col gap-4">
					{budgets.map((budget) => {
						const isExpanded = expandedId === budget.id;
						return (
							<Card key={budget.id}>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-start justify-between gap-3">
										<button
											type="button"
											className="flex flex-1 cursor-pointer items-center gap-3 text-left"
											onClick={() => toggleExpand(budget.id)}
											onKeyDown={(e) =>
												e.key === "Enter" && toggleExpand(budget.id)
											}
										>
											<div className="flex-1">
												<p className="font-semibold text-base">{budget.name}</p>
												<p className="font-normal text-muted-foreground text-sm">
													{PERIOD_LABELS[budget.period] ?? budget.period}
													{budget.startDate && (
														<span>
															{" "}
															&mdash;{" "}
															{new Date(budget.startDate).toLocaleDateString(
																"en-GY",
																{ timeZone: "America/Guyana" },
															)}
															{budget.endDate && (
																<>
																	{" "}
																	to{" "}
																	{new Date(budget.endDate).toLocaleDateString(
																		"en-GY",
																		{ timeZone: "America/Guyana" },
																	)}
																</>
															)}
														</span>
													)}
												</p>
											</div>
											<Badge className={statusBadgeClass(budget.status)}>
												{budget.status.charAt(0).toUpperCase() +
													budget.status.slice(1)}
											</Badge>
											{isExpanded ? (
												<ChevronUp className="size-4 text-muted-foreground" />
											) : (
												<ChevronDown className="size-4 text-muted-foreground" />
											)}
										</button>
										<DropdownMenu>
											<DropdownMenuTrigger
												className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
												type="button"
												onClick={(e) => e.stopPropagation()}
											>
												<MoreHorizontal className="size-4" />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-44">
												<DropdownMenuItem
													onClick={(e) => {
														e.stopPropagation();
														openEdit(budget);
													}}
												>
													<Edit2 className="mr-2 size-3.5" />
													Edit Budget
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={(e) => {
														e.stopPropagation();
														setDeleteTarget({
															id: budget.id,
															name: budget.name,
														});
													}}
												>
													<Trash2 className="mr-2 size-3.5" />
													Delete Budget
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</CardTitle>
								</CardHeader>

								{/* Category progress bars */}
								{Array.isArray(budget.categories) &&
									budget.categories.length > 0 && (
										<CardContent className="flex flex-col gap-3 pt-0">
											{budget.categories.map((cat, i) => {
												// Find actual from budgetVsActual if expanded
												const actual = isExpanded
													? budgetVsActual.find(
															(r) => r.category === cat.category,
														)
													: null;
												const actualAmt = actual ? Number(actual.actual) : 0;
												const percent =
													Number(cat.budgeted) > 0
														? (actualAmt / Number(cat.budgeted)) * 100
														: 0;

												return (
													<div key={i} className="flex flex-col gap-1">
														<div className="flex items-center justify-between text-xs">
															<span className="font-medium">
																{cat.category}
															</span>
															<span className="text-muted-foreground">
																{isExpanded && actual
																	? `${formatGYD(actualAmt)} / ${formatGYD(Number(cat.budgeted))} (${Math.round(percent)}%)`
																	: `Budget: ${formatGYD(Number(cat.budgeted))}`}
															</span>
														</div>
														{isExpanded && <ProgressBar percent={percent} />}
													</div>
												);
											})}
										</CardContent>
									)}

								{/* Expanded detail: chart + variance table */}
								{isExpanded && (
									<CardContent className="flex flex-col gap-6 border-t pt-4">
										{loadingDetail ? (
											<Skeleton className="h-64 w-full" />
										) : budgetVsActual.length === 0 ? (
											<p className="py-8 text-center text-muted-foreground text-sm">
												No actual spending data found for this budget period.
											</p>
										) : (
											<>
												{/* Recharts bar chart */}
												<div>
													<p className="mb-3 font-medium text-sm">
														Budget vs. Actual
													</p>
													<ResponsiveContainer width="100%" height={220}>
														<BarChart
															data={chartData}
															margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
														>
															<CartesianGrid
																strokeDasharray="3 3"
																stroke="#e2e8f0"
															/>
															<XAxis
																dataKey="category"
																tick={{ fontSize: 10 }}
																tickLine={false}
															/>
															<YAxis
																tick={{ fontSize: 10 }}
																tickLine={false}
																axisLine={false}
																tickFormatter={(v: number) =>
																	`$${(v / 1000).toFixed(0)}k`
																}
															/>
															<Tooltip
																formatter={(
																	value: number | undefined,
																	name: string | undefined,
																) => [formatGYD(value ?? 0), name ?? ""]}
																contentStyle={{
																	fontSize: 12,
																	borderRadius: 6,
																}}
															/>
															<Legend wrapperStyle={{ fontSize: 12 }} />
															<Bar
																dataKey="Budgeted"
																fill="#3b82f6"
																radius={[3, 3, 0, 0]}
															/>
															<Bar
																dataKey="Actual"
																fill="#f97316"
																radius={[3, 3, 0, 0]}
															/>
														</BarChart>
													</ResponsiveContainer>
												</div>

												{/* Variance table */}
												<div>
													<p className="mb-3 font-medium text-sm">
														Variance Analysis
													</p>
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead className="text-xs">
																	Category
																</TableHead>
																<TableHead className="text-right text-xs">
																	Budgeted
																</TableHead>
																<TableHead className="text-right text-xs">
																	Actual
																</TableHead>
																<TableHead className="text-right text-xs">
																	Variance
																</TableHead>
																<TableHead className="text-right text-xs">
																	% Used
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{budgetVsActual.map((row, i) => {
																const variance = Number(row.variance);
																const pct = Number(row.percentUsed);
																return (
																	<TableRow key={i}>
																		<TableCell className="font-medium text-sm">
																			{row.category}
																		</TableCell>
																		<TableCell className="text-right font-mono text-xs">
																			{formatGYD(Number(row.budgeted))}
																		</TableCell>
																		<TableCell className="text-right font-mono text-xs">
																			{formatGYD(Number(row.actual))}
																		</TableCell>
																		<TableCell
																			className={`text-right font-mono text-xs ${variance < 0 ? "text-destructive" : "text-emerald-600"}`}
																		>
																			{variance >= 0 ? "+" : ""}
																			{formatGYD(variance)}
																		</TableCell>
																		<TableCell className="text-right text-xs">
																			<span
																				className={
																					pct > 100
																						? "font-bold text-destructive"
																						: pct > 75
																							? "font-medium text-amber-600"
																							: "text-emerald-600"
																				}
																			>
																				{Math.round(pct)}%
																			</span>
																		</TableCell>
																	</TableRow>
																);
															})}
														</TableBody>
													</Table>
												</div>
											</>
										)}
									</CardContent>
								)}
							</Card>
						);
					})}
				</div>
			)}

			{/* Current Month Budget vs Actual Chart */}
			{monthlyBudgetData && monthlyBudgetData.rows.length > 0 && (
				<Card>
					<CardContent className="p-4">
						<div className="mb-3 flex items-center justify-between">
							<div>
								<h3 className="font-semibold">
									Budget vs Actual — {monthlyBudgetData.month}
								</h3>
								<p className="text-xs text-muted-foreground">
									Current month spending vs budget
								</p>
							</div>
							<div className="text-right text-xs">
								<span
									className={
										Number(monthlyBudgetData.totalVariance) >= 0
											? "text-green-600"
											: "text-destructive"
									}
								>
									{Number(monthlyBudgetData.totalVariance) >= 0
										? "Under budget"
										: "Over budget"}{" "}
									by{" "}
									{new Intl.NumberFormat("en-GY", {
										style: "currency",
										currency: "GYD",
									}).format(
										Math.abs(Number(monthlyBudgetData.totalVariance)),
									)}
								</span>
							</div>
						</div>
						<ResponsiveContainer
							width="100%"
							height={Math.max(200, monthlyBudgetData.rows.length * 44)}
						>
							<BarChart
								layout="vertical"
								data={monthlyBudgetData.rows.map((r) => ({
									category: r.category,
									budgeted: Number(r.budgeted),
									actual: Number(r.actual),
								}))}
								margin={{ left: 120, right: 20, top: 4, bottom: 4 }}
							>
								<CartesianGrid strokeDasharray="3 3" horizontal={false} />
								<XAxis
									type="number"
									tickFormatter={(v: number) =>
										`$${(v / 1000).toFixed(0)}k`
									}
									tick={{ fontSize: 10 }}
								/>
								<YAxis
									type="category"
									dataKey="category"
									tick={{ fontSize: 11 }}
									width={115}
								/>
								<Tooltip
									formatter={(value: number) =>
										new Intl.NumberFormat("en-GY", {
											style: "currency",
											currency: "GYD",
										}).format(value)
									}
								/>
								<Legend />
								<Bar
									dataKey="budgeted"
									name="Budget"
									fill="#0f766e"
									radius={[0, 3, 3, 0]}
								/>
								<Bar
									dataKey="actual"
									name="Actual"
									fill="#22c55e"
									radius={[0, 3, 3, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{/* Create / Edit Dialog */}
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDialogOpen(false);
						setEditingId(null);
					}
				}}
			>
				<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Budget" : "New Budget"}
						</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col gap-4 py-2">
						{/* Name + Period */}
						<div className="grid grid-cols-2 gap-3">
							<div className="col-span-2 flex flex-col gap-1.5">
								<Label>Budget Name *</Label>
								<Input
									placeholder="e.g. March 2026 Budget"
									value={form.name}
									onChange={(e) =>
										setForm((f) => ({ ...f, name: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Period</Label>
								<Select
									value={form.period}
									onValueChange={(v) =>
										setForm((f) => ({
											...f,
											period: v as "monthly" | "quarterly" | "annually",
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="monthly">Monthly</SelectItem>
										<SelectItem value="quarterly">Quarterly</SelectItem>
										<SelectItem value="annually">Annually</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">{/* spacer */}</div>
							<div className="flex flex-col gap-1.5">
								<Label>Start Date</Label>
								<Input
									type="date"
									value={form.startDate}
									onChange={(e) =>
										setForm((f) => ({ ...f, startDate: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>End Date</Label>
								<Input
									type="date"
									value={form.endDate}
									onChange={(e) =>
										setForm((f) => ({ ...f, endDate: e.target.value }))
									}
								/>
							</div>
						</div>

						{/* Quick-add chips */}
						<div className="flex flex-col gap-2">
							<Label className="text-muted-foreground text-xs">
								Quick-add categories:
							</Label>
							<div className="flex flex-wrap gap-1.5">
								{QUICK_CATEGORIES.map((name) => {
									const already = form.categories.some(
										(c) => c.category === name,
									);
									return (
										<button
											key={name}
											type="button"
											onClick={() => addQuickCategory(name)}
											disabled={already}
											className={`rounded-full border px-3 py-0.5 text-xs transition-colors ${
												already
													? "cursor-default border-border bg-muted text-muted-foreground"
													: "cursor-pointer border-border bg-background hover:bg-muted"
											}`}
										>
											{already ? (
												<span className="flex items-center gap-1">
													<span>{name}</span>
													<span className="opacity-50">✓</span>
												</span>
											) : (
												<span className="flex items-center gap-1">
													<Plus className="size-3" />
													{name}
												</span>
											)}
										</button>
									);
								})}
							</div>
						</div>

						{/* Category rows */}
						<div className="flex flex-col gap-2">
							<Label>Budget Categories</Label>
							<div className="flex flex-col gap-2 rounded-md border p-3">
								{form.categories.map((cat, i) => (
									<div key={i} className="flex items-center gap-2">
										<Input
											className="h-8 flex-1 text-xs"
											placeholder="Category name"
											value={cat.category}
											onChange={(e) =>
												updateCategory(i, "category", e.target.value)
											}
										/>
										<div className="flex items-center gap-1">
											<span className="whitespace-nowrap text-muted-foreground text-xs">
												GYD
											</span>
											<Input
												className="h-8 w-28 text-xs"
												type="number"
												min={0}
												step={100}
												placeholder="Amount"
												value={Number(cat.budgeted) || ""}
												onChange={(e) =>
													updateCategory(i, "budgeted", e.target.value)
												}
											/>
										</div>
										<div className="flex items-center gap-1">
											<span className="whitespace-nowrap text-muted-foreground text-xs">
												Alert
											</span>
											<Input
												className="h-8 w-16 text-xs"
												type="number"
												min={1}
												max={100}
												placeholder="80"
												value={cat.alertThreshold || ""}
												onChange={(e) =>
													updateCategory(
														i,
														"alertThreshold",
														Number(e.target.value),
													)
												}
											/>
											<span className="text-muted-foreground text-xs">%</span>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="size-7 shrink-0"
											onClick={() => removeCategory(i)}
										>
											<X className="size-3" />
										</Button>
									</div>
								))}
								<Button
									variant="outline"
									size="sm"
									className="mt-1 gap-1 self-start"
									onClick={addCategory}
								>
									<Plus className="size-3" />
									Add Category
								</Button>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={
								!form.name ||
								form.categories.filter((c) => c.category.trim()).length === 0 ||
								createMut.isPending ||
								updateMut.isPending
							}
						>
							{createMut.isPending || updateMut.isPending
								? "Saving..."
								: editingId
									? "Update"
									: "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete budget?</AlertDialogTitle>
						<AlertDialogDescription>
							{`This will permanently delete "${deleteTarget?.name ?? "this budget"}". This action cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								if (!deleteTarget) return;
								deleteMut.mutate({ id: deleteTarget.id });
								setDeleteTarget(null);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
