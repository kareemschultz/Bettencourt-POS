import type { ReceiptConfig } from "@/components/pos/receipt-preview";
import type { CartItem } from "./types";

const W = 32;
const ESC = "\x1b";
const GS = "\x1d";

const CMD = {
	INIT: `${ESC}@`,
	LEFT: `${ESC}a\x00`,
	CENTER: `${ESC}a\x01`,
	BOLD_ON: `${ESC}E\x01`,
	BOLD_OFF: `${ESC}E\x00`,
	DOUBLE_ON: `${ESC}!\x30`,
	DOUBLE_OFF: `${ESC}!\x00`,
	FEED: `${ESC}d\x04`,
	CUT: `${GS}V\x41\x03`,
} as const;

function pad(left: string, right: string, width = W): string {
	const space = width - left.length - right.length;
	return left + " ".repeat(Math.max(1, space)) + right;
}

function sep(char = "-"): string {
	return char.repeat(W);
}

function fmt(n: number): string {
	return "$" + Math.round(n).toLocaleString("en-US");
}

export function buildEscPosReceipt(
	order: Record<string, unknown>,
	items: CartItem[],
	change: number,
	userName: string,
	rc: ReceiptConfig,
): string[] {
	const lines: string[] = [CMD.INIT];

	// Header
	lines.push(CMD.CENTER);
	lines.push(
		CMD.BOLD_ON +
			CMD.DOUBLE_ON +
			rc.businessName.toUpperCase() +
			"\n" +
			CMD.DOUBLE_OFF +
			CMD.BOLD_OFF,
	);
	if (rc.tagline) lines.push(rc.tagline + "\n");
	if (rc.addressLine1) lines.push(rc.addressLine1 + "\n");
	if (rc.addressLine2) lines.push(rc.addressLine2 + "\n");
	if (rc.phone) lines.push("Tel: " + rc.phone + "\n");
	lines.push(sep() + "\n");

	// Order info
	lines.push(CMD.LEFT);
	const now = new Date((order.created_at as string) || Date.now());
	const num = String(order.daily_number ?? 0).padStart(3, "0");
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const receiptNum = `BET-${now.getFullYear()}${month}-${num}`;
	lines.push(pad("Receipt #", receiptNum) + "\n");
	lines.push(
		pad(
			"Date",
			now.toLocaleDateString() +
				" " +
				now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		) + "\n",
	);
	lines.push(pad("Served by", String(order.user_name || userName)) + "\n");
	if (order.order_type && order.order_type !== "dine_in") {
		lines.push(
			pad("Type", String(order.order_type).toUpperCase().replace("_", " ")) +
				"\n",
		);
	}
	lines.push(sep() + "\n");

	// Items
	for (const item of items) {
		const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
		const name = (qty + item.product.name).slice(0, W - 9);
		lines.push(pad(name, fmt(item.line_total)) + "\n");
		if (item.quantity > 1)
			lines.push("  @ " + fmt(item.product.price) + " each\n");
		if (item.notes) lines.push("  Note: " + item.notes.slice(0, W - 9) + "\n");
	}
	lines.push(sep() + "\n");

	// Totals
	const subtotal = items.reduce((s, i) => s + i.line_total, 0);
	const tax = items.reduce((s, i) => s + i.line_total * i.product.tax_rate, 0);
	const total = Number(order.total || subtotal + tax);
	lines.push(pad("Subtotal", fmt(subtotal)) + "\n");
	if (tax > 0) lines.push(pad("Tax", fmt(tax)) + "\n");
	if (Number(order.discount_total ?? 0) > 0) {
		lines.push(pad("Discount", "-" + fmt(Number(order.discount_total))) + "\n");
	}
	lines.push(sep("=") + "\n");
	lines.push(CMD.BOLD_ON + pad("TOTAL", fmt(total)) + CMD.BOLD_OFF + "\n");
	lines.push(sep() + "\n");

	// Payments
	if (Array.isArray(order.payments)) {
		for (const p of order.payments as Array<{
			method: string;
			amount: number;
		}>) {
			const method = p.method.charAt(0).toUpperCase() + p.method.slice(1);
			lines.push(pad(method, fmt(p.amount)) + "\n");
		}
	}
	if (change > 0)
		lines.push(CMD.BOLD_ON + pad("Change", fmt(change)) + CMD.BOLD_OFF + "\n");

	// Footer
	if (rc.footerMessage || rc.promoMessage) {
		lines.push(sep() + "\n");
		lines.push(CMD.CENTER);
		if (rc.footerMessage) lines.push(rc.footerMessage + "\n");
		if (rc.promoMessage)
			lines.push(CMD.BOLD_ON + rc.promoMessage + CMD.BOLD_OFF + "\n");
	}

	lines.push(CMD.FEED + CMD.CUT);
	return lines;
}
