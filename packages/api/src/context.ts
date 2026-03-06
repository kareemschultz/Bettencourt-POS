import { auth } from "@Bettencourt-POS/auth";
import type { Context as HonoContext } from "hono";
import { loadUserPermissions, type Permissions } from "./lib/permissions";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	let userPermissions: Permissions = {};
	if (session?.user?.id) {
		userPermissions = await loadUserPermissions(session.user.id);
	}

	return {
		session,
		userPermissions,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
