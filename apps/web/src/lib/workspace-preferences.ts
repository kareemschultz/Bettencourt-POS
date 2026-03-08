export type SidebarRole =
	| "executive"
	| "admin"
	| "warehouse"
	| "accountant"
	| "checkoff"
	| "cashier";

export type WorkspaceRoute =
	| "/dashboard"
	| "/dashboard/pos"
	| "/dashboard/orders"
	| "/dashboard/kitchen"
	| "/dashboard/inventory"
	| "/dashboard/reports"
	| "/dashboard/cash"
	| "/dashboard/invoices";

export const WORKSPACE_ROUTE_STORAGE_KEY =
	"bettencourt-default-workspace-route";

export const WORKSPACE_ROUTE_OPTIONS: Array<{
	value: WorkspaceRoute;
	label: string;
}> = [
	{ value: "/dashboard", label: "Dashboard" },
	{ value: "/dashboard/pos", label: "New Sale (POS)" },
	{ value: "/dashboard/orders", label: "Orders" },
	{ value: "/dashboard/kitchen", label: "Kitchen Display" },
	{ value: "/dashboard/inventory", label: "Inventory" },
	{ value: "/dashboard/reports", label: "Reports" },
	{ value: "/dashboard/cash", label: "Cash Control" },
	{ value: "/dashboard/invoices", label: "Invoices" },
];

const VALID_WORKSPACE_ROUTES = new Set(
	WORKSPACE_ROUTE_OPTIONS.map((route) => route.value),
);

const ROLE_DEFAULT_WORKSPACE: Record<SidebarRole, WorkspaceRoute> = {
	executive: "/dashboard",
	admin: "/dashboard",
	cashier: "/dashboard/pos",
	checkoff: "/dashboard/kitchen",
	warehouse: "/dashboard/inventory",
	accountant: "/dashboard/reports",
};

export function roleNameToSidebarRole(roleName: string): SidebarRole {
	switch (roleName.toLowerCase()) {
		case "executive":
		case "owner":
			return "executive";
		case "manager":
			return "admin";
		case "warehouse clerk":
			return "warehouse";
		case "accountant":
			return "accountant";
		case "kitchen":
			return "checkoff";
		default:
			return "cashier";
	}
}

export function getRoleDefaultWorkspaceRoute(
	role: SidebarRole,
): WorkspaceRoute {
	return ROLE_DEFAULT_WORKSPACE[role] ?? "/dashboard";
}

export function getSavedWorkspaceRoute(): WorkspaceRoute | null {
	if (typeof window === "undefined") return null;
	const value = window.localStorage.getItem(WORKSPACE_ROUTE_STORAGE_KEY);
	if (!value) return null;
	return VALID_WORKSPACE_ROUTES.has(value as WorkspaceRoute)
		? (value as WorkspaceRoute)
		: null;
}

export function setSavedWorkspaceRoute(route: WorkspaceRoute | null): void {
	if (typeof window === "undefined") return;
	if (!route) {
		window.localStorage.removeItem(WORKSPACE_ROUTE_STORAGE_KEY);
		return;
	}
	window.localStorage.setItem(WORKSPACE_ROUTE_STORAGE_KEY, route);
}
