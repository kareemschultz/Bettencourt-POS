import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import {
	requireOrganizationId,
	resolveDefaultLocationId,
} from "../lib/org-context";

// ── helpers ────────────────────────────────────────────────────────────

async function nextQuotationNumber(orgId: string): Promise<string> {
	const result = await db
		.insert(schema.quotationCounter)
		.values({ organizationId: orgId, lastNumber: 1 })
		.onConflictDoUpdate({
			target: schema.quotationCounter.organizationId,
			set: { lastNumber: sql`${schema.quotationCounter.lastNumber} + 1` },
		})
		.returning({ lastNumber: schema.quotationCounter.lastNumber });
	const num = result[0]?.lastNumber ?? 1;
	return `QUO-${String(num).padStart(4, "0")}`;
}

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

const lineItemSchema = z.object({
	description: z.string(),
	quantity: z.number(),
	unitPrice: z.number(),
	total: z.number(),
	taxExempt: z.boolean().optional(),
});

// ── list ───────────────────────────────────────────────────────────────

const list = permissionProcedure("quotations.read")
	.input(
		z
			.object({
				search: z.string().optional(),
				status: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const orgId = requireOrganizationId(context);
		const search = rawInput?.search;
		const status = rawInput?.status;
		const limit = rawInput?.limit ?? 50;
		const offset = rawInput?.offset ?? 0;

		const conditions = [eq(schema.quotation.organizationId, orgId)];

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			conditions.push(
				or(
					ilike(schema.quotation.customerName, term),
					ilike(schema.quotation.quotationNumber, term),
				)!,
			);
		}

		if (status) {
			conditions.push(eq(schema.quotation.status, status));
		}

		const [quotations, countResult] = await Promise.all([
			db
				.select()
				.from(schema.quotation)
				.where(and(...conditions))
				.orderBy(desc(schema.quotation.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(schema.quotation)
				.where(and(...conditions)),
		]);

		return { quotations, total: countResult[0]?.count ?? 0 };
	});

// ── getById ────────────────────────────────────────────────────────────

const getById = permissionProcedure("quotations.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.quotation)
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Quotation not found" });
		}

		return rows[0]!;
	});

// ── create ─────────────────────────────────────────────────────────────

const create = permissionProcedure("quotations.create")
	.input(
		z.object({
			customerName: z.string().min(1),
			customerAddress: z.string().optional(),
			customerPhone: z.string().optional(),
			agencyName: z.string().optional(),
			contactPersonName: z.string().optional(),
			contactPersonPosition: z.string().optional(),
			customerId: z.string().uuid().optional(),
			locationId: z.string().uuid().optional(),
			validUntil: z.string().optional(),
			notes: z.string().optional(),
			items: z.array(lineItemSchema),
			subtotal: z.string(),
			taxTotal: z.string().optional(),
			total: z.string(),
			createdBy: z.string().optional(),
			discountType: z.enum(["percent", "fixed"]).optional(),
			discountValue: z.string().optional(),
			taxMode: z.enum(["invoice", "line", "incl"]).optional(),
			taxRate: z.string().optional(),
			termsAndConditions: z.string().optional(),
			parentQuotationId: z.string().uuid().optional(),
			preparedBy: z.string().optional(),
			department: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const quotationNumber = await nextQuotationNumber(orgId);
		const locationId =
			input.locationId ?? (await resolveDefaultLocationId(orgId));

		const rows = await db
			.insert(schema.quotation)
			.values({
				organizationId: orgId,
				locationId,
				quotationNumber,
				customerId: input.customerId ?? null,
				customerName: input.customerName,
				customerAddress: input.customerAddress ?? null,
				customerPhone: input.customerPhone ?? null,
				agencyName: input.agencyName ?? null,
				contactPersonName: input.contactPersonName ?? null,
				contactPersonPosition: input.contactPersonPosition ?? null,
				items: input.items,
				subtotal: input.subtotal,
				taxTotal: input.taxTotal ?? "0",
				total: input.total,
				status: "draft",
				validUntil: input.validUntil ? new Date(input.validUntil) : null,
				notes: input.notes ?? null,
				createdBy: context.session.user.id,
				discountType: input.discountType ?? "percent",
				discountValue: input.discountValue ?? "0",
				taxMode: input.taxMode ?? "invoice",
				taxRate: input.taxRate ?? "16.5",
				termsAndConditions: input.termsAndConditions ?? null,
				parentQuotationId: input.parentQuotationId ?? null,
				preparedBy: input.preparedBy ?? null,
				department: input.department ?? null,
			})
			.returning();

		return rows[0]!;
	});

// ── update ─────────────────────────────────────────────────────────────

const update = permissionProcedure("quotations.update")
	.input(
		z.object({
			id: z.string().uuid(),
			customerName: z.string().min(1).optional(),
			customerAddress: z.string().optional(),
			customerPhone: z.string().optional(),
			agencyName: z.string().optional(),
			contactPersonName: z.string().optional(),
			contactPersonPosition: z.string().optional(),
			customerId: z.string().uuid().optional(),
			validUntil: z.string().optional(),
			notes: z.string().optional(),
			items: z.array(lineItemSchema).optional(),
			subtotal: z.string().optional(),
			taxTotal: z.string().optional(),
			total: z.string().optional(),
			status: z.string().optional(),
			discountType: z.enum(["percent", "fixed"]).optional(),
			discountValue: z.string().optional(),
			taxMode: z.enum(["invoice", "line", "incl"]).optional(),
			taxRate: z.string().optional(),
			termsAndConditions: z.string().optional(),
			preparedBy: z.string().optional(),
			department: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select({ id: schema.quotation.id })
			.from(schema.quotation)
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Quotation not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.customerName !== undefined)
			updates.customerName = input.customerName;
		if (input.customerAddress !== undefined)
			updates.customerAddress = input.customerAddress;
		if (input.customerPhone !== undefined)
			updates.customerPhone = input.customerPhone;
		if (input.agencyName !== undefined) updates.agencyName = input.agencyName;
		if (input.contactPersonName !== undefined) updates.contactPersonName = input.contactPersonName;
		if (input.contactPersonPosition !== undefined) updates.contactPersonPosition = input.contactPersonPosition;
		if (input.customerId !== undefined) updates.customerId = input.customerId;
		if (input.validUntil !== undefined)
			updates.validUntil = new Date(input.validUntil);
		if (input.notes !== undefined) updates.notes = input.notes;
		if (input.items !== undefined) updates.items = input.items;
		if (input.subtotal !== undefined) updates.subtotal = input.subtotal;
		if (input.taxTotal !== undefined) updates.taxTotal = input.taxTotal;
		if (input.total !== undefined) updates.total = input.total;
		if (input.status !== undefined) updates.status = input.status;
		if (input.discountType !== undefined)
			updates.discountType = input.discountType;
		if (input.discountValue !== undefined)
			updates.discountValue = input.discountValue;
		if (input.taxMode !== undefined) updates.taxMode = input.taxMode;
		if (input.taxRate !== undefined) updates.taxRate = input.taxRate;
		if (input.termsAndConditions !== undefined)
			updates.termsAndConditions = input.termsAndConditions;
		if (input.preparedBy !== undefined) updates.preparedBy = input.preparedBy;
		if (input.department !== undefined) updates.department = input.department;

		await db
			.update(schema.quotation)
			.set(updates)
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── remove ─────────────────────────────────────────────────────────────

const remove = permissionProcedure("quotations.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.quotation)
			.set({ status: "cancelled" })
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── convertToInvoice ───────────────────────────────────────────────────

const convertToInvoice = permissionProcedure("invoices.create")
	.input(z.object({ id: z.string().uuid(), createdBy: z.string().optional() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.quotation)
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Quotation not found" });
		}

		const quot = rows[0]!;

		if (!["sent", "accepted"].includes(quot.status)) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Only sent or accepted quotations can be converted to invoices",
			});
		}

		const invoiceNumber = await nextInvoiceNumber(orgId);

		const invoiceRows = await db
			.insert(schema.invoice)
			.values({
				organizationId: quot.organizationId,
				locationId: quot.locationId,
				invoiceNumber,
				customerId: quot.customerId,
				customerName: quot.customerName,
				customerAddress: quot.customerAddress,
				customerPhone: quot.customerPhone,
				items: quot.items as object[],
				subtotal: quot.subtotal,
				taxTotal: quot.taxTotal,
				total: quot.total,
				status: "draft",
				createdBy: context.session.user.id,
				discountType: quot.discountType,
				discountValue: quot.discountValue,
				taxMode: quot.taxMode,
				taxRate: quot.taxRate,
				paymentTerms: "due_on_receipt",
			})
			.returning();

		const newInvoice = invoiceRows[0]!;

		await db
			.update(schema.quotation)
			.set({ status: "converted", convertedInvoiceId: newInvoice.id })
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			);

		return newInvoice;
	});

// ── duplicate ──────────────────────────────────────────────────────────

const duplicate = permissionProcedure("quotations.create")
	.input(z.object({ id: z.string().uuid(), createdBy: z.string().optional() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.quotation)
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "Quotation not found" });
		const src = existing[0]!;
		const quotationNumber = await nextQuotationNumber(orgId);

		const rows = await db
			.insert(schema.quotation)
			.values({
				organizationId: src.organizationId,
				locationId: src.locationId,
				quotationNumber,
				customerName: src.customerName,
				customerAddress: src.customerAddress,
				customerPhone: src.customerPhone,
				customerId: src.customerId,
				items: src.items as Record<string, unknown>[],
				subtotal: src.subtotal,
				taxTotal: src.taxTotal,
				total: src.total,
				status: "draft",
				discountType: src.discountType,
				discountValue: src.discountValue,
				taxMode: src.taxMode,
				taxRate: src.taxRate,
				termsAndConditions: src.termsAndConditions,
				notes: src.notes,
				createdBy: context.session.user.id,
			})
			.returning();

		return rows[0]!;
	});

// ── revise ─────────────────────────────────────────────────────────────

const revise = permissionProcedure("quotations.create")
	.input(z.object({ id: z.string().uuid(), createdBy: z.string().optional() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.quotation)
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "Quotation not found" });
		const src = existing[0]!;

		// Count existing revisions of this parent to determine revision number
		const revisions = await db
			.select({ num: schema.quotation.quotationNumber })
			.from(schema.quotation)
			.where(
				and(
					eq(schema.quotation.parentQuotationId, input.id),
					eq(schema.quotation.organizationId, orgId),
				),
			);
		const revNum = revisions.length + 2; // v2, v3, etc.

		const baseNumber = await nextQuotationNumber(orgId);

		const rows = await db
			.insert(schema.quotation)
			.values({
				organizationId: src.organizationId,
				locationId: src.locationId,
				quotationNumber: `${baseNumber}-R${revNum}`,
				customerName: src.customerName,
				customerAddress: src.customerAddress,
				customerPhone: src.customerPhone,
				customerId: src.customerId,
				items: src.items as Record<string, unknown>[],
				subtotal: src.subtotal,
				taxTotal: src.taxTotal,
				total: src.total,
				status: "draft",
				discountType: src.discountType,
				discountValue: src.discountValue,
				taxMode: src.taxMode,
				taxRate: src.taxRate,
				termsAndConditions: src.termsAndConditions,
				parentQuotationId: input.id,
				notes: src.notes,
				createdBy: context.session.user.id,
			})
			.returning();

		return rows[0]!;
	});

// ── markSent ───────────────────────────────────────────────────────────

const markSent = permissionProcedure("quotations.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.quotation)
			.set({ status: "sent" })
			.where(
				and(
					eq(schema.quotation.id, input.id),
					eq(schema.quotation.organizationId, orgId),
					eq(schema.quotation.status, "draft"),
				),
			);
		return { success: true };
	});

// ── router export ──────────────────────────────────────────────────────

export const quotationsRouter = {
	list,
	getById,
	create,
	update,
	delete: remove,
	convertToInvoice,
	duplicate,
	revise,
	markSent,
};
