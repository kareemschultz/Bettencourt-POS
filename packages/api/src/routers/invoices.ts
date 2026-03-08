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

const list = permissionProcedure("invoices.read")
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

		const conditions = [eq(schema.invoice.organizationId, orgId)];

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			conditions.push(
				or(
					ilike(schema.invoice.customerName, term),
					ilike(schema.invoice.invoiceNumber, term),
				)!,
			);
		}

		if (status) {
			conditions.push(eq(schema.invoice.status, status));
		}

		const [invoices, countResult] = await Promise.all([
			db
				.select()
				.from(schema.invoice)
				.where(and(...conditions))
				.orderBy(desc(schema.invoice.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(schema.invoice)
				.where(and(...conditions)),
		]);

		return { invoices, total: countResult[0]?.count ?? 0 };
	});

// ── getById ────────────────────────────────────────────────────────────

const getById = permissionProcedure("invoices.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.invoice)
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
		}

		return rows[0]!;
	});

// ── create ─────────────────────────────────────────────────────────────

const create = permissionProcedure("invoices.create")
	.input(
		z.object({
			customerName: z.string().min(1),
			customerAddress: z.string().optional(),
			customerPhone: z.string().optional(),
			customerId: z.string().uuid().optional(),
			locationId: z.string().uuid().optional(),
			issuedDate: z.string().optional(),
			dueDate: z.string().optional(),
			notes: z.string().optional(),
			items: z.array(lineItemSchema),
			subtotal: z.string(),
			taxTotal: z.string().optional(),
			total: z.string(),
			createdBy: z.string().optional(),
			discountType: z.enum(["percent", "fixed"]).optional(),
			discountValue: z.string().optional(),
			taxMode: z.enum(["invoice", "line"]).optional(),
			taxRate: z.string().optional(),
			paymentTerms: z.string().optional(),
			preparedBy: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const invoiceNumber = await nextInvoiceNumber(orgId);
		const locationId =
			input.locationId ?? (await resolveDefaultLocationId(orgId));
		const createdBy = context.session.user.id;

		const rows = await db
			.insert(schema.invoice)
			.values({
				organizationId: orgId,
				locationId,
				invoiceNumber,
				customerId: input.customerId ?? null,
				customerName: input.customerName,
				customerAddress: input.customerAddress ?? null,
				customerPhone: input.customerPhone ?? null,
				items: input.items,
				subtotal: input.subtotal,
				taxTotal: input.taxTotal ?? "0",
				total: input.total,
				status: "draft",
				issuedDate: input.issuedDate ? new Date(input.issuedDate) : null,
				dueDate: input.dueDate ? new Date(input.dueDate) : null,
				notes: input.notes ?? null,
				createdBy,
				discountType: input.discountType ?? "percent",
				discountValue: input.discountValue ?? "0",
				taxMode: input.taxMode ?? "invoice",
				taxRate: input.taxRate ?? "16.5",
				paymentTerms: input.paymentTerms ?? "due_on_receipt",
				preparedBy: input.preparedBy ?? null,
			})
			.returning();

		return rows[0]!;
	});

// ── update ─────────────────────────────────────────────────────────────

const update = permissionProcedure("invoices.update")
	.input(
		z.object({
			id: z.string().uuid(),
			customerName: z.string().min(1).optional(),
			customerAddress: z.string().optional(),
			customerPhone: z.string().optional(),
			customerId: z.string().uuid().optional(),
			issuedDate: z.string().optional(),
			dueDate: z.string().optional(),
			notes: z.string().optional(),
			items: z.array(lineItemSchema).optional(),
			subtotal: z.string().optional(),
			taxTotal: z.string().optional(),
			total: z.string().optional(),
			status: z.string().optional(),
			discountType: z.enum(["percent", "fixed"]).optional(),
			discountValue: z.string().optional(),
			taxMode: z.enum(["invoice", "line"]).optional(),
			taxRate: z.string().optional(),
			paymentTerms: z.string().optional(),
			preparedBy: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select({ id: schema.invoice.id })
			.from(schema.invoice)
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
		}

		const updates: Record<string, unknown> = {};
		if (input.customerName !== undefined)
			updates.customerName = input.customerName;
		if (input.customerAddress !== undefined)
			updates.customerAddress = input.customerAddress;
		if (input.customerPhone !== undefined)
			updates.customerPhone = input.customerPhone;
		if (input.customerId !== undefined) updates.customerId = input.customerId;
		if (input.issuedDate !== undefined)
			updates.issuedDate = input.issuedDate ? new Date(input.issuedDate) : null;
		if (input.dueDate !== undefined) updates.dueDate = new Date(input.dueDate);
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
		if (input.paymentTerms !== undefined)
			updates.paymentTerms = input.paymentTerms;
		if (input.preparedBy !== undefined) updates.preparedBy = input.preparedBy;

		await db
			.update(schema.invoice)
			.set(updates)
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── remove ─────────────────────────────────────────────────────────────

const remove = permissionProcedure("invoices.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.invoice)
			.set({ status: "cancelled" })
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── markPaid ───────────────────────────────────────────────────────────

const markPaid = permissionProcedure("invoices.update")
	.input(
		z.object({
			id: z.string().uuid(),
			amountPaid: z.string(),
			chequeNumber: z.string().optional(),
			receiptNumber: z.string().optional(),
			datePaid: z.string().optional(),
			chequeDepositDate: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select({ total: schema.invoice.total })
			.from(schema.invoice)
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
		}

		const total = Number(rows[0]!.total);
		const paid = Number(input.amountPaid);

		let status: string;
		if (paid >= total * 1.001) {
			status = "overpaid";
		} else if (paid >= total * 0.999) {
			status = "paid";
		} else {
			status = "outstanding";
		}

		await db
			.update(schema.invoice)
			.set({
				amountPaid: input.amountPaid,
				chequeNumber: input.chequeNumber ?? null,
				receiptNumber: input.receiptNumber ?? null,
				datePaid: input.datePaid ? new Date(input.datePaid) : new Date(),
				chequeDepositDate: input.chequeDepositDate
					? new Date(input.chequeDepositDate)
					: null,
				status,
			})
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
				),
			);

		return { success: true, status };
	});

// ── duplicate ──────────────────────────────────────────────────────────

const duplicate = permissionProcedure("invoices.create")
	.input(z.object({ id: z.string().uuid(), createdBy: z.string().optional() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.invoice)
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
		const src = existing[0]!;
		const invoiceNumber = await nextInvoiceNumber(orgId);

		const rows = await db
			.insert(schema.invoice)
			.values({
				organizationId: src.organizationId,
				locationId: src.locationId,
				invoiceNumber,
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
				paymentTerms: src.paymentTerms,
				notes: src.notes,
				createdBy: context.session.user.id,
			})
			.returning();

		return rows[0]!;
	});

// ── getSummary ─────────────────────────────────────────────────────────

const getSummary = permissionProcedure("invoices.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const result = await db.execute(sql`
			SELECT
				COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN total::numeric - amount_paid::numeric ELSE 0 END), 0) as total_outstanding,
				COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') AND due_date < NOW() THEN total::numeric - amount_paid::numeric ELSE 0 END), 0) as total_overdue,
				COALESCE(SUM(CASE WHEN status = 'paid' AND date_paid >= date_trunc('month', NOW()) THEN amount_paid::numeric ELSE 0 END), 0) as paid_this_month,
				COUNT(CASE WHEN status = 'draft' THEN 1 END)::int as draft_count,
				COUNT(CASE WHEN status NOT IN ('paid','cancelled') AND due_date < NOW() THEN 1 END)::int as overdue_count
			FROM invoice
			WHERE organization_id = ${orgId}
		`);
		return (result.rows[0] ?? {}) as Record<string, unknown>;
	});

// ── markSent ───────────────────────────────────────────────────────────

const markSent = permissionProcedure("invoices.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.invoice)
			.set({ status: "sent" })
			.where(
				and(
					eq(schema.invoice.id, input.id),
					eq(schema.invoice.organizationId, orgId),
					eq(schema.invoice.status, "draft"),
				),
			);
		return { success: true };
	});

// ── router export ──────────────────────────────────────────────────────

export const invoicesRouter = {
	list,
	getById,
	create,
	update,
	delete: remove,
	markPaid,
	markSent,
	duplicate,
	getSummary,
};
