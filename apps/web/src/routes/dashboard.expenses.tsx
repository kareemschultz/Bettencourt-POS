import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Download,
	Pencil,
	Plus,
	Printer,
	ReceiptText,
	Settings2,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
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
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { downloadCsv } from "@/lib/csv-export";
import { formatGYD } from "@/lib/types";
import { escapeHtml, todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function downloadPdf(title: string, rows: ExpenseRow[], period: string) {
	if (!rows.length) return;
	const fmt = (n: number) =>
		new Intl.NumberFormat("en-GY", {
			style: "currency",
			currency: "GYD",
		}).format(n);
	const total = rows.reduce((s, e) => s + Number(e.amount), 0);
	const tableRows = rows
		.map(
			(e) => `<tr>
			<td>${new Date(e.created_at).toLocaleString("en-GY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</td>
			<td>${escapeHtml(e.supplier_name) || "—"}</td>
			<td>${escapeHtml(e.category)}</td>
			<td>${escapeHtml(e.description)}</td>
			<td>${escapeHtml(e.payment_method) || "—"}</td>
			<td>${escapeHtml(e.reference_number) || "—"}</td>
			<td style="text-align:right;font-weight:600">${fmt(Number(e.amount))}</td>
			<td>${escapeHtml(e.authorized_by_name) || "—"}</td>
		</tr>`,
		)
		.join("\n");
	const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p  { margin: 0 0 16px; color: #555; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; border-bottom: 2px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .total { font-weight: bold; font-size: 13px; text-align: right; margin-top: 12px; }
  @media print { button { display: none; } }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>Period: ${escapeHtml(period)} &nbsp;·&nbsp; ${rows.length} entries</p>
<table>
<thead><tr>
  <th>Date</th><th>Supplier</th><th>Category</th><th>Description</th>
  <th>Payment</th><th>Ref #</th><th style="text-align:right">Amount</th><th>Auth. By</th>
</tr></thead>
<tbody>${tableRows}</tbody>
</table>
<p class="total">Total: ${fmt(total)}</p>
<button onclick="window.print()" style="margin-top:16px;padding:8px 16px;cursor:pointer">Print / Save as PDF</button>
</body></html>`;
	const w = window.open("", "_blank");
	if (w) {
		w.document.write(html);
		w.document.close();
	}
}

const SUPPLIER_COLORS = [
	"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
	"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
	"bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
	"bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
	"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
	"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
];

const PAYMENT_METHODS = [
	"Cash",
	"Card",
	"Bank Transfer",
	"Cheque",
	"Other",
] as const;

const emptyForm = {
	amount: "",
	category: "",
	description: "",
	supplierId: "",
	paymentMethod: "",
	referenceNumber: "",
	notes: "",
};

type ExpenseRow = {
	id: string;
	amount: string;
	category: string;
	description: string;
	created_at: string;
	authorized_by_name: string | null;
	created_by_name: string | null;
	supplier_name: string | null;
	supplier_id: string | null;
	payment_method: string | null;
	reference_number: string | null;
	notes: string | null;
	receipt_photo_url: string | null;
};

export default function ExpensesPage() {
	const { data: session } = authClient.useSession();
	const today = todayGY();
	const queryClient = useQueryClient();
	const { data: userProfile } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);
	const orgId = userProfile?.organizationId;

	function datePreset(preset: "today" | "week" | "month" | "lastmonth") {
		const now = new Date(
			new Date().toLocaleString("en-US", { timeZone: "America/Guyana" }),
		);
		const pad = (n: number) => String(n).padStart(2, "0");
		const fmt = (d: Date) =>
			`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		if (preset === "today") {
			setStartDate(today);
			setEndDate(today);
		} else if (preset === "week") {
			const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0
			const mon = new Date(now);
			mon.setDate(now.getDate() - dow);
			setStartDate(fmt(mon));
			setEndDate(today);
		} else if (preset === "month") {
			setStartDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
			setEndDate(today);
		} else {
			const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const lme = new Date(now.getFullYear(), now.getMonth(), 0);
			setStartDate(fmt(lm));
			setEndDate(fmt(lme));
		}
	}

	const [startDate, setStartDate] = useState(today);
	const [endDate, setEndDate] = useState(today);
	const [supplierFilter, setSupplierFilter] = useState("all");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState(emptyForm);
	const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [viewingExpense, setViewingExpense] = useState<ExpenseRow | null>(null);
	const [categoryFilter, setCategoryFilter] = useState("all");

	const { data: expensesRaw = [] } = useQuery(
		orpc.cash.getExpenses.queryOptions({
			input: {
				organizationId: orgId ?? "",
				startDate,
				endDate: `${endDate}T23:59:59`,
			},
			enabled: !!orgId,
		}),
	);
	const expenses = expensesRaw as ExpenseRow[];

	const { data: reportData } = useQuery(
		orpc.cash.getExpenseReport.queryOptions({
			input: {
				organizationId: orgId ?? "",
				startDate,
				endDate: `${endDate}T23:59:59`,
			},
			enabled: !!orgId,
		}),
	);

	const { data: suppliers = [] } = useQuery(
		orpc.settings.getSuppliers.queryOptions({ input: {} }),
	);

	const { data: categories = [] } = useQuery(
		orpc.cash.getExpenseCategories.queryOptions(),
	);

	const { data: categoryByMonth } = useQuery(
		orpc.cash.getExpenseCategoryByMonth.queryOptions({ input: {} }),
	);

	function invalidateExpenses() {
		if (!orgId) return;
		queryClient.invalidateQueries({
			queryKey: orpc.cash.getExpenses.queryOptions({
				input: { organizationId: orgId },
			}).queryKey,
		});
		queryClient.invalidateQueries({
			queryKey: orpc.cash.getExpenseReport.queryOptions({
				input: { organizationId: orgId },
			}).queryKey,
		});
	}

	const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
	const [deleteCategoryItem, setDeleteCategoryItem] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const createExpense = useMutation(
		orpc.cash.createExpense.mutationOptions({
			onSuccess: () => {
				invalidateExpenses();
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Expense recorded");
			},
			onError: (err) => toast.error(err.message || "Failed to save expense"),
		}),
	);

	const updateExpense = useMutation(
		orpc.cash.updateExpense.mutationOptions({
			onSuccess: () => {
				invalidateExpenses();
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Expense updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update expense"),
		}),
	);

	const deleteExpense = useMutation(
		orpc.cash.deleteExpense.mutationOptions({
			onSuccess: () => {
				invalidateExpenses();
				toast.success("Expense deleted");
			},
			onError: (err) => toast.error(err.message || "Failed to delete expense"),
		}),
	);

	const createCategoryMut = useMutation(
		orpc.cash.createExpenseCategory.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.cash.getExpenseCategories.queryOptions().queryKey,
				});
				setNewCategoryName("");
				toast.success("Category added");
			},
			onError: (err) => toast.error(err.message || "Failed to add category"),
		}),
	);

	const deleteCategoryMut = useMutation(
		orpc.cash.deleteExpenseCategory.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.cash.getExpenseCategories.queryOptions().queryKey,
				});
				toast.success("Category deleted");
			},
			onError: (err) => toast.error(err.message || "Failed to delete category"),
		}),
	);

	// Build stable supplier → color map
	const supplierColorMap = new Map<string, string>();
	suppliers.forEach((s, i) => {
		supplierColorMap.set(s.id, SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]!);
	});

	// Map supplier name → id for clickable stat cards
	const supplierNameToIdMap = new Map(suppliers.map((s) => [s.name, s.id]));

	const filtered = expenses
		.filter((e) => supplierFilter === "all" || e.supplier_id === supplierFilter)
		.filter((e) => categoryFilter === "all" || e.category === categoryFilter);

	// Category breakdown (client-side from loaded expenses)
	const categoryBreakdown = Object.entries(
		expenses.reduce<Record<string, number>>((acc, e) => {
			acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
			return acc;
		}, {}),
	)
		.map(([name, total]) => ({ name, total }))
		.sort((a, b) => b.total - a.total);

	const totalToday = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

	// Pivot category-by-month data for stacked bar chart
	const CHART_CATEGORIES = [
		"Food Cost",
		"Beverages",
		"Utilities",
		"Supplies",
		"Maintenance",
		"Labor",
		"Marketing",
		"Vehicle Maintenance",
	];
	const CHART_COLORS = [
		"var(--chart-1)",
		"var(--chart-2)",
		"var(--chart-3)",
		"var(--chart-4)",
		"var(--chart-5)",
		"hsl(271 91% 65%)",
		"hsl(32 95% 55%)",
		"hsl(160 60% 45%)",
	];
	const chartData = (categoryByMonth?.months ?? []).map(({ month, label }) => {
		const row: Record<string, string | number> = { month, label };
		for (const cat of CHART_CATEGORIES) {
			const found = categoryByMonth?.rows.find(
				(r) => r.month === month && r.category === cat,
			);
			row[cat] = found ? Number(found.total) : 0;
		}
		return row;
	});
	const activeChartCategories = CHART_CATEGORIES.filter((cat) =>
		chartData.some((d) => (d[cat] as number) > 0),
	);

	function openAdd() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(e: ExpenseRow) {
		setEditingId(e.id);
		setForm({
			amount: e.amount,
			category: e.category,
			description: e.description,
			supplierId: e.supplier_id ?? "",
			paymentMethod: e.payment_method ?? "",
			referenceNumber: e.reference_number ?? "",
			notes: e.notes ?? "",
		});
		setDialogOpen(true);
	}

	function handleSubmit() {
		if (!orgId) {
			toast.error("Organization context is missing");
			return;
		}
		if (!form.amount || !form.category || !form.description) {
			toast.error("Amount, category, and description are required");
			return;
		}
		if (editingId) {
			updateExpense.mutate({
				expenseId: editingId,
				amount: form.amount,
				category: form.category,
				description: form.description,
				supplierId: form.supplierId || null,
				paymentMethod: form.paymentMethod || null,
				referenceNumber: form.referenceNumber || null,
				notes: form.notes || null,
			});
		} else {
			createExpense.mutate({
				amount: form.amount,
				category: form.category,
				description: form.description,
				supplierId: form.supplierId || null,
				paymentMethod: form.paymentMethod || null,
				referenceNumber: form.referenceNumber || null,
				notes: form.notes || null,
				organizationId: orgId,
			});
		}
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground tracking-tight">
						Expenses
					</h1>
					<p className="text-muted-foreground text-sm">
						Daily expense tracking by supplier
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() => setManageCategoriesOpen(true)}
					>
						<Settings2 className="size-4" />
						Categories
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() =>
							downloadCsv(
								`expenses-${new Date().toISOString().slice(0, 10)}.csv`,
								filtered.map((e) => ({
									Date: new Date(e.created_at).toLocaleDateString("en-GY"),
									Category: e.category,
									Description: e.description ?? "",
									Amount: e.amount,
									Supplier: e.supplier_name ?? "",
									"Payment Method": e.payment_method ?? "",
									"Ref #": e.reference_number ?? "",
									Notes: e.notes ?? "",
									"Recorded By": e.created_by_name ?? "",
									"Authorized By": e.authorized_by_name ?? "",
								})),
							)
						}
					>
						<Download className="size-4" />
						Export
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() =>
							downloadPdf(
								"Expense Report",
								filtered,
								`${startDate} – ${endDate}`,
							)
						}
					>
						<Printer className="size-4" />
						Print PDF
					</Button>
					<Button onClick={openAdd} className="gap-2">
						<Plus className="size-4" />
						Add Expense
					</Button>
				</div>
			</div>

			{/* Filters */}
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
				<div className="flex flex-col gap-1">
					<Label className="text-muted-foreground text-xs">Quick range</Label>
					<div className="flex gap-1">
						{(["today", "week", "month", "lastmonth"] as const).map((p) => (
							<Button
								key={p}
								size="sm"
								variant="outline"
								className="h-8 px-2 text-xs"
								onClick={() => datePreset(p)}
							>
								{
									{
										today: "Today",
										week: "This Week",
										month: "This Month",
										lastmonth: "Last Month",
									}[p]
								}
							</Button>
						))}
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<Label className="text-muted-foreground text-xs">Supplier</Label>
					<Select value={supplierFilter} onValueChange={setSupplierFilter}>
						<SelectTrigger className="h-8 w-44 text-sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All suppliers</SelectItem>
							{suppliers.map((s) => (
								<SelectItem key={s.id} value={s.id}>
									{s.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-1">
					<Label className="text-muted-foreground text-xs">Category</Label>
					<Select value={categoryFilter} onValueChange={setCategoryFilter}>
						<SelectTrigger className="h-8 w-44 text-sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All categories</SelectItem>
							{categories.map((c) => (
								<SelectItem key={c.id} value={c.name}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Summary cards — click to filter the detail table below */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Card
					className={`cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5 ${supplierFilter === "all" ? "ring-2 ring-primary" : ""}`}
					onClick={() => setSupplierFilter("all")}
				>
					<CardContent className="flex flex-col gap-1 p-4">
						<p className="text-muted-foreground text-xs">All Expenses</p>
						<p className="font-bold text-foreground text-xl">
							{formatGYD(Number(reportData?.grandTotal ?? 0))}
						</p>
						<p className="text-muted-foreground text-xs">
							{expenses.length} entries
						</p>
					</CardContent>
				</Card>
				{(
					(reportData?.bySupplier as Array<{
						supplier_name: string;
						total: string;
						count: number;
					}>) ?? []
				)
					.slice(0, 3)
					.map((row, i) => {
						const supplierId = supplierNameToIdMap.get(row.supplier_name);
						const isActive = !!supplierId && supplierFilter === supplierId;
						return (
							<Card
								key={i}
								className={`cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5 ${isActive ? "ring-2 ring-primary" : ""}`}
								onClick={() => {
									if (supplierId) setSupplierFilter(supplierId);
								}}
							>
								<CardContent className="flex flex-col gap-1 p-4">
									<p className="text-muted-foreground text-xs">
										{row.supplier_name}
									</p>
									<p className="font-bold text-foreground text-lg">
										{formatGYD(Number(row.total))}
									</p>
									<p className="text-muted-foreground text-xs">
										{row.count} expenses — click to view
									</p>
								</CardContent>
							</Card>
						);
					})}
			</div>

			{/* Category Breakdown */}
			{categoryBreakdown.length > 0 && (
				<div>
					<div className="mb-2 flex items-baseline gap-2">
						<p className="font-medium text-foreground text-sm">
							Spending by Category
						</p>
						<span className="text-muted-foreground text-xs">
							for selected period — click to filter table
						</span>
					</div>
					<div className="flex flex-wrap gap-2">
						{categoryBreakdown.map((cat) => (
							<button
								key={cat.name}
								type="button"
								onClick={() =>
									setCategoryFilter(
										categoryFilter === cat.name ? "all" : cat.name,
									)
								}
								className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 ${categoryFilter === cat.name ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}
							>
								<span className="font-medium text-foreground">
									{formatGYD(cat.total)}
								</span>
								<span className="text-muted-foreground text-xs">
									{cat.name}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Category by Month Chart */}
			{activeChartCategories.length > 0 && (
				<div className="rounded-lg border border-border p-4">
					<div className="mb-4 flex items-baseline gap-2">
						<p className="font-medium text-foreground text-sm">
							Spending by Category — Last 12 Months
						</p>
						<span className="text-muted-foreground text-xs">
							(full-year view — independent of date filter above)
						</span>
					</div>
					<ResponsiveContainer width="100%" height={280}>
						<BarChart
							data={chartData}
							margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
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
								) => [
									new Intl.NumberFormat("en-GY", {
										style: "currency",
										currency: "GYD",
										maximumFractionDigits: 0,
									}).format(value ?? 0),
									name ?? "",
								]}
								contentStyle={{
									fontSize: 12,
									borderRadius: 8,
									border: "1px solid hsl(var(--border))",
									background: "hsl(var(--card))",
									color: "hsl(var(--foreground))",
								}}
							/>
							<Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
							{activeChartCategories.map((cat, i) => (
								<Bar
									key={cat}
									dataKey={cat}
									stackId="a"
									fill={CHART_COLORS[i % CHART_COLORS.length]}
									radius={
										i === activeChartCategories.length - 1
											? [4, 4, 0, 0]
											: [0, 0, 0, 0]
									}
								/>
							))}
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}

			{/* Table */}
			<div className="rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="text-xs">Date</TableHead>
							<TableHead className="text-xs">Supplier</TableHead>
							<TableHead className="text-xs">Category</TableHead>
							<TableHead className="text-xs">Description</TableHead>
							<TableHead className="text-right text-xs">Amount</TableHead>
							<TableHead className="text-xs">Authorized By</TableHead>
							<TableHead className="w-20 text-xs" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{filtered.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="py-10 text-center text-muted-foreground text-sm"
								>
									<ReceiptText className="mx-auto mb-2 size-8 opacity-30" />
									No expenses recorded
								</TableCell>
							</TableRow>
						) : (
							filtered.map((e) => {
								const color = e.supplier_id
									? supplierColorMap.get(e.supplier_id)
									: undefined;
								return (
									<TableRow
										key={e.id}
										className={`cursor-pointer transition-colors hover:bg-muted/60 ${color ? `${color.split(" ")[0]}/5` : ""}`}
										onClick={() => setViewingExpense(e)}
									>
										<TableCell className="whitespace-nowrap text-muted-foreground text-xs">
											{new Date(e.created_at).toLocaleString("en-GY", {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
												hour12: false,
											})}
										</TableCell>
										<TableCell>
											{e.supplier_id ? (
												<Link
													to={`/dashboard/suppliers/${e.supplier_id}`}
													onClick={(ev) => ev.stopPropagation()}
												>
													<Badge
														variant="secondary"
														className={`text-xs hover:opacity-80 ${color ?? ""}`}
													>
														{e.supplier_name}
													</Badge>
												</Link>
											) : e.supplier_name ? (
												<Badge
													variant="secondary"
													className={`text-xs ${color ?? ""}`}
												>
													{e.supplier_name}
												</Badge>
											) : (
												<span className="text-muted-foreground text-xs">—</span>
											)}
										</TableCell>
										<TableCell className="text-xs">{e.category}</TableCell>
										<TableCell className="max-w-48 truncate text-xs">
											{e.description}
										</TableCell>
										<TableCell className="text-right font-semibold text-sm">
											{formatGYD(Number(e.amount))}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{e.authorized_by_name ?? "—"}
										</TableCell>
										<TableCell>
											<div className="flex items-center justify-end gap-1">
												<Button
													size="icon"
													variant="ghost"
													className="size-7"
													onClick={(ev) => {
														ev.stopPropagation();
														openEdit(e);
													}}
												>
													<Pencil className="size-3.5" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="size-7 text-destructive hover:text-destructive"
													disabled={deleteExpense.isPending}
													onClick={(ev) => {
														ev.stopPropagation();
														setDeleteExpenseId(e.id);
													}}
												>
													<Trash2 className="size-3.5" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
				{filtered.length > 0 && (
					<div className="flex items-center justify-between border-border border-t px-4 py-3 text-sm">
						<span className="text-muted-foreground">
							{filtered.length} expense{filtered.length !== 1 ? "s" : ""}
							{(supplierFilter !== "all" || categoryFilter !== "all") && (
								<span className="ml-1 text-xs">(filtered)</span>
							)}
						</span>
						<span className="font-semibold">
							Total: {formatGYD(totalToday)}
						</span>
					</div>
				)}
			</div>

			{/* Add / Edit Expense Dialog */}
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setEditingId(null);
						setForm(emptyForm);
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Expense" : "Record Expense"}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="flex flex-col gap-1.5">
							<Label>Amount (GYD)</Label>
							<Input
								type="number"
								inputMode="decimal"
								placeholder="0.00"
								value={form.amount}
								onChange={(e) =>
									setForm((f) => ({ ...f, amount: e.target.value }))
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Supplier</Label>
							<Select
								value={form.supplierId || "none"}
								onValueChange={(v) =>
									setForm((f) => ({ ...f, supplierId: v === "none" ? "" : v }))
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select supplier (optional)" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">No supplier</SelectItem>
									{suppliers.map((s) => (
										<SelectItem key={s.id} value={s.id}>
											{s.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Category</Label>
							<Select
								value={form.category}
								onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select category" />
								</SelectTrigger>
								<SelectContent>
									{categories.map((c) => (
										<SelectItem key={c.id} value={c.name}>
											{c.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Description</Label>
							<Input
								placeholder="What was this expense for?"
								value={form.description}
								onChange={(e) =>
									setForm((f) => ({ ...f, description: e.target.value }))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1.5">
								<Label>Payment Method</Label>
								<Select
									value={form.paymentMethod || "none"}
									onValueChange={(v) =>
										setForm((f) => ({
											...f,
											paymentMethod: v === "none" ? "" : v,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select method" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Not specified</SelectItem>
										{PAYMENT_METHODS.map((m) => (
											<SelectItem key={m} value={m}>
												{m}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Receipt / Ref #</Label>
								<Input
									placeholder="Invoice or receipt #"
									value={form.referenceNumber}
									onChange={(e) =>
										setForm((f) => ({ ...f, referenceNumber: e.target.value }))
									}
								/>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>
								Notes{" "}
								<span className="text-muted-foreground text-xs">
									(optional)
								</span>
							</Label>
							<Input
								placeholder="e.g. receipt in green folder, approved verbally"
								value={form.notes}
								onChange={(e) =>
									setForm((f) => ({ ...f, notes: e.target.value }))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={createExpense.isPending || updateExpense.isPending}
						>
							{editingId
								? updateExpense.isPending
									? "Saving..."
									: "Save Changes"
								: createExpense.isPending
									? "Saving..."
									: "Save Expense"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{/* View Expense Dialog */}
			<Dialog
				open={!!viewingExpense}
				onOpenChange={(open) => {
					if (!open) setViewingExpense(null);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Expense Details</DialogTitle>
					</DialogHeader>
					{viewingExpense && (
						<div className="flex flex-col gap-4 py-2">
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Date & Time</p>
									<p className="font-medium text-sm">
										{new Date(viewingExpense.created_at).toLocaleString(
											"en-GY",
											{
												weekday: "short",
												month: "short",
												day: "numeric",
												year: "numeric",
												hour: "2-digit",
												minute: "2-digit",
												hour12: false,
											},
										)}
									</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Amount</p>
									<p className="font-bold text-foreground text-lg">
										{formatGYD(Number(viewingExpense.amount))}
									</p>
								</div>
							</div>
							<div className="h-px bg-border" />
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Category</p>
									<p className="text-sm">{viewingExpense.category}</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Supplier</p>
									<p className="text-sm">
										{viewingExpense.supplier_name ?? "—"}
									</p>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">
										Payment Method
									</p>
									<p className="text-sm">
										{viewingExpense.payment_method ?? "—"}
									</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">
										Receipt / Ref #
									</p>
									<p className="text-sm">
										{viewingExpense.reference_number ?? "—"}
									</p>
								</div>
							</div>
							<div className="flex flex-col gap-1">
								<p className="text-muted-foreground text-xs">Description</p>
								<p className="text-sm">{viewingExpense.description}</p>
							</div>
							{viewingExpense.notes && (
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Notes</p>
									<p className="text-sm">{viewingExpense.notes}</p>
								</div>
							)}
							<div className="h-px bg-border" />
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Recorded By</p>
									<p className="text-sm">
										{viewingExpense.created_by_name ?? "—"}
									</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Authorized By</p>
									<p className="text-sm">
										{viewingExpense.authorized_by_name ?? "—"}
									</p>
								</div>
							</div>
						</div>
					)}
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setViewingExpense(null)}>
							Close
						</Button>
						<Button
							onClick={() => {
								if (viewingExpense) {
									setViewingExpense(null);
									openEdit(viewingExpense);
								}
							}}
						>
							<Pencil className="size-4" />
							Edit
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Manage Categories Dialog */}
			<Dialog
				open={manageCategoriesOpen}
				onOpenChange={setManageCategoriesOpen}
			>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Manage Expense Categories</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="flex gap-2">
							<Input
								placeholder="New category name"
								value={newCategoryName}
								onChange={(e) => setNewCategoryName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && newCategoryName.trim()) {
										createCategoryMut.mutate({
											name: newCategoryName.trim(),
										});
									}
								}}
							/>
							<Button
								onClick={() => {
									if (!newCategoryName.trim()) return;
									createCategoryMut.mutate({
										name: newCategoryName.trim(),
									});
								}}
								disabled={
									!newCategoryName.trim() || createCategoryMut.isPending
								}
							>
								<Plus className="size-4" />
								Add
							</Button>
						</div>
						<div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
							{categories.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-sm">
									No categories yet
								</p>
							) : (
								categories.map((c) => (
									<div
										key={c.id}
										className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted"
									>
										<span className="text-sm">{c.name}</span>
										<Button
											size="icon"
											variant="ghost"
											className="size-7 text-destructive hover:text-destructive"
											disabled={deleteCategoryMut.isPending}
											onClick={() => {
												setDeleteCategoryItem({ id: c.id, name: c.name });
											}}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								))
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Expense Confirmation */}
			<AlertDialog
				open={!!deleteExpenseId}
				onOpenChange={(o) => {
					if (!o) setDeleteExpenseId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this expense?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								deleteExpenseId &&
								deleteExpense.mutate({ expenseId: deleteExpenseId })
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Delete Category Confirmation */}
			<AlertDialog
				open={!!deleteCategoryItem}
				onOpenChange={(o) => {
					if (!o) setDeleteCategoryItem(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete "{deleteCategoryItem?.name}"?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This expense category will be permanently removed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								deleteCategoryItem &&
								deleteCategoryMut.mutate({ id: deleteCategoryItem.id })
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
