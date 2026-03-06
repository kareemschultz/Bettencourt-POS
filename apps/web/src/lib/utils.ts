import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Returns today's date as YYYY-MM-DD in the Guyana timezone (UTC-4).
 * This ensures dates match the restaurant's operating day regardless
 * of where the browser is running.
 */
export function todayGY(): string {
	return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guyana" });
}
