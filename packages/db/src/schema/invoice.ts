import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
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
import { supplier } from "./inventory";
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
		agencyName: text("agency_name"),
		contactPersonName: text("contact_person_name"),
		contactPersonPosition: text("contact_person_position"),
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
		scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
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
		brand: text("brand").notNull().default("foods_inc"),
		preparedBy: text("prepared_by"),
		department: text("department"),
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
		lastEmailedAt: timestamp("last_emailed_at", { withTimezone: true }),
		lastReminderSentAt: timestamp("last_reminder_sent_at", {
			withTimezone: true,
		}),
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
		agencyName: text("agency_name"),
		contactPersonName: text("contact_person_name"),
		contactPersonPosition: text("contact_person_position"),
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
		scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
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
		brand: text("brand").notNull().default("foods_inc"),
		preparedBy: text("prepared_by"),
		department: text("department"),
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

// ── Finance Audit Event (Task 0.1) ─────────────────────────────────────

export const financeAuditEvent = pgTable(
	"finance_audit_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		entityType: text("entity_type").notNull(), // invoice | credit_note | vendor_bill | expense | payment
		entityId: uuid("entity_id").notNull(),
		action: text("action").notNull(), // created | updated | status_changed | payment_recorded | voided | reversed
		beforeState: jsonb("before_state"),
		afterState: jsonb("after_state"),
		performedBy: text("performed_by")
			.notNull()
			.references(() => user.id),
		performedAt: timestamp("performed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		notes: text("notes"),
	},
	(table) => [
		index("idx_finance_audit_org_entity").on(
			table.organizationId,
			table.entityType,
			table.entityId,
		),
		index("idx_finance_audit_performed_at").on(table.performedAt),
	],
);

export const financeAuditEventRelations = relations(
	financeAuditEvent,
	({ one }) => ({
		organization: one(organization, {
			fields: [financeAuditEvent.organizationId],
			references: [organization.id],
		}),
		performedByUser: one(user, {
			fields: [financeAuditEvent.performedBy],
			references: [user.id],
		}),
	}),
);

// ── Credit Note Counter (Task 1.2) ─────────────────────────────────────

export const creditNoteCounter = pgTable("credit_note_counter", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	lastNumber: integer("last_number").notNull().default(0),
});

export const creditNoteCounterRelations = relations(
	creditNoteCounter,
	({ one }) => ({
		organization: one(organization, {
			fields: [creditNoteCounter.organizationId],
			references: [organization.id],
		}),
	}),
);

// ── Vendor Bill Counter (Task 1.3) ─────────────────────────────────────

export const vendorBillCounter = pgTable("vendor_bill_counter", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	lastNumber: integer("last_number").notNull().default(0),
});

export const vendorBillCounterRelations = relations(
	vendorBillCounter,
	({ one }) => ({
		organization: one(organization, {
			fields: [vendorBillCounter.organizationId],
			references: [organization.id],
		}),
	}),
);

// ── Credit Note (Task 1.2) ─────────────────────────────────────────────

export const creditNote = pgTable(
	"credit_note",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id").references(() => location.id, {
			onDelete: "set null",
		}),
		creditNoteNumber: text("credit_note_number").notNull(),
		invoiceId: uuid("invoice_id").references(() => invoice.id, {
			onDelete: "set null",
		}),
		customerId: uuid("customer_id").references(() => customer.id, {
			onDelete: "set null",
		}),
		customerName: text("customer_name").notNull(),
		items: jsonb("items").notNull().default([]),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		taxTotal: numeric("tax_total", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
		status: text("status").notNull().default("draft"), // draft | issued | applied | voided
		reason: text("reason").notNull().default(""),
		amountApplied: numeric("amount_applied", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		department: text("department"),
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
		index("idx_credit_note_org").on(table.organizationId),
		index("idx_credit_note_invoice").on(table.invoiceId),
		index("idx_credit_note_customer").on(table.customerId),
		index("idx_credit_note_status").on(table.status),
		index("idx_credit_note_number").on(table.creditNoteNumber),
	],
);

export const creditNoteRelations = relations(creditNote, ({ one }) => ({
	organization: one(organization, {
		fields: [creditNote.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [creditNote.locationId],
		references: [location.id],
	}),
	invoice: one(invoice, {
		fields: [creditNote.invoiceId],
		references: [invoice.id],
	}),
	customer: one(customer, {
		fields: [creditNote.customerId],
		references: [customer.id],
	}),
	createdByUser: one(user, {
		fields: [creditNote.createdBy],
		references: [user.id],
	}),
}));

// ── Invoice Payment (Task 1.1) ─────────────────────────────────────────
// Payment records are append-only. To "delete" a payment, insert a
// reversal record (negative amount, isReversal=true). No hard deletes.

export const invoicePayment = pgTable(
	"invoice_payment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		invoiceId: uuid("invoice_id")
			.notNull()
			.references(() => invoice.id, { onDelete: "cascade" }),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		paymentMethod: text("payment_method").notNull(), // cash | cheque | bank_transfer | mobile_money | credit_note
		referenceNumber: text("reference_number"),
		chequeNumber: text("cheque_number"),
		chequeDepositDate: timestamp("cheque_deposit_date", { withTimezone: true }),
		creditNoteId: uuid("credit_note_id").references(() => creditNote.id, {
			onDelete: "set null",
		}),
		datePaid: timestamp("date_paid", { withTimezone: true }).notNull(),
		notes: text("notes"),
		isReversal: boolean("is_reversal").notNull().default(false),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_invoice_payment_invoice").on(table.invoiceId),
		index("idx_invoice_payment_org").on(table.organizationId),
		index("idx_invoice_payment_date").on(table.datePaid),
	],
);

export const invoicePaymentRelations = relations(invoicePayment, ({ one }) => ({
	organization: one(organization, {
		fields: [invoicePayment.organizationId],
		references: [organization.id],
	}),
	invoice: one(invoice, {
		fields: [invoicePayment.invoiceId],
		references: [invoice.id],
	}),
	creditNote: one(creditNote, {
		fields: [invoicePayment.creditNoteId],
		references: [creditNote.id],
	}),
	createdByUser: one(user, {
		fields: [invoicePayment.createdBy],
		references: [user.id],
	}),
}));

// ── Customer Payment + Allocation Ledger (Phase 2) ─────────────────────

export const customerPayment = pgTable(
	"customer_payment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => customer.id, { onDelete: "cascade" }),
		totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
		unappliedAmount: numeric("unapplied_amount", {
			precision: 12,
			scale: 2,
		}).notNull(),
		paymentMethod: text("payment_method").notNull(),
		referenceNumber: text("reference_number"),
		datePaid: timestamp("date_paid", { withTimezone: true }).notNull(),
		notes: text("notes"),
		status: text("status").notNull().default("open"), // open | fully_applied | refunded | written_off
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_customer_payment_org_customer").on(
			table.organizationId,
			table.customerId,
		),
		index("idx_customer_payment_status").on(table.status),
	],
);

export const customerPaymentAllocation = pgTable(
	"customer_payment_allocation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		customerPaymentId: uuid("customer_payment_id")
			.notNull()
			.references(() => customerPayment.id, { onDelete: "cascade" }),
		invoiceId: uuid("invoice_id")
			.notNull()
			.references(() => invoice.id, { onDelete: "cascade" }),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_payment_alloc_payment").on(table.customerPaymentId),
		index("idx_payment_alloc_invoice").on(table.invoiceId),
	],
);

export const customerPaymentLedger = pgTable(
	"customer_payment_ledger",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		customerPaymentId: uuid("customer_payment_id")
			.notNull()
			.references(() => customerPayment.id, { onDelete: "cascade" }),
		action: text("action").notNull(), // create | apply | unapply | refund | write_off
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		details: jsonb("details").notNull().default({}),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_customer_payment_ledger_payment").on(table.customerPaymentId),
		index("idx_customer_payment_ledger_created").on(table.createdAt),
	],
);

export const invoiceLifecycleEvent = pgTable(
	"invoice_lifecycle_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		entityType: text("entity_type").notNull(), // invoice | quotation
		entityId: uuid("entity_id").notNull(),
		eventType: text("event_type").notNull(), // sent | viewed | reminder | paid | scheduled
		details: jsonb("details").notNull().default({}),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_invoice_lifecycle_entity").on(
			table.organizationId,
			table.entityType,
			table.entityId,
		),
	],
);

// ── Vendor Bill (Task 1.3) ─────────────────────────────────────────────

export const vendorBill = pgTable(
	"vendor_bill",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		locationId: uuid("location_id").references(() => location.id, {
			onDelete: "set null",
		}),
		billNumber: text("bill_number").notNull(),
		supplierId: uuid("supplier_id").references(() => supplier.id, {
			onDelete: "set null",
		}),
		supplierName: text("supplier_name").notNull(),
		items: jsonb("items").notNull().default([]),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		taxTotal: numeric("tax_total", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
		status: text("status").notNull().default("draft"), // draft | received | partially_paid | paid | overdue | voided
		amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		dueDate: timestamp("due_date", { withTimezone: true }),
		issuedDate: timestamp("issued_date", { withTimezone: true }),
		datePaid: timestamp("date_paid", { withTimezone: true }),
		paymentMethod: text("payment_method"),
		paymentReference: text("payment_reference"),
		notes: text("notes"),
		department: text("department"),
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
		index("idx_vendor_bill_org").on(table.organizationId),
		index("idx_vendor_bill_supplier").on(table.supplierId),
		index("idx_vendor_bill_status").on(table.status),
		index("idx_vendor_bill_number").on(table.billNumber),
		index("idx_vendor_bill_due").on(table.dueDate),
	],
);

export const vendorBillRelations = relations(vendorBill, ({ one, many }) => ({
	organization: one(organization, {
		fields: [vendorBill.organizationId],
		references: [organization.id],
	}),
	location: one(location, {
		fields: [vendorBill.locationId],
		references: [location.id],
	}),
	supplier: one(supplier, {
		fields: [vendorBill.supplierId],
		references: [supplier.id],
	}),
	createdByUser: one(user, {
		fields: [vendorBill.createdBy],
		references: [user.id],
	}),
	payments: many(vendorBillPayment),
}));

// ── Vendor Bill Payment (Task 1.4) ─────────────────────────────────────
// Payment records are append-only. To "delete" a payment, insert a
// reversal record (negative amount, isReversal=true). No hard deletes.

export const vendorBillPayment = pgTable(
	"vendor_bill_payment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		vendorBillId: uuid("vendor_bill_id")
			.notNull()
			.references(() => vendorBill.id, { onDelete: "cascade" }),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		paymentMethod: text("payment_method").notNull(),
		referenceNumber: text("reference_number"),
		datePaid: timestamp("date_paid", { withTimezone: true }).notNull(),
		notes: text("notes"),
		isReversal: boolean("is_reversal").notNull().default(false),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_vendor_bill_payment_bill").on(table.vendorBillId),
		index("idx_vendor_bill_payment_org").on(table.organizationId),
		index("idx_vendor_bill_payment_date").on(table.datePaid),
	],
);

export const vendorBillPaymentRelations = relations(
	vendorBillPayment,
	({ one }) => ({
		organization: one(organization, {
			fields: [vendorBillPayment.organizationId],
			references: [organization.id],
		}),
		vendorBill: one(vendorBill, {
			fields: [vendorBillPayment.vendorBillId],
			references: [vendorBill.id],
		}),
		createdByUser: one(user, {
			fields: [vendorBillPayment.createdBy],
			references: [user.id],
		}),
	}),
);

// ── Recurring Template (Task 1.5) ──────────────────────────────────────

export const recurringTemplate = pgTable(
	"recurring_template",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		templateType: text("template_type").notNull(), // invoice | expense | vendor_bill
		frequency: text("frequency").notNull(), // weekly | biweekly | monthly | quarterly | annually
		startDate: timestamp("start_date", { withTimezone: true }),
		nextRunDate: timestamp("next_run_date", { withTimezone: true }).notNull(),
		remainingCycles: integer("remaining_cycles"),
		endDate: timestamp("end_date", { withTimezone: true }),
		isActive: boolean("is_active").notNull().default(true),
		status: text("status").notNull().default("active"), // active | paused | completed
		priceAutomationMode: text("price_automation_mode")
			.notNull()
			.default("none"), // none | fixed_update | percent_increase
		priceAutomationValue: numeric("price_automation_value", {
			precision: 12,
			scale: 2,
		})
			.notNull()
			.default("0"),
		templateData: jsonb("template_data").notNull().default({}),
		customerId: uuid("customer_id").references(() => customer.id, {
			onDelete: "set null",
		}),
		supplierId: uuid("supplier_id").references(() => supplier.id, {
			onDelete: "set null",
		}),
		lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
		totalGenerated: integer("total_generated").notNull().default(0),
		idempotencyKey: text("idempotency_key"),
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
		index("idx_recurring_template_org").on(table.organizationId),
		index("idx_recurring_template_next_run").on(table.nextRunDate),
		index("idx_recurring_template_active").on(table.isActive),
	],
);

export const recurringTemplateRelations = relations(
	recurringTemplate,
	({ one }) => ({
		organization: one(organization, {
			fields: [recurringTemplate.organizationId],
			references: [organization.id],
		}),
		customer: one(customer, {
			fields: [recurringTemplate.customerId],
			references: [customer.id],
		}),
		supplier: one(supplier, {
			fields: [recurringTemplate.supplierId],
			references: [supplier.id],
		}),
		createdByUser: one(user, {
			fields: [recurringTemplate.createdBy],
			references: [user.id],
		}),
	}),
);

// ── Recurring Template Run (Phase 2) ───────────────────────────────────

export const recurringTemplateRun = pgTable(
	"recurring_template_run",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		templateId: uuid("template_id")
			.notNull()
			.references(() => recurringTemplate.id, { onDelete: "cascade" }),
		generatedType: text("generated_type").notNull(), // invoice | expense | vendor_bill
		generatedId: uuid("generated_id"),
		status: text("status").notNull().default("success"), // success | failed
		details: jsonb("details").notNull().default({}),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_recurring_run_template").on(table.templateId, table.createdAt),
		index("idx_recurring_run_org").on(table.organizationId, table.createdAt),
	],
);

export const recurringTemplateRunRelations = relations(
	recurringTemplateRun,
	({ one }) => ({
		organization: one(organization, {
			fields: [recurringTemplateRun.organizationId],
			references: [organization.id],
		}),
		template: one(recurringTemplate, {
			fields: [recurringTemplateRun.templateId],
			references: [recurringTemplate.id],
		}),
		createdByUser: one(user, {
			fields: [recurringTemplateRun.createdBy],
			references: [user.id],
		}),
	}),
);

// ── Budget (Task 1.6) ──────────────────────────────────────────────────

export const budget = pgTable(
	"budget",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		period: text("period").notNull(), // monthly | quarterly | annually
		startDate: timestamp("start_date", { withTimezone: true }).notNull(),
		endDate: timestamp("end_date", { withTimezone: true }).notNull(),
		status: text("status").notNull().default("active"), // active | closed
		// [{category: string, budgeted: string, alertThreshold: number}]
		categories: jsonb("categories").notNull().default([]),
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
		index("idx_budget_org").on(table.organizationId),
		index("idx_budget_status").on(table.status),
		index("idx_budget_period").on(table.startDate, table.endDate),
	],
);

export const budgetRelations = relations(budget, ({ one }) => ({
	organization: one(organization, {
		fields: [budget.organizationId],
		references: [organization.id],
	}),
	createdByUser: one(user, {
		fields: [budget.createdBy],
		references: [user.id],
	}),
}));
