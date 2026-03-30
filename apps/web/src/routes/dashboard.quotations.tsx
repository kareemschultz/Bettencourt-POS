import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowRightLeft,
	Copy,
	Edit2,
	FileText,
	GitBranch,
	MoreHorizontal,
	Plus,
	Printer,
	Search,
	Send,
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
import { openQuotationPdf } from "@/lib/pdf/quotation-pdf";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { CustomerCombobox, type CustomerHit } from "@/components/ui/customer-combobox";
import { orpc } from "@/utils/orpc";

interface LineItem {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

interface QuotationForm {
	customerName: string;
	customerAddress: string;
	customerPhone: string;
	customerId: string;
	validUntil: string;
	notes: string;
	noteMode: "preset" | "custom";
	items: LineItem[];
	discountType: "percent" | "fixed";
	discountValue: string;
	taxMode: "invoice" | "line" | "incl";
	taxRate: string;
	termsAndConditions: string;
	preparedBy: string;
	department: string;
	brand: "foods_inc" | "home_style";
}

const PREDEFINED_NOTES_QUOT = [
	"This quotation is valid for 30 days from the date of issue.",
	"All prices are in Guyanese dollars (GYD) and exclude VAT.",
	"A 10% service charge applies to all catering orders.",
	"Please confirm your order at least 48 hours in advance.",
	"Payment due upon receipt of invoice.",
	"Prices subject to change without prior notice.",
];

const emptyForm: QuotationForm = {
	customerName: "",
	customerAddress: "",
	customerPhone: "",
	customerId: "",
	validUntil: "",
	notes: "This quotation is valid for 30 days from the date of issue.",
	noteMode: "preset",
	items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
	discountType: "percent",
	discountValue: "0",
	taxMode: "invoice",
	taxRate: "14",
	termsAndConditions: "",
	preparedBy: "",
	department: "",
	brand: "foods_inc",
};

const QUOT_STATUS_FILTERS = ["All", "Draft", "Sent", "Accepted", "Rejected", "Converted", "Expired"] as const;

type QuotationRow = {
	id: string;
	quotationNumber: string;
	customerName: string;
	customerAddress: string | null;
	customerPhone: string | null;
	customerId: string | null;
	items: unknown;
	subtotal: string;
	taxTotal: string;
	total: string;
	status: string;
	validUntil: string | null;
	notes: string | null;
	createdAt: string;
	discountType: string;
	discountValue: string;
	taxMode: string;
	taxRate: string;
	termsAndConditions: string | null;
	preparedBy: string | null;
	parentQuotationId: string | null;
	department?: string | null;
	brand?: string | null;
};

export default function QuotationsPage() {
	const { data: session } = authClient.useSession();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<QuotationForm>(emptyForm);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const { data: userProfile } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);

	const userPerms =
		(userProfile as { permissions?: Record<string, string[]> })?.permissions ??
		{};
	const canCreate = userPerms.quotations?.includes("create") ?? false;
	const canUpdate = userPerms.quotations?.includes("update") ?? false;
	const canDelete = userPerms.quotations?.includes("delete") ?? false;
	const canConvert = userPerms.invoices?.includes("create") ?? false;

	const { data: docSettings } = useQuery(
		orpc.settings.getDocumentSettings.queryOptions({ input: {} }),
	);

	const { data: raw = { quotations: [], total: 0 } } = useQuery(
		orpc.quotations.list.queryOptions({
			input: {
				search: search || undefined,
				status: statusFilter || undefined,
				limit: 50,
				offset: 0,
			},
		}),
	);
	const quotations = (
		raw as unknown as { quotations: QuotationRow[]; total: number }
	).quotations;

	const createMut = useMutation(
		orpc.quotations.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Quotation created");
			},
			onError: (e) => toast.error(e.message || "Failed to create quotation"),
		}),
	);

	const updateMut = useMutation(
		orpc.quotations.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Quotation updated");
			},
			onError: (e) => toast.error(e.message || "Failed to update quotation"),
		}),
	);

	const deleteMut = useMutation(
		orpc.quotations.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey,
				});
				setSelectedId(null);
				toast.success("Quotation cancelled");
			},
			onError: (e) => toast.error(e.message || "Failed to cancel quotation"),
		}),
	);

	const convertMut = useMutation(
		orpc.quotations.convertToInvoice.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey,
				});
				setSelectedId(null);
				toast.success("Converted to invoice");
			},
			onError: (e) => toast.error(e.message || "Failed to convert"),
		}),
	);

	const markSentMut = useMutation(
		orpc.quotations.markSent.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey,
				});
				toast.success("Quotation marked as sent");
			},
			onError: () => toast.error("Failed to mark as sent"),
		}),
	);

	const duplicateMut = useMutation(
		orpc.quotations.duplicate.mutationOptions({
			onSuccess: (newQ) => {
				queryClient.invalidateQueries({
					queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey,
				});
				setSelectedId((newQ as { id: string }).id);
				toast.success("Quotation duplicated");
			},
			onError: () => toast.error("Failed to duplicate"),
		}),
	);

	const reviseMut = useMutation(
		orpc.quotations.revise.mutationOptions({
			onSuccess: (newQ) => {
				queryClient.invalidateQueries({
					queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey,
				});
				setSelectedId((newQ as { id: string }).id);
				toast.success("Revision created");
			},
			onError: () => toast.error("Failed to create revision"),
		}),
	);

	function openCreate() {
		setEditingId(null);
		setForm({
			...emptyForm,
			taxRate: String(docSettings?.defaultTaxRate ?? "14"),
			taxMode: (docSettings?.defaultTaxMode as "invoice" | "line" | "incl") ?? "invoice",
			discountType:
				(docSettings?.defaultDiscountType as "percent" | "fixed") ?? "percent",
			termsAndConditions: docSettings?.defaultQuotationTerms ?? "",
		});
		setDialogOpen(true);
	}

	function openEdit(q: QuotationRow) {
		setEditingId(q.id);
		setForm({
			customerName: q.customerName,
			customerAddress: q.customerAddress ?? "",
			customerPhone: q.customerPhone ?? "",
			customerId: "",
			validUntil: q.validUntil ? (q.validUntil.split("T")[0] ?? "") : "",
			notes: q.notes ?? "",
			items: Array.isArray(q.items)
				? (q.items as LineItem[])
				: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
			discountType: (q.discountType as "percent" | "fixed") ?? "percent",
			discountValue: q.discountValue ?? "0",
			taxMode: (q.taxMode as "invoice" | "line" | "incl") ?? "invoice",
			taxRate: q.taxRate ?? "14",
			termsAndConditions: q.termsAndConditions ?? "",
			preparedBy: q.preparedBy ?? "",
			department: q.department ?? "",
			brand: (q.brand === "home_style" ? "home_style" : "foods_inc"),
		noteMode: (q.notes && !PREDEFINED_NOTES_QUOT.includes(q.notes) ? "custom" : "preset"),
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
			validUntil: form.validUntil || undefined,
			notes: form.notes || undefined,
			items: form.items,
			subtotal: String(subtotal),
			taxTotal: String(taxAmt),
			total: String(total),
			discountType: form.discountType,
			discountValue: form.discountValue,
			taxMode: form.taxMode,
			taxRate: form.taxRate,
			termsAndConditions: form.termsAndConditions || undefined,
			preparedBy: form.preparedBy || undefined,
			department: form.department || undefined,
			brand: form.brand,
		};

		if (editingId) {
			updateMut.mutate({ id: editingId, ...sharedFields });
		} else {
			createMut.mutate({ ...sharedFields, createdBy: userId });
		}
	}

	const selectedQuotation = quotations.find((q) => q.id === selectedId) ?? null;
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
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<FileText className="size-6" />
						Quotations
					</h1>
					<p className="text-muted-foreground text-sm">
						Create and manage customer quotations
					</p>
				</div>
				{canCreate && (
					<Button onClick={openCreate} className="gap-2">
						<Plus className="size-4" />
						New Quotation
					</Button>
				)}
			</div>

			{/* Search bar */}
			<div className="flex flex-wrap gap-3">
				<div className="relative min-w-48 flex-1">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search quotations..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
			</div>

			{/* Status filter chips */}
			<div className="flex flex-wrap gap-2">
				{QUOT_STATUS_FILTERS.map((s) => {
					const value = s === "All" ? "" : s.toLowerCase();
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
			<div className="grid gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<Card>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-xs">Quotation #</TableHead>
									<TableHead className="text-xs">Customer</TableHead>
									<TableHead className="text-xs">Items</TableHead>
									<TableHead className="text-right text-xs">Total</TableHead>
									<TableHead className="text-xs">Status</TableHead>
									<TableHead className="text-xs">Valid Until</TableHead>
									<TableHead className="text-xs">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{quotations.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-10 text-center text-muted-foreground text-sm"
										>
											<FileText className="mx-auto mb-2 size-8 opacity-30" />
											No quotations yet
										</TableCell>
									</TableRow>
								) : (
									quotations.map((q) => (
										<TableRow
											key={q.id}
											className={`cursor-pointer ${selectedId === q.id ? "bg-muted/50" : ""}`}
											onClick={() =>
												setSelectedId(q.id === selectedId ? null : q.id)
											}
										>
											<TableCell className="font-mono font-semibold text-xs">
												{q.quotationNumber}
											</TableCell>
											<TableCell className="font-medium text-xs">
												{q.customerName}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{Array.isArray(q.items) ? q.items.length : 0} items
											</TableCell>
											<TableCell className="text-right font-semibold text-sm">
												{formatGYD(Number(q.total))}
											</TableCell>
											<TableCell>
												<Badge
													className={`text-[10px] ${statusBadgeClass(q.status)}`}
												>
													{q.status}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{q.validUntil
													? new Date(q.validUntil).toLocaleDateString("en-GY")
													: "—"}
											</TableCell>
											<TableCell>
												<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
													{canUpdate && (
														<Button
															variant="ghost"
															size="icon"
															className="size-7"
															type="button"
															onClick={() => openEdit(q)}
														>
															<Edit2 className="size-3" />
														</Button>
													)}
													<DropdownMenu>
														<DropdownMenuTrigger
															className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
															type="button"
														>
															<MoreHorizontal className="size-4" />
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" className="w-48">
															{q.status === "draft" && canUpdate && (
																<DropdownMenuItem onClick={() => markSentMut.mutate({ id: q.id })}>
																	<Send className="mr-2 size-3.5" />
																	Mark Sent
																</DropdownMenuItem>
															)}
															{canCreate && (
																<DropdownMenuItem onClick={() =>
																	duplicateMut.mutate({
																		id: q.id,
																		createdBy: session?.user?.id ?? "",
																	})
																}>
																	<Copy className="mr-2 size-3.5" />
																	Duplicate
																</DropdownMenuItem>
															)}
															<DropdownMenuItem onClick={async () => { const r = await openQuotationPdf(q, docSettings ?? {}); if (r === "popup_blocked") toast.error("Allow popups to open the PDF"); }}>
																<Printer className="mr-2 size-3.5" />
																Print / Save PDF
															</DropdownMenuItem>
															{canConvert && ["sent", "accepted"].includes(q.status) && (
																<DropdownMenuItem onClick={() =>
																	convertMut.mutate({
																		id: q.id,
																		createdBy: session?.user?.id ?? "",
																	})
																}>
																	<ArrowRightLeft className="mr-2 size-3.5" />
																	Convert to Invoice
																</DropdownMenuItem>
															)}
															{canCreate && q.status !== "draft" && (
																<DropdownMenuItem onClick={() =>
																	reviseMut.mutate({
																		id: q.id,
																		createdBy: session?.user?.id ?? "",
																	})
																}>
																	<GitBranch className="mr-2 size-3.5" />
																	Revise
																</DropdownMenuItem>
															)}
															{canDelete && q.status !== "cancelled" && (
																<>
																	<DropdownMenuSeparator />
																	<DropdownMenuItem
																		className="text-destructive focus:text-destructive"
																		onClick={() => deleteMut.mutate({ id: q.id })}
																	>
																		<Trash2 className="mr-2 size-3.5" />
																		Cancel
																	</DropdownMenuItem>
																</>
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
				<div>
					{selectedQuotation ? (
						<Card className="print-area">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center justify-between text-base">
									<span>{selectedQuotation.quotationNumber}</span>
									<div className="flex items-center gap-2">
										<Badge
											className={`text-[10px] ${statusBadgeClass(selectedQuotation.status)}`}
										>
											{selectedQuotation.status}
										</Badge>
										<Button
											variant="outline"
											size="sm"
											type="button"
											onClick={async () => {
												const r = await openQuotationPdf(selectedQuotation, docSettings ?? {});
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
								<div>
									<p className="font-semibold">
										{selectedQuotation.customerName}
									</p>
									{selectedQuotation.customerPhone && (
										<p className="text-muted-foreground">
											{selectedQuotation.customerPhone}
										</p>
									)}
									{selectedQuotation.customerAddress && (
										<p className="text-muted-foreground">
											{selectedQuotation.customerAddress}
										</p>
									)}
								</div>
								{selectedQuotation.validUntil &&
									(() => {
										const days = Math.ceil(
											(new Date(selectedQuotation.validUntil).getTime() -
												Date.now()) /
												86_400_000,
										);
										return (
											<p
												className={`font-medium text-xs ${days > 0 ? "text-sky-600 dark:text-sky-400" : "text-destructive"}`}
											>
												{days > 0
													? `Valid for ${days} more day${days !== 1 ? "s" : ""} · expires ${new Date(selectedQuotation.validUntil).toLocaleDateString("en-GY")}`
													: `Expired on ${new Date(selectedQuotation.validUntil).toLocaleDateString("en-GY")}`}
											</p>
										);
									})()}
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="text-xs">Description</TableHead>
											<TableHead className="text-right text-xs">Qty</TableHead>
											<TableHead className="text-right text-xs">
												Price
											</TableHead>
											<TableHead className="text-right text-xs">
												Total
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(Array.isArray(selectedQuotation.items)
											? (selectedQuotation.items as LineItem[])
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
									<span>{formatGYD(Number(selectedQuotation.total))}</span>
								</div>
								{selectedQuotation.notes && (
									<p className="text-muted-foreground text-xs italic">
										{selectedQuotation.notes}
									</p>
								)}

								<div className="no-print flex flex-wrap gap-2 pt-1">
									{canUpdate && (
										<Button
											size="sm"
											variant="outline"
											type="button"
											className="gap-1"
											onClick={() => openEdit(selectedQuotation)}
										>
											<Edit2 className="size-3" />
											Edit
										</Button>
									)}
									{canUpdate && selectedQuotation.status === "draft" && (
										<Button
											size="sm"
											variant="outline"
											type="button"
											className="gap-1"
											onClick={() =>
												markSentMut.mutate({ id: selectedQuotation.id })
											}
											disabled={markSentMut.isPending}
										>
											<Send className="size-3" />
											Mark Sent
										</Button>
									)}
									{canCreate && (
										<Button
											size="sm"
											variant="outline"
											type="button"
											className="gap-1"
											onClick={() =>
												duplicateMut.mutate({
													id: selectedQuotation.id,
													createdBy: session?.user?.id ?? "",
												})
											}
											disabled={duplicateMut.isPending}
										>
											<Copy className="size-3" />
											Duplicate
										</Button>
									)}
									{canCreate && selectedQuotation.status !== "draft" && (
										<Button
											size="sm"
											variant="outline"
											type="button"
											className="gap-1"
											onClick={() =>
												reviseMut.mutate({
													id: selectedQuotation.id,
													createdBy: session?.user?.id ?? "",
												})
											}
											disabled={reviseMut.isPending}
										>
											<GitBranch className="size-3" />
											Revise
										</Button>
									)}
									{canConvert &&
										["sent", "accepted"].includes(selectedQuotation.status) && (
											<Button
												size="sm"
												type="button"
												className="gap-1"
												onClick={() =>
													convertMut.mutate({
														id: selectedQuotation.id,
														createdBy: session?.user?.id ?? "",
													})
												}
												disabled={convertMut.isPending}
											>
												<ArrowRightLeft className="size-3" />
												To Invoice
											</Button>
										)}
								</div>
							</CardContent>
						</Card>
					) : (
						<Card>
							<CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<FileText className="size-10 opacity-30" />
								<p className="text-sm">Select a quotation to view details</p>
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
							{editingId ? "Edit Quotation" : "New Quotation"}
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
								<Label>Valid Until</Label>
								<Input
									type="date"
									value={form.validUntil}
									min={todayGY()}
									onChange={(e) =>
										setForm((f) => ({ ...f, validUntil: e.target.value }))
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

						{/* Company Brand */}
						<div className="flex flex-col gap-1.5">
							<Label>Company Brand</Label>
							<div className="flex gap-2">
								<button
									type="button"
									className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.brand === "foods_inc" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
									onClick={() => setForm(f => ({ ...f, brand: "foods_inc" }))}
								>
									Bettencourt's Food Inc.
								</button>
								<button
									type="button"
									className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.brand === "home_style" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
									onClick={() => setForm(f => ({ ...f, brand: "home_style" }))}
								>
									Bettencourt's Home Style
								</button>
							</div>
						</div>

												{/* Department */}
						<div className="flex flex-col gap-1.5">
							<Label>Department (optional)</Label>
							<Input
								placeholder="e.g. Kitchen, Catering, Admin"
								value={form.department}
								onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}
							/>
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
								type="button"
								className="gap-1 self-start"
								onClick={addItem}
							>
								<Plus className="size-3" />
								Add Item
							</Button>
						</div>

						{/* Tax / Discount Settings */}
						<div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3">
							<div className="flex flex-col gap-1.5">
								<Label className="text-xs">Tax Rate (%)</Label>
								<Input
									type="number"
									min={0}
									step="0.5"
									value={form.taxRate}
									onChange={(e) =>
										setForm((f) => ({ ...f, taxRate: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label className="text-xs">VAT Mode</Label>
								<div className="flex overflow-hidden rounded border text-xs">
									<button
										type="button"
										className={`flex-1 px-2 py-1.5 transition-colors ${form.taxMode !== "incl" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
										onClick={() =>
											setForm((f) => ({ ...f, taxMode: "invoice" }))
										}
									>
										Excl.
									</button>
									<button
										type="button"
										className={`flex-1 px-2 py-1.5 transition-colors ${form.taxMode === "incl" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
										onClick={() =>
											setForm((f) => ({ ...f, taxMode: "incl" }))
										}
									>
										Incl.
									</button>
								</div>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label className="text-xs">Discount Type</Label>
								<Select
									value={form.discountType}
									onValueChange={(v) =>
										setForm((f) => ({
											...f,
											discountType: v as "percent" | "fixed",
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="percent">Percent (%)</SelectItem>
										<SelectItem value="fixed">Fixed (GYD)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label className="text-xs">Discount Value</Label>
								<Input
									type="number"
									min={0}
									step="0.01"
									value={form.discountValue}
									onChange={(e) =>
										setForm((f) => ({ ...f, discountValue: e.target.value }))
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label className="text-xs">Prepared By</Label>
								<Input
									placeholder="Your name"
									value={form.preparedBy}
									onChange={(e) =>
										setForm((f) => ({ ...f, preparedBy: e.target.value }))
									}
								/>
							</div>
						</div>

						{/* Totals */}
						<div className="flex flex-col items-end gap-1 border-t pt-2 text-sm">
							<div className="flex w-64 justify-between text-muted-foreground">
								<span>Subtotal</span>
								<span className="font-mono">{formatGYD(subtotal)}</span>
							</div>
							{formDiscountAmt > 0 && (
								<div className="flex w-64 justify-between text-destructive">
									<span>
										Discount
										{form.discountType === "percent"
											? ` (${form.discountValue}%)`
											: ""}
									</span>
									<span className="font-mono">
										−{formatGYD(formDiscountAmt)}
									</span>
								</div>
							)}
							{formTaxAmt > 0 && (
								<div className="flex w-64 justify-between text-muted-foreground">
									<span>VAT {form.taxRate}%{form.taxMode === "incl" ? " (incl.)" : ""}</span>
									<span className="font-mono">{formatGYD(formTaxAmt)}</span>
								</div>
							)}
							<div className="flex w-64 justify-between border-t pt-1 font-bold">
								<span>Total</span>
								<span className="font-mono">{formatGYD(formTotal)}</span>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label>Terms &amp; Conditions</Label>
							<Textarea
								placeholder="Enter terms and conditions..."
								value={form.termsAndConditions}
								onChange={(e) =>
									setForm((f) => ({ ...f, termsAndConditions: e.target.value }))
								}
								className="h-20 resize-none"
							/>
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
									{PREDEFINED_NOTES_QUOT.map((n) => (
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
						<Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
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
