import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── list ────────────────────────────────────────────────────────────────
const list = permissionProcedure("departments.read")
	.input(
		z
			.object({
				organizationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = [];
		if (input.organizationId) {
			conditions.push(
				eq(schema.reportingCategory.organizationId, input.organizationId),
			);
		}

		const categories = await db.query.reportingCategory.findMany({
			where: conditions.length > 0 ? conditions[0] : undefined,
			orderBy: [
				asc(schema.reportingCategory.sortOrder),
				asc(schema.reportingCategory.name),
			],
		});

		return categories;
	});

// ── create ──────────────────────────────────────────────────────────────
const create = permissionProcedure("departments.create")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			name: z.string().min(1),
			sortOrder: z.number().int().optional().default(0),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.insert(schema.reportingCategory)
			.values({
				organizationId: input.organizationId,
				name: input.name,
				sortOrder: input.sortOrder,
			})
			.returning({ id: schema.reportingCategory.id });

		return { id: rows[0]?.id };
	});

// ── update ──────────────────────────────────────────────────────────────
const update = permissionProcedure("departments.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().optional(),
			sortOrder: z.number().int().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...updates } = input;
		const setValues: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				setValues[key] = value;
			}
		}

		await db
			.update(schema.reportingCategory)
			.set(setValues)
			.where(eq(schema.reportingCategory.id, id));

		return { success: true };
	});

// ── delete ──────────────────────────────────────────────────────────────
const remove = permissionProcedure("departments.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.reportingCategory)
			.where(eq(schema.reportingCategory.id, input.id));

		return { ok: true };
	});

export const categoriesRouter = {
	list,
	create,
	update,
	delete: remove,
};
