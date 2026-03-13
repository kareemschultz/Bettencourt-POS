import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

const DAYS = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const;

const list = permissionProcedure("settings.read")
	.input(
		z
			.object({
				userId: z.string().optional(),
				locationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		const conditions = [eq(schema.shift.organizationId, orgId)];

		if (input.userId) {
			conditions.push(eq(schema.shift.userId, input.userId));
		}
		if (input.locationId) {
			conditions.push(eq(schema.shift.locationId, input.locationId));
		}

		const rows = await db
			.select({
				id: schema.shift.id,
				userId: schema.shift.userId,
				userName: sql<string>`COALESCE(u.name, 'Unknown')`,
				locationId: schema.shift.locationId,
				dayOfWeek: schema.shift.dayOfWeek,
				startTime: schema.shift.startTime,
				endTime: schema.shift.endTime,
				notes: schema.shift.notes,
				isActive: schema.shift.isActive,
			})
			.from(schema.shift)
			.leftJoin(sql`"user" u`, sql`u.id = ${schema.shift.userId}`)
			.where(and(...conditions))
			.orderBy(
				sql`CASE ${schema.shift.dayOfWeek}
					WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2
					WHEN 'thursday' THEN 3 WHEN 'friday' THEN 4 WHEN 'saturday' THEN 5
					WHEN 'sunday' THEN 6 END`,
				schema.shift.startTime,
			);

		return rows;
	});

const create = permissionProcedure("settings.update")
	.input(
		z.object({
			userId: z.string(),
			locationId: z.string().uuid().optional().nullable(),
			dayOfWeek: z.enum(DAYS),
			startTime: z.string().regex(/^\d{2}:\d{2}$/),
			endTime: z.string().regex(/^\d{2}:\d{2}$/),
			notes: z.string().optional().nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const [row] = await db
			.insert(schema.shift)
			.values({
				organizationId: orgId,
				userId: input.userId,
				locationId: input.locationId ?? undefined,
				dayOfWeek: input.dayOfWeek,
				startTime: input.startTime,
				endTime: input.endTime,
				notes: input.notes ?? undefined,
			})
			.returning();
		return row;
	});

const update = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			dayOfWeek: z.enum(DAYS).optional(),
			startTime: z
				.string()
				.regex(/^\d{2}:\d{2}$/)
				.optional(),
			endTime: z
				.string()
				.regex(/^\d{2}:\d{2}$/)
				.optional(),
			notes: z.string().optional().nullable(),
			isActive: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		const updateData: Record<string, unknown> = {};
		if (data.dayOfWeek) updateData.dayOfWeek = data.dayOfWeek;
		if (data.startTime) updateData.startTime = data.startTime;
		if (data.endTime) updateData.endTime = data.endTime;
		if (data.notes !== undefined) updateData.notes = data.notes;
		if (data.isActive !== undefined) updateData.isActive = data.isActive;

		const [row] = await db
			.update(schema.shift)
			.set(updateData)
			.where(eq(schema.shift.id, id))
			.returning();
		return row;
	});

const remove = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db.delete(schema.shift).where(eq(schema.shift.id, input.id));
		return { success: true };
	});

export const shiftsRouter = { list, create, update, remove };
