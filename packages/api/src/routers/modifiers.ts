import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── listGroups ──────────────────────────────────────────────────────────
// Returns all modifier groups with their modifiers nested, scoped to org.
const listGroups = permissionProcedure("modifiers.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);

		const groups = await db.query.modifierGroup.findMany({
			where: eq(schema.modifierGroup.organizationId, orgId),
			orderBy: [asc(schema.modifierGroup.name)],
			with: {
				modifiers: {
					where: eq(schema.modifier.isActive, true),
					orderBy: [asc(schema.modifier.sortOrder), asc(schema.modifier.name)],
				},
			},
		});

		return groups.map((g) => ({
			id: g.id,
			organizationId: g.organizationId,
			name: g.name,
			required: g.required,
			minSelect: g.minSelect,
			maxSelect: g.maxSelect,
			createdAt: g.createdAt,
			// Derive selectionType from maxSelect: 1 = single, >1 = multi
			selectionType:
				g.maxSelect <= 1 ? ("single" as const) : ("multi" as const),
			modifiers: g.modifiers,
		}));
	});

// ── createGroup ─────────────────────────────────────────────────────────
const createGroup = permissionProcedure("modifiers.create")
	.input(
		z.object({
			name: z.string().min(1),
			selectionType: z.enum(["single", "multi"]).default("single"),
			required: z.boolean().default(false),
		}),
	)
	.handler(async ({ input, context }) => {
		const organizationId = requireOrganizationId(context);
		const maxSelect = input.selectionType === "single" ? 1 : 10;
		const minSelect = input.required ? 1 : 0;

		const rows = await db
			.insert(schema.modifierGroup)
			.values({
				organizationId,
				name: input.name,
				required: input.required,
				minSelect,
				maxSelect,
			})
			.returning({ id: schema.modifierGroup.id });

		return { id: rows[0]?.id };
	});

// ── updateGroup ─────────────────────────────────────────────────────────
const updateGroup = permissionProcedure("modifiers.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			selectionType: z.enum(["single", "multi"]).optional(),
			required: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select()
			.from(schema.modifierGroup)
			.where(
				and(
					eq(schema.modifierGroup.id, input.id),
					eq(schema.modifierGroup.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Modifier group not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.required !== undefined) {
			updates.required = input.required;
			updates.minSelect = input.required ? 1 : 0;
		}
		if (input.selectionType !== undefined) {
			updates.maxSelect = input.selectionType === "single" ? 1 : 10;
		}

		await db
			.update(schema.modifierGroup)
			.set(updates)
			.where(
				and(
					eq(schema.modifierGroup.id, input.id),
					eq(schema.modifierGroup.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── deleteGroup ─────────────────────────────────────────────────────────
// Cascade is handled by the DB foreign key (modifiers + productModifierGroup).
const deleteGroup = permissionProcedure("modifiers.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select({ id: schema.modifierGroup.id })
			.from(schema.modifierGroup)
			.where(
				and(
					eq(schema.modifierGroup.id, input.id),
					eq(schema.modifierGroup.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Modifier group not found" });
		}

		await db
			.delete(schema.modifierGroup)
			.where(
				and(
					eq(schema.modifierGroup.id, input.id),
					eq(schema.modifierGroup.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── createModifier ──────────────────────────────────────────────────────
const createModifier = permissionProcedure("modifiers.create")
	.input(
		z.object({
			groupId: z.string().uuid(),
			name: z.string().min(1),
			priceAdjustment: z.number().default(0),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const groupExists = await db
			.select({ id: schema.modifierGroup.id })
			.from(schema.modifierGroup)
			.where(
				and(
					eq(schema.modifierGroup.id, input.groupId),
					eq(schema.modifierGroup.organizationId, orgId),
				),
			)
			.limit(1);

		if (groupExists.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Modifier group not found" });
		}

		const rows = await db
			.insert(schema.modifier)
			.values({
				modifierGroupId: input.groupId,
				name: input.name,
				price: input.priceAdjustment.toFixed(2),
			})
			.returning({ id: schema.modifier.id });

		return { id: rows[0]?.id };
	});

// ── updateModifier ──────────────────────────────────────────────────────
const updateModifier = permissionProcedure("modifiers.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			priceAdjustment: z.number().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		// Fetch modifier with its group to verify org ownership
		const existing = await db
			.select({ id: schema.modifier.id })
			.from(schema.modifier)
			.innerJoin(
				schema.modifierGroup,
				eq(schema.modifier.modifierGroupId, schema.modifierGroup.id),
			)
			.where(
				and(
					eq(schema.modifier.id, input.id),
					eq(schema.modifierGroup.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Modifier not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.priceAdjustment !== undefined)
			updates.price = input.priceAdjustment.toFixed(2);

		await db
			.update(schema.modifier)
			.set(updates)
			.where(eq(schema.modifier.id, input.id));

		return { success: true };
	});

// ── deleteModifier ──────────────────────────────────────────────────────
const deleteModifier = permissionProcedure("modifiers.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		// Fetch modifier with its group to verify org ownership
		const existing = await db
			.select({ id: schema.modifier.id })
			.from(schema.modifier)
			.innerJoin(
				schema.modifierGroup,
				eq(schema.modifier.modifierGroupId, schema.modifierGroup.id),
			)
			.where(
				and(
					eq(schema.modifier.id, input.id),
					eq(schema.modifierGroup.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Modifier not found" });
		}

		await db.delete(schema.modifier).where(eq(schema.modifier.id, input.id));

		return { success: true };
	});

// ── linkGroupToProduct ──────────────────────────────────────────────────
const linkGroupToProduct = permissionProcedure("modifiers.update")
	.input(
		z.object({
			groupId: z.string().uuid(),
			productId: z.string().uuid(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		// Verify both product and group belong to this org
		const [groupRows, productRows] = await Promise.all([
			db
				.select({ id: schema.modifierGroup.id })
				.from(schema.modifierGroup)
				.where(
					and(
						eq(schema.modifierGroup.id, input.groupId),
						eq(schema.modifierGroup.organizationId, orgId),
					),
				)
				.limit(1),
			db
				.select({ id: schema.product.id })
				.from(schema.product)
				.where(
					and(
						eq(schema.product.id, input.productId),
						eq(schema.product.organizationId, orgId),
					),
				)
				.limit(1),
		]);

		if (groupRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Modifier group not found" });
		}
		if (productRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Product not found" });
		}

		await db
			.insert(schema.productModifierGroup)
			.values({
				productId: input.productId,
				modifierGroupId: input.groupId,
			})
			.onConflictDoNothing();

		return { success: true };
	});

// ── unlinkGroupFromProduct ──────────────────────────────────────────────
const unlinkGroupFromProduct = permissionProcedure("modifiers.update")
	.input(
		z.object({
			groupId: z.string().uuid(),
			productId: z.string().uuid(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		// Verify both product and group belong to this org
		const [groupRows, productRows] = await Promise.all([
			db
				.select({ id: schema.modifierGroup.id })
				.from(schema.modifierGroup)
				.where(
					and(
						eq(schema.modifierGroup.id, input.groupId),
						eq(schema.modifierGroup.organizationId, orgId),
					),
				)
				.limit(1),
			db
				.select({ id: schema.product.id })
				.from(schema.product)
				.where(
					and(
						eq(schema.product.id, input.productId),
						eq(schema.product.organizationId, orgId),
					),
				)
				.limit(1),
		]);

		if (groupRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Modifier group not found" });
		}
		if (productRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Product not found" });
		}

		await db
			.delete(schema.productModifierGroup)
			.where(
				and(
					eq(schema.productModifierGroup.productId, input.productId),
					eq(schema.productModifierGroup.modifierGroupId, input.groupId),
				),
			);

		return { success: true };
	});

export const modifiersRouter = {
	listGroups,
	createGroup,
	updateGroup,
	deleteGroup,
	createModifier,
	updateModifier,
	deleteModifier,
	linkGroupToProduct,
	unlinkGroupFromProduct,
};
