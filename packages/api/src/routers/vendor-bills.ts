import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, ilike, lt, lte, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { logFinanceEvent } from "../lib/finance-audit";
import { assertTransition, computeInvoiceStatus } from "../lib/finance-status";
import { requireOrganizationId } from "../lib/org-context";

// ── helpers ────────────────────────────────────────────────────────────

async function nextVendorBillNumber(orgId: string): Promise<string> {
	const result = await db
		.insert(schema.vendorBillCounter)
		.values({ organizationId: orgId, lastNumber: 1 })
		.onConflictDoUpdate({
			target: schema.vendorBillCounter.organizationId,
			set: { lastNumber: sql`${schema.vendorBillCounter.lastNumber} + 1` },
		})
		.returning({ lastNumber: schema.vendorBillCounter.lastNumber });
	const num = result[0]?.lastNumber ?? 1;
	return `VB-${String(num).padStart(4, "0")}`;
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
				supplierId: z.string().uuid().optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				overdueOnly: z.boolean().optional(),
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const orgId = requireOrganizationId(context);
		const search = rawInput?.search;
		const status = rawInput?.status;
		const supplierId = rawInput?.supplierId;
		const startDate = rawInput?.startDate;
		const endDate = rawInput?.endDate;
		const overdueOnly = rawInput?.overdueOnly ?? false;
		const limit = rawInput?.limit ?? 50;
		const offset = rawInput?.offset ?? 0;

		const conditions = [eq(schema.vendorBill.organizationId, orgId)];

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			conditions.push(
				or(
					ilike(schema.vendorBill.supplierName, term),
					ilike(schema.vendorBill.billNumber, term),
				)!,
			);
		}

		if (status) {
			conditions.push(eq(schema.vendorBill.status, status));
		}

		if (supplierId) {
			conditions.push(eq(schema.vendorBill.supplierId, supplierId));
		}

		if (startDate) {
			conditions.push(gte(schema.vendorBill.createdAt, new Date(startDate)));
		}

		if (endDate) {
			conditions.push(lte(schema.vendorBill.createdAt, new Date(endDate)));
		}

		if (overdueOnly) {
			conditions.push(lt(schema.vendorBill.dueDate, new Date()));
			conditions.push(
				or(
					eq(schema.vendorBill.status, "overdue"),
					eq(schema.vendorBill.status, "received"),
					eq(schema.vendorBill.status, "partially_paid"),
				)!,
			);
		}

		const [items, countResult] = await Promise.all([
			db
				.select()
				.from(schema.vendorBill)
				.where(and(...conditions))
				.orderBy(desc(schema.vendorBill.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(schema.vendorBill)
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
			.from(schema.vendorBill)
			.where(
				and(
					eq(schema.vendorBill.id, input.id),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Vendor bill not found" });
		}

		return rows[0]!;
	});

// ── create ─────────────────────────────────────────────────────────────

const create = permissionProcedure("invoices.create")
	.input(
		z.object({
			supplierName: z.string().min(1),
			supplierId: z.string().uuid().optional(),
			locationId: z.string().uuid().optional(),
			issuedDate: z.string().optional(),
			dueDate: z.string().optional(),
			items: z.array(lineItemSchema),
			subtotal: z.string(),
			taxTotal: z.string().optional(),
			total: z.string(),
			notes: z.string().optional(),
			paymentMethod: z.string().optional(),
			paymentReference: z.string().optional(),
			department: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const billNumber = await nextVendorBillNumber(orgId);
		const createdBy = context.session?.user.id;

		const rows = await db
			.insert(schema.vendorBill)
			.values({
				organizationId: orgId,
				locationId: input.locationId ?? null,
				billNumber,
				supplierId: input.supplierId ?? null,
				supplierName: input.supplierName,
				items: input.items,
				subtotal: input.subtotal,
				taxTotal: input.taxTotal ?? "0",
				total: input.total,
				status: "draft",
				amountPaid: "0",
				issuedDate: input.issuedDate ? new Date(input.issuedDate) : null,
				dueDate: input.dueDate ? new Date(input.dueDate) : null,
				notes: input.notes ?? null,
				paymentMethod: input.paymentMethod ?? null,
				paymentReference: input.paymentReference ?? null,
				department: input.department ?? null,
				createdBy,
			})
			.returning();

		const created = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "vendor_bill",
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
			supplierName: z.string().min(1).optional(),
			supplierId: z.string().uuid().optional(),
			issuedDate: z.string().optional(),
			dueDate: z.string().optional(),
			items: z.array(lineItemSchema).optional(),
			subtotal: z.string().optional(),
			taxTotal: z.string().optional(),
			total: z.string().optional(),
			notes: z.string().optional(),
			paymentMethod: z.string().optional(),
			paymentReference: z.string().optional(),
			status: z.string().optional(),
			department: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select()
			.from(schema.vendorBill)
			.where(
				and(
					eq(schema.vendorBill.id, input.id),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Vendor bill not found" });
		}

		const current = existing[0]!;

		const updates: Record<string, unknown> = {};
		if (input.supplierName !== undefined)
			updates.supplierName = input.supplierName;
		if (input.supplierId !== undefined) updates.supplierId = input.supplierId;
		if (input.issuedDate !== undefined)
			updates.issuedDate = input.issuedDate ? new Date(input.issuedDate) : null;
		if (input.dueDate !== undefined)
			updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
		if (input.items !== undefined) updates.items = input.items;
		if (input.subtotal !== undefined) updates.subtotal = input.subtotal;
		if (input.taxTotal !== undefined) updates.taxTotal = input.taxTotal;
		if (input.total !== undefined) updates.total = input.total;
		if (input.notes !== undefined) updates.notes = input.notes;
		if (input.paymentMethod !== undefined)
			updates.paymentMethod = input.paymentMethod;
		if (input.paymentReference !== undefined)
			updates.paymentReference = input.paymentReference;
		if (input.status !== undefined) updates.status = input.status;
		if (input.department !== undefined) updates.department = input.department;

		const rows = await db
			.update(schema.vendorBill)
			.set(updates)
			.where(
				and(
					eq(schema.vendorBill.id, input.id),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.returning();

		const updated = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "vendor_bill",
			entityId: input.id,
			action: "updated",
			beforeState: current,
			afterState: updated,
			performedBy: context.session?.user.id,
		});

		return updated;
	});

// ── recordPayment ──────────────────────────────────────────────────────

const recordPayment = permissionProcedure("invoices.update")
	.input(
		z.object({
			vendorBillId: z.string().uuid(),
			amount: z.string(),
			paymentMethod: z.string(),
			referenceNumber: z.string().optional(),
			datePaid: z.string().optional(),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const performedBy = context.session?.user.id;

		const billRows = await db
			.select()
			.from(schema.vendorBill)
			.where(
				and(
					eq(schema.vendorBill.id, input.vendorBillId),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.limit(1);

		if (billRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Vendor bill not found" });
		}

		const bill = billRows[0]!;

		if (bill.status === "voided") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot record payment on a voided vendor bill.",
			});
		}

		// Create vendorBillPayment row
		await db.insert(schema.vendorBillPayment).values({
			organizationId: orgId,
			vendorBillId: input.vendorBillId,
			amount: input.amount,
			paymentMethod: input.paymentMethod,
			referenceNumber: input.referenceNumber ?? null,
			datePaid: input.datePaid ? new Date(input.datePaid) : new Date(),
			notes: input.notes ?? null,
			isReversal: false,
			createdBy: performedBy,
		});

		// Recalculate amountPaid = sum of non-reversal payments
		const sumResult = await db
			.select({ total: sum(schema.vendorBillPayment.amount) })
			.from(schema.vendorBillPayment)
			.where(
				and(
					eq(schema.vendorBillPayment.vendorBillId, input.vendorBillId),
					eq(schema.vendorBillPayment.isReversal, false),
				),
			);

		const newAmountPaid = sumResult[0]?.total ?? "0";

		// Compute new status
		const newStatus = computeInvoiceStatus(
			Number(bill.total),
			Number(newAmountPaid),
			bill.dueDate,
			bill.status,
		);

		await db
			.update(schema.vendorBill)
			.set({ amountPaid: newAmountPaid, status: newStatus })
			.where(
				and(
					eq(schema.vendorBill.id, input.vendorBillId),
					eq(schema.vendorBill.organizationId, orgId),
				),
			);

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "vendor_bill",
			entityId: input.vendorBillId,
			action: "payment_recorded",
			afterState: {
				amount: input.amount,
				paymentMethod: input.paymentMethod,
				newAmountPaid,
				newStatus,
			},
			performedBy,
			notes: input.notes,
		});

		return { success: true, newAmountPaid, status: newStatus };
	});

// ── reversePayment ─────────────────────────────────────────────────────

const reversePayment = permissionProcedure("invoices.update")
	.input(
		z.object({
			vendorBillPaymentId: z.string().uuid(),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const performedBy = context.session?.user.id;

		// Fetch the original payment
		const paymentRows = await db
			.select()
			.from(schema.vendorBillPayment)
			.where(
				and(
					eq(schema.vendorBillPayment.id, input.vendorBillPaymentId),
					eq(schema.vendorBillPayment.organizationId, orgId),
				),
			)
			.limit(1);

		if (paymentRows.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Vendor bill payment not found",
			});
		}

		const originalPayment = paymentRows[0]!;

		if (originalPayment.isReversal) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot reverse a reversal payment.",
			});
		}

		// Fetch the associated bill for org isolation and status recalculation
		const billRows = await db
			.select()
			.from(schema.vendorBill)
			.where(
				and(
					eq(schema.vendorBill.id, originalPayment.vendorBillId),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.limit(1);

		if (billRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Vendor bill not found" });
		}

		const bill = billRows[0]!;

		// Insert reversal record (negative amount)
		const reversalAmount = String(-Number(originalPayment.amount));
		await db.insert(schema.vendorBillPayment).values({
			organizationId: orgId,
			vendorBillId: originalPayment.vendorBillId,
			amount: reversalAmount,
			paymentMethod: originalPayment.paymentMethod,
			referenceNumber: originalPayment.referenceNumber,
			datePaid: new Date(),
			notes: input.notes ?? null,
			isReversal: true,
			createdBy: performedBy,
		});

		// Recalculate amountPaid = sum of all payments (reversals have negative amounts)
		const sumResult = await db
			.select({ total: sum(schema.vendorBillPayment.amount) })
			.from(schema.vendorBillPayment)
			.where(
				eq(schema.vendorBillPayment.vendorBillId, originalPayment.vendorBillId),
			);

		const newAmountPaid = sumResult[0]?.total ?? "0";

		// Compute new status
		const newStatus = computeInvoiceStatus(
			Number(bill.total),
			Number(newAmountPaid),
			bill.dueDate,
			bill.status,
		);

		await db
			.update(schema.vendorBill)
			.set({ amountPaid: newAmountPaid, status: newStatus })
			.where(
				and(
					eq(schema.vendorBill.id, originalPayment.vendorBillId),
					eq(schema.vendorBill.organizationId, orgId),
				),
			);

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "vendor_bill",
			entityId: originalPayment.vendorBillId,
			action: "reversed",
			afterState: {
				originalPaymentId: input.vendorBillPaymentId,
				reversalAmount,
				newAmountPaid,
				newStatus,
			},
			performedBy,
			notes: input.notes,
		});

		return { success: true, newAmountPaid, status: newStatus };
	});

// ── void ───────────────────────────────────────────────────────────────

const voidBill = permissionProcedure("invoices.update")
	.input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select()
			.from(schema.vendorBill)
			.where(
				and(
					eq(schema.vendorBill.id, input.id),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Vendor bill not found" });
		}

		const current = existing[0]!;
		assertTransition("vendor_bill", current.status, "voided");

		const rows = await db
			.update(schema.vendorBill)
			.set({ status: "voided" })
			.where(
				and(
					eq(schema.vendorBill.id, input.id),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.returning();

		const updated = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "vendor_bill",
			entityId: input.id,
			action: "status_changed",
			beforeState: { status: current.status },
			afterState: { status: "voided" },
			performedBy: context.session?.user.id,
			notes: input.notes,
		});

		return updated;
	});

// ── getPaymentHistory ──────────────────────────────────────────────────

const getPaymentHistory = permissionProcedure("invoices.read")
	.input(z.object({ vendorBillId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		// Verify bill belongs to org
		const billRows = await db
			.select({ id: schema.vendorBill.id })
			.from(schema.vendorBill)
			.where(
				and(
					eq(schema.vendorBill.id, input.vendorBillId),
					eq(schema.vendorBill.organizationId, orgId),
				),
			)
			.limit(1);

		if (billRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Vendor bill not found" });
		}

		const payments = await db
			.select()
			.from(schema.vendorBillPayment)
			.where(eq(schema.vendorBillPayment.vendorBillId, input.vendorBillId))
			.orderBy(desc(schema.vendorBillPayment.createdAt));

		return payments;
	});

// ── getOverdueSummary ──────────────────────────────────────────────────

const getOverdueSummary = permissionProcedure("reports.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const now = new Date();

		const result = await db
			.select({
				count: sql<number>`count(*)::int`,
				total: sql<string>`COALESCE(SUM(total::numeric - amount_paid::numeric), 0)::text`,
			})
			.from(schema.vendorBill)
			.where(
				and(
					eq(schema.vendorBill.organizationId, orgId),
					lt(schema.vendorBill.dueDate, now),
					or(
						eq(schema.vendorBill.status, "overdue"),
						eq(schema.vendorBill.status, "received"),
						eq(schema.vendorBill.status, "partially_paid"),
					)!,
				),
			);

		return {
			count: result[0]?.count ?? 0,
			total: result[0]?.total ?? "0",
		};
	});

// ── getPaidThisMonth ───────────────────────────────────────────────────

const getPaidThisMonth = permissionProcedure("invoices.read").handler(
	async ({ context }) => {
		const orgId = requireOrganizationId(context);
		// Get start of current month in Guyana timezone
		const now = new Date();
		const gyStr = now.toLocaleDateString("en-CA", {
			timeZone: "America/Guyana",
		});
		const [year, month] = gyStr.split("-").map(Number);
		// biome-ignore lint/style/noNonNullAssertion: always defined
		const startOfMonth = new Date(year!, month! - 1, 1);
		// biome-ignore lint/style/noNonNullAssertion: always defined
		const startOfNextMonth = new Date(year!, month!, 1);

		const result = await db
			.select({
				total: sum(schema.vendorBillPayment.amount),
			})
			.from(schema.vendorBillPayment)
			.where(
				and(
					eq(schema.vendorBillPayment.organizationId, orgId),
					gte(schema.vendorBillPayment.datePaid, startOfMonth),
					lt(schema.vendorBillPayment.datePaid, startOfNextMonth),
					eq(schema.vendorBillPayment.isReversal, false),
				),
			);

		return { total: result[0]?.total ?? "0" };
	},
);

// ── router export ──────────────────────────────────────────────────────

export const vendorBillsRouter = {
	list,
	getById,
	create,
	update,
	recordPayment,
	reversePayment,
	void: voidBill,
	getPaymentHistory,
	getOverdueSummary,
	getPaidThisMonth,
};
