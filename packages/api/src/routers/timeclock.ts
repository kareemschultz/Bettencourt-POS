import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure, protectedProcedure } from "../index";
import {
	requireOrganizationId,
	resolveDefaultLocationId,
} from "../lib/org-context";

// ── clockIn ───────────────────────────────────────────────────────────
const clockIn = protectedProcedure
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
				notes: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const userId = context.session.user.id;
		const orgId = requireOrganizationId(context);
		const locationId =
			input.locationId ?? (await resolveDefaultLocationId(orgId));

		// Check for existing active shift
		const active = await db
			.select({ id: schema.timeEntry.id })
			.from(schema.timeEntry)
			.where(
				and(
					eq(schema.timeEntry.userId, userId),
					eq(schema.timeEntry.organizationId, orgId),
					isNull(schema.timeEntry.clockOut),
				),
			)
			.limit(1);

		if (active.length > 0) {
			throw new ORPCError("CONFLICT", {
				message: "Already clocked in. Clock out first.",
			});
		}

		const rows = await db
			.insert(schema.timeEntry)
			.values({
				userId,
				locationId,
				organizationId: orgId,
				notes: input.notes ?? null,
			})
			.returning({
				id: schema.timeEntry.id,
				clockIn: schema.timeEntry.clockIn,
			});

		return rows[0]!;
	});

// ── clockOut ──────────────────────────────────────────────────────────
const clockOut = protectedProcedure
	.input(z.object({ notes: z.string().optional() }).optional())
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const userId = context.session.user.id;
		const orgId = requireOrganizationId(context);

		const active = await db
			.select()
			.from(schema.timeEntry)
			.where(
				and(
					eq(schema.timeEntry.userId, userId),
					eq(schema.timeEntry.organizationId, orgId),
					isNull(schema.timeEntry.clockOut),
				),
			)
			.limit(1);

		if (active.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "No active shift to clock out of.",
			});
		}

		const entry = active[0]!;
		const now = new Date();
		const durationMs = now.getTime() - new Date(entry.clockIn).getTime();
		const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);

		await db
			.update(schema.timeEntry)
			.set({
				clockOut: now,
				status: "completed",
				notes: input.notes ?? entry.notes,
			})
			.where(
				and(
					eq(schema.timeEntry.id, entry.id),
					eq(schema.timeEntry.organizationId, orgId),
				),
			);

		return { id: entry.id, duration: durationHours };
	});

// ── getActiveShift ────────────────────────────────────────────────────
const getActiveShift = protectedProcedure
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const orgId = requireOrganizationId(context);

		const active = await db
			.select()
			.from(schema.timeEntry)
			.where(
				and(
					eq(schema.timeEntry.userId, userId),
					eq(schema.timeEntry.organizationId, orgId),
					isNull(schema.timeEntry.clockOut),
				),
			)
			.limit(1);

		return active.length > 0 ? active[0]! : null;
	});

// ── getShifts ─────────────────────────────────────────────────────────
const getShifts = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
			userId: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const result = await db.execute(
			sql`SELECT te.*, u.name as user_name
				FROM time_entry te
				LEFT JOIN "user" u ON u.id = te.user_id
				WHERE te.organization_id = ${orgId}::uuid
					AND te.clock_in >= ${input.startDate}::timestamptz
					AND te.clock_in <= ${`${input.endDate}T23:59:59`}::timestamptz
					${input.userId ? sql`AND te.user_id = ${input.userId}` : sql``}
				ORDER BY te.clock_in DESC`,
		);

		return result.rows;
	});

// ── editEntry ─────────────────────────────────────────────────────────
const editEntry = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			clockIn: z.string().optional(),
			clockOut: z.string().nullable().optional(),
			breakMinutes: z.number().min(0).optional(),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.timeEntry)
			.where(
				and(
					eq(schema.timeEntry.id, input.id),
					eq(schema.timeEntry.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Time entry not found",
			});
		}

		const updates: Record<string, unknown> = {
			editedBy: context.session.user.id,
			status: "edited",
		};

		if (input.clockIn) updates.clockIn = new Date(input.clockIn);
		if (input.clockOut !== undefined)
			updates.clockOut = input.clockOut ? new Date(input.clockOut) : null;
		if (input.breakMinutes !== undefined)
			updates.breakMinutes = String(input.breakMinutes);
		if (input.notes !== undefined) updates.notes = input.notes;

		await db
			.update(schema.timeEntry)
			.set(updates)
			.where(
				and(
					eq(schema.timeEntry.id, input.id),
					eq(schema.timeEntry.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── getSummary ────────────────────────────────────────────────────────
const getSummary = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const result = await db.execute(
			sql`SELECT
				te.user_id,
				u.name as user_name,
				COUNT(*)::int as shift_count,
				COALESCE(SUM(
					EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600
				), 0)::numeric(10,2) as total_hours,
				COALESCE(SUM(te.break_minutes::int), 0)::int as total_break_minutes
			FROM time_entry te
			LEFT JOIN "user" u ON u.id = te.user_id
			WHERE te.organization_id = ${orgId}::uuid
				AND te.clock_in >= ${input.startDate}::timestamptz
				AND te.clock_in <= ${`${input.endDate}T23:59:59`}::timestamptz
			GROUP BY te.user_id, u.name
			ORDER BY total_hours DESC`,
		);

		return result.rows.map((row: Record<string, unknown>) => {
			const totalHours = Number(row.total_hours);
			const breakHours = Number(row.total_break_minutes) / 60;
			const netHours = Math.max(0, totalHours - breakHours);
			const overtime = Math.max(0, netHours - 40);
			return {
				userId: row.user_id,
				userName: row.user_name,
				shiftCount: row.shift_count,
				totalHours: totalHours.toFixed(2),
				breakHours: breakHours.toFixed(2),
				netHours: netHours.toFixed(2),
				overtime: overtime.toFixed(2),
			};
		});
	});

export const timeclockRouter = {
	clockIn,
	clockOut,
	getActiveShift,
	getShifts,
	editEntry,
	getSummary,
};
