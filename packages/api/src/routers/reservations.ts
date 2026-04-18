import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── list ────────────────────────────────────────────────────────────────
const list = permissionProcedure("orders.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
				date: z.string().optional(),
				status: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);

		const conditions = [eq(schema.reservation.organizationId, orgId)];
		if (input.locationId) {
			conditions.push(eq(schema.reservation.locationId, input.locationId));
		}
		if (input.date) {
			conditions.push(eq(schema.reservation.date, input.date));
		}
		if (input.status) {
			conditions.push(eq(schema.reservation.status, input.status));
		}

		return db
			.select({
				id: schema.reservation.id,
				customerName: schema.reservation.customerName,
				customerPhone: schema.reservation.customerPhone,
				customerEmail: schema.reservation.customerEmail,
				date: schema.reservation.date,
				time: schema.reservation.time,
				partySize: schema.reservation.partySize,
				tableId: schema.reservation.tableId,
				tableName: schema.tableLayout.name,
				status: schema.reservation.status,
				notes: schema.reservation.notes,
				createdAt: schema.reservation.createdAt,
			})
			.from(schema.reservation)
			.leftJoin(
				schema.tableLayout,
				eq(schema.reservation.tableId, schema.tableLayout.id),
			)
			.where(and(...conditions))
			.orderBy(asc(schema.reservation.date), asc(schema.reservation.time));
	});

// ── create ──────────────────────────────────────────────────────────────
const create = permissionProcedure("orders.create")
	.input(
		z.object({
			locationId: z.string().uuid(),
			customerName: z.string().min(1),
			customerPhone: z.string().nullable().optional(),
			customerEmail: z.string().email().nullable().optional(),
			date: z.string(), // YYYY-MM-DD
			time: z.string(), // HH:MM
			partySize: z.number().int().min(1).max(50).default(2),
			tableId: z.string().uuid().nullable().optional(),
			notes: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const rows = await db
			.insert(schema.reservation)
			.values({
				organizationId: orgId,
				locationId: input.locationId,
				customerName: input.customerName,
				customerPhone: input.customerPhone ?? null,
				customerEmail: input.customerEmail ?? null,
				date: input.date,
				time: input.time,
				partySize: input.partySize,
				tableId: input.tableId ?? null,
				status: "confirmed",
				notes: input.notes ?? null,
			})
			.returning({
				id: schema.reservation.id,
				customerName: schema.reservation.customerName,
			});

		return rows[0]!;
	});

// ── update ──────────────────────────────────────────────────────────────
const update = permissionProcedure("orders.update")
	.input(
		z.object({
			id: z.string().uuid(),
			customerName: z.string().min(1).optional(),
			customerPhone: z.string().nullable().optional(),
			customerEmail: z.string().email().nullable().optional(),
			date: z.string().optional(),
			time: z.string().optional(),
			partySize: z.number().int().min(1).max(50).optional(),
			tableId: z.string().uuid().nullable().optional(),
			status: z
				.enum(["confirmed", "seated", "completed", "cancelled", "no_show"])
				.optional(),
			notes: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...fields } = input;

		const updates: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(fields)) {
			if (value !== undefined) updates[key] = value;
		}

		if (Object.keys(updates).length > 0) {
			await db
				.update(schema.reservation)
				.set(updates)
				.where(eq(schema.reservation.id, id));
		}

		return { success: true };
	});

// ── remove ──────────────────────────────────────────────────────────────
const remove = permissionProcedure("orders.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.reservation)
			.where(eq(schema.reservation.id, input.id));
		return { success: true };
	});

// ── upcoming ────────────────────────────────────────────────────────────
// Get today's upcoming reservations
const upcoming = permissionProcedure("orders.read")
	.input(z.object({ locationId: z.string().uuid().optional() }).optional())
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		const today = new Date().toLocaleDateString("en-CA", {
			timeZone: "America/Guyana",
		});

		const conditions = [
			eq(schema.reservation.organizationId, orgId),
			eq(schema.reservation.date, today),
			eq(schema.reservation.status, "confirmed"),
		];
		if (input.locationId) {
			conditions.push(eq(schema.reservation.locationId, input.locationId));
		}

		return db
			.select({
				id: schema.reservation.id,
				customerName: schema.reservation.customerName,
				customerPhone: schema.reservation.customerPhone,
				time: schema.reservation.time,
				partySize: schema.reservation.partySize,
				tableId: schema.reservation.tableId,
				tableName: schema.tableLayout.name,
				notes: schema.reservation.notes,
			})
			.from(schema.reservation)
			.leftJoin(
				schema.tableLayout,
				eq(schema.reservation.tableId, schema.tableLayout.id),
			)
			.where(and(...conditions))
			.orderBy(asc(schema.reservation.time));
	});

export const reservationsRouter = {
	list,
	create,
	update,
	remove,
	upcoming,
};
