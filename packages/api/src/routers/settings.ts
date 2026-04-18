import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure, protectedProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";
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

		// Get all of the user's role assignments from the user_role → custom_role tables
		const roleAssignments = await db
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
			.where(eq(schema.userRole.userId, userId));

		// Merge permissions across all assigned roles
		const merged: Record<string, string[]> = {};
		for (const role of roleAssignments) {
			const perms = role.permissions as Record<string, string[]>;
			for (const [resource, actions] of Object.entries(perms)) {
				if (!merged[resource]) merged[resource] = [];
				for (const action of actions) {
					if (!merged[resource].includes(action)) {
						merged[resource].push(action);
					}
				}
			}
		}

		// Get user's organization via member table + pinHash for offline unlock
		const [memberRow, userRow] = await Promise.all([
			db
				.select({ organizationId: schema.member.organizationId })
				.from(schema.member)
				.where(eq(schema.member.userId, userId))
				.limit(1),
			db
				.select({ pinHash: schema.user.pinHash })
				.from(schema.user)
				.where(eq(schema.user.id, userId))
				.limit(1),
		]);

		const primaryRole = roleAssignments[0];

		return {
			id: userId,
			name: context.session.user.name || "User",
			email: context.session.user.email || "",
			roleName: primaryRole?.roleName || "Cashier",
			roleId: primaryRole?.roleId || null,
			organizationId: memberRow[0]?.organizationId ?? null,
			pinHash: userRow[0]?.pinHash ?? null,
			permissions:
				Object.keys(merged).length > 0
					? merged
					: { orders: ["create", "read"] },
		};
	});

// ── getOrganization ─────────────────────────────────────────────────────
const getOrganization = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.organization)
			.where(eq(schema.organization.id, orgId))
			.limit(1);

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
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const suppliers = await db
			.select()
			.from(schema.supplier)
			.where(
				and(
					eq(schema.supplier.isActive, true),
					eq(schema.supplier.organizationId, orgId),
				),
			)
			.orderBy(asc(schema.supplier.name));

		return suppliers;
	});

// ── getSupplierById ─────────────────────────────────────────────────────
const getSupplierById = permissionProcedure("settings.read")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const [supplier] = await db
			.select()
			.from(schema.supplier)
			.where(
				and(
					eq(schema.supplier.id, input.id),
					eq(schema.supplier.organizationId, orgId),
				),
			)
			.limit(1);
		if (!supplier)
			throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
		return supplier;
	});

// ── createSupplier ──────────────────────────────────────────────────────
const createSupplier = permissionProcedure("settings.update")
	.input(
		z.object({
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
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.insert(schema.supplier)
			.values({
				organizationId: orgId,
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
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
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
			.where(
				and(
					eq(schema.supplier.id, id),
					eq(schema.supplier.organizationId, orgId),
				),
			);
		return { success: true };
	});

// ── deleteSupplier ──────────────────────────────────────────────────────
const deleteSupplier = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.supplier)
			.set({ isActive: false })
			.where(
				and(
					eq(schema.supplier.id, input.id),
					eq(schema.supplier.organizationId, orgId),
				),
			);
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
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const users = await db
			.select({
				id: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
				role: schema.user.role,
				banned: schema.user.banned,
				hasPin: schema.user.pinHash,
				createdAt: schema.user.createdAt,
				updatedAt: schema.user.updatedAt,
			})
			.from(schema.user)
			.innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
			.where(eq(schema.member.organizationId, orgId))
			.orderBy(desc(schema.user.createdAt));

		// Get the most recent session per user (last login indicator)
		const userIds = users.map((u) => u.id);
		const recentSessions =
			userIds.length > 0
				? await db
						.select({
							userId: schema.session.userId,
							updatedAt: schema.session.updatedAt,
						})
						.from(schema.session)
						.where(inArray(schema.session.userId, userIds))
						.orderBy(desc(schema.session.updatedAt))
				: [];

		const lastLoginMap = new Map<string, string>();
		for (const s of recentSessions) {
			if (!lastLoginMap.has(s.userId) && s.updatedAt) {
				lastLoginMap.set(s.userId, s.updatedAt.toISOString());
			}
		}

		return users.map((u) => ({
			...u,
			hasPin: !!u.hasPin,
			lastLoginAt: lastLoginMap.get(u.id) ?? null,
		}));
	});

// ── createUser ──────────────────────────────────────────────────────────
// Creates a new user and atomically assigns them to the org + POS role.
const createUser = permissionProcedure("users.create")
	.input(
		z.object({
			name: z.string().min(1),
			email: z.string().email(),
			roleId: z.string().uuid("Must select a valid role"),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const id = crypto.randomUUID();
		const now = new Date();
		const roleRows = await db
			.select({ id: schema.customRole.id })
			.from(schema.customRole)
			.where(
				and(
					eq(schema.customRole.id, input.roleId),
					eq(schema.customRole.organizationId, orgId),
				),
			)
			.limit(1);
		if (roleRows.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Selected role is not valid for your organization",
			});
		}

		await db.transaction(async (tx) => {
			// 1. Create auth user
			await tx.insert(schema.user).values({
				id,
				name: input.name,
				email: input.email,
				role: "user",
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			});

			// 2. Create org membership so the user appears in the org
			await tx.insert(schema.member).values({
				id: crypto.randomUUID(),
				organizationId: orgId,
				userId: id,
				role: "member",
				createdAt: now,
			});

			// 3. Assign POS role for RBAC
			await tx.insert(schema.userRole).values({
				userId: id,
				roleId: input.roleId,
			});
		});

		return { id, name: input.name, email: input.email };
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
// Receipt config is public data -- use protectedProcedure so cashiers can fetch it.
const getReceiptConfig = protectedProcedure
	.input(z.object({ organizationId: z.string().uuid().optional() }).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.receiptConfig)
			.where(eq(schema.receiptConfig.organizationId, orgId))
			.limit(1);

		if (rows.length > 0) return rows[0]!;

		// Return defaults if no config exists
		return {
			id: null,
			organizationId: orgId,
			businessName: "Bettencourt's Homestyle Diner",
			tagline: "A True Guyanese Gem",
			addressLine1: "22 ZZ Durban Street, Wortmanville",
			addressLine2: "Georgetown, Guyana",
			phone: "592-231-1368",
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
			organizationId: z.string().uuid().optional(),
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
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select({ id: schema.receiptConfig.id })
			.from(schema.receiptConfig)
			.where(eq(schema.receiptConfig.organizationId, orgId))
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
				.where(eq(schema.receiptConfig.id, existing[0]!.id));
		} else {
			await db.insert(schema.receiptConfig).values({
				organizationId: orgId,
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
			organizationId: z.string().uuid().optional(),
			name: z.string().min(1),
			rate: z.number().min(0).max(100),
			isDefault: z.boolean().default(false),
			isInclusive: z.boolean().default(false),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const rateDecimal = (input.rate / 100).toFixed(4);

		if (input.isDefault) {
			await db
				.update(schema.taxRate)
				.set({ isDefault: false })
				.where(
					and(
						eq(schema.taxRate.organizationId, orgId),
						eq(schema.taxRate.isDefault, true),
					),
				);
		}

		const rows = await db
			.insert(schema.taxRate)
			.values({
				organizationId: orgId,
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
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const existing = await db
			.select()
			.from(schema.taxRate)
			.where(
				and(
					eq(schema.taxRate.id, input.id),
					eq(schema.taxRate.organizationId, orgId),
				),
			)
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
						eq(schema.taxRate.organizationId, existing[0]!.organizationId),
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
			.where(
				and(
					eq(schema.taxRate.id, input.id),
					eq(schema.taxRate.organizationId, orgId),
				),
			);

		return { success: true };
	});

// ── deleteTaxRate ─────────────────────────────────────────────────────
const deleteTaxRate = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		await db
			.update(schema.taxRate)
			.set({ isActive: false })
			.where(
				and(
					eq(schema.taxRate.id, input.id),
					eq(schema.taxRate.organizationId, orgId),
				),
			);

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

// ── getDocumentSettings ───────────────────────────────────────────────
const getDocumentSettings = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const rows = await db
			.select()
			.from(schema.invoiceDocumentSettings)
			.where(eq(schema.invoiceDocumentSettings.organizationId, orgId))
			.limit(1);

		if (rows.length === 0) {
			const inserted = await db
				.insert(schema.invoiceDocumentSettings)
				.values({
					organizationId: orgId,
					invoiceFooterNote:
						"Payment is due within 30 days of the invoice date.",
					quotationFooterNote:
						"This quotation is valid for 30 days from the date of issue.",
					defaultQuotationTerms: "Valid for 30 days",
				})
				.returning();
			return inserted[0]!;
		}
		return rows[0]!;
	});

// ── updateDocumentSettings ────────────────────────────────────────────
const updateDocumentSettings = permissionProcedure("settings.update")
	.input(
		z.object({
			defaultTaxRate: z.number().min(0).max(100).optional(),
			defaultTaxMode: z.enum(["invoice", "line"]).optional(),
			defaultPaymentTerms: z.string().optional(),
			defaultDiscountType: z.enum(["percent", "fixed"]).optional(),
			companyTin: z.string().optional(),
			bankName: z.string().optional(),
			bankAccount: z.string().optional(),
			bankBranch: z.string().optional(),
			paymentInstructions: z.string().optional(),
			defaultQuotationTerms: z.string().optional(),
			invoiceFooterNote: z.string().optional(),
			quotationFooterNote: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const updates: Record<string, unknown> = {};
		if (input.defaultTaxRate !== undefined)
			updates.defaultTaxRate = String(input.defaultTaxRate);
		if (input.defaultTaxMode !== undefined)
			updates.defaultTaxMode = input.defaultTaxMode;
		if (input.defaultPaymentTerms !== undefined)
			updates.defaultPaymentTerms = input.defaultPaymentTerms;
		if (input.defaultDiscountType !== undefined)
			updates.defaultDiscountType = input.defaultDiscountType;
		if (input.companyTin !== undefined) updates.companyTin = input.companyTin;
		if (input.bankName !== undefined) updates.bankName = input.bankName;
		if (input.bankAccount !== undefined)
			updates.bankAccount = input.bankAccount;
		if (input.bankBranch !== undefined) updates.bankBranch = input.bankBranch;
		if (input.paymentInstructions !== undefined)
			updates.paymentInstructions = input.paymentInstructions;
		if (input.defaultQuotationTerms !== undefined)
			updates.defaultQuotationTerms = input.defaultQuotationTerms;
		if (input.invoiceFooterNote !== undefined)
			updates.invoiceFooterNote = input.invoiceFooterNote;
		if (input.quotationFooterNote !== undefined)
			updates.quotationFooterNote = input.quotationFooterNote;

		await db
			.insert(schema.invoiceDocumentSettings)
			.values({ organizationId: orgId, ...updates })
			.onConflictDoUpdate({
				target: schema.invoiceDocumentSettings.organizationId,
				set: updates,
			});

		return { success: true };
	});

// ── updateOrganization ────────────────────────────────────────────────
const updateOrganization = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
		}),
	)
	.handler(async ({ input }) => {
		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		await db
			.update(schema.organization)
			.set(updates)
			.where(eq(schema.organization.id, input.id));
		return { success: true };
	});

// ── updateLocation ────────────────────────────────────────────────────
const updateLocation = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			address: z.string().nullable().optional(),
			phone: z.string().nullable().optional(),
			timezone: z.string().optional(),
			receiptHeader: z.string().nullable().optional(),
			receiptFooter: z.string().nullable().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...rest } = input;
		const updates: Record<string, unknown> = {};
		if (rest.name !== undefined) updates.name = rest.name;
		if (rest.address !== undefined) updates.address = rest.address;
		if (rest.phone !== undefined) updates.phone = rest.phone;
		if (rest.timezone !== undefined) updates.timezone = rest.timezone;
		if (rest.receiptHeader !== undefined)
			updates.receiptHeader = rest.receiptHeader;
		if (rest.receiptFooter !== undefined)
			updates.receiptFooter = rest.receiptFooter;
		if (rest.isActive !== undefined) updates.isActive = rest.isActive;
		await db
			.update(schema.location)
			.set(updates)
			.where(eq(schema.location.id, id));
		return { success: true };
	});

// ── updateRegister ────────────────────────────────────────────────────
const updateRegister = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			workflowMode: z.string().optional(),
			receiptHeaderOverride: z.string().nullable().optional(),
			isActive: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...rest } = input;
		const updates: Record<string, unknown> = {};
		if (rest.name !== undefined) updates.name = rest.name;
		if (rest.workflowMode !== undefined)
			updates.workflowMode = rest.workflowMode;
		if (rest.receiptHeaderOverride !== undefined)
			updates.receiptHeaderOverride = rest.receiptHeaderOverride;
		if (rest.isActive !== undefined) updates.isActive = rest.isActive;
		await db
			.update(schema.register)
			.set(updates)
			.where(eq(schema.register.id, id));
		return { success: true };
	});

// ── updateUser ────────────────────────────────────────────────────────
const updateUser = permissionProcedure("users.update")
	.input(
		z.object({
			userId: z.string(),
			roleId: z.string().uuid().optional(),
			banned: z.boolean().optional(),
			name: z.string().min(1).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const memberRows = await db
			.select({ userId: schema.member.userId })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, input.userId),
					eq(schema.member.organizationId, orgId),
				),
			)
			.limit(1);
		if (memberRows.length === 0) {
			throw new ORPCError("FORBIDDEN", {
				message: "User is outside your organization scope",
			});
		}

		// Update user name / banned status
		const userUpdates: Record<string, unknown> = {};
		if (input.name !== undefined) userUpdates.name = input.name;
		if (input.banned !== undefined) userUpdates.banned = input.banned;
		if (Object.keys(userUpdates).length > 0) {
			await db
				.update(schema.user)
				.set(userUpdates)
				.where(eq(schema.user.id, input.userId));
		}

		// Change role: delete existing assignment then insert new one
		if (input.roleId !== undefined) {
			const roleRows = await db
				.select({ id: schema.customRole.id })
				.from(schema.customRole)
				.where(
					and(
						eq(schema.customRole.id, input.roleId),
						eq(schema.customRole.organizationId, orgId),
					),
				)
				.limit(1);
			if (roleRows.length === 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Selected role is not valid for your organization",
				});
			}
			await db
				.delete(schema.userRole)
				.where(eq(schema.userRole.userId, input.userId));
			await db.insert(schema.userRole).values({
				userId: input.userId,
				roleId: input.roleId,
			});
		}

		return { success: true };
	});

// ── getRoles ──────────────────────────────────────────────────────────
const getRoles = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgId = requireOrganizationId(context);
		const roles = await db
			.select({
				id: schema.customRole.id,
				name: schema.customRole.name,
				permissions: schema.customRole.permissions,
				isSystem: schema.customRole.isSystem,
				createdAt: schema.customRole.createdAt,
			})
			.from(schema.customRole)
			.where(eq(schema.customRole.organizationId, orgId))
			.orderBy(asc(schema.customRole.name));

		return roles;
	});

// ── createRole ────────────────────────────────────────────────────────
const createRole = permissionProcedure("settings.update")
	.input(
		z.object({
			name: z.string().min(1),
			permissions: z.record(z.string(), z.array(z.string())).default({}),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);

		const inserted = await db
			.insert(schema.customRole)
			.values({
				organizationId: orgId,
				name: input.name,
				permissions: input.permissions,
				isSystem: false,
			})
			.returning({ id: schema.customRole.id });

		return { id: inserted[0]?.id };
	});

// ── updateRole ────────────────────────────────────────────────────────
const updateRole = permissionProcedure("settings.update")
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).optional(),
			permissions: z.record(z.string(), z.array(z.string())).optional(),
		}),
	)
	.handler(async ({ input }) => {
		const updates: Record<string, unknown> = {};
		if (input.name !== undefined) updates.name = input.name;
		if (input.permissions !== undefined)
			updates.permissions = input.permissions;
		await db
			.update(schema.customRole)
			.set(updates)
			.where(eq(schema.customRole.id, input.id));
		return { success: true };
	});

// ── deleteRole ────────────────────────────────────────────────────────
const deleteRole = permissionProcedure("settings.update")
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		const rows = await db
			.select({ isSystem: schema.customRole.isSystem })
			.from(schema.customRole)
			.where(eq(schema.customRole.id, input.id))
			.limit(1);

		if (rows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Role not found" });
		}

		if (rows[0]!.isSystem) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot delete a system role",
			});
		}

		await db
			.delete(schema.customRole)
			.where(eq(schema.customRole.id, input.id));

		return { success: true };
	});

// ── getPosSettings ────────────────────────────────────────────────────
const getPosSettings = permissionProcedure("settings.read")
	.input(z.object({}).optional())
	.handler(async () => {
		const rows = await db
			.select({ settings: schema.organization.settings })
			.from(schema.organization)
			.limit(1);

		const s = (rows[0]?.settings ?? {}) as Record<string, unknown>;
		return {
			autoPrintReceipt:
				typeof s.autoPrintReceipt === "boolean" ? s.autoPrintReceipt : false,
			defaultOrderType:
				typeof s.defaultOrderType === "string" ? s.defaultOrderType : "dine_in",
			requireCashSession:
				typeof s.requireCashSession === "boolean"
					? s.requireCashSession
					: false,
			allowOpenPrice:
				typeof s.allowOpenPrice === "boolean" ? s.allowOpenPrice : false,
			requireNoteOnVoid:
				typeof s.requireNoteOnVoid === "boolean" ? s.requireNoteOnVoid : true,
			showTaxOnReceipt:
				typeof s.showTaxOnReceipt === "boolean" ? s.showTaxOnReceipt : true,
			enableTableManagement:
				typeof s.enableTableManagement === "boolean"
					? s.enableTableManagement
					: true,
			enableKds: typeof s.enableKds === "boolean" ? s.enableKds : true,
			enableLoyalty:
				typeof s.enableLoyalty === "boolean" ? s.enableLoyalty : true,
			enableGiftCards:
				typeof s.enableGiftCards === "boolean" ? s.enableGiftCards : true,
		};
	});

// ── updatePosSettings ─────────────────────────────────────────────────
const updatePosSettings = permissionProcedure("settings.update")
	.input(
		z.object({
			autoPrintReceipt: z.boolean().optional(),
			defaultOrderType: z.string().optional(),
			requireCashSession: z.boolean().optional(),
			allowOpenPrice: z.boolean().optional(),
			requireNoteOnVoid: z.boolean().optional(),
			showTaxOnReceipt: z.boolean().optional(),
			enableTableManagement: z.boolean().optional(),
			enableKds: z.boolean().optional(),
			enableLoyalty: z.boolean().optional(),
			enableGiftCards: z.boolean().optional(),
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

		if (rows.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });

		const org = rows[0]!;
		const current = (org.settings ?? {}) as Record<string, unknown>;
		const merged: Record<string, unknown> = { ...current };

		for (const [k, v] of Object.entries(input)) {
			if (v !== undefined) merged[k] = v;
		}

		await db
			.update(schema.organization)
			.set({ settings: merged })
			.where(eq(schema.organization.id, org.id));

		return { success: true };
	});

// ── updateUserDetails (admin) ───────────────────────────────────────────
const updateUserDetails = permissionProcedure("users.update")
	.input(
		z.object({
			userId: z.string(),
			name: z.string().min(1).optional(),
			email: z.string().email().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const memberRows = await db
			.select({ userId: schema.member.userId })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, input.userId),
					eq(schema.member.organizationId, orgId),
				),
			)
			.limit(1);
		if (memberRows.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		const updates: Record<string, unknown> = { updatedAt: new Date() };
		if (input.name) updates.name = input.name;
		if (input.email) updates.email = input.email;
		await db
			.update(schema.user)
			.set(updates)
			.where(eq(schema.user.id, input.userId));
		return { success: true };
	});

// ── adminResetPassword ──────────────────────────────────────────────────
// Generates a random temporary password, hashes and stores it, then returns
// the plain-text value once so the admin can share it with the user.
const adminResetPassword = permissionProcedure("users.update")
	.input(z.object({ userId: z.string() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const memberRows = await db
			.select({ userId: schema.member.userId })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, input.userId),
					eq(schema.member.organizationId, orgId),
				),
			)
			.limit(1);
		if (memberRows.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		// Generate a human-friendly temp password (12 chars, UUID-derived)
		const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
		const hashed = await hashPassword(tempPassword);
		const updated = await db
			.update(schema.account)
			.set({ password: hashed, updatedAt: new Date() })
			.where(
				and(
					eq(schema.account.userId, input.userId),
					eq(schema.account.providerId, "credential"),
				),
			)
			.returning({ id: schema.account.id });
		if (updated.length === 0) {
			// No credential account yet — create one
			await db.insert(schema.account).values({
				id: crypto.randomUUID(),
				accountId: input.userId,
				providerId: "credential",
				userId: input.userId,
				password: hashed,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}
		// Also revoke all active sessions so the user must log in with the new password
		await db
			.delete(schema.session)
			.where(eq(schema.session.userId, input.userId));
		return { success: true, tempPassword };
	});

// ── adminSetPin ─────────────────────────────────────────────────────────
const adminSetPin = permissionProcedure("users.update")
	.input(
		z.object({
			userId: z.string(),
			pin: z
				.string()
				.regex(/^\d{4,8}$/)
				.optional()
				.nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const memberRows = await db
			.select({ userId: schema.member.userId })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, input.userId),
					eq(schema.member.organizationId, orgId),
				),
			)
			.limit(1);
		if (memberRows.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		const pinHash = input.pin
			? createHash("sha256").update(input.pin).digest("hex")
			: null;
		await db
			.update(schema.user)
			.set({ pinHash })
			.where(eq(schema.user.id, input.userId));
		return { success: true };
	});

// ── revokeUserSessions (admin) ──────────────────────────────────────────
const revokeUserSessions = permissionProcedure("users.update")
	.input(z.object({ userId: z.string() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const memberRows = await db
			.select({ userId: schema.member.userId })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, input.userId),
					eq(schema.member.organizationId, orgId),
				),
			)
			.limit(1);
		if (memberRows.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		await db
			.delete(schema.session)
			.where(eq(schema.session.userId, input.userId));
		return { success: true };
	});

// ── deleteUser (admin) ─────────────────────────────────────────────────
const deleteUser = permissionProcedure("users.update")
	.input(z.object({ userId: z.string() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		if (input.userId === context.session.user.id)
			throw new ORPCError("BAD_REQUEST", {
				message: "You cannot delete your own account",
			});
		const memberRows = await db
			.select({ userId: schema.member.userId })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, input.userId),
					eq(schema.member.organizationId, orgId),
				),
			)
			.limit(1);
		if (memberRows.length === 0)
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		await db.delete(schema.user).where(eq(schema.user.id, input.userId));
		return { success: true };
	});

// ── inviteUser (admin, replaces createUser) ─────────────────────────────
const inviteUser = permissionProcedure("users.create")
	.input(
		z.object({
			name: z.string().min(1),
			email: z.string().email(),
			roleId: z.string().uuid(),
			sendInvite: z.boolean().default(false),
			tempPassword: z.string().min(8).optional(),
			pin: z
				.string()
				.regex(/^\d{4,8}$/)
				.optional()
				.nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const roleRows = await db
			.select({ id: schema.customRole.id })
			.from(schema.customRole)
			.where(
				and(
					eq(schema.customRole.id, input.roleId),
					eq(schema.customRole.organizationId, orgId),
				),
			)
			.limit(1);
		if (roleRows.length === 0)
			throw new ORPCError("BAD_REQUEST", { message: "Invalid role" });

		const password = input.tempPassword ?? crypto.randomUUID().slice(0, 12);
		const hashed = await hashPassword(password);
		const pinHash = input.pin
			? createHash("sha256").update(input.pin).digest("hex")
			: null;
		const id = crypto.randomUUID();
		const now = new Date();

		await db.transaction(async (tx) => {
			await tx.insert(schema.user).values({
				id,
				name: input.name,
				email: input.email,
				role: "user",
				emailVerified: true,
				pinHash,
				createdAt: now,
				updatedAt: now,
			});
			await tx.insert(schema.member).values({
				id: crypto.randomUUID(),
				organizationId: orgId,
				userId: id,
				role: "member",
				createdAt: now,
			});
			await tx.insert(schema.userRole).values({
				userId: id,
				roleId: input.roleId,
			});
			await tx.insert(schema.account).values({
				id: crypto.randomUUID(),
				accountId: id,
				providerId: "credential",
				userId: id,
				password: hashed,
				createdAt: now,
				updatedAt: now,
			});
		});

		return {
			success: true,
			userId: id,
			tempPassword: input.sendInvite ? null : password,
		};
	});

// ── changeOwnPassword (self-service) ───────────────────────────────────
const changeOwnPassword = protectedProcedure
	.input(
		z.object({
			currentPassword: z.string().min(1),
			newPassword: z.string().min(8),
		}),
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const accountRows = await db
			.select({ id: schema.account.id, password: schema.account.password })
			.from(schema.account)
			.where(
				and(
					eq(schema.account.userId, userId),
					eq(schema.account.providerId, "credential"),
				),
			)
			.limit(1);
		if (accountRows.length === 0 || !accountRows[0]!.password)
			throw new ORPCError("BAD_REQUEST", {
				message: "No password set on this account",
			});
		const valid = await verifyPassword({
			password: input.currentPassword,
			hash: accountRows[0]!.password,
		});
		if (!valid)
			throw new ORPCError("BAD_REQUEST", {
				message: "Current password is incorrect",
			});
		const hashed = await hashPassword(input.newPassword);
		await db
			.update(schema.account)
			.set({ password: hashed, updatedAt: new Date() })
			.where(eq(schema.account.id, accountRows[0]!.id));
		return { success: true };
	});

// ── changeOwnPin (self-service) ─────────────────────────────────────────
const changeOwnPin = protectedProcedure
	.input(
		z.object({
			pin: z
				.string()
				.regex(/^\d{4,8}$/, "PIN must be 4–8 digits")
				.optional()
				.nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const pinHash = input.pin
			? createHash("sha256").update(input.pin).digest("hex")
			: null;
		await db
			.update(schema.user)
			.set({ pinHash })
			.where(eq(schema.user.id, userId));
		return { success: true };
	});

// ── getOwnSessions (self-service) ───────────────────────────────────────
const getOwnSessions = protectedProcedure
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const currentToken = context.session.session.token;
		const sessions = await db
			.select({
				id: schema.session.id,
				token: schema.session.token,
				ipAddress: schema.session.ipAddress,
				userAgent: schema.session.userAgent,
				createdAt: schema.session.createdAt,
				updatedAt: schema.session.updatedAt,
				expiresAt: schema.session.expiresAt,
			})
			.from(schema.session)
			.where(eq(schema.session.userId, userId))
			.orderBy(desc(schema.session.updatedAt));
		return sessions.map((s) => ({
			id: s.id,
			ipAddress: s.ipAddress,
			userAgent: s.userAgent,
			createdAt: s.createdAt,
			updatedAt: s.updatedAt,
			expiresAt: s.expiresAt,
			isCurrent: s.token === currentToken,
		}));
	});

// ── revokeOtherSessions (self-service) ─────────────────────────────────
const revokeOtherSessions = protectedProcedure
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const currentToken = context.session.session.token;
		await db
			.delete(schema.session)
			.where(
				and(
					eq(schema.session.userId, userId),
					ne(schema.session.token, currentToken),
				),
			);
		return { success: true };
	});

export const settingsRouter = {
	getCurrentUser,
	getOrganization,
	updateOrganization,
	getTaxRates,
	createTaxRate,
	updateTaxRate,
	deleteTaxRate,
	getReceiptConfig,
	updateReceiptConfig,
	getLocations,
	updateLocation,
	getRegisters,
	updateRegister,
	getSuppliers,
	getSupplierById,
	createSupplier,
	updateSupplier,
	deleteSupplier,
	getTables,
	updateTable,
	getUsers,
	createUser,
	inviteUser,
	updateUser,
	updateUserDetails,
	adminResetPassword,
	adminSetPin,
	revokeUserSessions,
	deleteUser,
	changeOwnPassword,
	changeOwnPin,
	getOwnSessions,
	revokeOtherSessions,
	getRoles,
	createRole,
	updateRole,
	deleteRole,
	getPosSettings,
	updatePosSettings,
	verifyPin,
	setPin,
	verifySupervisor,
	getExchangeRates,
	updateExchangeRate,
	getDocumentSettings,
	updateDocumentSettings,
};
