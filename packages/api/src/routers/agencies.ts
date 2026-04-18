import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── search ────────────────────────────────────────────────────────────
const search = permissionProcedure("customers.read")
	.input(z.object({ query: z.string().min(1) }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const term = `%${input.query}%`;
		return db
			.select({
				id: schema.agency.id,
				name: schema.agency.name,
				supervisorName: schema.agency.supervisorName,
				supervisorPosition: schema.agency.supervisorPosition,
				phone: schema.agency.phone,
				address: schema.agency.address,
			})
			.from(schema.agency)
			.where(
				and(
					eq(schema.agency.organizationId, orgId),
					ilike(schema.agency.name, term),
				),
			)
			.orderBy(asc(schema.agency.name))
			.limit(10);
	});

// ── list ──────────────────────────────────────────────────────────────
const list = permissionProcedure("customers.read")
	.input(
		z
			.object({
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const orgId = requireOrganizationId(context);
		const limit = rawInput?.limit ?? 50;
		const offset = rawInput?.offset ?? 0;

		const [agencies, countResult] = await Promise.all([
			db
				.select()
				.from(schema.agency)
				.where(eq(schema.agency.organizationId, orgId))
				.orderBy(asc(schema.agency.name))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(schema.agency)
				.where(eq(schema.agency.organizationId, orgId)),
		]);

		return {
			agencies,
			total: countResult[0]?.count ?? 0,
		};
	});

// ── create ────────────────────────────────────────────────────────────
const create = permissionProcedure("customers.write")
	.input(
		z.object({
			name: z.string().min(1),
			supervisorName: z.string().optional(),
			supervisorPosition: z.string().optional(),
			phone: z.string().optional(),
			address: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.insert(schema.agency)
			.values({
				organizationId: orgId,
				name: input.name,
				supervisorName: input.supervisorName ?? null,
				supervisorPosition: input.supervisorPosition ?? null,
				phone: input.phone ?? null,
				address: input.address ?? null,
			})
			.returning();

		return rows[0]!;
	});

// ── update ────────────────────────────────────────────────────────────
const update = permissionProcedure("customers.write")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			supervisorName: z.string().nullable().optional(),
			supervisorPosition: z.string().nullable().optional(),
			phone: z.string().nullable().optional(),
			address: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select({ id: schema.agency.id })
			.from(schema.agency)
			.where(
				and(
					eq(schema.agency.id, input.id),
					eq(schema.agency.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Agency not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.supervisorName !== undefined)
			updates.supervisorName = input.supervisorName;
		if (input.supervisorPosition !== undefined)
			updates.supervisorPosition = input.supervisorPosition;
		if (input.phone !== undefined) updates.phone = input.phone;
		if (input.address !== undefined) updates.address = input.address;

		const rows = await db
			.update(schema.agency)
			.set(updates)
			.where(
				and(
					eq(schema.agency.id, input.id),
					eq(schema.agency.organizationId, orgId),
				),
			)
			.returning();

		return rows[0]!;
	});

// ── delete ────────────────────────────────────────────────────────────
const deleteAgency = permissionProcedure("customers.write")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.delete(schema.agency)
			.where(
				and(
					eq(schema.agency.id, input.id),
					eq(schema.agency.organizationId, orgId),
				),
			);
		return { status: "deleted" };
	});

export const agenciesRouter = {
	search,
	list,
	create,
	update,
	delete: deleteAgency,
};
