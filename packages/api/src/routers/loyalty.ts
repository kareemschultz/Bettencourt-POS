import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── getProgram ────────────────────────────────────────────────────────
const getProgram = permissionProcedure("orders.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const programs = await db
			.select()
			.from(schema.loyaltyProgram)
			.where(eq(schema.loyaltyProgram.organizationId, orgId))
			.limit(1);

		if (programs.length === 0) {
			return null;
		}

		const program = programs[0]!;
		const tiers = await db
			.select()
			.from(schema.loyaltyTier)
			.where(eq(schema.loyaltyTier.programId, program.id))
			.orderBy(asc(schema.loyaltyTier.sortOrder));

		return { ...program, tiers };
	});

// ── updateProgram ─────────────────────────────────────────────────────
const updateProgram = permissionProcedure("settings.update")
	.input(
		z.object({
			name: z.string().min(1),
			pointsPerDollar: z.number().int().min(1).max(100),
			isActive: z.boolean(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select({ id: schema.loyaltyProgram.id })
			.from(schema.loyaltyProgram)
			.where(eq(schema.loyaltyProgram.organizationId, orgId))
			.limit(1);

		if (existing.length > 0) {
			await db
				.update(schema.loyaltyProgram)
				.set({
					name: input.name,
					pointsPerDollar: input.pointsPerDollar,
					isActive: input.isActive,
				})
				.where(eq(schema.loyaltyProgram.id, existing[0]!.id));

			return { id: existing[0]!.id };
		}

		const rows = await db
			.insert(schema.loyaltyProgram)
			.values({
				organizationId: orgId,
				name: input.name,
				pointsPerDollar: input.pointsPerDollar,
				isActive: input.isActive,
			})
			.returning({ id: schema.loyaltyProgram.id });

		return { id: rows[0]?.id };
	});

// ── createTier ────────────────────────────────────────────────────────
const createTier = permissionProcedure("settings.update")
	.input(
		z.object({
			programId: z.string().uuid(),
			name: z.string().min(1),
			pointsRequired: z.number().int().min(1),
			rewardType: z.enum([
				"percentage_discount",
				"fixed_discount",
				"free_item",
			]),
			rewardValue: z.number().min(0),
			rewardProductId: z.string().uuid().nullable().optional(),
			sortOrder: z.number().int().default(0),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const program = await db
			.select({ id: schema.loyaltyProgram.id })
			.from(schema.loyaltyProgram)
			.where(
				and(
					eq(schema.loyaltyProgram.id, input.programId),
					eq(schema.loyaltyProgram.organizationId, orgId),
				),
			)
			.limit(1);
		if (!program[0]) {
			throw new ORPCError("NOT_FOUND", { message: "Loyalty program not found" });
		}
		const rows = await db
			.insert(schema.loyaltyTier)
			.values({
				programId: input.programId,
				name: input.name,
				pointsRequired: input.pointsRequired,
				rewardType: input.rewardType,
				rewardValue: input.rewardValue.toFixed(2),
				rewardProductId: input.rewardProductId ?? null,
				sortOrder: input.sortOrder,
			})
			.returning({ id: schema.loyaltyTier.id });

		return { id: rows[0]?.id };
	});

// ── updateTier ────────────────────────────────────────────────────────
const updateTier = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			pointsRequired: z.number().int().min(1).optional(),
			rewardType: z
				.enum(["percentage_discount", "fixed_discount", "free_item"])
				.optional(),
			rewardValue: z.number().min(0).optional(),
			rewardProductId: z.string().uuid().nullable().optional(),
			sortOrder: z.number().int().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const belongs = await db
			.select({ id: schema.loyaltyTier.id })
			.from(schema.loyaltyTier)
			.innerJoin(
				schema.loyaltyProgram,
				eq(schema.loyaltyTier.programId, schema.loyaltyProgram.id),
			)
			.where(
				and(
					eq(schema.loyaltyTier.id, input.id),
					eq(schema.loyaltyProgram.organizationId, orgId),
				),
			)
			.limit(1);
		if (!belongs[0]) {
			throw new ORPCError("NOT_FOUND", { message: "Tier not found" });
		}
		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.pointsRequired !== undefined)
			updates.pointsRequired = input.pointsRequired;
		if (input.rewardType !== undefined) updates.rewardType = input.rewardType;
		if (input.rewardValue !== undefined)
			updates.rewardValue = input.rewardValue.toFixed(2);
		if (input.rewardProductId !== undefined)
			updates.rewardProductId = input.rewardProductId;
		if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

		await db
			.update(schema.loyaltyTier)
			.set(updates)
			.where(eq(schema.loyaltyTier.id, input.id));

		return { success: true };
	});

// ── deleteTier ────────────────────────────────────────────────────────
const deleteTier = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const belongs = await db
			.select({ id: schema.loyaltyTier.id })
			.from(schema.loyaltyTier)
			.innerJoin(
				schema.loyaltyProgram,
				eq(schema.loyaltyTier.programId, schema.loyaltyProgram.id),
			)
			.where(
				and(
					eq(schema.loyaltyTier.id, input.id),
					eq(schema.loyaltyProgram.organizationId, orgId),
				),
			)
			.limit(1);
		if (!belongs[0]) {
			throw new ORPCError("NOT_FOUND", { message: "Tier not found" });
		}
		await db
			.delete(schema.loyaltyTier)
			.where(eq(schema.loyaltyTier.id, input.id));

		return { success: true };
	});

// ── getCustomerPoints ─────────────────────────────────────────────────
const getCustomerPoints = permissionProcedure("orders.read")
	.input(z.object({ customerId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		// Get the org's loyalty program
		const programs = await db
			.select()
			.from(schema.loyaltyProgram)
			.where(
				and(
					eq(schema.loyaltyProgram.organizationId, orgId),
					eq(schema.loyaltyProgram.isActive, true),
				),
			)
			.limit(1);

		if (programs.length === 0) {
			return null;
		}

		const program = programs[0]!;

		// Get or create customer loyalty record
		let membership = await db
			.select()
			.from(schema.customerLoyalty)
			.where(
				and(
					eq(schema.customerLoyalty.customerId, input.customerId),
					eq(schema.customerLoyalty.programId, program.id),
				),
			)
			.limit(1);

		if (membership.length === 0) {
			const rows = await db
				.insert(schema.customerLoyalty)
				.values({
					customerId: input.customerId,
					programId: program.id,
				})
				.returning();
			membership = rows;
		}

		// Get available tiers
		const tiers = await db
			.select()
			.from(schema.loyaltyTier)
			.where(eq(schema.loyaltyTier.programId, program.id))
			.orderBy(asc(schema.loyaltyTier.pointsRequired));

		const currentPoints = membership[0]!.currentPoints;
		const availableRewards = tiers.filter(
			(t) => currentPoints >= t.pointsRequired,
		);
		const nextTier = tiers.find((t) => currentPoints < t.pointsRequired);

		return {
			membership: membership[0]!,
			programName: program.name,
			pointsPerDollar: program.pointsPerDollar,
			availableRewards,
			nextTier: nextTier
				? {
						name: nextTier.name,
						pointsNeeded: nextTier.pointsRequired - currentPoints,
						pointsRequired: nextTier.pointsRequired,
					}
				: null,
		};
	});

// ── earnPoints ────────────────────────────────────────────────────────
const earnPoints = permissionProcedure("orders.create")
	.input(
		z.object({
			customerId: z.string().uuid(),
			orderId: z.string().uuid(),
			orderTotal: z.number().min(0),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const programs = await db
			.select()
			.from(schema.loyaltyProgram)
			.where(
				and(
					eq(schema.loyaltyProgram.organizationId, orgId),
					eq(schema.loyaltyProgram.isActive, true),
				),
			)
			.limit(1);

		if (programs.length === 0) {
			return { earned: 0 };
		}

		const program = programs[0]!;
		const pointsEarned = Math.floor(input.orderTotal * program.pointsPerDollar);

		if (pointsEarned <= 0) {
			return { earned: 0 };
		}

		// Get or create membership
		let membership = await db
			.select()
			.from(schema.customerLoyalty)
			.where(
				and(
					eq(schema.customerLoyalty.customerId, input.customerId),
					eq(schema.customerLoyalty.programId, program.id),
				),
			)
			.limit(1);

		if (membership.length === 0) {
			membership = await db
				.insert(schema.customerLoyalty)
				.values({
					customerId: input.customerId,
					programId: program.id,
				})
				.returning();
		}

		const membershipId = membership[0]!.id;

		// Add points
		await db
			.update(schema.customerLoyalty)
			.set({
				currentPoints: sql`${schema.customerLoyalty.currentPoints} + ${pointsEarned}`,
				lifetimePoints: sql`${schema.customerLoyalty.lifetimePoints} + ${pointsEarned}`,
			})
			.where(eq(schema.customerLoyalty.id, membershipId));

		// Log transaction
		await db.insert(schema.loyaltyTransaction).values({
			customerLoyaltyId: membershipId,
			orderId: input.orderId,
			type: "earn",
			points: pointsEarned,
			description: `Earned ${pointsEarned} points on order`,
		});

		return { earned: pointsEarned };
	});

// ── redeemReward ──────────────────────────────────────────────────────
const redeemReward = permissionProcedure("orders.create")
	.input(
		z.object({
			customerId: z.string().uuid(),
			tierId: z.string().uuid(),
			orderId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		// Get the tier
		const tiers = await db
			.select()
			.from(schema.loyaltyTier)
			.innerJoin(
				schema.loyaltyProgram,
				eq(schema.loyaltyTier.programId, schema.loyaltyProgram.id),
			)
			.where(
				and(
					eq(schema.loyaltyTier.id, input.tierId),
					eq(schema.loyaltyProgram.organizationId, orgId),
				),
			)
			.limit(1);

		if (tiers.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Reward tier not found" });
		}

		const tier = tiers[0]!.loyalty_tier;

		// Get membership
		const membership = await db
			.select()
			.from(schema.customerLoyalty)
			.where(
				and(
					eq(schema.customerLoyalty.customerId, input.customerId),
					eq(schema.customerLoyalty.programId, tier.programId),
				),
			)
			.limit(1);

		if (membership.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Customer not enrolled in loyalty program",
			});
		}

		const member = membership[0]!;
		if (member.currentPoints < tier.pointsRequired) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Not enough points. Need ${tier.pointsRequired}, have ${member.currentPoints}`,
			});
		}

		// Deduct points
		await db
			.update(schema.customerLoyalty)
			.set({
				currentPoints: sql`${schema.customerLoyalty.currentPoints} - ${tier.pointsRequired}`,
			})
			.where(eq(schema.customerLoyalty.id, member.id));

		// Log transaction
		await db.insert(schema.loyaltyTransaction).values({
			customerLoyaltyId: member.id,
			orderId: input.orderId ?? null,
			type: "redeem",
			points: -tier.pointsRequired,
			description: `Redeemed: ${tier.name}`,
		});

		return {
			rewardType: tier.rewardType,
			rewardValue: Number(tier.rewardValue),
			rewardProductId: tier.rewardProductId,
			pointsDeducted: tier.pointsRequired,
		};
	});

// ── getLeaderboard ────────────────────────────────────────────────────
const getLeaderboard = permissionProcedure("reports.read")
	.input(
		z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const orgId = requireOrganizationId(context);
		const limit = rawInput?.limit ?? 10;

		const result = await db
			.select({
				customerId: schema.customerLoyalty.customerId,
				customerName: schema.customer.name,
				customerPhone: schema.customer.phone,
				currentPoints: schema.customerLoyalty.currentPoints,
				lifetimePoints: schema.customerLoyalty.lifetimePoints,
			})
			.from(schema.customerLoyalty)
			.innerJoin(
				schema.customer,
				eq(schema.customerLoyalty.customerId, schema.customer.id),
			)
			.where(eq(schema.customer.organizationId, orgId))
			.orderBy(desc(schema.customerLoyalty.lifetimePoints))
			.limit(limit);

		return result;
	});

export const loyaltyRouter = {
	getProgram,
	updateProgram,
	createTier,
	updateTier,
	deleteTier,
	getCustomerPoints,
	earnPoints,
	redeemReward,
	getLeaderboard,
};
