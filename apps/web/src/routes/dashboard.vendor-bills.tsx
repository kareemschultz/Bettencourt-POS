import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronRight,
	CreditCard,
	Edit2,
	FileDown,
	FileWarning,
	MoreHorizontal,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
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
import { Card } from "@/components/ui/card";
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
import { SupplierCombobox } from "@/components/ui/supplier-combobox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { openVendorBillPdf } from "@/lib/pdf/vendor-bill-pdf";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

interface VendorBillRow {
	id: string;
	billNumber: string;
	supplierName: string;
	subtotal: string;
	taxTotal: string;
	total: string;
	amountPaid: string;
	status: string;
	issuedDate: string | null;
	dueDate: string | null;
	notes: string | null;
	items: unknown;
	department?: string | null;
}

interface PaymentHistoryRow {
	id: string;
	amount: string;
	paymentMethod: string;
	referenceNumber: string | null;
	datePaid: string;
	notes: string | null;
}

interface BillForm {
	supplierName: string;
	supplierId: string;
	billNumberRef: string;
	issuedDate: string;
	dueDate: string;
	items: LineItem[];
	applyTax: boolean;
	notes: string;
	department: string;
}

interface PaymentForm {
	amount: string;
	paymentMethod: string;
	referenceNumber: string;
	datePaid: string;
	notes: string;
}

const emptyBillForm: BillForm = {
	supplierName: "",
	supplierId: "",
	billNumberRef: "",
	issuedDate: "",
	dueDate: "",
	items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
	applyTax: false,
	notes: "",
	department: "",
};

const emptyPaymentForm: PaymentForm = {
	amount: "",
	paymentMethod: "Cash",
	referenceNumber: "",
	datePaid: todayGY(),
	notes: "",
};

const TAX_RATE = 16.5;
const PAYMENT_METHODS = [
	"Cash",
	"Cheque",
	"Bank Transfer",
	"Mobile Money",
] as const;
const STATUS_FILTERS = [
	"All",
	"Draft",
	"Received",
	"Partially Paid",
	"Paid",
	"Overdue",
	"Voided",
] as const;

// ── Payment History sub-row ──────────────────────────────────────────────────

function PaymentHistory({ billId }: { billId: string }) {
	const { data: raw = [], isLoading } = useQuery(
		orpc.vendorBills.getPaymentHistory.queryOptions({
			input: { vendorBillId: billId },
		}),
	);
	const payments = raw as unknown as PaymentHistoryRow[];

	if (isLoading) {
		return <Skeleton className="h-10 w-full" />;
	}
	if (payments.length === 0) {
		return (
			<p className="text-muted-foreground text-xs italic">
				No payments recorded
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-1">
			{payments.map((p) => (
				<div
					key={p.id}
					className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-xs"
				>
					<span className="text-muted-foreground">
						{new Date(p.datePaid).toLocaleDateString("en-GY")}
					</span>
					<span>{p.paymentMethod}</span>
					{p.referenceNumber && (
						<span className="font-mono text-muted-foreground">
							#{p.referenceNumber}
						</span>
					)}
					<span className="font-semibold text-emerald-600">
						{formatGYD(Number(p.amount))}
					</span>
				</div>
			))}
		</div>
	);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VendorBillsPage() {
	const queryClient = useQueryClient();

	const [statusFilter, setStatusFilter] = useState<string>("All");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [form, setForm] = useState<BillForm>(emptyBillForm);

	// Edit support
	const [editingId, setEditingId] = useState<string | null>(null);

	// Payment dialog
	const [payBill, setPayBill] = useState<VendorBillRow | null>(null);
	const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);

	// Void confirmation
	const [voidId, setVoidId] = useState<string | null>(null);

	// Expanded payment history rows
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

	// ── Queries ──────────────────────────────────────────────────────────────

	const { data: raw = { vendorBills: [], total: 0 }, isLoading } = useQuery(
		orpc.vendorBills.list.queryOptions({
			input: {
				status:
					statusFilter !== "All"
						? statusFilter.toLowerCase().replace(" ", "_")
						: undefined,
				limit: 100,
				offset: 0,
			},
		}),
	);
	const vendorBills =
		(raw as unknown as { items: VendorBillRow[]; total: number }).items ?? [];

	const { data: paidThisMonthData } = useQuery(
		orpc.vendorBills.getPaidThisMonth.queryOptions({ input: undefined }),
	);
	const paidThisMonth = Number(
		(paidThisMonthData as { total?: string } | undefined)?.total ?? 0,
	);

	// ── Mutations ────────────────────────────────────────────────────────────

	function invalidate() {
		queryClient.invalidateQueries({
			queryKey: orpc.vendorBills.list.queryOptions({ input: {} }).queryKey,
		});
	}

	const createMut = useMutation(
		orpc.vendorBills.create.mutationOptions({
			onSuccess: () => {
				invalidate();
				setDialogOpen(false);
				setForm(emptyBillForm);
				toast.success("Vendor bill created");
			},
			onError: (e) => toast.error(e.message || "Failed to create vendor bill"),
		}),
	);

	const updateMut = useMutation(
		orpc.vendorBills.update.mutationOptions({
			onSuccess: () => {
				invalidate();
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyBillForm);
				toast.success("Vendor bill updated");
			},
			onError: (e) => toast.error(e.message || "Failed to update vendor bill"),
		}),
	);

	const recordPaymentMut = useMutation(
		orpc.vendorBills.recordPayment.mutationOptions({
			onSuccess: () => {
				invalidate();
				if (payBill) {
					queryClient.invalidateQueries({
						queryKey: orpc.vendorBills.getPaymentHistory.queryOptions({
							input: { vendorBillId: payBill.id },
						}).queryKey,
					});
				}
				setPayBill(null);
				setPaymentForm(emptyPaymentForm);
				toast.success("Payment recorded");
			},
			onError: (e) => toast.error(e.message || "Failed to record payment"),
		}),
	);

	const voidMut = useMutation(
		orpc.vendorBills.void.mutationOptions({
			onSuccess: () => {
				invalidate();
				setVoidId(null);
				toast.success("Vendor bill voided");
			},
			onError: (e) => toast.error(e.message || "Failed to void vendor bill"),
		}),
	);

	// ── Line item helpers ────────────────────────────────────────────────────

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

	// ── Totals ───────────────────────────────────────────────────────────────

	const formSubtotal = form.items.reduce((s, i) => s + i.total, 0);
	const formTax = form.applyTax ? (TAX_RATE / 100) * formSubtotal : 0;
	const formTotal = formSubtotal + formTax;

	// ── Save handler ─────────────────────────────────────────────────────────

	function handleSave() {
		if (editingId) {
			updateMut.mutate({
				id: editingId,
				supplierName: form.supplierName,
				supplierId: form.supplierId || undefined,
				issuedDate: form.issuedDate || undefined,
				dueDate: form.dueDate || undefined,
				items: form.items,
				subtotal: String(formSubtotal),
				taxTotal: String(formTax),
				total: String(formTotal),
				notes: form.billNumberRef
					? `Ref: ${form.billNumberRef}${form.notes ? ` — ${form.notes}` : ""}`
					: form.notes || undefined,
				department: form.department || undefined,
			});
		} else {
			createMut.mutate({
				supplierName: form.supplierName,
				supplierId: form.supplierId || undefined,
				issuedDate: form.issuedDate || undefined,
				dueDate: form.dueDate || undefined,
				items: form.items,
				subtotal: String(formSubtotal),
				taxTotal: String(formTax),
				total: String(formTotal),
				notes: form.billNumberRef
					? `Ref: ${form.billNumberRef}${form.notes ? ` — ${form.notes}` : ""}`
					: form.notes || undefined,
				department: form.department || undefined,
			});
		}
	}

	// ── Pay handler ──────────────────────────────────────────────────────────

	function handleRecordPayment() {
		if (!payBill || !paymentForm.amount) return;
		recordPaymentMut.mutate({
			vendorBillId: payBill.id,
			amount: paymentForm.amount,
			paymentMethod: paymentForm.paymentMethod,
			referenceNumber: paymentForm.referenceNumber || undefined,
			datePaid: paymentForm.datePaid,
			notes: paymentForm.notes || undefined,
		});
	}

	// ── Summary numbers (computed inline from list) ───────────────────────────

	const totalBills = vendorBills.length;
	const totalOutstanding = vendorBills
		.filter((b) => !["paid", "voided"].includes(b.status))
		.reduce((s, b) => s + (Number(b.total) - Number(b.amountPaid)), 0);
	const totalOverdue = vendorBills
		.filter(
			(b) =>
				b.dueDate &&
				new Date(b.dueDate) < new Date() &&
				!["paid", "voided"].includes(b.status),
		)
		.reduce((s, b) => s + (Number(b.total) - Number(b.amountPaid)), 0);

	// ── Toggle row expansion ─────────────────────────────────────────────────

	function toggleExpand(id: string) {
		setExpandedRows((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	// ── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<FileWarning className="size-6" />
						Vendor Bills
					</h1>
					<p className="text-muted-foreground text-sm">
						Track and pay outstanding supplier bills
					</p>
				</div>
				<Button
					onClick={() => {
						setForm(emptyBillForm);
						setEditingId(null);
						setDialogOpen(true);
					}}
					className="gap-2"
				>
					<Plus className="size-4" />
					Create Vendor Bill
				</Button>
			</div>

			{/* KPI Strip */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{isLoading ? (
					[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-20 rounded-lg" />
					))
				) : (
					<>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">Total Bills</p>
							<p className="mt-1 font-bold text-xl">{totalBills}</p>
						</Card>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">Outstanding</p>
							<p className="mt-1 font-bold text-amber-600 text-xl">
								{formatGYD(totalOutstanding)}
							</p>
						</Card>
						<Card
							className={`p-4 ${totalOverdue > 0 ? "border-destructive/50" : ""}`}
						>
							<p
								className={`text-xs ${totalOverdue > 0 ? "text-destructive" : "text-muted-foreground"}`}
							>
								Overdue
							</p>
							<p
								className={`mt-1 font-bold text-xl ${totalOverdue > 0 ? "text-destructive" : ""}`}
							>
								{formatGYD(totalOverdue)}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">Paid This Month</p>
							<p className="mt-1 font-bold text-emerald-600 text-xl">
								{formatGYD(paidThisMonth)}
							</p>
						</Card>
					</>
				)}
			</div>

			{/* Status filter chips */}
			<div className="flex flex-wrap gap-2">
				{STATUS_FILTERS.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => setStatusFilter(s)}
						className={`rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary/60 hover:bg-primary/5 ${
							statusFilter === s
								? "border-primary bg-primary/10 font-medium text-primary"
								: "border-border text-muted-foreground"
						}`}
					>
						{s}
					</button>
				))}
			</div>

			{/* Table */}
			<Card>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-8" />
							<TableHead className="text-xs">Bill #</TableHead>
							<TableHead className="text-xs">Supplier</TableHead>
							<TableHead className="text-right text-xs">Total</TableHead>
							<TableHead className="text-right text-xs">Paid</TableHead>
							<TableHead className="text-right text-xs">Balance</TableHead>
							<TableHead className="text-xs">Due Date</TableHead>
							<TableHead className="text-xs">Status</TableHead>
							<TableHead className="text-xs">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							Array.from({ length: 5 }).map((_, i) => (
								<TableRow key={i}>
									{Array.from({ length: 9 }).map((__, j) => (
										<TableCell key={j}>
											<Skeleton className="h-4 w-full" />
										</TableCell>
									))}
								</TableRow>
							))
						) : vendorBills.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={9}
									className="py-10 text-center text-muted-foreground text-sm"
								>
									<FileWarning className="mx-auto mb-2 size-8 opacity-30" />
									No vendor bills found
								</TableCell>
							</TableRow>
						) : (
							vendorBills.map((bill) => {
								const balance = Number(bill.total) - Number(bill.amountPaid);
								const isOverdue =
									bill.dueDate &&
									new Date(bill.dueDate) < new Date() &&
									!["paid", "voided"].includes(bill.status);
								const isExpanded = expandedRows.has(bill.id);

								return (
									<>
										<TableRow
											key={bill.id}
											className={
												isOverdue ? "bg-red-50 dark:bg-red-950/20" : ""
											}
										>
											<TableCell className="p-1">
												<Button
													variant="ghost"
													size="icon"
													className="size-6"
													type="button"
													onClick={() => toggleExpand(bill.id)}
												>
													{isExpanded ? (
														<ChevronDown className="size-3" />
													) : (
														<ChevronRight className="size-3" />
													)}
												</Button>
											</TableCell>
											<TableCell className="font-mono font-semibold text-xs">
												{bill.billNumber}
											</TableCell>
											<TableCell className="font-medium text-xs">
												{bill.supplierName}
											</TableCell>
											<TableCell className="text-right font-semibold text-sm">
												{formatGYD(Number(bill.total))}
											</TableCell>
											<TableCell className="text-right text-muted-foreground text-xs">
												{Number(bill.amountPaid) > 0
													? formatGYD(Number(bill.amountPaid))
													: "—"}
											</TableCell>
											<TableCell className="text-right text-xs">
												{balance > 0 ? (
													<span
														className={`font-mono ${isOverdue ? "font-semibold text-destructive" : ""}`}
													>
														{formatGYD(balance)}
													</span>
												) : (
													<span className="text-emerald-600">Paid</span>
												)}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{bill.dueDate
													? new Date(bill.dueDate).toLocaleDateString("en-GY")
													: "—"}
											</TableCell>
											<TableCell>
												<Badge
													className={`text-[10px] ${statusBadgeClass(bill.status)}`}
												>
													{bill.status.replace("_", " ")}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1">
													{!["paid", "voided"].includes(bill.status) &&
														balance > 0 && (
															<Button
																variant="outline"
																size="sm"
																className="h-7 gap-1 px-2 text-xs"
																type="button"
																onClick={() => {
																	setPayBill(bill);
																	setPaymentForm({
																		...emptyPaymentForm,
																		amount: String(balance),
																	});
																}}
															>
																<CreditCard className="size-3" />
																Pay
															</Button>
														)}
													<DropdownMenu>
														<DropdownMenuTrigger
															className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
															type="button"
														>
															<MoreHorizontal className="size-4" />
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" className="w-44">
															{!["paid", "voided"].includes(bill.status) && (
																<DropdownMenuItem
																	onClick={() => {
																		setForm({
																			supplierName: bill.supplierName,
																			supplierId: "",
																			billNumberRef: "",
																			issuedDate: bill.issuedDate
																				? new Date(bill.issuedDate)
																						.toISOString()
																						.split("T")[0]!
																				: "",
																			dueDate: bill.dueDate
																				? new Date(bill.dueDate)
																						.toISOString()
																						.split("T")[0]!
																				: "",
																			items: (bill.items as LineItem[]) ?? [],
																			applyTax: Number(bill.taxTotal) > 0,
																			notes: bill.notes ?? "",
																			department:
																				(
																					bill as VendorBillRow & {
																						department?: string;
																					}
																				).department ?? "",
																		});
																		setEditingId(bill.id);
																		setDialogOpen(true);
																	}}
																>
																	<Edit2 className="mr-2 size-3.5" />
																	Edit
																</DropdownMenuItem>
															)}
															<DropdownMenuItem
																onClick={async () => {
																	const r = await openVendorBillPdf(bill);
																	if (r === "popup_blocked")
																		toast.error("Allow popups to open the PDF");
																}}
															>
																<FileDown className="mr-2 size-3.5" />
																Print / Save PDF
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															{bill.status !== "voided" && (
																<DropdownMenuItem
																	className="text-destructive focus:text-destructive"
																	onClick={() => setVoidId(bill.id)}
																>
																	<Trash2 className="mr-2 size-3.5" />
																	Void Bill
																</DropdownMenuItem>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											</TableCell>
										</TableRow>
										{isExpanded && (
											<TableRow
												key={`${bill.id}-history`}
												className={
													isOverdue
														? "bg-red-50/60 dark:bg-red-950/10"
														: "bg-muted/20"
												}
											>
												<TableCell />
												<TableCell colSpan={8} className="px-4 py-3">
													<p className="mb-2 font-medium text-muted-foreground text-xs">
														Payment History
													</p>
													<PaymentHistory billId={bill.id} />
												</TableCell>
											</TableRow>
										)}
									</>
								);
							})
						)}
					</TableBody>
				</Table>
			</Card>

			{/* Create / Edit Vendor Bill Dialog */}
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDialogOpen(false);
						setEditingId(null);
						setForm(emptyBillForm);
					}
				}}
			>
				<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Vendor Bill" : "New Vendor Bill"}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="grid grid-cols-2 gap-3">
							<div className="col-span-2 flex flex-col gap-1.5">
								<Label>Supplier Name *</Label>
								<Input
									placeholder="Supplier / vendor name"
									value={form.supplierName}
									onChange={(e) =>
										setForm((f) => ({ ...f, supplierName: e.target.value }))
									}
								/>
							</div>
							<div className="col-span-2 flex flex-col gap-1.5">
								<Label>Bill Reference Number</Label>
								<Input
									placeholder="Supplier's invoice/bill number (optional)"
									value={form.billNumberRef}
									onChange={(e) =>
										setForm((f) => ({ ...f, billNumberRef: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Issued Date</Label>
								<Input
									type="date"
									value={form.issuedDate}
									onChange={(e) =>
										setForm((f) => ({ ...f, issuedDate: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Due Date</Label>
								<Input
									type="date"
									value={form.dueDate}
									onChange={(e) =>
										setForm((f) => ({ ...f, dueDate: e.target.value }))
									}
								/>
							</div>
							<div className="col-span-2 flex flex-col gap-1.5">
								<Label>Department (optional)</Label>
								<Input
									placeholder="e.g. Kitchen, Front of House, Admin"
									value={form.department}
									onChange={(e) =>
										setForm((f) => ({ ...f, department: e.target.value }))
									}
								/>
							</div>
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
													<Input
														className="h-8 text-xs"
														placeholder="Description"
														value={item.description}
														onChange={(e) =>
															updateItem(i, "description", e.target.value)
														}
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

						{/* Tax toggle */}
						<div className="flex items-center gap-3 rounded-md bg-muted/40 p-2">
							<label className="flex cursor-pointer items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={form.applyTax}
									onChange={(e) =>
										setForm((f) => ({ ...f, applyTax: e.target.checked }))
									}
									className="size-4 cursor-pointer"
								/>
								Apply VAT ({TAX_RATE}%)
							</label>
						</div>

						{/* Totals */}
						<div className="flex flex-col gap-1 border-t pt-2 text-sm">
							<div className="flex justify-between text-muted-foreground">
								<span>Subtotal</span>
								<span className="font-mono">{formatGYD(formSubtotal)}</span>
							</div>
							{formTax > 0 && (
								<div className="flex justify-between text-muted-foreground">
									<span>VAT ({TAX_RATE}%)</span>
									<span className="font-mono">{formatGYD(formTax)}</span>
								</div>
							)}
							<div className="flex justify-between font-bold">
								<span>Total</span>
								<span className="font-mono">{formatGYD(formTotal)}</span>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label>Notes</Label>
							<Textarea
								placeholder="Optional notes..."
								value={form.notes}
								onChange={(e) =>
									setForm((f) => ({ ...f, notes: e.target.value }))
								}
								className="h-16 resize-none"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							type="button"
							onClick={() => {
								setDialogOpen(false);
								setEditingId(null);
								setForm(emptyBillForm);
							}}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleSave}
							disabled={
								!form.supplierName || createMut.isPending || updateMut.isPending
							}
						>
							{createMut.isPending || updateMut.isPending
								? "Saving..."
								: editingId
									? "Update Bill"
									: "Create Bill"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Record Payment Dialog */}
			<Dialog
				open={!!payBill}
				onOpenChange={(open) => {
					if (!open) {
						setPayBill(null);
						setPaymentForm(emptyPaymentForm);
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Record Payment</DialogTitle>
					</DialogHeader>
					{payBill && (
						<div className="flex flex-col gap-4 py-2">
							<div className="rounded-md bg-muted/40 p-3 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Bill</span>
									<span className="font-semibold">{payBill.billNumber}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Supplier</span>
									<span>{payBill.supplierName}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Balance Due</span>
									<span className="font-semibold text-destructive">
										{formatGYD(
											Number(payBill.total) - Number(payBill.amountPaid),
										)}
									</span>
								</div>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Amount (GYD) *</Label>
								<Input
									type="number"
									inputMode="decimal"
									min={0}
									max={Number(payBill.total) - Number(payBill.amountPaid)}
									step="0.01"
									placeholder="Amount being paid"
									value={paymentForm.amount}
									onChange={(e) =>
										setPaymentForm((f) => ({ ...f, amount: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Payment Method *</Label>
								<Select
									value={paymentForm.paymentMethod}
									onValueChange={(v) =>
										setPaymentForm((f) => ({ ...f, paymentMethod: v }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAYMENT_METHODS.map((m) => (
											<SelectItem key={m} value={m}>
												{m}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="flex flex-col gap-1.5">
									<Label>Reference Number</Label>
									<Input
										placeholder="Cheque / transfer # (optional)"
										value={paymentForm.referenceNumber}
										onChange={(e) =>
											setPaymentForm((f) => ({
												...f,
												referenceNumber: e.target.value,
											}))
										}
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<Label>Date Paid</Label>
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
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Notes</Label>
								<Input
									placeholder="Optional notes"
									value={paymentForm.notes}
									onChange={(e) =>
										setPaymentForm((f) => ({ ...f, notes: e.target.value }))
									}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							type="button"
							onClick={() => {
								setPayBill(null);
								setPaymentForm(emptyPaymentForm);
							}}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleRecordPayment}
							disabled={!paymentForm.amount || recordPaymentMut.isPending}
						>
							{recordPaymentMut.isPending ? "Saving..." : "Record Payment"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Void Confirmation */}
			<AlertDialog
				open={!!voidId}
				onOpenChange={(open) => {
					if (!open) setVoidId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Void this vendor bill?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently void the vendor bill. Any payments already
							recorded will remain in history. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => voidId && voidMut.mutate({ id: voidId })}
						>
							Void Bill
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
