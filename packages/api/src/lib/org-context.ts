import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import type { Context } from "../context";

export function requireOrganizationId(context: Context): string {
	if (!context.organizationId) {
		throw new ORPCError("FORBIDDEN", {
			message: "No active organization context for this user.",
		});
	}
	return context.organizationId;
}

export async function resolvePublicOrganizationId(): Promise<string> {
	const rows = await db
		.select({ id: schema.organization.id })
		.from(schema.organization)
		.orderBy(asc(schema.organization.createdAt))
		.limit(1);
	if (!rows[0]?.id) {
		throw new ORPCError("NOT_FOUND", {
			message: "No organization is configured.",
		});
	}
	return rows[0].id;
}

export async function resolveDefaultLocationId(
	organizationId: string,
): Promise<string> {
	const rows = await db
		.select({ id: schema.location.id })
		.from(schema.location)
		.where(eq(schema.location.organizationId, organizationId))
		.orderBy(asc(schema.location.createdAt))
		.limit(1);
	if (!rows[0]?.id) {
		throw new ORPCError("BAD_REQUEST", {
			message: "No location is configured for this organization.",
		});
	}
	return rows[0].id;
}
