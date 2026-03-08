import { describe, expect, test } from "bun:test";
import { hasPermission } from "../lib/has-permission";

describe("hasPermission — RBAC matrix", () => {
	const perms = {
		orders: ["create", "read", "void"],
		products: ["read"],
		reports: ["read"],
	};

	test("returns true when resource and action both match", () => {
		expect(hasPermission(perms, "orders.read")).toBe(true);
		expect(hasPermission(perms, "orders.void")).toBe(true);
		expect(hasPermission(perms, "products.read")).toBe(true);
	});

	test("returns false when action is not in the resource list", () => {
		expect(hasPermission(perms, "products.create")).toBe(false);
		expect(hasPermission(perms, "orders.delete")).toBe(false);
	});

	test("returns false when resource is not present at all", () => {
		expect(hasPermission(perms, "inventory.read")).toBe(false);
		expect(hasPermission(perms, "settings.update")).toBe(false);
	});

	test("returns false for malformed permission strings", () => {
		expect(hasPermission(perms, "orders")).toBe(false);
		expect(hasPermission(perms, "")).toBe(false);
		expect(hasPermission(perms, ".read")).toBe(false);
	});

	test("returns false with empty permissions object", () => {
		expect(hasPermission({}, "orders.read")).toBe(false);
	});

	test("cashier with minimal permissions cannot access reports", () => {
		const cashierPerms = {
			orders: ["create", "read"],
			shifts: ["create", "read"],
		};
		expect(hasPermission(cashierPerms, "reports.read")).toBe(false);
		expect(hasPermission(cashierPerms, "orders.read")).toBe(true);
	});
});
