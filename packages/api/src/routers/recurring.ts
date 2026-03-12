import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { logFinanceEvent } from "../lib/finance-audit";
import { normalizeRecurringTemplateData } from "../lib/finance-calculations";
import { requireOrganizationId } from "../lib/org-context";
import { computeRecurringLifecycle } from "../lib/recurring-lifecycle";

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

async function recordRun(
  dbClient: typeof db,
  params: {
    organizationId: string;
    templateId: string;
    generatedType: string;
    createdBy: string;
    status: "success" | "failed";
    generatedId?: string;
    details?: Record<string, unknown>;
  },
) {
  await dbClient.insert(schema.recurringTemplateRun).values({
    organizationId: params.organizationId,
    templateId: params.templateId,
    generatedType: params.generatedType,
    generatedId: params.generatedId ?? null,
    status: params.status,
    details: params.details ?? {},
    createdBy: params.createdBy,
  });
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

function validatePriceAutomation(mode: string, value: number | undefined) {
  if (mode === "none") return;
  if (value === undefined || !Number.isFinite(value)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Price automation value is required for selected mode",
    });
  }
  if (mode === "percent_increase" && value < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Percent increase must be zero or greater",
    });
  }
  if (mode === "fixed_update" && value < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Fixed update price must be zero or greater",
    });
  }
}

// ── list ───────────────────────────────────────────────────────────────

const list = permissionProcedure("invoices.read")
  .input(
    z
      .object({
        templateType: z.enum(["invoice", "expense", "vendor_bill"]).optional(),
        isActive: z.boolean().optional(),
        status: z.enum(["active", "paused", "completed"]).optional(),
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

    if (rawInput?.status !== undefined) {
      conditions.push(eq(schema.recurringTemplate.status, rawInput.status));
    }

    const templates = await db
      .select()
      .from(schema.recurringTemplate)
      .where(and(...conditions))
      .orderBy(desc(schema.recurringTemplate.createdAt));

    // Backward-compatible shape for existing UI (type alias)
    return templates.map((t) => ({ ...t, type: t.templateType }));
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
      startDate: z.string().optional(),
      nextRunDate: z.string(),
      endDate: z.string().optional(),
      remainingCycles: z.number().int().positive().optional(),
      isActive: z.boolean().default(true),
      status: z.enum(["active", "paused", "completed"]).optional(),
      priceAutomationMode: z
        .enum(["none", "fixed_update", "percent_increase"])
        .default("none"),
      priceAutomationValue: z.number().optional(),
      templateData: z.record(z.string(), z.unknown()),
      customerId: z.string().uuid().optional(),
      supplierId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);
    const createdBy = context.session.user.id;

    validatePriceAutomation(
      input.priceAutomationMode,
      input.priceAutomationValue,
    );

    const rows = await db
      .insert(schema.recurringTemplate)
      .values({
        organizationId: orgId,
        name: input.name,
        templateType: input.templateType,
        frequency: input.frequency,
        startDate: input.startDate ? new Date(input.startDate) : null,
        nextRunDate: new Date(input.nextRunDate),
        remainingCycles: input.remainingCycles ?? null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isActive: input.isActive,
        status: input.status ?? (input.isActive ? "active" : "paused"),
        priceAutomationMode: input.priceAutomationMode,
        priceAutomationValue: String(input.priceAutomationValue ?? 0),
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
      startDate: z.string().optional().nullable(),
      nextRunDate: z.string().optional(),
      remainingCycles: z.number().int().positive().optional().nullable(),
      endDate: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
      status: z.enum(["active", "paused", "completed"]).optional(),
      priceAutomationMode: z
        .enum(["none", "fixed_update", "percent_increase"])
        .optional(),
      priceAutomationValue: z.number().optional(),
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

    const nextMode =
      input.priceAutomationMode ?? existing[0]!.priceAutomationMode;
    const nextValue =
      input.priceAutomationValue ??
      Number(existing[0]!.priceAutomationValue ?? 0);
    validatePriceAutomation(nextMode, nextValue);
    if (input.name !== undefined) updates.name = input.name;
    if (input.templateType !== undefined)
      updates.templateType = input.templateType;
    if (input.frequency !== undefined) updates.frequency = input.frequency;
    if (input.startDate !== undefined)
      updates.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.nextRunDate !== undefined)
      updates.nextRunDate = new Date(input.nextRunDate);
    if (input.remainingCycles !== undefined)
      updates.remainingCycles = input.remainingCycles;
    if (input.endDate !== undefined)
      updates.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.isActive !== undefined) {
      updates.isActive = input.isActive;
      updates.status = input.isActive ? "active" : "paused";
    }
    if (input.status !== undefined) {
      updates.status = input.status;
      updates.isActive = input.status === "active";
    }
    if (input.priceAutomationMode !== undefined)
      updates.priceAutomationMode = input.priceAutomationMode;
    if (input.priceAutomationValue !== undefined)
      updates.priceAutomationValue = String(input.priceAutomationValue);
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
      .set({ isActive: false, status: "paused" })
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
      .set({ isActive: true, status: "active" })
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

    if (!template.isActive || template.status !== "active") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Only active recurring templates can generate new records",
      });
    }

    if ((template.remainingCycles ?? 1) <= 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "This recurring template has no remaining cycles",
      });
    }

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

    const data = normalizeRecurringTemplateData(
      (template.templateData ?? {}) as Record<string, unknown>,
      template.templateType,
      template.priceAutomationMode,
      Number(template.priceAutomationValue ?? 0),
    );

    try {
      const result = await db.transaction(async (tx) => {
        let generatedId: string;

        if (template.templateType === "invoice") {
          const invoiceNumber = await nextInvoiceNumber(orgId);
          const invoiceRows = await tx
            .insert(schema.invoice)
            .values({
              organizationId: orgId,
              locationId: (data.locationId as string | null) ?? null,
              invoiceNumber,
              customerId:
                template.customerId ??
                (data.customerId as string | null) ??
                null,
              customerName:
                (data.customerName as string | undefined) ??
                "Recurring Customer",
              customerAddress: (data.customerAddress as string | null) ?? null,
              customerPhone: (data.customerPhone as string | null) ?? null,
              items:
                (data.items as Record<string, unknown>[] | undefined) ?? [],
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
          const expenseRows = await tx
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
                template.supplierId ??
                (data.supplierId as string | null) ??
                null,
              authorizedBy: userId,
              createdBy: userId,
            })
            .returning({ id: schema.expense.id });
          generatedId = expenseRows[0]!.id;
        } else {
          const billNumber = await nextVendorBillNumber(orgId);
          const billRows = await tx
            .insert(schema.vendorBill)
            .values({
              organizationId: orgId,
              locationId: (data.locationId as string | null) ?? null,
              billNumber,
              supplierId:
                template.supplierId ??
                (data.supplierId as string | null) ??
                null,
              supplierName:
                (data.supplierName as string | undefined) ??
                "Recurring Supplier",
              items:
                (data.items as Record<string, unknown>[] | undefined) ?? [],
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

        const nextRunDate = advanceDate(
          template.nextRunDate,
          template.frequency,
        );
        const lifecycle = computeRecurringLifecycle({
          remainingCycles: template.remainingCycles,
          endDate: template.endDate,
          nextRunDate,
          isActive: template.isActive,
        });

        const newIdempotencyKey = crypto.randomUUID();

        await tx
          .update(schema.recurringTemplate)
          .set({
            nextRunDate,
            lastGeneratedAt: new Date(),
            totalGenerated: sql`${schema.recurringTemplate.totalGenerated} + 1`,
            remainingCycles: lifecycle.nextRemainingCycles,
            idempotencyKey: newIdempotencyKey,
            isActive: lifecycle.isActive,
            status: lifecycle.status,
          })
          .where(eq(schema.recurringTemplate.id, template.id));

        // biome-ignore lint/suspicious/noExplicitAny: PgTransaction is structurally compatible with db for insert operations
        await recordRun(tx as unknown as typeof db, {
          organizationId: orgId,
          templateId: template.id,
          generatedType: template.templateType,
          generatedId,
          createdBy: userId,
          status: "success",
          details: {
            nextRunDate,
            remainingCycles: lifecycle.nextRemainingCycles,
            status: lifecycle.status,
          },
        });

        return {
          generatedId,
          nextRunDate,
          isActive: lifecycle.isActive,
          status: lifecycle.status,
        };
      });

      await logFinanceEvent(db, {
        organizationId: orgId,
        entityType: "recurring_template",
        entityId: template.id,
        action: "generated",
        afterState: {
          generatedType: template.templateType,
          generatedId: result.generatedId,
          nextRunDate: result.nextRunDate,
        },
        performedBy: userId,
      });

      return {
        generatedType: template.templateType,
        generatedId: result.generatedId,
        nextRunDate: result.nextRunDate,
        isActive: result.isActive,
        status: result.status,
      };
    } catch (error) {
      await recordRun(db, {
        organizationId: orgId,
        templateId: template.id,
        generatedType: template.templateType,
        createdBy: userId,
        status: "failed",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  });

const runHistory = permissionProcedure("invoices.read")
  .input(
    z.object({
      templateId: z.string().uuid(),
      limit: z.number().int().positive().max(50).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = requireOrganizationId(context);

    const rows = await db
      .select()
      .from(schema.recurringTemplateRun)
      .where(
        and(
          eq(schema.recurringTemplateRun.organizationId, orgId),
          eq(schema.recurringTemplateRun.templateId, input.templateId),
        ),
      )
      .orderBy(desc(schema.recurringTemplateRun.createdAt))
      .limit(input.limit ?? 10);

    return rows;
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
  runHistory,
  preview,
};
