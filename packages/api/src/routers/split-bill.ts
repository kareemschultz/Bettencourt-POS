import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── splitEqual ──────────────────────────────────────────────────────────
// Splits an order total equally among N ways. Creates N payment records
// each assigned a splitGroup (1..N) for the equal share.
const splitEqual = permissionProcedure("orders.create")
	.input(
		z.object({
			orderId: z.string().uuid(),
			numberOfWays: z.number().int().min(2).max(20),
		}),
	)
	.handler(async ({ input }) => {
		const { orderId, numberOfWays } = input;

		// Fetch order
		const orders = await db
			.select({
				id: schema.order.id,
				total: schema.order.total,
				status: schema.order.status,
			})
			.from(schema.order)
			.where(eq(schema.order.id, orderId));

		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}

		const order = orders[0]!;
		const total = Number(order.total);

		if (total <= 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Order total must be greater than zero",
			});
		}

		// Calculate per-person amount (round down, last person gets remainder)
		const perPerson = Math.floor((total / numberOfWays) * 100) / 100;
		const lastPersonAmount =
			Math.round((total - perPerson * (numberOfWays - 1)) * 100) / 100;

		// Wrap in transaction for idempotency: remove prior pending splits, create new set
		const inserted = await db.transaction(async (tx) => {
			// Delete any prior pending split payments to prevent duplicates
			await tx
				.delete(schema.payment)
				.where(
					and(
						eq(schema.payment.orderId, orderId),
						eq(schema.payment.status, "pending"),
					),
				);

			// Mark order as split
			await tx
				.update(schema.order)
				.set({ isSplit: true })
				.where(eq(schema.order.id, orderId));

			// Create split payment records
			const paymentValues = [];
			for (let i = 1; i <= numberOfWays; i++) {
				const amount = i === numberOfWays ? lastPersonAmount : perPerson;
				paymentValues.push({
					orderId,
					method: "pending" as const,
					amount: amount.toFixed(2),
					splitGroup: i,
					status: "pending" as const,
					reference: `Split ${i}/${numberOfWays}`,
				});
			}

			return tx.insert(schema.payment).values(paymentValues).returning({
				id: schema.payment.id,
				splitGroup: schema.payment.splitGroup,
				amount: schema.payment.amount,
			});
		});

		return {
			splits: inserted.map((p) => ({
				id: p.id,
				splitGroup: p.splitGroup,
				amount: Number(p.amount),
			})),
			perPerson,
			total,
		};
	});

// ── splitByItems ────────────────────────────────────────────────────────
// Groups line items into separate checks. Each check gets a payment record
// with splitGroup and the sum of its assigned items.
const splitByItems = permissionProcedure("orders.create")
	.input(
		z.object({
			orderId: z.string().uuid(),
			splits: z
				.array(
					z.object({
						items: z.array(z.string().uuid()).min(1),
						paymentMethod: z.string().default("pending"),
					}),
				)
				.min(2),
		}),
	)
	.handler(async ({ input }) => {
		const { orderId, splits } = input;

		// Fetch order
		const orders = await db
			.select({
				id: schema.order.id,
				total: schema.order.total,
				status: schema.order.status,
			})
			.from(schema.order)
			.where(eq(schema.order.id, orderId));

		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}

		// Fetch all line items for the order
		const lineItems = await db
			.select({
				id: schema.orderLineItem.id,
				total: schema.orderLineItem.total,
				voided: schema.orderLineItem.voided,
			})
			.from(schema.orderLineItem)
			.where(eq(schema.orderLineItem.orderId, orderId));

		// Build a lookup of item totals
		const itemMap = new Map(
			lineItems
				.filter((li) => !li.voided)
				.map((li) => [li.id, Number(li.total)]),
		);

		// Validate that all referenced items exist in the order
		const allItemIds = splits.flatMap((s) => s.items);
		for (const itemId of allItemIds) {
			if (!itemMap.has(itemId)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Item ${itemId} not found in order or is voided`,
				});
			}
		}

		// Check no item appears in multiple splits
		const seen = new Set<string>();
		for (const itemId of allItemIds) {
			if (seen.has(itemId)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Item ${itemId} assigned to multiple splits`,
				});
			}
			seen.add(itemId);
		}

		// Wrap in transaction for idempotency: remove prior pending splits, create new set
		const inserted = await db.transaction(async (tx) => {
			// Delete any prior pending split payments to prevent duplicates
			await tx
				.delete(schema.payment)
				.where(
					and(
						eq(schema.payment.orderId, orderId),
						eq(schema.payment.status, "pending"),
					),
				);

			// Mark order as split
			await tx
				.update(schema.order)
				.set({ isSplit: true })
				.where(eq(schema.order.id, orderId));

			// Create payment records per split group
			const paymentValues = splits.map((split, idx) => {
				const groupTotal = split.items.reduce(
					(sum, id) => sum + (itemMap.get(id) || 0),
					0,
				);
				return {
					orderId,
					method: split.paymentMethod,
					amount: groupTotal.toFixed(2),
					splitGroup: idx + 1,
					status: "pending" as const,
					reference: `Check ${idx + 1} (${split.items.length} items)`,
				};
			});

			return tx.insert(schema.payment).values(paymentValues).returning({
				id: schema.payment.id,
				splitGroup: schema.payment.splitGroup,
				amount: schema.payment.amount,
			});
		});

		return {
			splits: inserted.map((p) => ({
				id: p.id,
				splitGroup: p.splitGroup,
				amount: Number(p.amount),
			})),
		};
	});

// ── getSplits ───────────────────────────────────────────────────────────
// Returns split payment info for an order
const getSplits = permissionProcedure("orders.read")
	.input(z.object({ orderId: z.string().uuid() }))
	.handler(async ({ input }) => {
		const { orderId } = input;

		// Check order exists
		const orders = await db
			.select({
				id: schema.order.id,
				total: schema.order.total,
				isSplit: schema.order.isSplit,
			})
			.from(schema.order)
			.where(eq(schema.order.id, orderId));

		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}

		const order = orders[0]!;

		// Get split payments
		const payments = await db
			.select({
				id: schema.payment.id,
				method: schema.payment.method,
				amount: schema.payment.amount,
				splitGroup: schema.payment.splitGroup,
				status: schema.payment.status,
				reference: schema.payment.reference,
				createdAt: schema.payment.createdAt,
			})
			.from(schema.payment)
			.where(eq(schema.payment.orderId, orderId))
			.orderBy(asc(schema.payment.splitGroup), asc(schema.payment.createdAt));

		// Get line items
		const lineItems = await db
			.select({
				id: schema.orderLineItem.id,
				productNameSnapshot: schema.orderLineItem.productNameSnapshot,
				quantity: schema.orderLineItem.quantity,
				unitPrice: schema.orderLineItem.unitPrice,
				total: schema.orderLineItem.total,
				voided: schema.orderLineItem.voided,
			})
			.from(schema.orderLineItem)
			.where(eq(schema.orderLineItem.orderId, orderId));

		return {
			orderId,
			orderTotal: Number(order.total),
			isSplit: order.isSplit,
			payments: payments.map((p) => ({
				id: p.id,
				method: p.method,
				amount: Number(p.amount),
				splitGroup: p.splitGroup,
				status: p.status,
				reference: p.reference,
				createdAt: p.createdAt,
			})),
			lineItems: lineItems.map((li) => ({
				id: li.id,
				name: li.productNameSnapshot,
				quantity: li.quantity,
				unitPrice: Number(li.unitPrice),
				total: Number(li.total),
				voided: li.voided,
			})),
		};
	});

export const splitBillRouter = {
	splitEqual,
	splitByItems,
	getSplits,
};
