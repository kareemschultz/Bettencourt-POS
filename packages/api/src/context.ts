import { auth } from "@Bettencourt-POS/auth";
import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { eq } from "drizzle-orm";
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
	let organizationId: string | null = null;
	if (session?.user?.id) {
		userPermissions = await loadUserPermissions(session.user.id);
		const activeOrgId =
			(session as { session?: { activeOrganizationId?: string | null } })
				.session?.activeOrganizationId ?? null;
		if (activeOrgId) {
			organizationId = activeOrgId;
		} else {
			const memberRows = await db
				.select({ organizationId: schema.member.organizationId })
				.from(schema.member)
				.where(eq(schema.member.userId, session.user.id))
				.limit(1);
			organizationId = memberRows[0]?.organizationId ?? null;
		}
	}

	return {
		session,
		userPermissions,
		organizationId,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
