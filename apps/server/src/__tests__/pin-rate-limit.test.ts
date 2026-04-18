import { describe, expect, test } from "bun:test";
import {
	computeNextFailureState,
	type FailureState,
	getLockoutRemainingSecondsFromState,
} from "../pin-rate-limit-state";

describe("PIN rate-limit state machine", () => {
	test("first failure starts a new window", () => {
		const now = 1_000_000;
		const state = computeNextFailureState(undefined, now);
		expect(state).toEqual({
			count: 1,
			windowStartedAt: now,
			lockedUntil: 0,
		});
	});

	test("increments count inside the same window", () => {
		const now = 1_000_000;
		const first = computeNextFailureState(undefined, now);
		const second = computeNextFailureState(first, now + 10_000);
		expect(second.count).toBe(2);
		expect(second.windowStartedAt).toBe(now);
		expect(second.lockedUntil).toBe(0);
	});

	test("locks after 5th failure", () => {
		const now = 1_000_000;
		let state: FailureState | undefined;
		for (let i = 0; i < 5; i++) {
			state = computeNextFailureState(state, now + i * 1_000);
		}
		expect(state?.count).toBe(5);
		expect(state?.lockedUntil).toBe(now + 4_000 + 60_000);
	});

	test("window expiry resets the counter", () => {
		const now = 1_000_000;
		const first = computeNextFailureState(undefined, now);
		const reset = computeNextFailureState(first, now + 61_000);
		expect(reset.count).toBe(1);
		expect(reset.windowStartedAt).toBe(now + 61_000);
		expect(reset.lockedUntil).toBe(0);
	});

	test("remaining lockout seconds rounds up", () => {
		const now = 1_000_000;
		const state: FailureState = {
			count: 5,
			windowStartedAt: now - 5_000,
			lockedUntil: now + 5_500,
		};
		expect(getLockoutRemainingSecondsFromState(state, now)).toBe(6);
		expect(getLockoutRemainingSecondsFromState(state, now + 5_600)).toBe(0);
	});
});
