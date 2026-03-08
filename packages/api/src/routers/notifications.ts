import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

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
	.handler(async () => {
		const rows = await db
			.select()
			.from(schema.notificationSettings)
			.where(eq(schema.notificationSettings.organizationId, DEFAULT_ORG_ID))
			.limit(1);

		if (!rows[0]) return null;
		const s = rows[0];
		return {
			id: s.id,
			organizationId: s.organizationId,
			provider: s.provider,
			isActive: s.isActive,
			dailyLimit: s.dailyLimit,
			fromNumber: s.fromNumber,
			whatsappNumber: s.whatsappNumber,
			// Never expose full credentials — mask and return presence flag
			hasCredentials: !!(s.accountSid && s.authToken),
			accountSidMasked: s.accountSid
				? `${s.accountSid.slice(0, 4)}${"*".repeat(Math.max(0, s.accountSid.length - 8))}${s.accountSid.slice(-4)}`
				: null,
		};
	});

// ── updateSettings ─────────────────────────────────────────────────────
// Saves Twilio/provider configuration. Credentials are stored as-is for now.
const updateSettings = permissionProcedure("settings.write")
	.input(
		z.object({
			provider: z.enum(["twilio", "vonage"]).default("twilio"),
			accountSid: z.string().optional(),
			authToken: z.string().optional(),
			fromNumber: z.string().optional(),
			whatsappNumber: z.string().optional(),
			isActive: z.boolean().default(false),
			dailyLimit: z.number().int().min(0).max(10000).default(500),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select()
			.from(schema.notificationSettings)
			.where(eq(schema.notificationSettings.organizationId, DEFAULT_ORG_ID))
			.limit(1);

		if (existing.length > 0) {
			const [updated] = await db
				.update(schema.notificationSettings)
				.set({
					provider: input.provider,
					accountSid: input.accountSid || null,
					authToken: input.authToken || null,
					fromNumber: input.fromNumber || null,
					whatsappNumber: input.whatsappNumber || null,
					isActive: input.isActive,
					dailyLimit: input.dailyLimit,
				})
				.where(eq(schema.notificationSettings.id, existing[0]!.id))
				.returning();
			return updated!;
		}

		const [created] = await db
			.insert(schema.notificationSettings)
			.values({
				organizationId: DEFAULT_ORG_ID,
				provider: input.provider,
				accountSid: input.accountSid || null,
				authToken: input.authToken || null,
				fromNumber: input.fromNumber || null,
				whatsappNumber: input.whatsappNumber || null,
				isActive: input.isActive,
				dailyLimit: input.dailyLimit,
			})
			.returning();
		return created!;
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
	.handler(async () => {
		return db
			.select()
			.from(schema.notificationTemplate)
			.where(eq(schema.notificationTemplate.organizationId, DEFAULT_ORG_ID))
			.orderBy(schema.notificationTemplate.event);
	});

// ── createTemplate ─────────────────────────────────────────────────────
// Creates a new notification template for a specific event
const createTemplate = permissionProcedure("settings.write")
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
	.handler(async ({ input }) => {
		const [template] = await db
			.insert(schema.notificationTemplate)
			.values({
				organizationId: DEFAULT_ORG_ID,
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
const updateTemplate = permissionProcedure("settings.write")
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
const deleteTemplate = permissionProcedure("settings.write")
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
	.handler(async ({ input }) => {
		const limit = input?.limit ?? 50;
		const offset = input?.offset ?? 0;

		const conditions = [
			eq(schema.notificationLog.organizationId, DEFAULT_ORG_ID),
		];
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
	.handler(async () => {
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
					eq(schema.notificationLog.organizationId, DEFAULT_ORG_ID),
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
const sendTest = permissionProcedure("settings.write")
	.input(
		z.object({
			phoneNumber: z.string().min(7).max(20),
			channel: z.enum(["sms", "whatsapp"]).default("sms"),
		}),
	)
	.handler(async ({ input }) => {
		// Check if settings are configured
		const settings = await db
			.select()
			.from(schema.notificationSettings)
			.where(eq(schema.notificationSettings.organizationId, DEFAULT_ORG_ID))
			.limit(1);

		if (!settings.length || !settings[0]?.isActive) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Notifications are not configured. Add your Twilio credentials in Settings to enable SMS.",
			});
		}

		if (!settings[0]?.accountSid || !settings[0]?.authToken) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Missing Twilio credentials. Add your Account SID and Auth Token to send notifications.",
			});
		}

		// Log the test attempt
		const [log] = await db
			.insert(schema.notificationLog)
			.values({
				organizationId: DEFAULT_ORG_ID,
				event: "test",
				channel: input.channel,
				recipient: input.phoneNumber,
				message: `Test notification from Bettencourt's POS. If you received this, your ${input.channel.toUpperCase()} notifications are working correctly!`,
				status: "pending",
				metadata: { test: true },
			})
			.returning();

		// Twilio integration not yet implemented — mark as failed instead of faking success
		await db
			.update(schema.notificationLog)
			.set({
				status: "failed",
				errorMessage:
					"Twilio API integration not yet implemented. Configure and connect your Twilio account.",
			})
			.where(eq(schema.notificationLog.id, log!.id));

		throw new ORPCError("NOT_IMPLEMENTED", {
			message:
				"SMS/WhatsApp provider integration is not yet connected. Your credentials are saved but the Twilio API call is pending implementation.",
		});
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
