import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { createAuditLog } from "../lib/audit";

// ── list ────────────────────────────────────────────────────────────────
const list = permissionProcedure("orders.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
				status: z.string().optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				page: z.number().int().min(1).default(1),
				limit: z.number().int().min(1).max(200).default(50),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? { page: 1, limit: 50 };
		const { locationId, status, startDate, endDate } = input;
		const page = input.page ?? 1;
		const limit = input.limit ?? 50;
		const offset = (page - 1) * limit;

		// Build dynamic conditions
		const conditions = [];
		if (locationId) {
			conditions.push(eq(schema.order.locationId, locationId));
		}
		if (status) {
			conditions.push(eq(schema.order.status, status));
		}
		if (startDate) {
			conditions.push(gte(schema.order.createdAt, new Date(startDate)));
		}
		if (endDate) {
			conditions.push(lte(schema.order.createdAt, new Date(endDate)));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Count query
		const countRows = await db
			.select({ total: count() })
			.from(schema.order)
			.where(whereClause);
		const countResult = countRows[0]!;

		// Orders with cashier name and item count
		const orders = await db
			.select({
				id: schema.order.id,
				organizationId: schema.order.organizationId,
				locationId: schema.order.locationId,
				registerId: schema.order.registerId,
				userId: schema.order.userId,
				orderNumber: schema.order.orderNumber,
				type: schema.order.type,
				status: schema.order.status,
				subtotal: schema.order.subtotal,
				discountTotal: schema.order.discountTotal,
				taxTotal: schema.order.taxTotal,
				total: schema.order.total,
				customerName: schema.order.customerName,
				notes: schema.order.notes,
				createdAt: schema.order.createdAt,
				updatedAt: schema.order.updatedAt,
				cashierName: schema.user.name,
			})
			.from(schema.order)
			.leftJoin(schema.user, eq(schema.order.userId, schema.user.id))
			.where(whereClause)
			.orderBy(desc(schema.order.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			orders,
			total: countResult.total,
			page,
			limit,
		};
	});

// ── getById ─────────────────────────────────────────────────────────────
const getById = permissionProcedure("orders.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		// Get order with cashier and location names
		const orders = await db
			.select({
				id: schema.order.id,
				organizationId: schema.order.organizationId,
				locationId: schema.order.locationId,
				registerId: schema.order.registerId,
				userId: schema.order.userId,
				orderNumber: schema.order.orderNumber,
				type: schema.order.type,
				status: schema.order.status,
				subtotal: schema.order.subtotal,
				discountTotal: schema.order.discountTotal,
				taxTotal: schema.order.taxTotal,
				total: schema.order.total,
				customerName: schema.order.customerName,
				customerPhone: schema.order.customerPhone,
				deliveryAddress: schema.order.deliveryAddress,
				fulfillmentStatus: schema.order.fulfillmentStatus,
				tableId: schema.order.tableId,
				notes: schema.order.notes,
				createdAt: schema.order.createdAt,
				updatedAt: schema.order.updatedAt,
				cashierName: schema.user.name,
				locationName: schema.location.name,
			})
			.from(schema.order)
			.leftJoin(schema.user, eq(schema.order.userId, schema.user.id))
			.leftJoin(
				schema.location,
				eq(schema.order.locationId, schema.location.id),
			)
			.where(eq(schema.order.id, input.id));

		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}

		// Get line items with product image
		const lineItems = await db
			.select({
				id: schema.orderLineItem.id,
				orderId: schema.orderLineItem.orderId,
				productId: schema.orderLineItem.productId,
				productNameSnapshot: schema.orderLineItem.productNameSnapshot,
				reportingNameSnapshot: schema.orderLineItem.reportingNameSnapshot,
				reportingCategorySnapshot:
					schema.orderLineItem.reportingCategorySnapshot,
				quantity: schema.orderLineItem.quantity,
				unitPrice: schema.orderLineItem.unitPrice,
				discount: schema.orderLineItem.discount,
				tax: schema.orderLineItem.tax,
				total: schema.orderLineItem.total,
				modifiersSnapshot: schema.orderLineItem.modifiersSnapshot,
				notes: schema.orderLineItem.notes,
				voided: schema.orderLineItem.voided,
				voidReason: schema.orderLineItem.voidReason,
				imageUrl: schema.product.imageUrl,
			})
			.from(schema.orderLineItem)
			.leftJoin(
				schema.product,
				eq(schema.orderLineItem.productId, schema.product.id),
			)
			.where(eq(schema.orderLineItem.orderId, input.id));

		// Get payments
		const payments = await db
			.select()
			.from(schema.payment)
			.where(eq(schema.payment.orderId, input.id))
			.orderBy(asc(schema.payment.createdAt));

		return {
			...orders[0],
			lineItems,
			payments,
		};
	});

// ── void ────────────────────────────────────────────────────────────────
const voidOrder = permissionProcedure("orders.void")
	.input(
		z.object({
			id: z.string().uuid(),
			userId: z.string().optional(),
			reason: z.string().optional(),
			authorizedBy: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, userId, reason, authorizedBy } = input;

		// Get the order
		const orders = await db
			.select({
				id: schema.order.id,
				orderNumber: schema.order.orderNumber,
				total: schema.order.total,
				status: schema.order.status,
				userId: schema.order.userId,
				locationId: schema.order.locationId,
				registerId: schema.order.registerId,
				notes: schema.order.notes,
			})
			.from(schema.order)
			.where(eq(schema.order.id, id));

		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}

		const order = orders[0]!;
		if (order.status === "voided") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Order already voided",
			});
		}

		// Void the order with authorization tracking
		const voidNote = `\n[VOIDED] ${reason || "No reason"} by user ${userId || "unknown"} at ${new Date().toISOString()}`;
		await db
			.update(schema.order)
			.set({
				status: "voided",
				notes: (order.notes || "") + voidNote,
				voidAuthorizedBy: authorizedBy || userId || null,
				voidReason: reason || null,
				voidAuthorizedAt: new Date(),
			})
			.where(eq(schema.order.id, id));

		// Void all payments
		await db
			.update(schema.payment)
			.set({ status: "voided" })
			.where(eq(schema.payment.orderId, id));

		// Reverse cash session if there was a cash payment
		const cashPayments = await db
			.select({ amount: schema.payment.amount })
			.from(schema.payment)
			.where(
				and(eq(schema.payment.orderId, id), eq(schema.payment.method, "cash")),
			);

		if (cashPayments.length > 0 && order.registerId) {
			const cashTotal = cashPayments.reduce((s, p) => s + Number(p.amount), 0);
			await db.execute(
				sql`UPDATE cash_session
					SET expected_cash = COALESCE(expected_cash, 0) - ${cashTotal}
					WHERE register_id = ${order.registerId}
					AND status = 'open'`,
			);
		}

		// Audit log
		await createAuditLog({
			userId: userId || null,
			entityType: "order",
			entityId: id,
			actionType: "void",
			beforeData: { status: order.status, total: order.total },
			afterData: { status: "voided", reason },
			locationId: order.locationId,
			reason: reason || "Order voided",
		});

		return { success: true, orderNumber: order.orderNumber };
	});

// ── refund ──────────────────────────────────────────────────────────────
const refund = permissionProcedure("orders.refund")
	.input(
		z.object({
			id: z.string().uuid(),
			userId: z.string().optional(),
			reason: z.string().min(1, "Reason is required"),
			amount: z.number().optional(),
			authorizedBy: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, userId, reason, amount, authorizedBy } = input;

		// Check order exists and is completed
		const orders = await db
			.select()
			.from(schema.order)
			.where(eq(schema.order.id, id));
		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}

		const order = orders[0]!;
		if (order.status !== "completed") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only completed orders can be refunded",
			});
		}

		const refundAmount = amount || Number(order.total);

		// Update order status with void authorization tracking
		await db
			.update(schema.order)
			.set({
				status: "refunded",
				voidAuthorizedBy: authorizedBy || userId || null,
				voidReason: reason,
				voidAuthorizedAt: new Date(),
			})
			.where(eq(schema.order.id, id));

		// Create a refund payment record (negative amount)
		await db.insert(schema.payment).values({
			orderId: id,
			method: "refund",
			amount: (-refundAmount).toFixed(2),
			reference: reason,
			status: "completed",
		});

		// Audit log
		await createAuditLog({
			userId: userId || null,
			entityType: "order",
			entityId: id,
			actionType: "refund",
			beforeData: { status: order.status, total: order.total },
			afterData: { status: "refunded", refund_amount: refundAmount },
			reason,
		});

		return { success: true, refundAmount };
	});

export const ordersRouter = {
	list,
	getById,
	void: voidOrder,
	refund,
};
