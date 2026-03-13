import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

const list = permissionProcedure("orders.read")
	.input(
		z
			.object({
				status: z.string().optional(),
				locationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		const conditions = [eq(schema.waitlistEntry.organizationId, orgId)];

		if (input.status) {
			conditions.push(eq(schema.waitlistEntry.status, input.status));
		}
		if (input.locationId) {
			conditions.push(eq(schema.waitlistEntry.locationId, input.locationId));
		}

		return db
			.select()
			.from(schema.waitlistEntry)
			.where(and(...conditions))
			.orderBy(schema.waitlistEntry.createdAt);
	});

const add = permissionProcedure("orders.create")
	.input(
		z.object({
			customerName: z.string().min(1),
			customerPhone: z.string().optional().nullable(),
			partySize: z.number().int().min(1).max(50),
			estimatedWaitMinutes: z.number().int().optional().nullable(),
			notes: z.string().optional().nullable(),
			locationId: z.string().uuid().optional().nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const [row] = await db
			.insert(schema.waitlistEntry)
			.values({
				organizationId: orgId,
				locationId: input.locationId ?? undefined,
				customerName: input.customerName,
				customerPhone: input.customerPhone ?? undefined,
				partySize: input.partySize,
				estimatedWaitMinutes: input.estimatedWaitMinutes ?? undefined,
				notes: input.notes ?? undefined,
			})
			.returning();
		return row;
	});

const updateStatus = permissionProcedure("orders.update")
	.input(
		z.object({
			id: z.string().uuid(),
			status: z.enum(["waiting", "notified", "seated", "cancelled", "no_show"]),
		}),
	)
	.handler(async ({ input }) => {
		const updateData: Record<string, unknown> = { status: input.status };
		if (input.status === "notified") {
			updateData.notifiedAt = new Date();
		}
		if (input.status === "seated") {
			updateData.seatedAt = new Date();
		}

		const [row] = await db
			.update(schema.waitlistEntry)
			.set(updateData)
			.where(eq(schema.waitlistEntry.id, input.id))
			.returning();
		return row;
	});

const remove = permissionProcedure("orders.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.waitlistEntry)
			.where(eq(schema.waitlistEntry.id, input.id));
		return { success: true };
	});

const activeCount = permissionProcedure("orders.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const result = await db
			.select({ count: sql<number>`COUNT(*)::int` })
			.from(schema.waitlistEntry)
			.where(
				and(
					eq(schema.waitlistEntry.organizationId, orgId),
					eq(schema.waitlistEntry.status, "waiting"),
				),
			);
		return { count: result[0]?.count ?? 0 };
	});

export const waitlistRouter = { list, add, updateStatus, remove, activeCount };
