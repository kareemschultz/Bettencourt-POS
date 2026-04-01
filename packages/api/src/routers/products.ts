import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";
import { hasPermission, loadUserPermissions } from "../lib/permissions";

// ── list ────────────────────────────────────────────────────────────────
const list = permissionProcedure("products.read")
	.input(
		z
			.object({
				departmentId: z.string().uuid().optional(),
				search: z.string().optional(),
				includeInactive: z.boolean().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		const conditions: ReturnType<typeof eq>[] = [];
		if (!input.includeInactive) {
			conditions.push(eq(schema.product.isActive, true));
		}

		conditions.push(eq(schema.product.organizationId, orgId));
		if (input.departmentId) {
			conditions.push(
				eq(schema.product.reportingCategoryId, input.departmentId),
			);
		}
		if (input.search) {
			const pattern = `%${input.search}%`;
			conditions.push(
				or(
					ilike(schema.product.name, pattern),
					ilike(schema.product.sku, pattern),
				)!,
			);
		}

		const products = await db
			.select({
				id: schema.product.id,
				organizationId: schema.product.organizationId,
				name: schema.product.name,
				reportingName: schema.product.reportingName,
				reportingCategoryId: schema.product.reportingCategoryId,
				sku: schema.product.sku,
				price: schema.product.price,
				cost: schema.product.cost,
				taxRate: schema.product.taxRate,
				isActive: schema.product.isActive,
				imageUrl: schema.product.imageUrl,
				sortOrder: schema.product.sortOrder,
				createdAt: schema.product.createdAt,
				updatedAt: schema.product.updatedAt,
				departmentName: schema.reportingCategory.name,
			})
			.from(schema.product)
			.leftJoin(
				schema.reportingCategory,
				eq(schema.product.reportingCategoryId, schema.reportingCategory.id),
			)
			.where(and(...conditions))
			.orderBy(asc(schema.product.sortOrder), asc(schema.product.name));

		return products;
	});

// ── getById ─────────────────────────────────────────────────────────────
const getById = permissionProcedure("products.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const products = await db
			.select({
				id: schema.product.id,
				organizationId: schema.product.organizationId,
				name: schema.product.name,
				reportingName: schema.product.reportingName,
				reportingCategoryId: schema.product.reportingCategoryId,
				sku: schema.product.sku,
				price: schema.product.price,
				cost: schema.product.cost,
				taxRate: schema.product.taxRate,
				isActive: schema.product.isActive,
				imageUrl: schema.product.imageUrl,
				sortOrder: schema.product.sortOrder,
				createdAt: schema.product.createdAt,
				updatedAt: schema.product.updatedAt,
				departmentName: schema.reportingCategory.name,
			})
			.from(schema.product)
			.leftJoin(
				schema.reportingCategory,
				eq(schema.product.reportingCategoryId, schema.reportingCategory.id),
			)
			.where(
				and(
					eq(schema.product.id, input.id),
					eq(schema.product.organizationId, orgId),
				),
			);

		if (products.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Product not found" });
		}

		// Get modifier groups and modifiers
		const modifierGroupsRaw = await db
			.select({
				groupId: schema.modifierGroup.id,
				groupName: schema.modifierGroup.name,
				required: schema.modifierGroup.required,
				minSelect: schema.modifierGroup.minSelect,
				maxSelect: schema.modifierGroup.maxSelect,
				modifierId: schema.modifier.id,
				modifierName: schema.modifier.name,
				modifierPrice: schema.modifier.price,
			})
			.from(schema.productModifierGroup)
			.innerJoin(
				schema.modifierGroup,
				eq(
					schema.productModifierGroup.modifierGroupId,
					schema.modifierGroup.id,
				),
			)
			.leftJoin(
				schema.modifier,
				eq(schema.modifier.modifierGroupId, schema.modifierGroup.id),
			)
			.where(eq(schema.productModifierGroup.productId, input.id));

		// Group by modifier group
		const groupMap = new Map<
			string,
			{
				id: string;
				name: string;
				required: boolean;
				minSelect: number;
				maxSelect: number;
				modifiers: Array<{
					id: string | null;
					name: string | null;
					price: string | null;
				}>;
			}
		>();
		for (const row of modifierGroupsRaw) {
			if (!groupMap.has(row.groupId)) {
				groupMap.set(row.groupId, {
					id: row.groupId,
					name: row.groupName,
					required: row.required,
					minSelect: row.minSelect,
					maxSelect: row.maxSelect,
					modifiers: [],
				});
			}
			if (row.modifierId) {
				groupMap.get(row.groupId)?.modifiers.push({
					id: row.modifierId,
					name: row.modifierName,
					price: row.modifierPrice,
				});
			}
		}

		// Get combo components
		const comboProductRow = await db
			.select({ id: schema.comboProduct.id })
			.from(schema.comboProduct)
			.where(eq(schema.comboProduct.productId, input.id));

		let comboComponents: Array<{
			id: string;
			componentName: string;
			allocatedPrice: string;
			departmentName: string | null;
		}> = [];

		if (comboProductRow.length > 0) {
			comboComponents = await db
				.select({
					id: schema.comboComponent.id,
					componentName: schema.comboComponent.componentName,
					allocatedPrice: schema.comboComponent.allocatedPrice,
					departmentName: schema.reportingCategory.name,
				})
				.from(schema.comboComponent)
				.leftJoin(
					schema.reportingCategory,
					eq(schema.comboComponent.departmentId, schema.reportingCategory.id),
				)
				.where(
					eq(schema.comboComponent.comboProductId, comboProductRow[0]!.id),
				);
		}

		return {
			...products[0],
			modifierGroups: Array.from(groupMap.values()),
			comboComponents,
		};
	});

// ── create ──────────────────────────────────────────────────────────────
const create = permissionProcedure("products.create")
	.input(
		z.object({
			reportingCategoryId: z.string().uuid().nullable().optional(),
			proteinCategoryId: z.string().uuid().nullable().optional(),
			name: z.string().min(1),
			sku: z.string().nullable().optional(),
			price: z.string(),
			cost: z.string().optional().default("0"),
			taxRate: z.string().optional().default("0"),
			imageUrl: z.string().nullable().optional(),
			sortOrder: z.number().int().optional().default(0),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.insert(schema.product)
			.values({
				organizationId: orgId,
				reportingCategoryId: input.reportingCategoryId ?? null,
				proteinCategoryId: input.proteinCategoryId ?? null,
				name: input.name,
				sku: input.sku ?? null,
				price: input.price,
				cost: input.cost,
				taxRate: input.taxRate,
				imageUrl: input.imageUrl ?? null,
				sortOrder: input.sortOrder,
			})
			.returning({ id: schema.product.id });

		return { id: rows[0]?.id };
	});

// ── update ──────────────────────────────────────────────────────────────
const update = permissionProcedure("products.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().optional(),
			sku: z.string().nullable().optional(),
			price: z.string().optional(),
			cost: z.string().optional(),
			taxRate: z.string().optional(),
			reportingCategoryId: z.string().uuid().nullable().optional(),
			proteinCategoryId: z.string().uuid().nullable().optional(),
			isActive: z.boolean().optional(),
			imageUrl: z.string().nullable().optional(),
			sortOrder: z.number().int().optional(),
			supervisorId: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { id, supervisorId, ...updates } = input;
		const orgId = requireOrganizationId(context);

		// Price/cost changes require prices.override permission
		const isPriceChange =
			updates.price !== undefined || updates.cost !== undefined;
		if (isPriceChange) {
			const requestingPerms = context.userPermissions;
			const requestingHasOverride = hasPermission(
				requestingPerms,
				"prices.override",
			);

			if (!requestingHasOverride) {
				if (!supervisorId) {
					throw new ORPCError("FORBIDDEN", {
						message: "Price changes require supervisor authorization",
					});
				}
				// Verify supervisor has prices.override
				const supervisorPerms = await loadUserPermissions(supervisorId);
				if (!hasPermission(supervisorPerms, "prices.override")) {
					throw new ORPCError("FORBIDDEN", {
						message:
							"Supervisor does not have permission to authorize price changes",
					});
				}
			}
		}

		// Filter out undefined values
		const setValues: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				setValues[key] = value;
			}
		}

		if (Object.keys(setValues).length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No fields to update",
			});
		}

		await db
			.update(schema.product)
			.set(setValues)
			.where(
				and(
					eq(schema.product.id, id),
					eq(schema.product.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── getRecipe ──────────────────────────────────────────────────────────
const getRecipe = permissionProcedure("products.read")
	.input(z.object({ productId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const ingredients = await db
			.select({
				id: schema.recipeIngredient.id,
				inventoryItemId: schema.recipeIngredient.inventoryItemId,
				quantity: schema.recipeIngredient.quantity,
				unit: schema.recipeIngredient.unit,
				itemName: schema.inventoryItem.name,
				avgCost: schema.inventoryItem.avgCost,
			})
			.from(schema.recipeIngredient)
			.innerJoin(
				schema.inventoryItem,
				eq(schema.recipeIngredient.inventoryItemId, schema.inventoryItem.id),
			)
			.innerJoin(
				schema.product,
				eq(schema.recipeIngredient.productId, schema.product.id),
			)
			.where(
				and(
					eq(schema.recipeIngredient.productId, input.productId),
					eq(schema.product.organizationId, orgId),
				),
			)
			.orderBy(asc(schema.inventoryItem.name));
		return ingredients;
	});

// ── saveRecipe ─────────────────────────────────────────────────────────
const saveRecipe = permissionProcedure("products.update")
	.input(
		z.object({
			productId: z.string().uuid(),
			ingredients: z.array(
				z.object({
					inventoryItemId: z.string().uuid(),
					quantity: z.string(),
					unit: z.string(),
				}),
			),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const scopedProduct = await db
			.select({ id: schema.product.id })
			.from(schema.product)
			.where(
				and(
					eq(schema.product.id, input.productId),
					eq(schema.product.organizationId, orgId),
				),
			)
			.limit(1);
		if (scopedProduct.length === 0) {
			throw new ORPCError("FORBIDDEN", {
				message: "Product is outside your organization scope",
			});
		}
		// Delete existing
		await db
			.delete(schema.recipeIngredient)
			.where(eq(schema.recipeIngredient.productId, input.productId));
		// Insert new
		if (input.ingredients.length > 0) {
			await db.insert(schema.recipeIngredient).values(
				input.ingredients.map((ing) => ({
					productId: input.productId,
					inventoryItemId: ing.inventoryItemId,
					quantity: ing.quantity,
					unit: ing.unit,
				})),
			);
		}
		return { success: true };
	});

// ── delete (soft-delete) ────────────────────────────────────────────────
const remove = permissionProcedure("products.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.product)
			.set({ isActive: false })
			.where(
				and(
					eq(schema.product.id, input.id),
					eq(schema.product.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── getBarcodes ─────────────────────────────────────────────────────────
const getBarcodes = permissionProcedure("products.read")
	.input(z.object({ productId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const scopedProduct = await db
			.select({ id: schema.product.id })
			.from(schema.product)
			.where(
				and(
					eq(schema.product.id, input.productId),
					eq(schema.product.organizationId, orgId),
				),
			)
			.limit(1);
		if (scopedProduct.length === 0) {
			throw new ORPCError("FORBIDDEN", {
				message: "Product is outside your organization scope",
			});
		}
		const barcodes = await db
			.select()
			.from(schema.productBarcode)
			.where(eq(schema.productBarcode.productId, input.productId))
			.orderBy(asc(schema.productBarcode.createdAt));

		return barcodes;
	});

// ── addBarcode ──────────────────────────────────────────────────────────
const addBarcode = permissionProcedure("products.update")
	.input(
		z.object({
			productId: z.string().uuid(),
			barcode: z.string().min(1).max(100),
			format: z
				.enum(["code128", "ean13", "upca", "code39", "internal"])
				.optional()
				.default("code128"),
			isPrimary: z.boolean().optional().default(false),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const scopedProduct = await db
			.select({ id: schema.product.id })
			.from(schema.product)
			.where(
				and(
					eq(schema.product.id, input.productId),
					eq(schema.product.organizationId, orgId),
				),
			)
			.limit(1);
		if (scopedProduct.length === 0) {
			throw new ORPCError("FORBIDDEN", {
				message: "Product is outside your organization scope",
			});
		}
		const rows = await db
			.insert(schema.productBarcode)
			.values({
				productId: input.productId,
				barcode: input.barcode,
				format: input.format,
				isPrimary: input.isPrimary,
			})
			.returning();

		return rows[0]!;
	});

// ── removeBarcode ───────────────────────────────────────────────────────
const removeBarcode = permissionProcedure("products.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const scopedBarcode = await db
			.select({ id: schema.productBarcode.id })
			.from(schema.productBarcode)
			.innerJoin(
				schema.product,
				eq(schema.productBarcode.productId, schema.product.id),
			)
			.where(
				and(
					eq(schema.productBarcode.id, input.id),
					eq(schema.product.organizationId, orgId),
				),
			)
			.limit(1);
		if (scopedBarcode.length === 0) {
			throw new ORPCError("FORBIDDEN", {
				message: "Barcode is outside your organization scope",
			});
		}
		await db
			.delete(schema.productBarcode)
			.where(eq(schema.productBarcode.id, input.id));

		return { success: true };
	});

export const productsRouter = {
	list,
	getById,
	create,
	update,
	delete: remove,
	getRecipe,
	saveRecipe,
	getBarcodes,
	addBarcode,
	removeBarcode,
};
