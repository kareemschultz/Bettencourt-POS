import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── list ────────────────────────────────────────────────────────────────
// Filterable audit log listing with pagination
const list = permissionProcedure("audit.read")
	.input(
		z
			.object({
				entityType: z.string().optional(),
				entityId: z.string().optional(),
				userId: z.string().optional(),
				actionType: z.string().optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				page: z.number().int().min(1).default(1),
				limit: z.number().int().min(1).max(200).default(50),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const entityType = rawInput?.entityType;
		const entityId = rawInput?.entityId;
		const userId = rawInput?.userId;
		const actionType = rawInput?.actionType;
		const startDate = rawInput?.startDate;
		const endDate = rawInput?.endDate;
		const page = rawInput?.page ?? 1;
		const limit = rawInput?.limit ?? 50;
		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [];
		if (entityType) {
			conditions.push(eq(schema.auditLog.entityType, entityType));
		}
		if (entityId) {
			conditions.push(eq(schema.auditLog.entityId, entityId));
		}
		if (userId) {
			conditions.push(eq(schema.auditLog.userId, userId));
		}
		if (actionType) {
			conditions.push(eq(schema.auditLog.actionType, actionType));
		}
		if (startDate) {
			conditions.push(gte(schema.auditLog.createdAt, new Date(startDate)));
		}
		if (endDate) {
			conditions.push(lte(schema.auditLog.createdAt, new Date(endDate)));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Count
		const countRows = await db
			.select({ total: count() })
			.from(schema.auditLog)
			.where(whereClause);
		const countResult = countRows[0]!;

		// Fetch logs with user info
		const logs = await db
			.select({
				id: schema.auditLog.id,
				userId: schema.auditLog.userId,
				userNameSnapshot: schema.auditLog.userNameSnapshot,
				roleSnapshot: schema.auditLog.roleSnapshot,
				locationId: schema.auditLog.locationId,
				entityType: schema.auditLog.entityType,
				entityId: schema.auditLog.entityId,
				actionType: schema.auditLog.actionType,
				beforeData: schema.auditLog.beforeData,
				afterData: schema.auditLog.afterData,
				diffData: schema.auditLog.diffData,
				reason: schema.auditLog.reason,
				ipAddress: schema.auditLog.ipAddress,
				createdAt: schema.auditLog.createdAt,
				userName: schema.user.name,
				userEmail: schema.user.email,
			})
			.from(schema.auditLog)
			.leftJoin(schema.user, eq(schema.auditLog.userId, schema.user.id))
			.where(whereClause)
			.orderBy(desc(schema.auditLog.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			logs,
			total: countResult.total,
			page,
			limit,
		};
	});

export const auditRouter = {
	list,
};
