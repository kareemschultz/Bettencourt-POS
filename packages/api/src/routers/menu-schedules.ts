import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── list ──────────────────────────────────────────────────────────────
const list = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const schedules = await db
			.select({
				id: schema.menuSchedule.id,
				organizationId: schema.menuSchedule.organizationId,
				name: schema.menuSchedule.name,
				startTime: schema.menuSchedule.startTime,
				endTime: schema.menuSchedule.endTime,
				daysOfWeek: schema.menuSchedule.daysOfWeek,
				isActive: schema.menuSchedule.isActive,
				createdAt: schema.menuSchedule.createdAt,
				productCount: sql<number>`(
					SELECT count(*)::int FROM menu_schedule_product
					WHERE menu_schedule_product.menu_schedule_id = ${schema.menuSchedule.id}
				)`,
			})
			.from(schema.menuSchedule)
			.where(eq(schema.menuSchedule.organizationId, orgId))
			.orderBy(asc(schema.menuSchedule.name));

		return schedules;
	});

// ── getById ──────────────────────────────────────────────────────────
const getById = permissionProcedure("settings.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.menuSchedule)
			.where(
				and(
					eq(schema.menuSchedule.id, input.id),
					eq(schema.menuSchedule.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Schedule not found" });
		}

		const schedule = rows[0]!;

		// Get assigned products with product info
		const products = await db
			.select({
				productId: schema.menuScheduleProduct.productId,
				overridePrice: schema.menuScheduleProduct.overridePrice,
				productName: schema.product.name,
				productPrice: schema.product.price,
				productSku: schema.product.sku,
			})
			.from(schema.menuScheduleProduct)
			.innerJoin(
				schema.product,
				eq(schema.menuScheduleProduct.productId, schema.product.id),
			)
			.where(eq(schema.menuScheduleProduct.menuScheduleId, input.id))
			.orderBy(asc(schema.product.name));

		return { ...schedule, products };
	});

// ── create ───────────────────────────────────────────────────────────
const create = permissionProcedure("settings.update")
	.input(
		z.object({
			name: z.string().min(1),
			startTime: z.string().min(1),
			endTime: z.string().min(1),
			daysOfWeek: z.string().min(1),
			isActive: z.boolean().default(true),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.insert(schema.menuSchedule)
			.values({
				organizationId: orgId,
				name: input.name,
				startTime: input.startTime,
				endTime: input.endTime,
				daysOfWeek: input.daysOfWeek,
				isActive: input.isActive,
			})
			.returning({ id: schema.menuSchedule.id });

		return { id: rows[0]?.id };
	});

// ── update ───────────────────────────────────────────────────────────
const update = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			startTime: z.string().min(1).optional(),
			endTime: z.string().min(1).optional(),
			daysOfWeek: z.string().min(1).optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.menuSchedule)
			.where(
				and(
					eq(schema.menuSchedule.id, input.id),
					eq(schema.menuSchedule.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Schedule not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.startTime !== undefined) updates.startTime = input.startTime;
		if (input.endTime !== undefined) updates.endTime = input.endTime;
		if (input.daysOfWeek !== undefined) updates.daysOfWeek = input.daysOfWeek;
		if (input.isActive !== undefined) updates.isActive = input.isActive;

		await db
			.update(schema.menuSchedule)
			.set(updates)
			.where(
				and(
					eq(schema.menuSchedule.id, input.id),
					eq(schema.menuSchedule.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── delete ───────────────────────────────────────────────────────────
const deleteSchedule = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.delete(schema.menuSchedule)
			.where(
				and(
					eq(schema.menuSchedule.id, input.id),
					eq(schema.menuSchedule.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── assignProducts ───────────────────────────────────────────────────
const assignProducts = permissionProcedure("settings.update")
	.input(
		z.object({
			scheduleId: z.string().uuid(),
			products: z.array(
				z.object({
					productId: z.string().uuid(),
					overridePrice: z.number().nullable().optional(),
				}),
			),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		// Verify schedule exists
		const existing = await db
			.select({ id: schema.menuSchedule.id })
			.from(schema.menuSchedule)
			.where(
				and(
					eq(schema.menuSchedule.id, input.scheduleId),
					eq(schema.menuSchedule.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Schedule not found" });
		}

		// Delete all existing assignments and re-insert atomically
		await db.transaction(async (tx) => {
			await tx
				.delete(schema.menuScheduleProduct)
				.where(eq(schema.menuScheduleProduct.menuScheduleId, input.scheduleId));

			if (input.products.length > 0) {
				await tx.insert(schema.menuScheduleProduct).values(
					input.products.map((p) => ({
						menuScheduleId: input.scheduleId,
						productId: p.productId,
						overridePrice: p.overridePrice?.toFixed(2) ?? null,
					})),
				);
			}
		});

		return { success: true };
	});

// ── removeProduct ────────────────────────────────────────────────────
const removeProduct = permissionProcedure("settings.update")
	.input(
		z.object({
			scheduleId: z.string().uuid(),
			productId: z.string().uuid(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const schedule = await db
			.select({ id: schema.menuSchedule.id })
			.from(schema.menuSchedule)
			.where(
				and(
					eq(schema.menuSchedule.id, input.scheduleId),
					eq(schema.menuSchedule.organizationId, orgId),
				),
			)
			.limit(1);
		if (!schedule[0]) {
			throw new ORPCError("NOT_FOUND", { message: "Schedule not found" });
		}
		await db
			.delete(schema.menuScheduleProduct)
			.where(
				and(
					eq(schema.menuScheduleProduct.menuScheduleId, input.scheduleId),
					eq(schema.menuScheduleProduct.productId, input.productId),
				),
			);

		return { success: true };
	});

// ── getActiveSchedule ────────────────────────────────────────────────
const getActiveSchedule = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		// Get all active schedules
		const schedules = await db
			.select()
			.from(schema.menuSchedule)
			.where(
				and(
					eq(schema.menuSchedule.organizationId, orgId),
					eq(schema.menuSchedule.isActive, true),
				),
			);

		const now = new Date();
		const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		const currentDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
			now.getDay()
		]!;

		const active = schedules.find((s) => {
			// Check day
			const days = s.daysOfWeek.split(",").map((d) => d.trim().toLowerCase());
			if (!days.includes(currentDay)) return false;

			// Check time window
			if (s.startTime <= s.endTime) {
				// Normal window: e.g. 09:00 to 14:00
				return currentTime >= s.startTime && currentTime <= s.endTime;
			}
			// Overnight window: e.g. 22:00 to 06:00
			return currentTime >= s.startTime || currentTime <= s.endTime;
		});

		if (!active) return null;

		// Get the products for this schedule
		const products = await db
			.select({
				productId: schema.menuScheduleProduct.productId,
				overridePrice: schema.menuScheduleProduct.overridePrice,
				productName: schema.product.name,
				productPrice: schema.product.price,
			})
			.from(schema.menuScheduleProduct)
			.innerJoin(
				schema.product,
				eq(schema.menuScheduleProduct.productId, schema.product.id),
			)
			.where(eq(schema.menuScheduleProduct.menuScheduleId, active.id));

		return { ...active, products };
	});

export const menuSchedulesRouter = {
	list,
	getById,
	create,
	update,
	delete: deleteSchedule,
	assignProducts,
	removeProduct,
	getActiveSchedule,
};
