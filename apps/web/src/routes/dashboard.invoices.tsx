import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Bell,
	Building2,
	ChevronDown,
	ChevronRight,
	Copy,
	CreditCard,
	Edit2,
	FileMinus,
	MoreHorizontal,
	Plus,
	Printer,
	Receipt,
	Search,
	Send,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { openInvoicePdf, type DocSettings } from "@/lib/pdf/invoice-pdf";
import { CustomerCombobox, type CustomerHit } from "@/components/ui/customer-combobox";
import { ProductCombobox } from "@/components/ui/product-combobox";
import { formatGYD } from "@/lib/types";
import { statusBadgeClass } from "@/lib/status-colors";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface LineItem {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

interface InvoiceForm {
	customerType: "individual" | "agency";
	customerName: string;
	customerAddress: string;
	customerPhone: string;
	customerId: string;
	agencyName: string;
	contactPersonName: string;
	contactPersonPosition: string;
	department: string;
	issuedDate: string;
	dueDate: string;
	notes: string;
	noteMode: "preset" | "custom";
	items: LineItem[];
	discountType: "percent" | "fixed";
	discountValue: string;
	taxMode: "invoice" | "line" | "incl";
	taxRate: string;
	paymentTerms: string;
	preparedBy: string;
	customInvoiceNumber: string;
	brand: "foods_inc" | "home_style";
}

const PREDEFINED_NOTES_INV = [
	"This invoice is valid for 30 days from the date of issue.",
	"All prices are in Guyanese dollars (GYD) and exclude VAT.",
	"A 10% service charge applies to all catering orders.",
	"Please confirm your order at least 48 hours in advance.",
	"Payment due upon receipt of this invoice.",
	"Prices subject to change without prior notice.",
];

const emptyForm: InvoiceForm = {
	customerType: "individual",
	customerName: "",
	customerAddress: "",
	customerPhone: "",
	customerId: "",
	agencyName: "",
	contactPersonName: "",
	contactPersonPosition: "",
	department: "",
	issuedDate: "",
	dueDate: "",
	notes: "This invoice is valid for 30 days from the date of issue.",
	noteMode: "preset",
	items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
	discountType: "percent",
	discountValue: "0",
	taxMode: "incl",
	taxRate: "14",
	paymentTerms: "due_on_receipt",
	preparedBy: "",
	customInvoiceNumber: "",
	brand: "foods_inc",
};

type InvoiceRow = {
	id: string;
	invoiceNumber: string;
	customerName: string;
	customerAddress: string | null;
	customerPhone: string | null;
	customerId?: string | null;
	agencyName?: string | null;
	contactPersonName?: string | null;
	contactPersonPosition?: string | null;
	department?: string | null;
	items: unknown;
	subtotal: string;
	taxTotal: string;
	total: string;
	amountPaid: string;
	status: string;
	chequeNumber: string | null;
	receiptNumber: string | null;
	datePaid: string | null;
	issuedDate: string | null;
	dueDate: string | null;
	notes: string | null;
	createdAt: string;
	discountType?: string | null;
	discountValue?: string | null;
	taxMode?: string | null;
	taxRate?: string | null;
	paymentTerms?: string | null;
	preparedBy?: string | null;
	brand?: string | null;
};

interface RecordPaymentForm {
	amount: string;
	paymentMethod: string;
	referenceNumber: string;
	datePaid: string;
	notes: string;
}

const emptyRecordPaymentForm: RecordPaymentForm = {
	amount: "",
	paymentMethod: "cash",
	referenceNumber: "",
	datePaid: todayGY(),
	notes: "",
};

const STATUS_FILTERS = ["All", "Draft", "Sent", "Outstanding", "Overdue", "Paid", "Overpaid", "Cancelled"] as const;

export default function InvoicesPage() {
	const { data: session } = authClient.useSession();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<InvoiceForm>(emptyForm);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
	const [paymentForm, setPaymentForm] = useState({
		amountPaid: "",
		chequeNumber: "",
		receiptNumber: "",
		datePaid: todayGY(),
		chequeDepositDate: "",
	});
	const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
	const [recordPaymentInvoiceId, setRecordPaymentInvoiceId] = useState<
		string | null
	>(null);
	const [recordPaymentForm, setRecordPaymentForm] = useState<RecordPaymentForm>(
		emptyRecordPaymentForm,
	);
	const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

	const { data: userProfile } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);

	const userPerms =
		(userProfile as { permissions?: Record<string, string[]> })?.permissions ??
		{};
	const canCreate = userPerms.invoices?.includes("create") ?? false;
	const canUpdate = userPerms.invoices?.includes("update") ?? false;
	const canDelete = userPerms.invoices?.includes("delete") ?? false;

	const { data: raw = { invoices: [], total: 0 } } = useQuery(
		orpc.invoices.list.queryOptions({
			input: {
				search: search || undefined,
				status: statusFilter || undefined,
				limit: 50,
				offset: 0,
			},
		}),
	);
	const invoices = (raw as unknown as { invoices: InvoiceRow[]; total: number })
		.invoices;

	const createMut = useMutation(
		orpc.invoices.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.invoices.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Invoice created");
			},
			onError: (e) => toast.error(e.message || "Failed to create invoice"),
		}),
	);

	const updateMut = useMutation(
		orpc.invoices.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.invoices.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Invoice updated");
			},
			onError: (e) => toast.error(e.message || "Failed to update invoice"),
		}),
	);

	const deleteMut = useMutation(
		orpc.invoices.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.invoices.list.queryOptions({ input: {} }).queryKey,
				});
				setSelectedId(null);
				toast.success("Invoice cancelled");
			},
			onError: (e) => toast.error(e.message || "Failed to cancel invoice"),
		}),
	);

	const markPaidMut = useMutation(
		orpc.invoices.markPaid.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.invoices.list.queryOptions({ input: {} }).queryKey,
				});
				setPaymentForm({
					amountPaid: "",
					chequeNumber: "",
					receiptNumber: "",
					datePaid: todayGY(),
					chequeDepositDate: "",
				});
				toast.success("Payment recorded");
			},
			onError: (e) => toast.error(e.message || "Failed to record payment"),
		}),
	);

	const { data: docSettings } = useQuery(
		orpc.settings.getDocumentSettings.queryOptions({ input: {} }),
	);

	const { data: summaryRaw, isLoading: loadingSummary } = useQuery(
		orpc.invoices.getSummary.queryOptions({ input: {} }),
	);
	const s = (summaryRaw as Record<string, unknown>) ?? {};

	const markSentMut = useMutation(
		orpc.invoices.markSent.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.invoices.list.queryOptions({ input: {} }).queryKey,
				});
				toast.success("Invoice marked as sent");
			},
			onError: () => toast.error("Failed to mark as sent"),
		}),
	);

	const recordPaymentMut = useMutation(
		orpc.invoices.recordPayment.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.invoices.list.queryOptions({ input: {} }).queryKey,
				});
				setRecordPaymentDialogOpen(false);
				setRecordPaymentInvoiceId(null);
				setRecordPaymentForm(emptyRecordPaymentForm);
				toast.success("Payment recorded");
			},
			onError: (e) => toast.error(e.message || "Failed to record payment"),
		}),
	);

	const duplicateMut = useMutation(
		orpc.invoices.duplicate.mutationOptions({
			onSuccess: (newInv) => {
				queryClient.invalidateQueries({
					queryKey: orpc.invoices.list.queryOptions({ input: {} }).queryKey,
				});
				setSelectedId((newInv as { id: string }).id);
				toast.success("Invoice duplicated");
			},
			onError: () => toast.error("Failed to duplicate"),
		}),
	);

	const { data: paymentHistoryRaw, isLoading: loadingHistory } = useQuery({
		...orpc.invoices.getPaymentHistory.queryOptions({
			input: {
				invoiceId: historyOpenId ?? "00000000-0000-0000-0000-000000000000",
			},
		}),
		enabled: !!historyOpenId,
	});
	const paymentHistory = Array.isArray(paymentHistoryRaw)
		? paymentHistoryRaw
		: [];

	function openRecordPayment(inv: InvoiceRow, e: React.MouseEvent) {
		e.stopPropagation();
		setRecordPaymentInvoiceId(inv.id);
		const remaining = Number(inv.total) - Number(inv.amountPaid);
		setRecordPaymentForm({
			...emptyRecordPaymentForm,
			amount: remaining > 0 ? String(remaining) : "",
		});
		setRecordPaymentDialogOpen(true);
	}

	function handleRecordPayment() {
		if (!recordPaymentInvoiceId || !recordPaymentForm.amount) return;
		recordPaymentMut.mutate({
			invoiceId: recordPaymentInvoiceId,
			amount: Number(recordPaymentForm.amount),
			paymentMethod: recordPaymentForm.paymentMethod,
			referenceNumber: recordPaymentForm.referenceNumber || undefined,
			datePaid: recordPaymentForm.datePaid,
			notes: recordPaymentForm.notes || undefined,
		});
	}

	function handleSendReminder(inv: InvoiceRow) {
		const balance = Number(inv.total) - Number(inv.amountPaid);
		const isOverdue =
			inv.dueDate &&
			new Date(inv.dueDate) < new Date() &&
			!["paid", "cancelled"].includes(inv.status);
		const text = `Dear ${inv.customerName}, your invoice ${inv.invoiceNumber} for GYD ${balance.toLocaleString("en-GY", { maximumFractionDigits: 0 })} is ${isOverdue ? "overdue" : "due"}. Please contact Bettencourt's Diner to arrange payment.`;
		navigator.clipboard.writeText(text).then(() => {
			toast.success("Reminder text copied to clipboard");
		});
	}

	function openCreate() {
		setEditingId(null);
		setForm({
			...emptyForm,
			taxRate: String(docSettings?.defaultTaxRate ?? "14"),
			taxMode: (docSettings?.defaultTaxMode as "invoice" | "line" | "incl") ?? "incl",
			discountType:
				(docSettings?.defaultDiscountType as "percent" | "fixed") ?? "percent",
			paymentTerms: docSettings?.defaultPaymentTerms ?? "due_on_receipt",
		});
		setDialogOpen(true);
	}

	function openEdit(inv: InvoiceRow) {
		setEditingId(inv.id);
		setForm({
			customerType: (inv as { agencyName?: string | null }).agencyName ? "agency" : "individual",
			customerName: inv.customerName,
			customerAddress: inv.customerAddress ?? "",
			customerPhone: inv.customerPhone ?? "",
			customerId: (inv as {customerId?: string | null}).customerId ?? "",
			agencyName: (inv as { agencyName?: string | null }).agencyName ?? "",
			contactPersonName: (inv as { contactPersonName?: string | null }).contactPersonName ?? "",
			contactPersonPosition: (inv as { contactPersonPosition?: string | null }).contactPersonPosition ?? "",
			department: (inv as { department?: string | null }).department ?? "",
			issuedDate: inv.issuedDate ? (inv.issuedDate.split("T")[0] ?? "") : "",
			dueDate: inv.dueDate ? (inv.dueDate.split("T")[0] ?? "") : "",
			notes: inv.notes ?? "",
			items: Array.isArray(inv.items)
				? (inv.items as LineItem[])
				: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
			discountType: (inv.discountType as "percent" | "fixed") ?? "percent",
			discountValue: inv.discountValue ?? "0",
			taxMode: (inv.taxMode as "invoice" | "line" | "incl") ?? "invoice",
			customInvoiceNumber: inv.invoiceNumber,
			taxRate: inv.taxRate ?? "14",
			paymentTerms: inv.paymentTerms ?? "due_on_receipt",
			preparedBy: inv.preparedBy ?? "",
			brand: ((inv as { brand?: string | null }).brand === "home_style" ? "home_style" : "foods_inc"),
		noteMode: (inv.notes && !PREDEFINED_NOTES_INV.includes(inv.notes) ? "custom" : "preset"),
		});
		setDialogOpen(true);
	}

	function updateItem(
		index: number,
		field: keyof LineItem,
		value: string | number,
	) {
		setForm((f) => {
			const items = [...f.items];
			const item = { ...items[index]! };
			(item as Record<string, unknown>)[field] = value;
			if (field === "quantity" || field === "unitPrice") {
				item.total = Number(item.quantity) * Number(item.unitPrice);
			}
			items[index] = item;
			return { ...f, items };
		});
	}

	function addItem() {
		setForm((f) => ({
			...f,
			items: [
				...f.items,
				{ description: "", quantity: 1, unitPrice: 0, total: 0 },
			],
		}));
	}

	function removeItem(index: number) {
		setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
	}

	function handleSave() {
		const subtotal = form.items.reduce((s, i) => s + i.total, 0);
		const discountAmt =
			form.discountType === "percent"
				? (subtotal * Number(form.discountValue || 0)) / 100
				: Number(form.discountValue || 0);
		const taxableBase = subtotal - discountAmt;
		const rate = Number(form.taxRate || 0);
		const taxAmt = form.taxMode === "incl"
			? taxableBase * (rate / (100 + rate))
			: taxableBase * (rate / 100);
		const total = form.taxMode === "incl" ? taxableBase : taxableBase + taxAmt;
		const userId = session?.user?.id ?? "";

		const sharedFields = {
			customerName: form.customerName,
			customerAddress: form.customerAddress || undefined,
			customerPhone: form.customerPhone || undefined,
			customerId: form.customerId || undefined,
			agencyName: form.agencyName || undefined,
			contactPersonName: form.contactPersonName || undefined,
			contactPersonPosition: form.contactPersonPosition || undefined,
			department: form.department || undefined,
			issuedDate: form.issuedDate || undefined,
			dueDate: form.dueDate || undefined,
			notes: form.notes || undefined,
			items: form.items,
			subtotal: String(subtotal),
			taxTotal: String(taxAmt),
			total: String(total),
			discountType: form.discountType,
			discountValue: form.discountValue,
			taxMode: form.taxMode,
			taxRate: form.taxRate,
			paymentTerms: form.paymentTerms,
			preparedBy: form.preparedBy || undefined,
			brand: form.brand,
		};

		if (editingId) {
			updateMut.mutate({ id: editingId, ...sharedFields });
		} else {
			createMut.mutate({
				...sharedFields,
				createdBy: userId,
				invoiceNumber: form.customInvoiceNumber.trim() || undefined,
			});
		}
	}

	function handleMarkPaid() {
		if (!selectedId || !paymentForm.amountPaid) return;
		markPaidMut.mutate({
			id: selectedId,
			amountPaid: paymentForm.amountPaid,
			chequeNumber: paymentForm.chequeNumber || undefined,
			receiptNumber: paymentForm.receiptNumber || undefined,
			datePaid: paymentForm.datePaid || undefined,
			chequeDepositDate: paymentForm.chequeDepositDate || undefined,
		});
	}

	const selectedInvoice = invoices.find((inv) => inv.id === selectedId) ?? null;
	const subtotal = form.items.reduce((s, i) => s + i.total, 0);
	const formDiscountAmt =
		form.discountType === "percent"
			? (subtotal * Number(form.discountValue || 0)) / 100
			: Number(form.discountValue || 0);
	const formTaxableBase = subtotal - formDiscountAmt;
	const formRate = Number(form.taxRate || 0);
	const formTaxAmt = form.taxMode === "incl"
		? formTaxableBase * (formRate / (100 + formRate))
		: formTaxableBase * (formRate / 100);
	const formTotal = form.taxMode === "incl" ? formTaxableBase : formTaxableBase + formTaxAmt;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<Receipt className="size-6" />
						Invoices
					</h1>
					<p className="text-muted-foreground text-sm">
						Create and manage customer invoices
					</p>
				</div>
				{canCreate && (
					<Button onClick={openCreate} className="gap-2">
						<Plus className="size-4" />
						New Invoice
					</Button>
				)}
			</div>

			{/* Aging Summary Cards */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
				{loadingSummary ? (
					[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-20 rounded-lg" />
					))
				) : (
					<>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">Outstanding</p>
							<p className="mt-1 font-bold text-xl">
								{new Intl.NumberFormat("en-GY", {
									style: "currency",
									currency: "GYD",
									maximumFractionDigits: 0,
								}).format(Number(s.total_outstanding ?? 0))}
							</p>
						</Card>
						<Card
							className={`p-4 ${Number(s.total_overdue ?? 0) > 0 ? "border-destructive/50" : ""}`}
						>
							<p
								className={`text-xs ${Number(s.total_overdue ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}
							>
								Overdue
							</p>
							<p
								className={`mt-1 font-bold text-xl ${Number(s.total_overdue ?? 0) > 0 ? "text-destructive" : ""}`}
							>
								{new Intl.NumberFormat("en-GY", {
									style: "currency",
									currency: "GYD",
									maximumFractionDigits: 0,
								}).format(Number(s.total_overdue ?? 0))}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">Paid This Month</p>
							<p className="mt-1 font-bold text-emerald-600 text-xl">
								{new Intl.NumberFormat("en-GY", {
									style: "currency",
									currency: "GYD",
									maximumFractionDigits: 0,
								}).format(Number(s.paid_this_month ?? 0))}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">Drafts</p>
							<p className="mt-1 font-bold text-xl">
								{String(s.draft_count ?? 0)}
							</p>
						</Card>
					</>
				)}
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-3 print:hidden">
				<div className="relative min-w-48 flex-1">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search invoices..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
			</div>

			{/* Status filter chips */}
			<div className="flex flex-wrap gap-2 print:hidden">
				{STATUS_FILTERS.map((s) => {
					const value = s === "All" ? "" : s.toLowerCase().replace(" ", "_");
					const active = statusFilter === value;
					return (
						<button
							key={s}
							type="button"
							onClick={() => setStatusFilter(value)}
							className={`rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary/60 hover:bg-primary/5 ${
								active
									? "border-primary bg-primary/10 font-medium text-primary"
									: "border-border text-muted-foreground"
							}`}
						>
							{s}
						</button>
					);
				})}
			</div>

			{/* Grid: table + detail */}
			<div className="grid gap-4 lg:grid-cols-3 print:grid-cols-1">
				<div className="lg:col-span-2 print:hidden">
					<Card>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-xs">Invoice #</TableHead>
									<TableHead className="text-xs">Customer</TableHead>
									<TableHead className="text-xs">Items</TableHead>
									<TableHead className="text-right text-xs">Total</TableHead>
									<TableHead className="text-right text-xs">Balance Due</TableHead>
									<TableHead className="text-xs">Status</TableHead>
									<TableHead className="text-xs">Due</TableHead>
									<TableHead className="text-xs">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{invoices.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="py-10 text-center text-muted-foreground text-sm"
										>
											<Receipt className="mx-auto mb-2 size-8 opacity-30" />
											No invoices yet
										</TableCell>
									</TableRow>
								) : (
									invoices.map((inv) => (
										<TableRow
											key={inv.id}
											className={`cursor-pointer ${selectedId === inv.id ? "bg-muted/50" : ""}`}
											onClick={() =>
												setSelectedId(inv.id === selectedId ? null : inv.id)
											}
										>
											<TableCell className="font-mono font-semibold text-xs">
												{inv.invoiceNumber}
											</TableCell>
											<TableCell className="font-medium text-xs">
												{inv.customerName}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{Array.isArray(inv.items) ? inv.items.length : 0} items
											</TableCell>
											<TableCell className="text-right font-semibold text-sm">
												{formatGYD(Number(inv.total))}
											</TableCell>
											<TableCell className="text-right text-sm">
												{(() => {
													const balance = Number(inv.total) - Number(inv.amountPaid);
													if (balance <= 0) return <span className="text-emerald-600 text-xs">Paid</span>;
													if (inv.status === "overdue") return <span className="font-mono font-semibold text-destructive text-xs">{formatGYD(balance)}</span>;
													return <span className="font-mono text-xs">{formatGYD(balance)}</span>;
												})()}
											</TableCell>
											<TableCell>
												<div className="flex flex-col gap-0.5">
													<Badge
														className={`text-[10px] ${statusBadgeClass(inv.status)}`}
													>
														{inv.status}
													</Badge>
													{inv.dueDate &&
														new Date(inv.dueDate) < new Date() &&
														!["paid", "cancelled"].includes(inv.status) && (
															<Badge className="bg-red-100 text-[9px] text-red-800">
																OVERDUE
															</Badge>
														)}
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{inv.dueDate
													? new Date(inv.dueDate).toLocaleDateString("en-GY")
													: "—"}
											</TableCell>
											<TableCell>
												<div className="flex gap-1">
													{canUpdate && (
														<Button
															variant="ghost"
															size="icon"
															className="size-7"
															title="Edit invoice"
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																openEdit(inv);
															}}
														>
															<Edit2 className="size-3" />
														</Button>
													)}
													{canUpdate &&
														!["paid", "cancelled"].includes(inv.status) && (
															<Button
																variant="ghost"
																size="icon"
																className="size-7 text-emerald-600"
																title="Record payment"
																type="button"
																onClick={(e) => openRecordPayment(inv, e)}
															>
																<CreditCard className="size-3" />
															</Button>
														)}
													<DropdownMenu>
														<DropdownMenuTrigger
															className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
															type="button"
															onClick={(e) => e.stopPropagation()}
														>
															<MoreHorizontal className="size-4" />
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" className="w-48">
															{inv.status === "draft" && (
																<DropdownMenuItem
																	onClick={(e) => {
																		e.stopPropagation();
																		updateMut.mutate({ id: inv.id, status: "sent" });
																	}}
																>
																	<Send className="mr-2 size-3.5" />
																	Mark Sent
																</DropdownMenuItem>
															)}
															<DropdownMenuItem
																onClick={(e) => {
																	e.stopPropagation();
																	setForm({
																		customerType: inv.agencyName ? "agency" : "individual",
																		customerName: inv.customerName,
																		customerAddress: inv.customerAddress ?? "",
																		customerPhone: inv.customerPhone ?? "",
																		customerId: inv.customerId ?? "",
																		agencyName: inv.agencyName ?? "",
																		contactPersonName: inv.contactPersonName ?? "",
																		contactPersonPosition: inv.contactPersonPosition ?? "",
																		issuedDate: todayGY(),
																		dueDate: "",
																		notes: inv.notes ?? "",
																		items: (inv.items as LineItem[]) ?? [],
																		discountType: (inv.discountType as "percent" | "fixed") ?? "percent",
																		discountValue: inv.discountValue ?? "0",
																		taxMode: (inv.taxMode as "invoice" | "line" | "incl") ?? "invoice",
																		taxRate: inv.taxRate ?? "14",
																		paymentTerms: inv.paymentTerms ?? "due_on_receipt",
																		preparedBy: inv.preparedBy ?? "",
																		customInvoiceNumber: "",
																		department: (inv as InvoiceRow & { department?: string | null }).department ?? "",
																		brand: ((inv as { brand?: string | null }).brand === "home_style" ? "home_style" : "foods_inc"),
																	});
																	setEditingId(null);
																	setDialogOpen(true);
																}}
															>
																<Copy className="mr-2 size-3.5" />
																Duplicate Invoice
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={async (e) => {
																	e.stopPropagation();
																	const r = await openInvoicePdf(inv, (docSettings ?? {}) as DocSettings);
																	if (r === "popup_blocked") toast.error("Allow popups to open the PDF");
																}}
															>
																<Printer className="mr-2 size-3.5" />
																Print / Save PDF
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={(e) => {
																	e.stopPropagation();
																	handleSendReminder(inv);
																}}
															>
																<Bell className="mr-2 size-3.5" />
																Copy Reminder
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															{!["cancelled", "paid"].includes(inv.status) && canDelete && (
																<DropdownMenuItem
																	className="text-destructive focus:text-destructive"
																	onClick={(e) => {
																		e.stopPropagation();
																		deleteMut.mutate({ id: inv.id });
																	}}
																>
																	<Trash2 className="mr-2 size-3.5" />
																	Cancel Invoice
																</DropdownMenuItem>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</Card>
				</div>

				{/* Detail Panel */}
				<div className="flex flex-col gap-3">
					{selectedInvoice ? (
						<>
							{/* Invoice detail */}
							<Card>
								<CardHeader className="pb-3 print:hidden">
									<CardTitle className="flex items-center justify-between text-base">
										<span>{selectedInvoice.invoiceNumber}</span>
										<div className="flex items-center gap-2">
											<Badge
												className={`text-[10px] ${statusBadgeClass(selectedInvoice.status)}`}
											>
												{selectedInvoice.status}
											</Badge>
											<Button
												variant="outline"
												size="sm"
												onClick={async () => {
													const r = await openInvoicePdf(selectedInvoice, docSettings ?? {});
													if (r === "popup_blocked") toast.error("Allow popups to open the PDF");
												}}
												className="no-print gap-1.5"
											>
												<Printer className="size-4" />
												Print / Save PDF
											</Button>
										</div>
									</CardTitle>
								</CardHeader>
								<CardContent className="flex flex-col gap-3 text-sm">
									<div className="flex gap-6 text-muted-foreground text-xs">
										<span>
											Issued:{" "}
											<span className="font-medium text-foreground">
												{selectedInvoice.issuedDate
													? new Date(
															selectedInvoice.issuedDate,
														).toLocaleDateString("en-GY")
													: new Date(
															selectedInvoice.createdAt,
														).toLocaleDateString("en-GY")}
											</span>
										</span>
										{selectedInvoice.dueDate && (
											<span>
												Due:{" "}
												<span className="font-medium text-foreground">
													{new Date(selectedInvoice.dueDate).toLocaleDateString(
														"en-GY",
													)}
												</span>
											</span>
										)}
									</div>
									{((selectedInvoice as unknown as {agencyName?: string | null}).agencyName ||
										(selectedInvoice as unknown as {contactPersonName?: string | null}).contactPersonName) && (
										<div className="mb-2 flex flex-wrap gap-4 rounded-md bg-muted/40 px-3 py-2 text-xs">
											{(selectedInvoice as unknown as {agencyName?: string | null}).agencyName && (
												<span><span className="text-muted-foreground">Agency: </span><span className="font-medium">{(selectedInvoice as unknown as {agencyName?: string}).agencyName}</span></span>
											)}
											{(selectedInvoice as unknown as {contactPersonName?: string | null}).contactPersonName && (
												<span><span className="text-muted-foreground">Order By: </span><span className="font-medium">{(selectedInvoice as unknown as {contactPersonName?: string}).contactPersonName}</span>{(selectedInvoice as unknown as {contactPersonPosition?: string | null}).contactPersonPosition && <span className="text-muted-foreground ml-1">({(selectedInvoice as unknown as {contactPersonPosition?: string}).contactPersonPosition})</span>}</span>
											)}
										</div>
									)}
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="text-xs">Description</TableHead>
												<TableHead className="text-right text-xs">
													Qty
												</TableHead>
												<TableHead className="text-right text-xs">
													Price
												</TableHead>
												<TableHead className="text-right text-xs">
													Total
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{(Array.isArray(selectedInvoice.items)
												? (selectedInvoice.items as LineItem[])
												: []
											).map((item, i) => (
												<TableRow key={i}>
													<TableCell className="text-xs">
														{item.description}
													</TableCell>
													<TableCell className="text-right text-xs">
														{item.quantity}
													</TableCell>
													<TableCell className="text-right text-xs">
														{formatGYD(item.unitPrice)}
													</TableCell>
													<TableCell className="text-right text-xs">
														{formatGYD(item.total)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
									<div className="flex justify-between border-t pt-2 font-semibold">
										<span>Total</span>
										<span>{formatGYD(Number(selectedInvoice.total))}</span>
									</div>
									{Number(selectedInvoice.amountPaid) > 0 && (
										<div className="flex justify-between text-muted-foreground text-sm">
											<span>Paid</span>
											<span>
												{formatGYD(Number(selectedInvoice.amountPaid))}
											</span>
										</div>
									)}
									{selectedInvoice.chequeNumber && (
										<p className="text-muted-foreground text-xs">
											Cheque: {selectedInvoice.chequeNumber}
										</p>
									)}
									{selectedInvoice.receiptNumber && (
										<p className="text-muted-foreground text-xs">
											Receipt: {selectedInvoice.receiptNumber}
										</p>
									)}
									{selectedInvoice.notes && (
										<p className="text-muted-foreground text-xs italic">
											{selectedInvoice.notes}
										</p>
									)}
									<div className="no-print flex flex-col gap-2">
										{canUpdate && (
											<Button
												size="sm"
												variant="outline"
												className="w-full gap-1"
												onClick={() => openEdit(selectedInvoice)}
											>
												<Edit2 className="size-3" />
												Edit Invoice
											</Button>
										)}
										{canUpdate && selectedInvoice.status === "draft" && (
											<Button
												size="sm"
												variant="outline"
												className="w-full gap-1"
												disabled={markSentMut.isPending}
												onClick={() =>
													markSentMut.mutate({ id: selectedInvoice.id })
												}
											>
												<Send className="size-3" />
												Mark as Sent
											</Button>
										)}
										{canCreate && (
											<Button
												size="sm"
												variant="outline"
												className="w-full gap-1"
												disabled={duplicateMut.isPending}
												onClick={() =>
													duplicateMut.mutate({
														id: selectedInvoice.id,
														createdBy: session?.user?.id ?? "",
													})
												}
											>
												<Copy className="size-3" />
												Duplicate
											</Button>
										)}
										{canCreate &&
											["paid", "outstanding", "overpaid"].includes(
												selectedInvoice.status,
											) && (
												<Button
													size="sm"
													variant="outline"
													className="w-full gap-1"
													onClick={() =>
														navigate(
															`/dashboard/credit-notes?invoiceId=${selectedInvoice.id}&customerName=${encodeURIComponent(selectedInvoice.customerName)}`,
														)
													}
												>
													<FileMinus className="size-3" />
													Create Credit Note
												</Button>
											)}
										<Button
											size="sm"
											variant="outline"
											className="w-full gap-1"
											onClick={() => handleSendReminder(selectedInvoice)}
										>
											<Bell className="size-3" />
											Send Reminder
										</Button>
									</div>
								</CardContent>
							</Card>

							{/* Payment panel */}
							{canUpdate &&
								!["paid", "cancelled"].includes(selectedInvoice.status) && (
									<Card className="no-print">
										<CardHeader className="pb-2">
											<CardTitle className="flex items-center gap-2 text-sm">
												<CreditCard className="size-4" />
												Record Payment
											</CardTitle>
										</CardHeader>
										<CardContent className="flex flex-col gap-3">
											<div className="flex flex-col gap-1">
												<Label className="text-xs">Amount Paid (GYD)</Label>
												<Input
													type="number"
													inputMode="decimal"
													placeholder={String(
														Number(selectedInvoice.total) -
															Number(selectedInvoice.amountPaid),
													)}
													value={paymentForm.amountPaid}
													onChange={(e) =>
														setPaymentForm((f) => ({
															...f,
															amountPaid: e.target.value,
														}))
													}
												/>
											</div>
											<div className="flex flex-col gap-1">
												<Label className="text-xs">Cheque Number</Label>
												<Input
													placeholder="Optional"
													value={paymentForm.chequeNumber}
													onChange={(e) =>
														setPaymentForm((f) => ({
															...f,
															chequeNumber: e.target.value,
														}))
													}
												/>
											</div>
											<div className="flex flex-col gap-1">
												<Label className="text-xs">Receipt Number</Label>
												<Input
													placeholder="Optional"
													value={paymentForm.receiptNumber}
													onChange={(e) =>
														setPaymentForm((f) => ({
															...f,
															receiptNumber: e.target.value,
														}))
													}
												/>
											</div>
											<div className="grid grid-cols-2 gap-2">
												<div className="flex flex-col gap-1">
													<Label className="text-xs">Date Paid</Label>
													<Input
														type="date"
														value={paymentForm.datePaid}
														onChange={(e) =>
															setPaymentForm((f) => ({
																...f,
																datePaid: e.target.value,
															}))
														}
													/>
												</div>
												<div className="flex flex-col gap-1">
													<Label className="text-xs">Cheque Deposit</Label>
													<Input
														type="date"
														value={paymentForm.chequeDepositDate}
														onChange={(e) =>
															setPaymentForm((f) => ({
																...f,
																chequeDepositDate: e.target.value,
															}))
														}
													/>
												</div>
											</div>
											<Button
												size="sm"
												onClick={handleMarkPaid}
												disabled={
													!paymentForm.amountPaid || markPaidMut.isPending
												}
												className="gap-1"
											>
												<CreditCard className="size-3" />
												{markPaidMut.isPending ? "Saving..." : "Record Payment"}
											</Button>
										</CardContent>
									</Card>
								)}

							{/* Payment History */}
							<Card className="no-print">
								<Collapsible
									open={historyOpenId === selectedInvoice.id}
									onOpenChange={(open) => {
										setHistoryOpenId(open ? selectedInvoice.id : null);
									}}
								>
									<CollapsibleTrigger asChild>
										<button
											type="button"
											className="flex w-full items-center justify-between p-3 font-medium text-sm hover:bg-muted/50"
										>
											<span className="flex items-center gap-2">
												<CreditCard className="size-4" />
												Payment History
											</span>
											{historyOpenId === selectedInvoice.id ? (
												<ChevronDown className="size-4 text-muted-foreground" />
											) : (
												<ChevronRight className="size-4 text-muted-foreground" />
											)}
										</button>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className="px-3 pb-3">
											{loadingHistory ? (
												<Skeleton className="h-20 rounded" />
											) : paymentHistory.length === 0 ? (
												<p className="py-4 text-center text-muted-foreground text-xs">
													No payments recorded
												</p>
											) : (
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead className="text-xs">Date</TableHead>
															<TableHead className="text-right text-xs">
																Amount
															</TableHead>
															<TableHead className="text-xs">Method</TableHead>
															<TableHead className="text-xs">
																Reference
															</TableHead>
															<TableHead className="text-xs">
																Reversal
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{(
															paymentHistory as unknown as Array<{
																id: string;
																datePaid: Date | string;
																amount: string;
																paymentMethod: string;
																referenceNumber: string | null;
																isReversal: boolean;
															}>
														).map((pmt) => (
															<TableRow
																key={pmt.id}
																className={pmt.isReversal ? "opacity-60" : ""}
															>
																<TableCell className="text-xs">
																	{new Date(pmt.datePaid).toLocaleDateString(
																		"en-GY",
																	)}
																</TableCell>
																<TableCell
																	className={`text-right font-mono text-xs ${pmt.isReversal ? "text-destructive" : ""}`}
																>
																	{formatGYD(Number(pmt.amount))}
																</TableCell>
																<TableCell className="text-xs capitalize">
																	{pmt.paymentMethod.replace(/_/g, " ")}
																</TableCell>
																<TableCell className="text-muted-foreground text-xs">
																	{pmt.referenceNumber ?? "\u2014"}
																</TableCell>
																<TableCell className="text-xs">
																	{pmt.isReversal ? (
																		<Badge className="bg-red-100 text-[9px] text-red-800">
																			Reversed
																		</Badge>
																	) : (
																		"\u2014"
																	)}
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											)}
										</div>
									</CollapsibleContent>
								</Collapsible>
							</Card>
						</>
					) : (
						<Card>
							<CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Receipt className="size-10 opacity-30" />
								<p className="text-sm">Select an invoice to view details</p>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

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
							{editingId ? "Edit Invoice" : "New Invoice"}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="grid grid-cols-2 gap-3">
							<div className="col-span-2 flex flex-col gap-1.5">
								<Label>
									Invoice Number
									{!editingId && (
										<span className="ml-1 font-normal text-muted-foreground text-xs">
											(blank = auto-generate)
										</span>
									)}
								</Label>
								<Input
									placeholder={editingId ? "" : "e.g. BET-001 or 2026/001"}
									value={form.customInvoiceNumber}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											customInvoiceNumber: e.target.value,
										}))
									}
								/>
							</div>
						</div>

						{/* Document Header */}
						<div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
							<Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</Label>
							<div className="flex gap-2">
								<button
									type="button"
									className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.brand === "foods_inc" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
									onClick={() => setForm((f) => ({ ...f, brand: "foods_inc" }))}
								>
									Bettencourt's Food Inc.
								</button>
								<button
									type="button"
									className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.brand === "home_style" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
									onClick={() => setForm((f) => ({ ...f, brand: "home_style" }))}
								>
									Bettencourt's Home Style
								</button>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="flex flex-col gap-1.5">
									<Label className="text-xs">Prepared By</Label>
									<Input
										placeholder="Your name"
										value={form.preparedBy}
										onChange={(e) => setForm((f) => ({ ...f, preparedBy: e.target.value }))}
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<Label className="text-xs">Department (optional)</Label>
									<Input
										placeholder="e.g. Kitchen, Catering, Admin"
										value={form.department}
										onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
									/>
								</div>
							</div>
						</div>

						{/* Customer / Agency Section */}
						<div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
							{/* Toggle */}
							<div className="flex items-center justify-between">
								<Label className="text-xs font-medium">Bill To</Label>
								<div className="flex overflow-hidden rounded border text-xs">
									<button
										type="button"
										className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${form.customerType === "individual" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
										onClick={() => setForm(f => ({ ...f, customerType: "individual", agencyName: "" }))}
									>
										<User className="size-3" />
										Individual
									</button>
									<button
										type="button"
										className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${form.customerType === "agency" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
										onClick={() => setForm(f => ({ ...f, customerType: "agency" }))}
									>
										<Building2 className="size-3" />
										Agency / Ministry
									</button>
								</div>
							</div>

							{form.customerType === "individual" ? (
								<div className="grid grid-cols-2 gap-3">
									<div className="col-span-2 flex flex-col gap-1.5">
										<Label className="text-xs">Customer Name *</Label>
										<CustomerCombobox
											value={form.customerName}
											onChange={(name) => setForm(f => ({ ...f, customerName: name, customerId: "" }))}
											onSelect={(c: CustomerHit) => setForm(f => ({ ...f, customerName: c.name, customerPhone: c.phone ?? f.customerPhone, customerId: c.id }))}
										/>
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Phone</Label>
										<Input placeholder="Phone number" value={form.customerPhone} onChange={(e) => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Issued Date</Label>
										<Input type="date" value={form.issuedDate} onChange={(e) => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Due Date</Label>
										<Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
									</div>
									<div className="col-span-2 flex flex-col gap-1.5">
										<Label className="text-xs">Address</Label>
										<Input placeholder="Customer address" value={form.customerAddress} onChange={(e) => setForm(f => ({ ...f, customerAddress: e.target.value }))} />
									</div>
								</div>
							) : (
								<div className="grid grid-cols-2 gap-3">
									<div className="col-span-2 flex flex-col gap-1.5">
										<Label className="text-xs">Agency / Ministry Name *</Label>
										<Input placeholder="e.g. Ministry of Home Affairs" value={form.agencyName} onChange={(e) => setForm(f => ({ ...f, agencyName: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Supervisor Name</Label>
										<Input placeholder="e.g. John Smith" value={form.customerName} onChange={(e) => setForm(f => ({ ...f, customerName: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Position / Title</Label>
										<Input placeholder="e.g. Permanent Secretary" value={form.contactPersonPosition} onChange={(e) => setForm(f => ({ ...f, contactPersonPosition: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Order Placed By</Label>
										<Input placeholder="Name of person who called" value={form.contactPersonName} onChange={(e) => setForm(f => ({ ...f, contactPersonName: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Phone</Label>
										<Input placeholder="Phone number" value={form.customerPhone} onChange={(e) => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
									</div>
									<div className="col-span-2 flex flex-col gap-1.5">
										<Label className="text-xs">Address</Label>
										<Input placeholder="Agency address" value={form.customerAddress} onChange={(e) => setForm(f => ({ ...f, customerAddress: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Issued Date</Label>
										<Input type="date" value={form.issuedDate} onChange={(e) => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs">Due Date</Label>
										<Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
									</div>
								</div>
							)}
						</div>

						{/* Line Items */}
						<div className="flex flex-col gap-2">
							<Label>Line Items</Label>
							<div className="overflow-hidden rounded-md border border-border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="text-xs">Description</TableHead>
											<TableHead className="w-16 text-xs">Qty</TableHead>
											<TableHead className="w-28 text-xs">Unit Price</TableHead>
											<TableHead className="w-24 text-right text-xs">
												Total
											</TableHead>
											<TableHead className="w-8" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{form.items.map((item, i) => (
											<TableRow key={i}>
												<TableCell className="p-1">
													<ProductCombobox
														className="h-8"
														value={item.description}
														onChange={(desc) => updateItem(i, "description", desc)}
														onSelect={(product) => {
															updateItem(i, "description", product.name);
															updateItem(i, "unitPrice", Number(product.price));
														}}
														placeholder="Description or search product..."
													/>
												</TableCell>
												<TableCell className="p-1">
													<Input
														className="h-8 text-xs"
														type="number"
														min={1}
														value={item.quantity}
														onChange={(e) =>
															updateItem(i, "quantity", Number(e.target.value))
														}
													/>
												</TableCell>
												<TableCell className="p-1">
													<Input
														className="h-8 text-xs"
														type="number"
														min={0}
														step="0.01"
														value={item.unitPrice}
														onChange={(e) =>
															updateItem(i, "unitPrice", Number(e.target.value))
														}
													/>
												</TableCell>
												<TableCell className="p-1 text-right font-medium text-xs">
													{formatGYD(item.total)}
												</TableCell>
												<TableCell className="p-1">
													<Button
														variant="ghost"
														size="icon"
														className="size-7"
														type="button"
														onClick={() => removeItem(i)}
													>
														<X className="size-3" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="gap-1 self-start"
								type="button"
								onClick={addItem}
							>
								<Plus className="size-3" />
								Add Item
							</Button>
						</div>

						{/* Tax/Discount Settings */}
						<div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2 text-sm">
							<Collapsible open={taxSettingsOpen} onOpenChange={setTaxSettingsOpen}>
								<CollapsibleTrigger asChild>
									<button
										type="button"
										className="flex w-full items-center gap-2 text-left text-xs hover:text-foreground transition-colors"
									>
										<span className="font-medium text-foreground">VAT: {parseFloat(String(form.taxRate))}% · {form.taxMode === "incl" ? "Incl." : "Excl."}</span>
										<ChevronDown className={`ml-auto size-3 transition-transform ${taxSettingsOpen ? "rotate-180" : ""}`} />
									</button>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<div className="flex items-center gap-1.5 pt-2">
										<span className="text-muted-foreground text-xs">VAT:</span>
										<Input
											className="h-7 w-16 text-xs"
											type="number"
											min="0"
											max="100"
											step="0.1"
											value={form.taxRate}
											onChange={(e) =>
												setForm((f) => ({ ...f, taxRate: e.target.value }))
											}
										/>
										<span className="text-xs">%</span>
										<div className="flex overflow-hidden rounded border text-xs">
											<button
												type="button"
												className={`px-2 py-1 transition-colors ${form.taxMode !== "incl" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
												onClick={() => setForm((f) => ({ ...f, taxMode: "invoice" }))}
											>
												Excl.
											</button>
											<button
												type="button"
												className={`px-2 py-1 transition-colors ${form.taxMode === "incl" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
												onClick={() => setForm((f) => ({ ...f, taxMode: "incl" }))}
											>
												Incl.
											</button>
										</div>
									</div>
								</CollapsibleContent>
							</Collapsible>
							<div className="flex flex-wrap items-center gap-3">
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground text-xs">Discount:</span>
								<Select
									value={form.discountType}
									onValueChange={(v) =>
										setForm((f) => ({
											...f,
											discountType: v as "percent" | "fixed",
										}))
									}
								>
									<SelectTrigger className="h-7 w-16 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="percent">%</SelectItem>
										<SelectItem value="fixed">GYD</SelectItem>
									</SelectContent>
								</Select>
								<Input
									className="h-7 w-20 text-xs"
									type="number"
									min="0"
									step="0.01"
									value={form.discountValue}
									onChange={(e) =>
										setForm((f) => ({ ...f, discountValue: e.target.value }))
									}
								/>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground text-xs">Terms:</span>
								<Select
									value={form.paymentTerms}
									onValueChange={(v) =>
										setForm((f) => ({ ...f, paymentTerms: v }))
									}
								>
									<SelectTrigger className="h-7 w-36 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="due_on_receipt">
											Due on Receipt
										</SelectItem>
										<SelectItem value="net_15">Net 15</SelectItem>
										<SelectItem value="net_30">Net 30</SelectItem>
										<SelectItem value="net_60">Net 60</SelectItem>
									</SelectContent>
								</Select>
							</div>
							</div>
						</div>

						{/* Totals */}
						<div className="flex flex-col gap-1 border-t pt-2 text-sm">
							<div className="flex justify-between text-muted-foreground">
								<span>Subtotal</span>
								<span className="font-mono">{formatGYD(subtotal)}</span>
							</div>
							{formDiscountAmt > 0 && (
								<div className="flex justify-between text-destructive">
									<span>
										Discount
										{form.discountType === "percent"
											? ` (${form.discountValue}%)`
											: ""}
									</span>
									<span className="font-mono">
										-{formatGYD(formDiscountAmt)}
									</span>
								</div>
							)}
							{formTaxAmt > 0 && (
								<div className="flex justify-between text-muted-foreground">
									<span>VAT {form.taxRate}%{form.taxMode === "incl" ? " (incl.)" : ""}</span>
									<span className="font-mono">{formatGYD(formTaxAmt)}</span>
								</div>
							)}
							<div className="flex justify-between font-bold">
								<span>Total</span>
								<span className="font-mono">{formatGYD(formTotal)}</span>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label>Notes</Label>
							<Select
								value={form.noteMode === "custom" ? "__custom__" : (form.notes || "__none__")}
								onValueChange={(v) => {
									if (v === "__custom__") {
										setForm((f) => ({ ...f, noteMode: "custom", notes: "" }));
									} else if (v === "__none__") {
										setForm((f) => ({ ...f, noteMode: "preset", notes: "" }));
									} else {
										setForm((f) => ({ ...f, noteMode: "preset", notes: v }));
									}
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a note..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__">No note</SelectItem>
									{PREDEFINED_NOTES_INV.map((n) => (
										<SelectItem key={n} value={n}>{n}</SelectItem>
									))}
									<SelectItem value="__custom__">Custom note...</SelectItem>
								</SelectContent>
							</Select>
							{form.noteMode === "custom" && (
								<Textarea
									placeholder="Write your custom note..."
									value={form.notes}
									onChange={(e) =>
										setForm((f) => ({ ...f, notes: e.target.value }))
									}
									className="h-16 resize-none"
								/>
							)}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={
								!form.customerName || createMut.isPending || updateMut.isPending
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

			{/* Record Payment Dialog */}
			<Dialog
				open={recordPaymentDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setRecordPaymentDialogOpen(false);
						setRecordPaymentInvoiceId(null);
					}
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Record Payment</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="flex flex-col gap-1.5">
							<Label>Amount (GYD) *</Label>
							<Input
								type="number"
								min="0"
								step="0.01"
								placeholder="0.00"
								value={recordPaymentForm.amount}
								onChange={(e) =>
									setRecordPaymentForm((f) => ({
										...f,
										amount: e.target.value,
									}))
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Payment Method *</Label>
							<Select
								value={recordPaymentForm.paymentMethod}
								onValueChange={(v) =>
									setRecordPaymentForm((f) => ({ ...f, paymentMethod: v }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="cash">Cash</SelectItem>
									<SelectItem value="cheque">Cheque</SelectItem>
									<SelectItem value="bank_transfer">Bank Transfer</SelectItem>
									<SelectItem value="mobile_money">Mobile Money</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Reference Number</Label>
							<Input
								placeholder="Optional"
								value={recordPaymentForm.referenceNumber}
								onChange={(e) =>
									setRecordPaymentForm((f) => ({
										...f,
										referenceNumber: e.target.value,
									}))
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Date Paid *</Label>
							<Input
								type="date"
								value={recordPaymentForm.datePaid}
								onChange={(e) =>
									setRecordPaymentForm((f) => ({
										...f,
										datePaid: e.target.value,
									}))
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>Notes</Label>
							<Textarea
								placeholder="Optional notes..."
								value={recordPaymentForm.notes}
								onChange={(e) =>
									setRecordPaymentForm((f) => ({ ...f, notes: e.target.value }))
								}
								className="h-16 resize-none"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setRecordPaymentDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleRecordPayment}
							disabled={
								!recordPaymentForm.amount ||
								!recordPaymentForm.datePaid ||
								recordPaymentMut.isPending
							}
						>
							{recordPaymentMut.isPending ? "Saving..." : "Record Payment"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
