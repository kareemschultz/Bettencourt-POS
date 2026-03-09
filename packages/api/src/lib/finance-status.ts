import { ORPCError } from "@orpc/server";

// ── Allowed Status Transitions ─────────────────────────────────────────

const INVOICE_TRANSITIONS: Record<string, string[]> = {
	draft: ["sent", "voided"],
	sent: ["partially_paid", "paid", "overdue", "voided"],
	partially_paid: ["paid", "overdue", "voided"],
	paid: ["voided"],
	overdue: ["partially_paid", "paid", "voided"],
	voided: [],
};

const CREDIT_NOTE_TRANSITIONS: Record<string, string[]> = {
	draft: ["issued", "voided"],
	issued: ["applied", "voided"],
	applied: ["voided"],
	voided: [],
};

const VENDOR_BILL_TRANSITIONS: Record<string, string[]> = {
	draft: ["received", "voided"],
	received: ["partially_paid", "paid", "overdue", "voided"],
	partially_paid: ["paid", "overdue", "voided"],
	paid: ["voided"],
	overdue: ["partially_paid", "paid", "voided"],
	voided: [],
};

const TRANSITIONS: Record<string, Record<string, string[]>> = {
	invoice: INVOICE_TRANSITIONS,
	credit_note: CREDIT_NOTE_TRANSITIONS,
	vendor_bill: VENDOR_BILL_TRANSITIONS,
};

/**
 * Asserts a status transition is valid for the given entity type.
 * Throws ORPCError("BAD_REQUEST") if the transition is not allowed.
 */
export function assertTransition(
	entityType: "invoice" | "credit_note" | "vendor_bill",
	fromStatus: string,
	toStatus: string,
): void {
	const allowed = TRANSITIONS[entityType]?.[fromStatus] ?? [];
	if (!allowed.includes(toStatus)) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Invalid status transition for ${entityType}: ${fromStatus} → ${toStatus}. Allowed: ${allowed.join(", ") || "none"}`,
		});
	}
}

/**
 * Computes the correct invoice/vendor-bill status based on
 * total, amount paid, and due date.
 */
export function computeInvoiceStatus(
	total: number,
	amountPaid: number,
	dueDate: Date | null | undefined,
	currentStatus: string,
): string {
	// Voided stays voided
	if (currentStatus === "voided") return "voided";

	const balance = total - amountPaid;

	if (balance <= 0) return "paid";

	if (amountPaid > 0) return "partially_paid";

	// Check overdue (only for non-draft statuses)
	if (
		currentStatus !== "draft" &&
		dueDate &&
		new Date() > dueDate &&
		amountPaid === 0
	) {
		return "overdue";
	}

	return currentStatus === "draft" ? "draft" : currentStatus;
}
