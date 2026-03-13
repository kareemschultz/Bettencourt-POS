import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

// ── list ────────────────────────────────────────────────────────────────
const list = permissionProcedure("orders.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);

		const conditions = [eq(schema.printer.organizationId, orgId)];
		if (input.locationId) {
			conditions.push(eq(schema.printer.locationId, input.locationId));
		}

		const printers = await db
			.select({
				id: schema.printer.id,
				name: schema.printer.name,
				connectionType: schema.printer.connectionType,
				address: schema.printer.address,
				paperWidth: schema.printer.paperWidth,
				isActive: schema.printer.isActive,
				autoCut: schema.printer.autoCut,
				locationId: schema.printer.locationId,
				createdAt: schema.printer.createdAt,
			})
			.from(schema.printer)
			.where(and(...conditions));

		// Get routes for each printer
		const printerIds = printers.map((p) => p.id);
		let routes: Array<{
			printerId: string;
			reportingCategoryId: string;
			categoryName: string | null;
		}> = [];

		if (printerIds.length > 0) {
			const { inArray } = await import("drizzle-orm");
			routes = await db
				.select({
					printerId: schema.printerRoute.printerId,
					reportingCategoryId: schema.printerRoute.reportingCategoryId,
					categoryName: schema.reportingCategory.name,
				})
				.from(schema.printerRoute)
				.innerJoin(
					schema.reportingCategory,
					eq(
						schema.printerRoute.reportingCategoryId,
						schema.reportingCategory.id,
					),
				)
				.where(inArray(schema.printerRoute.printerId, printerIds));
		}

		return printers.map((p) => ({
			...p,
			routes: routes
				.filter((r) => r.printerId === p.id)
				.map((r) => ({
					reportingCategoryId: r.reportingCategoryId,
					categoryName: r.categoryName,
				})),
		}));
	});

// ── create ──────────────────────────────────────────────────────────────
const create = permissionProcedure("orders.create")
	.input(
		z.object({
			locationId: z.string().uuid(),
			name: z.string().min(1),
			connectionType: z.enum(["usb", "network", "mock"]).default("network"),
			address: z.string().nullable().optional(),
			paperWidth: z.enum(["58mm", "80mm"]).default("80mm"),
			autoCut: z.boolean().default(true),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const rows = await db
			.insert(schema.printer)
			.values({
				organizationId: orgId,
				locationId: input.locationId,
				name: input.name,
				connectionType: input.connectionType,
				address: input.address ?? null,
				paperWidth: input.paperWidth,
				autoCut: input.autoCut,
				isActive: true,
			})
			.returning({ id: schema.printer.id, name: schema.printer.name });

		return rows[0]!;
	});

// ── update ──────────────────────────────────────────────────────────────
const update = permissionProcedure("orders.create")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			connectionType: z.enum(["usb", "network", "mock"]).optional(),
			address: z.string().nullable().optional(),
			paperWidth: z.enum(["58mm", "80mm"]).optional(),
			isActive: z.boolean().optional(),
			autoCut: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.connectionType !== undefined)
			updates.connectionType = input.connectionType;
		if (input.address !== undefined) updates.address = input.address;
		if (input.paperWidth !== undefined) updates.paperWidth = input.paperWidth;
		if (input.isActive !== undefined) updates.isActive = input.isActive;
		if (input.autoCut !== undefined) updates.autoCut = input.autoCut;

		if (Object.keys(updates).length > 0) {
			await db
				.update(schema.printer)
				.set(updates)
				.where(eq(schema.printer.id, input.id));
		}

		return { success: true };
	});

// ── remove ──────────────────────────────────────────────────────────────
const remove = permissionProcedure("orders.create")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db.delete(schema.printer).where(eq(schema.printer.id, input.id));
		return { success: true };
	});

// ── setRoutes ───────────────────────────────────────────────────────────
// Set category→printer routing rules (replaces all existing routes for this printer)
const setRoutes = permissionProcedure("orders.create")
	.input(
		z.object({
			printerId: z.string().uuid(),
			reportingCategoryIds: z.array(z.string().uuid()),
		}),
	)
	.handler(async ({ input }) => {
		await db.transaction(async (tx) => {
			// Delete existing routes for this printer
			await tx
				.delete(schema.printerRoute)
				.where(eq(schema.printerRoute.printerId, input.printerId));

			// Insert new routes
			if (input.reportingCategoryIds.length > 0) {
				await tx.insert(schema.printerRoute).values(
					input.reportingCategoryIds.map((catId) => ({
						printerId: input.printerId,
						reportingCategoryId: catId,
					})),
				);
			}
		});

		return { success: true };
	});

// ── testPrint ───────────────────────────────────────────────────────────
const testPrint = permissionProcedure("orders.create")
	.input(z.object({ printerId: z.string().uuid() }))
	.handler(async ({ input }) => {
		const [p] = await db
			.select()
			.from(schema.printer)
			.where(eq(schema.printer.id, input.printerId));

		if (!p) {
			throw new ORPCError("NOT_FOUND", { message: "Printer not found" });
		}

		// Return printer info so the client can send a test print
		return {
			id: p.id,
			name: p.name,
			connectionType: p.connectionType,
			address: p.address,
			testText: [
				"TEST PRINT",
				"----------------------------------------",
				`Printer: ${p.name}`,
				`Type: ${p.connectionType}`,
				`Paper: ${p.paperWidth}`,
				`Time: ${new Date().toISOString()}`,
				"----------------------------------------",
				"If you can read this, the printer works!",
				"",
			].join("\n"),
		};
	});

export const printersRouter = {
	list,
	create,
	update,
	remove,
	setRoutes,
	testPrint,
};
