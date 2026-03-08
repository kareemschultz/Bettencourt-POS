import { describe, expect, test } from "bun:test";
import { hasRouteAccess, ROUTE_MODULE_MAP } from "../lib/route-access";

const adminPerms = {
	orders: ["create", "read", "void", "refund"],
	products: ["create", "read", "update", "delete"],
	inventory: ["create", "read", "update", "delete"],
	reports: ["read"],
	settings: ["create", "read", "update", "delete"],
	shifts: ["create", "read", "update", "delete"],
	audit: ["read"],
	invoices: ["create", "read", "update", "delete"],
	quotations: ["create", "read", "update", "delete"],
};

const cashierPerms = {
	orders: ["create", "read"],
	shifts: ["create", "read"],
};

const noPerms: Record<string, string[]> = {};

describe("hasRouteAccess — route guard", () => {
	// ── Default-deny behaviour ──────────────────────────────────────────────

	test("/dashboard is always accessible to any authenticated user", () => {
		expect(hasRouteAccess("/dashboard", noPerms)).toBe(true);
		expect(hasRouteAccess("/dashboard", cashierPerms)).toBe(true);
		expect(hasRouteAccess("/dashboard", adminPerms)).toBe(true);
	});

	test("unmapped routes are DENIED (default-deny)", () => {
		expect(hasRouteAccess("/dashboard/unknown-page", adminPerms)).toBe(false);
		expect(hasRouteAccess("/dashboard/admin/secret", adminPerms)).toBe(false);
		expect(hasRouteAccess("/dashboard/anything", noPerms)).toBe(false);
	});

	// ── Admin can access everything mapped ─────────────────────────────────

	test("admin with full permissions can access all mapped routes", () => {
		for (const route of Object.keys(ROUTE_MODULE_MAP)) {
			expect(hasRouteAccess(route, adminPerms)).toBe(true);
		}
	});

	// ── Cashier access ─────────────────────────────────────────────────────

	test("cashier can access POS Terminal (orders module)", () => {
		expect(hasRouteAccess("/dashboard/pos", cashierPerms)).toBe(true);
	});

	test("cashier can access Orders page", () => {
		expect(hasRouteAccess("/dashboard/orders", cashierPerms)).toBe(true);
	});

	test("cashier can access Cash Control (shifts module)", () => {
		expect(hasRouteAccess("/dashboard/cash", cashierPerms)).toBe(true);
	});

	test("cashier CANNOT access Reports (no reports permission)", () => {
		expect(hasRouteAccess("/dashboard/reports", cashierPerms)).toBe(false);
	});

	test("cashier CANNOT access Settings", () => {
		expect(hasRouteAccess("/dashboard/settings", cashierPerms)).toBe(false);
	});

	test("cashier CANNOT access Inventory", () => {
		expect(hasRouteAccess("/dashboard/inventory", cashierPerms)).toBe(false);
	});

	test("cashier CANNOT access Audit Log", () => {
		expect(hasRouteAccess("/dashboard/audit", cashierPerms)).toBe(false);
	});

	// ── No permissions ─────────────────────────────────────────────────────

	test("user with no permissions cannot access any mapped route", () => {
		for (const route of Object.keys(ROUTE_MODULE_MAP)) {
			expect(hasRouteAccess(route, noPerms)).toBe(false);
		}
	});

	// ── Sub-path matching ──────────────────────────────────────────────────

	test("sub-paths of a mapped route are also gated", () => {
		// /dashboard/inventory/123 should require inventory permission
		expect(hasRouteAccess("/dashboard/inventory/123", cashierPerms)).toBe(
			false,
		);
		expect(hasRouteAccess("/dashboard/inventory/123", adminPerms)).toBe(true);
	});

	// ── Security: audit module tightly gated ───────────────────────────────

	test("audit route requires explicit audit.read permission", () => {
		const { audit: _removed, ...noAuditPerms } = adminPerms;
		expect(hasRouteAccess("/dashboard/audit", noAuditPerms)).toBe(false);
	});
});
