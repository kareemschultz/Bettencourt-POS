import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure, protectedProcedure } from "../index";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

// ── listLocations ────────────────────────────────────────────────────
const listLocations = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const locations = await db
			.select()
			.from(schema.location)
			.where(eq(schema.location.organizationId, DEFAULT_ORG_ID))
			.orderBy(asc(schema.location.name));

		return locations;
	});

// ── getLocation ──────────────────────────────────────────────────────
const getLocation = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		const rows = await db
			.select()
			.from(schema.location)
			.where(
				and(
					eq(schema.location.id, input.id),
					eq(schema.location.organizationId, DEFAULT_ORG_ID),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Location not found" });
		}

		return rows[0]!;
	});

// ── createLocation ───────────────────────────────────────────────────
const createLocation = permissionProcedure("settings.write")
	.input(
		z.object({
			name: z.string().min(1),
			address: z.string().nullable().optional(),
			phone: z.string().nullable().optional(),
			timezone: z.string().default("America/Guyana"),
			receiptHeader: z.string().nullable().optional(),
			receiptFooter: z.string().nullable().optional(),
			isActive: z.boolean().default(true),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.insert(schema.location)
			.values({
				organizationId: DEFAULT_ORG_ID,
				name: input.name,
				address: input.address ?? null,
				phone: input.phone ?? null,
				timezone: input.timezone,
				receiptHeader: input.receiptHeader ?? null,
				receiptFooter: input.receiptFooter ?? null,
				isActive: input.isActive,
			})
			.returning();

		return rows[0]!;
	});

// ── updateLocation ───────────────────────────────────────────────────
const updateLocation = permissionProcedure("settings.write")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			address: z.string().nullable().optional(),
			phone: z.string().nullable().optional(),
			timezone: z.string().optional(),
			receiptHeader: z.string().nullable().optional(),
			receiptFooter: z.string().nullable().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select()
			.from(schema.location)
			.where(
				and(
					eq(schema.location.id, input.id),
					eq(schema.location.organizationId, DEFAULT_ORG_ID),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Location not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.address !== undefined) updates.address = input.address;
		if (input.phone !== undefined) updates.phone = input.phone;
		if (input.timezone !== undefined) updates.timezone = input.timezone;
		if (input.receiptHeader !== undefined)
			updates.receiptHeader = input.receiptHeader;
		if (input.receiptFooter !== undefined)
			updates.receiptFooter = input.receiptFooter;
		if (input.isActive !== undefined) updates.isActive = input.isActive;

		if (Object.keys(updates).length > 0) {
			await db
				.update(schema.location)
				.set(updates)
				.where(eq(schema.location.id, input.id));
		}

		return { success: true };
	});

// ── deleteLocation ───────────────────────────────────────────────────
// Soft-delete: sets isActive = false. Prevents deletion if active orders exist.
const deleteLocation = permissionProcedure("settings.write")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		const existing = await db
			.select()
			.from(schema.location)
			.where(
				and(
					eq(schema.location.id, input.id),
					eq(schema.location.organizationId, DEFAULT_ORG_ID),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Location not found" });
		}

		// Check for active (non-completed/cancelled) orders at this location
		const activeOrders = await db
			.select({ id: schema.order.id })
			.from(schema.order)
			.where(
				and(
					eq(schema.order.locationId, input.id),
					eq(schema.order.status, "open"),
				),
			)
			.limit(1);

		if (activeOrders.length > 0) {
			throw new ORPCError("CONFLICT", {
				message: "Cannot deactivate location with active orders",
			});
		}

		await db
			.update(schema.location)
			.set({ isActive: false })
			.where(eq(schema.location.id, input.id));

		return { success: true };
	});

export const locationsRouter = {
	listLocations,
	getLocation,
	createLocation,
	updateLocation,
	deleteLocation,
};
