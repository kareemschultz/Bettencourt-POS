import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { eq } from "drizzle-orm";

// Permission format in DB: { "orders": ["create", "read", "void"], "products": ["read"] }
export type Permissions = Record<string, string[]>;

export async function loadUserPermissions(
	userId: string,
): Promise<Permissions> {
	const roles = await db
		.select({
			permissions: schema.customRole.permissions,
		})
		.from(schema.userRole)
		.innerJoin(
			schema.customRole,
			eq(schema.userRole.roleId, schema.customRole.id),
		)
		.where(eq(schema.userRole.userId, userId));

	// Merge permissions from all assigned roles
	const merged: Permissions = {};
	for (const role of roles) {
		const perms = role.permissions as Permissions;
		for (const [resource, actions] of Object.entries(perms)) {
			if (!merged[resource]) merged[resource] = [];
			for (const action of actions) {
				if (!merged[resource].includes(action)) {
					merged[resource].push(action);
				}
			}
		}
	}
	return merged;
}

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
