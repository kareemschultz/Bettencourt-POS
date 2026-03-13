import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { emitPosEvent } from "../lib/pos-events";

// ── list ────────────────────────────────────────────────────────────────
// Returns all tables with their current status and order info
const list = permissionProcedure("orders.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};

		const tables = await db
			.select({
				id: schema.tableLayout.id,
				locationId: schema.tableLayout.locationId,
				name: schema.tableLayout.name,
				section: schema.tableLayout.section,
				seats: schema.tableLayout.seats,
				positionX: schema.tableLayout.positionX,
				positionY: schema.tableLayout.positionY,
				shape: schema.tableLayout.shape,
				status: schema.tableLayout.status,
				currentOrderId: schema.tableLayout.currentOrderId,
				currentGuests: schema.tableLayout.currentGuests,
				createdAt: schema.tableLayout.createdAt,
				updatedAt: schema.tableLayout.updatedAt,
				activeOrderId: schema.order.id,
				activeOrderNumber: schema.order.orderNumber,
				activeOrderTotal: schema.order.total,
				orderStatus: schema.order.status,
				orderCreatedAt: schema.order.createdAt,
			})
			.from(schema.tableLayout)
			.leftJoin(
				schema.order,
				eq(schema.tableLayout.currentOrderId, schema.order.id),
			)
			.where(
				input.locationId
					? eq(schema.tableLayout.locationId, input.locationId)
					: undefined,
			)
			.orderBy(asc(schema.tableLayout.section), asc(schema.tableLayout.name));

		return tables;
	});

// ── create ──────────────────────────────────────────────────────────────
const create = permissionProcedure("orders.create")
	.input(
		z.object({
			locationId: z.string().uuid(),
			name: z.string().min(1),
			section: z.string().nullable().optional(),
			seats: z.number().int().min(1).max(50).default(4),
			positionX: z.number().int().default(0),
			positionY: z.number().int().default(0),
			shape: z.enum(["square", "circle", "rectangle"]).default("square"),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.insert(schema.tableLayout)
			.values({
				locationId: input.locationId,
				name: input.name,
				section: input.section ?? null,
				seats: input.seats,
				positionX: input.positionX,
				positionY: input.positionY,
				shape: input.shape,
				status: "available",
			})
			.returning({
				id: schema.tableLayout.id,
				name: schema.tableLayout.name,
			});

		return rows[0]!;
	});

// ── update ──────────────────────────────────────────────────────────────
const update = permissionProcedure("orders.create")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			section: z.string().nullable().optional(),
			seats: z.number().int().min(1).max(50).optional(),
			positionX: z.number().int().optional(),
			positionY: z.number().int().optional(),
			shape: z.enum(["square", "circle", "rectangle"]).optional(),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select({ id: schema.tableLayout.id })
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, input.id));

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Table not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.section !== undefined) updates.section = input.section;
		if (input.seats !== undefined) updates.seats = input.seats;
		if (input.positionX !== undefined) updates.positionX = input.positionX;
		if (input.positionY !== undefined) updates.positionY = input.positionY;
		if (input.shape !== undefined) updates.shape = input.shape;

		if (Object.keys(updates).length > 0) {
			await db
				.update(schema.tableLayout)
				.set(updates)
				.where(eq(schema.tableLayout.id, input.id));
		}

		return { success: true };
	});

// ── remove ──────────────────────────────────────────────────────────────
const remove = permissionProcedure("orders.create")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		const existing = await db
			.select({
				id: schema.tableLayout.id,
				currentOrderId: schema.tableLayout.currentOrderId,
			})
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, input.id));

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Table not found" });
		}

		if (existing[0]?.currentOrderId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot delete a table with an active order",
			});
		}

		await db
			.delete(schema.tableLayout)
			.where(eq(schema.tableLayout.id, input.id));

		return { success: true };
	});

// ── assignOrder ─────────────────────────────────────────────────────────
const assignOrder = permissionProcedure("orders.create")
	.input(
		z.object({
			tableId: z.string().uuid(),
			orderId: z.string().uuid(),
			guests: z.number().int().min(1).optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { tableId, orderId, guests } = input;

		// Verify table exists
		const tables = await db
			.select({ id: schema.tableLayout.id, status: schema.tableLayout.status })
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, tableId));

		if (tables.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Table not found" });
		}

		// Verify order exists
		const orders = await db
			.select({ id: schema.order.id })
			.from(schema.order)
			.where(eq(schema.order.id, orderId));

		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}

		// Assign order to table
		await db
			.update(schema.tableLayout)
			.set({
				currentOrderId: orderId,
				currentGuests: guests ?? null,
				status: "occupied",
			})
			.where(eq(schema.tableLayout.id, tableId));

		// Also set tableId on the order
		await db
			.update(schema.order)
			.set({ tableId })
			.where(eq(schema.order.id, orderId));

		return { success: true };
	});

// ── clearTable ──────────────────────────────────────────────────────────
const clearTable = permissionProcedure("orders.create")
	.input(z.object({ tableId: z.string().uuid() }))
	.handler(async ({ input }) => {
		const tables = await db
			.select({ id: schema.tableLayout.id })
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, input.tableId));

		if (tables.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Table not found" });
		}

		await db
			.update(schema.tableLayout)
			.set({
				currentOrderId: null,
				currentGuests: null,
				status: "available",
			})
			.where(eq(schema.tableLayout.id, input.tableId));

		return { success: true };
	});

// ── updateStatus ────────────────────────────────────────────────────────
const updateStatus = permissionProcedure("orders.create")
	.input(
		z.object({
			tableId: z.string().uuid(),
			status: z.enum(["available", "occupied", "reserved", "cleaning"]),
		}),
	)
	.handler(async ({ input }) => {
		const tables = await db
			.select({ id: schema.tableLayout.id })
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, input.tableId));

		if (tables.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Table not found" });
		}

		const updates: Record<string, unknown> = { status: input.status };

		// If marking available, clear order & guests
		if (input.status === "available") {
			updates.currentOrderId = null;
			updates.currentGuests = null;
		}

		await db
			.update(schema.tableLayout)
			.set(updates)
			.where(eq(schema.tableLayout.id, input.tableId));

		return { success: true };
	});

// ── transferOrder ──────────────────────────────────────────────────────
// Move an order from one table to another
const transferOrder = permissionProcedure("orders.update")
	.input(
		z.object({
			fromTableId: z.string().uuid(),
			toTableId: z.string().uuid(),
		}),
	)
	.handler(async ({ input }) => {
		const { fromTableId, toTableId } = input;

		if (fromTableId === toTableId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Source and destination tables must be different",
			});
		}

		// Get source table with its order
		const [fromTable] = await db
			.select({
				id: schema.tableLayout.id,
				currentOrderId: schema.tableLayout.currentOrderId,
				name: schema.tableLayout.name,
			})
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, fromTableId));

		if (!fromTable) {
			throw new ORPCError("NOT_FOUND", { message: "Source table not found" });
		}
		if (!fromTable.currentOrderId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Source table has no active order",
			});
		}

		// Get destination table
		const [toTable] = await db
			.select({
				id: schema.tableLayout.id,
				currentOrderId: schema.tableLayout.currentOrderId,
				name: schema.tableLayout.name,
			})
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, toTableId));

		if (!toTable) {
			throw new ORPCError("NOT_FOUND", {
				message: "Destination table not found",
			});
		}
		if (toTable.currentOrderId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Destination table already has an active order",
			});
		}

		// Transfer: update order.tableId, swap table assignments
		await db.transaction(async (tx) => {
			await tx
				.update(schema.order)
				.set({ tableId: toTableId })
				.where(eq(schema.order.id, fromTable.currentOrderId!));

			await tx
				.update(schema.tableLayout)
				.set({ currentOrderId: null, currentGuests: null, status: "available" })
				.where(eq(schema.tableLayout.id, fromTableId));

			await tx
				.update(schema.tableLayout)
				.set({
					currentOrderId: fromTable.currentOrderId,
					status: "occupied",
				})
				.where(eq(schema.tableLayout.id, toTableId));
		});

		emitPosEvent({
			type: "table:status_changed",
			tableId: fromTableId,
			status: "available",
		});
		emitPosEvent({
			type: "table:status_changed",
			tableId: toTableId,
			status: "occupied",
		});

		return {
			success: true,
			fromTable: fromTable.name,
			toTable: toTable.name,
		};
	});

// ── mergeOrders ────────────────────────────────────────────────────────
// Merge all line items from one table's order into another table's order
const mergeOrders = permissionProcedure("orders.update")
	.input(
		z.object({
			sourceTableId: z.string().uuid(),
			targetTableId: z.string().uuid(),
		}),
	)
	.handler(async ({ input }) => {
		const { sourceTableId, targetTableId } = input;

		if (sourceTableId === targetTableId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Source and target tables must be different",
			});
		}

		// Get both tables with orders
		const [sourceTable] = await db
			.select({
				id: schema.tableLayout.id,
				currentOrderId: schema.tableLayout.currentOrderId,
				name: schema.tableLayout.name,
			})
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, sourceTableId));

		const [targetTable] = await db
			.select({
				id: schema.tableLayout.id,
				currentOrderId: schema.tableLayout.currentOrderId,
				name: schema.tableLayout.name,
			})
			.from(schema.tableLayout)
			.where(eq(schema.tableLayout.id, targetTableId));

		if (!sourceTable?.currentOrderId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Source table has no active order",
			});
		}
		if (!targetTable?.currentOrderId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Target table has no active order to merge into",
			});
		}

		const sourceOrderId = sourceTable.currentOrderId;
		const targetOrderId = targetTable.currentOrderId;

		await db.transaction(async (tx) => {
			// Move all line items from source order to target order
			await tx
				.update(schema.orderLineItem)
				.set({ orderId: targetOrderId })
				.where(eq(schema.orderLineItem.orderId, sourceOrderId));

			// Move kitchen items: update the ticket's orderId
			await tx
				.update(schema.kitchenOrderTicket)
				.set({ orderId: targetOrderId })
				.where(eq(schema.kitchenOrderTicket.orderId, sourceOrderId));

			// Recalculate target order totals
			const lineItems = await tx
				.select({
					total: schema.orderLineItem.total,
					tax: schema.orderLineItem.tax,
				})
				.from(schema.orderLineItem)
				.where(
					and(
						eq(schema.orderLineItem.orderId, targetOrderId),
						eq(schema.orderLineItem.voided, false),
					),
				);

			const subtotal = lineItems.reduce(
				(sum, li) => sum + Number(li.total),
				0,
			);
			const taxTotal = lineItems.reduce(
				(sum, li) => sum + Number(li.tax),
				0,
			);

			await tx
				.update(schema.order)
				.set({
					subtotal: subtotal.toFixed(2),
					taxTotal: taxTotal.toFixed(2),
					total: (subtotal + taxTotal).toFixed(2),
					notes: sql`COALESCE(${schema.order.notes}, '') || ' [Merged from ${sourceTable.name}]'`,
				})
				.where(eq(schema.order.id, targetOrderId));

			// Mark source order as voided
			await tx
				.update(schema.order)
				.set({
					status: "voided",
					voidReason: `Merged into order at ${targetTable.name}`,
				})
				.where(eq(schema.order.id, sourceOrderId));

			// Clear source table
			await tx
				.update(schema.tableLayout)
				.set({
					currentOrderId: null,
					currentGuests: null,
					status: "available",
				})
				.where(eq(schema.tableLayout.id, sourceTableId));
		});

		emitPosEvent({
			type: "table:status_changed",
			tableId: sourceTableId,
			status: "available",
		});

		return {
			success: true,
			sourceTable: sourceTable.name,
			targetTable: targetTable.name,
		};
	});

export const tablesRouter = {
	list,
	create,
	update,
	remove,
	assignOrder,
	clearTable,
	updateStatus,
	transferOrder,
	mergeOrders,
};
