import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronsUpDown,
	FileDown,
	FileText,
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
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	CustomerCombobox,
	type CustomerHit,
} from "@/components/ui/customer-combobox";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
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
import { openCreditNotePdf } from "@/lib/pdf/credit-note-pdf";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

interface CreditNoteRow {
	id: string;
	creditNoteNumber: string;
	customerName: string;
	originalInvoiceNumber: string | null;
	reason: string | null;
	items: unknown;
	subtotal: string;
	taxTotal: string;
	total: string;
	appliedAmount: string;
	status: string;
	createdAt: string;
	department?: string | null;
}

interface CNForm {
	customerName: string;
	customerId: string;
	originalInvoiceNumber: string;
	reason: string;
	items: LineItem[];
	applyTax: boolean;
	department: string;
}

const emptyCNForm: CNForm = {
	customerName: "",
	customerId: "",
	originalInvoiceNumber: "",
	reason: "",
	items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
	applyTax: false,
	department: "",
};

const TAX_RATE = 14;
const CN_STATUS_FILTERS = [
	"All",
	"Draft",
	"Issued",
	"Applied",
	"Voided",
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CreditNotesPage() {
	const queryClient = useQueryClient();

	const [statusFilter, setStatusFilter] = useState<string>("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<CNForm>(emptyCNForm);

	// Invoice combobox state
	const [invoiceComboOpen, setInvoiceComboOpen] = useState(false);

	// Apply-to-Invoice dialog state
	const [applyDialogCN, setApplyDialogCN] = useState<CreditNoteRow | null>(
		null,
	);
	const [applyInvoiceNumber, setApplyInvoiceNumber] = useState("");
	const [applyAmount, setApplyAmount] = useState("");

	// Void confirmation
	const [voidId, setVoidId] = useState<string | null>(null);

	// ── Queries ──────────────────────────────────────────────────────────────

	const { data: raw = { creditNotes: [], total: 0 }, isLoading } = useQuery(
		orpc.creditNotes.list.queryOptions({
			input: {
				status: statusFilter !== "" ? statusFilter : undefined,
				limit: 100,
				offset: 0,
			},
		}),
	);
	const creditNotes =
		(raw as unknown as { items: CreditNoteRow[]; total: number }).items ?? [];

	const { data: invoiceListRaw = { invoices: [] } } = useQuery(
		orpc.invoices.list.queryOptions({
			input: { limit: 100, offset: 0 },
		}),
	);
	const invoiceOptions =
		(
			invoiceListRaw as unknown as {
				invoices: Array<{
					id: string;
					invoiceNumber: string;
					customerName: string;
					total: string;
					amountPaid: string;
				}>;
			}
		).invoices ?? [];

	// ── Mutations ────────────────────────────────────────────────────────────

	function invalidate() {
		queryClient.invalidateQueries({
			queryKey: orpc.creditNotes.list.queryOptions({ input: {} }).queryKey,
		});
	}

	const createMut = useMutation(
		orpc.creditNotes.create.mutationOptions({
			onSuccess: () => {
				invalidate();
				setDialogOpen(false);
				setForm(emptyCNForm);
				toast.success("Credit note created");
			},
			onError: (e) => toast.error(e.message || "Failed to create credit note"),
		}),
	);

	const issueMut = useMutation(
		orpc.creditNotes.issue.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Credit note issued");
			},
			onError: (e) => toast.error(e.message || "Failed to issue credit note"),
		}),
	);

	const applyMut = useMutation(
		orpc.creditNotes.applyToInvoice.mutationOptions({
			onSuccess: () => {
				invalidate();
				setApplyDialogCN(null);
				setApplyInvoiceNumber("");
				setApplyAmount("");
				toast.success("Credit note applied to invoice");
			},
			onError: (e) => toast.error(e.message || "Failed to apply credit note"),
		}),
	);

	const voidMut = useMutation(
		orpc.creditNotes.void.mutationOptions({
			onSuccess: () => {
				invalidate();
				setVoidId(null);
				toast.success("Credit note voided");
			},
			onError: (e) => toast.error(e.message || "Failed to void credit note"),
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

	// ── Form computed totals ─────────────────────────────────────────────────

	const formSubtotal = form.items.reduce((s, i) => s + i.total, 0);
	const formTax = form.applyTax ? (TAX_RATE / 100) * formSubtotal : 0;
	const formTotal = formSubtotal + formTax;

	// ── Save handler ─────────────────────────────────────────────────────────

	function handleSave() {
		createMut.mutate({
			customerName: form.customerName,
			customerId: form.customerId || undefined,
			reason: form.reason || undefined,
			notes: form.originalInvoiceNumber
				? `Ref: ${form.originalInvoiceNumber}`
				: undefined,
			items: form.items,
			subtotal: String(formSubtotal),
			taxTotal: String(formTax),
			total: String(formTotal),
			department: form.department || undefined,
		});
	}

	// ── Apply dialog helpers ─────────────────────────────────────────────────

	function openApply(cn: CreditNoteRow) {
		const balance = Number(cn.total) - Number(cn.appliedAmount);
		setApplyDialogCN(cn);
		setApplyInvoiceNumber("");
		setApplyAmount(String(balance));
	}

	function handleApply() {
		if (!applyDialogCN || !applyInvoiceNumber || !applyAmount) return;
		applyMut.mutate({
			creditNoteId: applyDialogCN.id,
			invoiceId: applyInvoiceNumber,
			amount: applyAmount,
		});
	}

	// ── Summary numbers (computed inline from list) ──────────────────────────

	const totalCNs = creditNotes.length;
	const totalApplied = creditNotes.reduce(
		(s, cn) => s + Number(cn.appliedAmount),
		0,
	);
	const totalOutstanding = creditNotes.reduce(
		(s, cn) => s + (Number(cn.total) - Number(cn.appliedAmount)),
		0,
	);

	// ── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<FileText className="size-6" />
						Credit Notes
					</h1>
					<p className="text-muted-foreground text-sm">
						Manage customer credit notes and apply them to invoices
					</p>
				</div>
				<Button
					onClick={() => {
						setEditingId(null);
						setForm(emptyCNForm);
						setDialogOpen(true);
					}}
					className="gap-2"
				>
					<Plus className="size-4" />
					Create Credit Note
				</Button>
			</div>

			{/* KPI Strip */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{isLoading ? (
					[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)
				) : (
					<>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">
								Total Credit Notes
							</p>
							<p className="mt-1 font-bold text-xl">{totalCNs}</p>
						</Card>
						<Card className="p-4">
							<p className="text-muted-foreground text-xs">Total Applied</p>
							<p className="mt-1 font-bold text-emerald-600 text-xl">
								{formatGYD(totalApplied)}
							</p>
						</Card>
						<Card
							className={`p-4 ${totalOutstanding > 0 ? "border-amber-300" : ""}`}
						>
							<p className="text-muted-foreground text-xs">Total Outstanding</p>
							<p
								className={`mt-1 font-bold text-xl ${totalOutstanding > 0 ? "text-amber-600" : ""}`}
							>
								{formatGYD(totalOutstanding)}
							</p>
						</Card>
					</>
				)}
			</div>

			{/* Status filter chips */}
			<div className="flex flex-wrap gap-2">
				{CN_STATUS_FILTERS.map((s) => {
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

			{/* Table */}
			<Card>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="text-xs">CN #</TableHead>
							<TableHead className="text-xs">Customer</TableHead>
							<TableHead className="text-xs">Original Invoice</TableHead>
							<TableHead className="text-right text-xs">Amount</TableHead>
							<TableHead className="text-right text-xs">Applied</TableHead>
							<TableHead className="text-xs">Status</TableHead>
							<TableHead className="text-xs">Created</TableHead>
							<TableHead className="text-xs">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							Array.from({ length: 5 }).map((_, i) => (
								<TableRow key={i}>
									{Array.from({ length: 8 }).map((__, j) => (
										<TableCell key={j}>
											<Skeleton className="h-4 w-full" />
										</TableCell>
									))}
								</TableRow>
							))
						) : creditNotes.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={8}
									className="py-10 text-center text-muted-foreground text-sm"
								>
									<FileText className="mx-auto mb-2 size-8 opacity-30" />
									No credit notes found
								</TableCell>
							</TableRow>
						) : (
							creditNotes.map((cn) => {
								const balance = Number(cn.total) - Number(cn.appliedAmount);
								return (
									<TableRow key={cn.id}>
										<TableCell className="font-mono font-semibold text-xs">
											{cn.creditNoteNumber}
										</TableCell>
										<TableCell className="font-medium text-xs">
											{cn.customerName}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{cn.originalInvoiceNumber ?? "—"}
										</TableCell>
										<TableCell className="text-right font-semibold text-sm">
											{formatGYD(Number(cn.total))}
										</TableCell>
										<TableCell className="text-right text-muted-foreground text-xs">
											{Number(cn.appliedAmount) > 0
												? formatGYD(Number(cn.appliedAmount))
												: "—"}
										</TableCell>
										<TableCell>
											<Badge
												className={`text-[10px] ${statusBadgeClass(cn.status)}`}
											>
												{cn.status}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(cn.createdAt).toLocaleDateString("en-GY")}
										</TableCell>
										<TableCell>
											<div className="flex gap-1">
												{cn.status === "issued" && balance > 0 && (
													<Button
														variant="outline"
														size="sm"
														className="h-7 px-2 text-xs"
														onClick={() => openApply(cn)}
													>
														Apply
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
														{cn.status === "draft" && (
															<DropdownMenuItem
																onClick={() => issueMut.mutate({ id: cn.id })}
															>
																Issue
															</DropdownMenuItem>
														)}
														<DropdownMenuItem
															onClick={async () => {
																const r = await openCreditNotePdf(cn);
																if (r === "popup_blocked")
																	toast.error("Allow popups to open the PDF");
															}}
														>
															<FileDown className="mr-2 size-3.5" />
															Print / Save PDF
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														{cn.status !== "voided" && (
															<DropdownMenuItem
																className="text-destructive focus:text-destructive"
																onClick={() => setVoidId(cn.id)}
															>
																Void
															</DropdownMenuItem>
														)}
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
			</Card>

			{/* Create Credit Note Dialog */}
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
							{editingId ? "Edit Credit Note" : "New Credit Note"}
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
							<div className="col-span-2 flex flex-col gap-1.5">
								<Label>Original Invoice (optional)</Label>
								<Popover
									open={invoiceComboOpen}
									onOpenChange={setInvoiceComboOpen}
								>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											type="button"
											className="w-full justify-between font-normal text-sm"
										>
											{form.originalInvoiceNumber
												? invoiceOptions.find(
														(i) =>
															i.invoiceNumber === form.originalInvoiceNumber,
													)
													? `${form.originalInvoiceNumber} — ${invoiceOptions.find((i) => i.invoiceNumber === form.originalInvoiceNumber)!.customerName}`
													: form.originalInvoiceNumber
												: "Select invoice..."}
											<ChevronsUpDown className="ml-2 size-3.5 text-muted-foreground" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-80 p-0">
										<Command>
											<CommandInput placeholder="Search invoices..." />
											<CommandList>
												<CommandEmpty>No invoices found.</CommandEmpty>
												<CommandGroup>
													{invoiceOptions.map((inv) => (
														<CommandItem
															key={inv.id}
															value={`${inv.invoiceNumber} ${inv.customerName}`}
															onSelect={() => {
																setForm((f) => ({
																	...f,
																	originalInvoiceNumber: inv.invoiceNumber,
																	customerName:
																		f.customerName || inv.customerName,
																}));
																setInvoiceComboOpen(false);
															}}
														>
															<div className="flex flex-col">
																<span className="font-mono font-semibold text-xs">
																	{inv.invoiceNumber}
																</span>
																<span className="text-muted-foreground text-xs">
																	{inv.customerName}
																</span>
															</div>
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</div>
							<div className="col-span-2 flex flex-col gap-1.5">
								<Label>Reason</Label>
								<Textarea
									placeholder="Why is this credit note being issued?"
									value={form.reason}
									onChange={(e) =>
										setForm((f) => ({ ...f, reason: e.target.value }))
									}
									className="h-16 resize-none"
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
								type="button"
								className="gap-1 self-start"
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

						{/* Department */}
						<div className="flex flex-col gap-1.5">
							<Label>Department (optional)</Label>
							<Input
								placeholder="e.g. Kitchen, Front of House, Admin"
								value={form.department}
								onChange={(e) =>
									setForm((f) => ({ ...f, department: e.target.value }))
								}
							/>
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
								<span>Total Credit</span>
								<span className="font-mono">{formatGYD(formTotal)}</span>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							type="button"
							onClick={() => setDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={!form.customerName || createMut.isPending}
						>
							{createMut.isPending ? "Saving..." : "Create Credit Note"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Apply to Invoice Dialog */}
			<Dialog
				open={!!applyDialogCN}
				onOpenChange={(open) => {
					if (!open) {
						setApplyDialogCN(null);
						setApplyInvoiceNumber("");
						setApplyAmount("");
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Apply Credit Note to Invoice</DialogTitle>
					</DialogHeader>
					{applyDialogCN && (
						<div className="flex flex-col gap-4 py-2">
							<div className="rounded-md bg-muted/40 p-3 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Credit Note</span>
									<span className="font-semibold">
										{applyDialogCN.creditNoteNumber}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Total Value</span>
									<span>{formatGYD(Number(applyDialogCN.total))}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Available Balance
									</span>
									<span className="font-semibold text-emerald-600">
										{formatGYD(
											Number(applyDialogCN.total) -
												Number(applyDialogCN.appliedAmount),
										)}
									</span>
								</div>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Invoice Number *</Label>
								<Input
									placeholder="e.g. INV-0099"
									value={applyInvoiceNumber}
									onChange={(e) => setApplyInvoiceNumber(e.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Amount to Apply (GYD) *</Label>
								<Input
									type="number"
									inputMode="decimal"
									min={0}
									max={
										Number(applyDialogCN.total) -
										Number(applyDialogCN.appliedAmount)
									}
									step="0.01"
									value={applyAmount}
									onChange={(e) => setApplyAmount(e.target.value)}
								/>
								<p className="text-muted-foreground text-xs">
									Max:{" "}
									{formatGYD(
										Number(applyDialogCN.total) -
											Number(applyDialogCN.appliedAmount),
									)}
								</p>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							type="button"
							onClick={() => {
								setApplyDialogCN(null);
								setApplyInvoiceNumber("");
								setApplyAmount("");
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleApply}
							disabled={
								!applyInvoiceNumber || !applyAmount || applyMut.isPending
							}
						>
							{applyMut.isPending ? "Applying..." : "Apply Credit"}
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
						<AlertDialogTitle>Void this credit note?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently void the credit note. Any partial
							applications already made will remain. This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => voidId && voidMut.mutate({ id: voidId })}
						>
							Void Credit Note
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
