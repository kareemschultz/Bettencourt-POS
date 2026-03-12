import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, inArray, not, or, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { logFinanceEvent } from "../lib/finance-audit";
import { computeInvoiceStatus } from "../lib/finance-status";
import { calculateInvoiceTotalsFromItems } from "../lib/finance-calculations";
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
      agencyName: z.string().optional(),
      contactPersonName: z.string().optional(),
      contactPersonPosition: z.string().optional(),
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
      invoiceNumber: z.string().optional(),
      department: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const invoiceNumber =
      input.invoiceNumber?.trim() || (await nextInvoiceNumber(orgId));
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
        agencyName: input.agencyName ?? null,
        contactPersonName: input.contactPersonName ?? null,
        contactPersonPosition: input.contactPersonPosition ?? null,
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
        department: input.department ?? null,
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
      agencyName: z.string().optional(),
      contactPersonName: z.string().optional(),
      contactPersonPosition: z.string().optional(),
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
      department: z.string().optional(),
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
    if (input.agencyName !== undefined) updates.agencyName = input.agencyName;
    if (input.contactPersonName !== undefined)
      updates.contactPersonName = input.contactPersonName;
    if (input.contactPersonPosition !== undefined)
      updates.contactPersonPosition = input.contactPersonPosition;
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
    if (input.department !== undefined) updates.department = input.department;

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

    const total = Number(rows[0]?.total);
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
    const userId = context.session.user.id;
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
    await db.insert(schema.invoiceLifecycleEvent).values({
      organizationId: orgId,
      entityType: "invoice",
      entityId: input.id,
      eventType: "sent",
      details: {},
      createdBy: userId,
    });
    return { success: true };
  });

// ── recordPayment ──────────────────────────────────────────────────────

const recordPayment = permissionProcedure("invoices.update")
  .input(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.number(),
      paymentMethod: z.string(),
      referenceNumber: z.string().optional(),
      chequeNumber: z.string().optional(),
      chequeDepositDate: z.string().optional(),
      datePaid: z.string(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const userId = context.session.user.id;

    // Verify invoice belongs to org
    const invoiceRows = await db
      .select()
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.id, input.invoiceId),
          eq(schema.invoice.organizationId, orgId),
        ),
      )
      .limit(1);

    if (invoiceRows.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    }

    const invoice = invoiceRows[0]!;
    const beforeState = invoice.status;

    // Insert payment record
    await db.insert(schema.invoicePayment).values({
      organizationId: orgId,
      invoiceId: input.invoiceId,
      amount: String(input.amount),
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber ?? null,
      chequeNumber: input.chequeNumber ?? null,
      chequeDepositDate: input.chequeDepositDate
        ? new Date(input.chequeDepositDate)
        : null,
      datePaid: new Date(input.datePaid),
      notes: input.notes ?? null,
      isReversal: false,
      createdBy: userId,
    });

    // Recalculate total amount paid (sum all non-reversal payments)
    const sumRows = await db
      .select({
        sum: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(schema.invoicePayment)
      .where(
        and(
          eq(schema.invoicePayment.invoiceId, input.invoiceId),
          eq(schema.invoicePayment.isReversal, false),
        ),
      );

    const newAmountPaid = sumRows[0]?.sum ?? "0";

    // Compute new status
    const newStatus = computeInvoiceStatus(
      Number(invoice.total),
      Number(newAmountPaid),
      invoice.dueDate,
      invoice.status,
    );

    // Update invoice
    const updatedRows = await db
      .update(schema.invoice)
      .set({
        amountPaid: newAmountPaid,
        status: newStatus,
        datePaid:
          newStatus === "paid" ? new Date(input.datePaid) : invoice.datePaid,
      })
      .where(eq(schema.invoice.id, input.invoiceId))
      .returning();

    // Log audit event
    await logFinanceEvent(db, {
      organizationId: orgId,
      entityType: "invoice",
      entityId: input.invoiceId,
      action: "payment_recorded",
      beforeState: beforeState,
      afterState: newStatus,
      performedBy: userId,
      notes: input.notes,
    });

    return updatedRows[0]!;
  });

// ── getPaymentHistory ──────────────────────────────────────────────────

const getPaymentHistory = permissionProcedure("invoices.read")
  .input(z.object({ invoiceId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);

    // Verify invoice belongs to org
    const invoiceRows = await db
      .select({ id: schema.invoice.id })
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.id, input.invoiceId),
          eq(schema.invoice.organizationId, orgId),
        ),
      )
      .limit(1);

    if (invoiceRows.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    }

    const payments = await db
      .select()
      .from(schema.invoicePayment)
      .where(eq(schema.invoicePayment.invoiceId, input.invoiceId))
      .orderBy(desc(schema.invoicePayment.createdAt));

    return payments;
  });

// ── reversePayment ─────────────────────────────────────────────────────

const reversePayment = permissionProcedure("invoices.update")
  .input(
    z.object({
      paymentId: z.string().uuid(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const userId = context.session.user.id;

    // Fetch original payment
    const paymentRows = await db
      .select()
      .from(schema.invoicePayment)
      .where(eq(schema.invoicePayment.id, input.paymentId))
      .limit(1);

    if (paymentRows.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Payment not found" });
    }

    const originalPayment = paymentRows[0]!;

    // Verify the invoice belongs to the org
    const invoiceRows = await db
      .select()
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.id, originalPayment.invoiceId),
          eq(schema.invoice.organizationId, orgId),
        ),
      )
      .limit(1);

    if (invoiceRows.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    }

    const invoice = invoiceRows[0]!;

    // Cannot reverse a reversal
    if (originalPayment.isReversal) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot reverse a reversal payment",
      });
    }

    // Insert reversal record
    await db.insert(schema.invoicePayment).values({
      organizationId: orgId,
      invoiceId: originalPayment.invoiceId,
      amount: String(-Math.abs(Number(originalPayment.amount))),
      paymentMethod: originalPayment.paymentMethod,
      referenceNumber: originalPayment.referenceNumber,
      chequeNumber: originalPayment.chequeNumber,
      chequeDepositDate: originalPayment.chequeDepositDate,
      datePaid: originalPayment.datePaid,
      notes: input.notes ?? null,
      isReversal: true,
      createdBy: userId,
    });

    // Recalculate total amount paid (sum all non-reversal payments)
    const sumRows = await db
      .select({
        sum: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(schema.invoicePayment)
      .where(
        and(
          eq(schema.invoicePayment.invoiceId, originalPayment.invoiceId),
          eq(schema.invoicePayment.isReversal, false),
        ),
      );

    const newAmountPaid = sumRows[0]?.sum ?? "0";

    // Recompute status
    const newStatus = computeInvoiceStatus(
      Number(invoice.total),
      Number(newAmountPaid),
      invoice.dueDate,
      invoice.status,
    );

    // Update invoice
    const updatedRows = await db
      .update(schema.invoice)
      .set({
        amountPaid: newAmountPaid,
        status: newStatus,
      })
      .where(eq(schema.invoice.id, originalPayment.invoiceId))
      .returning();

    // Log audit event
    await logFinanceEvent(db, {
      organizationId: orgId,
      entityType: "invoice",
      entityId: originalPayment.invoiceId,
      action: "reversed",
      beforeState: invoice.status,
      afterState: newStatus,
      performedBy: userId,
      notes: input.notes,
    });

    return updatedRows[0]!;
  });

// ── listBillableExpenses ───────────────────────────────────────────────

const listBillableExpenses = permissionProcedure("invoices.read")
  .input(
    z
      .object({
        customerId: z.string().uuid().optional(),
        status: z.enum(["uninvoiced", "invoiced"]).default("uninvoiced"),
      })
      .optional(),
  )
  .handler(async ({ input: rawInput, context }) => {
    const orgId = requireOrganizationId(context);
    const status = rawInput?.status ?? "uninvoiced";
    const rows = await db
      .select()
      .from(schema.expense)
      .where(
        and(
          eq(schema.expense.organizationId, orgId),
          eq(schema.expense.billable, true),
          rawInput?.customerId
            ? eq(schema.expense.customerId, rawInput.customerId)
            : undefined,
          status === "uninvoiced"
            ? sql`${schema.expense.invoicedAt} IS NULL`
            : sql`${schema.expense.invoicedAt} IS NOT NULL`,
        ),
      )
      .orderBy(desc(schema.expense.createdAt));
    return rows;
  });

// ── addBillableExpensesToInvoice ───────────────────────────────────────

const addBillableExpensesToInvoice = permissionProcedure("invoices.update")
  .input(
    z.object({
      invoiceId: z.string().uuid(),
      expenseIds: z.array(z.string().uuid()).min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const userId = context.session.user.id;
    const invoiceRows = await db
      .select()
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.id, input.invoiceId),
          eq(schema.invoice.organizationId, orgId),
        ),
      )
      .limit(1);
    if (invoiceRows.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
    }
    const invoice = invoiceRows[0]!;
    const expenses = await db
      .select()
      .from(schema.expense)
      .where(
        and(
          eq(schema.expense.organizationId, orgId),
          inArray(schema.expense.id, input.expenseIds),
          eq(schema.expense.billable, true),
          sql`${schema.expense.invoicedAt} IS NULL`,
        ),
      );
    if (expenses.length !== input.expenseIds.length) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Some expenses are not billable or are already invoiced",
      });
    }
    if (invoice.customerId) {
      const mismatch = expenses.some(
        (e) => e.customerId && e.customerId !== invoice.customerId,
      );
      if (mismatch) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Selected expenses must belong to the invoice customer",
        });
      }
    }
    const existingItems = Array.isArray(invoice.items)
      ? (invoice.items as Array<Record<string, unknown>>)
      : [];
    const addedItems = expenses.map((e) => ({
      id: crypto.randomUUID(),
      description: `Billable Expense - ${e.category}: ${e.description}`,
      quantity: 1,
      unitPrice: Number(e.amount),
      total: Number(e.amount),
      taxExempt: false,
      expenseId: e.id,
    }));
    const mergedItems = [...existingItems, ...addedItems];
    const totals = calculateInvoiceTotalsFromItems({
      items: mergedItems,
      taxRate: Number(invoice.taxRate),
      discountType: (invoice.discountType === "fixed" ? "fixed" : "percent") as
        | "fixed"
        | "percent",
      discountValue: Number(invoice.discountValue),
      taxMode: invoice.taxMode === "line" ? "line" : "invoice",
    });
    await db.transaction(async (tx) => {
      await tx
        .update(schema.invoice)
        .set({
          items: totals.items as unknown as Record<string, unknown>[],
          subtotal: String(totals.subtotal),
          taxTotal: String(totals.taxTotal),
          total: String(totals.total),
        })
        .where(eq(schema.invoice.id, invoice.id));
      for (const item of addedItems) {
        await tx
          .update(schema.expense)
          .set({
            invoicedAt: new Date(),
            invoiceId: invoice.id,
            invoiceLineId: String(item.id),
          })
          .where(eq(schema.expense.id, String(item.expenseId)));
      }
    });
    await logFinanceEvent(db, {
      organizationId: orgId,
      entityType: "invoice",
      entityId: invoice.id,
      action: "billable_expenses_added",
      afterState: {
        expenseIds: input.expenseIds,
        addedCount: addedItems.length,
      },
      performedBy: userId,
    });
    return { success: true, addedCount: addedItems.length };
  });

// ── customer payment allocation ledger ────────────────────────────────

const createUnappliedPayment = permissionProcedure("invoices.update")
  .input(
    z.object({
      customerId: z.string().uuid(),
      amount: z.number().positive(),
      paymentMethod: z.string(),
      datePaid: z.string(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const userId = context.session.user.id;
    const rows = await db
      .insert(schema.customerPayment)
      .values({
        organizationId: orgId,
        customerId: input.customerId,
        totalAmount: String(input.amount),
        unappliedAmount: String(input.amount),
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber ?? null,
        datePaid: new Date(input.datePaid),
        notes: input.notes ?? null,
        status: "open",
        createdBy: userId,
      })
      .returning();
    const payment = rows[0]!;
    await db.insert(schema.customerPaymentLedger).values({
      organizationId: orgId,
      customerPaymentId: payment.id,
      action: "create",
      amount: String(input.amount),
      details: {},
      createdBy: userId,
    });
    return payment;
  });

const allocateUnappliedPayment = permissionProcedure("invoices.update")
  .input(
    z.object({
      customerPaymentId: z.string().uuid(),
      allocations: z
        .array(
          z.object({
            invoiceId: z.string().uuid(),
            amount: z.number().positive(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const userId = context.session.user.id;
    const paymentRows = await db
      .select()
      .from(schema.customerPayment)
      .where(
        and(
          eq(schema.customerPayment.id, input.customerPaymentId),
          eq(schema.customerPayment.organizationId, orgId),
        ),
      )
      .limit(1);
    if (paymentRows.length === 0) {
      throw new ORPCError("NOT_FOUND", {
        message: "Customer payment not found",
      });
    }
    const payment = paymentRows[0]!;
    const allocationTotal = input.allocations.reduce(
      (sum, a) => sum + a.amount,
      0,
    );
    if (allocationTotal > Number(payment.unappliedAmount)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Allocation exceeds unapplied balance",
      });
    }
    await db.transaction(async (tx) => {
      for (const alloc of input.allocations) {
        const invRows = await tx
          .select()
          .from(schema.invoice)
          .where(
            and(
              eq(schema.invoice.id, alloc.invoiceId),
              eq(schema.invoice.organizationId, orgId),
              eq(schema.invoice.customerId, payment.customerId),
            ),
          )
          .limit(1);
        if (invRows.length === 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Allocation invoice is invalid for this customer",
          });
        }
        const inv = invRows[0]!;
        const remaining = Math.max(
          Number(inv.total) - Number(inv.amountPaid),
          0,
        );
        if (alloc.amount > remaining + 0.0001) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Allocation exceeds invoice balance for ${inv.invoiceNumber}`,
          });
        }
        await tx.insert(schema.customerPaymentAllocation).values({
          organizationId: orgId,
          customerPaymentId: payment.id,
          invoiceId: inv.id,
          amount: String(alloc.amount),
          createdBy: userId,
        });
        const nextPaid = Number(inv.amountPaid) + alloc.amount;
        const nextStatus = computeInvoiceStatus(
          Number(inv.total),
          nextPaid,
          inv.dueDate,
          inv.status,
        );
        await tx
          .update(schema.invoice)
          .set({ amountPaid: String(nextPaid), status: nextStatus })
          .where(eq(schema.invoice.id, inv.id));
      }
      const nextUnapplied = Number(payment.unappliedAmount) - allocationTotal;
      await tx
        .update(schema.customerPayment)
        .set({
          unappliedAmount: String(nextUnapplied),
          status: nextUnapplied <= 0 ? "fully_applied" : "open",
        })
        .where(eq(schema.customerPayment.id, payment.id));
      await tx.insert(schema.customerPaymentLedger).values({
        organizationId: orgId,
        customerPaymentId: payment.id,
        action: "apply",
        amount: String(allocationTotal),
        details: { allocations: input.allocations },
        createdBy: userId,
      });
    });
    return { success: true };
  });

const getCustomerPaymentLedger = permissionProcedure("invoices.read")
  .input(z.object({ customerPaymentId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const rows = await db
      .select()
      .from(schema.customerPaymentLedger)
      .where(
        and(
          eq(schema.customerPaymentLedger.organizationId, orgId),
          eq(
            schema.customerPaymentLedger.customerPaymentId,
            input.customerPaymentId,
          ),
        ),
      )
      .orderBy(desc(schema.customerPaymentLedger.createdAt));
    return rows;
  });

// ── lifecycle schedule/timeline ────────────────────────────────────────

const scheduleSend = permissionProcedure("invoices.update")
  .input(
    z.object({
      entityType: z.enum(["invoice", "quotation"]),
      entityId: z.string().uuid(),
      scheduledSendAt: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const userId = context.session.user.id;
    if (input.entityType === "invoice") {
      await db
        .update(schema.invoice)
        .set({ scheduledSendAt: new Date(input.scheduledSendAt) })
        .where(
          and(
            eq(schema.invoice.id, input.entityId),
            eq(schema.invoice.organizationId, orgId),
          ),
        );
    } else {
      await db
        .update(schema.quotation)
        .set({ scheduledSendAt: new Date(input.scheduledSendAt) })
        .where(
          and(
            eq(schema.quotation.id, input.entityId),
            eq(schema.quotation.organizationId, orgId),
          ),
        );
    }
    await db.insert(schema.invoiceLifecycleEvent).values({
      organizationId: orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: "scheduled",
      details: { scheduledSendAt: input.scheduledSendAt },
      createdBy: userId,
    });
    return { success: true };
  });

const getLifecycleTimeline = permissionProcedure("invoices.read")
  .input(
    z.object({
      entityType: z.enum(["invoice", "quotation"]),
      entityId: z.string().uuid(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const rows = await db
      .select()
      .from(schema.invoiceLifecycleEvent)
      .where(
        and(
          eq(schema.invoiceLifecycleEvent.organizationId, orgId),
          eq(schema.invoiceLifecycleEvent.entityType, input.entityType),
          eq(schema.invoiceLifecycleEvent.entityId, input.entityId),
        ),
      )
      .orderBy(desc(schema.invoiceLifecycleEvent.createdAt));
    return rows;
  });

// ── getFinanceDashboard ────────────────────────────────────────────────

const getFinanceDashboard = permissionProcedure("reports.read")
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const orgId = requireOrganizationId(context);

    const [
      receivableResult,
      payableResult,
      overdueInvoicesResult,
      overdueVendorBillsResult,
      cashFlowResult,
      revenueByMonthResult,
      expenseByMonthResult,
      topCustomersResult,
      topSuppliersResult,
    ] = await Promise.all([
      // totalReceivable
      db.execute(sql`
				SELECT COALESCE(SUM(total::numeric - amount_paid::numeric), 0)::text AS total
				FROM invoice
				WHERE organization_id = ${orgId}
				  AND status NOT IN ('paid', 'voided')
			`),
      // totalPayable
      db.execute(sql`
				SELECT COALESCE(SUM(total::numeric - amount_paid::numeric), 0)::text AS total
				FROM vendor_bill
				WHERE organization_id = ${orgId}
				  AND status NOT IN ('paid', 'voided')
			`),
      // overdueInvoices
      db.execute(sql`
				SELECT COUNT(*)::int AS count,
				       COALESCE(SUM(total::numeric - amount_paid::numeric), 0)::text AS total
				FROM invoice
				WHERE organization_id = ${orgId}
				  AND status = 'overdue'
			`),
      // overdueVendorBills
      db.execute(sql`
				SELECT COUNT(*)::int AS count,
				       COALESCE(SUM(total::numeric - amount_paid::numeric), 0)::text AS total
				FROM vendor_bill
				WHERE organization_id = ${orgId}
				  AND status = 'overdue'
			`),
      // cashFlow30Days
      db.execute(sql`
				SELECT
					COALESCE((
						SELECT SUM(ip.amount::numeric)
						FROM invoice_payment ip
						JOIN invoice i ON i.id = ip.invoice_id
						WHERE i.organization_id = ${orgId}
						  AND ip.date_paid >= NOW() - INTERVAL '30 days'
						  AND ip.is_reversal = false
					), 0)
					-
					COALESCE((
						SELECT SUM(vbp.amount::numeric)
						FROM vendor_bill_payment vbp
						JOIN vendor_bill vb ON vb.id = vbp.vendor_bill_id
						WHERE vb.organization_id = ${orgId}
						  AND vbp.date_paid >= NOW() - INTERVAL '30 days'
						  AND vbp.is_reversal = false
					), 0)
					-
					COALESCE((
						SELECT SUM(e.amount::numeric)
						FROM expense e
						WHERE e.organization_id = ${orgId}
						  AND e.created_at >= NOW() - INTERVAL '30 days'
					), 0)
				AS net_cash_flow
			`),
      // revenueByMonth (last 12 months)
      db.execute(sql`
				SELECT
					TO_CHAR(DATE_TRUNC('month', ip.date_paid), 'YYYY-MM') AS month,
					COALESCE(SUM(ip.amount::numeric), 0)::text AS total
				FROM invoice_payment ip
				JOIN invoice i ON i.id = ip.invoice_id
				WHERE i.organization_id = ${orgId}
				  AND ip.date_paid >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
				  AND ip.is_reversal = false
				GROUP BY DATE_TRUNC('month', ip.date_paid)
				ORDER BY DATE_TRUNC('month', ip.date_paid) ASC
			`),
      // expenseByMonth (last 12 months)
      db.execute(sql`
				SELECT
					TO_CHAR(DATE_TRUNC('month', e.created_at), 'YYYY-MM') AS month,
					COALESCE(SUM(e.amount::numeric), 0)::text AS total
				FROM expense e
				WHERE e.organization_id = ${orgId}
				  AND e.created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
				GROUP BY DATE_TRUNC('month', e.created_at)
				ORDER BY DATE_TRUNC('month', e.created_at) ASC
			`),
      // topCustomersByRevenue
      db.execute(sql`
				SELECT
					i.customer_name AS "customerName",
					i.customer_id AS "customerId",
					COALESCE(SUM(ip.amount::numeric), 0)::text AS total
				FROM invoice_payment ip
				JOIN invoice i ON i.id = ip.invoice_id
				WHERE i.organization_id = ${orgId}
				  AND ip.is_reversal = false
				GROUP BY i.customer_name, i.customer_id
				ORDER BY SUM(ip.amount::numeric) DESC
				LIMIT 5
			`),
      // topSuppliersBySpend
      db.execute(sql`
				SELECT
					vb.supplier_name AS "supplierName",
					vb.supplier_id AS "supplierId",
					COALESCE(SUM(vbp.amount::numeric), 0)::text AS total
				FROM vendor_bill_payment vbp
				JOIN vendor_bill vb ON vb.id = vbp.vendor_bill_id
				WHERE vb.organization_id = ${orgId}
				  AND vbp.is_reversal = false
				GROUP BY vb.supplier_name, vb.supplier_id
				ORDER BY SUM(vbp.amount::numeric) DESC
				LIMIT 5
			`),
    ]);

    return {
      totalReceivable:
        (receivableResult.rows[0] as Record<string, unknown>)?.total ?? "0",
      totalPayable:
        (payableResult.rows[0] as Record<string, unknown>)?.total ?? "0",
      overdueInvoices: {
        count:
          ((overdueInvoicesResult.rows[0] as Record<string, unknown>)
            ?.count as number) ?? 0,
        total:
          (overdueInvoicesResult.rows[0] as Record<string, unknown>)?.total ??
          "0",
      },
      overdueVendorBills: {
        count:
          ((overdueVendorBillsResult.rows[0] as Record<string, unknown>)
            ?.count as number) ?? 0,
        total:
          (overdueVendorBillsResult.rows[0] as Record<string, unknown>)
            ?.total ?? "0",
      },
      cashFlow30Days:
        (cashFlowResult.rows[0] as Record<string, unknown>)?.net_cash_flow ??
        "0",
      revenueByMonth: revenueByMonthResult.rows as Array<{
        month: string;
        total: string;
      }>,
      expenseByMonth: expenseByMonthResult.rows as Array<{
        month: string;
        total: string;
      }>,
      topCustomersByRevenue: topCustomersResult.rows as Array<{
        customerName: string;
        customerId: string | null;
        total: string;
      }>,
      topSuppliersBySpend: topSuppliersResult.rows as Array<{
        supplierName: string;
        supplierId: string | null;
        total: string;
      }>,
    };
  });

// ── getReceivableAging ─────────────────────────────────────────────────

const getReceivableAging = permissionProcedure("reports.read")
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const orgId = requireOrganizationId(context);

    const invoices = await db
      .select()
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.organizationId, orgId),
          not(inArray(schema.invoice.status, ["paid", "voided", "draft"])),
        ),
      );

    const now = new Date();

    // Group by customer
    const customerMap = new Map<
      string,
      {
        customerName: string;
        customerId: string | null;
        current: number;
        days30: number;
        days60: number;
        days90: number;
        days90plus: number;
      }
    >();

    for (const inv of invoices) {
      const key = inv.customerId ?? `name:${inv.customerName}`;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customerName: inv.customerName,
          customerId: inv.customerId,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          days90plus: 0,
        });
      }
      const entry = customerMap.get(key)!;
      const balance = Number(inv.total) - Number(inv.amountPaid);
      if (balance <= 0) continue;

      const dueDate = inv.dueDate;
      if (!dueDate || now <= dueDate) {
        // Not yet overdue — current bucket
        entry.current += balance;
      } else {
        const daysPastDue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysPastDue <= 30) {
          entry.days30 += balance;
        } else if (daysPastDue <= 60) {
          entry.days60 += balance;
        } else if (daysPastDue <= 90) {
          entry.days90 += balance;
        } else {
          entry.days90plus += balance;
        }
      }
    }

    return Array.from(customerMap.values()).map((e) => ({
      customerName: e.customerName,
      customerId: e.customerId,
      current: e.current.toFixed(2),
      days30: e.days30.toFixed(2),
      days60: e.days60.toFixed(2),
      days90: e.days90.toFixed(2),
      days90plus: e.days90plus.toFixed(2),
      total: (
        e.current +
        e.days30 +
        e.days60 +
        e.days90 +
        e.days90plus
      ).toFixed(2),
    }));
  });

// ── getPayableAging ────────────────────────────────────────────────────

const getPayableAging = permissionProcedure("reports.read")
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const orgId = requireOrganizationId(context);

    const bills = await db
      .select()
      .from(schema.vendorBill)
      .where(
        and(
          eq(schema.vendorBill.organizationId, orgId),
          not(inArray(schema.vendorBill.status, ["paid", "voided", "draft"])),
        ),
      );

    const now = new Date();

    // Group by supplier
    const supplierMap = new Map<
      string,
      {
        supplierName: string;
        supplierId: string | null;
        current: number;
        days30: number;
        days60: number;
        days90: number;
        days90plus: number;
      }
    >();

    for (const bill of bills) {
      const key = bill.supplierId ?? `name:${bill.supplierName}`;
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplierName: bill.supplierName,
          supplierId: bill.supplierId,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          days90plus: 0,
        });
      }
      const entry = supplierMap.get(key)!;
      const balance = Number(bill.total) - Number(bill.amountPaid);
      if (balance <= 0) continue;

      const dueDate = bill.dueDate;
      if (!dueDate || now <= dueDate) {
        entry.current += balance;
      } else {
        const daysPastDue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysPastDue <= 30) {
          entry.days30 += balance;
        } else if (daysPastDue <= 60) {
          entry.days60 += balance;
        } else if (daysPastDue <= 90) {
          entry.days90 += balance;
        } else {
          entry.days90plus += balance;
        }
      }
    }

    return Array.from(supplierMap.values()).map((e) => ({
      supplierName: e.supplierName,
      supplierId: e.supplierId,
      current: e.current.toFixed(2),
      days30: e.days30.toFixed(2),
      days60: e.days60.toFixed(2),
      days90: e.days90.toFixed(2),
      days90plus: e.days90plus.toFixed(2),
      total: (
        e.current +
        e.days30 +
        e.days60 +
        e.days90 +
        e.days90plus
      ).toFixed(2),
    }));
  });

// ── getCustomerStatement ───────────────────────────────────────────────

const getCustomerStatement = permissionProcedure("reports.read")
  .input(
    z.object({
      customerId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    // Include full end day
    end.setHours(23, 59, 59, 999);

    // Fetch invoices for this customer in date range
    const invoices = await db
      .select()
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.organizationId, orgId),
          eq(schema.invoice.customerId, input.customerId),
          sql`COALESCE(issued_date, created_at) >= ${start}`,
          sql`COALESCE(issued_date, created_at) <= ${end}`,
        ),
      )
      .orderBy(sql`COALESCE(issued_date, created_at) ASC`);

    if (invoices.length === 0) {
      return [];
    }

    const invoiceIds = invoices.map((i) => i.id);

    // Fetch payments for those invoices in date range
    const payments = await db
      .select()
      .from(schema.invoicePayment)
      .where(
        and(
          inArray(schema.invoicePayment.invoiceId, invoiceIds),
          sql`date_paid >= ${start}`,
          sql`date_paid <= ${end}`,
        ),
      )
      .orderBy(schema.invoicePayment.datePaid);

    // Build chronological statement entries
    type StatementEntry = {
      date: string;
      description: string;
      reference: string;
      debit: string;
      credit: string;
      sortKey: number;
    };

    const entries: StatementEntry[] = [];

    for (const inv of invoices) {
      const date = inv.issuedDate ?? inv.createdAt;
      entries.push({
        date: date.toISOString().split("T")[0]!,
        description: `Invoice #${inv.invoiceNumber}`,
        reference: inv.invoiceNumber,
        debit: inv.total,
        credit: "0.00",
        sortKey: date.getTime(),
      });
    }

    for (const pmt of payments) {
      entries.push({
        date: pmt.datePaid.toISOString().split("T")[0]!,
        description: `Payment - ${pmt.paymentMethod}${pmt.referenceNumber ? ` (${pmt.referenceNumber})` : ""}`,
        reference: pmt.referenceNumber ?? pmt.id,
        debit: "0.00",
        credit: pmt.amount,
        sortKey: pmt.datePaid.getTime(),
      });
    }

    // Sort chronologically
    entries.sort((a, b) => a.sortKey - b.sortKey);

    // Build running balance
    let balance = 0;
    return entries.map((entry) => {
      balance += Number(entry.debit) - Number(entry.credit);
      return {
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        debit: entry.debit,
        credit: entry.credit,
        balance: balance.toFixed(2),
      };
    });
  });

// ── getCustomerBalanceSummary ──────────────────────────────────────────

const getCustomerBalanceSummary = permissionProcedure("reports.read")
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const orgId = requireOrganizationId(context);

    const result = await db.execute(sql`
			SELECT
				customer_id AS "customerId",
				customer_name AS "customerName",
				COALESCE(SUM(total::numeric - amount_paid::numeric), 0)::text AS "totalOutstanding"
			FROM invoice
			WHERE organization_id = ${orgId}
			  AND status NOT IN ('paid', 'voided', 'cancelled')
			GROUP BY customer_id, customer_name
			HAVING SUM(total::numeric - amount_paid::numeric) > 0
			ORDER BY SUM(total::numeric - amount_paid::numeric) DESC
			LIMIT 50
		`);

    return result.rows as Array<{
      customerId: string | null;
      customerName: string;
      totalOutstanding: string;
    }>;
  });

// ── getTaxSummary ──────────────────────────────────────────────────────

const getTaxSummary = permissionProcedure("reports.read")
  .input(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    const [
      collectedResult,
      paidBillsResult,
      paidExpensesResult,
      byMonthResult,
    ] = await Promise.all([
      // Tax collected: paid invoices in period
      db.execute(sql`
					SELECT COALESCE(SUM(tax_total::numeric), 0)::text AS total
					FROM invoice
					WHERE organization_id = ${orgId}
					  AND status = 'paid'
					  AND date_paid >= ${start}
					  AND date_paid <= ${end}
				`),
      // Tax paid via vendor bills: paid bills in period
      db.execute(sql`
					SELECT COALESCE(SUM(tax_total::numeric), 0)::text AS total
					FROM vendor_bill
					WHERE organization_id = ${orgId}
					  AND status = 'paid'
					  AND date_paid >= ${start}
					  AND date_paid <= ${end}
				`),
      // Tax expenses: approximate via expenses categorized as 'tax'
      db.execute(sql`
					SELECT COALESCE(SUM(amount::numeric), 0)::text AS total
					FROM expense
					WHERE organization_id = ${orgId}
					  AND category = 'tax'
					  AND created_at >= ${start}
					  AND created_at <= ${end}
				`),
      // By month breakdown
      db.execute(sql`
					SELECT
						TO_CHAR(DATE_TRUNC('month', date_paid), 'YYYY-MM') AS month,
						COALESCE(SUM(tax_total::numeric), 0)::text AS collected,
						0::text AS paid
					FROM invoice
					WHERE organization_id = ${orgId}
					  AND status = 'paid'
					  AND date_paid >= ${start}
					  AND date_paid <= ${end}
					GROUP BY DATE_TRUNC('month', date_paid)
					ORDER BY DATE_TRUNC('month', date_paid) ASC
				`),
    ]);

    const collected = Number(
      (collectedResult.rows[0] as Record<string, unknown>)?.total ?? "0",
    );
    const paidBills = Number(
      (paidBillsResult.rows[0] as Record<string, unknown>)?.total ?? "0",
    );
    const paidExpenses = Number(
      (paidExpensesResult.rows[0] as Record<string, unknown>)?.total ?? "0",
    );
    const paid = paidBills + paidExpenses;

    return {
      collected: collected.toFixed(2),
      paid: paid.toFixed(2),
      net: (collected - paid).toFixed(2),
      byMonth: byMonthResult.rows as Array<{
        month: string;
        collected: string;
        paid: string;
      }>,
    };
  });

// ── listDepartments ────────────────────────────────────────────────────

const listDepartments = permissionProcedure("invoices.read").handler(
  async ({ context }) => {
    const orgId = requireOrganizationId(context);
    const results = await db.execute<{ department: string }>(sql`
			SELECT DISTINCT department FROM invoice
			WHERE organization_id = ${orgId} AND department IS NOT NULL AND department <> ''
			UNION
			SELECT DISTINCT department FROM quotation
			WHERE organization_id = ${orgId} AND department IS NOT NULL AND department <> ''
			UNION
			SELECT DISTINCT department FROM credit_note
			WHERE organization_id = ${orgId} AND department IS NOT NULL AND department <> ''
			UNION
			SELECT DISTINCT department FROM vendor_bill
			WHERE organization_id = ${orgId} AND department IS NOT NULL AND department <> ''
			ORDER BY department
		`);
    return results.rows.map((r) => r.department);
  },
);

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
  recordPayment,
  getPaymentHistory,
  reversePayment,
  getFinanceDashboard,
  getReceivableAging,
  getPayableAging,
  getCustomerStatement,
  getCustomerBalanceSummary,
  getTaxSummary,
  listDepartments,
  listBillableExpenses,
  addBillableExpensesToInvoice,
  createUnappliedPayment,
  allocateUnappliedPayment,
  getCustomerPaymentLedger,
  scheduleSend,
  getLifecycleTimeline,
};
