import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { createAuditLog } from "../lib/audit";
import { emitKitchenEvent } from "../lib/kitchen-events";
import { requireOrganizationId } from "../lib/org-context";
import { emitPosEvent } from "../lib/pos-events";
import { printService } from "../lib/print-service";

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
				limit: z.number().int().positive().max(1000).default(500),
				offset: z.number().int().nonnegative().default(0),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? { limit: 500, offset: 0 };
		const orgId = requireOrganizationId(context);
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
		let departments: {
			id: string;
			name: string;
			sortOrder: number | null;
			pinProtected: boolean;
		}[] = [];
		if (departmentFilter.length > 0) {
			departments = await db
				.select({
					id: schema.reportingCategory.id,
					name: schema.reportingCategory.name,
					sortOrder: schema.reportingCategory.sortOrder,
					pinProtected: schema.reportingCategory.pinProtected,
				})
				.from(schema.reportingCategory)
				.where(
					and(
						eq(schema.reportingCategory.isActive, true),
						eq(schema.reportingCategory.organizationId, orgId),
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
					pinProtected: schema.reportingCategory.pinProtected,
				})
				.from(schema.reportingCategory)
				.where(
					and(
						eq(schema.reportingCategory.isActive, true),
						eq(schema.reportingCategory.organizationId, orgId),
					),
				)
				.orderBy(
					asc(schema.reportingCategory.sortOrder),
					asc(schema.reportingCategory.name),
				);
		}

		// Build product filter conditions
		const conditions = [
			eq(schema.product.isActive, true),
			eq(schema.product.organizationId, orgId),
		];
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
			.orderBy(asc(schema.product.sortOrder), asc(schema.product.name))
			.limit(input.limit)
			.offset(input.offset);

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

		// Fetch org default tax rate for VAT-inclusive display
		const defaultTaxRows = await db
			.select({ rate: schema.taxRate.rate, name: schema.taxRate.name })
			.from(schema.taxRate)
			.where(
				and(
					eq(schema.taxRate.organizationId, orgId),
					eq(schema.taxRate.isDefault, true),
					eq(schema.taxRate.isActive, true),
				),
			)
			.limit(1);
		const defaultTaxRate =
			defaultTaxRows.length > 0 ? Number(defaultTaxRows[0]!.rate) : 0;
		const defaultTaxName =
			defaultTaxRows.length > 0 ? (defaultTaxRows[0]!.name ?? "Tax") : "Tax";

		return {
			departments,
			products: productsWithCombos,
			defaultTaxRate,
			defaultTaxName,
		};
	});

// ── getModifiers ────────────────────────────────────────────────────────
const getModifiers = permissionProcedure("orders.read")
	.input(z.object({ productId: z.string().uuid().optional() }).optional())
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		if (!input.productId) {
			return { groups: [] };
		}

		// Verify the product belongs to this org before returning modifiers
		const productRow = await db
			.select({ id: schema.product.id })
			.from(schema.product)
			.where(
				and(
					eq(schema.product.id, input.productId),
					eq(schema.product.organizationId, orgId),
				),
			)
			.limit(1);
		if (productRow.length === 0) {
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
					courseNumber: z.number().int().min(1).default(1),
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
			tableId: z.string().uuid().nullable().optional(),
			notes: z.string().nullable().optional(),
			tabName: z.string().nullable().optional(),
			tipAmount: z.number().min(0).default(0),
			discountTotal: z.number().min(0).default(0),
			customerId: z.string().uuid().nullable().optional(),
			customerName: z.string().nullable().optional(),
			customerPhone: z.string().nullable().optional(),
			deliveryAddress: z.string().nullable().optional(),
			estimatedReadyAt: z.string().nullable().optional(),
			fulfillmentStatus: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const {
			items: rawItems,
			payments,
			orderType,
			locationId,
			registerId,
			tableId,
			notes,
			tabName,
			tipAmount,
			discountTotal,
			customerId,
			customerName,
			customerPhone,
			deliveryAddress,
			estimatedReadyAt,
			fulfillmentStatus,
		} = input;
		const items = rawItems.map((i) => ({ ...i }));
		const organizationId = requireOrganizationId(context);
		const actorUserId = context.session.user.id;

		if (!items || items.length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "No items" });
		}

		// F-004: Validate and override client-supplied prices with server-canonical values
		{
			const nonComboItems = items.filter((item) => !item.isCombo);
			if (nonComboItems.length > 0) {
				const productIds = [...new Set(nonComboItems.map((i) => i.productId))];
				const dbProducts = await db
					.select({
						id: schema.product.id,
						price: schema.product.price,
						taxRate: schema.product.taxRate,
					})
					.from(schema.product)
					.where(
						and(
							inArray(schema.product.id, productIds),
							eq(schema.product.organizationId, organizationId),
						),
					);

				const priceMap = new Map(dbProducts.map((p) => [p.id, p]));
				for (const item of items) {
					if (item.isCombo) continue;
					const dbProduct = priceMap.get(item.productId);
					if (!dbProduct) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Product not found: ${item.productId}`,
						});
					}
					const serverPrice = Number(dbProduct.price);
					const serverTax = Number(dbProduct.taxRate);
					if (Math.abs(item.unitPrice - serverPrice) > 0.01) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Price mismatch for product ${item.productId}: expected ${serverPrice}, got ${item.unitPrice}`,
						});
					}
					// Validate taxRate only when client sends a non-zero value (VAT-exclusive mode).
					// taxRate=0 is accepted for VAT-inclusive pricing where tax is baked into the price.
					if (
						item.taxRate > 0.001 &&
						Math.abs(item.taxRate - serverTax) > 0.001
					) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Tax rate mismatch for product ${item.productId}: expected ${serverTax}, got ${item.taxRate}`,
						});
					}
					// Override with server-canonical values
					item.unitPrice = serverPrice;
					if (item.taxRate > 0.001) item.taxRate = serverTax;
				}
			}
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
		const grossTotal = subtotal + taxTotal;
		const totalWithTip = grossTotal - discountTotal + tipAmount;
		if (discountTotal > grossTotal + 0.01) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Discount (${discountTotal.toFixed(2)}) cannot exceed subtotal + tax (${grossTotal.toFixed(2)})`,
			});
		}
		const total = Math.max(0, totalWithTip);

		// Validate payment sum covers order total
		const paymentSum = payments.reduce((s, p) => s + p.amount, 0);
		if (paymentSum < total - 0.01) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Payment total (${paymentSum.toFixed(2)}) is less than order total (${total.toFixed(2)})`,
			});
		}

		// F-007: Pre-validate gift card balances before opening the transaction
		{
			const gcPayments = payments.filter(
				(p) => p.method === "gift_card" && p.reference,
			);
			if (gcPayments.length > 0) {
				let gcRemaining = total;
				for (const pmt of payments) {
					const allocated = Math.min(pmt.amount, gcRemaining);
					gcRemaining -= allocated;
					if (pmt.method === "gift_card" && pmt.reference) {
						const gcRows = await db
							.select({
								id: schema.giftCard.id,
								currentBalance: schema.giftCard.currentBalance,
								isActive: schema.giftCard.isActive,
							})
							.from(schema.giftCard)
							.where(
								and(
									eq(schema.giftCard.code, pmt.reference.toUpperCase()),
									eq(schema.giftCard.organizationId, organizationId),
								),
							)
							.limit(1);
						if (gcRows.length === 0 || !gcRows[0]!.isActive) {
							throw new ORPCError("BAD_REQUEST", {
								message: `Gift card not found or inactive: ${pmt.reference}`,
							});
						}
						if (Number(gcRows[0]!.currentBalance) < allocated - 0.01) {
							throw new ORPCError("BAD_REQUEST", {
								message: `Insufficient gift card balance for card ${pmt.reference}`,
							});
						}
					}
				}
			}
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
					userId: actorUserId,
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
					tipAmount: tipAmount.toFixed(2),
					tabName: tabName ?? null,
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
			const lineItemIdByIndex = new Map<number, string>();
			for (let _itemIdx = 0; _itemIdx < items.length; _itemIdx++) {
				const item = items[_itemIdx]!;
				const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
				const lineTotal = (item.unitPrice + modifierTotal) * item.quantity;
				const taxAmount = lineTotal * item.taxRate;

				// Insert the main line item
				const [lineItemRow] = await tx
					.insert(schema.orderLineItem)
					.values({
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
						courseNumber: item.courseNumber ?? 1,
					})
					.returning({ id: schema.orderLineItem.id });
				if (lineItemRow) lineItemIdByIndex.set(_itemIdx, lineItemRow.id);

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
			let tipRemaining = tipAmount;
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
				const tipAllocated = Math.min(tipRemaining, allocated);
				tipRemaining -= tipAllocated;

				await tx.insert(schema.payment).values({
					orderId: createdOrder.id,
					method: pmt.method,
					amount: allocated.toFixed(2),
					tendered: tendered?.toFixed(2) ?? null,
					changeGiven: changeGiven.toFixed(2),
					tipAmount: tipAllocated.toFixed(2),
					reference: pmt.reference ?? null,
					status: "completed",
				});
			}

			// F-007: Debit gift card balances atomically inside transaction
			{
				let gcRemainingTx = total;
				for (const pmt of payments) {
					const allocatedTx = Math.min(pmt.amount, gcRemainingTx);
					gcRemainingTx -= allocatedTx;
					if (pmt.method === "gift_card" && pmt.reference && allocatedTx > 0) {
						const updated = await tx
							.update(schema.giftCard)
							.set({
								currentBalance: sql`current_balance - ${allocatedTx.toFixed(2)}::numeric`,
							})
							.where(
								and(
									eq(schema.giftCard.code, pmt.reference.toUpperCase()),
									eq(schema.giftCard.organizationId, organizationId),
									sql`current_balance >= ${allocatedTx.toFixed(2)}::numeric`,
								),
							)
							.returning({
								id: schema.giftCard.id,
								currentBalance: schema.giftCard.currentBalance,
							});
						if (updated.length === 0) {
							throw new ORPCError("BAD_REQUEST", {
								message:
									"Gift card balance insufficient (concurrent modification)",
							});
						}
						await tx.insert(schema.giftCardTransaction).values({
							giftCardId: updated[0]!.id,
							orderId: createdOrder.id,
							type: "redeem",
							amount: allocatedTx.toFixed(2),
							balanceAfter: updated[0]!.currentBalance!,
							processedBy: actorUserId,
						});
					}
				}
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
			for (let _kitIdx = 0; _kitIdx < items.length; _kitIdx++) {
				const item = items[_kitIdx]!;
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
					orderLineItemId: lineItemIdByIndex.get(_kitIdx) ?? null,
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
			const userRows = await tx
				.select({ name: schema.user.name })
				.from(schema.user)
				.where(eq(schema.user.id, actorUserId));
			if (userRows.length > 0) userName = userRows[0]!.name;

			return {
				organizationId,
				locationId,
				printedItems: items.map((item) => ({
					name: item.productName,
					quantity: item.quantity,
					courseNumber: item.courseNumber,
					notes: item.notes ?? null,
					modifiers: item.modifiers.map((m) => m.name),
					reportingCategoryName: item.department ?? null,
				})),
				order: {
					id: createdOrder.id,
					orderNumber: createdOrder.orderNumber,
					dailyNumber: dailyNum,
					total: Number(createdOrder.total),
					tipAmount,
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
		if (creditPayment) {
			const invoiceNumber = await nextInvoiceNumber(organizationId);
			await db.insert(schema.invoice).values({
				organizationId,
				locationId,
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
				createdBy: actorUserId,
			});
		}

		// Audit log — runs after transaction commits so it's not rolled back with failed orders
		await createAuditLog({
			userId: actorUserId,
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

		try {
			const printTargets = await printService.dispatch({
				type: "kitchen_ticket",
				organizationId: result.organizationId,
				locationId: result.locationId,
				orderId: result.order.id,
				orderNumber: result.order.orderNumber,
				station: "kitchen",
				items: result.printedItems,
				timestamp: new Date(),
			});
			emitKitchenEvent({
				type: "ticket:printed",
				ticketId: result.ticketId,
				orderId: result.order.id,
				targets: printTargets.map((t) => t.printerName),
			});
		} catch (err) {
			console.error("[pos] Print dispatch failed:", err);
		}

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

// ── toggle86 (mark item as unavailable / available) ─────────────────────
const toggle86 = permissionProcedure("orders.update")
	.input(
		z.object({
			productId: z.string().uuid(),
			locationId: z.string().uuid(),
			isAvailable: z.boolean(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { productId, locationId, isAvailable } = input;

		// Upsert productLocation row
		await db
			.insert(schema.productLocation)
			.values({ productId, locationId, isAvailable })
			.onConflictDoUpdate({
				target: [
					schema.productLocation.productId,
					schema.productLocation.locationId,
				],
				set: { isAvailable },
			});

		// Get product name for the broadcast
		const productRows = await db
			.select({ name: schema.product.name })
			.from(schema.product)
			.where(eq(schema.product.id, productId))
			.limit(1);
		const productName = productRows[0]?.name ?? "Unknown";

		// Audit log
		await createAuditLog({
			userId: context.session.user.id,
			entityType: "product_location",
			entityId: productId,
			actionType: "update",
			afterData: { productId, locationId, isAvailable, productName },
			locationId,
		});

		emitPosEvent({
			type: "product:86",
			productId,
			locationId,
			isAvailable,
			productName,
		});

		return { productId, locationId, isAvailable, productName };
	});

export const posRouter = {
	getProducts,
	getModifiers,
	checkout,
	lookupBarcode,
	toggle86,
};
