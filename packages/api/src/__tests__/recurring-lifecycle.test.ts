import { describe, expect, it } from "bun:test";
import { computeRecurringLifecycle } from "../lib/recurring-lifecycle";

describe("recurring lifecycle", () => {
	it("completes when remaining cycles reaches zero", () => {
		const result = computeRecurringLifecycle({
			remainingCycles: 1,
			endDate: null,
			nextRunDate: new Date("2026-03-10T00:00:00.000Z"),
			isActive: true,
		});

		expect(result.nextRemainingCycles).toBe(0);
		expect(result.status).toBe("completed");
		expect(result.isActive).toBeFalse();
	});

	it("completes when next run passes end date", () => {
		const result = computeRecurringLifecycle({
			remainingCycles: null,
			endDate: new Date("2026-03-01T00:00:00.000Z"),
			nextRunDate: new Date("2026-03-15T00:00:00.000Z"),
			isActive: true,
		});

		expect(result.status).toBe("completed");
		expect(result.isActive).toBeFalse();
	});

	it("stays active with unlimited cycles before end date", () => {
		const result = computeRecurringLifecycle({
			remainingCycles: null,
			endDate: new Date("2026-12-31T00:00:00.000Z"),
			nextRunDate: new Date("2026-03-15T00:00:00.000Z"),
			isActive: true,
		});

		expect(result.nextRemainingCycles).toBeNull();
		expect(result.status).toBe("active");
		expect(result.isActive).toBeTrue();
	});
});
