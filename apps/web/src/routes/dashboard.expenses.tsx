import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Building2,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronsUpDown,
	Download,
	Layers,
	List,
	MoreHorizontal,
	Pencil,
	Plus,
	Printer,
	ReceiptText,
	Settings2,
	Trash2,
	Wallet,
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
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { downloadCsv } from "@/lib/csv-export";
import { printDailyExpenseSummary } from "@/lib/pdf/daily-expense-summary-pdf";
import { printExpenseReport } from "@/lib/pdf/expense-report-pdf";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type SourceGroup = {
	id: string;
	name: string;
	color: string;
	items: ExpenseRow[];
	total: number;
};


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
	fundingSourceId: "",
	department: "",
	receiptPhotoUrl: "",
	expenseDate: todayGY(), // defaults to today; user can back-date
};

type ExpenseRow = {
	id: string;
	amount: string;
	category: string;
	description: string;
	expense_date: string;   // the date the expense occurred (user-supplied)
	created_at: string;     // immutable audit: when the entry was entered
	authorized_by_name: string | null;
	created_by_name: string | null;
	supplier_name: string | null;
	supplier_id: string | null;
	payment_method: string | null;
	reference_number: string | null;
	notes: string | null;
	receipt_photo_url: string | null;
	funding_source_id: string | null;
};

export default function ExpensesPage() {
	const { data: session } = authClient.useSession();
	const today = todayGY();
	const queryClient = useQueryClient();

	// Sticky date: when on, the expense date stays locked after each submission
	// so bulk-entry sessions don't require changing the date on every record.
	const [stickyDate, setStickyDate] = useState(() => {
		try { return localStorage.getItem("expense_sticky_date") === "true"; } catch { return false; }
	});
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

	const [startDate, setStartDate] = useState(() => {
		const now = new Date(
			new Date().toLocaleString("en-US", { timeZone: "America/Guyana" }),
		);
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
	});
	const [endDate, setEndDate] = useState(today);
	const [supplierFilter, setSupplierFilter] = useState("all");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState(emptyForm);
	const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [viewingExpense, setViewingExpense] = useState<ExpenseRow | null>(null);
	const [categoryFilter, setCategoryFilter] = useState("all");
	

	// Funding source state
	const [fundingSourceFilter, setFundingSourceFilter] = useState("all");
	const [manageFundingSourcesOpen, setManageFundingSourcesOpen] =
		useState(false);
	const [newFundingSourceName, setNewFundingSourceName] = useState("");
	const [editingFundingSource, setEditingFundingSource] = useState<{
		id: string;
		name: string;
		isActive: boolean;
	} | null>(null);
	const [deleteFundingSourceItem, setDeleteFundingSourceItem] = useState<{
		id: string;
		name: string;
	} | null>(null);

	// Supplier manage state
	const [manageSuppliersOpen, setManageSuppliersOpen] = useState(false);
	const [newSupplierName, setNewSupplierName] = useState("");

	// Daily summary state
	const [viewMode, setViewMode] = useState<"table" | "daily">("table");
	const [summaryDate, setSummaryDate] = useState(today);
	const [groupBy, setGroupBy] = useState<"none" | "source" | "category" | "supplier">("none");

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

	const { data: fundingSources = [], isLoading: fundingSourcesLoading } =
		useQuery(orpc.cash.listFundingSources.queryOptions());

	const { data: dailySummary, isLoading: dailySummaryLoading } = useQuery(
		orpc.cash.getDailyExpenseSummary.queryOptions({
			input: { date: summaryDate },
			enabled: viewMode === "daily" && !!orgId,
		}),
	);

	// Previous month expense report (for period comparison badge)
	const prevMonthRange = (() => {
		const now = new Date(
			new Date().toLocaleString("en-US", { timeZone: "America/Guyana" }),
		);
		const pad = (n: number) => String(n).padStart(2, "0");
		const y = now.getFullYear();
		const m = now.getMonth(); // 0-indexed current month => prev month is m-1
		const prevFirst = new Date(y, m - 1, 1);
		const prevLast = new Date(y, m, 0);
		return {
			startDate: `${prevFirst.getFullYear()}-${pad(prevFirst.getMonth() + 1)}-01`,
			endDate: `${prevLast.getFullYear()}-${pad(prevLast.getMonth() + 1)}-${pad(prevLast.getDate())}T23:59:59`,
		};
	})();
	const { data: prevMonthReport } = useQuery(
		orpc.cash.getExpenseReport.queryOptions({
			input: {
				organizationId: orgId ?? "",
				startDate: prevMonthRange.startDate,
				endDate: prevMonthRange.endDate,
			},
			enabled: !!orgId,
		}),
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
	const [supplierSearch, setSupplierSearch] = useState("");
	const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
	const [deleteCategoryItem, setDeleteCategoryItem] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const createExpense = useMutation(
		orpc.cash.createExpense.mutationOptions({
			onSuccess: () => {
				invalidateExpenses();
				setDialogOpen(false);
				if (stickyDate) {
					// Persist the submitted date as the locked date for next entry
					try { localStorage.setItem("expense_locked_date", form.expenseDate); } catch {}
					setForm({ ...emptyForm, expenseDate: form.expenseDate });
				} else {
					setForm(emptyForm);
				}
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

	function invalidateFundingSources() {
		queryClient.invalidateQueries({
			queryKey: orpc.cash.listFundingSources.queryOptions().queryKey,
		});
	}

	const createFundingSourceMut = useMutation(
		orpc.cash.createFundingSource.mutationOptions({
			onSuccess: () => {
				invalidateFundingSources();
				setNewFundingSourceName("");
				toast.success("Funding source added");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to add funding source"),
		}),
	);

	const updateFundingSourceMut = useMutation(
		orpc.cash.updateFundingSource.mutationOptions({
			onSuccess: () => {
				invalidateFundingSources();
				setEditingFundingSource(null);
				toast.success("Funding source updated");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to update funding source"),
		}),
	);

	const deleteFundingSourceMut = useMutation(
		orpc.cash.deleteFundingSource.mutationOptions({
			onSuccess: () => {
				invalidateFundingSources();
				setDeleteFundingSourceItem(null);
				toast.success("Funding source deleted");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to delete funding source"),
		}),
	);

	function invalidateSuppliers() {
		queryClient.invalidateQueries({
			queryKey: orpc.settings.getSuppliers.queryOptions({ input: {} }).queryKey,
		});
	}

	const createSupplierMut = useMutation(
		orpc.settings.createSupplier.mutationOptions({
			onSuccess: () => {
				invalidateSuppliers();
				setNewSupplierName("");
				toast.success("Supplier added");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to add supplier"),
		}),
	);

	// Build stable supplier → color map
	const supplierColorMap = new Map<string, string>();
	suppliers.forEach((s, i) => {
		supplierColorMap.set(s.id, SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]!);
	});

	// Map supplier name → id for clickable stat cards
	const supplierNameToIdMap = new Map(suppliers.map((s) => [s.name, s.id]));

	// Funding source color palette (hex, matches Tailwind 500 shades)
	const SOURCE_COLORS_HEX = [
		"#14b8a6", // teal
		"#f59e0b", // amber
		"#a855f7", // purple
		"#f43f5e", // rose
		"#38bdf8", // sky
		"#6366f1", // indigo
		"#10b981", // emerald
		"#f97316", // orange
	];
	const fundingSourceColorMap = new Map<string, string>();
	fundingSources.forEach((fs, i) => {
		fundingSourceColorMap.set(fs.id, SOURCE_COLORS_HEX[i % SOURCE_COLORS_HEX.length]!);
	});
	const getSourceColor = (id: string | null | undefined): string =>
		id ? (fundingSourceColorMap.get(id) ?? "#64748b") : "#64748b";
	const getSourceName = (id: string | null | undefined): string =>
		id ? (fundingSources.find((f) => f.id === id)?.name ?? "Unknown") : "Unassigned";

	const filtered = expenses
		.filter((e) => supplierFilter === "all" || e.supplier_id === supplierFilter)
		.filter((e) => categoryFilter === "all" || e.category === categoryFilter)
		.filter(
			(e) =>
				fundingSourceFilter === "all" ||
				e.funding_source_id === fundingSourceFilter,
		);

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

	// Pre-group filtered expenses by funding source (for grouped view + KPI cards)
	const filteredBySourceMap = new Map<string | null, typeof filtered>();
	for (const e of filtered) {
		const key = e.funding_source_id ?? null;
		const arr = filteredBySourceMap.get(key) ?? [];
		arr.push(e);
		filteredBySourceMap.set(key, arr);
	}
	const expensesBySource = [
		...fundingSources
			.filter((fs) => filteredBySourceMap.has(fs.id))
			.map((fs) => ({
				id: fs.id,
				name: fs.name,
				color: fundingSourceColorMap.get(fs.id) ?? "#64748b",
				items: filteredBySourceMap.get(fs.id) ?? [],
				total: (filteredBySourceMap.get(fs.id) ?? []).reduce(
					(s, e) => s + Number(e.amount),
					0,
				),
			})),
		...(filteredBySourceMap.has(null)
			? [
					{
						id: "general",
						name: "General Cash",
						color: "#64748b",
						items: filteredBySourceMap.get(null) ?? [],
						total: (filteredBySourceMap.get(null) ?? []).reduce(
							(s, e) => s + Number(e.amount),
							0,
						),
					},
			  ]
			: []),
	];

	// Grouped by category
	const expensesByCategory = Object.entries(
		filtered.reduce<Record<string, typeof filtered>>((acc, e) => {
			(acc[e.category] ??= []).push(e);
			return acc;
		}, {}),
	)
		.sort(([, a], [, b]) => {
			const ta = a.reduce((s, e) => s + Number(e.amount), 0);
			const tb = b.reduce((s, e) => s + Number(e.amount), 0);
			return tb - ta;
		})
		.map(([name, items]) => ({
			id: name,
			name,
			color: "#64748b",
			items,
			total: items.reduce((s, e) => s + Number(e.amount), 0),
		}));

	// Grouped by supplier
	const expensesBySupplier = Object.entries(
		filtered.reduce<Record<string, typeof filtered>>((acc, e) => {
			const key = e.supplier_name ?? "(No supplier)";
			(acc[key] ??= []).push(e);
			return acc;
		}, {}),
	)
		.sort(([, a], [, b]) => {
			const ta = a.reduce((s, e) => s + Number(e.amount), 0);
			const tb = b.reduce((s, e) => s + Number(e.amount), 0);
			return tb - ta;
		})
		.map(([name, items]) => ({
			id: name,
			name,
			color: "#0ea5e9",
			items,
			total: items.reduce((s, e) => s + Number(e.amount), 0),
		}));

	// Active group list based on current groupBy selection
	const activeGroups =
		groupBy === "source" ? expensesBySource
		: groupBy === "category" ? expensesByCategory
		: groupBy === "supplier" ? expensesBySupplier
		: null;

	// Smart report title — used as PDF tab title (becomes Save-as filename)
	const pdfTitle = (() => {
		const d = new Date(startDate + "T12:00:00");
		const monthLabel = d.toLocaleString("en-GY", { month: "short", year: "numeric" });
		const groupLabel =
			groupBy === "source" ? " — By Source"
			: groupBy === "category" ? " — By Category"
			: groupBy === "supplier" ? " — By Supplier"
			: "";
		return `Expense Report${groupLabel} — ${monthLabel}`;
	})();

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
		if (stickyDate) {
			// Use the saved locked date; fall back to form's current date, then today
			const locked = (() => { try { return localStorage.getItem("expense_locked_date") || form.expenseDate; } catch { return form.expenseDate; } })();
			setForm({ ...emptyForm, expenseDate: locked || today });
		} else {
			setForm(emptyForm);
		}
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
			fundingSourceId: e.funding_source_id ?? "",
			department: "",
			receiptPhotoUrl: e.receipt_photo_url ?? "",
			expenseDate: e.expense_date ?? today,
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
				fundingSourceId: form.fundingSourceId || null,
				receiptPhotoUrl: form.receiptPhotoUrl || null,
				expenseDate: form.expenseDate || today,
			});
		} else {
			// Duplicate detection: warn if same amount + supplier on the same expense date
			const sameDay = expenses.filter((e) => {
				return (
					e.expense_date === (form.expenseDate || today) &&
					e.amount === form.amount &&
					e.supplier_id === (form.supplierId || null)
				);
			});
			if (sameDay.length > 0) {
				toast.warning("Similar expense already exists for that date — double-check before saving");
			}
			createExpense.mutate({
				amount: form.amount,
				category: form.category,
				description: form.description,
				supplierId: form.supplierId || null,
				paymentMethod: form.paymentMethod || null,
				referenceNumber: form.referenceNumber || null,
				notes: form.notes || null,
				organizationId: orgId,
				fundingSourceId: form.fundingSourceId || undefined,
				receiptPhotoUrl: form.receiptPhotoUrl || null,
				expenseDate: form.expenseDate || today,
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
					{/* View Mode Toggle */}
					<div className="flex rounded-md border border-border">
						<Button
							size="sm"
							variant={viewMode === "table" ? "secondary" : "ghost"}
							className="gap-1 rounded-r-none border-0"
							onClick={() => setViewMode("table")}
						>
							<List className="size-4" />
							Table
						</Button>
						<Button
							size="sm"
							variant={viewMode === "daily" ? "secondary" : "ghost"}
							className="gap-1 rounded-l-none border-0 border-l"
							onClick={() => setViewMode("daily")}
						>
							<CalendarDays className="size-4" />
							Daily Summary
						</Button>
					</div>
					{viewMode === "table" && (
						<Select
							value={groupBy}
							onValueChange={(v) => setGroupBy(v as typeof groupBy)}
						>
							<SelectTrigger className="h-8 w-40 gap-1 text-xs">
								<Layers className="size-3.5 shrink-0 text-muted-foreground" />
								<SelectValue placeholder="No grouping" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No grouping</SelectItem>
								<SelectItem value="source">By Funding Source</SelectItem>
								<SelectItem value="category">By Category</SelectItem>
								<SelectItem value="supplier">By Supplier</SelectItem>
							</SelectContent>
						</Select>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger
							className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent hover:text-accent-foreground"
						>
							<Settings2 className="size-4" />
							Manage
							<ChevronDown className="size-3.5 opacity-60" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem onClick={() => setManageFundingSourcesOpen(true)}>
								<Wallet className="mr-2 size-4" />
								Funding Sources
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setManageCategoriesOpen(true)}>
								<Settings2 className="mr-2 size-4" />
								Categories
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setManageSuppliersOpen(true)}>
								<Building2 className="mr-2 size-4" />
								Add Supplier
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() =>
							downloadCsv(
								`expenses-${new Date().toISOString().slice(0, 10)}.csv`,
								(activeGroups
									? activeGroups.flatMap((g) =>
											g.items.map((e) => ({ ...e, _group: g.name })),
									  )
								: filtered
								).map((e) => ({
									"Funding Source": getSourceName(e.funding_source_id),
									Date: new Date(e.expense_date + "T12:00:00").toLocaleDateString("en-GY"),
									Supplier: e.supplier_name ?? "",
									Category: e.category,
									Description: e.description ?? "",
									Amount: e.amount,
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
						Export CSV
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() =>
							printExpenseReport({
								title: pdfTitle,
								rows: activeGroups
									? activeGroups.flatMap((g) => g.items)
									: filtered,
								period: `${startDate} – ${endDate}`,
								getSourceName: groupBy === "none" ? getSourceName : undefined,
								groups: activeGroups ?? undefined,
								preparedBy:
									session?.user?.name ?? userProfile?.name ?? undefined,
							})
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

			{/* Filters — only shown in table mode */}
			{viewMode === "daily" && (
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<Label className="text-muted-foreground text-xs">Date</Label>
						<Input
							type="date"
							value={summaryDate}
							onChange={(e) => setSummaryDate(e.target.value)}
							className="h-8 w-40 text-sm"
						/>
					</div>
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						disabled={dailySummaryLoading || !dailySummary}
						onClick={() => {
							if (!dailySummary) return;
							printDailyExpenseSummary({
								date: summaryDate,
								grandTotal: dailySummary.grandTotal,
								groups: dailySummary.groups,
								preparedBy:
									session?.user?.name ?? userProfile?.name ?? undefined,
							});
						}}
					>
						<Printer className="size-4" />
						Print Daily Summary
					</Button>
				</div>
			)}
			{viewMode === "table" && (
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
					<div className="flex flex-col gap-1">
						<Label className="text-muted-foreground text-xs">
							Funding Source
						</Label>
						<Select
							value={fundingSourceFilter}
							onValueChange={setFundingSourceFilter}
						>
							<SelectTrigger className="h-8 w-44 text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All sources</SelectItem>
								{fundingSources.map((fs) => (
									<SelectItem key={fs.id} value={fs.id}>
										{fs.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			)}

			{viewMode === "table" && (
				<>
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
								{prevMonthReport?.grandTotal && Number(prevMonthReport.grandTotal) > 0 && (() => {
									const curr = Number(reportData?.grandTotal ?? 0);
									const prev = Number(prevMonthReport.grandTotal);
									const diff = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
									return (
										<span className={`text-xs font-medium ${
											diff > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"
										}`}>
											{diff > 0 ? "+" : ""}{diff.toFixed(0)}% vs last month
										</span>
									);
								})()}
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

					{/* Funding Source Breakdown */}
					{expensesBySource.length > 0 && (
						<div>
							<div className="mb-2 flex items-baseline gap-2">
								<p className="font-medium text-foreground text-sm">
									By Funding Source
								</p>
								<span className="text-muted-foreground text-xs">
									click to filter · toggle "By Source" to group table
								</span>
							</div>
							<div className="flex flex-wrap gap-2">
								{expensesBySource.map((src) => (
									<button
										key={src.id}
										type="button"
										onClick={() => {
											if (src.id === "general") {
												setFundingSourceFilter("all");
											} else {
												setFundingSourceFilter(
													fundingSourceFilter === src.id ? "all" : src.id,
												);
											}
										}}
										className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 ${src.id !== "general" && fundingSourceFilter === src.id ? "ring-1 ring-primary" : "border-border"}`}
										style={{ borderLeftWidth: 3, borderLeftColor: src.color }}
									>
										<span
											className="inline-block size-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: src.color }}
										/>
										<span className="font-medium text-foreground">
											{formatGYD(src.total)}
										</span>
										<span className="text-muted-foreground text-xs">
											{src.name} ({src.items.length})
										</span>
									</button>
								))}
							</div>
						</div>
					)}
	
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

					{/* Table */}
					{activeGroups && activeGroups.length > 0 ? (
						<div className="flex flex-col gap-3">
							{activeGroups.map((src) => (
								<div
									key={src.id}
									className="overflow-hidden rounded-lg border border-border"
								>
									<div
										className="flex items-center justify-between px-4 py-2 text-sm font-medium"
										style={{
											backgroundColor: `${src.color}18`,
											borderBottom: `2px solid ${src.color}`,
										}}
									>
										<div className="flex items-center gap-2">
											<span
												className="inline-block size-2.5 shrink-0 rounded-full"
												style={{ backgroundColor: src.color }}
											/>
											<span>{src.name}</span>
											<span className="text-muted-foreground text-xs font-normal">
												{src.items.length} expense{src.items.length !== 1 ? "s" : ""}
											</span>
										</div>
										<span className="font-semibold">{formatGYD(src.total)}</span>
									</div>
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
											{src.items.map((e) => {
												const color = e.supplier_id
													? supplierColorMap.get(e.supplier_id)
													: undefined;
												return (
													<TableRow
														key={e.id}
														className="cursor-pointer transition-colors hover:bg-muted/60"
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
																<span className="text-muted-foreground text-xs">
																	—
																</span>
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
																	type="button"
																	onClick={(ev) => {
																		ev.stopPropagation();
																		openEdit(e);
																	}}
																>
																	<Pencil className="size-3.5" />
																</Button>
																<DropdownMenu>
																	<DropdownMenuTrigger
																		className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
																		type="button"
																		onClick={(ev) => ev.stopPropagation()}
																	>
																		<MoreHorizontal className="size-4" />
																	</DropdownMenuTrigger>
																	<DropdownMenuContent align="end" className="w-40">
																		<DropdownMenuSeparator />
																		<DropdownMenuItem
																			className="text-destructive focus:text-destructive"
																			onClick={(ev) => {
																				ev.stopPropagation();
																				setDeleteExpenseId(e.id);
																			}}
																		>
																			<Trash2 className="mr-2 size-3.5" />
																			Delete
																		</DropdownMenuItem>
																	</DropdownMenuContent>
																</DropdownMenu>
															</div>
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							))}
							<div className="flex items-center justify-between border-border border-t px-4 py-3 text-sm">
								<span className="text-muted-foreground">
									{filtered.length} expense{filtered.length !== 1 ? "s" : ""}
									{(supplierFilter !== "all" ||
										categoryFilter !== "all" ||
										fundingSourceFilter !== "all") && (
										<span className="ml-1 text-xs">(filtered)</span>
									)}
								</span>
								<span className="font-semibold">
									Total: {formatGYD(totalToday)}
								</span>
							</div>
						</div>
					) : (
						<div className="rounded-lg border border-border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-28 text-xs">Source</TableHead>
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
												colSpan={8}
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
											const srcColor = getSourceColor(e.funding_source_id);
											const srcName = getSourceName(e.funding_source_id);
											return (
												<TableRow
													key={e.id}
													className="cursor-pointer transition-colors hover:bg-muted/60"
													style={{ borderLeft: `3px solid ${srcColor}` }}
													onClick={() => setViewingExpense(e)}
												>
													<TableCell className="text-xs">
														<span
															className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
															style={{ backgroundColor: srcColor }}
														>
															{srcName}
														</span>
													</TableCell>
													<TableCell className="whitespace-nowrap text-xs">
														<span className="font-medium text-foreground">
															{new Date(e.expense_date + "T12:00:00").toLocaleDateString("en-GY", {
																month: "short",
																day: "numeric",
															})}
														</span>
														{e.expense_date !== new Date(e.created_at).toLocaleDateString("en-CA", { timeZone: "America/Guyana" }) && (
															<span
																className="ml-1 text-muted-foreground text-[10px]"
																title={"Entered: " + new Date(e.created_at).toLocaleString("en-GY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
															>
																(backdated)
															</span>
														)}
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
															<span className="text-muted-foreground text-xs">
																—
															</span>
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
																type="button"
																onClick={(ev) => {
																	ev.stopPropagation();
																	openEdit(e);
																}}
															>
																<Pencil className="size-3.5" />
															</Button>
															<DropdownMenu>
																<DropdownMenuTrigger
																	className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
																	type="button"
																	onClick={(ev) => ev.stopPropagation()}
																>
																	<MoreHorizontal className="size-4" />
																</DropdownMenuTrigger>
																<DropdownMenuContent align="end" className="w-40">
																	<DropdownMenuSeparator />
																	<DropdownMenuItem
																		className="text-destructive focus:text-destructive"
																		onClick={(ev) => {
																			ev.stopPropagation();
																			setDeleteExpenseId(e.id);
																		}}
																	>
																		<Trash2 className="mr-2 size-3.5" />
																		Delete
																	</DropdownMenuItem>
																</DropdownMenuContent>
															</DropdownMenu>
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
										{(supplierFilter !== "all" ||
											categoryFilter !== "all" ||
											fundingSourceFilter !== "all") && (
											<span className="ml-1 text-xs">(filtered)</span>
										)}
									</span>
									<span className="font-semibold">
										Total: {formatGYD(totalToday)}
									</span>
								</div>
							)}
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
				</>
			)}

			{/* Daily Summary View */}
			{viewMode === "daily" && (
				<div className="flex flex-col gap-4">
					{dailySummaryLoading ? (
						<div className="flex flex-col gap-4">
							<Skeleton className="h-20 w-full rounded-lg" />
							<Skeleton className="h-32 w-full rounded-lg" />
							<Skeleton className="h-32 w-full rounded-lg" />
						</div>
					) : !dailySummary || dailySummary.groups.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-lg border border-border py-16 text-center">
							<ReceiptText className="mx-auto mb-3 size-10 opacity-30" />
							<p className="font-medium text-foreground text-sm">
								No expenses on{" "}
								{new Date(`${summaryDate}T12:00:00`).toLocaleDateString(
									"en-GY",
									{
										weekday: "long",
										month: "long",
										day: "numeric",
									},
								)}
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Add expenses using the "Add Expense" button above
							</p>
						</div>
					) : (
						<>
							{dailySummary.groups.map((group) => (
								<div
									key={group.fundingSourceId ?? "general"}
									className="overflow-hidden rounded-lg border border-border"
								>
									{/* Group header */}
									<div className="flex items-center justify-between bg-muted/50 px-4 py-3">
										<div className="flex items-center gap-2">
											<Wallet className="size-4 text-muted-foreground" />
											<span className="font-semibold text-foreground text-sm uppercase tracking-wide">
												{group.fundingSource}
											</span>
											<span className="text-muted-foreground text-xs">
												{group.items.length} item
												{group.items.length !== 1 ? "s" : ""}
											</span>
										</div>
										<span className="font-bold text-foreground text-sm">
											{formatGYD(Number(group.subtotal))}
										</span>
									</div>
									{/* Group items table */}
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="text-xs">Vendor</TableHead>
												<TableHead className="text-xs">Category</TableHead>
												<TableHead className="text-xs">Description</TableHead>
												<TableHead className="text-right text-xs">
													Amount
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{group.items.map((item) => (
												<TableRow key={item.expenseId}>
													<TableCell className="text-xs">
														{item.vendor || "—"}
													</TableCell>
													<TableCell>
														<Badge
															variant="secondary"
															className="bg-sky-100 text-sky-800 text-xs dark:bg-sky-900/30 dark:text-sky-300"
														>
															{item.category}
														</Badge>
													</TableCell>
													<TableCell className="max-w-48 truncate text-xs">
														{item.description}
													</TableCell>
													<TableCell className="text-right font-semibold text-sm">
														{formatGYD(Number(item.amount))}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							))}
							{/* Grand total */}
							<div className="flex items-center justify-between rounded-lg bg-foreground px-4 py-3 text-background">
								<span className="font-bold text-sm uppercase tracking-widest">
									Grand Total
								</span>
								<span className="font-bold text-xl">
									{formatGYD(Number(dailySummary.grandTotal))}
								</span>
							</div>
						</>
					)}
				</div>
			)}

			{/* Add / Edit Expense Dialog */}
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setEditingId(null);
						setForm(stickyDate && !editingId ? { ...emptyForm, expenseDate: form.expenseDate } : emptyForm);
					}
				}}
			>
				<DialogContent className="flex flex-col sm:max-w-md max-h-[90vh]">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Expense" : "Record Expense"}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between">
								<Label>Expense Date</Label>
								{!editingId && (
									<div className="flex items-center gap-2">
										<span className="text-xs text-muted-foreground">
											{stickyDate ? `Locked to ${form.expenseDate || today}` : "Lock date"}
										</span>
										<Switch
											checked={stickyDate}
											onCheckedChange={(v) => {
												setStickyDate(v);
												try {
													localStorage.setItem("expense_sticky_date", String(v));
													// When locking, save the currently-selected date as the locked date
													if (v) localStorage.setItem("expense_locked_date", form.expenseDate || today);
												} catch {}
											}}
										/>
									</div>
								)}
							</div>
							<Input
								type="date"
								max={today}
								value={form.expenseDate || today}
								onChange={(e) => {
									setForm((f) => ({ ...f, expenseDate: e.target.value }));
									if (stickyDate) try { localStorage.setItem("expense_locked_date", e.target.value); } catch {}
								}}
							/>
							{form.expenseDate && form.expenseDate !== today && (
								<p className="text-xs text-amber-600 dark:text-amber-400">
									Back-dated — entry will be recorded as {today}
								</p>
							)}
						</div>
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
							<div className="flex items-center justify-between">
								<Label>Supplier</Label>
								<button
									type="button"
									className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
									onClick={() => setManageSuppliersOpen(true)}
								>
									Add Supplier
								</button>
							</div>
							<Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										role="combobox"
										className="w-full justify-between font-normal"
									>
										<span className={form.supplierId ? "" : "text-muted-foreground"}>
											{form.supplierId
												? (suppliers.find((s) => s.id === form.supplierId)?.name ?? "Unknown")
												: "Select supplier (optional)"}
										</span>
										<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[--radix-popover-trigger-width] p-0">
									<Command>
										<div className="flex items-center border-b border-border px-3">
											<input
												placeholder="Search suppliers…"
												value={supplierSearch}
												onChange={(e) => setSupplierSearch(e.target.value)}
												className="h-9 w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
												autoFocus
											/>
										</div>
										<CommandList>
											<CommandEmpty>No supplier found.</CommandEmpty>
											<CommandGroup>
												<CommandItem
													value="none"
													onSelect={() => {
														setForm((f) => ({ ...f, supplierId: "" }));
														setSupplierSearch("");
														setSupplierPopoverOpen(false);
													}}
												>
													<Check className={`mr-2 size-3.5 ${!form.supplierId ? "opacity-100" : "opacity-0"}`} />
													No supplier
												</CommandItem>
												{suppliers
													.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
													.slice(0, 15)
													.map((s) => (
														<CommandItem
															key={s.id}
															value={s.name}
															onSelect={() => {
																// Auto-fill category from most recent expense for this supplier
																const recent = expenses
																	.filter((e) => e.supplier_id === s.id)
																	.sort(
																		(a, b) =>
																			new Date(b.created_at).getTime() -
																			new Date(a.created_at).getTime(),
																	)[0];
																setForm((f) => ({
																	...f,
																	supplierId: s.id,
																	category:
																		f.category || (recent?.category ?? f.category),
																}));
																setSupplierSearch("");
																setSupplierPopoverOpen(false);
															}}
														>
															<Check className={`mr-2 size-3.5 ${form.supplierId === s.id ? "opacity-100" : "opacity-0"}`} />
															{s.name}
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between">
								<Label>Funding Source</Label>
								<button
									type="button"
									className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
									onClick={() => setManageFundingSourcesOpen(true)}
								>
									Manage Sources
								</button>
							</div>
							<Select
								value={form.fundingSourceId || "none"}
								onValueChange={(v) =>
									setForm((f) => ({
										...f,
										fundingSourceId: v === "none" ? "" : v,
									}))
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select funding source (optional)" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Unassigned</SelectItem>
									{fundingSources.map((fs) => (
										<SelectItem key={fs.id} value={fs.id}>
											{fs.name}
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
							<Textarea
								placeholder="What was this expense for?"
								value={form.description}
								onChange={(e) =>
									setForm((f) => ({ ...f, description: e.target.value }))
								}
								rows={3}
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
									<p className="text-muted-foreground text-xs">Expense Date</p>
									<p className="font-medium text-sm">
										{new Date(viewingExpense.expense_date + "T12:00:00").toLocaleDateString(
											"en-GY",
											{ weekday: "short", month: "short", day: "numeric", year: "numeric" },
										)}
									</p>
									<p className="text-muted-foreground text-[10px]">
										Entered:{" "}
										{new Date(viewingExpense.created_at).toLocaleString("en-GY", {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
											hour12: false,
										})}
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
							{viewingExpense.receipt_photo_url && (
								<div className="flex flex-col gap-1">
									<p className="text-muted-foreground text-xs">Receipt Photo</p>
									<a
										href={viewingExpense.receipt_photo_url}
										target="_blank"
										rel="noreferrer"
									>
										<img
											src={viewingExpense.receipt_photo_url}
											alt="Receipt"
											className="max-h-48 rounded border object-contain"
										/>
									</a>
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


			{/* Manage Suppliers Dialog */}
			<Dialog
				open={manageSuppliersOpen}
				onOpenChange={(open) => {
					setManageSuppliersOpen(open);
					if (!open) setNewSupplierName("");
				}}
			>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Add Supplier</DialogTitle>
						<DialogDescription>
							Quickly add a new supplier. You can add full details later in Inventory → Suppliers.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="flex gap-2">
							<Input
								placeholder="Supplier name (e.g. D'Aguiar Bros)"
								value={newSupplierName}
								autoFocus
								onChange={(e) => setNewSupplierName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && newSupplierName.trim()) {
										createSupplierMut.mutate({ name: newSupplierName.trim() });
									}
								}}
							/>
							<Button
								onClick={() => {
									if (!newSupplierName.trim()) return;
									createSupplierMut.mutate({ name: newSupplierName.trim() });
								}}
								disabled={!newSupplierName.trim() || createSupplierMut.isPending}
							>
								<Plus className="size-4" />
								Add
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Manage Funding Sources Dialog */}
			<Dialog
				open={manageFundingSourcesOpen}
				onOpenChange={(open) => {
					setManageFundingSourcesOpen(open);
					if (!open) {
						setEditingFundingSource(null);
						setNewFundingSourceName("");
					}
				}}
			>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Manage Funding Sources</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						{/* Add new funding source */}
						{editingFundingSource ? (
							<div className="flex flex-col gap-2 rounded-lg border border-border p-3">
								<p className="font-medium text-sm">Edit Funding Source</p>
								<Input
									placeholder="Name"
									value={editingFundingSource.name}
									onChange={(e) =>
										setEditingFundingSource((prev) =>
											prev ? { ...prev, name: e.target.value } : null,
										)
									}
									onKeyDown={(e) => {
										if (e.key === "Enter" && editingFundingSource.name.trim()) {
											updateFundingSourceMut.mutate({
												id: editingFundingSource.id,
												name: editingFundingSource.name.trim(),
												isActive: editingFundingSource.isActive,
											});
										}
									}}
								/>
								<div className="flex gap-2">
									<Button
										size="sm"
										className="flex-1"
										disabled={
											!editingFundingSource.name.trim() ||
											updateFundingSourceMut.isPending
										}
										onClick={() => {
											updateFundingSourceMut.mutate({
												id: editingFundingSource.id,
												name: editingFundingSource.name.trim(),
												isActive: editingFundingSource.isActive,
											});
										}}
									>
										Save
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => setEditingFundingSource(null)}
									>
										Cancel
									</Button>
								</div>
							</div>
						) : (
							<div className="flex gap-2">
								<Input
									placeholder="New funding source (e.g. Renatta, CEO)"
									value={newFundingSourceName}
									onChange={(e) => setNewFundingSourceName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && newFundingSourceName.trim()) {
											createFundingSourceMut.mutate({
												name: newFundingSourceName.trim(),
											});
										}
									}}
								/>
								<Button
									onClick={() => {
										if (!newFundingSourceName.trim()) return;
										createFundingSourceMut.mutate({
											name: newFundingSourceName.trim(),
										});
									}}
									disabled={
										!newFundingSourceName.trim() ||
										createFundingSourceMut.isPending
									}
								>
									<Plus className="size-4" />
									Add
								</Button>
							</div>
						)}
						{/* List of funding sources */}
						<div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
							{fundingSourcesLoading ? (
								<>
									<Skeleton className="h-10 w-full rounded-md" />
									<Skeleton className="h-10 w-full rounded-md" />
									<Skeleton className="h-10 w-full rounded-md" />
								</>
							) : fundingSources.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-sm">
									No funding sources yet. Add one above.
								</p>
							) : (
								fundingSources.map((fs) => (
									<div
										key={fs.id}
										className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted"
									>
										<span className="text-sm">{fs.name}</span>
										<div className="flex items-center gap-1">
											<Button
												size="icon"
												variant="ghost"
												className="size-7"
												onClick={() =>
													setEditingFundingSource({
														id: fs.id,
														name: fs.name,
														isActive: fs.isActive,
													})
												}
											>
												<Pencil className="size-3.5" />
											</Button>
											<Button
												size="icon"
												variant="ghost"
												className="size-7 text-destructive hover:text-destructive"
												disabled={deleteFundingSourceMut.isPending}
												onClick={() => {
													setDeleteFundingSourceItem({
														id: fs.id,
														name: fs.name,
													});
												}}
											>
												<Trash2 className="size-3.5" />
											</Button>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Funding Source Confirmation */}
			<AlertDialog
				open={!!deleteFundingSourceItem}
				onOpenChange={(o) => {
					if (!o) setDeleteFundingSourceItem(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete "{deleteFundingSourceItem?.name}"?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This funding source will be removed. Existing expenses linked to
							it will not be affected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								deleteFundingSourceItem &&
								deleteFundingSourceMut.mutate({
									id: deleteFundingSourceItem.id,
								})
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
