import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

function generateGiftCardCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed I,O,0,1 for readability
	let code = "GC-";
	for (let i = 0; i < 4; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	code += "-";
	for (let i = 0; i < 4; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

// ── create ────────────────────────────────────────────────────────────
const create = permissionProcedure("orders.create")
	.input(
		z.object({
			initialBalance: z.number().min(100), // Minimum GYD $100
			customerId: z.string().uuid().nullable().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		// Generate unique code (retry if collision)
		let code = generateGiftCardCode();
		let attempts = 0;
		while (attempts < 5) {
			const existing = await db
				.select({ id: schema.giftCard.id })
				.from(schema.giftCard)
				.where(eq(schema.giftCard.code, code))
				.limit(1);

			if (existing.length === 0) break;
			code = generateGiftCardCode();
			attempts++;
		}

		const balanceStr = input.initialBalance.toFixed(2);

		const rows = await db
			.insert(schema.giftCard)
			.values({
				organizationId: DEFAULT_ORG_ID,
				code,
				initialBalance: balanceStr,
				currentBalance: balanceStr,
				customerId: input.customerId ?? null,
				purchasedBy: context.session.user.id,
			})
			.returning();

		const card = rows[0]!;

		// Create purchase transaction
		await db.insert(schema.giftCardTransaction).values({
			giftCardId: card.id,
			type: "purchase",
			amount: balanceStr,
			balanceAfter: balanceStr,
			processedBy: context.session.user.id,
		});

		return card;
	});

// ── lookup ────────────────────────────────────────────────────────────
const lookup = permissionProcedure("orders.read")
	.input(z.object({ code: z.string().min(1) }))
	.handler(async ({ input }) => {
		const cards = await db
			.select()
			.from(schema.giftCard)
			.where(
				and(
					eq(schema.giftCard.code, input.code.toUpperCase()),
					eq(schema.giftCard.organizationId, DEFAULT_ORG_ID),
				),
			)
			.limit(1);

		if (cards.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Gift card not found" });
		}

		const card = cards[0]!;

		// Get transaction history
		const transactions = await db
			.select()
			.from(schema.giftCardTransaction)
			.where(eq(schema.giftCardTransaction.giftCardId, card.id))
			.orderBy(desc(schema.giftCardTransaction.createdAt));

		return { ...card, transactions };
	});

// ── reload ────────────────────────────────────────────────────────────
const reload = permissionProcedure("orders.create")
	.input(
		z.object({
			giftCardId: z.string().uuid(),
			amount: z.number().min(100),
		}),
	)
	.handler(async ({ input, context }) => {
		const cards = await db
			.select()
			.from(schema.giftCard)
			.where(eq(schema.giftCard.id, input.giftCardId))
			.limit(1);

		if (cards.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Gift card not found" });
		}

		const card = cards[0]!;
		if (!card.isActive) {
			throw new ORPCError("BAD_REQUEST", { message: "Gift card is inactive" });
		}

		const newBalance = Number(card.currentBalance) + input.amount;

		await db
			.update(schema.giftCard)
			.set({ currentBalance: newBalance.toFixed(2) })
			.where(eq(schema.giftCard.id, input.giftCardId));

		await db.insert(schema.giftCardTransaction).values({
			giftCardId: input.giftCardId,
			type: "reload",
			amount: input.amount.toFixed(2),
			balanceAfter: newBalance.toFixed(2),
			processedBy: context.session.user.id,
		});

		return { newBalance };
	});

// ── redeem ────────────────────────────────────────────────────────────
const redeem = permissionProcedure("orders.create")
	.input(
		z.object({
			giftCardId: z.string().uuid(),
			amount: z.number().min(0.01),
			orderId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const cards = await db
			.select()
			.from(schema.giftCard)
			.where(eq(schema.giftCard.id, input.giftCardId))
			.limit(1);

		if (cards.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Gift card not found" });
		}

		const card = cards[0]!;
		if (!card.isActive) {
			throw new ORPCError("BAD_REQUEST", { message: "Gift card is inactive" });
		}

		const currentBalance = Number(card.currentBalance);
		if (currentBalance <= 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Gift card has no balance",
			});
		}

		// Allow partial redemption — redeem up to available balance
		const redeemAmount = Math.min(input.amount, currentBalance);

		// Atomic balance deduction: only succeeds if current_balance hasn't changed since read
		const updated = await db
			.update(schema.giftCard)
			.set({
				currentBalance: sql`current_balance - ${redeemAmount.toFixed(2)}::numeric`,
			})
			.where(
				and(
					eq(schema.giftCard.id, input.giftCardId),
					sql`current_balance >= ${redeemAmount.toFixed(2)}::numeric`,
				),
			)
			.returning({
				id: schema.giftCard.id,
				currentBalance: schema.giftCard.currentBalance,
			});

		if (updated.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Gift card balance was modified concurrently. Please retry.",
			});
		}

		const newBalance = Number(updated[0]!.currentBalance);

		await db.insert(schema.giftCardTransaction).values({
			giftCardId: input.giftCardId,
			orderId: input.orderId ?? null,
			type: "redeem",
			amount: (-redeemAmount).toFixed(2),
			balanceAfter: newBalance.toFixed(2),
			processedBy: context.session.user.id,
		});

		return { redeemed: redeemAmount, newBalance };
	});

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
		const conditions = [eq(schema.giftCard.organizationId, DEFAULT_ORG_ID)];

		if (activeOnly) {
			conditions.push(eq(schema.giftCard.isActive, true));
		}

		const cards = await db
			.select({
				id: schema.giftCard.id,
				code: schema.giftCard.code,
				initialBalance: schema.giftCard.initialBalance,
				currentBalance: schema.giftCard.currentBalance,
				customerId: schema.giftCard.customerId,
				isActive: schema.giftCard.isActive,
				createdAt: schema.giftCard.createdAt,
				customerName: schema.customer.name,
				customerPhone: schema.customer.phone,
			})
			.from(schema.giftCard)
			.leftJoin(
				schema.customer,
				eq(schema.giftCard.customerId, schema.customer.id),
			)
			.where(and(...conditions))
			.orderBy(desc(schema.giftCard.createdAt));

		return cards;
	});

export const giftcardsRouter = {
	create,
	lookup,
	reload,
	redeem,
	list,
};
