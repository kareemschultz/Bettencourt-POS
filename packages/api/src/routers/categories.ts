import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── list ────────────────────────────────────────────────────────────────
const list = permissionProcedure("departments.read")
	.input(
		z
			.object({
				organizationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const categories = await db.query.reportingCategory.findMany({
			where: eq(schema.reportingCategory.organizationId, orgId),
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
			name: z.string().min(1),
			sortOrder: z.number().int().optional().default(0),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.insert(schema.reportingCategory)
			.values({
				organizationId: orgId,
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
			pinProtected: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
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
			.where(
				and(
					eq(schema.reportingCategory.id, id),
					eq(schema.reportingCategory.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── delete ──────────────────────────────────────────────────────────────
const remove = permissionProcedure("departments.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.delete(schema.reportingCategory)
			.where(
				and(
					eq(schema.reportingCategory.id, input.id),
					eq(schema.reportingCategory.organizationId, orgId),
				),
			);

		return { ok: true };
	});

export const categoriesRouter = {
	list,
	create,
	update,
	delete: remove,
};
