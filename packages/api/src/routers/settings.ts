import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure, protectedProcedure } from "../index";
import { hasPermission, loadUserPermissions } from "../lib/permissions";

// ── Rate limiter for supervisor PIN attempts ───────────────────────────
// Key: requestingUserId, Value: { count, resetAt }
const supervisorAttempts = new Map<
	string,
	{ count: number; resetAt: number }
>();
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 60_000;

// ── getCurrentUser ──────────────────────────────────────────────────────
// Returns the current user's profile with their custom role and permissions.
// Used by the dashboard layout to populate RBAC-driven sidebar filtering.
const getCurrentUser = protectedProcedure
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const userId = context.session.user.id;

		// Get user's role assignment from the user_role → custom_role tables
		const roleAssignment = await db
			.select({
				roleName: schema.customRole.name,
				roleId: schema.customRole.id,
				permissions: schema.customRole.permissions,
			})
			.from(schema.userRole)
			.innerJoin(
				schema.customRole,
				eq(schema.userRole.roleId, schema.customRole.id),
			)
			.where(eq(schema.userRole.userId, userId))
			.limit(1);

		const role = roleAssignment[0];

		return {
			id: userId,
			name: context.session.user.name || "User",
			email: context.session.user.email || "",
			roleName: role?.roleName || "Cashier",
			roleId: role?.roleId || null,
			permissions: (role?.permissions as Record<string, string[]>) || {
				orders: ["create", "read"],
			},
		};
	});

// ── getOrganization ─────────────────────────────────────────────────────
const getOrganization = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const rows = await db.select().from(schema.organization).limit(1);

		if (rows.length === 0) return null;
		return rows[0]!;
	});

// ── getTaxRates ─────────────────────────────────────────────────────────
const getTaxRates = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const rates = await db
			.select()
			.from(schema.taxRate)
			.where(eq(schema.taxRate.isActive, true))
			.orderBy(asc(schema.taxRate.name));

		return rates;
	});

// ── getLocations ────────────────────────────────────────────────────────
const getLocations = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const locations = await db
			.select()
			.from(schema.location)
			.where(eq(schema.location.isActive, true))
			.orderBy(asc(schema.location.name));

		return locations;
	});

// ── getRegisters ────────────────────────────────────────────────────────
const getRegisters = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const registers = await db
			.select({
				id: schema.register.id,
				name: schema.register.name,
				locationId: schema.register.locationId,
				workflowMode: schema.register.workflowMode,
				isActive: schema.register.isActive,
			})
			.from(schema.register)
			.where(eq(schema.register.isActive, true))
			.orderBy(asc(schema.register.name));

		return registers;
	});

// ── getSuppliers ────────────────────────────────────────────────────────
const getSuppliers = permissionProcedure("settings.read")
	.input(
		z
			.object({
				organizationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = [eq(schema.supplier.isActive, true)];
		if (input.organizationId) {
			conditions.push(eq(schema.supplier.organizationId, input.organizationId));
		}

		const suppliers = await db
			.select()
			.from(schema.supplier)
			.where(and(...conditions))
			.orderBy(asc(schema.supplier.name));

		return suppliers;
	});

// ── createSupplier ──────────────────────────────────────────────────────
const createSupplier = permissionProcedure("settings.update")
	.input(
		z.object({
			organizationId: z.string().uuid().optional(),
			name: z.string().min(1),
			contactName: z.string().nullable().optional(),
			email: z.string().email().nullable().optional(),
			phone: z.string().nullable().optional(),
			address: z.string().nullable().optional(),
			salesRep: z.string().nullable().optional(),
			categories: z.array(z.string()).optional(),
			itemsSupplied: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";
		const rows = await db
			.insert(schema.supplier)
			.values({
				organizationId: input.organizationId ?? DEFAULT_ORG_ID,
				name: input.name,
				contactName: input.contactName ?? null,
				email: input.email ?? null,
				phone: input.phone ?? null,
				address: input.address ?? null,
				salesRep: input.salesRep ?? null,
				categories: input.categories ?? [],
				itemsSupplied: input.itemsSupplied ?? null,
			})
			.returning({ id: schema.supplier.id });

		return { id: rows[0]?.id };
	});

// ── updateSupplier ──────────────────────────────────────────────────────
const updateSupplier = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			contactName: z.string().nullable().optional(),
			email: z.string().email().nullable().optional(),
			phone: z.string().nullable().optional(),
			address: z.string().nullable().optional(),
			salesRep: z.string().nullable().optional(),
			categories: z.array(z.string()).optional(),
			itemsSupplied: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...rest } = input;
		const updates: Record<string, unknown> = {};
		if (rest.name !== undefined) updates.name = rest.name;
		if (rest.contactName !== undefined) updates.contactName = rest.contactName;
		if (rest.email !== undefined) updates.email = rest.email;
		if (rest.phone !== undefined) updates.phone = rest.phone;
		if (rest.address !== undefined) updates.address = rest.address;
		if (rest.salesRep !== undefined) updates.salesRep = rest.salesRep;
		if (rest.categories !== undefined) updates.categories = rest.categories;
		if (rest.itemsSupplied !== undefined)
			updates.itemsSupplied = rest.itemsSupplied;
		await db
			.update(schema.supplier)
			.set(updates)
			.where(eq(schema.supplier.id, id));
		return { success: true };
	});

// ── deleteSupplier ──────────────────────────────────────────────────────
const deleteSupplier = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.update(schema.supplier)
			.set({ isActive: false })
			.where(eq(schema.supplier.id, input.id));
		return { success: true };
	});

// ── getTables ───────────────────────────────────────────────────────────
const getTables = permissionProcedure("settings.read")
	.input(
		z
			.object({
				locationId: z.string().uuid().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const tables = await db
			.select({
				id: schema.tableLayout.id,
				locationId: schema.tableLayout.locationId,
				name: schema.tableLayout.name,
				section: schema.tableLayout.section,
				seats: schema.tableLayout.seats,
				positionX: schema.tableLayout.positionX,
				positionY: schema.tableLayout.positionY,
				shape: schema.tableLayout.shape,
				status: schema.tableLayout.status,
				currentOrderId: schema.tableLayout.currentOrderId,
				createdAt: schema.tableLayout.createdAt,
				updatedAt: schema.tableLayout.updatedAt,
				activeOrderId: schema.order.id,
				activeOrderNumber: schema.order.orderNumber,
				activeOrderTotal: schema.order.total,
				orderStatus: schema.order.status,
			})
			.from(schema.tableLayout)
			.leftJoin(
				schema.order,
				eq(schema.tableLayout.currentOrderId, schema.order.id),
			)
			.where(
				input.locationId
					? eq(schema.tableLayout.locationId, input.locationId)
					: undefined,
			)
			.orderBy(asc(schema.tableLayout.section), asc(schema.tableLayout.name));

		return tables;
	});

// ── updateTable ─────────────────────────────────────────────────────────
const updateTable = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			status: z.string().optional(),
			currentOrderId: z.string().uuid().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, status, currentOrderId } = input;

		if (currentOrderId !== undefined) {
			await db
				.update(schema.tableLayout)
				.set({
					status: status || "occupied",
					currentOrderId,
				})
				.where(eq(schema.tableLayout.id, id));
		} else if (status) {
			await db
				.update(schema.tableLayout)
				.set({ status })
				.where(eq(schema.tableLayout.id, id));
		}

		return { success: true };
	});

// ── getUsers ────────────────────────────────────────────────────────────
const getUsers = permissionProcedure("users.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const users = await db
			.select({
				id: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
				role: schema.user.role,
				createdAt: schema.user.createdAt,
				updatedAt: schema.user.updatedAt,
			})
			.from(schema.user)
			.orderBy(desc(schema.user.createdAt));

		return users;
	});

// ── createUser ──────────────────────────────────────────────────────────
// Note: In production, user creation should go through Better Auth's signUp flow.
// This is a simplified admin-side creation for the POS management panel.
const createUser = permissionProcedure("users.create")
	.input(
		z.object({
			name: z.string().min(1),
			email: z.string().email(),
			role: z.string().default("user"),
		}),
	)
	.handler(async ({ input }) => {
		const id = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.user).values({
			id,
			name: input.name,
			email: input.email,
			role: input.role,
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		});

		return {
			id,
			name: input.name,
			email: input.email,
			role: input.role,
		};
	});

// ── verifyPin ──────────────────────────────────────────────────────────
// PIN unlock for terminal lock screen. No special permission needed — any
// authenticated user can verify their own PIN.
const verifyPin = protectedProcedure
	.input(z.object({ pin: z.string().min(4).max(8) }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const rows = await db
			.select({ pinHash: schema.user.pinHash, name: schema.user.name })
			.from(schema.user)
			.where(eq(schema.user.id, userId));

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		const user = rows[0]!;
		if (!user.pinHash) {
			// No PIN set — allow unlock (first-time setup)
			return { success: true, userName: user.name };
		}

		const hash = createHash("sha256").update(input.pin).digest("hex");

		if (hash !== user.pinHash) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Invalid PIN",
			});
		}

		return { success: true, userName: user.name };
	});

// ── setPin ─────────────────────────────────────────────────────────────
const setPin = protectedProcedure
	.input(z.object({ pin: z.string().min(4).max(8) }))
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const hash = createHash("sha256").update(input.pin).digest("hex");

		await db
			.update(schema.user)
			.set({ pinHash: hash })
			.where(eq(schema.user.id, userId));

		return { success: true };
	});

// ── getReceiptConfig ──────────────────────────────────────────────────
const getReceiptConfig = permissionProcedure("settings.read")
	.input(z.object({ organizationId: z.string().uuid().optional() }).optional())
	.handler(async ({ input: rawInput }) => {
		const input = rawInput ?? {};
		const conditions = input.organizationId
			? [eq(schema.receiptConfig.organizationId, input.organizationId)]
			: [];

		const rows = await db
			.select()
			.from(schema.receiptConfig)
			.where(conditions.length ? and(...conditions) : undefined)
			.limit(1);

		if (rows.length > 0) return rows[0]!;

		// Return defaults if no config exists
		return {
			id: null,
			organizationId: input.organizationId ?? null,
			businessName: "Bettencourt's Food Inc.",
			tagline: "'A True Guyanese Gem'",
			addressLine1: "Lot 12 Robb Street",
			addressLine2: "Georgetown, Guyana",
			phone: "+592-227-0000",
			footerMessage: "Thank you for choosing Bettencourt's!",
			promoMessage: null,
			showLogo: true,
			createdAt: null,
			updatedAt: null,
		};
	});

// ── updateReceiptConfig ───────────────────────────────────────────────
const updateReceiptConfig = permissionProcedure("settings.update")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			businessName: z.string().min(1),
			tagline: z.string().nullable().optional(),
			addressLine1: z.string().nullable().optional(),
			addressLine2: z.string().nullable().optional(),
			phone: z.string().nullable().optional(),
			footerMessage: z.string().nullable().optional(),
			promoMessage: z.string().nullable().optional(),
			showLogo: z.boolean().default(true),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select({ id: schema.receiptConfig.id })
			.from(schema.receiptConfig)
			.where(eq(schema.receiptConfig.organizationId, input.organizationId))
			.limit(1);

		if (existing.length > 0) {
			await db
				.update(schema.receiptConfig)
				.set({
					businessName: input.businessName,
					tagline: input.tagline ?? null,
					addressLine1: input.addressLine1 ?? null,
					addressLine2: input.addressLine2 ?? null,
					phone: input.phone ?? null,
					footerMessage: input.footerMessage ?? null,
					promoMessage: input.promoMessage ?? null,
					showLogo: input.showLogo,
				})
				.where(eq(schema.receiptConfig.id, existing[0]?.id));
		} else {
			await db.insert(schema.receiptConfig).values({
				organizationId: input.organizationId,
				businessName: input.businessName,
				tagline: input.tagline ?? null,
				addressLine1: input.addressLine1 ?? null,
				addressLine2: input.addressLine2 ?? null,
				phone: input.phone ?? null,
				footerMessage: input.footerMessage ?? null,
				promoMessage: input.promoMessage ?? null,
				showLogo: input.showLogo,
			});
		}

		return { success: true };
	});

// ── createTaxRate ──────────────────────────────────────────────────────
const createTaxRate = permissionProcedure("settings.update")
	.input(
		z.object({
			organizationId: z.string().uuid(),
			name: z.string().min(1),
			rate: z.number().min(0).max(100),
			isDefault: z.boolean().default(false),
			isInclusive: z.boolean().default(false),
		}),
	)
	.handler(async ({ input }) => {
		const rateDecimal = (input.rate / 100).toFixed(4);

		if (input.isDefault) {
			await db
				.update(schema.taxRate)
				.set({ isDefault: false })
				.where(
					and(
						eq(schema.taxRate.organizationId, input.organizationId),
						eq(schema.taxRate.isDefault, true),
					),
				);
		}

		const rows = await db
			.insert(schema.taxRate)
			.values({
				organizationId: input.organizationId,
				name: input.name,
				rate: rateDecimal,
				isDefault: input.isDefault,
			})
			.returning({ id: schema.taxRate.id });

		return { id: rows[0]?.id };
	});

// ── updateTaxRate ─────────────────────────────────────────────────────
const updateTaxRate = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			rate: z.number().min(0).max(100).optional(),
			isDefault: z.boolean().optional(),
			isInclusive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const existing = await db
			.select()
			.from(schema.taxRate)
			.where(eq(schema.taxRate.id, input.id))
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Tax rate not found" });
		}

		if (input.isDefault) {
			await db
				.update(schema.taxRate)
				.set({ isDefault: false })
				.where(
					and(
						eq(schema.taxRate.organizationId, existing[0]?.organizationId),
						eq(schema.taxRate.isDefault, true),
						ne(schema.taxRate.id, input.id),
					),
				);
		}

		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.rate !== undefined) updates.rate = (input.rate / 100).toFixed(4);
		if (input.isDefault !== undefined) updates.isDefault = input.isDefault;

		await db
			.update(schema.taxRate)
			.set(updates)
			.where(eq(schema.taxRate.id, input.id));

		return { success: true };
	});

// ── deleteTaxRate ─────────────────────────────────────────────────────
const deleteTaxRate = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		await db
			.update(schema.taxRate)
			.set({ isActive: false })
			.where(eq(schema.taxRate.id, input.id));

		return { success: true };
	});

// ── getExchangeRates ───────────────────────────────────────────────────
const getExchangeRates = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const rows = await db
			.select({ settings: schema.organization.settings })
			.from(schema.organization)
			.limit(1);

		if (rows.length === 0) {
			return { usdToGydRate: 209.21, acceptUsd: false };
		}

		const settings = (rows[0]?.settings ?? {}) as Record<string, unknown>;
		return {
			usdToGydRate:
				typeof settings.usdToGydRate === "number"
					? settings.usdToGydRate
					: 209.21,
			acceptUsd:
				typeof settings.acceptUsd === "boolean" ? settings.acceptUsd : false,
			updatedAt:
				typeof settings.exchangeRateUpdatedAt === "string"
					? settings.exchangeRateUpdatedAt
					: null,
		};
	});

// ── updateExchangeRate ────────────────────────────────────────────────
const updateExchangeRate = permissionProcedure("settings.update")
	.input(
		z.object({
			usdToGydRate: z.number().min(1),
			acceptUsd: z.boolean(),
		}),
	)
	.handler(async ({ input }) => {
		const rows = await db
			.select({
				id: schema.organization.id,
				settings: schema.organization.settings,
			})
			.from(schema.organization)
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}

		const org = rows[0]!;
		const currentSettings = (org.settings ?? {}) as Record<string, unknown>;
		const newSettings = {
			...currentSettings,
			usdToGydRate: input.usdToGydRate,
			acceptUsd: input.acceptUsd,
			exchangeRateUpdatedAt: new Date().toISOString(),
		};

		await db
			.update(schema.organization)
			.set({ settings: newSettings })
			.where(eq(schema.organization.id, org.id));

		return { success: true };
	});

// ── verifySupervisor ─────────────────────────────────────────────────
// Any authenticated user can call this to get supervisor authorization
// for a restricted action without logging out the cashier.
const verifySupervisor = protectedProcedure
	.input(
		z.object({
			pin: z.string().min(4).max(8),
			requiredPermission: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const requestingUserId = context.session.user.id;
		const now = Date.now();

		// Rate limit check
		const entry = supervisorAttempts.get(requestingUserId);
		if (entry) {
			if (now < entry.resetAt) {
				if (entry.count >= MAX_ATTEMPTS) {
					throw new ORPCError("TOO_MANY_REQUESTS", {
						message: "Too many failed attempts. Try again in a minute.",
					});
				}
			} else {
				// Window expired, reset
				supervisorAttempts.delete(requestingUserId);
			}
		}

		const hash = createHash("sha256").update(input.pin).digest("hex");

		// Find ANY user with this PIN hash
		const rows = await db
			.select({ id: schema.user.id, name: schema.user.name })
			.from(schema.user)
			.where(eq(schema.user.pinHash, hash))
			.limit(1);

		if (rows.length === 0) {
			const cur = supervisorAttempts.get(requestingUserId) ?? {
				count: 0,
				resetAt: now + WINDOW_MS,
			};
			supervisorAttempts.set(requestingUserId, {
				count: cur.count + 1,
				resetAt: cur.resetAt,
			});
			throw new ORPCError("UNAUTHORIZED", { message: "Invalid PIN" });
		}

		const supervisor = rows[0]!;

		// Load supervisor's permissions and check required permission
		const perms = await loadUserPermissions(supervisor.id);
		if (!hasPermission(perms, input.requiredPermission)) {
			const cur = supervisorAttempts.get(requestingUserId) ?? {
				count: 0,
				resetAt: now + WINDOW_MS,
			};
			supervisorAttempts.set(requestingUserId, {
				count: cur.count + 1,
				resetAt: cur.resetAt,
			});
			throw new ORPCError("UNAUTHORIZED", {
				message: "Supervisor does not have required permission",
			});
		}

		// Success — clear rate limit for this user
		supervisorAttempts.delete(requestingUserId);

		return {
			authorized: true,
			supervisorId: supervisor.id,
			supervisorName: supervisor.name,
		};
	});

export const settingsRouter = {
	getCurrentUser,
	getOrganization,
	getTaxRates,
	createTaxRate,
	updateTaxRate,
	deleteTaxRate,
	getReceiptConfig,
	updateReceiptConfig,
	getLocations,
	getRegisters,
	getSuppliers,
	createSupplier,
	updateSupplier,
	deleteSupplier,
	getTables,
	updateTable,
	getUsers,
	createUser,
	verifyPin,
	setPin,
	verifySupervisor,
	getExchangeRates,
	updateExchangeRate,
};
