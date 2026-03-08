import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { eq } from "drizzle-orm";

// Re-exported from zero-dependency module for testability
export type { Permissions } from "./has-permission";
export { hasPermission } from "./has-permission";

type Permissions = Record<string, string[]>;

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
