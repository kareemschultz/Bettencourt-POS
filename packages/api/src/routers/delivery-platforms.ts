import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

/**
 * Delivery Platform Integration Stubs
 *
 * These endpoints accept orders from external delivery platforms
 * (UberEats, DoorDash, etc.) and convert them into internal orders.
 * Each platform would call the ingestOrder endpoint via webhook.
 */

const ingestOrder = permissionProcedure("orders.create")
	.input(
		z.object({
			platform: z.enum(["ubereats", "doordash", "grubhub", "custom"]),
			externalOrderId: z.string(),
			customerName: z.string(),
			customerPhone: z.string().optional().nullable(),
			deliveryAddress: z.string().optional().nullable(),
			items: z.array(
				z.object({
					name: z.string(),
					quantity: z.number().int().min(1),
					unitPrice: z.string(),
					notes: z.string().optional(),
					productId: z.string().uuid().optional(),
				}),
			),
			subtotal: z.string(),
			deliveryFee: z.string().optional(),
			platformFee: z.string().optional(),
			total: z.string(),
			notes: z.string().optional().nullable(),
			scheduledFor: z.string().optional().nullable(),
			locationId: z.string().uuid(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const userId = context.session.user.id;

		// Create internal order from external platform data
		const orderNumber = `${input.platform.toUpperCase()}-${input.externalOrderId}`;

		const [order] = await db
			.insert(schema.order)
			.values({
				organizationId: orgId,
				locationId: input.locationId,
				userId,
				orderNumber,
				type: "delivery",
				status: "open",
				subtotal: input.subtotal,
				taxTotal: "0",
				discountTotal: "0",
				total: input.total,
				notes: `[${input.platform}] ${input.notes ?? ""}\nCustomer: ${input.customerName}\nAddress: ${input.deliveryAddress ?? "N/A"}`,
			})
			.returning();

		if (!order) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Order creation failed" });

		// Insert line items
		for (const item of input.items) {
			await db.insert(schema.orderLineItem).values({
				orderId: order.id,
				productId: item.productId ?? null,
				productNameSnapshot: item.name,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				total: (Number(item.unitPrice) * item.quantity).toFixed(2),
				notes: item.notes ?? null,
			});
		}

		return {
			orderId: order.id,
			orderNumber,
			status: "open",
			message: `Order ingested from ${input.platform}`,
		};
	});

const listPlatformOrders = permissionProcedure("orders.read")
	.input(
		z
			.object({
				platform: z
					.enum(["ubereats", "doordash", "grubhub", "custom"])
					.optional(),
				limit: z.number().int().min(1).max(100).optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		const limit = input.limit ?? 50;

		// Find orders that came from delivery platforms by order_number prefix
		const prefixes = input.platform
			? [`${input.platform.toUpperCase()}-%`]
			: ["UBEREATS-%", "DOORDASH-%", "GRUBHUB-%", "CUSTOM-%"];

		const results = await db.execute(
			// biome-ignore lint: SQL template
			{
				sql: `SELECT id, order_number, type, status, total, notes, created_at
				FROM "order"
				WHERE organization_id = $1
					AND (${prefixes.map((_, i) => `order_number LIKE $${i + 2}`).join(" OR ")})
				ORDER BY created_at DESC
				LIMIT $${prefixes.length + 2}`,
				params: [orgId, ...prefixes, limit],
			} as any,
		);

		return results.rows;
	});

/**
 * Webhook verification endpoint — delivery platforms send a verification
 * request before enabling webhooks. This returns a simple acknowledgment.
 */
const verifyWebhook = permissionProcedure("settings.read")
	.input(
		z.object({
			platform: z.enum(["ubereats", "doordash", "grubhub", "custom"]),
			challenge: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		return {
			platform: input.platform,
			verified: true,
			challenge: input.challenge,
			message: `Webhook verified for ${input.platform}`,
		};
	});

export const deliveryPlatformsRouter = {
	ingestOrder,
	listPlatformOrders,
	verifyWebhook,
};
