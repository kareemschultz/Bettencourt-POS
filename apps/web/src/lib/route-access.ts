/**
 * Route-level permission gating for dashboard pages.
 * The ROUTE_MODULE_MAP is derived from lib/modules.ts — single source of truth.
 * A null module means accessible to all authenticated users.
 */
import { ROUTE_MODULE_MAP } from "@/lib/modules";

export { ROUTE_MODULE_MAP };

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
