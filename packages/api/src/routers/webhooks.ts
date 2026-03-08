import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { encrypt } from "../lib/crypto";
import { requireOrganizationId } from "../lib/org-context";
import { dispatchWebhookEvent } from "../lib/webhooks";

// ── listEndpoints ──────────────────────────────────────────────────────
const listEndpoints = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const endpoints = await db
			.select({
				id: schema.webhookEndpoint.id,
				organizationId: schema.webhookEndpoint.organizationId,
				url: schema.webhookEndpoint.url,
				name: schema.webhookEndpoint.name,
				hasSecret: schema.webhookEndpoint.secret,
				events: schema.webhookEndpoint.events,
				isActive: schema.webhookEndpoint.isActive,
				createdAt: schema.webhookEndpoint.createdAt,
				updatedAt: schema.webhookEndpoint.updatedAt,
			})
			.from(schema.webhookEndpoint)
			.where(eq(schema.webhookEndpoint.organizationId, orgId))
			.orderBy(desc(schema.webhookEndpoint.createdAt));

		// Replace raw secret with boolean indicator — never expose secret value
		return endpoints.map((ep) => ({
			...ep,
			hasSecret: ep.hasSecret !== null && ep.hasSecret !== "",
		}));
	});

// ── createEndpoint ─────────────────────────────────────────────────────
const createEndpoint = permissionProcedure("settings.create")
	.input(
		z.object({
			name: z.string().min(1, "Name is required"),
			url: z
				.string()
				.url("Must be a valid URL")
				.refine((u) => u.startsWith("https://"), "Webhook URL must use HTTPS"),
			secret: z.string().nullable().optional(),
			events: z.array(z.string()).min(1, "Select at least one event"),
			isActive: z.boolean().default(true),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.insert(schema.webhookEndpoint)
			.values({
				organizationId: orgId,
				name: input.name,
				url: input.url,
				secret: input.secret ? encrypt(input.secret) : null,
				events: input.events,
				isActive: input.isActive,
			})
			.returning({ id: schema.webhookEndpoint.id });

		return { id: rows[0]?.id };
	});

// ── updateEndpoint ─────────────────────────────────────────────────────
const updateEndpoint = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			url: z
				.string()
				.url("Must be a valid URL")
				.refine((u) => u.startsWith("https://"), "Webhook URL must use HTTPS")
				.optional(),
			secret: z.string().nullable().optional(),
			events: z.array(z.string()).optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select({ id: schema.webhookEndpoint.id })
			.from(schema.webhookEndpoint)
			.where(
				and(
					eq(schema.webhookEndpoint.id, input.id),
					eq(schema.webhookEndpoint.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Webhook endpoint not found",
			});
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.url !== undefined) updates.url = input.url;
		// Only update secret if a real new value is provided (non-empty, not the masked placeholder)
		if (
			input.secret !== undefined &&
			input.secret !== null &&
			input.secret !== "" &&
			!input.secret.includes("•")
		) {
			updates.secret = encrypt(input.secret);
		}
		if (input.events !== undefined) updates.events = input.events;
		if (input.isActive !== undefined) updates.isActive = input.isActive;

		await db
			.update(schema.webhookEndpoint)
			.set(updates)
			.where(
				and(
					eq(schema.webhookEndpoint.id, input.id),
					eq(schema.webhookEndpoint.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── deleteEndpoint ─────────────────────────────────────────────────────
const deleteEndpoint = permissionProcedure("settings.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select({ id: schema.webhookEndpoint.id })
			.from(schema.webhookEndpoint)
			.where(
				and(
					eq(schema.webhookEndpoint.id, input.id),
					eq(schema.webhookEndpoint.organizationId, orgId),
				),
			)
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Webhook endpoint not found",
			});
		}

		await db
			.delete(schema.webhookEndpoint)
			.where(
				and(
					eq(schema.webhookEndpoint.id, input.id),
					eq(schema.webhookEndpoint.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── getDeliveries ──────────────────────────────────────────────────────
const getDeliveries = permissionProcedure("settings.read")
	.input(
		z.object({
			endpointId: z.string().uuid(),
			limit: z.number().min(1).max(100).default(50),
			offset: z.number().min(0).default(0),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		// Verify endpoint belongs to org
		const endpoint = await db
			.select({ id: schema.webhookEndpoint.id })
			.from(schema.webhookEndpoint)
			.where(
				and(
					eq(schema.webhookEndpoint.id, input.endpointId),
					eq(schema.webhookEndpoint.organizationId, orgId),
				),
			)
			.limit(1);

		if (endpoint.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Webhook endpoint not found",
			});
		}

		const deliveries = await db
			.select()
			.from(schema.webhookDelivery)
			.where(eq(schema.webhookDelivery.endpointId, input.endpointId))
			.orderBy(desc(schema.webhookDelivery.createdAt))
			.limit(input.limit)
			.offset(input.offset);

		return deliveries;
	});

// ── testEndpoint ───────────────────────────────────────────────────────
const testEndpoint = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.webhookEndpoint)
			.where(
				and(
					eq(schema.webhookEndpoint.id, input.id),
					eq(schema.webhookEndpoint.organizationId, orgId),
				),
			)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Webhook endpoint not found",
			});
		}

		dispatchWebhookEvent("test.ping", {
			message: "This is a test webhook from Bettencourt's POS",
			endpointId: input.id,
			organizationId: orgId,
			timestamp: new Date().toISOString(),
		});

		return { success: true, message: "Test webhook dispatched" };
	});

export const webhooksRouter = {
	listEndpoints,
	createEndpoint,
	updateEndpoint,
	deleteEndpoint,
	getDeliveries,
	testEndpoint,
};
