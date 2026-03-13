import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── List pricelists ──────────────────────────────────────────────────
const list = permissionProcedure("products.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select({
				id: schema.pricelist.id,
				name: schema.pricelist.name,
				description: schema.pricelist.description,
				isActive: schema.pricelist.isActive,
				itemCount: sql<number>`(SELECT COUNT(*) FROM pricelist_item WHERE pricelist_id = ${schema.pricelist.id})::int`,
				customerCount: sql<number>`(SELECT COUNT(*) FROM customer WHERE pricelist_id = ${schema.pricelist.id})::int`,
				createdAt: schema.pricelist.createdAt,
			})
			.from(schema.pricelist)
			.where(eq(schema.pricelist.organizationId, orgId))
			.orderBy(schema.pricelist.name);
		return rows;
	});

// ── Get pricelist with items ─────────────────────────────────────────
const get = permissionProcedure("products.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		const rows = await db
			.select({
				id: schema.pricelistItem.id,
				productId: schema.pricelistItem.productId,
				productName: schema.product.name,
				standardPrice: schema.product.price,
				overridePrice: schema.pricelistItem.price,
			})
			.from(schema.pricelistItem)
			.innerJoin(
				schema.product,
				eq(schema.pricelistItem.productId, schema.product.id),
			)
			.where(eq(schema.pricelistItem.pricelistId, input.id))
			.orderBy(schema.product.name);
		return rows;
	});

// ── Create pricelist ─────────────────────────────────────────────────
const create = permissionProcedure("products.create")
	.input(
		z.object({
			name: z.string().min(1),
			description: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const [row] = await db
			.insert(schema.pricelist)
			.values({ organizationId: orgId, ...input })
			.returning();
		return row;
	});

// ── Update pricelist ─────────────────────────────────────────────────
const update = permissionProcedure("products.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			description: z.string().nullable().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		await db
			.update(schema.pricelist)
			.set(data)
			.where(eq(schema.pricelist.id, id));
		return { ok: true };
	});

// ── Delete pricelist ─────────────────────────────────────────────────
const remove = permissionProcedure("products.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db.delete(schema.pricelist).where(eq(schema.pricelist.id, input.id));
		return { ok: true };
	});

// ── Set items (upsert batch) ─────────────────────────────────────────
const setItems = permissionProcedure("products.update")
	.input(
		z.object({
			pricelistId: z.string().uuid(),
			items: z.array(
				z.object({
					productId: z.string().uuid(),
					price: z.number().min(0),
				}),
			),
		}),
	)
	.handler(async ({ input }) => {
		// Delete existing items for this pricelist
		await db
			.delete(schema.pricelistItem)
			.where(eq(schema.pricelistItem.pricelistId, input.pricelistId));

		if (input.items.length > 0) {
			await db.insert(schema.pricelistItem).values(
				input.items.map((item) => ({
					pricelistId: input.pricelistId,
					productId: item.productId,
					price: String(item.price),
				})),
			);
		}
		return { ok: true, count: input.items.length };
	});

// ── Add single item ──────────────────────────────────────────────────
const addItem = permissionProcedure("products.update")
	.input(
		z.object({
			pricelistId: z.string().uuid(),
			productId: z.string().uuid(),
			price: z.number().min(0),
		}),
	)
	.handler(async ({ input }) => {
		await db
			.insert(schema.pricelistItem)
			.values({
				pricelistId: input.pricelistId,
				productId: input.productId,
				price: String(input.price),
			})
			.onConflictDoUpdate({
				target: [
					schema.pricelistItem.pricelistId,
					schema.pricelistItem.productId,
				],
				set: { price: String(input.price) },
			});
		return { ok: true };
	});

// ── Remove single item ──────────────────────────────────────────────
const removeItem = permissionProcedure("products.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.pricelistItem)
			.where(eq(schema.pricelistItem.id, input.id));
		return { ok: true };
	});

// ── Resolve price for a customer + product ───────────────────────────
// Used by POS to get the correct price when a customer is attached
const resolvePrice = permissionProcedure("orders.read")
	.input(
		z.object({
			customerId: z.string().uuid(),
			productId: z.string().uuid(),
		}),
	)
	.handler(async ({ input }) => {
		// Get customer's pricelist
		const [cust] = await db
			.select({ pricelistId: schema.customer.pricelistId })
			.from(schema.customer)
			.where(eq(schema.customer.id, input.customerId));

		if (!cust?.pricelistId) return null;

		// Look up override price
		const [item] = await db
			.select({ price: schema.pricelistItem.price })
			.from(schema.pricelistItem)
			.where(
				and(
					eq(schema.pricelistItem.pricelistId, cust.pricelistId),
					eq(schema.pricelistItem.productId, input.productId),
				),
			);

		return item ? { price: item.price } : null;
	});

// ── Resolve all prices for a customer ────────────────────────────────
// Returns a map of productId → overridePrice for the customer's pricelist
const resolvePrices = permissionProcedure("orders.read")
	.input(z.object({ customerId: z.string().uuid() }))
	.handler(async ({ input }) => {
		const [cust] = await db
			.select({ pricelistId: schema.customer.pricelistId })
			.from(schema.customer)
			.where(eq(schema.customer.id, input.customerId));

		if (!cust?.pricelistId) return {};

		const items = await db
			.select({
				productId: schema.pricelistItem.productId,
				price: schema.pricelistItem.price,
			})
			.from(schema.pricelistItem)
			.where(eq(schema.pricelistItem.pricelistId, cust.pricelistId));

		const map: Record<string, string> = {};
		for (const item of items) {
			map[item.productId] = item.price;
		}
		return map;
	});

export const pricelistsRouter = {
	list,
	get,
	create,
	update,
	remove,
	setItems,
	addItem,
	removeItem,
	resolvePrice,
	resolvePrices,
};
