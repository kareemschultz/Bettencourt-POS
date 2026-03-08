import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { eq, sql } from "drizzle-orm";
import {
	computeNextFailureState,
	getLockoutRemainingSecondsFromState,
	PIN_MAX_ATTEMPTS,
	type FailureState,
} from "./pin-rate-limit-state";

const fallbackStore = new Map<string, FailureState>();

let dbLimiterHealthy = true;
let warnedFallback = false;

function isRelationMissingError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const candidate = error as { code?: string; message?: string };
	return (
		candidate.code === "42P01" ||
		candidate.message?.includes("pin_login_rate_limit") === true
	);
}

function warnFallback(error: unknown): void {
	if (warnedFallback) return;
	warnedFallback = true;
	console.warn(
		"[pin-rate-limit] Falling back to in-memory limiter (DB-backed table unavailable).",
		error,
	);
}

function normalizeIp(raw: string | null | undefined): string {
	if (!raw) return "unknown";
	const first = raw.split(",")[0]?.trim() ?? "";
	return first.length > 128 ? first.slice(0, 128) : first || "unknown";
}

function memoryLockoutRemainingSeconds(ip: string, now = Date.now()): number {
	return getLockoutRemainingSecondsFromState(fallbackStore.get(ip), now);
}

function memoryRecordFailure(ip: string, now = Date.now()): void {
	fallbackStore.set(ip, computeNextFailureState(fallbackStore.get(ip), now));
}

function memoryClearFailures(ip: string): void {
	fallbackStore.delete(ip);
}

async function runDbOrFallback<T>(
	runDb: () => Promise<T>,
	runFallback: () => T,
): Promise<T> {
	if (!dbLimiterHealthy) return runFallback();
	try {
		return await runDb();
	} catch (error) {
		if (isRelationMissingError(error)) {
			dbLimiterHealthy = false;
			warnFallback(error);
			return runFallback();
		}
		throw error;
	}
}

export function getClientIp(headers: Headers): string {
	return normalizeIp(
		headers.get("x-forwarded-for") ??
			headers.get("x-real-ip") ??
			headers.get("cf-connecting-ip"),
	);
}

export async function getPinLockoutRemainingSeconds(ip: string): Promise<number> {
	return runDbOrFallback(
		async () => {
			const rows = await db
				.select({ lockedUntil: schema.pinLoginRateLimit.lockedUntil })
				.from(schema.pinLoginRateLimit)
				.where(eq(schema.pinLoginRateLimit.ipAddress, ip))
				.limit(1);
			const lockedUntil = rows[0]?.lockedUntil;
			if (!lockedUntil) return 0;
			const msRemaining = lockedUntil.getTime() - Date.now();
			return msRemaining > 0 ? Math.ceil(msRemaining / 1000) : 0;
		},
		() => memoryLockoutRemainingSeconds(ip),
	);
}

export async function recordPinFailure(ip: string): Promise<void> {
	await runDbOrFallback(
		async () => {
			await db.execute(sql`
				INSERT INTO pin_login_rate_limit (
					ip_address,
					fail_count,
					window_started_at,
					locked_until,
					updated_at
				)
				VALUES (${ip}, 1, now(), null, now())
				ON CONFLICT (ip_address) DO UPDATE SET
					fail_count = CASE
						WHEN pin_login_rate_limit.window_started_at < now() - interval '60 seconds'
							THEN 1
						ELSE pin_login_rate_limit.fail_count + 1
					END,
					window_started_at = CASE
						WHEN pin_login_rate_limit.window_started_at < now() - interval '60 seconds'
							THEN now()
						ELSE pin_login_rate_limit.window_started_at
					END,
					locked_until = CASE
						WHEN (
							CASE
								WHEN pin_login_rate_limit.window_started_at < now() - interval '60 seconds'
									THEN 1
								ELSE pin_login_rate_limit.fail_count + 1
							END
						) >= ${PIN_MAX_ATTEMPTS}
							THEN now() + interval '60 seconds'
						ELSE null
					END,
					updated_at = now()
			`);
			// Opportunistic cleanup to keep the limiter table compact.
			if (Math.random() < 0.01) {
				await db.execute(sql`
					DELETE FROM pin_login_rate_limit
					WHERE updated_at < now() - interval '7 days'
				`);
			}
		},
		() => memoryRecordFailure(ip),
	);
}

export async function clearPinFailures(ip: string): Promise<void> {
	await runDbOrFallback(
		async () => {
			await db
				.delete(schema.pinLoginRateLimit)
				.where(eq(schema.pinLoginRateLimit.ipAddress, ip));
		},
		() => memoryClearFailures(ip),
	);
}
