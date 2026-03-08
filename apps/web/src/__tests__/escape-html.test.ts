import { describe, expect, test } from "bun:test";
import { escapeHtml } from "../lib/utils";

describe("escapeHtml — XSS prevention for print templates", () => {
	test("escapes < and >", () => {
		expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
		expect(escapeHtml("</script>")).toBe("&lt;/script&gt;");
	});

	test("escapes ampersand", () => {
		expect(escapeHtml("Bread & Butter")).toBe("Bread &amp; Butter");
	});

	test("escapes double quotes", () => {
		expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
	});

	test("escapes single quotes", () => {
		expect(escapeHtml("it's fine")).toBe("it&#39;s fine");
	});

	test("escapes a complete XSS payload", () => {
		const xss = `<img src=x onerror="alert('xss')">`;
		const escaped = escapeHtml(xss);
		expect(escaped).not.toContain("<");
		expect(escaped).not.toContain(">");
		expect(escaped).toContain("&lt;img");
		expect(escaped).toContain("&gt;");
	});

	test("returns empty string for null", () => {
		expect(escapeHtml(null)).toBe("");
	});

	test("returns empty string for undefined", () => {
		expect(escapeHtml(undefined)).toBe("");
	});

	test("returns empty string for empty string", () => {
		expect(escapeHtml("")).toBe("");
	});

	test("does not alter plain text without special characters", () => {
		expect(escapeHtml("Bettencourt's Food Inc")).toBe(
			"Bettencourt&#39;s Food Inc",
		);
		expect(escapeHtml("Order #1234")).toBe("Order #1234");
	});

	test("escapes all five HTML special characters in one string", () => {
		expect(escapeHtml(`<div class="a&b">it's</div>`)).toBe(
			"&lt;div class=&quot;a&amp;b&quot;&gt;it&#39;s&lt;/div&gt;",
		);
	});
});
