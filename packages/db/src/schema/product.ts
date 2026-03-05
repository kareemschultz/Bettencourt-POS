import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { organization, location, register } from "./organization";

// ── Reporting Category (Department) ────────────────────────────────────

export const reportingCategory = pgTable(
	"reporting_category",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_reporting_category_org").on(table.organizationId)],
);

// ── Product ────────────────────────────────────────────────────────────

export const product = pgTable(
	"product",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		reportingName: text("reporting_name"),
		reportingCategoryId: uuid("reporting_category_id").references(
			() => reportingCategory.id,
			{ onDelete: "set null" },
		),
		sku: text("sku"),
		price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
		cost: numeric("cost", { precision: 10, scale: 2 }).default("0"),
		taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull().default("0"),
		isActive: boolean("is_active").notNull().default(true),
		imageUrl: text("image_url"),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_product_org").on(table.organizationId),
		index("idx_product_category").on(table.reportingCategoryId),
		index("idx_product_sku").on(table.sku),
	],
);

// ── Modifier Group & Modifier ──────────────────────────────────────────

export const modifierGroup = pgTable(
	"modifier_group",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		required: boolean("required").notNull().default(false),
		minSelect: integer("min_select").notNull().default(0),
		maxSelect: integer("max_select").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_modifier_group_org").on(table.organizationId)],
);

export const modifier = pgTable(
	"modifier",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		modifierGroupId: uuid("modifier_group_id")
			.notNull()
			.references(() => modifierGroup.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
		isActive: boolean("is_active").notNull().default(true),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [index("idx_modifier_group").on(table.modifierGroupId)],
);

// ── Product ↔ Modifier Group (many-to-many) ───────────────────────────

export const productModifierGroup = pgTable(
	"product_modifier_group",
	{
		productId: uuid("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		modifierGroupId: uuid("modifier_group_id")
			.notNull()
			.references(() => modifierGroup.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.productId, table.modifierGroupId] }),
	],
);

// ── Product Barcode ────────────────────────────────────────────────────

export const productBarcode = pgTable(
	"product_barcode",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		barcode: text("barcode").notNull(),
		isPrimary: boolean("is_primary").notNull().default(false),
	},
	(table) => [
		index("idx_product_barcode_product").on(table.productId),
		index("idx_product_barcode_barcode").on(table.barcode),
	],
);

// ── Product ↔ Location (availability) ─────────────────────────────────

export const productLocation = pgTable(
	"product_location",
	{
		productId: uuid("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		locationId: uuid("location_id")
			.notNull()
			.references(() => location.id, { onDelete: "cascade" }),
		isAvailable: boolean("is_available").notNull().default(true),
	},
	(table) => [
		primaryKey({ columns: [table.productId, table.locationId] }),
	],
);

// ── Combo Product ──────────────────────────────────────────────────────

export const comboProduct = pgTable(
	"combo_product",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		productId: uuid("product_id")
			.notNull()
			.unique()
			.references(() => product.id, { onDelete: "cascade" }),
	},
	(table) => [index("idx_combo_product_product").on(table.productId)],
);

export const comboComponent = pgTable(
	"combo_component",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		comboProductId: uuid("combo_product_id")
			.notNull()
			.references(() => comboProduct.id, { onDelete: "cascade" }),
		componentName: text("component_name").notNull(),
		departmentId: uuid("department_id").references(
			() => reportingCategory.id,
			{ onDelete: "set null" },
		),
		allocatedPrice: numeric("allocated_price", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
	},
	(table) => [index("idx_combo_component_combo").on(table.comboProductId)],
);

// ── Register ↔ Department (many-to-many) ──────────────────────────────

export const registerDepartment = pgTable(
	"register_department",
	{
		registerId: uuid("register_id")
			.notNull()
			.references(() => register.id, { onDelete: "cascade" }),
		departmentId: uuid("department_id")
			.notNull()
			.references(() => reportingCategory.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.registerId, table.departmentId] }),
	],
);

// ── Tax Rate ───────────────────────────────────────────────────────────

export const taxRate = pgTable(
	"tax_rate",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		rate: numeric("rate", { precision: 5, scale: 4 }).notNull().default("0"),
		isDefault: boolean("is_default").notNull().default(false),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_tax_rate_org").on(table.organizationId)],
);

// ── Relations ──────────────────────────────────────────────────────────

export const reportingCategoryRelations = relations(reportingCategory, ({ one, many }) => ({
	organization: one(organization, {
		fields: [reportingCategory.organizationId],
		references: [organization.id],
	}),
	products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
	organization: one(organization, {
		fields: [product.organizationId],
		references: [organization.id],
	}),
	reportingCategory: one(reportingCategory, {
		fields: [product.reportingCategoryId],
		references: [reportingCategory.id],
	}),
	barcodes: many(productBarcode),
	productModifierGroups: many(productModifierGroup),
	productLocations: many(productLocation),
	comboProduct: one(comboProduct, {
		fields: [product.id],
		references: [comboProduct.productId],
	}),
}));

export const modifierGroupRelations = relations(modifierGroup, ({ one, many }) => ({
	organization: one(organization, {
		fields: [modifierGroup.organizationId],
		references: [organization.id],
	}),
	modifiers: many(modifier),
	productModifierGroups: many(productModifierGroup),
}));

export const modifierRelations = relations(modifier, ({ one }) => ({
	modifierGroup: one(modifierGroup, {
		fields: [modifier.modifierGroupId],
		references: [modifierGroup.id],
	}),
}));

export const productModifierGroupRelations = relations(productModifierGroup, ({ one }) => ({
	product: one(product, {
		fields: [productModifierGroup.productId],
		references: [product.id],
	}),
	modifierGroup: one(modifierGroup, {
		fields: [productModifierGroup.modifierGroupId],
		references: [modifierGroup.id],
	}),
}));

export const productBarcodeRelations = relations(productBarcode, ({ one }) => ({
	product: one(product, {
		fields: [productBarcode.productId],
		references: [product.id],
	}),
}));

export const productLocationRelations = relations(productLocation, ({ one }) => ({
	product: one(product, {
		fields: [productLocation.productId],
		references: [product.id],
	}),
	location: one(location, {
		fields: [productLocation.locationId],
		references: [location.id],
	}),
}));

export const comboProductRelations = relations(comboProduct, ({ one, many }) => ({
	product: one(product, {
		fields: [comboProduct.productId],
		references: [product.id],
	}),
	components: many(comboComponent),
}));

export const comboComponentRelations = relations(comboComponent, ({ one }) => ({
	comboProduct: one(comboProduct, {
		fields: [comboComponent.comboProductId],
		references: [comboProduct.id],
	}),
	department: one(reportingCategory, {
		fields: [comboComponent.departmentId],
		references: [reportingCategory.id],
	}),
}));

export const registerDepartmentRelations = relations(registerDepartment, ({ one }) => ({
	register: one(register, {
		fields: [registerDepartment.registerId],
		references: [register.id],
	}),
	department: one(reportingCategory, {
		fields: [registerDepartment.departmentId],
		references: [reportingCategory.id],
	}),
}));

export const taxRateRelations = relations(taxRate, ({ one }) => ({
	organization: one(organization, {
		fields: [taxRate.organizationId],
		references: [organization.id],
	}),
}));
