// ── Shared Finance Status Badge Classes ───────────────────────────────────────
// InvoiceNinja-inspired color scheme for consistent status styling
// across all finance pages (invoices, quotations, credit notes, vendor bills,
// expenses, recurring templates).

export function statusBadgeClass(status: string): string {
	switch (status) {
		case "draft":
			return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
		case "sent":
			return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
		case "outstanding":
		case "partially_paid":
		case "partial":
			return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
		case "paid":
		case "applied":
		case "accepted":
		case "converted":
			return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
		case "overdue":
			return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
		case "cancelled":
		case "voided":
		case "rejected":
			return "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400";
		case "overpaid":
			return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
		case "received":
		case "issued":
			return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
		case "expired":
			return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
		default:
			return "bg-secondary text-secondary-foreground";
	}
}
