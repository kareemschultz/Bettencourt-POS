export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 60_000;
export const PIN_WINDOW_MS = 60_000;

export type FailureState = {
	count: number;
	windowStartedAt: number;
	lockedUntil: number;
};

export function getLockoutRemainingSecondsFromState(
	state: FailureState | undefined,
	now = Date.now(),
): number {
	if (!state) return 0;
	if (state.count < PIN_MAX_ATTEMPTS) return 0;
	if (now >= state.lockedUntil) return 0;
	return Math.ceil((state.lockedUntil - now) / 1000);
}

export function computeNextFailureState(
	existing: FailureState | undefined,
	now = Date.now(),
): FailureState {
	if (!existing) {
		return { count: 1, windowStartedAt: now, lockedUntil: 0 };
	}
	const windowExpired = now - existing.windowStartedAt >= PIN_WINDOW_MS;
	const nextCount = (windowExpired ? 0 : existing.count) + 1;
	const lockedUntil = nextCount >= PIN_MAX_ATTEMPTS ? now + PIN_LOCKOUT_MS : 0;
	return {
		count: nextCount,
		windowStartedAt: windowExpired ? now : existing.windowStartedAt,
		lockedUntil,
	};
}
