import { useEffect } from "react";
import { Printer, Split, X } from "lucide-react";

// Prints the receipt in an isolated popup so only the receipt content is printed,
// not the entire dashboard page.
function printReceiptPopup(el: HTMLElement | null) {
	if (!el) {
		window.print();
		return;
	}
	const win = window.open(
		"",
		"_blank",
		"width=420,height=680,menubar=no,toolbar=no",
	);
	if (!win) {
		window.print();
		return;
	}
	win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
		<style>
			* { margin: 0; padding: 0; box-sizing: border-box; }
			body { font-family: monospace; font-size: 11px; background: #fff; color: #000; padding: 12px; }
			@media print { body { padding: 0; } }
		</style></head><body>${el.innerHTML}</body></html>`);
	win.document.close();
	win.focus();
	setTimeout(() => {
		win.print();
		win.close();
	}, 200);
}

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { CartItem } from "@/lib/types";
import { formatGYD } from "@/lib/types";

export interface ReceiptConfig {
	businessName: string;
	tagline: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	phone: string | null;
	footerMessage: string | null;
	promoMessage: string | null;
	showLogo: boolean;
}

interface ReceiptPreviewProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	order: Record<string, unknown> | null;
	items: CartItem[];
	change: number;
	userName: string;
	receiptConfig?: ReceiptConfig | null;
	onSplitBill?: () => void;
}

export function ReceiptPreview({
	open,
	onOpenChange,
	order,
	items,
	change,
	userName,
	receiptConfig,
	onSplitBill,
}: ReceiptPreviewProps) {
	useEffect(() => {
		if (!open) return;
		const timer = setTimeout(
			() => printReceiptPopup(document.getElementById("receipt-content")),
			300,
		);
		return () => clearTimeout(timer);
	}, [open]);

	if (!order) return null;

	const rc = receiptConfig ?? {
		businessName: "Bettencourt's Food Inc.",
		tagline: "'A True Guyanese Gem'",
		addressLine1: "Lot 12 Robb Street",
		addressLine2: "Georgetown, Guyana",
		phone: "+592-227-0000",
		footerMessage: "Thank you for choosing Bettencourt's!",
		promoMessage: null,
		showLogo: true,
	};

	const now = new Date((order.created_at as string) || Date.now());
	const subtotal = items.reduce((s, i) => s + i.line_total, 0);
	const tax = items.reduce((s, i) => s + i.line_total * i.product.tax_rate, 0);
	const total = Number(order.total || subtotal + tax);

	// Group items by department
	const departments = new Set(
		items.map((i) => i.product.department_name || "General"),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center justify-between">
						Receipt
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => onOpenChange(false)}
						>
							<X className="size-4" />
							<span className="sr-only">Close</span>
						</Button>
					</DialogTitle>
				</DialogHeader>

				<div
					id="receipt-content"
					className="rounded-lg border border-border bg-background p-5 font-mono text-xs leading-relaxed"
				>
					{/* Header */}
					<div className="mb-3 text-center">
						<p className="font-bold text-sm">{rc.businessName}</p>
						{rc.tagline && (
							<p className="text-[10px] text-muted-foreground italic">
								{rc.tagline}
							</p>
						)}
						{rc.addressLine1 && (
							<p className="text-muted-foreground">{rc.addressLine1}</p>
						)}
						{rc.addressLine2 && (
							<p className="text-muted-foreground">{rc.addressLine2}</p>
						)}
						{rc.phone && (
							<p className="text-muted-foreground">Tel: {rc.phone}</p>
						)}
					</div>

					{/* Order info */}
					<div className="mb-2 border-border border-t border-dashed pt-2">
						<div className="flex justify-between">
							<span>Order</span>
							<span className="font-bold">{String(order.order_number)}</span>
						</div>
						{!!order.daily_number && (
							<div className="flex justify-between">
								<span>Daily #</span>
								<span className="font-bold">{String(order.daily_number)}</span>
							</div>
						)}
						<div className="flex justify-between">
							<span>Date</span>
							<span>
								{now.toLocaleDateString()}{" "}
								{now.toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</div>
						<div className="flex justify-between">
							<span>Served by</span>
							<span className="font-medium">
								{String(order.user_name || userName)}
							</span>
						</div>
						{departments.size === 1 && (
							<div className="flex justify-between">
								<span>Dept</span>
								<span className="font-medium">{[...departments][0]}</span>
							</div>
						)}
						{!!order.order_type && order.order_type !== "dine_in" && (
							<div className="flex justify-between">
								<span>Type</span>
								<span className="font-bold uppercase">
									{String(order.order_type)}
								</span>
							</div>
						)}
					</div>

					{/* Pickup / Delivery details */}
					{!!order.customer_name && (
						<div className="mb-2 border-border border-t border-dashed pt-2">
							<div className="flex justify-between">
								<span>Customer</span>
								<span className="font-medium">
									{String(order.customer_name)}
								</span>
							</div>
							{!!order.customer_phone && (
								<div className="flex justify-between">
									<span>Phone</span>
									<span>{String(order.customer_phone)}</span>
								</div>
							)}
							{!!order.delivery_address && (
								<div className="flex justify-between">
									<span>Address</span>
									<span className="max-w-[50%] text-right">
										{String(order.delivery_address)}
									</span>
								</div>
							)}
							{!!order.estimated_ready_at && (
								<div className="flex justify-between">
									<span>Ready at</span>
									<span className="font-medium">
										{new Date(
											String(order.estimated_ready_at),
										).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</div>
							)}
						</div>
					)}

					{/* Items */}
					<div className="mb-2 border-border border-t border-dashed pt-2">
						{items.map((item, idx) => (
							<div key={idx} className="mb-1">
								<div className="flex justify-between">
									<span className="flex-1 truncate">
										{item.quantity > 1 ? `${item.quantity}x ` : ""}
										{item.product.name}
									</span>
									<span className="shrink-0 pl-2">
										{formatGYD(item.line_total)}
									</span>
								</div>
								{item.quantity > 1 && (
									<div className="pl-2 text-muted-foreground">
										{`@ ${formatGYD(item.product.price)} each`}
									</div>
								)}
								{item.product.is_combo &&
									(item.product.combo_components ?? []).map((cc) => (
										<div
											key={cc.id}
											className="pl-2 text-[10px] text-muted-foreground"
										>
											· {cc.component_name}
										</div>
									))}
								{departments.size > 1 && item.product.department_name && (
									<div className="pl-2 text-[10px] text-muted-foreground">
										[{item.product.department_name}]
									</div>
								)}
								{item.notes && (
									<div className="pl-2 text-[10px] text-muted-foreground italic">
										Note: {item.notes}
									</div>
								)}
							</div>
						))}
					</div>

					{/* Totals */}
					<div className="mb-2 flex flex-col gap-0.5 border-border border-t border-dashed pt-2">
						<div className="flex justify-between">
							<span>Subtotal</span>
							<span>{formatGYD(subtotal)}</span>
						</div>
						{tax > 0 && (
							<div className="flex justify-between">
								<span>Tax</span>
								<span>{formatGYD(tax)}</span>
							</div>
						)}
						{Number(order.discount_total || 0) > 0 && (
							<div className="flex justify-between text-destructive">
								<span>
									Discount
									{order.discount_label ? ` (${order.discount_label})` : ""}
								</span>
								<span>-{formatGYD(Number(order.discount_total))}</span>
							</div>
						)}
						<div className="mt-1 flex justify-between border-border border-t border-double pt-1 font-bold text-sm">
							<span>TOTAL</span>
							<span>{formatGYD(total)}</span>
						</div>
					</div>

					{/* Payment Info */}
					{!!order.payments && Array.isArray(order.payments) && (
						<div className="mb-2 border-border border-t border-dashed pt-2">
							{(
								order.payments as Array<{ method: string; amount: number }>
							).map((p, i) => (
								<div key={i} className="flex justify-between">
									<span className="capitalize">{p.method}</span>
									<span>{formatGYD(p.amount)}</span>
								</div>
							))}
						</div>
					)}

					{/* Change */}
					{change > 0 && (
						<div className="mb-2 border-border border-t border-dashed pt-2">
							<div className="flex justify-between font-bold">
								<span>Change</span>
								<span>{formatGYD(change)}</span>
							</div>
						</div>
					)}

					{/* Footer */}
					<div className="mt-3 text-center text-muted-foreground">
						{rc.footerMessage && <p>{rc.footerMessage}</p>}
						{rc.promoMessage && (
							<p className="mt-1 font-bold text-foreground">
								{rc.promoMessage}
							</p>
						)}
						{rc.tagline && <p className="text-[10px] italic">{rc.tagline}</p>}
					</div>
				</div>

				<div className="flex gap-2">
					<Button
						className="flex-1 gap-2"
						onClick={() =>
							printReceiptPopup(document.getElementById("receipt-content"))
						}
					>
						<Printer className="size-4" />
						Print
					</Button>
					{onSplitBill && (
						<Button
							variant="outline"
							className="flex-1 gap-2"
							onClick={onSplitBill}
						>
							<Split className="size-4" />
							Split
						</Button>
					)}
					<Button
						variant="outline"
						className="flex-1"
						onClick={() => onOpenChange(false)}
					>
						Done
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
