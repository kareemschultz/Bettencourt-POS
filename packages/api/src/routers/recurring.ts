import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { logFinanceEvent } from "../lib/finance-audit";
import { requireOrganizationId } from "../lib/org-context";

// ── helpers ────────────────────────────────────────────────────────────

async function nextVendorBillNumber(orgId: string): Promise<string> {
	const result = await db
		.insert(schema.vendorBillCounter)
		.values({ organizationId: orgId, lastNumber: 1 })
		.onConflictDoUpdate({
			target: schema.vendorBillCounter.organizationId,
			set: {
				lastNumber: sql`${schema.vendorBillCounter.lastNumber} + 1`,
			},
		})
		.returning({ lastNumber: schema.vendorBillCounter.lastNumber });
	const num = result[0]?.lastNumber ?? 1;
	return `BILL-${String(num).padStart(4, "0")}`;
}

async function nextInvoiceNumber(orgId: string): Promise<string> {
	const result = await db
		.insert(schema.invoiceCounter)
		.values({ organizationId: orgId, lastNumber: 1 })
		.onConflictDoUpdate({
			target: schema.invoiceCounter.organizationId,
			set: {
				lastNumber: sql`${schema.invoiceCounter.lastNumber} + 1`,
			},
		})
		.returning({ lastNumber: schema.invoiceCounter.lastNumber });
	const num = result[0]?.lastNumber ?? 1;
	return `INV-${String(num).padStart(4, "0")}`;
}

function advanceDate(current: Date, frequency: string): Date {
	const d = new Date(current);
	switch (frequency) {
		case "weekly":
			d.setDate(d.getDate() + 7);
			break;
		case "biweekly":
			d.setDate(d.getDate() + 14);
			break;
		case "monthly": {
			// Safe +1 month: pin to last day of target month to avoid day-overflow
			const targetMonth = d.getMonth() + 1;
			const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
			const wrappedMonth = targetMonth % 12;
			const lastDay = new Date(targetYear, wrappedMonth + 1, 0).getDate();
			d.setFullYear(targetYear, wrappedMonth, Math.min(d.getDate(), lastDay));
			break;
		}
		case "quarterly": {
			const targetMonth = d.getMonth() + 3;
			const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
			const wrappedMonth = targetMonth % 12;
			const lastDay = new Date(targetYear, wrappedMonth + 1, 0).getDate();
			d.setFullYear(targetYear, wrappedMonth, Math.min(d.getDate(), lastDay));
			break;
		}
		case "annually":
			d.setFullYear(d.getFullYear() + 1);
			break;
		default:
			d.setMonth(d.getMonth() + 1);
	}
	return d;
}

// ── list ───────────────────────────────────────────────────────────────

const list = permissionProcedure("invoices.read")
	.input(
		z
			.object({
				templateType: z.enum(["invoice", "expense", "vendor_bill"]).optional(),
				isActive: z.boolean().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const orgId = requireOrganizationId(context);

		const conditions = [eq(schema.recurringTemplate.organizationId, orgId)];

		if (rawInput?.templateType !== undefined) {
			conditions.push(
				eq(schema.recurringTemplate.templateType, rawInput.templateType),
			);
		}

		if (rawInput?.isActive !== undefined) {
			conditions.push(eq(schema.recurringTemplate.isActive, rawInput.isActive));
		}

		const templates = await db
			.select()
			.from(schema.recurringTemplate)
			.where(and(...conditions))
			.orderBy(desc(schema.recurringTemplate.createdAt));

		return templates;
	});

// ── create ─────────────────────────────────────────────────────────────

const create = permissionProcedure("invoices.create")
	.input(
		z.object({
			name: z.string().min(1),
			templateType: z.enum(["invoice", "expense", "vendor_bill"]),
			frequency: z.enum([
				"weekly",
				"biweekly",
				"monthly",
				"quarterly",
				"annually",
			]),
			nextRunDate: z.string(),
			endDate: z.string().optional(),
			isActive: z.boolean().default(true),
			templateData: z.record(z.string(), z.unknown()),
			customerId: z.string().uuid().optional(),
			supplierId: z.string().uuid().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const createdBy = context.session.user.id;

		const rows = await db
			.insert(schema.recurringTemplate)
			.values({
				organizationId: orgId,
				name: input.name,
				templateType: input.templateType,
				frequency: input.frequency,
				nextRunDate: new Date(input.nextRunDate),
				endDate: input.endDate ? new Date(input.endDate) : null,
				isActive: input.isActive,
				templateData: input.templateData,
				customerId: input.customerId ?? null,
				supplierId: input.supplierId ?? null,
				createdBy,
			})
			.returning();

		const row = rows[0]!;

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "recurring_template",
			entityId: row.id,
			action: "created",
			afterState: row,
			performedBy: createdBy,
		});

		return row;
	});

// ── update ─────────────────────────────────────────────────────────────

const update = permissionProcedure("invoices.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			templateType: z.enum(["invoice", "expense", "vendor_bill"]).optional(),
			frequency: z
				.enum(["weekly", "biweekly", "monthly", "quarterly", "annually"])
				.optional(),
			nextRunDate: z.string().optional(),
			endDate: z.string().optional().nullable(),
			isActive: z.boolean().optional(),
			templateData: z.record(z.string(), z.unknown()).optional(),
			customerId: z.string().uuid().optional().nullable(),
			supplierId: z.string().uuid().optional().nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select()
			.from(schema.recurringTemplate)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Recurring template not found",
			});
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.templateType !== undefined)
			updates.templateType = input.templateType;
		if (input.frequency !== undefined) updates.frequency = input.frequency;
		if (input.nextRunDate !== undefined)
			updates.nextRunDate = new Date(input.nextRunDate);
		if (input.endDate !== undefined)
			updates.endDate = input.endDate ? new Date(input.endDate) : null;
		if (input.isActive !== undefined) updates.isActive = input.isActive;
		if (input.templateData !== undefined)
			updates.templateData = input.templateData;
		if (input.customerId !== undefined)
			updates.customerId = input.customerId ?? null;
		if (input.supplierId !== undefined)
			updates.supplierId = input.supplierId ?? null;

		await db
			.update(schema.recurringTemplate)
			.set(updates)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			);

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "recurring_template",
			entityId: input.id,
			action: "updated",
			beforeState: existing[0],
			afterState: updates,
			performedBy: context.session.user.id,
		});

		return { success: true };
	});

// ── delete ─────────────────────────────────────────────────────────────

const remove = permissionProcedure("invoices.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select({ id: schema.recurringTemplate.id })
			.from(schema.recurringTemplate)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Recurring template not found",
			});
		}

		await db
			.delete(schema.recurringTemplate)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── pause ──────────────────────────────────────────────────────────────

const pause = permissionProcedure("invoices.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select({ id: schema.recurringTemplate.id })
			.from(schema.recurringTemplate)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Recurring template not found",
			});
		}

		await db
			.update(schema.recurringTemplate)
			.set({ isActive: false })
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── resume ─────────────────────────────────────────────────────────────

const resume = permissionProcedure("invoices.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const existing = await db
			.select({ id: schema.recurringTemplate.id })
			.from(schema.recurringTemplate)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Recurring template not found",
			});
		}

		await db
			.update(schema.recurringTemplate)
			.set({ isActive: true })
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── generateNext ───────────────────────────────────────────────────────

const generateNext = permissionProcedure("invoices.create")
	.input(
		z.object({
			id: z.string().uuid(),
			idempotencyKey: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const userId = context.session.user.id;

		const rows = await db
			.select()
			.from(schema.recurringTemplate)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Recurring template not found",
			});
		}

		const template = rows[0]!;

		// Idempotency: if key matches, return without re-generating
		if (
			input.idempotencyKey &&
			template.idempotencyKey === input.idempotencyKey
		) {
			return {
				skipped: true,
				reason: "idempotency_key_already_used",
				templateId: template.id,
			};
		}

		const data = (template.templateData ?? {}) as Record<string, unknown>;
		let generatedId: string;

		if (template.templateType === "invoice") {
			const invoiceNumber = await nextInvoiceNumber(orgId);
			const invoiceRows = await db
				.insert(schema.invoice)
				.values({
					organizationId: orgId,
					locationId: (data.locationId as string | null) ?? null,
					invoiceNumber,
					customerId:
						template.customerId ?? (data.customerId as string | null) ?? null,
					customerName:
						(data.customerName as string | undefined) ?? "Recurring Customer",
					customerAddress: (data.customerAddress as string | null) ?? null,
					customerPhone: (data.customerPhone as string | null) ?? null,
					items: (data.items as Record<string, unknown>[] | undefined) ?? [],
					subtotal: (data.subtotal as string | undefined) ?? "0",
					taxTotal: (data.taxTotal as string | undefined) ?? "0",
					total: (data.total as string | undefined) ?? "0",
					status: "draft",
					discountType: ((data.discountType as string | undefined) ??
						"percent") as "percent" | "fixed",
					discountValue: (data.discountValue as string | undefined) ?? "0",
					taxMode: ((data.taxMode as string | undefined) ?? "invoice") as
						| "invoice"
						| "line",
					taxRate: (data.taxRate as string | undefined) ?? "16.5",
					paymentTerms:
						(data.paymentTerms as string | undefined) ?? "due_on_receipt",
					notes: (data.notes as string | null) ?? null,
					createdBy: userId,
				})
				.returning({ id: schema.invoice.id });
			generatedId = invoiceRows[0]!.id;
		} else if (template.templateType === "expense") {
			const expenseRows = await db
				.insert(schema.expense)
				.values({
					organizationId: orgId,
					amount: (data.amount as string | undefined) ?? "0",
					category: (data.category as string | undefined) ?? "General",
					description:
						(data.description as string | undefined) ?? template.name,
					paymentMethod: (data.paymentMethod as string | null) ?? null,
					referenceNumber: (data.referenceNumber as string | null) ?? null,
					notes: (data.notes as string | null) ?? null,
					supplierId:
						template.supplierId ?? (data.supplierId as string | null) ?? null,
					authorizedBy: userId,
					createdBy: userId,
				})
				.returning({ id: schema.expense.id });
			generatedId = expenseRows[0]!.id;
		} else {
			// vendor_bill
			const billNumber = await nextVendorBillNumber(orgId);
			const billRows = await db
				.insert(schema.vendorBill)
				.values({
					organizationId: orgId,
					locationId: (data.locationId as string | null) ?? null,
					billNumber,
					supplierId:
						template.supplierId ?? (data.supplierId as string | null) ?? null,
					supplierName:
						(data.supplierName as string | undefined) ?? "Recurring Supplier",
					items: (data.items as Record<string, unknown>[] | undefined) ?? [],
					subtotal: (data.subtotal as string | undefined) ?? "0",
					taxTotal: (data.taxTotal as string | undefined) ?? "0",
					total: (data.total as string | undefined) ?? "0",
					status: "draft",
					notes: (data.notes as string | null) ?? null,
					createdBy: userId,
				})
				.returning({ id: schema.vendorBill.id });
			generatedId = billRows[0]!.id;
		}

		// Advance nextRunDate
		const nextRunDate = advanceDate(template.nextRunDate, template.frequency);

		// Deactivate if past endDate
		const newIsActive =
			template.endDate != null && nextRunDate > template.endDate
				? false
				: template.isActive;

		const newIdempotencyKey = crypto.randomUUID();

		await db
			.update(schema.recurringTemplate)
			.set({
				nextRunDate,
				lastGeneratedAt: new Date(),
				totalGenerated: sql`${schema.recurringTemplate.totalGenerated} + 1`,
				idempotencyKey: newIdempotencyKey,
				isActive: newIsActive,
			})
			.where(eq(schema.recurringTemplate.id, template.id));

		await logFinanceEvent(db, {
			organizationId: orgId,
			entityType: "recurring_template",
			entityId: template.id,
			action: "generated",
			afterState: {
				generatedType: template.templateType,
				generatedId,
				nextRunDate,
			},
			performedBy: userId,
		});

		return {
			generatedType: template.templateType,
			generatedId,
			nextRunDate,
			isActive: newIsActive,
		};
	});

// ── preview ────────────────────────────────────────────────────────────

const preview = permissionProcedure("invoices.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const rows = await db
			.select()
			.from(schema.recurringTemplate)
			.where(
				and(
					eq(schema.recurringTemplate.id, input.id),
					eq(schema.recurringTemplate.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Recurring template not found",
			});
		}

		const template = rows[0]!;

		return {
			templateType: template.templateType,
			nextRunDate: template.nextRunDate,
			wouldGenerate: template.templateData,
		};
	});

// ── router export ──────────────────────────────────────────────────────

export const recurringRouter = {
	list,
	create,
	update,
	delete: remove,
	pause,
	resume,
	generateNext,
	preview,
};
