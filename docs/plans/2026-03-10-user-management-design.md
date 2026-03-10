# User Management Overhaul — Design Document

**Date:** 2026-03-10
**Status:** Approved

---

## Overview

Comprehensive user management improvements covering admin controls, staff self-service, and a forgot-password flow. Splits into three surfaces: an expanded Settings → Users tab for admins, a new `/dashboard/profile` page for all staff, and a forgot-password / reset-password flow on the login screen.

---

## Architecture

### 1. Settings → Users Tab (Admin)
Expand the existing `UsersTab` component in `dashboard.settings.tsx`. No new route needed.

**New columns:**
- **Last Login** — relative time ("2 hours ago") or "Never", from `user.lastLoginAt` (Better Auth tracks this via `session`)

**New row actions (dropdown):**
- **Edit** — inline dialog to update name + email
- **Reset Password** — dialog: admin enters temp password, copy-to-clipboard button, shares verbally or via SMS
- **Set PIN** — dialog: enter 4–8 digits or clear existing PIN
- **Revoke All Sessions** — kills all active sessions for that user instantly
- **Delete** — `AlertDialog` confirmation, hard delete (blocks deleting self)

**Create user form additions:**
- Optional PIN field (4–8 digits)
- **Invite by email** toggle — if SMTP is configured, sends an invite email with a set-password link instead of requiring admin to set a password manually. Falls back to password field if SMTP not configured.

---

### 2. `/dashboard/profile` Page (All Staff)
New standalone route. Accessible to all authenticated users.

**Layout — two cards:**

**Identity card (read-only)**
- Name (read-only display)
- Email (read-only display)
- Role badge
- Last login time
- Active session count

**Change Password card**
- Current password field
- New password field + strength meter (Weak / Fair / Strong)
- Confirm new password field
- Save button → `changeOwnPassword`

**Change PIN card**
- New PIN field (4–8 digits, numeric input)
- Confirm PIN field
- Save button + Clear PIN button → `changeOwnPin`

**Sessions card**
- List of active sessions (device/browser, IP, last active)
- "Sign out all other devices" button → revokes all sessions except current

**Sidebar footer change:**
- Clicking the user name/role area opens a dropdown with: **My Profile** (→ `/dashboard/profile`) + **Sign Out**

---

### 3. Forgot Password Flow
- `/login` — "Forgot password?" link below the password field
- Inline email form → "Check your email" confirmation on submit
- Better Auth's `sendResetPassword` callback wired to nodemailer (same SMTP from backup alerts)
- `/reset-password?token=...` — new page with new password + confirm + strength meter
- Token validated by Better Auth

---

## API — New oRPC Procedures

All on `settings` router:

| Procedure | Permission | Description |
|-----------|-----------|-------------|
| `updateUserDetails` | `settings.write` | Update name + email for any org user |
| `adminResetPassword` | `settings.write` | Force-set any user's password (no current password required) |
| `adminSetPin` | `settings.write` | Set or clear PIN for any org user |
| `revokeUserSessions` | `settings.write` | Kill all sessions for a specific user |
| `deleteUser` | `settings.write` | Hard-delete user (blocks self-deletion) |
| `inviteUser` | `settings.write` | Send invite email with set-password link (requires SMTP) |
| `changeOwnPassword` | authenticated | Change own password — verifies current password first |
| `changeOwnPin` | authenticated | Set or clear own PIN — own account only |
| `getOwnSessions` | authenticated | List own active sessions |
| `revokeOtherSessions` | authenticated | Sign out all sessions except current |

---

## Forgot Password — Better Auth Wiring

In `packages/auth/src/index.ts`, add `sendResetPassword` to the `emailAndPassword` config:

```ts
emailAndPassword: {
  enabled: true,
  minPasswordLength: 8,
  sendResetPassword: async ({ user, url }) => {
    await sendPasswordResetEmail(user.email, url);
  },
},
```

New `sendPasswordResetEmail` in `apps/server/src/email.ts` (alongside `sendBackupFailureAlert`).

---

## Enhancements

1. **Password strength meter** — client-side visual indicator (Weak/Fair/Strong) on all password fields. Simple entropy/regex scoring: length ≥ 12 + mixed case + numbers + symbols = Strong. No library needed.
2. **Copy-to-clipboard** on admin reset-password dialog — one click copies the temp password so admin can paste it into WhatsApp/SMS.
3. **"Revoke all sessions"** in admin user dropdown — immediate sign-out of all devices for a specific user. Good for offboarding or lost-phone scenarios.
4. **"Sign out all other devices"** on `/dashboard/profile` — staff can revoke their own sessions on other devices.
5. **Invite by email** — cleaner onboarding: staff set their own password instead of receiving one from admin. Graceful fallback to password field if SMTP not configured.

---

## Security Rules

- `changeOwnPassword` / `changeOwnPin` / `getOwnSessions` / `revokeOtherSessions` — always verify `session.user.id === context.session.user.id`. Cannot be used for other users.
- `deleteUser` — blocks `userId === session.user.id` (cannot delete self).
- `adminResetPassword` — no current password required (admin privilege), but requires `settings.write` permission.
- `inviteUser` — invite token expires in 48 hours (Better Auth default).
- Temp passwords generated by admin have no forced expiry — admin is responsible for communicating it securely.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/auth/src/index.ts` | Add `sendResetPassword` callback |
| `apps/server/src/email.ts` | Add `sendPasswordResetEmail` |
| `packages/api/src/routers/settings.ts` | Add 10 new procedures |
| `apps/web/src/routes/dashboard.settings.tsx` | Expand `UsersTab` with admin features |
| `apps/web/src/routes/dashboard.profile.tsx` | NEW — staff self-service page |
| `apps/web/src/routes/login.tsx` | Add "Forgot password?" link + inline email form |
| `apps/web/src/routes/reset-password.tsx` | NEW — password reset landing page |
| `apps/web/src/components/layout/app-sidebar.tsx` | Profile link in footer dropdown |
| `apps/web/src/routes/dashboard.tsx` | Add `/dashboard/profile` to PAGE_TITLES + ROUTE_MODULE_MAP |
| `apps/web/src/lib/route-access.ts` | Add `/dashboard/profile` (accessible to all authenticated) |
| `docs/USER-MANUAL.md` | User management section |
