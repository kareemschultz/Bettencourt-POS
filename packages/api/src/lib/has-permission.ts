/**
 * Pure permission-check function — no DB or env dependency.
 * Extracted for testability.
 */
export type Permissions = Record<string, string[]>;

/**
 * Check if permissions include the required permission.
 * Format: "resource.action" e.g. "orders.void", "products.read"
 */
export function hasPermission(
	permissions: Permissions,
	required: string,
): boolean {
	const [resource, action] = required.split(".");
	if (!resource || !action) return false;
	return permissions[resource]?.includes(action) ?? false;
}
