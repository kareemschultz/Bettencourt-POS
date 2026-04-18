export interface RecurringLifecycleInput {
	remainingCycles: number | null;
	endDate: Date | null;
	nextRunDate: Date;
	isActive: boolean;
}

export interface RecurringLifecycleResult {
	nextRemainingCycles: number | null;
	isCompleted: boolean;
	status: "active" | "completed";
	isActive: boolean;
}

export function computeRecurringLifecycle(
	input: RecurringLifecycleInput,
): RecurringLifecycleResult {
	const nextRemainingCycles =
		input.remainingCycles == null
			? null
			: Math.max(input.remainingCycles - 1, 0);

	const finishedByCycles = nextRemainingCycles === 0;
	const finishedByEndDate =
		input.endDate != null && input.nextRunDate > input.endDate;
	const isCompleted = finishedByCycles || finishedByEndDate;

	return {
		nextRemainingCycles,
		isCompleted,
		status: isCompleted ? "completed" : "active",
		isActive: isCompleted ? false : input.isActive,
	};
}
