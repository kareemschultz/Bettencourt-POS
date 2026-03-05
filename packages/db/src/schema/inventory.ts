import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization, location } from "./organization";

// ── Supplier ───────────────────────────────────────────────────────────

export const supplier = pgTable(
	"supplier",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		contactName: text("contact_name"),
		email: text("email"),
		phone: text("phone"),
		address: text("address"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("idx_supplier_org").on(table.organizationId)],
);

// ── Inventory Item ─────────────────────────────────────────────────────

export const inventoryItem = pgTable(
	"inventory_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		sku: text("sku").notNull(),
		name: text("name").notNull(),
		category: text("category"),
		unitOfMeasure: text("unit_of_measure").notNull().default("each"),
		unitConversionFactor: numeric("unit_conversion_factor", { precision: 10, scale: 4 }).default(
			"1",
		),
		preferredSupplierId: uuid("preferred_supplier_id").references(() => supplier.id, {
			onDelete: "set null",
		}),
		reorderPoint: numeric("reorder_point", { precision: 10, scale: 2 }).default("0"),
		minLevel: numeric("min_level", { precision: 10, scale: 2 }).default("0"),
		maxLevel: numeric("max_level", { precision: 10, scale: 2 }).default("0"),
		binLocation: text("bin_location"),
		lotTracking: boolean("lot_tracking").notNull().default(false),
		expiryTracking: boolean("expiry_tracking").notNull().default(false),
		serialTracking: boolean("serial_tracking").notNull().default(false),
		avgCost: numeric("avg_cost", { precision: 10, scale: 4 }).default("0"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_inventory_item_org").on(table.organizationId),
		index("idx_inventory_item_sku").on(table.sku),
		index("idx_inventory_item_supplier").on(table.preferredSupplierId),
	],
);

// ── Inventory Item Barcode ─────────────────────────────────────────────

export const inventoryItemBarcode = pgTable(
	"inventory_item_barcode",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id, { onDelete: "cascade" }),
		barcode: text("barcode").notNull(),
	},
	(table) => [
		index("idx_inv_barcode_item").on(table.inventoryItemId),
		index("idx_inv_barcode_barcode").on(table.barcode),
	],
);

// ── Inventory Stock ────────────────────────────────────────────────────

export const inventoryStock = pgTable(
	"inventory_stock",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		quantityOnHand: numeric("quantity_on_hand", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		lastCountDate: timestamp("last_count_date", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("idx_inventory_stock_item_location").on(
			table.inventoryItemId,
			table.locationId,
		),
	],
);

// ── Stock Ledger ───────────────────────────────────────────────────────

export const stockLedger = pgTable(
	"stock_ledger",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		movementType: text("movement_type").notNull(),
		quantityChange: numeric("quantity_change", { precision: 10, scale: 2 }).notNull(),
		beforeQuantity: numeric("before_quantity", { precision: 10, scale: 2 }).notNull(),
		afterQuantity: numeric("after_quantity", { precision: 10, scale: 2 }).notNull(),
		userId: text("user_id").references(() => user.id),
		referenceType: text("reference_type"),
		referenceId: uuid("reference_id"),
		reason: text("reason"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_stock_ledger_item").on(table.inventoryItemId),
		index("idx_stock_ledger_location").on(table.locationId),
		index("idx_stock_ledger_created").on(table.createdAt),
	],
);

// ── Purchase Order ─────────────────────────────────────────────────────

export const purchaseOrder = pgTable(
	"purchase_order",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		supplierId: uuid("supplier_id")
			.notNull()
			.references(() => supplier.id),
		status: text("status").notNull().default("draft"),
		createdBy: text("created_by").references(() => user.id),
		approvedBy: text("approved_by").references(() => user.id),
		notes: text("notes"),
		total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_purchase_order_org").on(table.organizationId),
		index("idx_purchase_order_supplier").on(table.supplierId),
		index("idx_purchase_order_status").on(table.status),
	],
);

// ── Purchase Order Line ────────────────────────────────────────────────

export const purchaseOrderLine = pgTable(
	"purchase_order_line",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		purchaseOrderId: uuid("purchase_order_id")
			.notNull()
			.references(() => purchaseOrder.id, { onDelete: "cascade" }),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id),
		quantityOrdered: numeric("quantity_ordered", { precision: 10, scale: 2 }).notNull(),
		quantityReceived: numeric("quantity_received", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		unitCost: numeric("unit_cost", { precision: 10, scale: 4 }).notNull(),
		total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
	},
	(table) => [index("idx_po_line_po").on(table.purchaseOrderId)],
);

// ── Goods Receipt ──────────────────────────────────────────────────────

export const goodsReceipt = pgTable(
	"goods_receipt",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		purchaseOrderId: uuid("purchase_order_id")
			.notNull()
			.references(() => purchaseOrder.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id),
		receivedBy: text("received_by").references(() => user.id),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_goods_receipt_po").on(table.purchaseOrderId)],
);

// ── Goods Receipt Line ─────────────────────────────────────────────────

export const goodsReceiptLine = pgTable(
	"goods_receipt_line",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		goodsReceiptId: uuid("goods_receipt_id")
			.notNull()
			.references(() => goodsReceipt.id, { onDelete: "cascade" }),
		purchaseOrderLineId: uuid("purchase_order_line_id")
			.notNull()
			.references(() => purchaseOrderLine.id),
		quantityReceived: numeric("quantity_received", { precision: 10, scale: 2 }).notNull(),
		lotNumber: text("lot_number"),
		expiryDate: date("expiry_date"),
	},
	(table) => [index("idx_gr_line_receipt").on(table.goodsReceiptId)],
);

// ── Transfer ───────────────────────────────────────────────────────────

export const transfer = pgTable(
	"transfer",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		fromLocationId: uuid("from_location_id")
			.notNull()
			.references(() => location.id),
		toLocationId: uuid("to_location_id")
			.notNull()
			.references(() => location.id),
		status: text("status").notNull().default("draft"),
		createdBy: text("created_by").references(() => user.id),
		approvedBy: text("approved_by").references(() => user.id),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_transfer_org").on(table.organizationId),
		index("idx_transfer_from").on(table.fromLocationId),
		index("idx_transfer_to").on(table.toLocationId),
	],
);

// ── Transfer Line ──────────────────────────────────────────────────────

export const transferLine = pgTable(
	"transfer_line",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		transferId: uuid("transfer_id")
			.notNull()
			.references(() => transfer.id, { onDelete: "cascade" }),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id),
		quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
		receivedQuantity: numeric("received_quantity", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
	},
	(table) => [index("idx_transfer_line_transfer").on(table.transferId)],
);

// ── Stock Count ────────────────────────────────────────────────────────

export const stockCount = pgTable(
	"stock_count",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id),
		type: text("type").notNull().default("cycle"),
		status: text("status").notNull().default("draft"),
		createdBy: text("created_by").references(() => user.id),
		finalizedBy: text("finalized_by").references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		finalizedAt: timestamp("finalized_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_stock_count_org").on(table.organizationId),
		index("idx_stock_count_location").on(table.locationId),
	],
);

// ── Stock Count Line ───────────────────────────────────────────────────

export const stockCountLine = pgTable(
	"stock_count_line",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		stockCountId: uuid("stock_count_id")
			.notNull()
			.references(() => stockCount.id, { onDelete: "cascade" }),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id),
		systemQuantity: numeric("system_quantity", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		countedQuantity: numeric("counted_quantity", { precision: 10, scale: 2 }),
		variance: numeric("variance", { precision: 10, scale: 2 }),
	},
	(table) => [index("idx_stock_count_line_count").on(table.stockCountId)],
);

// ── Relations ──────────────────────────────────────────────────────────

export const supplierRelations = relations(supplier, ({ one, many }) => ({
	organization: one(organization, {
		fields: [supplier.organizationId],
		references: [organization.id],
	}),
	inventoryItems: many(inventoryItem),
	purchaseOrders: many(purchaseOrder),
}));

export const inventoryItemRelations = relations(inventoryItem, ({ one, many }) => ({
	organization: one(organization, {
		fields: [inventoryItem.organizationId],
		references: [organization.id],
	}),
	preferredSupplier: one(supplier, {
		fields: [inventoryItem.preferredSupplierId],
		references: [supplier.id],
	}),
	barcodes: many(inventoryItemBarcode),
	stock: many(inventoryStock),
	ledgerEntries: many(stockLedger),
}));

export const inventoryItemBarcodeRelations = relations(inventoryItemBarcode, ({ one }) => ({
	inventoryItem: one(inventoryItem, {
		fields: [inventoryItemBarcode.inventoryItemId],
		references: [inventoryItem.id],
	}),
}));

export const inventoryStockRelations = relations(inventoryStock, ({ one }) => ({
	inventoryItem: one(inventoryItem, {
		fields: [inventoryStock.inventoryItemId],
		references: [inventoryItem.id],
	}),
	location: one(location, {
		fields: [inventoryStock.locationId],
		references: [location.id],
	}),
}));

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
	inventoryItem: one(inventoryItem, {
		fields: [stockLedger.inventoryItemId],
		references: [inventoryItem.id],
	}),
	location: one(location, {
		fields: [stockLedger.locationId],
		references: [location.id],
	}),
	user: one(user, {
		fields: [stockLedger.userId],
		references: [user.id],
	}),
}));

export const purchaseOrderRelations = relations(purchaseOrder, ({ one, many }) => ({
	organization: one(organization, {
		fields: [purchaseOrder.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [purchaseOrder.locationId],
		references: [location.id],
	}),
	supplier: one(supplier, {
		fields: [purchaseOrder.supplierId],
		references: [supplier.id],
	}),
	createdByUser: one(user, {
		fields: [purchaseOrder.createdBy],
		references: [user.id],
		relationName: "purchaseOrderCreatedBy",
	}),
	approvedByUser: one(user, {
		fields: [purchaseOrder.approvedBy],
		references: [user.id],
		relationName: "purchaseOrderApprovedBy",
	}),
	lines: many(purchaseOrderLine),
	goodsReceipts: many(goodsReceipt),
}));

export const purchaseOrderLineRelations = relations(purchaseOrderLine, ({ one }) => ({
	purchaseOrder: one(purchaseOrder, {
		fields: [purchaseOrderLine.purchaseOrderId],
		references: [purchaseOrder.id],
	}),
	inventoryItem: one(inventoryItem, {
		fields: [purchaseOrderLine.inventoryItemId],
		references: [inventoryItem.id],
	}),
}));

export const goodsReceiptRelations = relations(goodsReceipt, ({ one, many }) => ({
	purchaseOrder: one(purchaseOrder, {
		fields: [goodsReceipt.purchaseOrderId],
		references: [purchaseOrder.id],
	}),
	location: one(location, {
		fields: [goodsReceipt.locationId],
		references: [location.id],
	}),
	receivedByUser: one(user, {
		fields: [goodsReceipt.receivedBy],
		references: [user.id],
	}),
	lines: many(goodsReceiptLine),
}));

export const goodsReceiptLineRelations = relations(goodsReceiptLine, ({ one }) => ({
	goodsReceipt: one(goodsReceipt, {
		fields: [goodsReceiptLine.goodsReceiptId],
		references: [goodsReceipt.id],
	}),
	purchaseOrderLine: one(purchaseOrderLine, {
		fields: [goodsReceiptLine.purchaseOrderLineId],
		references: [purchaseOrderLine.id],
	}),
}));

export const transferRelations = relations(transfer, ({ one, many }) => ({
	organization: one(organization, {
		fields: [transfer.organizationId],
		references: [organization.id],
	}),
	fromLocation: one(location, {
		fields: [transfer.fromLocationId],
		references: [location.id],
		relationName: "transferFrom",
	}),
	toLocation: one(location, {
		fields: [transfer.toLocationId],
		references: [location.id],
		relationName: "transferTo",
	}),
	createdByUser: one(user, {
		fields: [transfer.createdBy],
		references: [user.id],
		relationName: "transferCreatedBy",
	}),
	approvedByUser: one(user, {
		fields: [transfer.approvedBy],
		references: [user.id],
		relationName: "transferApprovedBy",
	}),
	lines: many(transferLine),
}));

export const transferLineRelations = relations(transferLine, ({ one }) => ({
	transfer: one(transfer, {
		fields: [transferLine.transferId],
		references: [transfer.id],
	}),
	inventoryItem: one(inventoryItem, {
		fields: [transferLine.inventoryItemId],
		references: [inventoryItem.id],
	}),
}));

export const stockCountRelations = relations(stockCount, ({ one, many }) => ({
	organization: one(organization, {
		fields: [stockCount.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [stockCount.locationId],
		references: [location.id],
	}),
	createdByUser: one(user, {
		fields: [stockCount.createdBy],
		references: [user.id],
		relationName: "stockCountCreatedBy",
	}),
	finalizedByUser: one(user, {
		fields: [stockCount.finalizedBy],
		references: [user.id],
		relationName: "stockCountFinalizedBy",
	}),
	lines: many(stockCountLine),
}));

export const stockCountLineRelations = relations(stockCountLine, ({ one }) => ({
	stockCount: one(stockCount, {
		fields: [stockCountLine.stockCountId],
		references: [stockCount.id],
	}),
	inventoryItem: one(inventoryItem, {
		fields: [stockCountLine.inventoryItemId],
		references: [inventoryItem.id],
	}),
}));
