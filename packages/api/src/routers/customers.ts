import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── list ──────────────────────────────────────────────────────────────
const list = permissionProcedure("customers.read")
	.input(
		z
			.object({
				search: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const orgId = requireOrganizationId(context);
		const search = rawInput?.search;
		const limit = rawInput?.limit ?? 50;
		const offset = rawInput?.offset ?? 0;
		const conditions = [eq(schema.customer.organizationId, orgId)];

		if (search && search.trim().length > 0) {
			const term = `%${search.trim()}%`;
			conditions.push(
				or(
					ilike(schema.customer.name, term),
					ilike(schema.customer.phone, term),
					ilike(schema.customer.email, term),
				)!,
			);
		}

		const [customers, countResult] = await Promise.all([
			db
				.select()
				.from(schema.customer)
				.where(and(...conditions))
				.orderBy(desc(schema.customer.lastVisitAt), asc(schema.customer.name))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(schema.customer)
				.where(and(...conditions)),
		]);

		return {
			customers,
			total: countResult[0]?.count ?? 0,
		};
	});

// ── getById ───────────────────────────────────────────────────────────
const getById = permissionProcedure("customers.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.customer)
			.where(
				and(
					eq(schema.customer.id, input.id),
					eq(schema.customer.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
		}

		return rows[0]!;
	});

// ── create ────────────────────────────────────────────────────────────
const create = permissionProcedure("customers.create")
	.input(
		z.object({
			name: z.string().min(1),
			phone: z.string().min(1).optional(),
			email: z.string().email().optional(),
			address: z.string().optional(),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		// Check phone uniqueness within org
		if (input.phone) {
			const existing = await db
				.select({ id: schema.customer.id })
				.from(schema.customer)
				.where(
					and(
						eq(schema.customer.organizationId, orgId),
						eq(schema.customer.phone, input.phone),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				throw new ORPCError("CONFLICT", {
					message: "A customer with this phone number already exists",
				});
			}
		}

		const rows = await db
			.insert(schema.customer)
			.values({
				organizationId: orgId,
				name: input.name,
				phone: input.phone ?? null,
				email: input.email ?? null,
				address: input.address ?? null,
				notes: input.notes ?? null,
			})
			.returning();

		return rows[0]!;
	});

// ── update ────────────────────────────────────────────────────────────
const update = permissionProcedure("customers.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			phone: z.string().optional(),
			email: z.string().email().nullable().optional(),
			address: z.string().nullable().optional(),
			notes: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.customer)
			.where(
				and(
					eq(schema.customer.id, input.id),
					eq(schema.customer.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
		}

		// Check phone uniqueness if changing phone
		if (input.phone !== undefined && input.phone !== existing[0]?.phone) {
			if (input.phone) {
				const dup = await db
					.select({ id: schema.customer.id })
					.from(schema.customer)
					.where(
						and(
							eq(schema.customer.organizationId, orgId),
							eq(schema.customer.phone, input.phone),
						),
					)
					.limit(1);

				if (dup.length > 0 && dup[0]?.id !== input.id) {
					throw new ORPCError("CONFLICT", {
						message: "A customer with this phone number already exists",
					});
				}
			}
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.phone !== undefined) updates.phone = input.phone;
		if (input.email !== undefined) updates.email = input.email;
		if (input.address !== undefined) updates.address = input.address;
		if (input.notes !== undefined) updates.notes = input.notes;

		await db
			.update(schema.customer)
			.set(updates)
			.where(
				and(
					eq(schema.customer.id, input.id),
					eq(schema.customer.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── search (quick POS lookup by phone) ───────────────────────────────
const search = permissionProcedure("customers.read")
	.input(z.object({ query: z.string().min(1) }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const term = `%${input.query}%`;
		const customers = await db
			.select({
				id: schema.customer.id,
				name: schema.customer.name,
				phone: schema.customer.phone,
				address: schema.customer.address,
				totalSpent: schema.customer.totalSpent,
				visitCount: schema.customer.visitCount,
			})
			.from(schema.customer)
			.where(
				and(
					eq(schema.customer.organizationId, orgId),
					or(
						ilike(schema.customer.name, term),
						ilike(schema.customer.phone, term),
					),
				),
			)
			.orderBy(desc(schema.customer.visitCount))
			.limit(10);

		return customers;
	});

// ── getHistory (order history for a customer) ─────────────────────────
const getHistory = permissionProcedure("customers.read")
	.input(
		z.object({
			customerId: z.string().uuid(),
			limit: z.number().int().min(1).max(50).default(20),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const orders = await db
			.select({
				id: schema.order.id,
				orderNumber: schema.order.orderNumber,
				total: schema.order.total,
				status: schema.order.status,
				createdAt: schema.order.createdAt,
			})
			.from(schema.order)
			.where(
				and(
					eq(schema.order.customerId, input.customerId),
					eq(schema.order.organizationId, orgId),
				),
			)
			.orderBy(desc(schema.order.createdAt))
			.limit(input.limit);

		return orders;
	});

// ── delete ────────────────────────────────────────────────────────────
const deleteCustomer = permissionProcedure("customers.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.delete(schema.customer)
			.where(
				and(
					eq(schema.customer.id, input.id),
					eq(schema.customer.organizationId, orgId),
				),
			);
		return { status: "deleted" };
	});

export const customersRouter = {
	list,
	getById,
	create,
	update,
	search,
	getHistory,
	deleteCustomer,
};
