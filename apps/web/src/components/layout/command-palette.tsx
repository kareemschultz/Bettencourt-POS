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
	ClipboardList,
	Clock,
	CookingPot,
	DollarSign,
	FileText,
	Gift,
	GitCompareArrows,
	LayoutDashboard,
	MapPin,
	Percent,
	PieChart,
	Receipt,
	ReceiptText,
	Salad,
	Scale,
	Settings,
	Shield,
	Star,
	Tag,
	Trash2,
	TrendingUp,
	Truck,
	Users,
	Utensils,
	UtensilsCrossed,
	Warehouse,
	Webhook,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import type { AppUser } from "@/lib/types";

type NavItem = {
	title: string;
	url: string;
	icon: React.ElementType;
	module: string | null;
	roles: string[];
};

type CommandGroupDef = {
	label: string;
	items: NavItem[];
};

const COMMAND_GROUPS: CommandGroupDef[] = [
	{
		label: "Main",
		items: [
			{
				title: "Dashboard",
				url: "/dashboard",
				icon: LayoutDashboard,
				module: null,
				roles: ["executive", "admin", "cashier"],
			},
			{
				title: "New Sale",
				url: "/dashboard/pos",
				icon: UtensilsCrossed,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
			},
			{
				title: "Orders",
				url: "/dashboard/orders",
				icon: ClipboardList,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
			},
		],
	},
	{
		label: "Operations",
		items: [
			{
				title: "Tables",
				url: "/dashboard/tables",
				icon: Utensils,
				module: "orders",
				roles: ["executive", "admin"],
			},
			{
				title: "Kitchen Display",
				url: "/dashboard/kitchen",
				icon: ChefHat,
				module: "orders",
				roles: ["executive", "admin", "cashier", "checkoff"],
			},
			{
				title: "Production Board",
				url: "/dashboard/production",
				icon: CookingPot,
				module: null,
				roles: ["executive", "admin", "checkoff"],
			},
			{
				title: "Production Report",
				url: "/dashboard/production-report",
				icon: BarChart3,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "Menu Calendar",
				url: "/dashboard/menu-schedules",
				icon: CalendarClock,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Time Clock",
				url: "/dashboard/timeclock",
				icon: Clock,
				module: null,
				roles: ["executive", "admin", "cashier", "checkoff"],
			},
		],
	},
	{
		label: "Inventory",
		items: [
			{
				title: "Products",
				url: "/dashboard/products",
				icon: Salad,
				module: "products",
				roles: ["executive", "admin", "cashier"],
			},
			{
				title: "Inventory",
				url: "/dashboard/inventory",
				icon: Warehouse,
				module: "inventory",
				roles: ["executive", "admin"],
			},
			{
				title: "Purchase Orders",
				url: "/dashboard/inventory?tab=purchase-orders",
				icon: Truck,
				module: "inventory",
				roles: ["executive", "admin"],
			},
			{
				title: "Stock Alerts",
				url: "/dashboard/stock-alerts",
				icon: AlertTriangle,
				module: "inventory",
				roles: ["executive", "admin"],
			},
			{
				title: "Labels",
				url: "/dashboard/labels",
				icon: Tag,
				module: "products",
				roles: ["executive", "admin"],
			},
			{
				title: "Waste & Shrinkage",
				url: "/dashboard/waste",
				icon: Trash2,
				module: "inventory",
				roles: ["executive", "admin"],
			},
			{
				title: "Stock Variance",
				url: "/dashboard/variance",
				icon: GitCompareArrows,
				module: "inventory",
				roles: ["executive", "admin"],
			},
			{
				title: "Suppliers",
				url: "/dashboard/suppliers",
				icon: Building2,
				module: "inventory",
				roles: ["executive", "admin"],
			},
		],
	},
	{
		label: "Customers",
		items: [
			{
				title: "Customers",
				url: "/dashboard/customers",
				icon: Users,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
			},
			{
				title: "Loyalty Program",
				url: "/dashboard/loyalty",
				icon: Star,
				module: "orders",
				roles: ["executive", "admin"],
			},
			{
				title: "Gift Cards",
				url: "/dashboard/giftcards",
				icon: Gift,
				module: "orders",
				roles: ["executive", "admin", "cashier"],
			},
		],
	},
	{
		label: "Finance & Billing",
		items: [
			{
				title: "Discounts",
				url: "/dashboard/discounts",
				icon: Percent,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Cash Control",
				url: "/dashboard/cash",
				icon: DollarSign,
				module: "shifts",
				roles: ["executive", "admin", "cashier"],
			},
			{
				title: "Cash Reconciliation",
				url: "/dashboard/reconciliation",
				icon: Scale,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "Daily Sales Journal",
				url: "/dashboard/journal",
				icon: BookOpen,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "Profit & Loss",
				url: "/dashboard/pnl",
				icon: Receipt,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "Expenses",
				url: "/dashboard/expenses",
				icon: ReceiptText,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Quotations",
				url: "/dashboard/quotations",
				icon: FileText,
				module: "quotations",
				roles: ["executive", "admin"],
			},
			{
				title: "Invoices",
				url: "/dashboard/invoices",
				icon: Receipt,
				module: "invoices",
				roles: ["executive", "admin"],
			},
		],
	},
	{
		label: "Insights",
		items: [
			{
				title: "Reports",
				url: "/dashboard/reports",
				icon: BarChart3,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "EOD Report",
				url: "/dashboard/eod",
				icon: FileText,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "Analytics",
				url: "/dashboard/analytics",
				icon: TrendingUp,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "Labor Cost",
				url: "/dashboard/labor",
				icon: Calculator,
				module: "reports",
				roles: ["executive", "admin"],
			},
			{
				title: "Profitability",
				url: "/dashboard/profitability",
				icon: PieChart,
				module: "reports",
				roles: ["executive", "admin"],
			},
		],
	},
	{
		label: "System",
		items: [
			{
				title: "Settings",
				url: "/dashboard/settings",
				icon: Settings,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Locations",
				url: "/dashboard/locations",
				icon: MapPin,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Webhooks",
				url: "/dashboard/webhooks",
				icon: Webhook,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Notifications",
				url: "/dashboard/notifications",
				icon: Bell,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Currency",
				url: "/dashboard/currency",
				icon: Banknote,
				module: "settings",
				roles: ["executive", "admin"],
			},
			{
				title: "Audit Log",
				url: "/dashboard/audit",
				icon: Shield,
				module: "audit",
				roles: ["executive", "admin"],
			},
		],
	},
];

const WAREHOUSE_MODULES = new Set(["dashboard", "inventory", "products"]);
const ACCOUNTANT_MODULES = new Set([
	"dashboard",
	"reports",
	"invoices",
	"settings",
	"shifts",
	"orders",
]);

function canSee(
	user: AppUser,
	item: { module: string | null; roles: string[] },
): boolean {
	if (user.role === "warehouse") {
		return WAREHOUSE_MODULES.has(item.module ?? "dashboard");
	}
	if (user.role === "accountant") {
		return ACCOUNTANT_MODULES.has(item.module ?? "dashboard");
	}
	if (item.roles.length > 0 && !item.roles.includes(user.role)) return false;
	if (item.module) {
		const perms = user.permissions[item.module];
		return Array.isArray(perms) && perms.length > 0;
	}
	return true;
}

interface CommandPaletteProps {
	user: AppUser;
}

export function CommandPalette({ user }: CommandPaletteProps) {
	const [open, setOpen] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	function runCommand(url: string) {
		setOpen(false);
		navigate(url);
	}

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Navigate"
			description="Search and jump to any page in the system"
		>
			<CommandInput placeholder="Search pages..." />
			<CommandList>
				<CommandEmpty>No pages found.</CommandEmpty>
				{COMMAND_GROUPS.map((group, idx) => {
					const visible = group.items.filter((item) => canSee(user, item));
					if (visible.length === 0) return null;
					return (
						<div key={group.label}>
							{idx > 0 && <CommandSeparator />}
							<CommandGroup heading={group.label}>
								{visible.map((item) => (
									<CommandItem
										key={item.url}
										value={item.title}
										onSelect={() => runCommand(item.url)}
									>
										<item.icon />
										<span>{item.title}</span>
									</CommandItem>
								))}
							</CommandGroup>
						</div>
					);
				})}
			</CommandList>
		</CommandDialog>
	);
}
