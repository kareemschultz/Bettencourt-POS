/**
 * Unit tests for PIN auth business logic.
 *
 * These test the *decisions* made by the handler — is the user banned?
 * is the IP locked out? — without hitting the DB or HTTP stack.
 */
import { describe, expect, test } from "bun:test";

// ── Banned-user determination ──────────────────────────────────────────────
// Mirrors the logic in apps/server/src/index.ts lines 105-107

type UserRow = {
	banned: boolean | null;
	banExpires: Date | null;
};

function isBannedUser(user: UserRow): boolean {
	return (
		user.banned === true &&
		(user.banExpires === null || user.banExpires > new Date())
	);
}

describe("PIN auth — banned-user check", () => {
	test("permanently banned user (no expiry) is rejected", () => {
		expect(isBannedUser({ banned: true, banExpires: null })).toBe(true);
	});

	test("user with future ban expiry is rejected", () => {
		const future = new Date(Date.now() + 60_000);
		expect(isBannedUser({ banned: true, banExpires: future })).toBe(true);
	});

	test("user whose ban has expired is allowed", () => {
		const past = new Date(Date.now() - 1000);
		expect(isBannedUser({ banned: true, banExpires: past })).toBe(false);
	});

	test("non-banned user is allowed", () => {
		expect(isBannedUser({ banned: false, banExpires: null })).toBe(false);
	});

	test("null banned field is treated as not banned", () => {
		expect(isBannedUser({ banned: null, banExpires: null })).toBe(false);
	});
});

// ── Rate-limiter state machine ─────────────────────────────────────────────
// Mirrors the logic in apps/server/src/index.ts lines 84-93 and 59-66

type RateState = { count: number; lockedUntil: number };

function recordFailure(
	store: Map<string, RateState>,
	ip: string,
	now = Date.now(),
): void {
	const existing = store.get(ip) || { count: 0, lockedUntil: 0 };
	existing.count += 1;
	if (existing.count >= 5) {
		existing.lockedUntil = now + 60_000;
	}
	store.set(ip, existing);
}

function isLockedOut(
	store: Map<string, RateState>,
	ip: string,
	now = Date.now(),
): boolean {
	const attempt = store.get(ip);
	return !!(attempt && attempt.count >= 5 && now < attempt.lockedUntil);
}

describe("PIN auth — rate limiter", () => {
	test("IP is not locked after fewer than 5 failures", () => {
		const store = new Map<string, RateState>();
		for (let i = 0; i < 4; i++) recordFailure(store, "1.2.3.4");
		expect(isLockedOut(store, "1.2.3.4")).toBe(false);
	});

	test("IP is locked out after exactly 5 failures", () => {
		const store = new Map<string, RateState>();
		for (let i = 0; i < 5; i++) recordFailure(store, "1.2.3.4");
		expect(isLockedOut(store, "1.2.3.4")).toBe(true);
	});

	test("lockout expires after 60 seconds", () => {
		const store = new Map<string, RateState>();
		const now = Date.now();
		for (let i = 0; i < 5; i++) recordFailure(store, "1.2.3.4", now);
		// 61 seconds later — lockout should have expired
		expect(isLockedOut(store, "1.2.3.4", now + 61_000)).toBe(false);
	});

	test("different IPs are tracked independently", () => {
		const store = new Map<string, RateState>();
		for (let i = 0; i < 5; i++) recordFailure(store, "1.2.3.4");
		// A completely different IP is not locked
		expect(isLockedOut(store, "5.6.7.8")).toBe(false);
	});

	test("unknown IP is never locked out", () => {
		const store = new Map<string, RateState>();
		expect(isLockedOut(store, "9.9.9.9")).toBe(false);
	});
});
