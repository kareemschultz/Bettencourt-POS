import { createContext } from "@Bettencourt-POS/api/context";
import { onKitchenEvent } from "@Bettencourt-POS/api/lib/kitchen-events";
import {
	hasPermission,
	loadUserPermissions,
} from "@Bettencourt-POS/api/lib/permissions";
import { onPosEvent } from "@Bettencourt-POS/api/lib/pos-events";
import { appRouter } from "@Bettencourt-POS/api/routers/index";
import { auth } from "@Bettencourt-POS/auth";
import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { env } from "@Bettencourt-POS/env/server";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { makeSignature } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { startBackupScheduler } from "./backup-engine";
import {
	clearPinFailures,
	getClientIp,
	getPinLockoutRemainingSeconds,
	recordPinFailure,
} from "./pin-rate-limit";
import { backupsRouter } from "./routes/backups";
import { publishPosEvent, websocket, wsHandler } from "./ws";

// BetterAuth uses 32-char alphanumeric IDs (not UUIDs) for sessions.
// Rejection sampling avoids modulo bias across the 62-char alphabet.
function generateBetterAuthId(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = randomBytes(64);
	let result = "";
	for (let i = 0; i < bytes.length && result.length < 32; i++) {
		const b = bytes[i]!;
		if (b < 248) result += chars[b % 62]!;
	}
	return result;
}

const app = new Hono();

app.use(logger());
// Gzip/Brotli compression for all responses (API JSON, HTML, etc.)
// Static assets already served with correct Content-Encoding by serveStatic.
app.use("/*", compress());
// Parse comma-separated CORS origins so Tauri desktop (tauri://localhost)
// and the web app (https://pos.bettencourtgy.com) both work.
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(
	"/*",
	cors({
		origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

// PIN login: look up user by PIN hash, then sign in via Better Auth.
// Rate limiting is DB-backed (with memory fallback) and keyed by client IP.

app.post("/api/auth/pin-login", async (c) => {
	try {
		const body = await c.req.json();
		const pin = body?.pin;
		if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8) {
			return c.json({ error: "PIN must be 4-8 digits" }, 400);
		}

		// Rate limit by IP — prevents brute-force across any target account
		const clientIp = getClientIp(c.req.raw.headers);
		const remaining = await getPinLockoutRemainingSeconds(clientIp);
		if (remaining > 0) {
			return c.json(
				{ error: `Too many attempts. Try again in ${remaining}s` },
				429,
			);
		}

		const hash = createHash("sha256").update(pin).digest("hex");

		// Look up user by PIN hash — only return non-banned users
		const users = await db
			.select({
				id: schema.user.id,
				email: schema.user.email,
				name: schema.user.name,
				banned: schema.user.banned,
				banExpires: schema.user.banExpires,
			})
			.from(schema.user)
			.where(eq(schema.user.pinHash, hash))
			.limit(1);

		if (users.length === 0) {
			await recordPinFailure(clientIp);
			return c.json({ error: "Invalid PIN" }, 401);
		}

		// biome-ignore lint/style/noNonNullAssertion: length guard above ensures element exists
		const user = users[0]!;

		// Check banned state — allow if ban has expired
		const isBanned =
			user.banned === true &&
			(user.banExpires === null || user.banExpires > new Date());
		if (isBanned) {
			await recordPinFailure(clientIp);
			return c.json({ error: "Account is disabled" }, 403);
		}

		// Clear failures on success
		await clearPinFailures(clientIp);

		// Create session directly via Drizzle — bypasses auth.$context which triggers
		// a Zod v4 cyclical schema bug in BetterAuth 1.5.x plugins.
		// Token format must match BetterAuth's: 32-char alphanumeric (not UUID).
		// Cookie name must include __Secure- prefix (BetterAuth adds this in production).
		const sessionToken = generateBetterAuthId();
		const sessionId = generateBetterAuthId();
		await db.insert(schema.session).values({
			id: sessionId,
			token: sessionToken,
			userId: user.id,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: clientIp ?? null,
			userAgent: c.req.raw.headers.get("user-agent") ?? null,
			activeOrganizationId: null,
		});

		const signedToken = `${sessionToken}.${await makeSignature(sessionToken, env.BETTER_AUTH_SECRET)}`;
		const cookieParts = [
			`__Secure-better-auth.session_token=${encodeURIComponent(signedToken)}`,
			"Path=/",
			"HttpOnly",
			"Secure",
			"SameSite=None",
			`Max-Age=${7 * 24 * 60 * 60}`,
		].join("; ");

		// Session is set via cookie only — do not expose token in response body
		return new Response(
			JSON.stringify({
				user: { id: user.id, email: user.email, name: user.name },
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Set-Cookie": cookieParts,
				},
			},
		);
	} catch (err) {
		console.error("PIN login error:", err);
		return c.json({ error: "Login failed" }, 500);
	}
});

// Demo login: only available in development/staging — disabled in production
app.post("/api/auth/demo-login", async (c) => {
	if (env.NODE_ENV === "production") {
		return c.json({ error: "Not found" }, 404);
	}
	const response = await auth.api.signInEmail({
		body: {
			email: "admin@bettencourt.com",
			password: "password123",
		},
		headers: c.req.raw.headers,
		asResponse: true,
	});
	return response;
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/backups", backupsRouter);

// ── Network print proxy ─────────────────────────────────────────────────
// Forwards ESC/POS data to a TCP printer on the local network
app.post("/api/print/network", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		const body = await c.req.json();
		const { address, data } = body as { address: string; data: number[] };

		if (!address || !data) {
			return c.json({ error: "address and data are required" }, 400);
		}

		// Parse host:port
		const [host, portStr] = address.split(":");
		const port = Number(portStr) || 9100; // Default ESC/POS port

		// Connect and send via Bun's TCP socket
		const payload = new Uint8Array(data);
		await new Promise<void>((resolve, reject) => {
			const socket = Bun.connect({
				hostname: host!,
				port,
				socket: {
					open(sock) {
						sock.write(payload);
						sock.end();
					},
					close() {
						resolve();
					},
					error(_sock, err) {
						reject(err);
					},
					data() {},
				},
			});
			// Reject if connect itself fails
			socket.catch(reject);
		});

		return c.json({ success: true });
	} catch (err) {
		console.error("[print/network] Error:", err);
		return c.json({ error: "Failed to send to printer" }, 500);
	}
});

app.get("/ws", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const permissions = await loadUserPermissions(session.user.id);
	if (!hasPermission(permissions, "orders.read")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	return wsHandler(c);
});

// ── Receipt photo upload ───────────────────────────────────────────────
const ALLOWED_MIME: Record<string, string> = {
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/webp": ".webp",
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Product image upload
app.post("/api/uploads/product", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) return c.json({ error: "Unauthorized" }, 401);

	const formData = await c.req.formData();
	const file = formData.get("file");
	if (!file || !(file instanceof File)) {
		return c.json({ error: "No file provided" }, 400);
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		return c.json({ error: "File too large (max 5 MB)" }, 400);
	}
	const ext = ALLOWED_MIME[file.type];
	if (!ext) {
		return c.json({ error: "Only JPEG, PNG, and WebP are allowed" }, 400);
	}

	const uploadsDir = join(env.UPLOADS_DIR, "products");
	await mkdir(uploadsDir, { recursive: true });

	const filename = `${randomUUID()}${ext}`;
	const dest = join(uploadsDir, filename);
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(dest, buffer);

	const url = `/uploads/products/${filename}`;
	return c.json({ url });
});

app.post("/api/uploads/receipt", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) return c.json({ error: "Unauthorized" }, 401);

	const formData = await c.req.formData();
	const file = formData.get("file");
	if (!file || !(file instanceof File)) {
		return c.json({ error: "No file provided" }, 400);
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		return c.json({ error: "File too large (max 5 MB)" }, 400);
	}
	const ext = ALLOWED_MIME[file.type];
	if (!ext) {
		return c.json({ error: "Only JPEG, PNG, and WebP are allowed" }, 400);
	}

	const uploadsDir = join(env.UPLOADS_DIR, "receipts");
	await mkdir(uploadsDir, { recursive: true });

	const filename = `${randomUUID()}${ext}`;
	const dest = join(uploadsDir, filename);
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(dest, buffer);

	const url = `/uploads/receipts/${filename}`;
	return c.json({ url });
});

// Serve uploaded files with correct MIME types
app.get("/uploads/*", async (c) => {
	const { readFile } = await import("node:fs/promises");
	const reqPath = new URL(c.req.url).pathname;
	const filePath = join(env.UPLOADS_DIR, reqPath.replace(/^\/uploads/, ""));
	try {
		const data = await readFile(filePath);
		const ext2 = extname(filePath).toLowerCase();
		const mimeMap: Record<string, string> = {
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".png": "image/png",
			".webp": "image/webp",
		};
		const contentType = mimeMap[ext2] ?? "application/octet-stream";
		return new Response(data, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "max-age=86400",
			},
		});
	} catch {
		return c.json({ error: "Not found" }, 404);
	}
});

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

// Bridge existing kitchen events into channel-based WebSocket feed
onKitchenEvent((event) => {
	publishPosEvent({
		channel: "pos:kds",
		event: event.type,
		payload: event,
		source: "kitchen-events",
	});
});

// Bridge POS events (86, order, table) into WebSocket feed
onPosEvent((event) => {
	const channelMap: Record<string, string> = {
		"product:86": "pos:86",
		"order:created": "pos:orders",
		"table:status_changed": "pos:tables",
	};
	publishPosEvent({
		channel: channelMap[event.type] as "pos:86" | "pos:orders" | "pos:tables",
		event: event.type === "product:86" ? "product:toggled" : event.type,
		payload: event,
		source: "pos-events",
	});
});

// Health check for Docker
app.get("/health", (c) => {
	return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SSE endpoint for kitchen display real-time updates — requires auth + orders.read permission
app.get("/api/kitchen/events", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const permissions = await loadUserPermissions(session.user.id);
	if (!hasPermission(permissions, "orders.read")) {
		return c.json({ error: "Forbidden" }, 403);
	}
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Send initial keepalive
			controller.enqueue(encoder.encode(": connected\n\n"));

			// Subscribe to kitchen events
			const unsubscribe = onKitchenEvent((event) => {
				try {
					const data = `data: ${JSON.stringify(event)}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch {
					// Stream closed
				}
			});

			// Heartbeat every 30s to keep connection alive
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": heartbeat\n\n"));
				} catch {
					clearInterval(heartbeat);
				}
			}, 30000);

			// Cleanup on close
			c.req.raw.signal.addEventListener("abort", () => {
				unsubscribe();
				clearInterval(heartbeat);
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
});

// Serve static files from the web build (production only)
if (process.env.NODE_ENV === "production") {
	app.use("/*", serveStatic({ root: "./public" }));
	// Fumadocs manual fallback: each page is prerendered, but serve index.html for safety
	app.get("/manual", serveStatic({ path: "./public/manual/index.html" }));
	app.get("/manual/*", serveStatic({ path: "./public/manual/index.html" }));
	// SPA fallback: serve index.html for any unmatched route
	app.get("/*", serveStatic({ path: "./public/index.html" }));
} else {
	app.get("/", (c) => {
		return c.text("Bettencourt POS API — Development");
	});
}

// Start backup scheduler (daily at midnight Guyana time)
startBackupScheduler();

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("SIGTERM received, shutting down gracefully...");
	process.exit(0);
});

export default {
	port: process.env.PORT ? Number(process.env.PORT) : 3000,
	fetch: app.fetch,
	websocket,
};
