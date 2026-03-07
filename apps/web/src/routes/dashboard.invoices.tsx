import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CreditCard,
	Edit2,
	Plus,
	Printer,
	Receipt,
	Search,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
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
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface LineItem {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

interface InvoiceForm {
	customerName: string;
	customerAddress: string;
	customerPhone: string;
	issuedDate: string;
	dueDate: string;
	notes: string;
	items: LineItem[];
}

const emptyForm: InvoiceForm = {
	customerName: "",
	customerAddress: "",
	customerPhone: "",
	issuedDate: "",
	dueDate: "",
	notes: "",
	items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
};

function statusBadgeClass(status: string): string {
	switch (status) {
		case "draft":
			return "bg-secondary text-secondary-foreground";
		case "sent":
			return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
		case "outstanding":
			return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
		case "paid":
			return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
		case "overpaid":
			return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
		case "cancelled":
			return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
		default:
			return "bg-secondary text-secondary-foreground";
	}
}

type InvoiceRow = {
	id: string;
	invoiceNumber: string;
	customerName: string;
	customerAddress: string | null;
	customerPhone: string | null;
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
};

export default function InvoicesPage() {
	const { data: session } = authClient.useSession();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<InvoiceForm>(emptyForm);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [paymentForm, setPaymentForm] = useState({
		amountPaid: "",
		chequeNumber: "",
		receiptNumber: "",
		datePaid: todayGY(),
		chequeDepositDate: "",
	});

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

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(inv: InvoiceRow) {
		setEditingId(inv.id);
		setForm({
			customerName: inv.customerName,
			customerAddress: inv.customerAddress ?? "",
			customerPhone: inv.customerPhone ?? "",
			issuedDate: inv.issuedDate ? (inv.issuedDate.split("T")[0] ?? "") : "",
			dueDate: inv.dueDate ? (inv.dueDate.split("T")[0] ?? "") : "",
			notes: inv.notes ?? "",
			items: Array.isArray(inv.items)
				? (inv.items as LineItem[])
				: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
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
		const total = subtotal;
		const userId = session?.user?.id ?? "";

		if (editingId) {
			updateMut.mutate({
				id: editingId,
				customerName: form.customerName,
				customerAddress: form.customerAddress || undefined,
				customerPhone: form.customerPhone || undefined,
				issuedDate: form.issuedDate || undefined,
				dueDate: form.dueDate || undefined,
				notes: form.notes || undefined,
				items: form.items,
				subtotal: String(subtotal),
				taxTotal: "0",
				total: String(total),
			});
		} else {
			createMut.mutate({
				customerName: form.customerName,
				customerAddress: form.customerAddress || undefined,
				customerPhone: form.customerPhone || undefined,
				issuedDate: form.issuedDate || undefined,
				dueDate: form.dueDate || undefined,
				notes: form.notes || undefined,
				items: form.items,
				subtotal: String(subtotal),
				taxTotal: "0",
				total: String(total),
				createdBy: userId,
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
					<>
						{[0, 1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-20 rounded-lg" />
						))}
					</>
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
				<Select
					value={statusFilter || "all"}
					onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="draft">Draft</SelectItem>
						<SelectItem value="sent">Sent</SelectItem>
						<SelectItem value="outstanding">Outstanding</SelectItem>
						<SelectItem value="paid">Paid</SelectItem>
						<SelectItem value="overpaid">Overpaid</SelectItem>
						<SelectItem value="cancelled">Cancelled</SelectItem>
					</SelectContent>
				</Select>
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
									<TableHead className="text-right text-xs">Paid</TableHead>
									<TableHead className="text-xs">Status</TableHead>
									<TableHead className="text-xs">Due</TableHead>
									<TableHead className="text-xs">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{invoices.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={9}
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
											<TableCell className="text-right text-muted-foreground text-xs">
												{Number(inv.amountPaid) > 0
													? formatGYD(Number(inv.amountPaid))
													: "—"}
											</TableCell>
											<TableCell className="text-right text-xs">
												{(() => {
													const bal =
														Number(inv.total) - Number(inv.amountPaid);
													return bal > 0 &&
														!["paid", "cancelled"].includes(inv.status) ? (
														<span className="font-mono text-destructive">
															{formatGYD(bal)}
														</span>
													) : (
														<span className="text-emerald-600">Paid</span>
													);
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
															onClick={(e) => {
																e.stopPropagation();
																openEdit(inv);
															}}
														>
															<Edit2 className="size-3" />
														</Button>
													)}
													{canDelete && inv.status !== "cancelled" && (
														<Button
															variant="ghost"
															size="icon"
															className="size-7 text-destructive"
															onClick={(e) => {
																e.stopPropagation();
																deleteMut.mutate({ id: inv.id });
															}}
														>
															<Trash2 className="size-3" />
														</Button>
													)}
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
												onClick={() =>
													openInvoicePdf(selectedInvoice, docSettings ?? {})
												}
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
								<Label>Customer Name *</Label>
								<Input
									placeholder="Customer name"
									value={form.customerName}
									onChange={(e) =>
										setForm((f) => ({ ...f, customerName: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Phone</Label>
								<Input
									placeholder="Phone number"
									value={form.customerPhone}
									onChange={(e) =>
										setForm((f) => ({ ...f, customerPhone: e.target.value }))
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
								<Label>Address</Label>
								<Input
									placeholder="Customer address"
									value={form.customerAddress}
									onChange={(e) =>
										setForm((f) => ({ ...f, customerAddress: e.target.value }))
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
								onClick={addItem}
							>
								<Plus className="size-3" />
								Add Item
							</Button>
						</div>

						{/* Tax/Discount Settings */}
						<div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/40 p-2 text-sm">
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground text-xs">Tax:</span>
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
							</div>
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
									<span>VAT ({form.taxRate}%)</span>
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
		</div>
	);
}
