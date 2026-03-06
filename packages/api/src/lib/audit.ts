import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";

interface AuditParams {
	userId: string | null;
	userNameSnapshot?: string | null;
	roleSnapshot?: string | null;
	locationId?: string | null;
	entityType: string;
	entityId?: string | null;
	actionType: string;
	beforeData?: Record<string, unknown> | null;
	afterData?: Record<string, unknown> | null;
	reason?: string | null;
	ipAddress?: string | null;
}

function computeDiff(
	before: Record<string, unknown> | null | undefined,
	after: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
	if (!before || !after) return null;
	const diff: Record<string, { old: unknown; new: unknown }> = {};
	const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
	for (const key of allKeys) {
		if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
			diff[key] = { old: before[key], new: after[key] };
		}
	}
	return Object.keys(diff).length > 0 ? diff : null;
}

export async function createAuditLog(params: AuditParams) {
	const diffData = computeDiff(params.beforeData, params.afterData);

	await db.insert(schema.auditLog).values({
		userId: params.userId,
		userNameSnapshot: params.userNameSnapshot ?? null,
		roleSnapshot: params.roleSnapshot ?? null,
		locationId: params.locationId ?? null,
		entityType: params.entityType,
		entityId: params.entityId ?? null,
		actionType: params.actionType,
		beforeData: params.beforeData ?? null,
		afterData: params.afterData ?? null,
		diffData: diffData ?? null,
		reason: params.reason ?? null,
		ipAddress: params.ipAddress ?? null,
	});
}
