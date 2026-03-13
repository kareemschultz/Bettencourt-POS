/**
 * Pricelists Router (GAP-018)
 * Customer-specific pricing: create pricelists, assign items, link to customers.
 */
import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── getPricelists ─────────────────────────────────────────────────────

const getPricelists = permissionProcedure("products.read")
	.input(z.object({ includeItems: z.boolean().optional() }).optional())
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const lists = await db
			.select()
			.from(schema.pricelist)
			.where(eq(schema.pricelist.organizationId, orgId))
			.orderBy(schema.pricelist.name);

		if (!input?.includeItems) return lists;

		// Include items for each pricelist
		const items = await db
			.select({
				id: schema.pricelistItem.id,
				pricelistId: schema.pricelistItem.pricelistId,
				productId: schema.pricelistItem.productId,
				price: schema.pricelistItem.price,
				productName: schema.product.name,
				productSku: schema.product.sku,
			})
			.from(schema.pricelistItem)
			.innerJoin(
				schema.product,
				eq(schema.pricelistItem.productId, schema.product.id),
			);

		return lists.map((list) => ({
			...list,
			items: items.filter((i) => i.pricelistId === list.id),
		}));
	});

// ── createPricelist ───────────────────────────────────────────────────

const createPricelist = permissionProcedure("products.create")
	.input(
		z.object({
			name: z.string().min(1),
			description: z.string().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const [created] = await db
			.insert(schema.pricelist)
			.values({
				organizationId: orgId,
				name: input.name,
				description: input.description ?? null,
				isActive: input.isActive ?? true,
			})
			.returning();
		return created!;
	});

// ── updatePricelist ───────────────────────────────────────────────────

const updatePricelist = permissionProcedure("products.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			description: z.string().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.pricelist)
			.set({
				...(input.name ? { name: input.name } : {}),
				...(input.description !== undefined
					? { description: input.description }
					: {}),
				...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
			})
			.where(
				and(
					eq(schema.pricelist.id, input.id),
					eq(schema.pricelist.organizationId, orgId),
				),
			);
		return { status: "updated" };
	});

// ── deletePricelist ───────────────────────────────────────────────────

const deletePricelist = permissionProcedure("products.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.delete(schema.pricelist)
			.where(
				and(
					eq(schema.pricelist.id, input.id),
					eq(schema.pricelist.organizationId, orgId),
				),
			);
		return { status: "deleted" };
	});

// ── setPricelistItems ─────────────────────────────────────────────────
// Upsert all items for a pricelist (replaces existing)

const setPricelistItems = permissionProcedure("products.update")
	.input(
		z.object({
			pricelistId: z.string().uuid(),
			items: z.array(
				z.object({
					productId: z.string().uuid(),
					price: z.string(),
				}),
			),
		}),
	)
	.handler(async ({ input }) => {
		// Delete existing items and re-insert
		await db
			.delete(schema.pricelistItem)
			.where(eq(schema.pricelistItem.pricelistId, input.pricelistId));

		if (input.items.length > 0) {
			await db.insert(schema.pricelistItem).values(
				input.items.map((item) => ({
					pricelistId: input.pricelistId,
					productId: item.productId,
					price: item.price,
				})),
			);
		}
		return { status: "updated", count: input.items.length };
	});

// ── assignCustomerPricelist ───────────────────────────────────────────

const assignCustomerPricelist = permissionProcedure("customers.update")
	.input(
		z.object({
			customerId: z.string().uuid(),
			pricelistId: z.string().uuid(),
		}),
	)
	.handler(async ({ input }) => {
		// Remove existing pricelist assignment and set new one
		await db
			.delete(schema.customerPricelist)
			.where(eq(schema.customerPricelist.customerId, input.customerId));

		const [created] = await db
			.insert(schema.customerPricelist)
			.values({
				customerId: input.customerId,
				pricelistId: input.pricelistId,
			})
			.returning();
		return created!;
	});

// ── removeCustomerPricelist ───────────────────────────────────────────

const removeCustomerPricelist = permissionProcedure("customers.update")
	.input(z.object({ customerId: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.customerPricelist)
			.where(eq(schema.customerPricelist.customerId, input.customerId));
		return { status: "removed" };
	});

// ── getCustomerPrice ──────────────────────────────────────────────────
// Look up the effective price for a product given a customer.
// Returns custom price if customer has an assigned pricelist covering that product,
// otherwise null (caller should use standard product price).

const getCustomerPrice = permissionProcedure("orders.read")
	.input(
		z.object({
			customerId: z.string().uuid(),
			productId: z.string().uuid(),
		}),
	)
	.handler(async ({ input }) => {
		// Find customer's pricelist
		const [assignment] = await db
			.select({ pricelistId: schema.customerPricelist.pricelistId })
			.from(schema.customerPricelist)
			.where(eq(schema.customerPricelist.customerId, input.customerId))
			.limit(1);

		if (!assignment) return { customPrice: null };

		// Find product price in that pricelist
		const [item] = await db
			.select({ price: schema.pricelistItem.price })
			.from(schema.pricelistItem)
			.where(
				and(
					eq(schema.pricelistItem.pricelistId, assignment.pricelistId),
					eq(schema.pricelistItem.productId, input.productId),
				),
			)
			.limit(1);

		return { customPrice: item?.price ?? null };
	});

export const pricelistsRouter = {
	getPricelists,
	createPricelist,
	updatePricelist,
	deletePricelist,
	setPricelistItems,
	assignCustomerPricelist,
	removeCustomerPricelist,
	getCustomerPrice,
};
