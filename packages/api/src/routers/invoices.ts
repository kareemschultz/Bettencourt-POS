import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";
const DEFAULT_LOC_ID = "b0000000-0000-4000-8000-000000000001";

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
	.handler(async ({ input: rawInput }) => {
		const search = rawInput?.search;
		const status = rawInput?.status;
		const limit = rawInput?.limit ?? 50;
		const offset = rawInput?.offset ?? 0;

		const conditions = [eq(schema.invoice.organizationId, DEFAULT_ORG_ID)];

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
	.handler(async ({ input }) => {
		const rows = await db
			.select()
			.from(schema.invoice)
			.where(eq(schema.invoice.id, input.id))
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
			createdBy: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const invoiceNumber = await nextInvoiceNumber(DEFAULT_ORG_ID);

		const rows = await db
			.insert(schema.invoice)
			.values({
				organizationId: DEFAULT_ORG_ID,
				locationId: input.locationId ?? DEFAULT_LOC_ID,
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
				createdBy: input.createdBy,
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
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select({ id: schema.invoice.id })
			.from(schema.invoice)
			.where(eq(schema.invoice.id, input.id))
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

		await db
			.update(schema.invoice)
			.set(updates)
			.where(eq(schema.invoice.id, input.id));

		return { success: true };
	});

// ── remove ─────────────────────────────────────────────────────────────

const remove = permissionProcedure("invoices.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.update(schema.invoice)
			.set({ status: "cancelled" })
			.where(eq(schema.invoice.id, input.id));

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
	.handler(async ({ input }) => {
		const rows = await db
			.select({ total: schema.invoice.total })
			.from(schema.invoice)
			.where(eq(schema.invoice.id, input.id))
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
			.where(eq(schema.invoice.id, input.id));

		return { success: true, status };
	});

// ── router export ──────────────────────────────────────────────────────

export const invoicesRouter = {
	list,
	getById,
	create,
	update,
	delete: remove,
	markPaid,
};
