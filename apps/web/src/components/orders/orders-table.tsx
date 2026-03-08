import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Ban,
	Banknote,
	Clock,
	CreditCard,
	Download,
	ExternalLink,
	Filter,
	MapPin,
	Printer,
	RotateCcw,
	Search,
	ShoppingBag,
	Truck,
	User,
} from "lucide-react";
import { Fragment, useState } from "react";
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
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { formatGYD } from "@/lib/types";
import { escapeHtml } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface Order {
	id: string;
	order_number: string;
	status: string;
	order_type: string;
	total: number;
	created_at: string;
	user_name?: string;
	customer_name?: string;
	customer_phone?: string;
	delivery_address?: string;
	fulfillment_status?: string;
}

const statusVariant: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	completed: "default",
	open: "secondary",
	voided: "destructive",
	refunded: "outline",
	held: "outline",
	closed: "default",
};

const VOID_REASONS = [
	"Customer changed their mind",
	"Incorrect order entered",
	"Item out of stock",
	"Duplicate order",
	"Customer complaint / dissatisfied",
	"Payment issue",
	"Order placed in error by staff",
	"Test order",
	"Custom reason…",
] as const;

const fulfillmentColors: Record<string, string> = {
	preparing:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	ready:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
	picked_up: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	delivered: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

function printOrderPdf(
	data: NonNullable<ReturnType<typeof useOrderDetail>["data"]>,
) {
	const fmt = (n: number | string | null | undefined) =>
		new Intl.NumberFormat("en-GY", {
			style: "currency",
			currency: "GYD",
		}).format(Number(n ?? 0));

	const fmtDate = (d: Date | string | null | undefined) =>
		d
			? new Date(d instanceof Date ? d : d).toLocaleString("en-GY", {
					weekday: "short",
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				})
			: "—";

	const itemRows = (data.lineItems ?? [])
		.map((item) => {
			const mods = (() => {
				try {
					const m = item.modifiersSnapshot as Record<string, unknown>[] | null;
					if (!m || !Array.isArray(m) || m.length === 0) return "";
					return m.map((x) => `+ ${x.name ?? ""}`).join(", ");
				} catch {
					return "";
				}
			})();
			const voided = item.voided
				? ' style="text-decoration:line-through;opacity:0.45"'
				: "";
			return `<tr${voided}>
			<td>${escapeHtml(item.productNameSnapshot)}${mods ? `<br><small style="color:#666">${escapeHtml(mods)}</small>` : ""}${item.notes ? `<br><small style="color:#888;font-style:italic">${escapeHtml(item.notes)}</small>` : ""}</td>
			<td style="text-align:center">${item.quantity}</td>
			<td style="text-align:right">${fmt(item.unitPrice)}</td>
			${Number(item.discount ?? 0) > 0 ? `<td style="text-align:right;color:#dc2626">-${fmt(item.discount)}</td>` : "<td></td>"}
			<td style="text-align:right;font-weight:600">${fmt(item.total)}</td>
		</tr>`;
		})
		.join("\n");

	const payRows = (data.payments ?? [])
		.map((p) => {
			const method =
				p.method === "cash"
					? "Cash"
					: p.method === "card"
						? "Card"
						: String(p.method);
			const voided =
				p.status === "voided"
					? ' <span style="color:#dc2626;font-size:10px">(voided)</span>'
					: "";
			const tendered =
				Number(p.tendered ?? 0) > 0
					? `<br><small style="color:#666">Tendered: ${fmt(p.tendered)} · Change: ${fmt(p.changeGiven)}</small>`
					: "";
			return `<tr>
			<td>${method}${voided}${tendered}</td>
			<td style="text-align:right;font-weight:600">${fmt(p.amount)}</td>
		</tr>`;
		})
		.join("\n");

	const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Order ${data.orderNumber}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 13px; margin: 16px 0 6px; color: #555; text-transform: uppercase; letter-spacing: .05em; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-item .label { color: #888; font-size: 10px; }
  .meta-item .value { font-size: 12px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #f3f4f6; text-align: left; padding: 5px 8px; font-size: 10px; border-bottom: 2px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .totals td { border: none; padding: 3px 8px; }
  .totals .grand { font-weight: bold; font-size: 13px; border-top: 2px solid #111; padding-top: 6px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  .void-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 10px 12px; margin-top: 12px; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
  @media print { button { display: none; } }
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1>Order ${escapeHtml(data.orderNumber)}</h1><p style="margin:4px 0 0;color:#555">${fmtDate(data.createdAt)}</p></div>
  <span class="badge" style="background:#f3f4f6;color:#374151;font-size:12px;padding:4px 12px">${escapeHtml(data.status?.toUpperCase())}</span>
</div>
<hr class="divider"/>
<div class="meta">
  <div class="meta-item"><span class="label">Cashier</span><span class="value">${escapeHtml(data.cashierName) || "—"}</span></div>
  <div class="meta-item"><span class="label">Location</span><span class="value">${escapeHtml(data.locationName) || "—"}</span></div>
  <div class="meta-item"><span class="label">Register</span><span class="value">${escapeHtml(data.registerName) || "—"}</span></div>
  <div class="meta-item"><span class="label">Order Type</span><span class="value">${escapeHtml((data.type ?? "").replace("_", " "))}</span></div>
  ${data.customerName ? `<div class="meta-item"><span class="label">Customer</span><span class="value">${escapeHtml(data.customerName)}${data.customerPhone ? ` · ${escapeHtml(data.customerPhone)}` : ""}</span></div>` : ""}
  ${data.deliveryAddress ? `<div class="meta-item" style="grid-column:span 2"><span class="label">Delivery Address</span><span class="value">${escapeHtml(data.deliveryAddress)}</span></div>` : ""}
  ${data.tableId ? `<div class="meta-item"><span class="label">Table</span><span class="value">${escapeHtml(data.tableId)}</span></div>` : ""}
</div>
${data.notes ? `<p style="background:#fefce8;border:1px solid #fde047;border-radius:4px;padding:8px 12px;margin:0 0 12px">${escapeHtml(data.notes)}</p>` : ""}
<h2>Items</h2>
<table>
<thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Disc.</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${itemRows}</tbody>
</table>
<h2>Payments</h2>
<table><thead><tr><th>Method</th><th style="text-align:right">Amount</th></tr></thead><tbody>${payRows}</tbody></table>
<table class="totals">
  <tr><td style="color:#666">Subtotal</td><td style="text-align:right">${fmt(data.subtotal)}</td></tr>
  ${Number(data.discountTotal ?? 0) > 0 ? `<tr><td style="color:#dc2626">Discount</td><td style="text-align:right;color:#dc2626">-${fmt(data.discountTotal)}</td></tr>` : ""}
  ${Number(data.taxTotal ?? 0) > 0 ? `<tr><td style="color:#666">Tax (16.5% VAT)</td><td style="text-align:right">${fmt(data.taxTotal)}</td></tr>` : ""}
  <tr class="grand"><td>Total</td><td style="text-align:right">${fmt(data.total)}</td></tr>
</table>
${data.status === "voided" ? `<div class="void-box"><strong style="color:#dc2626">Order Voided</strong><br>Reason: ${escapeHtml(data.voidReason) || "—"}<br>Authorized by: ${escapeHtml(data.voidAuthorizedByName) || "—"}</div>` : ""}
<button onclick="window.print()" style="margin-top:20px;padding:8px 20px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f9fafb">Print / Save as PDF</button>
</body></html>`;
	const w = window.open("", "_blank");
	if (w) {
		w.document.write(html);
		w.document.close();
	}
}

function useOrderDetail(orderId: string | null) {
	return useQuery({
		...orpc.orders.getById.queryOptions({ input: { id: orderId ?? "" } }),
		enabled: !!orderId,
	});
}

function OrderDetailDialog({
	orderId,
	open,
	onClose,
	onVoid,
	onRefund,
	canVoid,
	userId,
}: {
	orderId: string | null;
	open: boolean;
	onClose: () => void;
	onVoid: (id: string) => void;
	onRefund: (id: string, total: number) => void;
	canVoid: boolean;
	userId?: string;
}) {
	const { data, isLoading } = useOrderDetail(orderId);
	const [voidReasonPreset, setVoidReasonPreset] = useState("");
	const [voidReason, setVoidReason] = useState("");
	const [refundReason, setRefundReason] = useState("");
	const [refundAmount, setRefundAmount] = useState("");
	const queryClient = useQueryClient();

	const voidMutation = useMutation(
		orpc.orders.void.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["orders"] });
				toast.success("Order voided");
				onClose();
			},
			onError: (e) => toast.error(e.message || "Failed to void order"),
		}),
	);

	const refundMutation = useMutation(
		orpc.orders.refund.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["orders"] });
				toast.success("Order refunded");
				onClose();
			},
			onError: (e) => toast.error(e.message || "Failed to refund order"),
		}),
	);

	const lineItems = data?.lineItems ?? [];
	const payments = data?.payments ?? [];
	const isVoidable = data?.status === "completed";

	const fmtDate = (d: Date | string | null | undefined) =>
		d
			? new Date(d instanceof Date ? d : d).toLocaleString("en-GY", {
					weekday: "short",
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				})
			: "—";

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0">
				{isLoading || !data ? (
					<div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
						{isLoading ? "Loading…" : "Order not found"}
					</div>
				) : (
					<>
						{/* Header */}
						<DialogHeader className="shrink-0 border-b px-6 py-4">
							<div className="flex items-start justify-between gap-4">
								<div>
									<DialogTitle className="font-bold text-xl">
										Order {data.orderNumber}
									</DialogTitle>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{fmtDate(data.createdAt)}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant={statusVariant[data.status ?? ""] || "secondary"}
										className="text-sm"
									>
										{data.status}
									</Badge>
									{data.fulfillmentStatus &&
										data.fulfillmentStatus !== "none" && (
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${fulfillmentColors[data.fulfillmentStatus] ?? ""}`}
											>
												{data.fulfillmentStatus.replace("_", " ")}
											</span>
										)}
								</div>
							</div>
						</DialogHeader>

						{/* Scrollable body */}
						<div className="flex-1 overflow-y-auto px-6 py-4">
							<div className="flex flex-col gap-6">
								{/* Transaction meta */}
								<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
									<div className="flex flex-col gap-0.5">
										<p className="flex items-center gap-1 text-muted-foreground text-xs">
											<User className="size-3" /> Cashier
										</p>
										<p className="font-medium text-sm">
											{data.cashierName ?? "—"}
										</p>
									</div>
									<div className="flex flex-col gap-0.5">
										<p className="flex items-center gap-1 text-muted-foreground text-xs">
											<MapPin className="size-3" /> Location
										</p>
										<p className="font-medium text-sm">
											{data.locationName ?? "—"}
										</p>
									</div>
									<div className="flex flex-col gap-0.5">
										<p className="text-muted-foreground text-xs">Register</p>
										<p className="font-medium text-sm">
											{data.registerName ?? "—"}
										</p>
									</div>
									<div className="flex flex-col gap-0.5">
										<p className="text-muted-foreground text-xs">Order Type</p>
										<p className="font-medium text-sm capitalize">
											{(data.type ?? "").replace("_", " ") || "Walk-in"}
										</p>
									</div>
									{data.tableId && (
										<div className="flex flex-col gap-0.5">
											<p className="text-muted-foreground text-xs">Table</p>
											<p className="font-medium text-sm">{data.tableId}</p>
										</div>
									)}
									{data.isSplit && (
										<div className="flex flex-col gap-0.5">
											<p className="text-muted-foreground text-xs">
												Split Order
											</p>
											<Badge variant="outline" className="w-fit text-xs">
												Split
											</Badge>
										</div>
									)}
									{data.updatedAt && data.status !== "open" && (
										<div className="flex flex-col gap-0.5">
											<p className="text-muted-foreground text-xs">Closed At</p>
											<p className="font-medium text-sm">
												{fmtDate(data.updatedAt)}
											</p>
										</div>
									)}
								</div>

								{/* Customer */}
								{(data.customerName || data.deliveryAddress) && (
									<div className="rounded-lg border border-border bg-muted/20 p-3">
										<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
											Customer
										</p>
										<div className="grid grid-cols-2 gap-3">
											{data.customerName && (
												<div className="flex flex-col gap-0.5">
													<p className="text-muted-foreground text-xs">Name</p>
													<p className="font-medium text-sm">
														{data.customerName}
													</p>
												</div>
											)}
											{data.customerPhone && (
												<div className="flex flex-col gap-0.5">
													<p className="text-muted-foreground text-xs">Phone</p>
													<p className="font-medium text-sm">
														{data.customerPhone}
													</p>
												</div>
											)}
											{data.deliveryAddress && (
												<div className="col-span-2 flex flex-col gap-0.5">
													<p className="text-muted-foreground text-xs">
														Delivery Address
													</p>
													<p className="font-medium text-sm">
														{data.deliveryAddress}
													</p>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Notes */}
								{data.notes && (
									<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
										<p className="mb-1 font-semibold text-amber-700 text-xs uppercase tracking-wider dark:text-amber-400">
											Notes
										</p>
										<p className="text-sm">{data.notes}</p>
									</div>
								)}

								{/* Line Items */}
								<div>
									<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Items ({lineItems.filter((i) => !i.voided).length} active
										{lineItems.some((i) => i.voided)
											? `, ${lineItems.filter((i) => i.voided).length} voided`
											: ""}
										)
									</p>
									<div className="rounded-md border border-border">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead className="h-8 text-xs">Product</TableHead>
													<TableHead className="h-8 text-right text-xs">
														Qty
													</TableHead>
													<TableHead className="h-8 text-right text-xs">
														Price
													</TableHead>
													<TableHead className="h-8 text-right text-xs">
														Disc.
													</TableHead>
													<TableHead className="h-8 text-right text-xs">
														Total
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{lineItems.map((item, i) => {
													const mods = (() => {
														try {
															const m = item.modifiersSnapshot as
																| Record<string, unknown>[]
																| null;
															if (!m || !Array.isArray(m) || m.length === 0)
																return null;
															return m
																.map((x) => String(x.name ?? ""))
																.filter(Boolean);
														} catch {
															return null;
														}
													})();
													return (
														<TableRow
															key={i}
															className={
																item.voided ? "line-through opacity-45" : ""
															}
														>
															<TableCell className="py-1.5 text-xs">
																<span className="font-medium">
																	{item.productNameSnapshot}
																</span>
																{item.voided && (
																	<Badge
																		variant="destructive"
																		className="ml-1.5 text-[9px]"
																	>
																		Voided
																	</Badge>
																)}
																{mods && mods.length > 0 && (
																	<div className="mt-0.5 flex flex-wrap gap-1">
																		{mods.map((m) => (
																			<span
																				key={m}
																				className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
																			>
																				+ {m}
																			</span>
																		))}
																	</div>
																)}
																{item.notes && (
																	<span className="mt-0.5 block text-[10px] text-muted-foreground italic">
																		{item.notes}
																	</span>
																)}
															</TableCell>
															<TableCell className="py-1.5 text-right text-xs">
																{item.quantity}
															</TableCell>
															<TableCell className="py-1.5 text-right font-mono text-xs">
																{formatGYD(Number(item.unitPrice))}
															</TableCell>
															<TableCell className="py-1.5 text-right font-mono text-destructive text-xs">
																{Number(item.discount ?? 0) > 0
																	? `-${formatGYD(Number(item.discount))}`
																	: "—"}
															</TableCell>
															<TableCell className="py-1.5 text-right font-mono text-xs">
																{formatGYD(Number(item.total))}
															</TableCell>
														</TableRow>
													);
												})}
											</TableBody>
										</Table>
									</div>
								</div>

								{/* Payments + Totals */}
								<div className="grid gap-4 sm:grid-cols-2">
									<div>
										<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
											Payments
										</p>
										<div className="flex flex-col gap-2">
											{payments.map((p, i) => (
												<div
													key={i}
													className={`rounded-md border border-border p-3 ${p.status === "voided" ? "opacity-50" : ""}`}
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2 text-sm">
															{p.method === "cash" ? (
																<Banknote className="size-3.5 text-green-600" />
															) : (
																<CreditCard className="size-3.5 text-blue-600" />
															)}
															<span className="font-medium capitalize">
																{p.method}
															</span>
															{p.status === "voided" && (
																<Badge
																	variant="destructive"
																	className="text-[10px]"
																>
																	Voided
																</Badge>
															)}
														</div>
														<span className="font-mono font-semibold text-sm">
															{formatGYD(Number(p.amount))}
														</span>
													</div>
													{Number(p.tendered ?? 0) > 0 && (
														<div className="mt-1.5 flex flex-col gap-0.5 border-border border-t pt-1.5">
															<div className="flex justify-between text-muted-foreground text-xs">
																<span>Tendered</span>
																<span className="font-mono">
																	{formatGYD(Number(p.tendered))}
																</span>
															</div>
															<div className="flex justify-between text-muted-foreground text-xs">
																<span>Change given</span>
																<span className="font-mono">
																	{formatGYD(Number(p.changeGiven ?? 0))}
																</span>
															</div>
														</div>
													)}
												</div>
											))}
										</div>
									</div>

									<div>
										<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
											Totals
										</p>
										<div className="rounded-md bg-muted/40 p-3">
											<div className="flex flex-col gap-1.5">
												<div className="flex justify-between text-muted-foreground text-xs">
													<span>Subtotal</span>
													<span className="font-mono">
														{formatGYD(Number(data.subtotal ?? 0))}
													</span>
												</div>
												{Number(data.discountTotal ?? 0) > 0 && (
													<div className="flex justify-between text-destructive text-xs">
														<span>Discount</span>
														<span className="font-mono">
															-{formatGYD(Number(data.discountTotal))}
														</span>
													</div>
												)}
												{Number(data.taxTotal ?? 0) > 0 && (
													<div className="flex justify-between text-muted-foreground text-xs">
														<span>Tax (16.5% VAT)</span>
														<span className="font-mono">
															{formatGYD(Number(data.taxTotal))}
														</span>
													</div>
												)}
												<div className="flex justify-between border-border border-t pt-1.5 font-bold text-sm">
													<span>Total</span>
													<span className="font-mono">
														{formatGYD(Number(data.total))}
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Void info */}
								{data.status === "voided" && (
									<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
										<p className="mb-2 font-semibold text-destructive text-xs uppercase tracking-wider">
											Void Information
										</p>
										<div className="grid grid-cols-2 gap-3">
											<div className="flex flex-col gap-0.5">
												<p className="text-muted-foreground text-xs">Reason</p>
												<p className="text-sm">{data.voidReason ?? "—"}</p>
											</div>
											<div className="flex flex-col gap-0.5">
												<p className="text-muted-foreground text-xs">
													Authorized By
												</p>
												<p className="text-sm">
													{data.voidAuthorizedByName ?? "—"}
												</p>
											</div>
											{data.voidAuthorizedAt && (
												<div className="flex flex-col gap-0.5">
													<p className="text-muted-foreground text-xs">
														Voided At
													</p>
													<p className="text-sm">
														{fmtDate(data.voidAuthorizedAt)}
													</p>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Footer actions */}
						<div className="flex shrink-0 items-center justify-between border-t px-6 py-3">
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="outline"
									className="gap-1.5"
									onClick={() => printOrderPdf(data)}
								>
									<Printer className="size-3.5" />
									Print PDF
								</Button>
							</div>
							{canVoid && isVoidable && (
								<div className="flex gap-2">
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												size="sm"
												variant="ghost"
												className="gap-1 text-destructive hover:text-destructive"
											>
												<Ban className="size-3.5" />
												Void
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Void Order {data.orderNumber}?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This will void the order totalling{" "}
													{formatGYD(Number(data.total))} and reverse any cash
													session entries. This action is logged in the audit
													trail.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<div className="flex flex-col gap-2">
												<Select
													value={voidReasonPreset}
													onValueChange={(v) => {
														setVoidReasonPreset(v);
														if (v !== "custom") setVoidReason(v);
														else setVoidReason("");
													}}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select a reason…" />
													</SelectTrigger>
													<SelectContent>
														{VOID_REASONS.map((r) => (
															<SelectItem
																key={r}
																value={r === "Custom reason…" ? "custom" : r}
															>
																{r}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												{voidReasonPreset === "custom" && (
													<Input
														placeholder="Enter custom reason (required)"
														value={voidReason}
														onChange={(e) => setVoidReason(e.target.value)}
														autoFocus
													/>
												)}
											</div>
											<AlertDialogFooter>
												<AlertDialogCancel
													onClick={() => {
														setVoidReason("");
														setVoidReasonPreset("");
													}}
												>
													Cancel
												</AlertDialogCancel>
												<AlertDialogAction
													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													disabled={
														!voidReason.trim() || voidMutation.isPending
													}
													onClick={() => {
														if (!orderId) return;
														voidMutation.mutate({
															id: orderId,
															reason: voidReason,
														});
														setVoidReason("");
														setVoidReasonPreset("");
													}}
												>
													{voidMutation.isPending ? "Voiding…" : "Confirm Void"}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>

									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												size="sm"
												variant="ghost"
												className="gap-1 text-amber-600 hover:text-amber-700"
												onClick={() => setRefundAmount(String(data.total))}
											>
												<RotateCcw className="size-3.5" />
												Refund
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Refund Order {data.orderNumber}?
												</AlertDialogTitle>
												<AlertDialogDescription>
													Full order total is {formatGYD(Number(data.total))}.
													Enter a partial amount for partial refunds.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<div className="flex flex-col gap-3">
												<Input
													type="number"
													placeholder={`Amount (default: ${data.total})`}
													value={refundAmount}
													onChange={(e) => setRefundAmount(e.target.value)}
												/>
												<Input
													placeholder="Reason for refund (required)"
													value={refundReason}
													onChange={(e) => setRefundReason(e.target.value)}
												/>
											</div>
											<AlertDialogFooter>
												<AlertDialogCancel
													onClick={() => {
														setRefundReason("");
														setRefundAmount("");
													}}
												>
													Cancel
												</AlertDialogCancel>
												<AlertDialogAction
													className="bg-amber-600 text-white hover:bg-amber-700"
													disabled={
														!refundReason.trim() || refundMutation.isPending
													}
													onClick={() => {
														if (!orderId) return;
														refundMutation.mutate({
															id: orderId,
															reason: refundReason,
															amount: refundAmount
																? Number(refundAmount)
																: Number(data.total),
														});
														setRefundReason("");
														setRefundAmount("");
													}}
												>
													{refundMutation.isPending
														? "Refunding…"
														: "Confirm Refund"}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							)}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

export function OrdersTable({
	orders: initialOrders,
	userId,
	userRole,
	search = "",
	onSearchChange,
	statusFilter = "all",
	onStatusFilterChange,
	dateFrom = "",
	onDateFromChange,
	dateTo = "",
	onDateToChange,
}: {
	orders: Order[];
	userId?: string;
	userRole?: string;
	search?: string;
	onSearchChange?: (v: string) => void;
	statusFilter?: string;
	onStatusFilterChange?: (v: string) => void;
	dateFrom?: string;
	onDateFromChange?: (v: string) => void;
	dateTo?: string;
	onDateToChange?: (v: string) => void;
}) {
	const orders = initialOrders;
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

	const canVoid = userRole === "admin" || userRole === "executive";

	const q = search.trim().toLowerCase();
	const filtered = orders.filter((o) => {
		if (typeFilter !== "all" && o.order_type !== typeFilter) return false;
		if (q) {
			const matchesNumber = o.order_number.toLowerCase().includes(q);
			const matchesCustomer = (o.customer_name ?? "").toLowerCase().includes(q);
			if (!matchesNumber && !matchesCustomer) return false;
		}
		return true;
	});

	const orderTypeIcon = (type: string) => {
		switch (type) {
			case "pickup":
				return <Clock className="size-3" />;
			case "delivery":
				return <Truck className="size-3" />;
			default:
				return <ShoppingBag className="size-3" />;
		}
	};

	return (
		<>
			<div className="flex flex-col gap-3">
				{/* Filter bar */}
				<div className="flex flex-wrap items-center gap-3">
					<Filter className="size-4 shrink-0 text-muted-foreground" />

					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Order # or customer…"
							value={search}
							onChange={(e) => onSearchChange?.(e.target.value)}
							className="h-9 w-52 pl-9"
						/>
					</div>

					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="h-9 w-44">
							<SelectValue placeholder="All order types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							<SelectItem value="dine_in">Walk-in / Dine-in</SelectItem>
							<SelectItem value="pickup">Pickup</SelectItem>
							<SelectItem value="delivery">Delivery</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={statusFilter}
						onValueChange={(v) => onStatusFilterChange?.(v)}
					>
						<SelectTrigger className="h-9 w-40">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="open">Open</SelectItem>
							<SelectItem value="voided">Voided</SelectItem>
							<SelectItem value="refunded">Refunded</SelectItem>
							<SelectItem value="held">Held</SelectItem>
						</SelectContent>
					</Select>

					<Input
						type="date"
						value={dateFrom}
						onChange={(e) => onDateFromChange?.(e.target.value)}
						className="h-9 w-40"
						aria-label="From date"
					/>
					<span className="text-muted-foreground text-sm">to</span>
					<Input
						type="date"
						value={dateTo}
						onChange={(e) => onDateToChange?.(e.target.value)}
						className="h-9 w-40"
						aria-label="To date"
					/>

					<span className="ml-auto text-muted-foreground text-sm">
						{filtered.length} orders
					</span>
				</div>

				<div className="overflow-x-auto rounded-lg border">
					<Table className="min-w-[640px]">
						<TableHeader>
							<TableRow>
								<TableHead>Order #</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Cashier</TableHead>
								<TableHead>Customer</TableHead>
								<TableHead className="text-right">Total</TableHead>
								<TableHead>Time</TableHead>
								<TableHead className="w-8" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{filtered.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="h-24 text-center">
										No orders found
									</TableCell>
								</TableRow>
							) : (
								filtered.map((order) => (
									<Fragment key={order.id}>
										<TableRow
											className="cursor-pointer hover:bg-muted/50"
											onClick={() => setViewingOrderId(order.id)}
										>
											<TableCell className="font-medium font-mono text-sm">
												{order.order_number}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1.5">
													<Badge
														variant={statusVariant[order.status] || "secondary"}
													>
														{order.status}
													</Badge>
													{order.fulfillment_status &&
														order.fulfillment_status !== "none" && (
															<span
																className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[10px] ${fulfillmentColors[order.fulfillment_status] || ""}`}
															>
																{order.fulfillment_status.replace("_", " ")}
															</span>
														)}
												</div>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1.5 text-sm capitalize">
													{orderTypeIcon(order.order_type)}
													{order.order_type?.replace("_", " ") || "walk-in"}
												</div>
											</TableCell>
											<TableCell className="font-medium text-sm">
												{order.user_name || "-"}
											</TableCell>
											<TableCell className="text-sm">
												{order.customer_name ? (
													<div className="flex flex-col">
														<span className="font-medium">
															{order.customer_name}
														</span>
														{order.customer_phone && (
															<span className="text-muted-foreground text-xs">
																{order.customer_phone}
															</span>
														)}
													</div>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{formatGYD(Number(order.total))}
											</TableCell>
											<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
												{new Date(order.created_at).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</TableCell>
											<TableCell>
												<ExternalLink className="size-3.5 text-muted-foreground" />
											</TableCell>
										</TableRow>
									</Fragment>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			<OrderDetailDialog
				orderId={viewingOrderId}
				open={!!viewingOrderId}
				onClose={() => setViewingOrderId(null)}
				onVoid={(id) => setViewingOrderId(null)}
				onRefund={(id) => setViewingOrderId(null)}
				canVoid={canVoid}
				userId={userId}
			/>
		</>
	);
}
