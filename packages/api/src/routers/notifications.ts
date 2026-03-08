import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { decrypt, encrypt } from "../lib/crypto";
import { requireOrganizationId } from "../lib/org-context";

type NotificationSettingsRow = {
	id: string;
	organizationId: string;
	provider: "twilio" | "vonage";
	accountSid: string | null;
	authToken: string | null;
	fromNumber: string | null;
	whatsappNumber: string | null;
	isActive: boolean;
	dailyLimit: number;
	createdAt: Date;
	updatedAt: Date;
};

function toPublicSettings(settings: NotificationSettingsRow | null) {
	if (!settings) return null;
	let accountSidMasked: string | null = null;

	if (settings.accountSid) {
		try {
			const sid = decrypt(settings.accountSid);
			accountSidMasked =
				sid.length > 8
					? `${sid.slice(0, 4)}${"*".repeat(sid.length - 8)}${sid.slice(-4)}`
					: "********";
		} catch {
			accountSidMasked = "********";
		}
	}

	return {
		id: settings.id,
		organizationId: settings.organizationId,
		provider: settings.provider,
		isActive: settings.isActive,
		dailyLimit: settings.dailyLimit,
		fromNumber: settings.fromNumber,
		whatsappNumber: settings.whatsappNumber,
		hasCredentials: !!(settings.accountSid && settings.authToken),
		accountSidMasked,
	};
}

function normalizePhone(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
	return `+${trimmed.replace(/\D/g, "")}`;
}

// Available notification events with human-readable descriptions
const NOTIFICATION_EVENTS = [
	{
		event: "order.ready",
		name: "Order Ready",
		description:
			"Sent when kitchen marks an order as ready for pickup or serving",
		defaultTemplate:
			"Hi {{customerName}}, your order #{{orderNumber}} is ready for pickup at Bettencourt's!",
	},
	{
		event: "order.delivered",
		name: "Order Delivered",
		description:
			"Sent when a delivery order has been dispatched to the customer",
		defaultTemplate:
			"Hi {{customerName}}, your order #{{orderNumber}} is on its way! Estimated arrival: {{estimatedTime}}",
	},
	{
		event: "order.confirmed",
		name: "Order Confirmed",
		description:
			"Sent when an online order is received and confirmed by the kitchen",
		defaultTemplate:
			"Thanks {{customerName}}! Your order #{{orderNumber}} has been confirmed. We'll notify you when it's ready.",
	},
	{
		event: "loyalty.earned",
		name: "Loyalty Points Earned",
		description: "Sent when a customer earns loyalty points after a purchase",
		defaultTemplate:
			"You earned {{points}} loyalty points at Bettencourt's! Your balance: {{totalPoints}} points. {{rewardMessage}}",
	},
	{
		event: "loyalty.reward",
		name: "Loyalty Reward Available",
		description:
			"Sent when a customer reaches enough points to redeem a reward",
		defaultTemplate:
			"Congratulations {{customerName}}! You've earned a reward at Bettencourt's. Show this message on your next visit to redeem.",
	},
	{
		event: "giftcard.received",
		name: "Gift Card Received",
		description: "Sent when a gift card is purchased for someone",
		defaultTemplate:
			"You've received a {{amount}} gift card for Bettencourt's from {{senderName}}! Code: {{giftCardCode}}",
	},
] as const;

// ── getSettings ────────────────────────────────────────────────────────
// Returns notification settings with credentials masked — never sends full secrets to client
const getSettings = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.notificationSettings)
			.where(eq(schema.notificationSettings.organizationId, orgId))
			.limit(1);

		return toPublicSettings((rows[0] as NotificationSettingsRow) ?? null);
	});

// ── updateSettings ─────────────────────────────────────────────────────
// Saves Twilio/provider configuration. Credentials are encrypted at rest.
const updateSettings = permissionProcedure("settings.update")
	.input(
		z.object({
			provider: z.enum(["twilio", "vonage"]).default("twilio"),
			accountSid: z.string().optional(),
			authToken: z.string().optional(),
			fromNumber: z
				.string()
				.regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g. +15550001234)")
				.optional()
				.nullable(),
			whatsappNumber: z
				.string()
				.regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g. +15550001234)")
				.optional()
				.nullable(),
			isActive: z.boolean().default(false),
			dailyLimit: z.number().int().min(0).max(10000).default(500),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.notificationSettings)
			.where(eq(schema.notificationSettings.organizationId, orgId))
			.limit(1);

		// Only update credentials if a real new value is provided — never clear
		// existing credentials with an empty/masked placeholder string.
		const credentialUpdates = {
			...(input.accountSid && !input.accountSid.includes("*")
				? { accountSid: encrypt(input.accountSid) }
				: {}),
			...(input.authToken && !input.authToken.includes("*")
				? { authToken: encrypt(input.authToken) }
				: {}),
		};

		if (existing.length > 0) {
			const [updated] = await db
				.update(schema.notificationSettings)
				.set({
					provider: input.provider,
					fromNumber: input.fromNumber || null,
					whatsappNumber: input.whatsappNumber || null,
					isActive: input.isActive,
					dailyLimit: input.dailyLimit,
					...credentialUpdates,
				})
				.where(eq(schema.notificationSettings.id, existing[0]!.id))
				.returning();
			return toPublicSettings(updated as NotificationSettingsRow);
		}

		const [created] = await db
			.insert(schema.notificationSettings)
			.values({
				organizationId: orgId,
				provider: input.provider,
				accountSid: credentialUpdates.accountSid ?? null,
				authToken: credentialUpdates.authToken ?? null,
				fromNumber: input.fromNumber || null,
				whatsappNumber: input.whatsappNumber || null,
				isActive: input.isActive,
				dailyLimit: input.dailyLimit,
			})
			.returning();
		return toPublicSettings(created as NotificationSettingsRow);
	});

// ── getAvailableEvents ─────────────────────────────────────────────────
// Returns the list of all configurable notification events with descriptions
const getAvailableEvents = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		return NOTIFICATION_EVENTS;
	});

// ── listTemplates ──────────────────────────────────────────────────────
// Returns all notification templates for the organization
const listTemplates = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		return db
			.select()
			.from(schema.notificationTemplate)
			.where(eq(schema.notificationTemplate.organizationId, orgId))
			.orderBy(schema.notificationTemplate.event);
	});

// ── createTemplate ─────────────────────────────────────────────────────
// Creates a new notification template for a specific event
const createTemplate = permissionProcedure("settings.create")
	.input(
		z.object({
			event: z.string().min(1),
			name: z.string().min(1).max(100),
			description: z.string().optional(),
			channel: z.enum(["sms", "whatsapp", "both"]).default("sms"),
			messageTemplate: z.string().min(1).max(500),
			isActive: z.boolean().default(true),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const [template] = await db
			.insert(schema.notificationTemplate)
			.values({
				organizationId: orgId,
				event: input.event,
				name: input.name,
				description: input.description || null,
				channel: input.channel,
				messageTemplate: input.messageTemplate,
				isActive: input.isActive,
			})
			.returning();
		return template!;
	});

// ── updateTemplate ─────────────────────────────────────────────────────
const updateTemplate = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).max(100).optional(),
			description: z.string().optional(),
			channel: z.enum(["sms", "whatsapp", "both"]).optional(),
			messageTemplate: z.string().min(1).max(500).optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...updates } = input;
		const updateData: Record<string, unknown> = {};
		if (updates.name !== undefined) updateData.name = updates.name;
		if (updates.description !== undefined)
			updateData.description = updates.description;
		if (updates.channel !== undefined) updateData.channel = updates.channel;
		if (updates.messageTemplate !== undefined)
			updateData.messageTemplate = updates.messageTemplate;
		if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

		const [template] = await db
			.update(schema.notificationTemplate)
			.set(updateData)
			.where(eq(schema.notificationTemplate.id, id))
			.returning();

		if (!template) throw new ORPCError("NOT_FOUND");
		return template;
	});

// ── deleteTemplate ─────────────────────────────────────────────────────
const deleteTemplate = permissionProcedure("settings.delete")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.delete(schema.notificationTemplate)
			.where(eq(schema.notificationTemplate.id, input.id));
		return { success: true };
	});

// ── getLog ─────────────────────────────────────────────────────────────
// Returns the notification delivery log, paginated, most recent first
const getLog = permissionProcedure("settings.read")
	.input(
		z
			.object({
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
				status: z.enum(["pending", "sent", "delivered", "failed"]).optional(),
			})
			.optional(),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const limit = input?.limit ?? 50;
		const offset = input?.offset ?? 0;

		const conditions = [eq(schema.notificationLog.organizationId, orgId)];
		if (input?.status) {
			conditions.push(eq(schema.notificationLog.status, input.status));
		}

		const [logs, [totalRow]] = await Promise.all([
			db
				.select()
				.from(schema.notificationLog)
				.where(and(...conditions))
				.orderBy(desc(schema.notificationLog.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ total: count() })
				.from(schema.notificationLog)
				.where(and(...conditions)),
		]);

		return {
			items: logs,
			total: totalRow?.total ?? 0,
			limit,
			offset,
		};
	});

// ── getStats ───────────────────────────────────────────────────────────
// Returns notification delivery stats for the dashboard overview
const getStats = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const [stats] = await db
			.select({
				total: count(),
				sent: count(
					sql`CASE WHEN ${schema.notificationLog.status} = 'sent' THEN 1 END`,
				),
				delivered: count(
					sql`CASE WHEN ${schema.notificationLog.status} = 'delivered' THEN 1 END`,
				),
				failed: count(
					sql`CASE WHEN ${schema.notificationLog.status} = 'failed' THEN 1 END`,
				),
			})
			.from(schema.notificationLog)
			.where(
				and(
					eq(schema.notificationLog.organizationId, orgId),
					sql`${schema.notificationLog.createdAt} >= ${today}`,
				),
			);

		return {
			todaySent: (stats?.sent ?? 0) + (stats?.delivered ?? 0),
			todayFailed: stats?.failed ?? 0,
			todayTotal: stats?.total ?? 0,
		};
	});

// ── sendTest ───────────────────────────────────────────────────────────
// Sends a test notification to verify the provider configuration
const sendTest = permissionProcedure("settings.update")
	.input(
		z.object({
			phoneNumber: z.string().min(7).max(20),
			channel: z.enum(["sms", "whatsapp"]).default("sms"),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		// Check if settings are configured
		const settingsRows = await db
			.select()
			.from(schema.notificationSettings)
			.where(eq(schema.notificationSettings.organizationId, orgId))
			.limit(1);

		const settings = settingsRows[0];
		if (!settings || !settings.isActive) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Notifications are not configured. Add your Twilio credentials in Settings to enable SMS.",
			});
		}

		if (!settings.accountSid || !settings.authToken) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Missing Twilio credentials. Add your Account SID and Auth Token to send notifications.",
			});
		}

		if (settings.provider !== "twilio") {
			throw new ORPCError("NOT_IMPLEMENTED", {
				message: `Provider '${settings.provider}' is not yet supported for test sends.`,
			});
		}

		const twilioSid = decrypt(settings.accountSid);
		const twilioToken = decrypt(settings.authToken);
		const to = normalizePhone(input.phoneNumber);
		const fromBase =
			input.channel === "whatsapp"
				? settings.whatsappNumber || settings.fromNumber
				: settings.fromNumber;
		const from = normalizePhone(fromBase ?? "");

		if (!to || !from) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Invalid phone numbers. Ensure test destination and sender numbers are valid E.164 values.",
			});
		}

		const toAddress = input.channel === "whatsapp" ? `whatsapp:${to}` : to;
		const fromAddress =
			input.channel === "whatsapp" ? `whatsapp:${from}` : from;

		// Log the test attempt
		const [log] = await db
			.insert(schema.notificationLog)
			.values({
				organizationId: orgId,
				event: "test",
				channel: input.channel,
				recipient: input.phoneNumber,
				message: `Test notification from Bettencourt's POS. If you received this, your ${input.channel.toUpperCase()} notifications are working correctly!`,
				status: "pending",
				metadata: { test: true },
			})
			.returning();

		try {
			const payload = new URLSearchParams({
				To: toAddress,
				From: fromAddress,
				Body: `Test notification from Bettencourt's POS. If you received this, your ${input.channel.toUpperCase()} notifications are working correctly!`,
			});

			const response = await fetch(
				`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,
				{
					method: "POST",
					headers: {
						Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: payload.toString(),
				},
			);

			type TwilioResponse = {
				sid?: string;
				error_message?: string | null;
				message?: string;
			};
			const body = (await response.json().catch(() => ({}))) as TwilioResponse;

			if (!response.ok) {
				const errorMessage =
					body.error_message ||
					body.message ||
					`Twilio request failed with status ${response.status}`;
				await db
					.update(schema.notificationLog)
					.set({
						status: "failed",
						errorMessage,
					})
					.where(eq(schema.notificationLog.id, log!.id));
				throw new ORPCError("BAD_REQUEST", { message: errorMessage });
			}

			await db
				.update(schema.notificationLog)
				.set({
					status: "sent",
					externalId: body.sid ?? null,
				})
				.where(eq(schema.notificationLog.id, log!.id));

			return {
				success: true,
				message: `Test ${input.channel.toUpperCase()} notification queued successfully.`,
			};
		} catch (error) {
			if (error instanceof ORPCError) throw error;
			const message =
				error instanceof Error ? error.message : "Failed to send test message";
			await db
				.update(schema.notificationLog)
				.set({
					status: "failed",
					errorMessage: message,
				})
				.where(eq(schema.notificationLog.id, log!.id));
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message });
		}
	});

export const notificationsRouter = {
	getSettings,
	updateSettings,
	getAvailableEvents,
	listTemplates,
	createTemplate,
	updateTemplate,
	deleteTemplate,
	getLog,
	getStats,
	sendTest,
};
