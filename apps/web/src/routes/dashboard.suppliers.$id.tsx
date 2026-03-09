import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowLeft,
	Building2,
	Calendar,
	ChevronDown,
	ChevronUp,
	Download,
	FileText,
	Mail,
	MapPin,
	Phone,
	Plus,
	Printer,
	TrendingDown,
	TrendingUp,
	User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";
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
import { downloadCsv } from "@/lib/csv-export";
import { printVendorStatement } from "@/lib/pdf/vendor-statement-pdf";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// ── Period preset helpers ─────────────────────────────────────────────────

type PeriodPreset =
	| "today"
	| "this_week"
	| "this_month"
	| "last_month"
	| "this_quarter"
	| "last_quarter"
	| "this_year"
	| "all_time";

function getPeriodDates(preset: PeriodPreset): {
	startDate: string | null;
	endDate: string | null;
	label: string;
} {
	const now = new Date(
		new Date().toLocaleString("en-US", { timeZone: "America/Guyana" }),
	);
	const pad = (n: number) => String(n).padStart(2, "0");
	const fmt = (d: Date) =>
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const today = todayGY();

	switch (preset) {
		case "today":
			return { startDate: today, endDate: today, label: "Today" };

		case "this_week": {
			const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
			const mon = new Date(now);
			mon.setDate(now.getDate() - dow);
			return { startDate: fmt(mon), endDate: today, label: "This Week" };
		}

		case "this_month":
			return {
				startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
				endDate: today,
				label: "This Month",
			};

		case "last_month": {
			const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const lme = new Date(now.getFullYear(), now.getMonth(), 0);
			return {
				startDate: fmt(lm),
				endDate: fmt(lme),
				label: "Last Month",
			};
		}

		case "this_quarter": {
			const q = Math.floor(now.getMonth() / 3);
			const qStart = new Date(now.getFullYear(), q * 3, 1);
			return {
				startDate: fmt(qStart),
				endDate: today,
				label: "This Quarter",
			};
		}

		case "last_quarter": {
			const q = Math.floor(now.getMonth() / 3);
			const lqStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
			const lqEnd = new Date(now.getFullYear(), q * 3, 0);
			return {
				startDate: fmt(lqStart),
				endDate: fmt(lqEnd),
				label: "Last Quarter",
			};
		}

		case "this_year":
			return {
				startDate: `${now.getFullYear()}-01-01`,
				endDate: today,
				label: "This Year",
			};

		case "all_time":
			return { startDate: null, endDate: null, label: "All Time" };
	}
}

// ── Expense row type (matches DB result from getExpenses) ─────────────────

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

const PAYMENT_METHODS = [
	"Cash",
	"Card",
	"Bank Transfer",
	"Cheque",
	"Other",
] as const;

const emptyExpenseForm = {
	amount: "",
	category: "",
	description: "",
	paymentMethod: "",
	referenceNumber: "",
	notes: "",
};

// ── SortHeader component ──────────────────────────────────────────────────

function SortHeader({
	field,
	label,
	currentField,
	currentDir,
	onSort,
	className,
}: {
	field: "date" | "amount";
	label: string;
	currentField: "date" | "amount";
	currentDir: "desc" | "asc";
	onSort: (field: "date" | "amount") => void;
	className?: string;
}) {
	const active = currentField === field;
	return (
		<th
			className={`cursor-pointer select-none ${className ?? ""}`}
			onClick={() => onSort(field)}
		>
			<span className="flex items-center gap-1">
				{label}
				{active ? (
					currentDir === "desc" ? (
						<ChevronDown className="size-3" />
					) : (
						<ChevronUp className="size-3" />
					)
				) : null}
			</span>
		</th>
	);
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SupplierDetailPage() {
	const { id: supplierId } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const qc = useQueryClient();

	// Period selector
	const [period, setPeriod] = useState<PeriodPreset>("this_month");
	const { startDate, endDate, label: periodLabel } = getPeriodDates(period);

	// Transaction filters
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("");

	// Add expense dialog
	const [addExpenseOpen, setAddExpenseOpen] = useState(false);
	const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);

	// Statement dialog
	const [statementOpen, setStatementOpen] = useState(false);

	// Sort controls for transaction table
	const [sortField, setSortField] = useState<"date" | "amount">("date");
	const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

	// Keyboard shortcut: Escape → back to suppliers
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") navigate("/dashboard/suppliers");
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [navigate]);

	// ── Data fetching ──────────────────────────────────────────────────────

	const { data: supplier, isLoading: loadingSupplier } = useQuery(
		orpc.settings.getSupplierById.queryOptions({
			input: { id: supplierId ?? "" },
			enabled: !!supplierId,
		}),
	);

	const { data: spendSummaryRaw, isLoading: loadingSummary } = useQuery(
		orpc.cash.getSupplierSpendSummary.queryOptions({
			input: {
				supplierId: supplierId ?? "",
				...(startDate ? { startDate: `${startDate}T00:00:00` } : {}),
				...(endDate ? { endDate: `${endDate}T23:59:59` } : {}),
			},
			enabled: !!supplierId,
		}),
	);

	const { data: monthlyDataRaw = [], isLoading: loadingMonthly } = useQuery(
		orpc.cash.getSupplierMonthlySpend.queryOptions({
			input: { supplierId: supplierId ?? "" },
			enabled: !!supplierId,
		}),
	);

	const { data: categoryBreakdownRaw = [], isLoading: loadingCategory } =
		useQuery(
			orpc.cash.getSupplierCategoryBreakdown.queryOptions({
				input: {
					supplierId: supplierId ?? "",
					...(startDate ? { startDate: `${startDate}T00:00:00` } : {}),
					...(endDate ? { endDate: `${endDate}T23:59:59` } : {}),
				},
				enabled: !!supplierId,
			}),
		);

	const { data: expensesRaw = [], isLoading: loadingExpenses } = useQuery(
		orpc.cash.getExpenses.queryOptions({
			input: {
				supplierId: supplierId ?? "",
				...(startDate ? { startDate: `${startDate}T00:00:00` } : {}),
				...(endDate ? { endDate: `${endDate}T23:59:59` } : {}),
			},
			enabled: !!supplierId,
		}),
	);

	// Expense categories for the add form
	const { data: categories = [] } = useQuery(
		orpc.cash.getExpenseCategories.queryOptions(),
	);

	// ── Mutations ─────────────────────────────────────────────────────────

	const { data: userProfile } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);
	const orgId = userProfile?.organizationId;

	const createExpense = useMutation(
		orpc.cash.createExpense.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.cash.getExpenses.queryOptions({
						input: { supplierId: supplierId ?? "" },
					}).queryKey,
				});
				qc.invalidateQueries({
					queryKey: orpc.cash.getSupplierSpendSummary.queryOptions({
						input: { supplierId: supplierId ?? "" },
					}).queryKey,
				});
				qc.invalidateQueries({
					queryKey: orpc.cash.getSupplierMonthlySpend.queryOptions({
						input: { supplierId: supplierId ?? "" },
					}).queryKey,
				});
				qc.invalidateQueries({
					queryKey: orpc.cash.getSupplierCategoryBreakdown.queryOptions({
						input: { supplierId: supplierId ?? "" },
					}).queryKey,
				});
				setAddExpenseOpen(false);
				setExpenseForm(emptyExpenseForm);
				toast.success("Expense recorded");
			},
			onError: (err) => toast.error(err.message ?? "Failed to save expense"),
		}),
	);

	// ── Derived data ──────────────────────────────────────────────────────

	const summary = spendSummaryRaw as
		| {
				periodTotal: string;
				periodCount: number;
				periodAvg: string;
				periodLargest: string;
				periodLargestDesc: string | null;
				allTimeTotal: string;
				allTimeCount: number;
				lastPurchaseDate: string | null;
				previousPeriodTotal: string;
		  }
		| undefined;

	const expenses = expensesRaw as ExpenseRow[];

	const monthlyData = (
		monthlyDataRaw as {
			month: string;
			label: string;
			total: string;
			count: number;
		}[]
	).map((m) => ({ ...m, total: Number(m.total) }));

	const categoryBreakdownData = (
		categoryBreakdownRaw as { category: string; total: string; pct: number }[]
	).map((c) => ({ ...c, total: Number(c.total) }));

	// Duplicate detection: same amount within 7 days
	const duplicateIds = useMemo(() => {
		const ids = new Set<string>();
		for (let i = 0; i < expenses.length; i++) {
			for (let j = i + 1; j < expenses.length; j++) {
				const a = expenses[i];
				const b = expenses[j];
				if (!a || !b) continue;
				const daysDiff =
					Math.abs(
						new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
					) /
					(1000 * 60 * 60 * 24);
				if (a.amount === b.amount && daysDiff <= 7) {
					ids.add(a.id);
					ids.add(b.id);
				}
			}
		}
		return ids;
	}, [expenses]);

	// Filtered transactions
	const filteredExpenses = useMemo(() => {
		return expenses
			.filter((e) => {
				const matchesSearch =
					search === "" ||
					e.description.toLowerCase().includes(search.toLowerCase()) ||
					(e.reference_number ?? "")
						.toLowerCase()
						.includes(search.toLowerCase());
				const matchesCategory =
					categoryFilter === "" || e.category === categoryFilter;
				return matchesSearch && matchesCategory;
			})
			.sort((a, b) => {
				if (sortField === "date") {
					const diff =
						new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
					return sortDir === "desc" ? -diff : diff;
				}
				const diff = Number(a.amount) - Number(b.amount);
				return sortDir === "desc" ? -diff : diff;
			});
	}, [expenses, search, categoryFilter, sortField, sortDir]);

	const filteredTotal = filteredExpenses.reduce(
		(sum, e) => sum + Number(e.amount),
		0,
	);

	// Unique categories from loaded expenses
	const uniqueCategories = useMemo(
		() => [...new Set(expenses.map((e) => e.category))].sort(),
		[expenses],
	);

	// % change vs previous period
	const pctChange = useMemo(() => {
		if (!summary) return null;
		const prev = Number(summary.previousPeriodTotal);
		const curr = Number(summary.periodTotal);
		if (prev === 0) return null;
		return ((curr - prev) / prev) * 100;
	}, [summary]);

	// Days since last purchase
	const daysSinceLastPurchase = useMemo(() => {
		if (!summary?.lastPurchaseDate) return null;
		const diff = Date.now() - new Date(summary.lastPurchaseDate).getTime();
		return Math.floor(diff / (1000 * 60 * 60 * 24));
	}, [summary]);

	// ── Handlers ─────────────────────────────────────────────────────────

	function handleSort(field: "date" | "amount") {
		if (sortField === field) {
			setSortDir((d) => (d === "desc" ? "asc" : "desc"));
		} else {
			setSortField(field);
			setSortDir("desc");
		}
	}

	function handleExportCsv() {
		if (!supplier) return;
		downloadCsv(
			`vendor-${supplier.name.replace(/\s+/g, "-").toLowerCase()}-statement.csv`,
			filteredExpenses.map((e) => ({
				Date: new Date(e.created_at).toLocaleDateString("en-GY", {
					timeZone: "America/Guyana",
				}),
				Description: e.description,
				Category: e.category,
				"Payment Method": e.payment_method ?? "",
				"Reference #": e.reference_number ?? "",
				"Authorized By": e.authorized_by_name ?? "",
				"Amount (GYD)": e.amount,
			})),
		);
	}

	function handlePrint() {
		if (!supplier) return;
		printVendorStatement({
			vendor: {
				name: supplier.name,
				contactName: supplier.contactName ?? null,
				phone: supplier.phone ?? null,
				email: supplier.email ?? null,
			},
			period: { label: periodLabel, startDate, endDate },
			transactions: filteredExpenses.map((e) => ({
				date: e.created_at,
				description: e.description,
				category: e.category,
				paymentMethod: e.payment_method ?? "—",
				referenceNumber: e.reference_number ?? null,
				authorizedBy: e.authorized_by_name ?? null,
				amount: e.amount,
			})),
			categoryBreakdown: categoryBreakdownData.map((c) => ({
				category: c.category,
				total: String(c.total),
			})),
			preparedBy: "System",
		});
	}

	function handleAddExpenseSubmit() {
		if (!orgId || !supplierId) {
			toast.error("Organization context is missing");
			return;
		}
		if (
			!expenseForm.amount ||
			!expenseForm.category ||
			!expenseForm.description
		) {
			toast.error("Amount, category, and description are required");
			return;
		}
		createExpense.mutate({
			amount: expenseForm.amount,
			category: expenseForm.category,
			description: expenseForm.description,
			supplierId,
			paymentMethod: expenseForm.paymentMethod || null,
			referenceNumber: expenseForm.referenceNumber || null,
			notes: expenseForm.notes || null,
			organizationId: orgId,
		});
	}

	// ── Loading state ─────────────────────────────────────────────────────

	const isPageLoading =
		loadingSupplier ||
		loadingSummary ||
		loadingMonthly ||
		loadingCategory ||
		loadingExpenses;

	if (loadingSupplier) {
		return (
			<div className="space-y-6 p-4 md:p-6">
				<Skeleton className="h-4 w-32" />
				<div className="space-y-2">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-4 w-48" />
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{["k1", "k2", "k3", "k4", "k5", "k6"].map((k) => (
						<Skeleton key={k} className="h-24 rounded-lg" />
					))}
				</div>
				<div className="grid gap-4 lg:grid-cols-2">
					<Skeleton className="h-64 rounded-lg" />
					<Skeleton className="h-64 rounded-lg" />
				</div>
				<Skeleton className="h-80 rounded-lg" />
			</div>
		);
	}

	if (!supplier) {
		return (
			<div className="space-y-4 p-4 md:p-6">
				<Link
					to="/dashboard/suppliers"
					className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="size-4" />
					Suppliers
				</Link>
				<div className="py-16 text-center">
					<Building2 className="mx-auto mb-3 size-12 text-muted-foreground/40" />
					<p className="font-medium text-foreground">Vendor not found</p>
					<p className="mt-1 text-muted-foreground text-sm">
						This vendor may have been deleted or doesn&apos;t exist.
					</p>
					<Button asChild className="mt-4" variant="outline">
						<Link to="/dashboard/suppliers">Back to Suppliers</Link>
					</Button>
				</div>
			</div>
		);
	}

	const supplierData = supplier as {
		id: string;
		name: string;
		contactName: string | null;
		email: string | null;
		phone: string | null;
		address: string | null;
		salesRep: string | null;
		categories: string[];
		itemsSupplied: string | null;
		isActive: boolean;
	};

	// ── Render ────────────────────────────────────────────────────────────

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Breadcrumb */}
			<Link
				to="/dashboard/suppliers"
				className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				Suppliers
			</Link>

			{/* Header strip */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
							<Building2 className="size-4 text-primary" />
						</div>
						<h1 className="font-bold text-2xl">{supplierData.name}</h1>
						<Badge
							variant={supplierData.isActive ? "default" : "secondary"}
							className="text-xs"
						>
							{supplierData.isActive ? "Active" : "Inactive"}
						</Badge>
					</div>

					{/* Category badges */}
					{supplierData.categories && supplierData.categories.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{supplierData.categories.map((cat) => (
								<Badge key={cat} variant="secondary" className="text-xs">
									{cat}
								</Badge>
							))}
						</div>
					)}

					{/* Contact info */}
					<div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
						{supplierData.contactName && (
							<span className="flex items-center gap-1">
								<User className="size-3.5" />
								{supplierData.contactName}
							</span>
						)}
						{supplierData.phone && (
							<span className="flex items-center gap-1">
								<Phone className="size-3.5" />
								{supplierData.phone}
							</span>
						)}
						{supplierData.email && (
							<span className="flex items-center gap-1">
								<Mail className="size-3.5" />
								{supplierData.email}
							</span>
						)}
						{supplierData.address && (
							<span className="flex items-center gap-1">
								<MapPin className="size-3.5" />
								{supplierData.address}
							</span>
						)}
					</div>
				</div>

				{/* Action buttons */}
				<div className="flex shrink-0 gap-2">
					{/* Edit vendor: navigate to suppliers list where user can click the card to edit */}
					<Button variant="outline" asChild>
						<Link to="/dashboard/suppliers">Edit Vendor</Link>
					</Button>
					<Button onClick={() => setAddExpenseOpen(true)} className="gap-1.5">
						<Plus className="size-4" />
						Add Expense
					</Button>
				</div>
			</div>

			{/* Period selector */}
			<div className="flex items-center gap-2">
				<Calendar className="size-4 text-muted-foreground" />
				<Select
					value={period}
					onValueChange={(v) => setPeriod(v as PeriodPreset)}
				>
					<SelectTrigger className="w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="today">Today</SelectItem>
						<SelectItem value="this_week">This Week</SelectItem>
						<SelectItem value="this_month">This Month</SelectItem>
						<SelectItem value="last_month">Last Month</SelectItem>
						<SelectItem value="this_quarter">This Quarter</SelectItem>
						<SelectItem value="last_quarter">Last Quarter</SelectItem>
						<SelectItem value="this_year">This Year</SelectItem>
						<SelectItem value="all_time">All Time</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* KPI cards */}
			{isPageLoading || !summary ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{["kpi1", "kpi2", "kpi3", "kpi4", "kpi5", "kpi6"].map((k) => (
						<Skeleton key={k} className="h-24 rounded-lg" />
					))}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{/* Period Spend */}
					<Card>
						<CardContent className="flex flex-col gap-1 p-4">
							<p className="text-muted-foreground text-xs">
								{periodLabel} Spend
							</p>
							<p className="font-bold text-2xl">
								{formatGYD(Number(summary.periodTotal))}
							</p>
							<p className="text-muted-foreground text-xs">
								{summary.periodCount} transaction
								{summary.periodCount !== 1 ? "s" : ""}
							</p>
						</CardContent>
					</Card>

					{/* vs Previous Period */}
					<Card>
						<CardContent className="flex flex-col gap-1 p-4">
							<p className="text-muted-foreground text-xs">
								vs. Previous Period
							</p>
							{pctChange === null ? (
								<p className="text-muted-foreground text-sm">No prior data</p>
							) : (
								<>
									<div className="flex items-center gap-1.5">
										{pctChange >= 0 ? (
											<TrendingUp className="size-4 text-destructive" />
										) : (
											<TrendingDown className="size-4 text-green-600" />
										)}
										<span
											className={`font-bold text-xl ${pctChange >= 0 ? "text-destructive" : "text-green-600"}`}
										>
											{pctChange >= 0 ? "+" : ""}
											{pctChange.toFixed(1)}%
										</span>
									</div>
									<p className="text-muted-foreground text-xs">
										Prev: {formatGYD(Number(summary.previousPeriodTotal))}
									</p>
								</>
							)}
						</CardContent>
					</Card>

					{/* All-Time Spend */}
					<Card>
						<CardContent className="flex flex-col gap-1 p-4">
							<p className="text-muted-foreground text-xs">All-Time Spend</p>
							<p className="font-bold text-2xl">
								{formatGYD(Number(summary.allTimeTotal))}
							</p>
							<p className="text-muted-foreground text-xs">
								{summary.allTimeCount} transaction
								{summary.allTimeCount !== 1 ? "s" : ""} total
							</p>
						</CardContent>
					</Card>

					{/* Avg Transaction */}
					<Card>
						<CardContent className="flex flex-col gap-1 p-4">
							<p className="text-muted-foreground text-xs">Avg Transaction</p>
							<p className="font-bold text-2xl">
								{formatGYD(Number(summary.periodAvg))}
							</p>
							<p className="text-muted-foreground text-xs">
								per expense this period
							</p>
						</CardContent>
					</Card>

					{/* Last Purchase */}
					<Card>
						<CardContent className="flex flex-col gap-1 p-4">
							<p className="text-muted-foreground text-xs">Last Purchase</p>
							{summary.lastPurchaseDate ? (
								<>
									<p className="font-bold text-xl">
										{new Date(summary.lastPurchaseDate).toLocaleDateString(
											"en-GY",
											{
												timeZone: "America/Guyana",
												month: "short",
												day: "numeric",
												year: "numeric",
											},
										)}
									</p>
									{daysSinceLastPurchase !== null && (
										<p className="text-muted-foreground text-xs">
											{daysSinceLastPurchase === 0
												? "Today"
												: `${daysSinceLastPurchase} day${daysSinceLastPurchase !== 1 ? "s" : ""} ago`}
										</p>
									)}
								</>
							) : (
								<p className="text-muted-foreground text-sm">
									No purchases yet
								</p>
							)}
						</CardContent>
					</Card>

					{/* Largest Expense */}
					<Card>
						<CardContent className="flex flex-col gap-1 p-4">
							<p className="text-muted-foreground text-xs">Largest Expense</p>
							<p className="font-bold text-2xl">
								{formatGYD(Number(summary.periodLargest))}
							</p>
							{summary.periodLargestDesc && (
								<p className="line-clamp-1 text-muted-foreground text-xs">
									{summary.periodLargestDesc}
								</p>
							)}
						</CardContent>
					</Card>
				</div>
			)}

			{/* Charts row */}
			<div className="grid gap-4 lg:grid-cols-2">
				{/* Chart A: Monthly spend trend */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Monthly Spend Trend</CardTitle>
					</CardHeader>
					<CardContent>
						{loadingMonthly ? (
							<Skeleton className="h-[220px] w-full" />
						) : monthlyData.every((m) => m.total === 0) ? (
							<div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
								No spend data in the last 12 months
							</div>
						) : (
							<ResponsiveContainer width="100%" height={220}>
								<BarChart data={monthlyData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										dataKey="label"
										tick={{ fontSize: 11 }}
										tickLine={false}
									/>
									<YAxis
										tick={{ fontSize: 11 }}
										tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
										tickLine={false}
										axisLine={false}
									/>
									<Tooltip formatter={(v) => [formatGYD(Number(v)), "Spend"]} />
									<Bar
										dataKey="total"
										fill="var(--chart-1)"
										radius={[4, 4, 0, 0]}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</CardContent>
				</Card>

				{/* Chart B: Spend by category (horizontal bar) */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Spend by Category</CardTitle>
					</CardHeader>
					<CardContent>
						{loadingCategory ? (
							<Skeleton className="h-[220px] w-full" />
						) : categoryBreakdownData.length === 0 ? (
							<div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
								No category data for this period
							</div>
						) : (
							<ResponsiveContainer width="100%" height={220}>
								<BarChart data={categoryBreakdownData} layout="vertical">
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										type="number"
										tick={{ fontSize: 11 }}
										tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
										tickLine={false}
									/>
									<YAxis
										type="category"
										dataKey="category"
										width={120}
										tick={{ fontSize: 11 }}
										tickLine={false}
										axisLine={false}
									/>
									<Tooltip
										formatter={(v, _name, props) => [
											formatGYD(Number(v)),
											`${(props.payload as { pct: number }).pct}%`,
										]}
									/>
									<Bar
										dataKey="total"
										fill="var(--chart-2)"
										radius={[0, 4, 4, 0]}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Transaction table */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<CardTitle className="text-base">Transactions</CardTitle>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setStatementOpen(true)}
								className="gap-1.5"
							>
								<FileText className="size-4" />
								View Statement
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handlePrint}
								className="gap-1.5"
							>
								<Printer className="size-4" />
								Print Statement
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleExportCsv}
								className="gap-1.5"
							>
								<Download className="size-4" />
								Export CSV
							</Button>
						</div>
					</div>

					{/* Search + category filter */}
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							placeholder="Search description or ref #..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-8 text-sm sm:max-w-64"
						/>
						<Select
							value={categoryFilter || "all"}
							onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}
						>
							<SelectTrigger className="h-8 w-full text-sm sm:w-44">
								<SelectValue placeholder="All Categories" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Categories</SelectItem>
								{uniqueCategories.map((cat) => (
									<SelectItem key={cat} value={cat}>
										{cat}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>

				<CardContent className="p-0">
					{loadingExpenses ? (
						<div className="space-y-2 p-4">
							{["r1", "r2", "r3", "r4", "r5"].map((k) => (
								<Skeleton key={k} className="h-10 w-full" />
							))}
						</div>
					) : filteredExpenses.length === 0 ? (
						<div className="py-16 text-center">
							<p className="text-muted-foreground text-sm">
								{expenses.length === 0
									? "No expenses recorded for this vendor yet."
									: "No transactions match your filters."}
							</p>
							{expenses.length === 0 && (
								<Button
									className="mt-3 gap-1.5"
									onClick={() => setAddExpenseOpen(true)}
								>
									<Plus className="size-4" />
									Add Expense
								</Button>
							)}
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b bg-muted/40">
										<SortHeader
											field="date"
											label="Date"
											currentField={sortField}
											currentDir={sortDir}
											onSort={handleSort}
											className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs"
										/>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">
											Description
										</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">
											Category
										</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">
											Payment
										</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">
											Ref #
										</th>
										<th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">
											Authorized By
										</th>
										<SortHeader
											field="amount"
											label="Amount (GYD)"
											currentField={sortField}
											currentDir={sortDir}
											onSort={handleSort}
											className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs"
										/>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filteredExpenses.map((exp) => (
										<tr
											key={exp.id}
											className="transition-colors hover:bg-muted/30"
										>
											<td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground text-xs">
												{new Date(exp.created_at).toLocaleString("en-GY", {
													timeZone: "America/Guyana",
													month: "short",
													day: "numeric",
													year: "numeric",
												})}
											</td>
											<td className="max-w-48 px-4 py-2.5">
												<div className="flex items-center gap-1.5">
													{duplicateIds.has(exp.id) && (
														<span
															className="shrink-0"
															role="img"
															aria-label="Possible duplicate: same amount within 7 days"
														>
															<AlertTriangle className="size-3.5 text-amber-500" />
														</span>
													)}
													<span className="truncate text-xs">
														{exp.description}
													</span>
												</div>
											</td>
											<td className="px-4 py-2.5">
												<Badge variant="secondary" className="text-xs">
													{exp.category}
												</Badge>
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-xs">
												{exp.payment_method ?? "—"}
											</td>
											<td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">
												{exp.reference_number ?? "—"}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground text-xs">
												{exp.authorized_by_name ?? "—"}
											</td>
											<td className="px-4 py-2.5 text-right font-semibold text-sm">
												{formatGYD(Number(exp.amount))}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* Pinned footer */}
					{filteredExpenses.length > 0 && (
						<div className="flex items-center justify-between border-t px-4 py-3 font-medium text-sm">
							<span className="text-muted-foreground">
								{filteredExpenses.length} transaction
								{filteredExpenses.length !== 1 ? "s" : ""}
							</span>
							<span>Total: {formatGYD(filteredTotal)}</span>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Add Expense Dialog — pre-filled with this vendor */}
			<Dialog
				open={addExpenseOpen}
				onOpenChange={(open) => {
					setAddExpenseOpen(open);
					if (!open) setExpenseForm(emptyExpenseForm);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Record Expense — {supplierData.name}</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="flex flex-col gap-1.5">
							<Label>Amount (GYD)</Label>
							<Input
								type="number"
								inputMode="decimal"
								placeholder="0.00"
								value={expenseForm.amount}
								onChange={(e) =>
									setExpenseForm((f) => ({
										...f,
										amount: e.target.value,
									}))
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Category</Label>
							<Select
								value={expenseForm.category}
								onValueChange={(v) =>
									setExpenseForm((f) => ({ ...f, category: v }))
								}
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
								value={expenseForm.description}
								onChange={(e) =>
									setExpenseForm((f) => ({
										...f,
										description: e.target.value,
									}))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1.5">
								<Label>Payment Method</Label>
								<Select
									value={expenseForm.paymentMethod || "none"}
									onValueChange={(v) =>
										setExpenseForm((f) => ({
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
									value={expenseForm.referenceNumber}
									onChange={(e) =>
										setExpenseForm((f) => ({
											...f,
											referenceNumber: e.target.value,
										}))
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
								placeholder="e.g. receipt in green folder"
								value={expenseForm.notes}
								onChange={(e) =>
									setExpenseForm((f) => ({ ...f, notes: e.target.value }))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAddExpenseOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleAddExpenseSubmit}
							disabled={createExpense.isPending}
						>
							{createExpense.isPending ? "Saving..." : "Save Expense"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Statement preview dialog */}
			<Dialog open={statementOpen} onOpenChange={setStatementOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Vendor Statement — {supplierData.name}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="flex justify-between text-sm">
							<div>
								<p className="font-medium">{supplierData.name}</p>
								{supplierData.contactName && (
									<p className="text-muted-foreground">
										{supplierData.contactName}
									</p>
								)}
							</div>
							<div className="text-right">
								<p className="font-medium">{periodLabel}</p>
								{startDate && endDate && (
									<p className="text-muted-foreground text-xs">
										{startDate} – {endDate}
									</p>
								)}
							</div>
						</div>
						<div className="max-h-64 overflow-y-auto rounded border text-xs">
							<table className="w-full">
								<thead className="bg-muted/50">
									<tr>
										<th className="p-2 text-left">Date</th>
										<th className="p-2 text-left">Description</th>
										<th className="p-2 text-left">Category</th>
										<th className="p-2 text-right">Amount</th>
									</tr>
								</thead>
								<tbody>
									{filteredExpenses.map((e) => (
										<tr key={e.id} className="border-t">
											<td className="p-2 text-muted-foreground">
												{new Date(e.created_at).toLocaleDateString("en-GY", {
													timeZone: "America/Guyana",
												})}
											</td>
											<td className="max-w-32 truncate p-2">{e.description}</td>
											<td className="p-2">{e.category}</td>
											<td className="p-2 text-right font-medium">
												{formatGYD(Number(e.amount))}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="flex justify-between border-t pt-2 font-semibold text-sm">
							<span>{filteredExpenses.length} transactions</span>
							<span>{formatGYD(filteredTotal)}</span>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setStatementOpen(false)}>
							Close
						</Button>
						<Button onClick={handlePrint} className="gap-1.5">
							<Printer className="size-4" />
							Print PDF
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
