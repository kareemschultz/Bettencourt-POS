# User Management Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand user management with admin controls (edit, reset password, set PIN, revoke sessions, delete, invite by email) and staff self-service (change own password + PIN, view/revoke own sessions), plus a forgot-password flow on the login screen.

**Architecture:** New oRPC procedures on the settings router use `better-auth/crypto` for password hashing and direct Drizzle queries for PIN/session management. A new `/dashboard/profile` route handles self-service. Forgot-password wires Better Auth's built-in `sendResetPassword` callback to the existing nodemailer SMTP utility.

**Tech Stack:** oRPC + Drizzle + Better Auth (`better-auth/crypto`) + React Router + Tanstack Query + shadcn/ui

---

## Quick Reference

- Settings router: `packages/api/src/routers/settings.ts`
- Auth config: `packages/auth/src/index.ts`
- Email utility: `apps/server/src/email.ts`
- Login page: `apps/web/src/routes/login.tsx`
- Settings page: `apps/web/src/routes/dashboard.settings.tsx`
- Route access: `apps/web/src/lib/route-access.ts`
- Sidebar: `apps/web/src/components/layout/app-sidebar.tsx`
- Schema: `packages/db/src/schema/auth.ts` — `user`, `account`, `session` tables
- Password hashing: `import { hashPassword, verifyPassword } from "better-auth/crypto"`
- Passwords stored in `account` table, `providerId = "credential"`, `password` column

---

### Task 1: Forgot-Password Email + Better Auth Wiring

**Files:**
- Modify: `apps/server/src/email.ts`
- Modify: `packages/auth/src/index.ts`

**Step 1: Add `sendPasswordResetEmail` to email utility**

In `apps/server/src/email.ts`, add after `sendBackupFailureAlert`:

```ts
export async function sendPasswordResetEmail(
	toEmail: string,
	resetUrl: string,
): Promise<void> {
	if (!env.SMTP_HOST) {
		console.warn("[email] SMTP not configured — cannot send password reset");
		return;
	}
	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		auth: env.SMTP_USER
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
	});
	await transporter.sendMail({
		from: env.SMTP_FROM,
		to: toEmail,
		subject: "Reset your Bettencourt POS password",
		text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request a password reset, ignore this email.`,
		html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request a password reset, ignore this email.</p>`,
	});
}
```

**Step 2: Wire `sendResetPassword` in Better Auth config**

In `packages/auth/src/index.ts`, add import:

```ts
import { sendPasswordResetEmail } from "../../../apps/server/src/email";
```

Wait — `packages/auth` cannot import from `apps/server` (wrong direction in monorepo). Instead, pass the callback as a parameter or use a different approach.

**Correct approach:** Wire the reset email directly in `packages/auth/src/index.ts` using nodemailer inline (not importing from apps/server), OR move the email utility to a shared package.

**Simplest correct approach:** Add nodemailer directly to the auth package for reset emails only.

Add `nodemailer` and `@types/nodemailer` to `packages/auth/package.json`:

```bash
cd packages/auth && bun add nodemailer && bun add -d @types/nodemailer
```

Then in `packages/auth/src/index.ts`, add reset password handler:

```ts
import { env } from "@Bettencourt-POS/env/server";
import nodemailer from "nodemailer";

// ... existing betterAuth config ...
emailAndPassword: {
  enabled: true,
  minPasswordLength: 8,
  sendResetPassword: async ({ user, url }) => {
    if (!env.SMTP_HOST) {
      console.warn("[auth] SMTP not configured — skipping reset email for", user.email);
      return;
    }
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    });
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: user.email,
      subject: "Reset your Bettencourt POS password",
      text: `Reset your password: ${url}\n\nExpires in 1 hour. If you did not request this, ignore this email.`,
      html: `<p>Click to reset your password (expires in 1 hour):</p><p><a href="${url}">${url}</a></p>`,
    });
  },
},
```

**Step 3: TypeScript check**

```bash
cd /path/to/Bettencourt-POS && bun run check-types
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add packages/auth/src/index.ts packages/auth/package.json apps/server/src/email.ts bun.lock
```
Save to `/tmp/commit.txt`: `feat: wire forgot-password email via Better Auth sendResetPassword`
```bash
git commit -F /tmp/commit.txt
```

---

### Task 2: Admin API Procedures

**Files:**
- Modify: `packages/api/src/routers/settings.ts`
- Modify: `packages/api/src/routers/index.ts` (only if settings router export needs update — check first)

**Step 1: Add import for `hashPassword` and `verifyPassword`**

At the top of `packages/api/src/routers/settings.ts`, add:

```ts
import { hashPassword, verifyPassword } from "better-auth/crypto";
```

Also add `auth` import:

```ts
import { auth } from "@Bettencourt-POS/auth";
```

**Step 2: Update `getUsers` to include `banned`, `pinHash`, and last login**

Replace the existing `getUsers` handler to also return `banned` status and session info:

```ts
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

		// Get last login per user from sessions
		const userIds = users.map((u) => u.id);
		const sessions =
			userIds.length > 0
				? await db
						.select({
							userId: schema.session.userId,
							lastActive: schema.session.updatedAt,
						})
						.from(schema.session)
						.where(
							and(
								sql`${schema.session.userId} = ANY(${sql.raw(`ARRAY[${userIds.map((id) => `'${id}'`).join(",")}]`)})`,
								sql`${schema.session.expiresAt} > NOW()`,
							),
						)
						.orderBy(desc(schema.session.updatedAt))
				: [];

		// Map last session per user
		const lastLoginMap = new Map<string, Date>();
		for (const s of sessions) {
			if (!lastLoginMap.has(s.userId)) {
				lastLoginMap.set(s.userId, s.lastActive ?? new Date(0));
			}
		}

		return users.map((u) => ({
			...u,
			hasPin: !!u.hasPin,
			lastLoginAt: lastLoginMap.get(u.id)?.toISOString() ?? null,
		}));
	});
```

**Note:** The SQL for `ANY()` with user IDs is complex. Use a simpler approach with `inArray` from drizzle-orm:

```ts
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

// In getUsers handler, after fetching users:
const userIds = users.map((u) => u.id);
const recentSessions = userIds.length > 0
  ? await db
      .select({ userId: schema.session.userId, updatedAt: schema.session.updatedAt })
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
```

Also add `inArray` to the drizzle imports at the top of the file.

**Step 3: Add `updateUserDetails` procedure**

```ts
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
		// Verify target user is in this org
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
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}
		const updates: Record<string, unknown> = { updatedAt: new Date() };
		if (input.name) updates.name = input.name;
		if (input.email) updates.email = input.email;
		await db
			.update(schema.user)
			.set(updates)
			.where(eq(schema.user.id, input.userId));
		return { success: true };
	});
```

**Step 4: Add `adminResetPassword` procedure**

```ts
const adminResetPassword = permissionProcedure("users.update")
	.input(
		z.object({
			userId: z.string(),
			newPassword: z.string().min(8),
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
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}
		const hashed = await hashPassword(input.newPassword);
		// Update the credential account row
		const updated = await db
			.update(schema.account)
			.set({ password: hashed })
			.where(
				and(
					eq(schema.account.userId, input.userId),
					eq(schema.account.providerId, "credential"),
				),
			)
			.returning({ id: schema.account.id });
		if (updated.length === 0) {
			// No credential account — create one
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
		return { success: true };
	});
```

**Step 5: Add `adminSetPin` procedure**

```ts
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
		if (memberRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}
		const pinHash = input.pin
			? createHash("sha256").update(input.pin).digest("hex")
			: null;
		await db
			.update(schema.user)
			.set({ pinHash })
			.where(eq(schema.user.id, input.userId));
		return { success: true };
	});
```

**Step 6: Add `revokeUserSessions` procedure**

```ts
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
		if (memberRows.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}
		await db
			.delete(schema.session)
			.where(eq(schema.session.userId, input.userId));
		return { success: true };
	});
```

**Step 7: Add `deleteUser` procedure**

```ts
const deleteUser = permissionProcedure("users.update")
	.input(z.object({ userId: z.string() }))
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		// Block self-deletion
		if (input.userId === context.session.user.id) {
			throw new ORPCError("BAD_REQUEST", {
				message: "You cannot delete your own account",
			});
		}
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
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}
		// Better Auth cascades sessions/accounts via FK
		await db.delete(schema.user).where(eq(schema.user.id, input.userId));
		return { success: true };
	});
```

**Step 8: Add `inviteUser` procedure**

```ts
const inviteUser = permissionProcedure("users.create")
	.input(
		z.object({
			name: z.string().min(1),
			email: z.string().email(),
			roleId: z.string().uuid(),
			sendInvite: z.boolean().default(false),
			tempPassword: z.string().min(8).optional(),
			pin: z.string().regex(/^\d{4,8}$/).optional().nullable(),
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
		if (roleRows.length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid role" });
		}

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
				id: crypto.randomUUID(),
				userId: id,
				roleId: input.roleId,
				organizationId: orgId,
				createdAt: now,
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

		// If invite requested and SMTP configured, send password reset link so user sets own password
		// Otherwise return temp password for admin to share
		return { success: true, userId: id, tempPassword: input.sendInvite ? null : password };
	});
```

**Step 9: Export all new procedures in the settings router's export object**

Find the `export const settingsRouter = {` block at the bottom of `settings.ts` and add all new procedures:

```ts
export const settingsRouter = {
  // ... existing ...
  updateUserDetails,
  adminResetPassword,
  adminSetPin,
  revokeUserSessions,
  deleteUser,
  inviteUser,
  changeOwnPassword,    // added in Task 3
  changeOwnPin,         // added in Task 3
  getOwnSessions,       // added in Task 3
  revokeOtherSessions,  // added in Task 3
};
```

**Step 10: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 11: Commit**

```bash
git add packages/api/src/routers/settings.ts
```
Save to `/tmp/commit.txt`: `feat: add admin user management API procedures`
```bash
git commit -F /tmp/commit.txt
```

---

### Task 3: Self-Service API Procedures

**Files:**
- Modify: `packages/api/src/routers/settings.ts`

**Step 1: Add `changeOwnPassword`**

```ts
const changeOwnPassword = protectedProcedure
	.input(
		z.object({
			currentPassword: z.string().min(1),
			newPassword: z.string().min(8),
		}),
	)
	.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		// Fetch current credential account
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
		if (accountRows.length === 0 || !accountRows[0]!.password) {
			throw new ORPCError("BAD_REQUEST", { message: "No password set" });
		}
		const valid = await verifyPassword({
			password: input.currentPassword,
			hash: accountRows[0]!.password,
		});
		if (!valid) {
			throw new ORPCError("BAD_REQUEST", { message: "Current password is incorrect" });
		}
		const hashed = await hashPassword(input.newPassword);
		await db
			.update(schema.account)
			.set({ password: hashed, updatedAt: new Date() })
			.where(eq(schema.account.id, accountRows[0]!.id));
		return { success: true };
	});
```

**Step 2: Add `changeOwnPin`**

```ts
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
```

**Step 3: Add `getOwnSessions`**

```ts
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
			...s,
			isCurrent: s.token === currentToken,
			// Never expose token to client
			token: undefined,
		}));
	});
```

**Step 4: Add `revokeOtherSessions`**

```ts
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
```

**Step 5: TypeScript check + commit**

```bash
bun run check-types
```
```bash
git add packages/api/src/routers/settings.ts
```
Save to `/tmp/commit.txt`: `feat: add self-service password/PIN/session API procedures`
```bash
git commit -F /tmp/commit.txt
```

---

### Task 4: Expanded Settings → Users Tab (Admin UI)

**Files:**
- Modify: `apps/web/src/routes/dashboard.settings.tsx`

This is the largest UI task. The `UsersTab` function currently handles create, change-role, and deactivate. We expand it with:
- Last login column
- Edit dialog (name + email)
- Reset password dialog (copy-to-clipboard)
- Set PIN dialog
- Revoke sessions action
- Delete user confirmation
- Updated create form (PIN field + invite toggle)

**Step 1: Add new state variables and mutations to `UsersTab`**

Find `function UsersTab()` and add new state + mutations after existing ones:

```tsx
// New state
const [editTarget, setEditTarget] = useState<UserRow | null>(null);
const [editName, setEditName] = useState("");
const [editEmail, setEditEmail] = useState("");
const [resetPwTarget, setResetPwTarget] = useState<UserRow | null>(null);
const [tempPassword, setTempPassword] = useState("");
const [pinTarget, setPinTarget] = useState<UserRow | null>(null);
const [newPin, setNewPin] = useState("");
const [confirmPin, setConfirmPin] = useState("");
const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
const [newUserPin, setNewUserPin] = useState("");
const [sendInvite, setSendInvite] = useState(false);
const [copied, setCopied] = useState(false);

// New mutations
const updateDetails = useMutation(
  orpc.settings.updateUserDetails.mutationOptions({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: usersKey }); setEditTarget(null); toast.success("User updated"); },
    onError: (e) => toast.error(e.message),
  }),
);
const resetPassword = useMutation(
  orpc.settings.adminResetPassword.mutationOptions({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: usersKey }); toast.success("Password reset"); },
    onError: (e) => toast.error(e.message),
  }),
);
const setPin = useMutation(
  orpc.settings.adminSetPin.mutationOptions({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: usersKey }); setPinTarget(null); setNewPin(""); setConfirmPin(""); toast.success("PIN updated"); },
    onError: (e) => toast.error(e.message),
  }),
);
const revokeSessions = useMutation(
  orpc.settings.revokeUserSessions.mutationOptions({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: usersKey }); toast.success("Sessions revoked"); },
    onError: (e) => toast.error(e.message),
  }),
);
const deleteUserMutation = useMutation(
  orpc.settings.deleteUser.mutationOptions({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: usersKey }); setDeleteTarget(null); toast.success("User deleted"); },
    onError: (e) => toast.error(e.message),
  }),
);
const inviteUser = useMutation(
  orpc.settings.inviteUser.mutationOptions({
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: usersKey });
      setShowCreate(false);
      setNewName(""); setNewEmail(""); setNewRoleId(""); setNewUserPin(""); setSendInvite(false);
      if (res.tempPassword) {
        setTempPassword(res.tempPassword);
        setResetPwTarget({ id: "", name: newName, email: newEmail } as UserRow);
      }
      toast.success("User created");
    },
    onError: (e) => toast.error(e.message),
  }),
);
```

**Step 2: Add `lastLoginAt` and `hasPin` to `UserRow` type**

Find the `UserRow` type (or infer it from query result) and ensure it includes these fields. The type is typically inferred — the new `getUsers` return already includes them.

**Step 3: Update the table to add Last Login column and new actions**

In the `<TableHeader>`:
```tsx
<TableHead>Last Login</TableHead>
<TableHead>PIN</TableHead>
```

In each `<TableRow>` for users, add cells:
```tsx
<TableCell className="text-muted-foreground text-xs">
  {(u as any).lastLoginAt
    ? new Date((u as any).lastLoginAt).toLocaleDateString("en-GY", { timeZone: "America/Guyana" })
    : "Never"}
</TableCell>
<TableCell>
  {(u as any).hasPin ? (
    <Badge variant="outline" className="text-xs">PIN set</Badge>
  ) : (
    <span className="text-muted-foreground text-xs">—</span>
  )}
</TableCell>
```

**Step 4: Expand the dropdown menu per user row**

Replace the existing `DropdownMenuContent` items with:

```tsx
<DropdownMenuContent align="end">
  <DropdownMenuItem onClick={() => { setEditTarget(u as UserRow); setEditName(u.name); setEditEmail(u.email); }}>
    <Pencil className="mr-2 size-4" /> Edit Details
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => { setResetPwTarget(u as UserRow); setTempPassword(""); }}>
    <KeyRound className="mr-2 size-4" /> Reset Password
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => { setPinTarget(u as UserRow); setNewPin(""); setConfirmPin(""); }}>
    <Hash className="mr-2 size-4" /> Set PIN
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => { setEditingUser(u as UserRow); setSelectedRoleId(""); }}>
    <Shield className="mr-2 size-4" /> Change Role
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => revokeSessions.mutate({ userId: u.id })}>
    <LogOut className="mr-2 size-4" /> Revoke All Sessions
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  {(u as UserRow).banned ? (
    <DropdownMenuItem onClick={() => updateUser.mutate({ userId: u.id, banned: false })}>
      <Power className="mr-2 size-4 text-green-600" /> Reactivate
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem className="text-orange-600" onClick={() => setDeactivateTarget(u as UserRow)}>
      <X className="mr-2 size-4" /> Deactivate
    </DropdownMenuItem>
  )}
  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(u as UserRow)}>
    <Trash2 className="mr-2 size-4" /> Delete Permanently
  </DropdownMenuItem>
</DropdownMenuContent>
```

Add `Pencil, Hash, LogOut, Trash2, KeyRound` to the imports at the top of the file.

**Step 5: Add dialogs after the main Card**

Add these dialogs after the existing role-change and deactivate dialogs:

```tsx
{/* Edit Details Dialog */}
<Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
  <DialogContent>
    <DialogHeader><DialogTitle>Edit User Details</DialogTitle></DialogHeader>
    <div className="space-y-3">
      <div><Label>Name</Label>
        <Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
      <div><Label>Email</Label>
        <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
      <Button onClick={() => editTarget && updateDetails.mutate({ userId: editTarget.id, name: editName, email: editEmail })}
        disabled={updateDetails.isPending}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* Reset Password Dialog */}
<Dialog open={!!resetPwTarget} onOpenChange={(o) => !o && setResetPwTarget(null)}>
  <DialogContent>
    <DialogHeader><DialogTitle>Reset Password{resetPwTarget ? ` — ${resetPwTarget.name}` : ""}</DialogTitle></DialogHeader>
    <div className="space-y-3">
      <div>
        <Label>New Temporary Password</Label>
        <div className="flex gap-2">
          <Input value={tempPassword} onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Min 8 characters" type="text" />
          <Button variant="outline" size="icon" onClick={() => {
            navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button>
        </div>
        <p className="mt-1 text-muted-foreground text-xs">Share this with the staff member verbally or via SMS.</p>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setResetPwTarget(null)}>Cancel</Button>
      <Button onClick={() => resetPwTarget && resetPassword.mutate({ userId: resetPwTarget.id, newPassword: tempPassword })}
        disabled={resetPassword.isPending || tempPassword.length < 8}>Reset Password</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* Set PIN Dialog */}
<Dialog open={!!pinTarget} onOpenChange={(o) => !o && setPinTarget(null)}>
  <DialogContent>
    <DialogHeader><DialogTitle>Set PIN{pinTarget ? ` — ${pinTarget.name}` : ""}</DialogTitle></DialogHeader>
    <div className="space-y-3">
      <div><Label>New PIN (4–8 digits)</Label>
        <Input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
          maxLength={8} inputMode="numeric" placeholder="e.g. 1234" /></div>
      <div><Label>Confirm PIN</Label>
        <Input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
          maxLength={8} inputMode="numeric" placeholder="Repeat PIN" /></div>
      {newPin && confirmPin && newPin !== confirmPin && (
        <p className="text-destructive text-xs">PINs do not match</p>)}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => { setPinTarget(null); setPin.mutate({ userId: pinTarget!.id, pin: null }); }}>Clear PIN</Button>
      <Button onClick={() => pinTarget && setPin.mutate({ userId: pinTarget.id, pin: newPin })}
        disabled={setPin.isPending || newPin.length < 4 || newPin !== confirmPin}>Set PIN</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* Delete User Confirmation */}
<AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Permanently delete {deleteTarget?.name}?</AlertDialogTitle>
      <AlertDialogDescription>
        This removes the account, all sessions, and all login history. This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
        onClick={() => deleteTarget && deleteUserMutation.mutate({ userId: deleteTarget.id })}>
        Delete Permanently
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Add `Check, Copy` to lucide-react imports, and `AlertDialog*` components to imports.

**Step 6: Update the create-user form to use `inviteUser` + add PIN field**

Replace the submit handler of the create form to call `inviteUser.mutate(...)` instead of `createUser.mutate(...)`. Add PIN field and invite toggle below the role selector:

```tsx
<div>
  <Label>PIN (optional, 4–8 digits)</Label>
  <Input value={newUserPin} onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ""))}
    maxLength={8} inputMode="numeric" placeholder="Leave blank for no PIN" />
</div>
<div className="flex items-center gap-2">
  <input type="checkbox" id="send-invite" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
  <Label htmlFor="send-invite" className="cursor-pointer text-sm font-normal">
    Send invite email (staff sets their own password)
  </Label>
</div>
```

**Step 7: Biome check + TypeScript check**

```bash
bun run check-types && bun run lint
```
Fix any errors before committing.

**Step 8: Commit**

```bash
git add apps/web/src/routes/dashboard.settings.tsx
```
Save to `/tmp/commit.txt`: `feat: expand Users tab with admin password/PIN/delete/invite controls`
```bash
git commit -F /tmp/commit.txt
```

---

### Task 5: `/dashboard/profile` Page (Staff Self-Service)

**Files:**
- Create: `apps/web/src/routes/dashboard.profile.tsx`
- Modify: `apps/web/src/lib/route-access.ts`
- Modify: `apps/web/src/routes/dashboard.tsx`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

**Step 1: Password strength helper**

At the top of the new file, add this pure function (no library needed):

```ts
function passwordStrength(pw: string): { label: string; color: string; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", score };
  if (score <= 3) return { label: "Fair", color: "bg-yellow-500", score };
  return { label: "Strong", color: "bg-green-500", score };
}
```

**Step 2: Create the full profile page**

Create `apps/web/src/routes/dashboard.profile.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { orpc } from "@/utils/orpc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function passwordStrength(pw: string): { label: string; color: string; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", score };
  if (score <= 3) return { label: "Fair", color: "bg-yellow-500", score };
  return { label: "Strong", color: "bg-green-500", score };
}

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me, isLoading } = useQuery(
    orpc.settings.getCurrentUser.queryOptions({ input: {} }),
  );
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery(
    orpc.settings.getOwnSessions.queryOptions({ input: {} }),
  );

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const strength = passwordStrength(newPw);

  // Change PIN state
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const changePw = useMutation(
    orpc.settings.changeOwnPassword.mutationOptions({
      onSuccess: () => {
        toast({ title: "Password changed" });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    }),
  );

  const changePin = useMutation(
    orpc.settings.changeOwnPin.mutationOptions({
      onSuccess: () => {
        toast({ title: "PIN updated" });
        setNewPin(""); setConfirmPin("");
        queryClient.invalidateQueries({ queryKey: orpc.settings.getCurrentUser.queryOptions({ input: {} }).queryKey });
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    }),
  );

  const revokeOthers = useMutation(
    orpc.settings.revokeOtherSessions.mutationOptions({
      onSuccess: () => {
        toast({ title: "Signed out of all other devices" });
        queryClient.invalidateQueries({ queryKey: orpc.settings.getOwnSessions.queryOptions({ input: {} }).queryKey });
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    }),
  );

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your password and PIN</p>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <Skeleton className="h-10 w-full" /> : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{me?.name}</span>
                <Badge variant="outline" className="capitalize">{me?.roleName}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">{me?.email}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="size-4" /> Change Password
          </CardTitle>
          <CardDescription>Must be at least 8 characters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Current Password</Label>
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div>
            <Label>New Password</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            {newPw.length > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex gap-0.5 flex-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-muted"}`} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{strength.label}</span>
              </div>
            )}
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            {confirmPw && newPw !== confirmPw && (
              <p className="mt-1 text-destructive text-xs">Passwords do not match</p>
            )}
          </div>
          <Button
            onClick={() => changePw.mutate({ currentPassword: currentPw, newPassword: newPw })}
            disabled={changePw.isPending || !currentPw || newPw.length < 8 || newPw !== confirmPw}
          >
            {changePw.isPending ? "Saving..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Change PIN */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">POS PIN</CardTitle>
          <CardDescription>Used to log in to the POS terminal quickly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>New PIN (4–8 digits)</Label>
            <Input inputMode="numeric" maxLength={8}
              value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 1234" />
          </div>
          <div>
            <Label>Confirm PIN</Label>
            <Input inputMode="numeric" maxLength={8}
              value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Repeat PIN" />
            {confirmPin && newPin !== confirmPin && (
              <p className="mt-1 text-destructive text-xs">PINs do not match</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => changePin.mutate({ pin: newPin })}
              disabled={changePin.isPending || newPin.length < 4 || newPin !== confirmPin}
            >Set PIN</Button>
            <Button variant="outline"
              onClick={() => changePin.mutate({ pin: null })}
              disabled={changePin.isPending}
            >Clear PIN</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="size-4" /> Active Sessions
          </CardTitle>
          <CardDescription>Devices currently signed in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsLoading ? <Skeleton className="h-10 w-full" /> : (
            <>
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    {s.userAgent?.includes("Mobile") ? <Smartphone className="size-4 text-muted-foreground" /> : <Monitor className="size-4 text-muted-foreground" />}
                    <div>
                      <p className="text-xs font-medium">{s.userAgent?.split("/")[0] ?? "Unknown browser"}</p>
                      <p className="text-muted-foreground text-xs">{s.ipAddress ?? "Unknown IP"}</p>
                    </div>
                  </div>
                  {s.isCurrent && <Badge variant="secondary" className="text-xs">This device</Badge>}
                </div>
              ))}
              {otherSessions.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <LogOut className="size-3.5" />
                      Sign out all other devices ({otherSessions.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sign out {otherSessions.length} other device{otherSessions.length > 1 ? "s" : ""}?</AlertDialogTitle>
                      <AlertDialogDescription>You will remain signed in on this device.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revokeOthers.mutate({})}>Sign Out Others</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Add to route-access.ts**

In `apps/web/src/lib/route-access.ts`, `/dashboard/profile` should be accessible to all authenticated users — do NOT add it to `ROUTE_MODULE_MAP` (unlisted routes pass the access check by default in `hasRouteAccess`). Verify this is how it works by checking the `hasRouteAccess` function.

**Step 4: Add to PAGE_TITLES in dashboard.tsx**

```ts
"/dashboard/profile": "My Profile",
```

**Step 5: Update sidebar footer to include "My Profile" link**

In `apps/web/src/components/layout/app-sidebar.tsx`, find the `DropdownMenuContent` in `SidebarFooter` and add a profile link:

```tsx
<DropdownMenuContent side="top" align="start" className="w-56">
  <DropdownMenuItem asChild>
    <Link to="/dashboard/profile">
      <User className="mr-2 size-4" />
      My Profile
    </Link>
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={handleSignOut}>
    <LogOut className="mr-2 size-4" />
    Sign out
  </DropdownMenuItem>
</DropdownMenuContent>
```

Import `Link` is already present. Add `LogOut` to imports if not already there.

**Step 6: TypeScript + Biome check + commit**

```bash
bun run check-types && bun run lint
```
```bash
git add apps/web/src/routes/dashboard.profile.tsx apps/web/src/routes/dashboard.tsx apps/web/src/components/layout/app-sidebar.tsx apps/web/src/lib/route-access.ts
```
Save to `/tmp/commit.txt`: `feat: add /dashboard/profile self-service page`
```bash
git commit -F /tmp/commit.txt
```

---

### Task 6: Forgot Password + Reset Password Pages

**Files:**
- Modify: `apps/web/src/routes/login.tsx`
- Create: `apps/web/src/routes/reset-password.tsx`

**Step 1: Add "Forgot password?" to the EmailLogin component in login.tsx**

Find `function EmailLogin` and add forgot-password state + inline form. Add after the password field div:

```tsx
const [forgotMode, setForgotMode] = useState(false);
const [forgotEmail, setForgotEmail] = useState("");
const [forgotSent, setForgotSent] = useState(false);
const [forgotLoading, setForgotLoading] = useState(false);

async function handleForgot(e: React.FormEvent) {
  e.preventDefault();
  setForgotLoading(true);
  await authClient.forgetPassword({ email: forgotEmail, redirectTo: "/reset-password" });
  setForgotSent(true);
  setForgotLoading(false);
}
```

In the JSX, add a "Forgot password?" link below the password field:

```tsx
<div className="text-right">
  <button type="button" className="text-primary text-xs underline underline-offset-4"
    onClick={() => setForgotMode(true)}>
    Forgot password?
  </button>
</div>
```

When `forgotMode` is true, show the forgot-password UI instead of the normal login form:

```tsx
{forgotMode && (
  <div className="flex flex-col gap-5">
    <div>
      <h2 className="font-bold text-2xl text-foreground tracking-tight">Reset Password</h2>
      <p className="mt-1 text-muted-foreground text-sm">Enter your email to receive a reset link</p>
    </div>
    {forgotSent ? (
      <div className="rounded-md bg-green-50 p-4 text-green-800 text-sm dark:bg-green-950 dark:text-green-200">
        Check your email for a password reset link.
      </div>
    ) : (
      <form onSubmit={handleForgot} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="forgot-email">Email address</Label>
          <Input id="forgot-email" type="email" value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)} required
            className="h-12 text-base lg:h-11 lg:text-sm" />
        </div>
        <Button type="submit" disabled={forgotLoading}>
          {forgotLoading ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>
    )}
    <button type="button" className="text-muted-foreground text-sm underline"
      onClick={() => { setForgotMode(false); setForgotSent(false); }}>
      Back to login
    </button>
  </div>
)}
```

**Step 2: Create reset-password page**

Create `apps/web/src/routes/reset-password.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function passwordStrength(pw: string): { label: string; color: string; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", score };
  if (score <= 3) return { label: "Fair", color: "bg-yellow-500", score };
  return { label: "Strong", color: "bg-green-500", score };
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const strength = passwordStrength(newPw);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");
    const result = await authClient.resetPassword({ newPassword: newPw, token });
    if (result.error) {
      setError(result.error.message ?? "Reset failed. The link may have expired.");
      setLoading(false);
    } else {
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Set New Password</h1>
          <p className="mt-1 text-muted-foreground text-sm">Choose a strong password for your account</p>
        </div>
        {done ? (
          <div className="rounded-md bg-green-50 p-4 text-green-800 text-sm">
            Password reset! Redirecting to login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
              {newPw.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex gap-0.5 flex-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-muted"}`} />
                    ))}
                  </div>
                  <span className="text-muted-foreground text-xs">{strength.label}</span>
                </div>
              )}
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
              {confirmPw && newPw !== confirmPw && (
                <p className="mt-1 text-destructive text-xs">Passwords do not match</p>
              )}
            </div>
            {error && <p className="rounded-md bg-destructive/10 p-2 text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full"
              disabled={loading || newPw.length < 8 || newPw !== confirmPw}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Register the reset-password route**

Check `apps/web/src/routes.ts` (or wherever routes are defined in React Router v7 flat routes) — the file `reset-password.tsx` in the routes folder should be auto-registered as `/reset-password` by the flat-routes convention.

**Step 4: TypeScript + Biome check + commit**

```bash
bun run check-types && bun run lint
```
```bash
git add apps/web/src/routes/login.tsx apps/web/src/routes/reset-password.tsx
```
Save to `/tmp/commit.txt`: `feat: add forgot-password flow and reset-password page`
```bash
git commit -F /tmp/commit.txt
```

---

### Task 7: Final Check, Docker Rebuild, Docs, Push

**Step 1: Full TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors across all packages.

**Step 2: Production build**

```bash
bun run build
```
Expected: 3 tasks successful.

**Step 3: Update USER-MANUAL.md**

Add a section "Managing Your Account" to `docs/USER-MANUAL.md`:

```markdown
## Managing Your Account

### Change Your Password
Go to **My Profile** (click your name in the bottom-left sidebar) → **Change Password**.
Enter your current password, then your new password twice. Minimum 8 characters.

### Change Your POS PIN
Go to **My Profile** → **POS PIN** section. Enter and confirm your new 4–8 digit PIN.
You can also clear your PIN if you no longer use PIN login.

### Sign Out Other Devices
Go to **My Profile** → **Active Sessions**. Click "Sign out all other devices" to revoke all other sessions.

### Forgot Your Password
On the login screen, click **Email Login** then **Forgot password?**. Enter your email address.
You will receive a reset link by email (requires SMTP to be configured by your administrator).

## Admin: Managing Staff Accounts (Settings → Users)

### Reset a Staff Member's Password
In **Settings → Users**, click the ⋯ menu → **Reset Password**. Enter a temporary password and click the copy button to copy it. Share it with the staff member verbally or via SMS.

### Set a Staff Member's PIN
In **Settings → Users**, click ⋯ → **Set PIN**. Enter a 4–8 digit PIN twice and click Set PIN. Click "Clear PIN" to remove their PIN.

### Edit Name or Email
In **Settings → Users**, click ⋯ → **Edit Details**.

### Revoke All Sessions (Sign Out Everywhere)
In **Settings → Users**, click ⋯ → **Revoke All Sessions**. The staff member will be signed out of all devices immediately.

### Delete a User Permanently
In **Settings → Users**, click ⋯ → **Delete Permanently**. This cannot be undone.

### Invite a New Staff Member by Email
When creating a new user, check "Send invite email". The staff member will receive a link to set their own password. Requires SMTP to be configured.
```

**Step 4: Docker rebuild**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Expected: `Container kt-bettencourt-pos Started`

**Step 5: Final commit + push**

```bash
git add docs/USER-MANUAL.md
```
Save to `/tmp/commit.txt`: `feat: Plan 14 User Management Overhaul — complete`
```bash
git commit -F /tmp/commit.txt
git push origin master
```
