/**
 * Single source of truth for all module and navigation definitions.
 * Replaces duplicate nav arrays previously spread across app-sidebar.tsx,
 * command-palette.tsx, route-access.ts, and dashboard.tsx PAGE_TITLES.
 */
import type { LucideIcon } from "lucide-react";
import {
	AlertTriangle,
	Banknote,
	BarChart3,
	Bell,
	BookOpen,
	Building2,
	Calculator,
	CalendarClock,
	ChefHat,
	ClipboardCheck,
	ClipboardList,
	Clock,
	CookingPot,
	DollarSign,
	FileText,
	Gift,
	GitCompareArrows,
	HardDrive,
	Landmark,
	LayoutDashboard,
	ListOrdered,
	MapPin,
	MessageCircle,
	Percent,
	PieChart,
	Receipt,
	ReceiptText,
	RefreshCw,
	Salad,
	Scale,
	Settings,
	Shield,
	ShoppingCart,
	Star,
	Tag,
	Target,
	Trash2,
	TrendingUp,
	Truck,
	Users,
	Utensils,
	UtensilsCrossed,
	Warehouse,
	Webhook,
} from "lucide-react";
import type { AppUser } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface NavItem {
	title: string;
	url: string;
	icon: LucideIcon;
	/** Permission module required (null = accessible to all authenticated users) */
	module: string | null;
	roles: string[];
	/** Human-readable title shown in page header */
	pageTitle: string;
	/** When true, hidden from sidebar and command palette (page still accessible via URL) */
	hidden?: boolean;
}

export interface ModuleStyles {
	borderHover: string;
	bgHover: string;
	iconBg: string;
	iconColor: string;
}

export interface ModuleDefinition {
	id: string;
	label: string;
	description: string;
	icon: LucideIcon;
	styles: ModuleStyles;
	defaultUrl: string;
	items: NavItem[];
}

// ── Role-gated module sets ───────────────────────────────────────────────

export const WAREHOUSE_MODULES = new Set([
	"dashboard",
	"inventory",
	"products",
]);

export const ACCOUNTANT_MODULES = new Set([
	"dashboard",
	"reports",
	"invoices",
	"quotations",
	"settings",
	"shifts",
	"orders",
]);

// ── Access helpers ───────────────────────────────────────────────────────

export function canSeeItem(
	user: AppUser,
	item: { module: string | null; roles?: string[] },
): boolean {
	if (user.role === "warehouse") {
		const mod = item.module ?? "dashboard";
		return WAREHOUSE_MODULES.has(mod);
	}
	if (user.role === "accountant") {
		const mod = item.module ?? "dashboard";
		return ACCOUNTANT_MODULES.has(mod);
	}
	if (item.roles && item.roles.length > 0) {
		if (!item.roles.includes(user.role)) return false;
	}
	if (item.module) {
		const perms = user.permissions[item.module];
		return Array.isArray(perms) && perms.length > 0;
	}
	return true;
}

/**
 * Returns true if a user should see this module's card/group in the UI.
 * Accountants see Finance only; warehouse users see Inventory only.
 */
export function canSeeModule(user: AppUser, mod: ModuleDefinition): boolean {
	if (user.role === "accountant" && mod.id !== "finance") return false;
	if (user.role === "warehouse" && mod.id !== "inventory") return false;
	return mod.items.some((item) => canSeeItem(user, item));
}

// ── Module definitions ───────────────────────────────────────────────────

export const MODULES: ModuleDefinition[] = [
	{
		id: "pos",
		label: "POS & Sales",
		description: "Sales, orders & customers",
		icon: ShoppingCart,
		styles: {
			borderHover: "group-hover:border-emerald-500/50",
			bgHover: "group-hover:bg-emerald-500/5",
			iconBg: "bg-emerald-500/10",
			iconColor: "text-emerald-500",
		},
		defaultUrl: "/dashboard/pos",
		items: [
			{
				title: "Dashboard",
				url: "/dashboard",
				icon: LayoutDashboard,
				module: null,
				roles: ["executive", "admin", "cashier"],
				pageTitle: "Dashboard",
			},
			{
				title: "New Sale",
				url: "/dashboard/pos",
				icon: UtensilsCrossed,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
				pageTitle: "New Sale",
			},
			{
				title: "Orders",
				url: "/dashboard/orders",
				icon: ClipboardList,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
				pageTitle: "Orders",
			},
			{
				title: "Tables",
				url: "/dashboard/tables",
				icon: Utensils,
				module: "orders",
				roles: ["executive", "admin"],
				pageTitle: "Tables",
			},
			{
				title: "Customers",
				url: "/dashboard/customers",
				icon: Users,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
				pageTitle: "Customers",
			},
			{
				title: "Loyalty Program",
				url: "/dashboard/loyalty",
				icon: Star,
				module: "orders",
				roles: ["executive", "admin"],
				pageTitle: "Loyalty Program",
			},
			{
				title: "Gift Cards",
				url: "/dashboard/giftcards",
				icon: Gift,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
				pageTitle: "Gift Cards",
			},
			{
				title: "Pricelists",
				url: "/dashboard/pricelists",
				icon: Tag,
				module: "products",
				roles: ["executive", "admin"],
				pageTitle: "Pricelists",
			},
			{
				title: "Cash Control",
				url: "/dashboard/cash",
				icon: DollarSign,
				module: "shifts",
				roles: ["executive", "admin", "cashier"],
				pageTitle: "Cash Control",
			},
		],
	},
	{
		id: "kitchen",
		label: "Kitchen & Production",
		description: "Kitchen, production & scheduling",
		icon: ChefHat,
		styles: {
			borderHover: "group-hover:border-orange-500/50",
			bgHover: "group-hover:bg-orange-500/5",
			iconBg: "bg-orange-500/10",
			iconColor: "text-orange-500",
		},
		defaultUrl: "/dashboard/kitchen",
		items: [
			{
				title: "Kitchen Display",
				url: "/dashboard/kitchen",
				icon: ChefHat,
				module: "orders",
				roles: ["executive", "admin", "cashier", "checkoff"],
				pageTitle: "Kitchen Display",
			},
			{
				title: "Production Board",
				url: "/dashboard/production",
				icon: CookingPot,
				module: null,
				roles: ["executive", "admin", "checkoff"],
				pageTitle: "Production",
			},
			{
				title: "Production Report",
				url: "/dashboard/production-report",
				icon: BarChart3,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Production Report",
			},
			{
				title: "Menu Calendar",
				url: "/dashboard/menu-schedules",
				icon: CalendarClock,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Menu Calendar",
			},
			{
				title: "Time Clock",
				url: "/dashboard/timeclock",
				icon: Clock,
				module: null,
				roles: ["executive", "admin", "cashier", "checkoff"],
				pageTitle: "Time Clock",
			},
			{
				title: "Shift Schedule",
				url: "/dashboard/shifts",
				icon: ClipboardCheck,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Shift Schedule",
			},
			{
				title: "Waitlist",
				url: "/dashboard/waitlist",
				icon: ListOrdered,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
				pageTitle: "Waitlist",
			},
		],
	},
	{
		id: "inventory",
		label: "Inventory",
		description: "Products, stock & suppliers",
		icon: Warehouse,
		styles: {
			borderHover: "group-hover:border-indigo-500/50",
			bgHover: "group-hover:bg-indigo-500/5",
			iconBg: "bg-indigo-500/10",
			iconColor: "text-indigo-500",
		},
		defaultUrl: "/dashboard/inventory",
		items: [
			{
				title: "Products",
				url: "/dashboard/products",
				icon: Salad,
				module: "products",
				roles: ["executive", "admin", "cashier"],
				pageTitle: "Products",
			},
			{
				title: "Inventory",
				url: "/dashboard/inventory",
				icon: Warehouse,
				module: "inventory",
				roles: ["executive", "admin"],
				pageTitle: "Inventory",
			},
			{
				title: "Purchase Orders",
				url: "/dashboard/inventory?tab=purchase-orders",
				icon: Truck,
				module: "inventory",
				roles: ["executive", "admin"],
				pageTitle: "Purchase Orders",
			},
			{
				title: "Stock Alerts",
				url: "/dashboard/stock-alerts",
				icon: AlertTriangle,
				module: "inventory",
				roles: ["executive", "admin"],
				pageTitle: "Stock Alerts",
			},
			{
				title: "Labels",
				url: "/dashboard/labels",
				icon: Tag,
				module: "products",
				roles: ["executive", "admin"],
				pageTitle: "Labels",
			},
			{
				title: "Waste & Shrinkage",
				url: "/dashboard/waste",
				icon: Trash2,
				module: "inventory",
				roles: ["executive", "admin"],
				pageTitle: "Waste & Shrinkage",
			},
			{
				title: "Stock Variance",
				url: "/dashboard/variance",
				icon: GitCompareArrows,
				module: "inventory",
				roles: ["executive", "admin"],
				pageTitle: "Stock Variance",
			},
			{
				title: "Suppliers",
				url: "/dashboard/suppliers",
				icon: Building2,
				module: "inventory",
				roles: ["executive", "admin"],
				pageTitle: "Suppliers",
			},
		],
	},
	{
		id: "finance",
		label: "Finance",
		description: "Invoices, expenses & reporting",
		icon: Landmark,
		styles: {
			borderHover: "group-hover:border-teal-500/50",
			bgHover: "group-hover:bg-teal-500/5",
			iconBg: "bg-teal-500/10",
			iconColor: "text-teal-500",
		},
		defaultUrl: "/dashboard/finance",
		items: [
			{
				title: "Finance Dashboard",
				url: "/dashboard/finance",
				icon: TrendingUp,
				module: "reports",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Finance Dashboard",
			},
			{
				title: "Invoices",
				url: "/dashboard/invoices",
				icon: Receipt,
				module: "invoices",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Invoices",
			},
			{
				title: "Quotations",
				url: "/dashboard/quotations",
				icon: FileText,
				module: "quotations",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Quotations",
			},
			{
				title: "Credit Notes",
				url: "/dashboard/credit-notes",
				icon: FileText,
				module: "invoices",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Credit Notes",
			},
			{
				title: "Vendor Bills",
				url: "/dashboard/vendor-bills",
				icon: Truck,
				module: "invoices",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Vendor Bills",
			},
			{
				title: "Recurring",
				url: "/dashboard/recurring",
				icon: RefreshCw,
				module: "invoices",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Recurring",
				hidden: true,
			},
			{
				title: "Expenses",
				url: "/dashboard/expenses",
				icon: ReceiptText,
				module: "settings",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Expenses",
			},
			{
				title: "Aging Report",
				url: "/dashboard/aging",
				icon: Clock,
				module: "reports",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Aging Report",
				hidden: true,
			},
			{
				title: "Customer Statements",
				url: "/dashboard/customer-statements",
				icon: Users,
				module: "reports",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Customer Statements",
				hidden: true,
			},
			{
				title: "Tax Summary",
				url: "/dashboard/tax-summary",
				icon: Calculator,
				module: "reports",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Tax Summary",
			},
			{
				title: "Budgets",
				url: "/dashboard/budgets",
				icon: Target,
				module: "reports",
				roles: ["executive", "admin", "accountant"],
				pageTitle: "Budgets",
			},
			{
				title: "Discounts",
				url: "/dashboard/discounts",
				icon: Percent,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Discounts",
			},
			{
				title: "Cash Reconciliation",
				url: "/dashboard/reconciliation",
				icon: Scale,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Cash Reconciliation",
			},
			{
				title: "Sales Journal",
				url: "/dashboard/journal",
				icon: BookOpen,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Sales Journal",
			},
			{
				title: "Profit & Loss",
				url: "/dashboard/pnl",
				icon: Receipt,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Profit & Loss",
			},
		],
	},
	{
		id: "reports",
		label: "Reports & Insights",
		description: "Analytics, EOD & performance",
		icon: BarChart3,
		styles: {
			borderHover: "group-hover:border-purple-500/50",
			bgHover: "group-hover:bg-purple-500/5",
			iconBg: "bg-purple-500/10",
			iconColor: "text-purple-500",
		},
		defaultUrl: "/dashboard/reports",
		items: [
			{
				title: "Reports",
				url: "/dashboard/reports",
				icon: BarChart3,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Reports",
			},
			{
				title: "EOD Report",
				url: "/dashboard/eod",
				icon: FileText,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "End of Day",
			},
			{
				title: "Analytics",
				url: "/dashboard/analytics",
				icon: TrendingUp,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Analytics",
			},
			{
				title: "Labor Cost",
				url: "/dashboard/labor",
				icon: Calculator,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Labor Report",
			},
			{
				title: "Product Profitability",
				url: "/dashboard/profitability",
				icon: PieChart,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Product Profitability",
			},
			{
				title: "Customer Feedback",
				url: "/dashboard/feedback",
				icon: MessageCircle,
				module: "reports",
				roles: ["executive", "admin"],
				pageTitle: "Customer Feedback",
			},
		],
	},
	{
		id: "settings",
		label: "Settings & Admin",
		description: "Config, users & system tools",
		icon: Settings,
		styles: {
			borderHover: "group-hover:border-slate-500/50",
			bgHover: "group-hover:bg-slate-500/5",
			iconBg: "bg-slate-500/10",
			iconColor: "text-slate-500",
		},
		defaultUrl: "/dashboard/settings",
		items: [
			{
				title: "Settings",
				url: "/dashboard/settings",
				icon: Settings,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Settings",
			},
			{
				title: "Locations",
				url: "/dashboard/locations",
				icon: MapPin,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Locations",
			},
			{
				title: "Audit Log",
				url: "/dashboard/audit",
				icon: Shield,
				module: "audit",
				roles: ["executive", "admin"],
				pageTitle: "Audit Log",
			},
			{
				title: "Webhooks",
				url: "/dashboard/webhooks",
				icon: Webhook,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Webhooks",
			},
			{
				title: "Notifications",
				url: "/dashboard/notifications",
				icon: Bell,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Notifications",
			},
			{
				title: "Currency",
				url: "/dashboard/currency",
				icon: Banknote,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Currency",
			},
			{
				title: "Backup & Restore",
				url: "/dashboard/backup",
				icon: HardDrive,
				module: "settings",
				roles: ["executive", "admin"],
				pageTitle: "Backup & Restore",
			},
		],
	},
];

// ── Derived exports ──────────────────────────────────────────────────────

export const ALL_NAV_ITEMS: NavItem[] = MODULES.flatMap((m) => m.items);

/**
 * Map from URL path → human-readable page title.
 * Excludes query-string variants (Purchase Orders uses the same path as Inventory).
 */
export const PAGE_TITLES: Record<string, string> = {
	...Object.fromEntries(
		ALL_NAV_ITEMS.filter((item) => !item.url.includes("?")).map((item) => [
			item.url,
			item.pageTitle,
		]),
	),
	// Additional entries not represented as nav items
	"/dashboard/profile": "My Profile",
	"/dashboard/suppliers/:id": "Supplier Detail",
};

/**
 * Map from URL path → permission module (null = all authenticated users).
 * Used by hasRouteAccess() in route-access.ts.
 */
export const ROUTE_MODULE_MAP: Record<string, string | null> = {
	...Object.fromEntries(
		ALL_NAV_ITEMS.filter(
			(item) => item.url !== "/dashboard" && !item.url.includes("?"),
		).map((item) => [item.url, item.module]),
	),
	// Additional routes not represented as nav items
	"/dashboard/profile": null,
	"/dashboard/suppliers/:id": "inventory",
};

/**
 * Returns the module that owns a given pathname, or null if on the home dashboard.
 * Used by the sidebar to render contextual navigation.
 */
export function getActiveModule(pathname: string): ModuleDefinition | null {
	if (pathname === "/dashboard") return null;
	for (const mod of MODULES) {
		for (const item of mod.items) {
			const itemPath = item.url.split("?")[0];
			// Skip the Dashboard home item — it would match any /dashboard/* path
			if (itemPath === "/dashboard") continue;
			if (pathname === itemPath || pathname.startsWith(`${itemPath}/`)) {
				return mod;
			}
		}
	}
	return null;
}
