import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Escape a string for safe interpolation into an HTML document. */
export function escapeHtml(str: string | null | undefined): string {
	if (!str) return "";
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Returns today's date as YYYY-MM-DD in the Guyana timezone (UTC-4).
 * This ensures dates match the restaurant's operating day regardless
 * of where the browser is running.
 */
export function todayGY(): string {
	return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guyana" });
}
