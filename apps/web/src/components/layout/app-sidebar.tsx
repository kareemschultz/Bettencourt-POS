import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	Banknote,
	BarChart3,
	BookOpen,
	Building2,
	Calculator,
	CalendarClock,
	ChevronUp,
	ClipboardCheck,
	ClipboardList,
	Clock,
	CreditCard,
	DollarSign,
	FileText,
	GitCompareArrows,
	LayoutDashboard,
	LogOut,
	MapPin,
	MessageSquare,
	Package,
	Percent,
	PieChart,
	Receipt,
	ReceiptText,
	Scale,
	Search,
	Settings,
	Shield,
	ShoppingCart,
	Star,
	Tag,
	Trash2,
	TrendingUp,
	Truck,
	User,
	Users,
	UtensilsCrossed,
	Warehouse,
	Webhook,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";
import type { AppUser } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface AppSidebarProps {
	user: AppUser;
}

const mainNavItems = [
	{
		title: "Dashboard",
		url: "/dashboard",
		icon: LayoutDashboard,
		module: null,
		roles: ["executive", "admin", "cashier"],
	},
	{
		title: "POS Terminal",
		url: "/dashboard/pos",
		icon: ShoppingCart,
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
];

const restaurantNavItems = [
	{
		title: "Tables",
		url: "/dashboard/tables",
		icon: UtensilsCrossed,
		module: "orders",
		roles: ["executive", "admin"],
	},
	{
		title: "Kitchen Display",
		url: "/dashboard/kitchen",
		icon: UtensilsCrossed,
		module: "orders",
		roles: ["executive", "admin", "cashier", "checkoff"],
	},
	{
		title: "Check Off",
		url: "/dashboard/production",
		icon: ClipboardCheck,
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
		title: "Menu Schedules",
		url: "/dashboard/menu-schedules",
		icon: CalendarClock,
		module: "settings",
		roles: ["executive", "admin"],
	},
];

const inventoryNavItems = [
	{
		title: "Products",
		url: "/dashboard/products",
		icon: Package,
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
		title: "Waste Log",
		url: "/dashboard/waste",
		icon: Trash2,
		module: "inventory",
		roles: ["executive", "admin"],
	},
	{
		title: "Variance",
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
];

const financeNavItems = [
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
];

const customerNavItems = [
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
		title: "Discounts",
		url: "/dashboard/discounts",
		icon: Percent,
		module: "settings",
		roles: ["executive", "admin"],
	},
	{
		title: "Gift Cards",
		url: "/dashboard/giftcards",
		icon: CreditCard,
		module: "orders",
		roles: ["executive", "admin", "cashier"],
	},
];

const staffNavItems = [
	{
		title: "Time Clock",
		url: "/dashboard/timeclock",
		icon: Clock,
		module: null,
		roles: ["executive", "admin", "cashier", "checkoff"],
	},
];

const managementNavItems = [
	{
		title: "Cash Control",
		url: "/dashboard/cash",
		icon: DollarSign,
		module: "shifts",
		roles: ["executive", "admin", "cashier"],
	},
	{
		title: "Reports",
		url: "/dashboard/reports",
		icon: BarChart3,
		module: "reports",
		roles: ["executive", "admin"],
	},
	{
		title: "Reconciliation",
		url: "/dashboard/reconciliation",
		icon: Scale,
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
		title: "Sales Journal",
		url: "/dashboard/journal",
		icon: BookOpen,
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
	{
		title: "P&L Statement",
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
	{
		title: "Locations",
		url: "/dashboard/locations",
		icon: MapPin,
		module: "settings",
		roles: ["executive", "admin"],
	},
	{
		title: "Settings",
		url: "/dashboard/settings",
		icon: Settings,
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
		icon: MessageSquare,
		module: "settings",
		roles: ["executive", "admin"],
	},
];

const WAREHOUSE_MODULES = new Set([
	"dashboard",
	"inventory",
	"purchase-orders",
	"transfers",
	"stock-counts",
	"suppliers",
]);

const ACCOUNTANT_MODULES = new Set([
	"dashboard",
	"reports",
	"expenses",
	"cash",
	"invoices",
	"customers",
]);

function canSeeItem(
	user: AppUser,
	item: { module: string | null; roles?: string[] },
): boolean {
	// Warehouse and accountant roles use module-set gating instead of roles arrays
	if (user.role === "warehouse") {
		const mod = item.module ?? "dashboard";
		return WAREHOUSE_MODULES.has(mod);
	}
	if (user.role === "accountant") {
		const mod = item.module ?? "dashboard";
		return ACCOUNTANT_MODULES.has(mod);
	}
	// If role-restricted, check user role
	if (item.roles && item.roles.length > 0) {
		if (!item.roles.includes(user.role)) return false;
	}
	// If module-restricted, check permissions
	if (item.module) {
		const perms = user.permissions[item.module];
		return Array.isArray(perms) && perms.length > 0;
	}
	return true;
}

export function AppSidebar({ user }: AppSidebarProps) {
	const location = useLocation();
	const pathname = location.pathname;
	const navigate = useNavigate();
	const [search, setSearch] = useState("");

	const { data: alertData } = useQuery({
		...orpc.inventory.getAlerts.queryOptions({
			input: {
				organizationId: user.organization_id ?? "",
				unacknowledgedOnly: true,
			},
		}),
		enabled: !!user.organization_id,
		refetchInterval: 60_000,
	});
	const unacknowledgedAlertCount = alertData?.length ?? 0;

	async function handleSignOut() {
		await signOut();
		navigate("/login");
	}

	function renderNavGroup(label: string, items: typeof mainNavItems) {
		const query = search.trim().toLowerCase();
		const filtered = items.filter(
			(item) =>
				canSeeItem(user, item) &&
				(query === "" || item.title.toLowerCase().includes(query)),
		);
		if (filtered.length === 0) return null;

		return (
			<SidebarGroup>
				<SidebarGroupLabel>{label}</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						{filtered.map((item) => (
							<SidebarMenuItem key={item.url}>
								<SidebarMenuButton
									asChild
									isActive={
										pathname === item.url ||
										pathname + location.search === item.url
									}
									tooltip={item.title}
								>
									<a href={item.url}>
										<item.icon className="size-4" />
										<span>{item.title}</span>
									</a>
								</SidebarMenuButton>
								{item.url === "/dashboard/stock-alerts" &&
									unacknowledgedAlertCount > 0 && (
										<SidebarMenuBadge>
											{unacknowledgedAlertCount}
										</SidebarMenuBadge>
									)}
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		);
	}

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild className="h-auto py-2">
							<a href="/dashboard">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
									<img
										src="/images/bettencourts-logo.png"
										alt="Bettencourt's logo"
										width={40}
										height={40}
										className="object-contain"
									/>
								</div>
								<div className="flex flex-col gap-0.5 leading-none">
									<span className="font-semibold">{"Bettencourt's"}</span>
									<span className="text-sidebar-muted-foreground text-xs">
										Food Inc.
									</span>
								</div>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<div className="relative px-2 pb-1 group-data-[collapsible=icon]:hidden">
					<Search className="absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search..."
						className="h-8 pl-7 text-sm"
						aria-label="Search navigation"
					/>
				</div>
			</SidebarHeader>
			<SidebarContent>
				{renderNavGroup("Main", mainNavItems)}
				{renderNavGroup("Restaurant", restaurantNavItems)}
				{renderNavGroup("Inventory", inventoryNavItems)}
				{renderNavGroup("Customers", customerNavItems)}
				{renderNavGroup("Finance", financeNavItems)}
				{renderNavGroup("Staff", staffNavItems)}
				{renderNavGroup("Management", managementNavItems)}
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger>
								<div className="flex h-12 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
										<User className="size-4" />
									</div>
									<div className="flex flex-col gap-0.5 leading-none">
										<span className="font-medium text-sm">{user.name}</span>
										<span className="text-sidebar-muted-foreground text-xs capitalize">
											{user.role}
										</span>
									</div>
									<ChevronUp className="ml-auto size-4" />
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent side="top" align="start" className="w-56">
								<DropdownMenuItem onClick={handleSignOut}>
									<LogOut className="mr-2 size-4" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
