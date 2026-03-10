/**
 * Route-level permission gating for dashboard pages.
 * Exported for testability — imported by dashboard.tsx.
 * A null module means accessible to all authenticated users.
 */
export const ROUTE_MODULE_MAP: Record<string, string | null> = {
	"/dashboard/reports": "reports",
	"/dashboard/reconciliation": "reports",
	"/dashboard/eod": "reports",
	"/dashboard/analytics": "reports",
	"/dashboard/journal": "reports",
	"/dashboard/labor": "reports",
	"/dashboard/profitability": "reports",
	"/dashboard/pnl": "reports",
	"/dashboard/production-report": "reports",
	"/dashboard/inventory": "inventory",
	"/dashboard/stock-alerts": "inventory",
	"/dashboard/waste": "inventory",
	"/dashboard/variance": "inventory",
	"/dashboard/suppliers": "inventory",
	"/dashboard/suppliers/:id": "inventory",
	"/dashboard/settings": "settings",
	"/dashboard/locations": "settings",
	"/dashboard/webhooks": "settings",
	"/dashboard/notifications": "settings",
	"/dashboard/menu-schedules": "settings",
	"/dashboard/discounts": "settings",
	"/dashboard/currency": "settings",
	"/dashboard/expenses": "settings",
	"/dashboard/audit": "audit",
	"/dashboard/finance": "reports",
	"/dashboard/invoices": "invoices",
	"/dashboard/credit-notes": "invoices",
	"/dashboard/vendor-bills": "invoices",
	"/dashboard/recurring": "invoices",
	"/dashboard/aging": "reports",
	"/dashboard/customer-statements": "reports",
	"/dashboard/tax-summary": "reports",
	"/dashboard/budgets": "reports",
	"/dashboard/quotations": "quotations",
	"/dashboard/labels": "products",
	"/dashboard/tables": "orders",
	"/dashboard/loyalty": "orders",
	"/dashboard/customers": "orders",
	"/dashboard/giftcards": "orders",
	"/dashboard/products": "products",
	"/dashboard/production": "orders",
	"/dashboard/pos": "orders",
	"/dashboard/orders": "orders",
	"/dashboard/cash": "shifts",
	"/dashboard/kitchen": "orders",
	"/dashboard/timeclock": "shifts",
	"/dashboard/backup": "settings",
	"/dashboard/profile": null,
};

/**
 * Returns true if the user has permission to access the given pathname.
 * Defaults to DENY for any unmapped sub-route — access must be explicitly granted.
 * The root /dashboard is always allowed for any authenticated user.
 */
export function hasRouteAccess(
	pathname: string,
	permissions: Record<string, string[]>,
): boolean {
	for (const [prefix, module] of Object.entries(ROUTE_MODULE_MAP)) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
			// null module = accessible to all authenticated users
			if (module === null) return true;
			const perms = permissions[module];
			return Array.isArray(perms) && perms.length > 0;
		}
	}
	// Deny any unmapped dashboard sub-route — access must be explicitly granted
	return pathname === "/dashboard";
}
