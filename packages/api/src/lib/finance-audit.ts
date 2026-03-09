import type { db as Db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";

export interface FinanceAuditParams {
	organizationId: string;
	entityType: string;
	entityId: string;
	action: string;
	beforeState?: unknown;
	afterState?: unknown;
	performedBy: string;
	notes?: string;
}

/**
 * Logs a finance audit event. Called by all finance mutation handlers.
 * Failures are non-fatal — we catch and log rather than abort the transaction.
 */
export async function logFinanceEvent(
	db: typeof Db,
	params: FinanceAuditParams,
): Promise<void> {
	try {
		await db.insert(schema.financeAuditEvent).values({
			organizationId: params.organizationId,
			entityType: params.entityType,
			entityId: params.entityId,
			action: params.action,
			beforeState: params.beforeState ?? null,
			afterState: params.afterState ?? null,
			performedBy: params.performedBy,
			notes: params.notes ?? null,
		});
	} catch (err) {
		// Audit failures should not break the main operation
		console.error("[finance-audit] Failed to log event:", err);
	}
}
