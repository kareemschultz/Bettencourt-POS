import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { emitKitchenEvent } from "../lib/kitchen-events";
import { printService } from "../lib/print-service";

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
				station: schema.kitchenOrderTicket.station,
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

		// Get items for all tickets (include firedAt, completedAt)
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
			firedAt: Date | null;
			completedAt: Date | null;
			createdAt: Date;
			updatedAt: Date;
			courseNumber: number | null;
		}> = [];

		if (ticketIds.length > 0) {
			items = await db
				.select({
					id: schema.kitchenOrderItem.id,
					ticketId: schema.kitchenOrderItem.ticketId,
					orderLineItemId: schema.kitchenOrderItem.orderLineItemId,
					productName: schema.kitchenOrderItem.productName,
					quantity: schema.kitchenOrderItem.quantity,
					modifiers: schema.kitchenOrderItem.modifiers,
					notes: schema.kitchenOrderItem.notes,
					status: schema.kitchenOrderItem.status,
					firedAt: schema.kitchenOrderItem.firedAt,
					completedAt: schema.kitchenOrderItem.completedAt,
					createdAt: schema.kitchenOrderItem.createdAt,
					updatedAt: schema.kitchenOrderItem.updatedAt,
					courseNumber: schema.orderLineItem.courseNumber,
				})
				.from(schema.kitchenOrderItem)
				.leftJoin(
					schema.orderLineItem,
					eq(schema.kitchenOrderItem.orderLineItemId, schema.orderLineItem.id),
				)
				.where(inArray(schema.kitchenOrderItem.ticketId, ticketIds))
				.orderBy(
					asc(schema.orderLineItem.courseNumber),
					asc(schema.kitchenOrderItem.createdAt),
				);
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
			// Update individual item — set completedAt when done, firedAt when preparing
			const itemUpdate: Record<string, unknown> = { status: itemStatus };
			if (itemStatus === "done") {
				itemUpdate.completedAt = new Date();
			} else if (itemStatus === "preparing") {
				itemUpdate.firedAt = new Date();
			}

			await db
				.update(schema.kitchenOrderItem)
				.set(itemUpdate)
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

			// Cascade status to items with timestamp tracking
			if (status === "preparing" || status === "ready" || status === "served") {
				const newItemStatus = status === "served" ? "done" : status;
				const itemUpdate: Record<string, unknown> = { status: newItemStatus };
				if (status === "preparing") {
					itemUpdate.firedAt = new Date();
				} else if (status === "served") {
					itemUpdate.completedAt = new Date();
				}
				await db
					.update(schema.kitchenOrderItem)
					.set(itemUpdate)
					.where(eq(schema.kitchenOrderItem.ticketId, id));
			}

			if (status === "preparing") {
				// Print KOT when ticket moves to preparing
				try {
					const ticketRows = await db
						.select({
							id: schema.kitchenOrderTicket.id,
							orderId: schema.kitchenOrderTicket.orderId,
							locationId: schema.kitchenOrderTicket.locationId,
							station: schema.kitchenOrderTicket.station,
							orderNumber: schema.order.orderNumber,
							organizationId: schema.order.organizationId,
						})
						.from(schema.kitchenOrderTicket)
						.innerJoin(
							schema.order,
							eq(schema.kitchenOrderTicket.orderId, schema.order.id),
						)
						.where(eq(schema.kitchenOrderTicket.id, id))
						.limit(1);

					if (ticketRows.length > 0) {
						const ticket = ticketRows[0]!;
						// Query items with courseNumber + reportingCategoryName via orderLineItem join
						const items = await db
							.select({
								name: schema.kitchenOrderItem.productName,
								quantity: schema.kitchenOrderItem.quantity,
								notes: schema.kitchenOrderItem.notes,
								courseNumber: schema.orderLineItem.courseNumber,
								reportingCategoryName:
									schema.orderLineItem.reportingCategorySnapshot,
							})
							.from(schema.kitchenOrderItem)
							.leftJoin(
								schema.orderLineItem,
								eq(
									schema.kitchenOrderItem.orderLineItemId,
									schema.orderLineItem.id,
								),
							)
							.where(eq(schema.kitchenOrderItem.ticketId, id));

						const jobType = (ticket.station ?? "").toLowerCase().includes("bar")
							? "bar_ticket"
							: "kitchen_ticket";

						await printService.dispatch({
							type: jobType,
							organizationId: ticket.organizationId,
							locationId: ticket.locationId,
							orderId: ticket.orderId,
							orderNumber: ticket.orderNumber,
							station: ticket.station,
							items: items.map((item) => ({
								name: item.name,
								quantity: item.quantity,
								notes: item.notes,
								courseNumber: item.courseNumber ?? undefined,
								reportingCategoryName: item.reportingCategoryName,
							})),
							timestamp: new Date(),
						});
					}
				} catch (err) {
					console.error("[kitchen] Print dispatch failed:", err);
					// Don't fail the status update if printing fails
				}
			}

			emitKitchenEvent({ type: "ticket:updated", ticketId: id, status });
		}

		return { success: true };
	});

// ── fireCourse ───────────────────────────────────────────────────────────
// Fire a specific course on a ticket — sets firedAt on items with that course number
const fireCourse = permissionProcedure("orders.update")
	.input(
		z.object({
			ticketId: z.string().uuid(),
			courseNumber: z.number().int().min(1),
		}),
	)
	.handler(async ({ input }) => {
		const { ticketId, courseNumber } = input;

		// Verify ticket exists
		const [ticket] = await db
			.select({
				id: schema.kitchenOrderTicket.id,
				status: schema.kitchenOrderTicket.status,
			})
			.from(schema.kitchenOrderTicket)
			.where(eq(schema.kitchenOrderTicket.id, ticketId));

		if (!ticket) {
			throw new ORPCError("NOT_FOUND", { message: "Ticket not found" });
		}

		// Get items for this course by joining to orderLineItem
		const courseItems = await db
			.select({
				id: schema.kitchenOrderItem.id,
				courseNumber: schema.orderLineItem.courseNumber,
			})
			.from(schema.kitchenOrderItem)
			.leftJoin(
				schema.orderLineItem,
				eq(schema.kitchenOrderItem.orderLineItemId, schema.orderLineItem.id),
			)
			.where(
				and(
					eq(schema.kitchenOrderItem.ticketId, ticketId),
					eq(schema.orderLineItem.courseNumber, courseNumber),
				),
			);

		if (courseItems.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: `No items found for course ${courseNumber}`,
			});
		}

		// Mark course items as fired
		const itemIds = courseItems.map((i) => i.id);
		await db
			.update(schema.kitchenOrderItem)
			.set({ status: "preparing", firedAt: new Date() })
			.where(inArray(schema.kitchenOrderItem.id, itemIds));

		// Move ticket to preparing if still pending
		if (ticket.status === "pending") {
			await db
				.update(schema.kitchenOrderTicket)
				.set({ status: "preparing" })
				.where(eq(schema.kitchenOrderTicket.id, ticketId));
		}

		emitKitchenEvent({
			type: "ticket:updated",
			ticketId,
			status: "preparing",
		});

		return { success: true, firedCount: itemIds.length };
	});

export const kitchenRouter = {
	getActiveTickets,
	updateItemStatus,
	fireCourse,
};
