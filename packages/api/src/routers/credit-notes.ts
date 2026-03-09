import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, ilike, lte, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { logFinanceEvent } from "../lib/finance-audit";
import { assertTransition, computeInvoiceStatus } from "../lib/finance-status";
import { requireOrganizationId } from "../lib/org-context";

// ── helpers ────────────────────────────────────────────────────────────

async function nextCreditNoteNumber(orgId: string): Promise<string> {
	const result = await db
		.insert(schema.creditNoteCounter)
		.values({ organizationId: orgId, lastNumber: 1 })
		.onConflictDoUpdate({
			target: schema.creditNoteCounter.organizationId,
			set: { lastNumber: sql`${schema.creditNoteCounter.lastNumber} + 1` },
		})
		.returning({ lastNumber: schema.creditNoteCounter.lastNumber });
	const num = result[0]?.lastNumber ?? 1;
	return `CN-${String(num).padStart(4, "0")}`;
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
				customerId: z.string().uuid().optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const orgId = requireOrganizationId(context);
		const search = rawInput?.search;
		const status = rawInput?.status;
		const customerId = rawInput?.customerId;
		const startDate = rawInput?.startDate;
		const endDate = rawInput?.endDate;
		const limit = rawInput?.limit ?? 50;
		const offset = rawInput?.offset ?? 0;

		const conditions = [eq(schema.creditNote.organizationId, orgId)];

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			conditions.push(
				or(
					ilike(schema.creditNote.customerName, term),
					ilike(schema.creditNote.creditNoteNumber, term),
				)!,
			);
		}

		if (status) {
			conditions.push(eq(schema.creditNote.status, status));
		}

		if (customerId) {
			conditions.push(eq(schema.creditNote.customerId, customerId));
		}

		if (startDate) {
			conditions.push(gte(schema.creditNote.createdAt, new Date(startDate)));
		}

		if (endDate) {
			conditions.push(lte(schema.creditNote.createdAt, new Date(endDate)));
		}

		const [items, countResult] = await Promise.all([
			db
				.select()
				.from(schema.creditNote)
				.where(and(...conditions))
				.orderBy(desc(schema.creditNote.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(schema.creditNote)
				.where(and(...conditions)),
		]);

		return { items, total: countResult[0]?.count ?? 0 };
	});

// ── getById ────────────────────────────────────────────────────────────

const getById = permissionProcedure("invoices.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.creditNote)
			.where(
				and(
					eq(schema.creditNote.id, input.id),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Credit note not found" });
		}

		return rows[0]!;
	});

// ── create ─────────────────────────────────────────────────────────────

const create = permissionProcedure("invoices.create")
	.input(
		z.object({
			customerName: z.string().min(1),
			customerId: z.string().uuid().optional(),
			invoiceId: z.string().uuid().optional(),
			locationId: z.string().uuid().optional(),
			reason: z.string().optional(),
			items: z.array(lineItemSchema),
			subtotal: z.string(),
			taxTotal: z.string().optional(),
			total: z.string(),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const creditNoteNumber = await nextCreditNoteNumber(orgId);
		const createdBy = context.session?.user.id;

		const rows = await db
			.insert(schema.creditNote)
			.values({
				organizationId: orgId,
				locationId: input.locationId ?? null,
				creditNoteNumber,
				customerId: input.customerId ?? null,
				customerName: input.customerName,
				invoiceId: input.invoiceId ?? null,
				items: input.items,
				subtotal: input.subtotal,
				taxTotal: input.taxTotal ?? "0",
				total: input.total,
				status: "draft",
				reason: input.reason ?? "",
				amountApplied: "0",
				createdBy,
			})
			.returning();

		const created = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "credit_note",
			entityId: created.id,
			action: "created",
			afterState: created,
			performedBy: createdBy,
		});

		return created;
	});

// ── update ─────────────────────────────────────────────────────────────

const update = permissionProcedure("invoices.update")
	.input(
		z.object({
			id: z.string().uuid(),
			customerName: z.string().min(1).optional(),
			customerId: z.string().uuid().optional(),
			invoiceId: z.string().uuid().optional(),
			reason: z.string().optional(),
			items: z.array(lineItemSchema).optional(),
			subtotal: z.string().optional(),
			taxTotal: z.string().optional(),
			total: z.string().optional(),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select()
			.from(schema.creditNote)
			.where(
				and(
					eq(schema.creditNote.id, input.id),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Credit note not found" });
		}

		const current = existing[0]!;

		if (current.status !== "draft") {
			throw new ORPCError("BAD_REQUEST", {
				message: `Cannot update a credit note with status: ${current.status}. Only draft credit notes can be updated.`,
			});
		}

		const updates: Record<string, unknown> = {};
		if (input.customerName !== undefined)
			updates.customerName = input.customerName;
		if (input.customerId !== undefined) updates.customerId = input.customerId;
		if (input.invoiceId !== undefined) updates.invoiceId = input.invoiceId;
		if (input.reason !== undefined) updates.reason = input.reason;
		if (input.items !== undefined) updates.items = input.items;
		if (input.subtotal !== undefined) updates.subtotal = input.subtotal;
		if (input.taxTotal !== undefined) updates.taxTotal = input.taxTotal;
		if (input.total !== undefined) updates.total = input.total;
		if (input.notes !== undefined) updates.notes = input.notes;

		const rows = await db
			.update(schema.creditNote)
			.set(updates)
			.where(
				and(
					eq(schema.creditNote.id, input.id),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.returning();

		const updated = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "credit_note",
			entityId: input.id,
			action: "updated",
			beforeState: current,
			afterState: updated,
			performedBy: context.session?.user.id,
		});

		return updated;
	});

// ── issue ──────────────────────────────────────────────────────────────

const issue = permissionProcedure("invoices.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select()
			.from(schema.creditNote)
			.where(
				and(
					eq(schema.creditNote.id, input.id),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Credit note not found" });
		}

		const current = existing[0]!;
		assertTransition("credit_note", current.status, "issued");

		const rows = await db
			.update(schema.creditNote)
			.set({ status: "issued" })
			.where(
				and(
					eq(schema.creditNote.id, input.id),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.returning();

		const updated = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "credit_note",
			entityId: input.id,
			action: "status_changed",
			beforeState: { status: current.status },
			afterState: { status: "issued" },
			performedBy: context.session?.user.id,
		});

		return updated;
	});

// ── applyToInvoice ─────────────────────────────────────────────────────

const applyToInvoice = permissionProcedure("invoices.update")
	.input(
		z.object({
			creditNoteId: z.string().uuid(),
			invoiceId: z.string().uuid(),
			amount: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const performedBy = context.session?.user.id;

		// Fetch credit note
		const cnRows = await db
			.select()
			.from(schema.creditNote)
			.where(
				and(
					eq(schema.creditNote.id, input.creditNoteId),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.limit(1);

		if (cnRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Credit note not found" });
		}

		const cn = cnRows[0]!;

		if (cn.status !== "issued" && cn.status !== "applied") {
			throw new ORPCError("BAD_REQUEST", {
				message: `Credit note must be in issued or applied status to apply. Current status: ${cn.status}`,
			});
		}

		// Fetch invoice
		const invRows = await db
			.select()
			.from(schema.invoice)
			.where(
				and(
					eq(schema.invoice.id, input.invoiceId),
					eq(schema.invoice.organizationId, orgId),
				),
			)
			.limit(1);

		if (invRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
		}

		const inv = invRows[0]!;

		// Create invoicePayment record with paymentMethod="credit_note"
		await db.insert(schema.invoicePayment).values({
			organizationId: orgId,
			invoiceId: input.invoiceId,
			amount: input.amount,
			paymentMethod: "credit_note",
			creditNoteId: input.creditNoteId,
			datePaid: new Date(),
			isReversal: false,
			createdBy: performedBy,
		});

		// Recalculate invoice amountPaid = sum of all non-reversal payments
		const paymentSumResult = await db
			.select({ total: sum(schema.invoicePayment.amount) })
			.from(schema.invoicePayment)
			.where(
				and(
					eq(schema.invoicePayment.invoiceId, input.invoiceId),
					eq(schema.invoicePayment.isReversal, false),
				),
			);

		const newAmountPaid = paymentSumResult[0]?.total ?? "0";

		// Compute new invoice status
		const newInvoiceStatus = computeInvoiceStatus(
			Number(inv.total),
			Number(newAmountPaid),
			inv.dueDate,
			inv.status,
		);

		await db
			.update(schema.invoice)
			.set({ amountPaid: newAmountPaid, status: newInvoiceStatus })
			.where(
				and(
					eq(schema.invoice.id, input.invoiceId),
					eq(schema.invoice.organizationId, orgId),
				),
			);

		// Update credit note amountApplied
		const newAmountApplied = String(
			Number(cn.amountApplied) + Number(input.amount),
		);
		const newCnStatus =
			Number(newAmountApplied) >= Number(cn.total) ? "applied" : cn.status;

		await db
			.update(schema.creditNote)
			.set({ amountApplied: newAmountApplied, status: newCnStatus })
			.where(
				and(
					eq(schema.creditNote.id, input.creditNoteId),
					eq(schema.creditNote.organizationId, orgId),
				),
			);

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "credit_note",
			entityId: input.creditNoteId,
			action: "payment_recorded",
			afterState: {
				invoiceId: input.invoiceId,
				amount: input.amount,
				amountApplied: newAmountApplied,
				invoiceStatus: newInvoiceStatus,
			},
			performedBy,
		});

		return { success: true, invoiceStatus: newInvoiceStatus, newAmountApplied };
	});

// ── void ───────────────────────────────────────────────────────────────

const voidCreditNote = permissionProcedure("invoices.update")
	.input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select()
			.from(schema.creditNote)
			.where(
				and(
					eq(schema.creditNote.id, input.id),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Credit note not found" });
		}

		const current = existing[0]!;
		assertTransition("credit_note", current.status, "voided");

		const rows = await db
			.update(schema.creditNote)
			.set({ status: "voided" })
			.where(
				and(
					eq(schema.creditNote.id, input.id),
					eq(schema.creditNote.organizationId, orgId),
				),
			)
			.returning();

		const updated = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "credit_note",
			entityId: input.id,
			action: "status_changed",
			beforeState: { status: current.status },
			afterState: { status: "voided" },
			performedBy: context.session?.user.id,
			notes: input.notes,
		});

		return updated;
	});

// ── router export ──────────────────────────────────────────────────────

export const creditNotesRouter = {
	list,
	getById,
	create,
	update,
	issue,
	applyToInvoice,
	void: voidCreditNote,
};
