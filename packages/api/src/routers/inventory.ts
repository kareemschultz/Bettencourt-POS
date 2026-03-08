import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gt, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── getStockLevels ──────────────────────────────────────────────────────
// Uses inventory_stock joined with inventory_item and location
const getStockLevels = permissionProcedure("inventory.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
				lowStock: z.boolean().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = [eq(schema.inventoryItem.isActive, true)];

		if (input.locationId) {
			conditions.push(eq(schema.inventoryStock.locationId, input.locationId));
		}

		const query = db
			.select({
				id: schema.inventoryStock.id,
				inventoryItemId: schema.inventoryStock.inventoryItemId,
				locationId: schema.inventoryStock.locationId,
				quantityOnHand: schema.inventoryStock.quantityOnHand,
				lastCountDate: schema.inventoryStock.lastCountDate,
				itemName: schema.inventoryItem.name,
				sku: schema.inventoryItem.sku,
				category: schema.inventoryItem.category,
				unitOfMeasure: schema.inventoryItem.unitOfMeasure,
				reorderPoint: schema.inventoryItem.reorderPoint,
				avgCost: schema.inventoryItem.avgCost,
				locationName: schema.location.name,
			})
			.from(schema.inventoryStock)
			.innerJoin(
				schema.inventoryItem,
				eq(schema.inventoryStock.inventoryItemId, schema.inventoryItem.id),
			)
			.innerJoin(
				schema.location,
				eq(schema.inventoryStock.locationId, schema.location.id),
			)
			.where(and(...conditions))
			.orderBy(asc(schema.inventoryItem.name));

		const inventory = await query;

		// Filter low stock client-side (reorderPoint comparison)
		if (input.lowStock) {
			return inventory.filter(
				(item) => Number(item.quantityOnHand) <= Number(item.reorderPoint || 0),
			);
		}

		return inventory;
	});

// ── getLedger ────────────────────────────────────────────────────────────
const getLedger = permissionProcedure("inventory.read")
	.input(
		z.object({
			inventoryItemId: z.string().uuid().optional(),
			locationId: z.string().uuid().optional(),
			page: z.number().int().min(1).default(1),
			limit: z.number().int().min(1).max(200).default(50),
		}),
	)
	.handler(async ({ input }) => {
		const { inventoryItemId, locationId, page, limit } = input;
		const offset = (page - 1) * limit;

		const conditions = [];
		if (inventoryItemId) {
			conditions.push(eq(schema.stockLedger.inventoryItemId, inventoryItemId));
		}
		if (locationId) {
			conditions.push(eq(schema.stockLedger.locationId, locationId));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const entries = await db
			.select({
				id: schema.stockLedger.id,
				inventoryItemId: schema.stockLedger.inventoryItemId,
				locationId: schema.stockLedger.locationId,
				movementType: schema.stockLedger.movementType,
				quantityChange: schema.stockLedger.quantityChange,
				beforeQuantity: schema.stockLedger.beforeQuantity,
				afterQuantity: schema.stockLedger.afterQuantity,
				userId: schema.stockLedger.userId,
				referenceType: schema.stockLedger.referenceType,
				referenceId: schema.stockLedger.referenceId,
				reason: schema.stockLedger.reason,
				createdAt: schema.stockLedger.createdAt,
				itemName: schema.inventoryItem.name,
				sku: schema.inventoryItem.sku,
				locationName: schema.location.name,
				userName: schema.user.name,
			})
			.from(schema.stockLedger)
			.innerJoin(
				schema.inventoryItem,
				eq(schema.stockLedger.inventoryItemId, schema.inventoryItem.id),
			)
			.innerJoin(
				schema.location,
				eq(schema.stockLedger.locationId, schema.location.id),
			)
			.leftJoin(schema.user, eq(schema.stockLedger.userId, schema.user.id))
			.where(whereClause)
			.orderBy(desc(schema.stockLedger.createdAt))
			.limit(limit)
			.offset(offset);

		return entries;
	});

// ── getCounts ───────────────────────────────────────────────────────────
const getCounts = permissionProcedure("inventory.read")
	.input(
		z.object({
			locationId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const conditions = [];
		if (input.locationId) {
			conditions.push(eq(schema.stockCount.locationId, input.locationId));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const counts = await db
			.select({
				id: schema.stockCount.id,
				organizationId: schema.stockCount.organizationId,
				locationId: schema.stockCount.locationId,
				type: schema.stockCount.type,
				status: schema.stockCount.status,
				createdBy: schema.stockCount.createdBy,
				finalizedBy: schema.stockCount.finalizedBy,
				createdAt: schema.stockCount.createdAt,
				finalizedAt: schema.stockCount.finalizedAt,
				locationName: schema.location.name,
				createdByName: schema.user.name,
			})
			.from(schema.stockCount)
			.innerJoin(
				schema.location,
				eq(schema.stockCount.locationId, schema.location.id),
			)
			.leftJoin(schema.user, eq(schema.stockCount.createdBy, schema.user.id))
			.where(whereClause)
			.orderBy(desc(schema.stockCount.createdAt));

		return counts;
	});

// ── createCount ─────────────────────────────────────────────────────────
const createCount = permissionProcedure("inventory.create")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			locationId: z.string().uuid(),
			createdBy: z.string(),
			type: z.string().default("cycle"),
		}),
	)
	.handler(async ({ input }) => {
		const countRows = await db
			.insert(schema.stockCount)
			.values({
				organizationId: input.organizationId,
				locationId: input.locationId,
				createdBy: input.createdBy,
				type: input.type,
				status: "in_progress",
			})
			.returning({ id: schema.stockCount.id });
		const newCount = countRows[0]!;

		// Pre-populate count lines from current stock
		const stockLevels = await db
			.select({
				inventoryItemId: schema.inventoryStock.inventoryItemId,
				quantityOnHand: schema.inventoryStock.quantityOnHand,
			})
			.from(schema.inventoryStock)
			.innerJoin(
				schema.inventoryItem,
				eq(schema.inventoryStock.inventoryItemId, schema.inventoryItem.id),
			)
			.where(
				and(
					eq(schema.inventoryStock.locationId, input.locationId),
					eq(schema.inventoryItem.isActive, true),
				),
			);

		if (stockLevels.length > 0) {
			await db.insert(schema.stockCountLine).values(
				stockLevels.map((sl) => ({
					stockCountId: newCount.id,
					inventoryItemId: sl.inventoryItemId,
					systemQuantity: sl.quantityOnHand,
				})),
			);
		}

		return { id: newCount.id, items: stockLevels.length };
	});

// ── getPurchaseOrders ───────────────────────────────────────────────────
const getPurchaseOrders = permissionProcedure("inventory.read")
	.input(
		z.object({
			locationId: z.string().uuid().optional(),
			status: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const conditions = [];
		if (input.locationId) {
			conditions.push(eq(schema.purchaseOrder.locationId, input.locationId));
		}
		if (input.status) {
			conditions.push(eq(schema.purchaseOrder.status, input.status));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orders = await db
			.select({
				id: schema.purchaseOrder.id,
				organizationId: schema.purchaseOrder.organizationId,
				locationId: schema.purchaseOrder.locationId,
				supplierId: schema.purchaseOrder.supplierId,
				status: schema.purchaseOrder.status,
				createdBy: schema.purchaseOrder.createdBy,
				notes: schema.purchaseOrder.notes,
				total: schema.purchaseOrder.total,
				createdAt: schema.purchaseOrder.createdAt,
				updatedAt: schema.purchaseOrder.updatedAt,
				supplierName: schema.supplier.name,
				locationName: schema.location.name,
				createdByName: schema.user.name,
			})
			.from(schema.purchaseOrder)
			.innerJoin(
				schema.supplier,
				eq(schema.purchaseOrder.supplierId, schema.supplier.id),
			)
			.innerJoin(
				schema.location,
				eq(schema.purchaseOrder.locationId, schema.location.id),
			)
			.leftJoin(schema.user, eq(schema.purchaseOrder.createdBy, schema.user.id))
			.where(whereClause)
			.orderBy(desc(schema.purchaseOrder.createdAt));

		return orders;
	});

// ── createPurchaseOrder ─────────────────────────────────────────────────
const createPurchaseOrder = permissionProcedure("inventory.create")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			locationId: z.string().uuid(),
			supplierId: z.string().uuid(),
			createdBy: z.string(),
			notes: z.string().nullable().optional(),
			items: z
				.array(
					z.object({
						inventoryItemId: z.string().uuid(),
						quantity: z.string(),
						unitCost: z.string(),
					}),
				)
				.optional()
				.default([]),
		}),
	)
	.handler(async ({ input }) => {
		// Calculate total
		const totalCost = input.items.reduce(
			(sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
			0,
		);

		const poRows = await db
			.insert(schema.purchaseOrder)
			.values({
				organizationId: input.organizationId,
				locationId: input.locationId,
				supplierId: input.supplierId,
				createdBy: input.createdBy,
				status: "draft",
				notes: input.notes ?? null,
				total: totalCost.toFixed(2),
			})
			.returning({ id: schema.purchaseOrder.id });
		const po = poRows[0]!;

		if (input.items.length > 0) {
			await db.insert(schema.purchaseOrderLine).values(
				input.items.map((item) => ({
					purchaseOrderId: po.id,
					inventoryItemId: item.inventoryItemId,
					quantityOrdered: item.quantity,
					unitCost: item.unitCost,
					total: (Number(item.quantity) * Number(item.unitCost)).toFixed(2),
				})),
			);
		}

		return { id: po.id };
	});

// ── getTransfers ────────────────────────────────────────────────────────
const getTransfers = permissionProcedure("inventory.read")
	.input(
		z.object({
			locationId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input }) => {
		// Use raw SQL for the OR condition on from/to location
		if (input.locationId) {
			const transfers = await db.execute(
				sql`SELECT t.*,
					fl.name as from_location_name,
					tl.name as to_location_name,
					u.name as created_by_name
				FROM transfer t
				JOIN location fl ON t.from_location_id = fl.id
				JOIN location tl ON t.to_location_id = tl.id
				LEFT JOIN "user" u ON t.created_by = u.id
				WHERE t.from_location_id = ${input.locationId}
					OR t.to_location_id = ${input.locationId}
				ORDER BY t.created_at DESC`,
			);
			return transfers.rows;
		}

		const transfers = await db.execute(
			sql`SELECT t.*,
				fl.name as from_location_name,
				tl.name as to_location_name,
				u.name as created_by_name
			FROM transfer t
			JOIN location fl ON t.from_location_id = fl.id
			JOIN location tl ON t.to_location_id = tl.id
			LEFT JOIN "user" u ON t.created_by = u.id
			ORDER BY t.created_at DESC`,
		);
		return transfers.rows;
	});

// ── createTransfer ──────────────────────────────────────────────────────
const createTransfer = permissionProcedure("inventory.create")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			fromLocationId: z.string().uuid(),
			toLocationId: z.string().uuid(),
			createdBy: z.string(),
			notes: z.string().nullable().optional(),
			items: z
				.array(
					z.object({
						inventoryItemId: z.string().uuid(),
						quantity: z.string(),
					}),
				)
				.optional()
				.default([]),
		}),
	)
	.handler(async ({ input }) => {
		const transferRows = await db
			.insert(schema.transfer)
			.values({
				organizationId: input.organizationId,
				fromLocationId: input.fromLocationId,
				toLocationId: input.toLocationId,
				createdBy: input.createdBy,
				status: "pending",
				notes: input.notes ?? null,
			})
			.returning({ id: schema.transfer.id });
		const newTransfer = transferRows[0]!;

		if (input.items.length > 0) {
			await db.insert(schema.transferLine).values(
				input.items.map((item) => ({
					transferId: newTransfer.id,
					inventoryItemId: item.inventoryItemId,
					quantity: item.quantity,
				})),
			);
		}

		return { id: newTransfer.id };
	});

// ── getAlerts ───────────────────────────────────────────────────────────
// Returns items below reorder point, along with any existing stock alert rows
const getAlerts = permissionProcedure("inventory.read")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			unacknowledgedOnly: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const orgId = input.organizationId;

		// Get all active inventory items with their total stock across locations
		const items = await db
			.select({
				id: schema.inventoryItem.id,
				name: schema.inventoryItem.name,
				sku: schema.inventoryItem.sku,
				reorderPoint: schema.inventoryItem.reorderPoint,
				preferredSupplierId: schema.inventoryItem.preferredSupplierId,
				currentStock: sql<string>`COALESCE(SUM(${schema.inventoryStock.quantityOnHand}), 0)`,
			})
			.from(schema.inventoryItem)
			.leftJoin(
				schema.inventoryStock,
				eq(schema.inventoryItem.id, schema.inventoryStock.inventoryItemId),
			)
			.where(
				and(
					eq(schema.inventoryItem.organizationId, orgId),
					eq(schema.inventoryItem.isActive, true),
					gt(schema.inventoryItem.reorderPoint, "0"),
				),
			)
			.groupBy(schema.inventoryItem.id)
			.having(
				sql`COALESCE(SUM(${schema.inventoryStock.quantityOnHand}), 0) <= ${schema.inventoryItem.reorderPoint}`,
			);

		// Get existing alert rows for these items
		const alertRows =
			items.length > 0
				? await db
						.select({
							id: schema.stockAlert.id,
							inventoryItemId: schema.stockAlert.inventoryItemId,
							type: schema.stockAlert.type,
							acknowledgedBy: schema.stockAlert.acknowledgedBy,
							acknowledgedAt: schema.stockAlert.acknowledgedAt,
							createdAt: schema.stockAlert.createdAt,
						})
						.from(schema.stockAlert)
						.where(eq(schema.stockAlert.organizationId, orgId))
						.orderBy(desc(schema.stockAlert.createdAt))
				: [];

		// Map alerts by inventoryItemId (latest alert per item)
		const alertMap = new Map<string, (typeof alertRows)[number]>();
		for (const a of alertRows) {
			if (!alertMap.has(a.inventoryItemId)) {
				alertMap.set(a.inventoryItemId, a);
			}
		}

		const results = items.map((item) => {
			const currentStock = Number(item.currentStock);
			const reorderPoint = Number(item.reorderPoint);
			const alert = alertMap.get(item.id);
			return {
				inventoryItemId: item.id,
				name: item.name,
				sku: item.sku,
				currentStock,
				reorderPoint,
				preferredSupplierId: item.preferredSupplierId,
				alertType: currentStock === 0 ? "out_of_stock" : "low_stock",
				alertId: alert?.id ?? null,
				acknowledgedBy: alert?.acknowledgedBy ?? null,
				acknowledgedAt: alert?.acknowledgedAt ?? null,
				alertCreatedAt: alert?.createdAt ?? null,
			};
		});

		if (input.unacknowledgedOnly) {
			return results.filter((r) => !r.acknowledgedBy);
		}

		return results;
	});

// ── acknowledgeAlert ────────────────────────────────────────────────────
const acknowledgeAlert = permissionProcedure("inventory.update")
	.input(
		z.object({
			inventoryItemId: z.string().uuid(),
			organizationId: z.string().uuid(),
		}),
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		// Find existing unacknowledged alert for this item
		const existing = await db
			.select({ id: schema.stockAlert.id })
			.from(schema.stockAlert)
			.where(
				and(
					eq(schema.stockAlert.inventoryItemId, input.inventoryItemId),
					eq(schema.stockAlert.organizationId, input.organizationId),
					isNull(schema.stockAlert.acknowledgedBy),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			// Update existing alert
			await db
				.update(schema.stockAlert)
				.set({
					acknowledgedBy: userId,
					acknowledgedAt: new Date(),
				})
				.where(eq(schema.stockAlert.id, existing[0]!.id));
			return { id: existing[0]!.id };
		}

		// Create a new alert row and immediately acknowledge it
		const rows = await db
			.insert(schema.stockAlert)
			.values({
				inventoryItemId: input.inventoryItemId,
				organizationId: input.organizationId,
				type: "low_stock",
				acknowledgedBy: userId,
				acknowledgedAt: new Date(),
			})
			.returning({ id: schema.stockAlert.id });

		return { id: rows[0]?.id };
	});

// ── autoGeneratePO ──────────────────────────────────────────────────────
// Creates purchase orders grouped by preferredSupplierId from alert items
const autoGeneratePO = permissionProcedure("inventory.create")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			locationId: z.string().uuid(),
			items: z.array(
				z.object({
					inventoryItemId: z.string().uuid(),
					preferredSupplierId: z.string().uuid().nullable(),
					quantity: z.string(),
					unitCost: z.string(),
				}),
			),
		}),
	)
	.handler(async ({ input, context }) => {
		const createdBy = context.session.user.id;
		// Group items by supplier
		const grouped = new Map<
			string,
			{ inventoryItemId: string; quantity: string; unitCost: string }[]
		>();
		for (const item of input.items) {
			const supplierId = item.preferredSupplierId ?? "unassigned";
			if (supplierId === "unassigned") continue;
			const group = grouped.get(supplierId) ?? [];
			group.push({
				inventoryItemId: item.inventoryItemId,
				quantity: item.quantity,
				unitCost: item.unitCost,
			});
			grouped.set(supplierId, group);
		}

		if (grouped.size === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No items with assigned suppliers",
			});
		}

		const createdPOs: string[] = [];

		for (const [supplierId, items] of grouped) {
			const totalCost = items.reduce(
				(sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
				0,
			);

			const poRows = await db
				.insert(schema.purchaseOrder)
				.values({
					organizationId: input.organizationId,
					locationId: input.locationId,
					supplierId,
					createdBy,
					status: "draft",
					notes: "Auto-generated from stock alerts",
					total: totalCost.toFixed(2),
				})
				.returning({ id: schema.purchaseOrder.id });

			const po = poRows[0]!;

			await db.insert(schema.purchaseOrderLine).values(
				items.map((item) => ({
					purchaseOrderId: po.id,
					inventoryItemId: item.inventoryItemId,
					quantityOrdered: item.quantity,
					unitCost: item.unitCost,
					total: (Number(item.quantity) * Number(item.unitCost)).toFixed(2),
				})),
			);

			createdPOs.push(po.id);
		}

		return { purchaseOrderIds: createdPOs, count: createdPOs.length };
	});

// ── getReorderSettings ─────────────────────────────────────────────────
const getReorderSettings = permissionProcedure("inventory.read")
	.input(
		z.object({
			inventoryItemId: z.string().uuid(),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.select({
				id: schema.inventoryItem.id,
				reorderPoint: schema.inventoryItem.reorderPoint,
				preferredSupplierId: schema.inventoryItem.preferredSupplierId,
				supplierName: schema.supplier.name,
			})
			.from(schema.inventoryItem)
			.leftJoin(
				schema.supplier,
				eq(schema.inventoryItem.preferredSupplierId, schema.supplier.id),
			)
			.where(eq(schema.inventoryItem.id, input.inventoryItemId))
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Inventory item not found",
			});
		}

		return rows[0]!;
	});

// ── updateReorderSettings ──────────────────────────────────────────────
const updateReorderSettings = permissionProcedure("inventory.update")
	.input(
		z.object({
			inventoryItemId: z.string().uuid(),
			reorderPoint: z.string(),
			preferredSupplierId: z.string().uuid().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const updates: Record<string, unknown> = {
			reorderPoint: input.reorderPoint,
		};

		if (input.preferredSupplierId !== undefined) {
			updates.preferredSupplierId = input.preferredSupplierId;
		}

		await db
			.update(schema.inventoryItem)
			.set(updates)
			.where(eq(schema.inventoryItem.id, input.inventoryItemId));

		return { success: true };
	});

// ── logWaste ────────────────────────────────────────────────────────────
const logWaste = permissionProcedure("inventory.create")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			inventoryItemId: z.string().uuid().optional(),
			productName: z.string().min(1),
			quantity: z.string(),
			unit: z.string().min(1),
			estimatedCost: z.string(),
			reason: z.enum(["spoilage", "over_prep", "expired", "dropped", "other"]),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const loggedBy = context.session.user.id;
		let productName = input.productName;
		let estimatedCost = input.estimatedCost;

		// Auto-fill from inventory item if provided
		if (input.inventoryItemId) {
			const item = await db
				.select({
					name: schema.inventoryItem.name,
					avgCost: schema.inventoryItem.avgCost,
				})
				.from(schema.inventoryItem)
				.where(eq(schema.inventoryItem.id, input.inventoryItemId))
				.limit(1);

			if (item.length > 0) {
				productName = item[0]!.name;
				// Use avgCost * quantity if no cost provided or cost is zero
				if (!input.estimatedCost || input.estimatedCost === "0") {
					const cost = Number(item[0]?.avgCost || 0) * Number(input.quantity);
					estimatedCost = cost.toFixed(2);
				}
			}
		}

		const rows = await db
			.insert(schema.wasteLog)
			.values({
				organizationId: input.organizationId,
				inventoryItemId: input.inventoryItemId ?? null,
				productName,
				quantity: input.quantity,
				unit: input.unit,
				estimatedCost,
				reason: input.reason,
				notes: input.notes ?? null,
				loggedBy: loggedBy,
			})
			.returning({ id: schema.wasteLog.id });

		return { id: rows[0]?.id };
	});

// ── getWasteLog ─────────────────────────────────────────────────────────
const getWasteLog = permissionProcedure("inventory.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
			reason: z.string().optional(),
			inventoryItemId: z.string().uuid().optional(),
			page: z.number().int().min(1).default(1),
			limit: z.number().int().min(1).max(200).default(50),
		}),
	)
	.handler(async ({ input }) => {
		const { startDate, endDate, page, limit } = input;
		const offset = (page - 1) * limit;

		const conditions = [
			gte(schema.wasteLog.createdAt, new Date(startDate)),
			lte(schema.wasteLog.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
		];

		if (input.reason) {
			conditions.push(eq(schema.wasteLog.reason, input.reason));
		}
		if (input.inventoryItemId) {
			conditions.push(
				eq(schema.wasteLog.inventoryItemId, input.inventoryItemId),
			);
		}

		const entries = await db
			.select({
				id: schema.wasteLog.id,
				organizationId: schema.wasteLog.organizationId,
				inventoryItemId: schema.wasteLog.inventoryItemId,
				productName: schema.wasteLog.productName,
				quantity: schema.wasteLog.quantity,
				unit: schema.wasteLog.unit,
				estimatedCost: schema.wasteLog.estimatedCost,
				reason: schema.wasteLog.reason,
				notes: schema.wasteLog.notes,
				loggedBy: schema.wasteLog.loggedBy,
				createdAt: schema.wasteLog.createdAt,
				userName: schema.user.name,
			})
			.from(schema.wasteLog)
			.leftJoin(schema.user, eq(schema.wasteLog.loggedBy, schema.user.id))
			.where(and(...conditions))
			.orderBy(desc(schema.wasteLog.createdAt))
			.limit(limit)
			.offset(offset);

		return entries;
	});

// ── getWasteSummary ─────────────────────────────────────────────────────
const getWasteSummary = permissionProcedure("inventory.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const { startDate, endDate } = input;

		const [totalsResult, byReasonResult, topItemsResult, dailyTrendResult] =
			await Promise.all([
				// Total waste cost and count
				db.execute(
					sql`SELECT
						COALESCE(SUM(estimated_cost::numeric), 0)::numeric as total_waste_cost,
						COUNT(*)::int as waste_count
					FROM waste_log
					WHERE created_at >= ${startDate}::date
						AND created_at < (${endDate}::date + INTERVAL '1 day')`,
				),
				// By reason
				db.execute(
					sql`SELECT
						reason,
						COUNT(*)::int as count,
						COALESCE(SUM(estimated_cost::numeric), 0)::numeric as cost
					FROM waste_log
					WHERE created_at >= ${startDate}::date
						AND created_at < (${endDate}::date + INTERVAL '1 day')
					GROUP BY reason
					ORDER BY cost DESC`,
				),
				// Top 10 items by cost
				db.execute(
					sql`SELECT
						product_name,
						COUNT(*)::int as count,
						COALESCE(SUM(estimated_cost::numeric), 0)::numeric as cost
					FROM waste_log
					WHERE created_at >= ${startDate}::date
						AND created_at < (${endDate}::date + INTERVAL '1 day')
					GROUP BY product_name
					ORDER BY cost DESC
					LIMIT 10`,
				),
				// Daily trend
				db.execute(
					sql`SELECT
						DATE(created_at AT TIME ZONE 'America/Guyana') as date,
						COALESCE(SUM(estimated_cost::numeric), 0)::numeric as cost,
						COUNT(*)::int as count
					FROM waste_log
					WHERE created_at >= ${startDate}::date
						AND created_at < (${endDate}::date + INTERVAL '1 day')
					GROUP BY DATE(created_at AT TIME ZONE 'America/Guyana')
					ORDER BY date ASC`,
				),
			]);

		const totals = totalsResult.rows[0] as Record<string, unknown>;

		return {
			totalWasteCost: Number(totals.total_waste_cost) || 0,
			wasteCount: Number(totals.waste_count) || 0,
			byReason: (byReasonResult.rows as Record<string, unknown>[]).map((r) => ({
				reason: String(r.reason),
				count: Number(r.count) || 0,
				cost: Number(r.cost) || 0,
			})),
			topItems: (topItemsResult.rows as Record<string, unknown>[]).map((r) => ({
				productName: String(r.product_name),
				count: Number(r.count) || 0,
				cost: Number(r.cost) || 0,
			})),
			dailyTrend: (dailyTrendResult.rows as Record<string, unknown>[]).map(
				(r) => ({
					date: String(r.date),
					cost: Number(r.cost) || 0,
					count: Number(r.count) || 0,
				}),
			),
		};
	});

// ── getWasteByDepartment ────────────────────────────────────────────────
const getWasteByDepartment = permissionProcedure("inventory.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const { startDate, endDate } = input;

		const result = await db.execute(
			sql`SELECT
				COALESCE(rc.name, 'Uncategorized') as department_name,
				COUNT(wl.id)::int as waste_count,
				COALESCE(SUM(wl.estimated_cost::numeric), 0)::numeric as waste_cost
			FROM waste_log wl
			LEFT JOIN inventory_item ii ON wl.inventory_item_id = ii.id
			LEFT JOIN product p ON p.name = wl.product_name
			LEFT JOIN reporting_category rc ON p.reporting_category_id = rc.id
			WHERE wl.created_at >= ${startDate}::date
				AND wl.created_at < (${endDate}::date + INTERVAL '1 day')
			GROUP BY rc.name
			ORDER BY waste_cost DESC`,
		);

		return (result.rows as Record<string, unknown>[]).map((r) => ({
			departmentName: String(r.department_name),
			wasteCount: Number(r.waste_count) || 0,
			wasteCost: Number(r.waste_cost) || 0,
		}));
	});

// ── updateWaste ─────────────────────────────────────────────────────────
const updateWaste = permissionProcedure("inventory.update")
	.input(
		z.object({
			id: z.string().uuid(),
			productName: z.string().min(1),
			quantity: z.string(),
			unit: z.string().min(1),
			estimatedCost: z.string(),
			reason: z.enum(["spoilage", "over_prep", "expired", "dropped", "other"]),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		await db
			.update(schema.wasteLog)
			.set({
				productName: input.productName,
				quantity: input.quantity,
				unit: input.unit,
				estimatedCost: input.estimatedCost,
				reason: input.reason,
				notes: input.notes ?? null,
			})
			.where(eq(schema.wasteLog.id, input.id));

		return { status: "updated" };
	});

// ── deleteWaste ─────────────────────────────────────────────────────────
const deleteWaste = permissionProcedure("inventory.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db.delete(schema.wasteLog).where(eq(schema.wasteLog.id, input.id));
		return { status: "deleted" };
	});

export const inventoryRouter = {
	getStockLevels,
	getLedger,
	getCounts,
	createCount,
	getPurchaseOrders,
	createPurchaseOrder,
	getTransfers,
	createTransfer,
	getAlerts,
	acknowledgeAlert,
	autoGeneratePO,
	getReorderSettings,
	updateReorderSettings,
	logWaste,
	updateWaste,
	deleteWaste,
	getWasteLog,
	getWasteSummary,
	getWasteByDepartment,
};
