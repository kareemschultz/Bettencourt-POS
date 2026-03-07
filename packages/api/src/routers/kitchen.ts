import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { emitKitchenEvent } from "../lib/kitchen-events";

// ── getActiveTickets ────────────────────────────────────────────────────
const getActiveTickets = permissionProcedure("orders.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
				status: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = [];
		if (input.locationId) {
			conditions.push(
				eq(schema.kitchenOrderTicket.locationId, input.locationId),
			);
		}
		if (input.status) {
			conditions.push(eq(schema.kitchenOrderTicket.status, input.status));
		} else {
			// Default: only active statuses
			conditions.push(
				inArray(schema.kitchenOrderTicket.status, [
					"pending",
					"preparing",
					"ready",
				]),
			);
		}

		const tickets = await db
			.select({
				id: schema.kitchenOrderTicket.id,
				orderId: schema.kitchenOrderTicket.orderId,
				locationId: schema.kitchenOrderTicket.locationId,
				status: schema.kitchenOrderTicket.status,
				printerTarget: schema.kitchenOrderTicket.printerTarget,
				createdAt: schema.kitchenOrderTicket.createdAt,
				updatedAt: schema.kitchenOrderTicket.updatedAt,
				orderNumber: schema.order.orderNumber,
				orderType: schema.order.type,
				tableName: schema.tableLayout.name,
			})
			.from(schema.kitchenOrderTicket)
			.innerJoin(
				schema.order,
				eq(schema.kitchenOrderTicket.orderId, schema.order.id),
			)
			.leftJoin(
				schema.tableLayout,
				eq(schema.order.tableId, schema.tableLayout.id),
			)
			.where(and(...conditions))
			.orderBy(asc(schema.kitchenOrderTicket.createdAt));

		// Get items for all tickets
		const ticketIds = tickets.map((t) => t.id);
		let items: Array<{
			id: string;
			ticketId: string;
			orderLineItemId: string | null;
			productName: string;
			quantity: number;
			modifiers: string | null;
			notes: string | null;
			status: string;
			createdAt: Date;
			updatedAt: Date;
		}> = [];

		if (ticketIds.length > 0) {
			items = await db
				.select()
				.from(schema.kitchenOrderItem)
				.where(inArray(schema.kitchenOrderItem.ticketId, ticketIds))
				.orderBy(asc(schema.kitchenOrderItem.createdAt));
		}

		// Attach items to their tickets
		return tickets.map((ticket) => ({
			...ticket,
			items: items.filter((item) => item.ticketId === ticket.id),
		}));
	});

// ── updateItemStatus ────────────────────────────────────────────────────
// Supports either updating a single item or an entire ticket
const updateItemStatus = permissionProcedure("orders.update")
	.input(
		z.object({
			// Ticket-level update
			id: z.string().uuid().optional(),
			status: z.string().optional(),
			// Item-level update
			itemId: z.string().uuid().optional(),
			itemStatus: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, status, itemId, itemStatus } = input;

		if (itemId && itemStatus) {
			// Update individual item
			await db
				.update(schema.kitchenOrderItem)
				.set({ status: itemStatus })
				.where(eq(schema.kitchenOrderItem.id, itemId));

			// Check if all items on the ticket are done
			const itemRow = await db
				.select({ ticketId: schema.kitchenOrderItem.ticketId })
				.from(schema.kitchenOrderItem)
				.where(eq(schema.kitchenOrderItem.id, itemId));

			if (itemRow.length > 0) {
				const ticketId = itemRow[0]!.ticketId;
				const remaining = await db.execute(
					sql`SELECT COUNT(*) as cnt FROM kitchen_order_item
						WHERE ticket_id = ${ticketId} AND status != 'done'`,
				);
				const cnt = Number(remaining.rows[0]?.cnt);
				if (cnt === 0) {
					await db
						.update(schema.kitchenOrderTicket)
						.set({ status: "ready" })
						.where(eq(schema.kitchenOrderTicket.id, ticketId));
					emitKitchenEvent({
						type: "ticket:updated",
						ticketId,
						status: "ready",
					});
				}
				emitKitchenEvent({
					type: "item:updated",
					ticketId,
					itemId,
					status: itemStatus,
				});
			}
		} else if (id && status) {
			// Update entire ticket
			await db
				.update(schema.kitchenOrderTicket)
				.set({ status })
				.where(eq(schema.kitchenOrderTicket.id, id));

			// Cascade status to items
			if (status === "preparing" || status === "ready" || status === "served") {
				const newItemStatus = status === "served" ? "done" : status;
				await db
					.update(schema.kitchenOrderItem)
					.set({ status: newItemStatus })
					.where(eq(schema.kitchenOrderItem.ticketId, id));
			}
			emitKitchenEvent({ type: "ticket:updated", ticketId: id, status });
		}

		return { success: true };
	});

export const kitchenRouter = {
	getActiveTickets,
	updateItemStatus,
};
