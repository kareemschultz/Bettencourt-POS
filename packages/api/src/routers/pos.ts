import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { createAuditLog } from "../lib/audit";
import { emitKitchenEvent } from "../lib/kitchen-events";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";
const DEFAULT_LOC_ID = "b0000000-0000-4000-8000-000000000001";

async function nextInvoiceNumber(orgId: string): Promise<string> {
	const result = await db
		.insert(schema.invoiceCounter)
		.values({ organizationId: orgId, lastNumber: 1 })
		.onConflictDoUpdate({
			target: schema.invoiceCounter.organizationId,
			set: { lastNumber: sql`${schema.invoiceCounter.lastNumber} + 1` },
		})
		.returning({ lastNumber: schema.invoiceCounter.lastNumber });
	const num = result[0]?.lastNumber ?? 1;
	return `INV-${String(num).padStart(4, "0")}`;
}

// ── getProducts ─────────────────────────────────────────────────────────
// POS product grid: filtered by register departments, specific department, and location
const getProducts = permissionProcedure("orders.read")
	.input(
		z
			.object({
				registerId: z.string().uuid().optional(),
				departmentId: z.string().uuid().optional(),
				locationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		// If register specified, get its allowed department IDs
		let departmentFilter: string[] = [];
		if (input.registerId) {
			const rdRows = await db
				.select({ departmentId: schema.registerDepartment.departmentId })
				.from(schema.registerDepartment)
				.where(eq(schema.registerDepartment.registerId, input.registerId));
			departmentFilter = rdRows.map((r) => r.departmentId);
		}

		// If locationId specified, get product IDs available at this location
		let locationProductIds: string[] | null = null;
		if (input.locationId) {
			const plRows = await db
				.select({ productId: schema.productLocation.productId })
				.from(schema.productLocation)
				.where(
					and(
						eq(schema.productLocation.locationId, input.locationId),
						eq(schema.productLocation.isAvailable, true),
					),
				);
			locationProductIds = plRows.map((r) => r.productId);
		}

		// Get departments (filtered if register has restrictions)
		let departments: { id: string; name: string; sortOrder: number | null }[] =
			[];
		if (departmentFilter.length > 0) {
			departments = await db
				.select({
					id: schema.reportingCategory.id,
					name: schema.reportingCategory.name,
					sortOrder: schema.reportingCategory.sortOrder,
				})
				.from(schema.reportingCategory)
				.where(
					and(
						eq(schema.reportingCategory.isActive, true),
						inArray(schema.reportingCategory.id, departmentFilter),
					),
				)
				.orderBy(
					asc(schema.reportingCategory.sortOrder),
					asc(schema.reportingCategory.name),
				);
		} else {
			departments = await db
				.select({
					id: schema.reportingCategory.id,
					name: schema.reportingCategory.name,
					sortOrder: schema.reportingCategory.sortOrder,
				})
				.from(schema.reportingCategory)
				.where(eq(schema.reportingCategory.isActive, true))
				.orderBy(
					asc(schema.reportingCategory.sortOrder),
					asc(schema.reportingCategory.name),
				);
		}

		// Build product filter conditions
		const conditions = [eq(schema.product.isActive, true)];
		if (input.departmentId) {
			conditions.push(
				eq(schema.product.reportingCategoryId, input.departmentId),
			);
		} else if (departmentFilter.length > 0) {
			conditions.push(
				inArray(schema.product.reportingCategoryId, departmentFilter),
			);
		}

		// Filter by location availability (only if product_location rows exist for this location)
		if (locationProductIds !== null && locationProductIds.length > 0) {
			conditions.push(inArray(schema.product.id, locationProductIds));
		} else if (locationProductIds !== null && locationProductIds.length === 0) {
			// Location specified but no product_location rows exist — return all products
			// (backwards-compatible: locations without product_location entries see everything)
		}

		// Get products with department name
		const products = await db
			.select({
				id: schema.product.id,
				organizationId: schema.product.organizationId,
				name: schema.product.name,
				reportingName: schema.product.reportingName,
				reportingCategoryId: schema.product.reportingCategoryId,
				sku: schema.product.sku,
				price: schema.product.price,
				cost: schema.product.cost,
				taxRate: schema.product.taxRate,
				isActive: schema.product.isActive,
				imageUrl: schema.product.imageUrl,
				sortOrder: schema.product.sortOrder,
				createdAt: schema.product.createdAt,
				updatedAt: schema.product.updatedAt,
				departmentName: schema.reportingCategory.name,
			})
			.from(schema.product)
			.leftJoin(
				schema.reportingCategory,
				eq(schema.product.reportingCategoryId, schema.reportingCategory.id),
			)
			.where(and(...conditions))
			.orderBy(asc(schema.product.sortOrder), asc(schema.product.name));

		// Get combo products and their components
		const comboProductRows = await db
			.select({
				productId: schema.comboProduct.productId,
				id: schema.comboProduct.id,
			})
			.from(schema.comboProduct);

		const comboProductIds = comboProductRows.map((c) => c.id);
		const comboProductIdToProductId = new Map(
			comboProductRows.map((c) => [c.id, c.productId]),
		);

		let comboComponents: Array<{
			id: string;
			comboProductId: string;
			componentName: string;
			allocatedPrice: string;
			departmentName: string | null;
		}> = [];

		if (comboProductIds.length > 0) {
			comboComponents = await db
				.select({
					id: schema.comboComponent.id,
					comboProductId: schema.comboComponent.comboProductId,
					componentName: schema.comboComponent.componentName,
					allocatedPrice: schema.comboComponent.allocatedPrice,
					departmentName: schema.reportingCategory.name,
				})
				.from(schema.comboComponent)
				.leftJoin(
					schema.reportingCategory,
					eq(schema.comboComponent.departmentId, schema.reportingCategory.id),
				)
				.where(inArray(schema.comboComponent.comboProductId, comboProductIds))
				.orderBy(asc(schema.comboComponent.componentName));
		}

		// Attach combo components to their products
		const comboProductIdSet = new Set(comboProductRows.map((c) => c.productId));
		const productsWithCombos = products.map((p) => ({
			...p,
			price: Number(p.price),
			cost: Number(p.cost || 0),
			taxRate: Number(p.taxRate || 0),
			comboComponents: comboProductIdSet.has(p.id)
				? comboComponents
						.filter((cc) => {
							const parentProductId = comboProductIdToProductId.get(
								cc.comboProductId,
							);
							return parentProductId === p.id;
						})
						.map((cc) => ({
							...cc,
							allocatedPrice: Number(cc.allocatedPrice),
						}))
				: [],
		}));

		return { departments, products: productsWithCombos };
	});

// ── getModifiers ────────────────────────────────────────────────────────
const getModifiers = permissionProcedure("orders.read")
	.input(z.object({ productId: z.string().uuid().optional() }).optional())
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		if (!input.productId) {
			return { groups: [] };
		}

		// Get modifier groups linked to this product
		const pmgRows = await db
			.select({ modifierGroupId: schema.productModifierGroup.modifierGroupId })
			.from(schema.productModifierGroup)
			.where(eq(schema.productModifierGroup.productId, input.productId));

		const groupIds = pmgRows.map((r) => r.modifierGroupId);
		if (groupIds.length === 0) {
			return { groups: [] };
		}

		const groups = await db
			.select()
			.from(schema.modifierGroup)
			.where(inArray(schema.modifierGroup.id, groupIds));

		const modifiers = await db
			.select()
			.from(schema.modifier)
			.where(
				and(
					inArray(schema.modifier.modifierGroupId, groupIds),
					eq(schema.modifier.isActive, true),
				),
			)
			.orderBy(asc(schema.modifier.sortOrder));

		const result = groups.map((group) => ({
			...group,
			modifiers: modifiers.filter((m) => m.modifierGroupId === group.id),
		}));

		return { groups: result };
	});

// ── checkout ────────────────────────────────────────────────────────────
// Atomic order creation: order + line items + payments + kitchen tickets
const checkout = permissionProcedure("orders.create")
	.input(
		z.object({
			items: z.array(
				z.object({
					productId: z.string().uuid(),
					productName: z.string(),
					department: z.string().nullable(),
					quantity: z.number().int().min(1),
					unitPrice: z.number().nonnegative(),
					taxRate: z.number().default(0),
					isCombo: z.boolean().default(false),
					comboComponents: z
						.array(
							z.object({
								componentName: z.string(),
								departmentName: z.string(),
								allocatedPrice: z.number(),
							}),
						)
						.optional(),
					modifiers: z.array(z.object({ name: z.string(), price: z.number() })),
					notes: z.string().nullable().optional(),
				}),
			),
			payments: z
				.array(
					z.object({
						method: z.enum([
							"cash",
							"card",
							"mobile_money",
							"gift_card",
							"credit",
						]),
						amount: z.number().positive("Payment amount must be positive"),
						reference: z.string().optional(),
					}),
				)
				.min(1, "At least one payment method is required"),
			orderType: z.string().default("sale"),
			locationId: z.string().uuid(),
			registerId: z.string().uuid(),
			organizationId: z.string().uuid(),
			userId: z.string().nullable().optional(),
			tableId: z.string().uuid().nullable().optional(),
			notes: z.string().nullable().optional(),
			discountTotal: z.number().min(0).default(0),
			customerId: z.string().uuid().nullable().optional(),
			customerName: z.string().nullable().optional(),
			customerPhone: z.string().nullable().optional(),
			deliveryAddress: z.string().nullable().optional(),
			estimatedReadyAt: z.string().nullable().optional(),
			fulfillmentStatus: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const {
			items,
			payments,
			orderType,
			locationId,
			registerId,
			organizationId,
			userId,
			tableId,
			notes,
			discountTotal,
			customerId,
			customerName,
			customerPhone,
			deliveryAddress,
			estimatedReadyAt,
			fulfillmentStatus,
		} = input;

		if (!items || items.length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "No items" });
		}

		// Calculate totals
		let subtotal = 0;
		let taxTotal = 0;
		for (const item of items) {
			const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
			const lineSubtotal = (item.unitPrice + modifierTotal) * item.quantity;
			const lineTax = lineSubtotal * item.taxRate;
			subtotal += lineSubtotal;
			taxTotal += lineTax;
		}
		const total = Math.max(0, subtotal + taxTotal - discountTotal);

		// Validate payment sum covers order total
		const paymentSum = payments.reduce((s, p) => s + p.amount, 0);
		if (paymentSum < total - 0.01) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Payment total (${paymentSum.toFixed(2)}) is less than order total (${total.toFixed(2)})`,
			});
		}

		// Ensure the order number sequence exists OUTSIDE the transaction.
		// DDL inside an aborted Postgres transaction is silently ignored — the whole
		// tx stays in error state. CREATE SEQUENCE is idempotent so this is safe to run on every checkout.
		await db.execute(
			sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1`,
		);

		// Use a transaction for atomicity
		const result = await db.transaction(async (tx) => {
			// Generate daily order number (upsert)
			const dailyResult = await tx.execute(
				sql`INSERT INTO daily_order_counter (location_id, counter_date, last_number)
					VALUES (${locationId}, CURRENT_DATE, 1)
					ON CONFLICT (location_id, counter_date)
					DO UPDATE SET last_number = daily_order_counter.last_number + 1
					RETURNING last_number`,
			);
			const dailyNum = Number(dailyResult.rows[0]?.last_number);

			// Generate unique order number — sequence is guaranteed to exist
			// (created outside the transaction to avoid aborted-tx state)
			const seqResult = await tx.execute(
				sql`SELECT nextval('order_number_seq') as num`,
			);
			const orderNum = `ORD-${String(seqResult.rows[0]?.num).padStart(4, "0")}`;

			// Create order
			const orderRows = await tx
				.insert(schema.order)
				.values({
					organizationId,
					locationId,
					registerId,
					tableId: tableId ?? null,
					userId: userId ?? null,
					customerId: customerId ?? null,
					customerName: customerName ?? null,
					customerPhone: customerPhone ?? null,
					deliveryAddress: deliveryAddress ?? null,
					estimatedReadyAt: estimatedReadyAt
						? new Date(estimatedReadyAt)
						: null,
					fulfillmentStatus: fulfillmentStatus ?? "none",
					orderNumber: orderNum,
					status: "completed",
					type: orderType,
					subtotal: subtotal.toFixed(2),
					taxTotal: taxTotal.toFixed(2),
					discountTotal: discountTotal.toFixed(2),
					total: total.toFixed(2),
					notes: notes ?? null,
				})
				.returning({
					id: schema.order.id,
					orderNumber: schema.order.orderNumber,
					total: schema.order.total,
					createdAt: schema.order.createdAt,
				});
			const createdOrder = orderRows[0]!;

			// Insert line items with snapshots
			for (const item of items) {
				const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
				const lineTotal = (item.unitPrice + modifierTotal) * item.quantity;
				const taxAmount = lineTotal * item.taxRate;

				// Insert the main line item
				await tx.insert(schema.orderLineItem).values({
					orderId: createdOrder.id,
					productId: item.productId,
					productNameSnapshot: item.productName,
					reportingCategorySnapshot: item.department,
					quantity: item.quantity,
					unitPrice: item.unitPrice.toFixed(2),
					tax: taxAmount.toFixed(2),
					total: lineTotal.toFixed(2),
					modifiersSnapshot: item.modifiers,
					notes: item.notes ?? null,
				});

				// If combo product, also insert component line items for reporting
				if (
					item.isCombo &&
					item.comboComponents &&
					item.comboComponents.length > 0
				) {
					for (const comp of item.comboComponents) {
						await tx.insert(schema.orderLineItem).values({
							orderId: createdOrder.id,
							productId: item.productId,
							productNameSnapshot: comp.componentName,
							reportingCategorySnapshot: comp.departmentName,
							quantity: item.quantity,
							unitPrice: comp.allocatedPrice.toFixed(2),
							tax: "0",
							total: (comp.allocatedPrice * item.quantity).toFixed(2),
							modifiersSnapshot: [],
							notes: `Component of: ${item.productName}`,
							isComponent: true,
							voided: false,
						});
					}
				}
			}

			// Insert payments
			// Allocate payment amounts sequentially against remaining balance
			let remaining = total;
			let totalCashAllocated = 0;
			for (const pmt of payments) {
				const remainingBefore = remaining;
				const allocated = Math.min(pmt.amount, remaining);
				remaining -= allocated;
				const tendered = pmt.method === "cash" ? pmt.amount : null;
				// Change is computed against the remaining balance before this payment,
				// not the global total — handles split-payment correctly.
				const changeGiven =
					pmt.method === "cash" && pmt.amount > remainingBefore
						? pmt.amount - remainingBefore
						: 0;

				if (pmt.method === "cash") {
					totalCashAllocated += allocated;
				}

				await tx.insert(schema.payment).values({
					orderId: createdOrder.id,
					method: pmt.method,
					amount: allocated.toFixed(2),
					tendered: tendered?.toFixed(2) ?? null,
					changeGiven: changeGiven.toFixed(2),
					reference: pmt.reference ?? null,
					status: "completed",
				});
			}

			// Update cash session — sum ALL cash payments, not just first
			if (totalCashAllocated > 0) {
				await tx.execute(
					sql`UPDATE cash_session
						SET expected_cash = COALESCE(expected_cash, opening_float) + ${totalCashAllocated}
						WHERE register_id = ${registerId} AND status = 'open'`,
				);
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
				// Build modifiers array: combo components first (as isComponent entries), then selected modifiers
				const kitchenMods: Array<{
					name: string;
					price: number;
					isComponent?: boolean;
				}> = [
					...(item.isCombo && (item.comboComponents ?? []).length > 0
						? (item.comboComponents ?? []).map((cc) => ({
								name: cc.componentName,
								price: 0,
								isComponent: true as const,
							}))
						: []),
					...item.modifiers,
				];
				await tx.insert(schema.kitchenOrderItem).values({
					ticketId,
					orderLineItemId: null,
					productName: item.productName,
					quantity: item.quantity,
					modifiers:
						kitchenMods.length > 0 ? JSON.stringify(kitchenMods) : null,
					notes: item.notes ?? null,
					status: "pending",
				});
			}

			// Update customer stats if linked
			if (customerId) {
				await tx
					.update(schema.customer)
					.set({
						visitCount: sql`${schema.customer.visitCount} + 1`,
						totalSpent: sql`${schema.customer.totalSpent} + ${total}`,
						lastVisitAt: sql`NOW()`,
					})
					.where(eq(schema.customer.id, customerId));
			}

			// Get user name for receipt
			let userName = "Cashier";
			if (userId) {
				const userRows = await tx
					.select({ name: schema.user.name })
					.from(schema.user)
					.where(eq(schema.user.id, userId));
				if (userRows.length > 0) userName = userRows[0]!.name;
			}

			return {
				order: {
					id: createdOrder.id,
					orderNumber: createdOrder.orderNumber,
					dailyNumber: dailyNum,
					total: Number(createdOrder.total),
					createdAt: createdOrder.createdAt,
					userName,
				},
				ticketId,
				change:
					payments.reduce((s, p) => s + p.amount, 0) - total > 0
						? payments.reduce((s, p) => s + p.amount, 0) - total
						: 0,
			};
		});

		// Auto-create draft invoice for credit sales
		const creditPayment = payments.find((p) => p.method === "credit");
		if (creditPayment && userId) {
			const invoiceNumber = await nextInvoiceNumber(
				organizationId ?? DEFAULT_ORG_ID,
			);
			await db.insert(schema.invoice).values({
				organizationId: organizationId ?? DEFAULT_ORG_ID,
				locationId: locationId ?? DEFAULT_LOC_ID,
				invoiceNumber,
				customerId: customerId ?? null,
				customerName: customerName ?? "Walk-in",
				items: items.map((item) => ({
					description: item.productName ?? "Item",
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					total: item.unitPrice * item.quantity,
				})),
				subtotal: subtotal.toFixed(2),
				taxTotal: taxTotal.toFixed(2),
				total: total.toFixed(2),
				status: "outstanding",
				notes: `Credit sale from POS — Order ${result.order.orderNumber}`,
				createdBy: userId,
			});
		}

		// Audit log — runs after transaction commits so it's not rolled back with failed orders
		await createAuditLog({
			userId: userId ?? null,
			entityType: "order",
			entityId: result.order.id,
			actionType: "create",
			afterData: {
				order_number: result.order.orderNumber,
				daily_number: result.order.dailyNumber,
				total: result.order.total,
				items: items.length,
				payment_methods: payments.map((p) => p.method),
			},
			locationId,
		});

		// Emit kitchen event after transaction committed
		emitKitchenEvent({
			type: "ticket:created",
			ticketId: result.ticketId,
			orderId: result.order.id,
		});

		return result;
	});

// ── lookupBarcode ───────────────────────────────────────────────────────
// Scan barcode: check product_barcode table first, then fall back to product.sku
const lookupBarcode = permissionProcedure("orders.create")
	.input(z.object({ barcode: z.string().min(1).max(100) }))
	.handler(async ({ input }) => {
		// First check product_barcode table
		const barcodeRows = await db
			.select({
				id: schema.product.id,
				name: schema.product.name,
				price: schema.product.price,
				departmentName: schema.reportingCategory.name,
				isActive: schema.product.isActive,
			})
			.from(schema.productBarcode)
			.innerJoin(
				schema.product,
				eq(schema.productBarcode.productId, schema.product.id),
			)
			.leftJoin(
				schema.reportingCategory,
				eq(schema.product.reportingCategoryId, schema.reportingCategory.id),
			)
			.where(eq(schema.productBarcode.barcode, input.barcode));

		if (barcodeRows.length > 0) {
			return barcodeRows[0]!;
		}

		// Fall back to product.sku
		const skuRows = await db
			.select({
				id: schema.product.id,
				name: schema.product.name,
				price: schema.product.price,
				departmentName: schema.reportingCategory.name,
				isActive: schema.product.isActive,
			})
			.from(schema.product)
			.leftJoin(
				schema.reportingCategory,
				eq(schema.product.reportingCategoryId, schema.reportingCategory.id),
			)
			.where(eq(schema.product.sku, input.barcode));

		if (skuRows.length > 0) {
			return skuRows[0]!;
		}

		throw new ORPCError("NOT_FOUND", {
			message: "No product found for barcode",
		});
	});

export const posRouter = {
	getProducts,
	getModifiers,
	checkout,
	lookupBarcode,
};
