import { createContext } from "@Bettencourt-POS/api/context";
import { onKitchenEvent } from "@Bettencourt-POS/api/lib/kitchen-events";
import { appRouter } from "@Bettencourt-POS/api/routers/index";
import { auth } from "@Bettencourt-POS/auth";
import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { env } from "@Bettencourt-POS/env/server";
import { createHash } from "node:crypto";
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

const app = new Hono();

app.use(logger());
// Gzip/Brotli compression for all responses (API JSON, HTML, etc.)
// Static assets already served with correct Content-Encoding by serveStatic.
app.use("/*", compress());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

// PIN login: look up user by PIN hash, then sign in via Better Auth
const pinFailures = new Map<string, { count: number; lockedUntil: number }>();

app.post("/api/auth/pin-login", async (c) => {
	try {
		const body = await c.req.json();
		const pin = body?.pin;
		if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8) {
			return c.json({ error: "PIN must be 4-8 digits" }, 400);
		}

		const hash = createHash("sha256").update(pin).digest("hex");

		// Rate limit check
		const attempt = pinFailures.get(hash);
		if (attempt && attempt.count >= 3 && Date.now() < attempt.lockedUntil) {
			const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
			return c.json(
				{ error: `Too many attempts. Try again in ${remaining}s` },
				429,
			);
		}

		// Look up user by PIN hash
		const users = await db
			.select({
				id: schema.user.id,
				email: schema.user.email,
				name: schema.user.name,
			})
			.from(schema.user)
			.where(eq(schema.user.pinHash, hash))
			.limit(1);

		if (users.length === 0) {
			// Track failed attempt
			const existing = pinFailures.get(hash) || { count: 0, lockedUntil: 0 };
			existing.count += 1;
			if (existing.count >= 3) {
				existing.lockedUntil = Date.now() + 30_000; // 30s lockout
			}
			pinFailures.set(hash, existing);
			return c.json({ error: "Invalid PIN" }, 401);
		}

		// Clear failures on success
		pinFailures.delete(hash);

		const user = users[0]!;

		// Create a session directly via Better Auth's internal adapter (no password needed)
		const ctx = await auth.$context;
		const session = await ctx.internalAdapter.createSession(user.id);
		if (!session) {
			return c.json({ error: "Failed to create session" }, 500);
		}

		// Sign the session token using Better Auth's cookie signing format: "token.signature"
		const signedToken = `${session.token}.${await makeSignature(session.token, ctx.secret)}`;
		const cookieAttrs = ctx.authCookies.sessionToken.attributes;

		// Build the Set-Cookie header string
		const cookieParts = [
			`${ctx.authCookies.sessionToken.name}=${signedToken}`,
			`Path=${cookieAttrs.path ?? "/"}`,
			cookieAttrs.httpOnly ? "HttpOnly" : "",
			cookieAttrs.secure ? "Secure" : "",
			cookieAttrs.sameSite ? `SameSite=${cookieAttrs.sameSite}` : "",
			cookieAttrs.maxAge ? `Max-Age=${cookieAttrs.maxAge}` : "",
		]
			.filter(Boolean)
			.join("; ");

		return new Response(
			JSON.stringify({
				token: session.token,
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

// Health check for Docker
app.get("/health", (c) => {
	return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SSE endpoint for kitchen display real-time updates
app.get("/api/kitchen/events", (c) => {
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
	// SPA fallback: serve index.html for any unmatched route
	app.get("/*", serveStatic({ path: "./public/index.html" }));
} else {
	app.get("/", (c) => {
		return c.text("Bettencourt POS API — Development");
	});
}

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("SIGTERM received, shutting down gracefully...");
	process.exit(0);
});

export default {
	port: process.env.PORT ? Number(process.env.PORT) : 3000,
	fetch: app.fetch,
};
