import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../index";
import { emitKitchenEvent } from "../lib/kitchen-events";
import {
	resolveDefaultLocationId,
	resolvePublicOrganizationId,
} from "../lib/org-context";

// ── getMenu ─────────────────────────────────────────────────────────────
// Public: returns active products grouped by department (no cost data)
const getMenu = publicProcedure.handler(async () => {
	const orgId = await resolvePublicOrganizationId();
	const result = await db.execute(
		sql`SELECT
			p.id,
			p.name,
			p.price::numeric,
			p.image_url,
			p.sort_order,
			COALESCE(rc.name, 'Other') as department_name,
			COALESCE(rc.sort_order, 999) as department_sort_order,
			rc.id as department_id
		FROM product p
		LEFT JOIN reporting_category rc ON rc.id = p.reporting_category_id
		WHERE p.is_active = true
			AND p.organization_id = ${orgId}
		ORDER BY department_sort_order ASC, rc.name ASC, p.sort_order ASC, p.name ASC`,
	);

	// Group products by department
	const departments = new Map<
		string,
		{
			id: string | null;
			name: string;
			sortOrder: number;
			products: {
				id: string;
				name: string;
				price: number;
				imageUrl: string | null;
			}[];
		}
	>();

	for (const row of result.rows as Record<string, unknown>[]) {
		const deptName = row.department_name as string;
		if (!departments.has(deptName)) {
			departments.set(deptName, {
				id: (row.department_id as string) ?? null,
				name: deptName,
				sortOrder: Number(row.department_sort_order),
				products: [],
			});
		}
		departments.get(deptName)?.products.push({
			id: row.id as string,
			name: row.name as string,
			price: Number(row.price),
			imageUrl: row.image_url as string | null,
		});
	}

	return Array.from(departments.values()).sort(
		(a, b) => a.sortOrder - b.sortOrder,
	);
});

// ── placeOrder ──────────────────────────────────────────────────────────
// Public: customer places a pickup/delivery order
const placeOrder = publicProcedure
	.input(
		z.object({
			customerName: z.string().min(1, "Name is required"),
			customerPhone: z.string().min(1, "Phone is required"),
			orderType: z.enum(["pickup", "delivery"]),
			deliveryAddress: z.string().optional(),
			items: z
				.array(
					z.object({
						productId: z.string().uuid(),
						quantity: z.number().int().min(1),
						notes: z.string().optional(),
					}),
				)
				.min(1, "At least one item is required"),
			estimatedPickupTime: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const orgId = await resolvePublicOrganizationId();
		const locationId = await resolveDefaultLocationId(orgId);
		const {
			customerName,
			customerPhone,
			orderType,
			deliveryAddress,
			items,
			estimatedPickupTime,
		} = input;

		// Validate delivery address for delivery orders
		if (
			orderType === "delivery" &&
			(!deliveryAddress || deliveryAddress.trim() === "")
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Delivery address is required for delivery orders",
			});
		}

		// Fetch all requested products to validate and get prices
		const productIds = items.map((i) => i.productId);
		const products = await db
			.select({
				id: schema.product.id,
				name: schema.product.name,
				price: schema.product.price,
				isActive: schema.product.isActive,
				reportingCategoryId: schema.product.reportingCategoryId,
			})
			.from(schema.product)
			.where(
				and(
					inArray(schema.product.id, productIds),
					eq(schema.product.organizationId, orgId),
				),
			);

		// Validate all products exist and are active
		const productMap = new Map(products.map((p) => [p.id, p]));
		for (const item of items) {
			const product = productMap.get(item.productId);
			if (!product) {
				throw new ORPCError("NOT_FOUND", {
					message: `Product not found: ${item.productId}`,
				});
			}
			if (!product.isActive) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Product is no longer available: ${product.name}`,
				});
			}
		}

		// Get department names for snapshots
		const categoryIds = products
			.map((p) => p.reportingCategoryId)
			.filter((id): id is string => id !== null);
		let categoryMap = new Map<string, string>();
		if (categoryIds.length > 0) {
			const categories = await db
				.select({
					id: schema.reportingCategory.id,
					name: schema.reportingCategory.name,
				})
				.from(schema.reportingCategory)
				.where(inArray(schema.reportingCategory.id, categoryIds));
			categoryMap = new Map(categories.map((c) => [c.id, c.name]));
		}

		// Calculate totals
		let subtotal = 0;
		for (const item of items) {
			const product = productMap.get(item.productId)!;
			subtotal += Number(product.price) * item.quantity;
		}
		const total = subtotal; // No tax for now

		// Estimate ready time (default 30 minutes from now)
		let estimatedReadyAt: Date | null = null;
		if (estimatedPickupTime) {
			// Parse HH:mm as Guyana local time (UTC-4) to get correct UTC timestamp
			// Get today's date in Guyana timezone (YYYY-MM-DD)
			const gyDate = new Date().toLocaleDateString("en-CA", {
				timeZone: "America/Guyana",
			});
			// Build ISO string with explicit Guyana UTC offset (-04:00)
			const parsed = new Date(`${gyDate}T${estimatedPickupTime}:00-04:00`);
			if (!Number.isNaN(parsed.getTime())) {
				estimatedReadyAt = parsed;
			}
		}
		if (!estimatedReadyAt) {
			estimatedReadyAt = new Date(Date.now() + 30 * 60 * 1000);
		}

		// Ensure sequence exists before the transaction (DDL inside an aborted tx is ignored in Postgres)
		await db.execute(
			sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1`,
		);

		// Use a transaction for atomicity
		const result = await db.transaction(async (tx) => {
			// Generate daily order number
			const dailyResult = await tx.execute(
				sql`INSERT INTO daily_order_counter (location_id, counter_date, last_number)
					VALUES (${locationId}, CURRENT_DATE, 1)
					ON CONFLICT (location_id, counter_date)
					DO UPDATE SET last_number = daily_order_counter.last_number + 1
					RETURNING last_number`,
			);
			void dailyResult.rows[0]?.last_number; // Counter incremented; value not needed

			// Generate unique order number — sequence guaranteed to exist (created before tx)
			const seqResult = await tx.execute(
				sql`SELECT nextval('order_number_seq') as num`,
			);
			const orderNum = `ONL-${String(seqResult.rows[0]?.num).padStart(4, "0")}`;

			// Create order
			const orderRows = await tx
				.insert(schema.order)
				.values({
					organizationId: orgId,
					locationId,
					registerId: null,
					userId: null,
					orderNumber: orderNum,
					status: "pending",
					type: orderType,
					subtotal: subtotal.toFixed(2),
					taxTotal: "0",
					discountTotal: "0",
					total: total.toFixed(2),
					customerName,
					customerPhone,
					deliveryAddress: deliveryAddress ?? null,
					fulfillmentStatus: "pending",
					estimatedReadyAt,
					notes: `Online order - ${orderType}`,
				})
				.returning({
					id: schema.order.id,
					orderNumber: schema.order.orderNumber,
					total: schema.order.total,
					estimatedReadyAt: schema.order.estimatedReadyAt,
					createdAt: schema.order.createdAt,
				});
			const createdOrder = orderRows[0]!;

			// Insert line items
			for (const item of items) {
				const product = productMap.get(item.productId)!;
				const unitPrice = Number(product.price);
				const lineTotal = unitPrice * item.quantity;
				const deptName = product.reportingCategoryId
					? (categoryMap.get(product.reportingCategoryId) ?? null)
					: null;

				await tx.insert(schema.orderLineItem).values({
					orderId: createdOrder.id,
					productId: item.productId,
					productNameSnapshot: product.name,
					reportingCategorySnapshot: deptName,
					quantity: item.quantity,
					unitPrice: unitPrice.toFixed(2),
					tax: "0",
					total: lineTotal.toFixed(2),
					modifiersSnapshot: [],
					notes: item.notes ?? null,
				});
			}

			// Create kitchen ticket
			const ticketRows = await tx
				.insert(schema.kitchenOrderTicket)
				.values({
					orderId: createdOrder.id,
					locationId,
					status: "pending",
					printerTarget: "kitchen",
				})
				.returning({ id: schema.kitchenOrderTicket.id });
			const ticketId = ticketRows[0]!.id;

			// Create kitchen items
			for (const item of items) {
				const product = productMap.get(item.productId)!;
				await tx.insert(schema.kitchenOrderItem).values({
					ticketId,
					orderLineItemId: null,
					productName: product.name,
					quantity: item.quantity,
					modifiers: null,
					notes: item.notes ?? null,
					status: "pending",
				});
			}

			return {
				orderId: createdOrder.id,
				orderNumber: createdOrder.orderNumber,
				estimatedReadyAt: createdOrder.estimatedReadyAt,
				total: Number(createdOrder.total),
				ticketId,
			};
		});

		// Emit kitchen event after transaction committed
		emitKitchenEvent({
			type: "ticket:created",
			ticketId: result.ticketId,
			orderId: result.orderId,
		});

		return {
			orderId: result.orderId,
			orderNumber: result.orderNumber,
			estimatedReadyAt: result.estimatedReadyAt,
			total: result.total,
		};
	});

// ── getOrderStatus ──────────────────────────────────────────────────────
// Public: customer checks order status (basic auth via phone number)
const getOrderStatus = publicProcedure
	.input(
		z.object({
			orderId: z.string().uuid(),
			customerPhone: z.string().min(1),
		}),
	)
	.handler(async ({ input }) => {
		const { orderId, customerPhone } = input;

		const orders = await db
			.select({
				id: schema.order.id,
				orderNumber: schema.order.orderNumber,
				status: schema.order.status,
				type: schema.order.type,
				total: schema.order.total,
				customerName: schema.order.customerName,
				fulfillmentStatus: schema.order.fulfillmentStatus,
				estimatedReadyAt: schema.order.estimatedReadyAt,
				createdAt: schema.order.createdAt,
			})
			.from(schema.order)
			.where(
				and(
					eq(schema.order.id, orderId),
					eq(schema.order.customerPhone, customerPhone),
				),
			);

		if (orders.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message:
					"Order not found. Please check your order ID and phone number.",
			});
		}

		const order = orders[0]!;

		// Get kitchen ticket status
		const tickets = await db
			.select({
				status: schema.kitchenOrderTicket.status,
			})
			.from(schema.kitchenOrderTicket)
			.where(eq(schema.kitchenOrderTicket.orderId, orderId))
			.orderBy(asc(schema.kitchenOrderTicket.createdAt));

		const kitchenStatus =
			tickets.length > 0 ? tickets[tickets.length - 1]?.status : null;

		return {
			orderNumber: order.orderNumber,
			status: order.status,
			type: order.type,
			total: Number(order.total),
			customerName: order.customerName,
			fulfillmentStatus: order.fulfillmentStatus,
			kitchenStatus,
			estimatedReadyAt: order.estimatedReadyAt,
			createdAt: order.createdAt,
		};
	});

export const onlineOrderRouter = {
	getMenu,
	placeOrder,
	getOrderStatus,
};
