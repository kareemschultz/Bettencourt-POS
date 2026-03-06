import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

/**
 * Dispatches a webhook event to all active endpoints subscribed to this event.
 * Fire-and-forget — does not block the caller.
 */
export function dispatchWebhookEvent(
	event: string,
	payload: Record<string, unknown>,
) {
	// Run async in background — don't block caller
	void dispatchAsync(event, payload);
}

async function dispatchAsync(event: string, payload: Record<string, unknown>) {
	try {
		// Find all active endpoints for this organization that are subscribed to this event
		const endpoints = await db
			.select()
			.from(schema.webhookEndpoint)
			.where(
				and(
					eq(schema.webhookEndpoint.organizationId, DEFAULT_ORG_ID),
					eq(schema.webhookEndpoint.isActive, true),
				),
			);

		// Filter endpoints subscribed to this event
		const subscribed = endpoints.filter((ep) => {
			const events = ep.events as string[];
			return events.includes(event) || events.includes("*");
		});

		if (subscribed.length === 0) return;

		const body = JSON.stringify({
			event,
			timestamp: new Date().toISOString(),
			data: payload,
		});

		await Promise.allSettled(
			subscribed.map((endpoint) => deliverToEndpoint(endpoint, event, body)),
		);
	} catch (err) {
		console.error("[webhooks] dispatch error:", err);
	}
}

async function deliverToEndpoint(
	endpoint: typeof schema.webhookEndpoint.$inferSelect,
	event: string,
	body: string,
) {
	// Pre-create delivery record to get the ID
	const [delivery] = await db
		.insert(schema.webhookDelivery)
		.values({
			endpointId: endpoint.id,
			event,
			payload: JSON.parse(body),
			success: false,
		})
		.returning({ id: schema.webhookDelivery.id });

	const deliveryId = delivery?.id;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"X-Webhook-Event": event,
		"X-Webhook-Id": deliveryId,
	};

	// Sign with HMAC-SHA256 if secret is configured
	if (endpoint.secret) {
		const signature = createHmac("sha256", endpoint.secret)
			.update(body)
			.digest("hex");
		headers["X-Webhook-Signature"] = signature;
	}

	const startTime = Date.now();

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

		const response = await fetch(endpoint.url, {
			method: "POST",
			headers,
			body,
			signal: controller.signal,
		});

		clearTimeout(timeout);

		const duration = Date.now() - startTime;
		let responseBody: string | null = null;
		try {
			responseBody = await response.text();
			// Truncate to 4KB
			if (responseBody.length > 4096) {
				responseBody = `${responseBody.slice(0, 4096)}...(truncated)`;
			}
		} catch {
			// ignore response body read errors
		}

		await db
			.update(schema.webhookDelivery)
			.set({
				statusCode: response.status,
				responseBody,
				duration,
				success: response.ok,
			})
			.where(eq(schema.webhookDelivery.id, deliveryId));
	} catch (err) {
		const duration = Date.now() - startTime;
		const errMessage = err instanceof Error ? err.message : String(err);

		await db
			.update(schema.webhookDelivery)
			.set({
				statusCode: null,
				responseBody: `Error: ${errMessage}`,
				duration,
				success: false,
			})
			.where(eq(schema.webhookDelivery.id, deliveryId));
	}
}
