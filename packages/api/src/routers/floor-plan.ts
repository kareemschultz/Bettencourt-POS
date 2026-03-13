import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

const tableShapeSchema = z.enum(["square", "circle", "rectangle"]);
const tableStatusSchema = z.enum([
	"available",
	"occupied",
	"reserved",
	"cleaning",
]);

const listFloors = permissionProcedure("orders.read")
	.input(z.object({ locationId: z.string().uuid() }))
	.handler(async ({ input }) => {
		return db
			.select({
				id: schema.floor.id,
				locationId: schema.floor.locationId,
				name: schema.floor.name,
				backgroundImage: schema.floor.backgroundImage,
				sortOrder: schema.floor.sortOrder,
				isActive: schema.floor.isActive,
				createdAt: schema.floor.createdAt,
				tableCount: sql<number>`count(${schema.tableLayout.id})`.as("table_count"),
			})
			.from(schema.floor)
			.leftJoin(schema.tableLayout, eq(schema.floor.id, schema.tableLayout.floorId))
			.where(eq(schema.floor.locationId, input.locationId))
			.groupBy(schema.floor.id)
			.orderBy(asc(schema.floor.sortOrder), asc(schema.floor.name));
	});

const createFloor = permissionProcedure("orders.create")
	.input(
		z.object({
			locationId: z.string().uuid(),
			name: z.string().min(1),
			backgroundImage: z.string().trim().nullable().optional(),
			sortOrder: z.number().int().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.insert(schema.floor)
			.values({
				locationId: input.locationId,
				name: input.name,
				backgroundImage: input.backgroundImage ?? null,
				sortOrder: input.sortOrder ?? 0,
				isActive: input.isActive ?? true,
			})
			.returning({
				id: schema.floor.id,
				name: schema.floor.name,
			});

		return rows[0]!;
	});

const updateFloor = permissionProcedure("orders.create")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			backgroundImage: z.string().trim().nullable().optional(),
			sortOrder: z.number().int().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select({ id: schema.floor.id })
			.from(schema.floor)
			.where(eq(schema.floor.id, input.id));

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Floor not found" });
		}

		const updates: Partial<typeof schema.floor.$inferInsert> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.backgroundImage !== undefined) {
			updates.backgroundImage = input.backgroundImage;
		}
		if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
		if (input.isActive !== undefined) updates.isActive = input.isActive;

		if (Object.keys(updates).length > 0) {
			await db.update(schema.floor).set(updates).where(eq(schema.floor.id, input.id));
		}

		return { success: true };
	});

const removeFloor = permissionProcedure("orders.create")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		const floorRows = await db
			.select({ id: schema.floor.id })
			.from(schema.floor)
			.where(eq(schema.floor.id, input.id));

		if (floorRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Floor not found" });
		}

		const activeTables = await db
			.select({ id: schema.tableLayout.id })
			.from(schema.tableLayout)
			.where(
				and(
					eq(schema.tableLayout.floorId, input.id),
					eq(schema.tableLayout.status, "occupied"),
				),
			)
			.limit(1);

		if (activeTables.length > 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot delete floor while occupied tables exist",
			});
		}

		await db.delete(schema.floor).where(eq(schema.floor.id, input.id));
		return { success: true };
	});

const listTables = permissionProcedure("orders.read")
	.input(
		z.object({
			locationId: z.string().uuid(),
			floorId: z.string().uuid().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		return db
			.select({
				id: schema.tableLayout.id,
				locationId: schema.tableLayout.locationId,
				floorId: schema.tableLayout.floorId,
				name: schema.tableLayout.name,
				section: schema.tableLayout.section,
				seats: schema.tableLayout.seats,
				positionX: schema.tableLayout.positionX,
				positionY: schema.tableLayout.positionY,
				width: schema.tableLayout.width,
				height: schema.tableLayout.height,
				shape: schema.tableLayout.shape,
				status: schema.tableLayout.status,
				currentOrderId: schema.tableLayout.currentOrderId,
				currentGuests: schema.tableLayout.currentGuests,
				updatedAt: schema.tableLayout.updatedAt,
			})
			.from(schema.tableLayout)
			.where(
				and(
					eq(schema.tableLayout.locationId, input.locationId),
					input.floorId === undefined
						? undefined
						: input.floorId === null
							? sql`${schema.tableLayout.floorId} IS NULL`
							: eq(schema.tableLayout.floorId, input.floorId),
				),
			)
			.orderBy(asc(schema.tableLayout.section), asc(schema.tableLayout.name));
	});

const saveTableBatch = permissionProcedure("orders.create")
	.input(
		z.object({
			locationId: z.string().uuid(),
			floorId: z.string().uuid().nullable().optional(),
			tables: z
				.array(
					z.object({
						id: z.string().uuid().optional(),
						name: z.string().min(1),
						section: z.string().nullable().optional(),
						seats: z.number().int().min(1).max(50),
						positionX: z.number().int(),
						positionY: z.number().int(),
						width: z.number().int().min(40).max(1000).default(100),
						height: z.number().int().min(40).max(1000).default(100),
						shape: tableShapeSchema,
						status: tableStatusSchema.optional(),
					}),
				)
				.min(1),
			removeMissing: z.boolean().default(false),
		}),
	)
	.handler(async ({ input }) => {
		const existingFloor =
			input.floorId == null
				? null
				: await db
						.select({ id: schema.floor.id, locationId: schema.floor.locationId })
						.from(schema.floor)
						.where(eq(schema.floor.id, input.floorId))
						.limit(1);

		if (input.floorId && (!existingFloor || existingFloor.length === 0)) {
			throw new ORPCError("NOT_FOUND", { message: "Floor not found" });
		}
		if (
			input.floorId &&
			existingFloor?.[0] &&
			existingFloor[0].locationId !== input.locationId
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Floor does not belong to this location",
			});
		}

		const result = await db.transaction(async (tx) => {
			const touchedIds: string[] = [];

			for (const table of input.tables) {
				if (table.id) {
					const current = await tx
						.select({ id: schema.tableLayout.id })
						.from(schema.tableLayout)
						.where(
							and(
								eq(schema.tableLayout.id, table.id),
								eq(schema.tableLayout.locationId, input.locationId),
							),
						)
						.limit(1);

					if (current.length === 0) {
						throw new ORPCError("NOT_FOUND", {
							message: `Table ${table.id} not found in selected location`,
						});
					}

					await tx
						.update(schema.tableLayout)
						.set({
							floorId: input.floorId ?? null,
							name: table.name,
							section: table.section ?? null,
							seats: table.seats,
							positionX: table.positionX,
							positionY: table.positionY,
							width: table.width,
							height: table.height,
							shape: table.shape,
							...(table.status ? { status: table.status } : {}),
						})
						.where(eq(schema.tableLayout.id, table.id));

					touchedIds.push(table.id);
					continue;
				}

				const inserted = await tx
					.insert(schema.tableLayout)
					.values({
						locationId: input.locationId,
						floorId: input.floorId ?? null,
						name: table.name,
						section: table.section ?? null,
						seats: table.seats,
						positionX: table.positionX,
						positionY: table.positionY,
						width: table.width,
						height: table.height,
						shape: table.shape,
						status: table.status ?? "available",
					})
					.returning({ id: schema.tableLayout.id });

				touchedIds.push(inserted[0]!.id);
			}

			if (input.removeMissing) {
				await tx
					.delete(schema.tableLayout)
					.where(
						and(
							eq(schema.tableLayout.locationId, input.locationId),
							input.floorId === undefined
								? undefined
								: input.floorId === null
									? sql`${schema.tableLayout.floorId} IS NULL`
									: eq(schema.tableLayout.floorId, input.floorId),
							touchedIds.length > 0
								? notInArray(schema.tableLayout.id, touchedIds)
								: undefined,
							sql`${schema.tableLayout.currentOrderId} IS NULL`,
						),
					);
			}

			return tx
				.select({
					id: schema.tableLayout.id,
					name: schema.tableLayout.name,
					floorId: schema.tableLayout.floorId,
					positionX: schema.tableLayout.positionX,
					positionY: schema.tableLayout.positionY,
					width: schema.tableLayout.width,
					height: schema.tableLayout.height,
					shape: schema.tableLayout.shape,
					status: schema.tableLayout.status,
				})
				.from(schema.tableLayout)
				.where(inArray(schema.tableLayout.id, touchedIds));
		});

		return result;
	});

export const floorPlanRouter = {
	listFloors,
	createFloor,
	updateFloor,
	removeFloor,
	listTables,
	saveTableBatch,
};
