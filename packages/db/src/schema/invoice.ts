import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { customer } from "./customer";
import { location, organization } from "./organization";

// ── Invoice Counter ────────────────────────────────────────────────────

export const invoiceCounter = pgTable("invoice_counter", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	lastNumber: integer("last_number").notNull().default(0),
});

// ── Quotation Counter ──────────────────────────────────────────────────

export const quotationCounter = pgTable("quotation_counter", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	lastNumber: integer("last_number").notNull().default(0),
});

// ── Invoice ────────────────────────────────────────────────────────────

export const invoice = pgTable(
	"invoice",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id").references(() => location.id, {
			onDelete: "set null",
		}),
		invoiceNumber: text("invoice_number").notNull(),
		customerId: uuid("customer_id").references(() => customer.id, {
			onDelete: "set null",
		}),
		customerName: text("customer_name").notNull(),
		customerAddress: text("customer_address"),
		customerPhone: text("customer_phone"),
		items: jsonb("items").notNull().default([]),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		taxTotal: numeric("tax_total", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
		status: text("status").notNull().default("draft"),
		amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		chequeNumber: text("cheque_number"),
		receiptNumber: text("receipt_number"),
		datePaid: timestamp("date_paid", { withTimezone: true }),
		issuedDate: timestamp("issued_date", { withTimezone: true }),
		dueDate: timestamp("due_date", { withTimezone: true }),
		chequeDepositDate: timestamp("cheque_deposit_date", { withTimezone: true }),
		notes: text("notes"),
		discountType: text("discount_type").notNull().default("percent"),
		discountValue: numeric("discount_value", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		taxMode: text("tax_mode").notNull().default("invoice"),
		taxRate: numeric("tax_rate", { precision: 5, scale: 2 })
			.notNull()
			.default("16.5"),
		paymentTerms: text("payment_terms").notNull().default("due_on_receipt"),
		preparedBy: text("prepared_by"),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_invoice_org").on(table.organizationId),
		index("idx_invoice_customer").on(table.customerId),
		index("idx_invoice_status").on(table.status),
		index("idx_invoice_number").on(table.invoiceNumber),
		index("idx_invoice_created").on(table.createdAt),
	],
);

// ── Quotation ──────────────────────────────────────────────────────────

export const quotation = pgTable(
	"quotation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id").references(() => location.id, {
			onDelete: "set null",
		}),
		quotationNumber: text("quotation_number").notNull(),
		customerId: uuid("customer_id").references(() => customer.id, {
			onDelete: "set null",
		}),
		customerName: text("customer_name").notNull(),
		customerAddress: text("customer_address"),
		customerPhone: text("customer_phone"),
		items: jsonb("items").notNull().default([]),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		taxTotal: numeric("tax_total", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
		status: text("status").notNull().default("draft"),
		validUntil: timestamp("valid_until", { withTimezone: true }),
		convertedInvoiceId: uuid("converted_invoice_id").references(
			() => invoice.id,
			{ onDelete: "set null" },
		),
		notes: text("notes"),
		discountType: text("discount_type").notNull().default("percent"),
		discountValue: numeric("discount_value", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		taxMode: text("tax_mode").notNull().default("invoice"),
		taxRate: numeric("tax_rate", { precision: 5, scale: 2 })
			.notNull()
			.default("16.5"),
		termsAndConditions: text("terms_and_conditions"),
		parentQuotationId: uuid("parent_quotation_id").references(
			(): AnyPgColumn => quotation.id,
			{ onDelete: "set null" },
		),
		preparedBy: text("prepared_by"),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("idx_quotation_org").on(table.organizationId),
		index("idx_quotation_customer").on(table.customerId),
		index("idx_quotation_status").on(table.status),
		index("idx_quotation_number").on(table.quotationNumber),
		index("idx_quotation_created").on(table.createdAt),
	],
);

// ── Relations ──────────────────────────────────────────────────────────

export const invoiceRelations = relations(invoice, ({ one }) => ({
	organization: one(organization, {
		fields: [invoice.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [invoice.locationId],
		references: [location.id],
	}),
	customer: one(customer, {
		fields: [invoice.customerId],
		references: [customer.id],
	}),
	createdByUser: one(user, {
		fields: [invoice.createdBy],
		references: [user.id],
	}),
}));

export const quotationRelations = relations(quotation, ({ one }) => ({
	organization: one(organization, {
		fields: [quotation.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [quotation.locationId],
		references: [location.id],
	}),
	customer: one(customer, {
		fields: [quotation.customerId],
		references: [customer.id],
	}),
	createdByUser: one(user, {
		fields: [quotation.createdBy],
		references: [user.id],
	}),
	convertedInvoice: one(invoice, {
		fields: [quotation.convertedInvoiceId],
		references: [invoice.id],
	}),
}));

export const invoiceCounterRelations = relations(invoiceCounter, ({ one }) => ({
	organization: one(organization, {
		fields: [invoiceCounter.organizationId],
		references: [organization.id],
	}),
}));

export const quotationCounterRelations = relations(
	quotationCounter,
	({ one }) => ({
		organization: one(organization, {
			fields: [quotationCounter.organizationId],
			references: [organization.id],
		}),
	}),
);

// ── Invoice Document Settings ──────────────────────────────────────────

export const invoiceDocumentSettings = pgTable("invoice_document_settings", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.unique()
		.references(() => organization.id, { onDelete: "cascade" }),
	defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 })
		.notNull()
		.default("16.5"),
	defaultTaxMode: text("default_tax_mode").notNull().default("invoice"),
	defaultPaymentTerms: text("default_payment_terms")
		.notNull()
		.default("due_on_receipt"),
	defaultDiscountType: text("default_discount_type")
		.notNull()
		.default("percent"),
	companyTin: text("company_tin"),
	bankName: text("bank_name"),
	bankAccount: text("bank_account"),
	bankBranch: text("bank_branch"),
	paymentInstructions: text("payment_instructions"),
	defaultQuotationTerms: text("default_quotation_terms"),
	invoiceFooterNote: text("invoice_footer_note"),
	quotationFooterNote: text("quotation_footer_note"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const invoiceDocumentSettingsRelations = relations(
	invoiceDocumentSettings,
	({ one }) => ({
		organization: one(organization, {
			fields: [invoiceDocumentSettings.organizationId],
			references: [organization.id],
		}),
	}),
);
