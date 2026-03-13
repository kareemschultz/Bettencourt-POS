import { createBunWebSocket } from "hono/bun";
import type { Context } from "hono";

export type PosChannel =
	| "pos:orders"
	| "pos:tables"
	| "pos:86"
	| "pos:kds"
	| "pos:session";

export type PosRealtimeMessage<TPayload = unknown> = {
	channel: PosChannel;
	event: string;
	payload: TPayload;
	timestamp: string;
	source: string;
};

const VALID_CHANNELS = new Set<PosChannel>([
	"pos:orders",
	"pos:tables",
	"pos:86",
	"pos:kds",
	"pos:session",
]);

const clientChannels = new Map<WebSocket, Set<PosChannel>>();

function safeSend(ws: WebSocket, payload: PosRealtimeMessage) {
	if (ws.readyState !== ws.OPEN) return;
	ws.send(JSON.stringify(payload));
}

function parseChannelList(raw: unknown): PosChannel[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(channel): channel is PosChannel =>
			typeof channel === "string" && VALID_CHANNELS.has(channel as PosChannel),
	);
}

function normalizeMessage(input: Partial<PosRealtimeMessage>): PosRealtimeMessage | null {
	if (!input?.channel || !VALID_CHANNELS.has(input.channel)) return null;
	if (!input.event || typeof input.event !== "string") return null;

	return {
		channel: input.channel,
		event: input.event,
		payload: input.payload ?? {},
		timestamp: input.timestamp ?? new Date().toISOString(),
		source: input.source ?? "server",
	};
}

export function publishPosEvent(input: Partial<PosRealtimeMessage>) {
	const message = normalizeMessage(input);
	if (!message) return;

	for (const [ws, channels] of clientChannels.entries()) {
		if (!channels.has(message.channel)) continue;
		safeSend(ws, message);
	}
}

export const { upgradeWebSocket, websocket } = createBunWebSocket();

export function wsHandler(c: Context) {
	return upgradeWebSocket((_ctx) => ({
		onOpen(_event, ws) {
			const subscribed = parseChannelList(
				new URL(c.req.url).searchParams
					.get("channels")
					?.split(",")
					.map((value) => value.trim()),
			);
			clientChannels.set(ws.raw as WebSocket, new Set(subscribed));
			safeSend(ws.raw as WebSocket, {
				channel: "pos:session",
				event: "connected",
				payload: { channels: subscribed },
				timestamp: new Date().toISOString(),
				source: "server",
			});
		},
		onMessage(event, ws) {
			try {
				const parsed = JSON.parse(String(event.data)) as {
					type?: string;
					channels?: unknown;
				};
				if (parsed.type !== "subscribe") return;
				clientChannels.set(
					ws.raw as WebSocket,
					new Set(parseChannelList(parsed.channels)),
				);
			} catch {
				// Ignore invalid frames from clients.
			}
		},
		onClose(_event, ws) {
			clientChannels.delete(ws.raw as WebSocket);
		},
	})) as Response;
}
