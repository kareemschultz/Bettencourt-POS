import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

// ── list ──────────────────────────────────────────────────────────────
const list = permissionProcedure("settings.read")
	.input(
		z
			.object({
				activeOnly: z.boolean().default(false),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const activeOnly = rawInput?.activeOnly ?? false;
		const conditions = [eq(schema.discountRule.organizationId, DEFAULT_ORG_ID)];

		if (activeOnly) {
			conditions.push(eq(schema.discountRule.isActive, true));
		}

		const rules = await db
			.select()
			.from(schema.discountRule)
			.where(and(...conditions))
			.orderBy(asc(schema.discountRule.name));

		return rules;
	});

// ── create ────────────────────────────────────────────────────────────
const create = permissionProcedure("settings.update")
	.input(
		z.object({
			name: z.string().min(1),
			type: z.enum(["percentage", "fixed", "bogo", "buy_x_get_y"]),
			value: z.number().min(0),
			applyTo: z.enum(["order", "item", "category"]).default("order"),
			targetCategoryId: z.string().uuid().nullable().optional(),
			targetProductId: z.string().uuid().nullable().optional(),
			minOrderTotal: z.number().nullable().optional(),
			minQuantity: z.number().int().nullable().optional(),
			buyQuantity: z.number().int().nullable().optional(),
			getQuantity: z.number().int().nullable().optional(),
			isAutoApply: z.boolean().default(false),
			scheduleType: z
				.enum(["always", "time_window", "date_range"])
				.default("always"),
			startTime: z.string().nullable().optional(),
			endTime: z.string().nullable().optional(),
			startDate: z.string().nullable().optional(),
			endDate: z.string().nullable().optional(),
			daysOfWeek: z.string().nullable().optional(),
			promoCode: z.string().nullable().optional(),
			maxUses: z.number().int().nullable().optional(),
			stackable: z.boolean().default(false),
		}),
	)
	.handler(async ({ input }) => {
		// If promo code, check uniqueness within org
		if (input.promoCode) {
			const existing = await db
				.select({ id: schema.discountRule.id })
				.from(schema.discountRule)
				.where(
					and(
						eq(schema.discountRule.organizationId, DEFAULT_ORG_ID),
						eq(schema.discountRule.promoCode, input.promoCode.toUpperCase()),
						eq(schema.discountRule.isActive, true),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				throw new ORPCError("CONFLICT", {
					message: "A discount with this promo code already exists",
				});
			}
		}

		const rows = await db
			.insert(schema.discountRule)
			.values({
				organizationId: DEFAULT_ORG_ID,
				name: input.name,
				type: input.type,
				value: input.value.toFixed(2),
				applyTo: input.applyTo,
				targetCategoryId: input.targetCategoryId ?? null,
				targetProductId: input.targetProductId ?? null,
				minOrderTotal: input.minOrderTotal?.toFixed(2) ?? null,
				minQuantity: input.minQuantity ?? null,
				buyQuantity: input.buyQuantity ?? null,
				getQuantity: input.getQuantity ?? null,
				isAutoApply: input.isAutoApply,
				scheduleType: input.scheduleType,
				startTime: input.startTime ?? null,
				endTime: input.endTime ?? null,
				startDate: input.startDate ?? null,
				endDate: input.endDate ?? null,
				daysOfWeek: input.daysOfWeek ?? null,
				promoCode: input.promoCode?.toUpperCase() ?? null,
				maxUses: input.maxUses ?? null,
				stackable: input.stackable,
			})
			.returning({ id: schema.discountRule.id });

		return { id: rows[0]?.id };
	});

// ── update ────────────────────────────────────────────────────────────
const update = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			type: z.enum(["percentage", "fixed", "bogo", "buy_x_get_y"]).optional(),
			value: z.number().min(0).optional(),
			applyTo: z.enum(["order", "item", "category"]).optional(),
			targetCategoryId: z.string().uuid().nullable().optional(),
			targetProductId: z.string().uuid().nullable().optional(),
			minOrderTotal: z.number().nullable().optional(),
			minQuantity: z.number().int().nullable().optional(),
			buyQuantity: z.number().int().nullable().optional(),
			getQuantity: z.number().int().nullable().optional(),
			isAutoApply: z.boolean().optional(),
			scheduleType: z.enum(["always", "time_window", "date_range"]).optional(),
			startTime: z.string().nullable().optional(),
			endTime: z.string().nullable().optional(),
			startDate: z.string().nullable().optional(),
			endDate: z.string().nullable().optional(),
			daysOfWeek: z.string().nullable().optional(),
			promoCode: z.string().nullable().optional(),
			maxUses: z.number().int().nullable().optional(),
			stackable: z.boolean().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select()
			.from(schema.discountRule)
			.where(eq(schema.discountRule.id, input.id))
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Discount rule not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.type !== undefined) updates.type = input.type;
		if (input.value !== undefined) updates.value = input.value.toFixed(2);
		if (input.applyTo !== undefined) updates.applyTo = input.applyTo;
		if (input.targetCategoryId !== undefined)
			updates.targetCategoryId = input.targetCategoryId;
		if (input.targetProductId !== undefined)
			updates.targetProductId = input.targetProductId;
		if (input.minOrderTotal !== undefined)
			updates.minOrderTotal = input.minOrderTotal?.toFixed(2) ?? null;
		if (input.minQuantity !== undefined)
			updates.minQuantity = input.minQuantity;
		if (input.buyQuantity !== undefined)
			updates.buyQuantity = input.buyQuantity;
		if (input.getQuantity !== undefined)
			updates.getQuantity = input.getQuantity;
		if (input.isAutoApply !== undefined)
			updates.isAutoApply = input.isAutoApply;
		if (input.scheduleType !== undefined)
			updates.scheduleType = input.scheduleType;
		if (input.startTime !== undefined) updates.startTime = input.startTime;
		if (input.endTime !== undefined) updates.endTime = input.endTime;
		if (input.startDate !== undefined) updates.startDate = input.startDate;
		if (input.endDate !== undefined) updates.endDate = input.endDate;
		if (input.daysOfWeek !== undefined) updates.daysOfWeek = input.daysOfWeek;
		if (input.promoCode !== undefined)
			updates.promoCode = input.promoCode?.toUpperCase() ?? null;
		if (input.maxUses !== undefined) updates.maxUses = input.maxUses;
		if (input.stackable !== undefined) updates.stackable = input.stackable;
		if (input.isActive !== undefined) updates.isActive = input.isActive;

		await db
			.update(schema.discountRule)
			.set(updates)
			.where(eq(schema.discountRule.id, input.id));

		return { success: true };
	});

// ── remove (soft delete) ─────────────────────────────────────────────
const remove = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.update(schema.discountRule)
			.set({ isActive: false })
			.where(eq(schema.discountRule.id, input.id));

		return { success: true };
	});

// ── getApplicable ─────────────────────────────────────────────────────
// Given current cart state, return auto-apply discounts that match right now
const getApplicable = permissionProcedure("discounts.apply")
	.input(
		z.object({
			cartTotal: z.number(),
			items: z.array(
				z.object({
					productId: z.string().uuid(),
					categoryId: z.string().uuid().nullable(),
					quantity: z.number().int(),
					unitPrice: z.number(),
				}),
			),
		}),
	)
	.handler(async ({ input }) => {
		// Get all active auto-apply rules
		const rules = await db
			.select()
			.from(schema.discountRule)
			.where(
				and(
					eq(schema.discountRule.organizationId, DEFAULT_ORG_ID),
					eq(schema.discountRule.isActive, true),
					eq(schema.discountRule.isAutoApply, true),
				),
			);

		const now = new Date();
		const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		const currentDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
			now.getDay()
		]!;
		const currentDate = now.toISOString().split("T")[0]!;

		const applicable = rules.filter((rule) => {
			// Check schedule
			if (rule.scheduleType === "time_window") {
				if (rule.startTime && rule.endTime) {
					const isOvernight = rule.startTime > rule.endTime;
					if (isOvernight) {
						// e.g., 22:00 – 02:00: active if time >= start OR time <= end
						if (currentTime < rule.startTime && currentTime > rule.endTime)
							return false;
					} else {
						if (currentTime < rule.startTime || currentTime > rule.endTime)
							return false;
					}
				}
				if (rule.daysOfWeek) {
					const days = rule.daysOfWeek
						.split(",")
						.map((d) => d.trim().toLowerCase());
					if (!days.includes(currentDay)) return false;
				}
			}

			if (rule.scheduleType === "date_range") {
				if (rule.startDate && currentDate < rule.startDate) return false;
				if (rule.endDate && currentDate > rule.endDate) return false;
			}

			// Check max uses
			if (rule.maxUses && rule.currentUses >= rule.maxUses) return false;

			// Check min order total
			if (rule.minOrderTotal && input.cartTotal < Number(rule.minOrderTotal))
				return false;

			// Check item/category targeting
			if (rule.applyTo === "item" && rule.targetProductId) {
				const hasProduct = input.items.some(
					(i) => i.productId === rule.targetProductId,
				);
				if (!hasProduct) return false;
			}

			if (rule.applyTo === "category" && rule.targetCategoryId) {
				const hasCategory = input.items.some(
					(i) => i.categoryId === rule.targetCategoryId,
				);
				if (!hasCategory) return false;
			}

			// Check min quantity
			if (rule.minQuantity) {
				const totalQty = input.items.reduce((s, i) => s + i.quantity, 0);
				if (totalQty < rule.minQuantity) return false;
			}

			// Check BOGO buy quantity
			if (
				(rule.type === "bogo" || rule.type === "buy_x_get_y") &&
				rule.buyQuantity
			) {
				if (rule.targetProductId) {
					const matchingItem = input.items.find(
						(i) => i.productId === rule.targetProductId,
					);
					if (!matchingItem || matchingItem.quantity < rule.buyQuantity)
						return false;
				} else {
					const totalQty = input.items.reduce((s, i) => s + i.quantity, 0);
					if (totalQty < rule.buyQuantity) return false;
				}
			}

			return true;
		});

		return applicable;
	});

// ── validatePromo ─────────────────────────────────────────────────────
const validatePromo = permissionProcedure("discounts.apply")
	.input(z.object({ code: z.string().min(1) }))
	.handler(async ({ input }) => {
		const rules = await db
			.select()
			.from(schema.discountRule)
			.where(
				and(
					eq(schema.discountRule.organizationId, DEFAULT_ORG_ID),
					eq(schema.discountRule.promoCode, input.code.toUpperCase()),
					eq(schema.discountRule.isActive, true),
				),
			)
			.limit(1);

		if (rules.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Invalid promo code" });
		}

		const rule = rules[0]!;

		// Check max uses
		if (rule.maxUses && rule.currentUses >= rule.maxUses) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This promo code has expired",
			});
		}

		// Check schedule
		const currentDate = new Date().toISOString().split("T")[0]!;
		if (rule.scheduleType === "date_range") {
			if (rule.startDate && currentDate < rule.startDate) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This promo is not yet active",
				});
			}
			if (rule.endDate && currentDate > rule.endDate) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This promo has expired",
				});
			}
		}

		return rule;
	});

// ── incrementUsage ────────────────────────────────────────────────────
const incrementUsage = permissionProcedure("discounts.apply")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.update(schema.discountRule)
			.set({
				currentUses: sql`${schema.discountRule.currentUses} + 1`,
			})
			.where(eq(schema.discountRule.id, input.id));

		return { success: true };
	});

export const discountsRouter = {
	list,
	create,
	update,
	remove,
	getApplicable,
	validatePromo,
	incrementUsage,
};
