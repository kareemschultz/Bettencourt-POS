import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Download,
	Pencil,
	Plus,
	ReceiptText,
	Settings2,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
	if (!rows.length) return;
	const headers = Object.keys(rows[0]);
	const csv = [
		headers.join(","),
		...rows.map((r) =>
			headers
				.map((h) => {
					const v = String(r[h] ?? "");
					return v.includes(",") || v.includes('"')
						? `"${v.replace(/"/g, '""')}"`
						: v;
				})
				.join(","),
		),
	].join("\n");
	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

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

const emptyForm = {
	amount: "",
	category: "",
	description: "",
	supplierId: "",
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
};

export default function ExpensesPage() {
	const { data: session } = authClient.useSession();
	const today = todayGY();
	const queryClient = useQueryClient();

	const [startDate, setStartDate] = useState(today);
	const [endDate, setEndDate] = useState(today);
	const [supplierFilter, setSupplierFilter] = useState("all");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState(emptyForm);
	const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [viewingExpense, setViewingExpense] = useState<ExpenseRow | null>(null);

	const { data: expensesRaw = [] } = useQuery(
		orpc.cash.getExpenses.queryOptions({
			input: {
				organizationId: DEFAULT_ORG_ID,
				startDate,
				endDate: `${endDate}T23:59:59`,
			},
		}),
	);
	const expenses = expensesRaw as ExpenseRow[];

	const { data: reportData } = useQuery(
		orpc.cash.getExpenseReport.queryOptions({
			input: {
				organizationId: DEFAULT_ORG_ID,
				startDate,
				endDate: `${endDate}T23:59:59`,
			},
		}),
	);

	const { data: suppliers = [] } = useQuery(
		orpc.settings.getSuppliers.queryOptions({ input: {} }),
	);

	const { data: categories = [] } = useQuery(
		orpc.cash.getExpenseCategories.queryOptions(),
	);

	function invalidateExpenses() {
		queryClient.invalidateQueries({
			queryKey: orpc.cash.getExpenses.queryOptions({
				input: { organizationId: DEFAULT_ORG_ID },
			}).queryKey,
		});
		queryClient.invalidateQueries({
			queryKey: orpc.cash.getExpenseReport.queryOptions({
				input: { organizationId: DEFAULT_ORG_ID },
			}).queryKey,
		});
	}

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

	const filtered =
		supplierFilter === "all"
			? expenses
			: expenses.filter((e) => e.supplier_id === supplierFilter);

	const totalToday = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

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
		});
		setDialogOpen(true);
	}

	function handleSubmit() {
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
			});
		} else {
			createExpense.mutate({
				amount: form.amount,
				category: form.category,
				description: form.description,
				supplierId: form.supplierId || null,
				authorizedBy: session?.user?.id || "",
				createdBy: session?.user?.id || "",
				organizationId: DEFAULT_ORG_ID,
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
								})),
							)
						}
					>
						<Download className="size-4" />
						Export
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
							{formatGYD(expenses.reduce((s, e) => s + Number(e.amount), 0))}
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
											{e.supplier_name ? (
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
														if (confirm("Delete this expense?")) {
															deleteExpense.mutate({ expenseId: e.id });
														}
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
							<div className="flex flex-col gap-1">
								<p className="text-muted-foreground text-xs">Description</p>
								<p className="text-sm">{viewingExpense.description}</p>
							</div>
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
												if (confirm(`Delete category "${c.name}"?`)) {
													deleteCategoryMut.mutate({ id: c.id });
												}
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
		</div>
	);
}
