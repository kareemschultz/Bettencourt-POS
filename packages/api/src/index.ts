import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";
import { hasPermission } from "./lib/permissions";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session: context.session,
			userPermissions: context.userPermissions,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export function permissionProcedure(permission: string) {
	return protectedProcedure.use(async ({ context, next }) => {
		if (!hasPermission(context.userPermissions, permission)) {
			throw new ORPCError("FORBIDDEN", {
				message: `Missing permission: ${permission}`,
			});
		}
		return next({ context });
	});
}
