# Final Audit Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close all three remaining Codex audit gaps: (1) encrypt secrets at rest with AES-256-GCM, (2) invert route access to default-deny, (3) add an automated test suite covering critical business paths.

**Architecture:** Fix-in-place. New `packages/api/src/lib/crypto.ts` utility handles all symmetric encryption. All three encrypted fields (webhook `secret`, notification `accountSid`, notification `authToken`) are encrypted on write and decrypted only where the plaintext is operationally needed (HMAC signing, API calls). Test files live alongside source in `__tests__/` subdirectories and run with Bun's built-in test runner (`bun test`). No additional npm packages are needed.

**Tech Stack:** Bun (runtime + test runner), node:crypto (AES-256-GCM), Drizzle ORM, Hono, React Router, oRPC, TypeScript

**Worktree:** Work in `.worktrees/plan10-final-audit` on branch `plan10/final-audit-closure`.

---

## Wave 1 — Secret Encryption at Rest (B03)

### Task 1.1: Add ENCRYPTION_KEY to env schema and local files

**Context:** The env package (`packages/env/src/server.ts`) validates all required server env vars at startup. We need to add a 64-char hex key (= 32 bytes) that will be used for AES-256-GCM encryption. If this var is missing, the server should refuse to start.

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `apps/server/.env`
- Modify: `docker-compose.prod.env.example`

**Step 1: Add ENCRYPTION_KEY to env schema**

In `packages/env/src/server.ts`, add inside the `server: { ... }` block:

```ts
ENCRYPTION_KEY: z
  .string()
  .regex(/^[0-9a-f]{64}$/, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
```

**Step 2: Generate a dev key and add to `apps/server/.env`**

Run in terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output (64 hex chars) and append to `apps/server/.env`:
```
ENCRYPTION_KEY=<paste-64-hex-chars-here>
```

**Step 3: Document it in `docker-compose.prod.env.example`**

Add after the BETTER_AUTH_SECRET block:
```
# 32-byte AES key for encrypting secrets at rest — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=replace-with-64-hex-chars
```

**Step 4: Verify env still loads**

```bash
bun run check-types
```
Expected: 4 tasks successful.

**Step 5: Commit**

```bash
git add packages/env/src/server.ts apps/server/.env docker-compose.prod.env.example
git commit -m "feat: add ENCRYPTION_KEY env var for secrets at rest"
```

---

### Task 1.2: Create the crypto utility

**Context:** All three encrypted fields use the same AES-256-GCM scheme. The utility must be backward-compatible: if a stored value does NOT start with `"enc:v1:"`, it is treated as plaintext (migration-safe for existing rows). The encrypted format is `"enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"`.

**Files:**
- Create: `packages/api/src/lib/crypto.ts`

**Implementation:**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be set to a 64-char hex string");
  }
  return Buffer.from(raw, "hex");
}

/**
 * Encrypts a plaintext string. Returns a prefixed encoded string.
 * Format: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts a value produced by `encrypt()`.
 * If the value does NOT start with the prefix (i.e., it's legacy plaintext),
 * returns the value as-is (backward-compatible migration).
 */
export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext — pass through
  const rest = value.slice(PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");
  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}

/** Returns true if the value was encrypted by this utility. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
```

**Step: Verify TypeScript passes**

```bash
bun run check-types
```
Expected: 4 tasks successful, 0 errors.

**Step: Commit**

```bash
git add packages/api/src/lib/crypto.ts
git commit -m "feat: add AES-256-GCM encrypt/decrypt utility"
```

---

### Task 1.3: Write crypto unit tests

**Context:** The tests must work without a DB or running server. They only need the ENCRYPTION_KEY env var set. We use `bun test` (built-in, no install required).

**Files:**
- Create: `packages/api/src/__tests__/crypto.test.ts`

**Implementation:**

```ts
import { describe, expect, test } from "bun:test";

// Set a valid test key before importing the module
process.env.ENCRYPTION_KEY = "a".repeat(64); // 64 hex chars

import { decrypt, encrypt, isEncrypted } from "../lib/crypto";

describe("crypto utility", () => {
  test("encrypt produces a prefixed string", () => {
    const result = encrypt("hello");
    expect(result.startsWith("enc:v1:")).toBe(true);
  });

  test("encrypt + decrypt round-trips correctly", () => {
    const original = "sk_test_abc123XYZ";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  test("encrypt produces different ciphertext each call (random IV)", () => {
    const a = encrypt("same-value");
    const b = encrypt("same-value");
    expect(a).not.toBe(b);
  });

  test("decrypt passes through legacy plaintext (backward compat)", () => {
    expect(decrypt("AC1234567890abcdef")).toBe("AC1234567890abcdef");
  });

  test("isEncrypted returns true for encrypted values", () => {
    expect(isEncrypted(encrypt("x"))).toBe(true);
  });

  test("isEncrypted returns false for plaintext", () => {
    expect(isEncrypted("plain-secret")).toBe(false);
  });

  test("decrypt throws on tampered ciphertext", () => {
    const enc = encrypt("secret");
    const tampered = enc.slice(0, -4) + "0000";
    expect(() => decrypt(tampered)).toThrow();
  });
});
```

**Step: Add test script to `packages/api/package.json`**

In the `"scripts"` block, add:
```json
"test": "bun test src/__tests__"
```

**Step: Run tests**

```bash
cd packages/api && bun test src/__tests__/crypto.test.ts
```
Expected: 7 tests pass, 0 fail.

**Step: Commit**

```bash
git add packages/api/src/__tests__/crypto.test.ts packages/api/package.json
git commit -m "test: crypto utility — encrypt/decrypt round-trip and backward compat"
```

---

### Task 1.4: Encrypt webhook secrets at write, decrypt at sign-time

**Context:** `packages/api/src/routers/webhooks.ts` handles create/update. The HMAC signing in `packages/api/src/lib/webhooks.ts:79-83` uses `endpoint.secret` directly from the DB row — it must decrypt before signing.

**Files:**
- Modify: `packages/api/src/routers/webhooks.ts:49-62` (createEndpoint handler)
- Modify: `packages/api/src/routers/webhooks.ts:95-106` (updateEndpoint handler)
- Modify: `packages/api/src/lib/webhooks.ts:79-83` (deliverToEndpoint sign step)

**Step 1: Import crypto in webhooks router**

At the top of `packages/api/src/routers/webhooks.ts`, add:
```ts
import { encrypt } from "../lib/crypto";
```

**Step 2: Encrypt secret in createEndpoint**

In the `createEndpoint` handler, change the insert values from:
```ts
secret: input.secret ?? null,
```
to:
```ts
secret: input.secret ? encrypt(input.secret) : null,
```

**Step 3: Encrypt secret in updateEndpoint**

In the `updateEndpoint` handler, change (line ~105):
```ts
updates.secret = input.secret;
```
to:
```ts
updates.secret = encrypt(input.secret);
```

**Step 4: Decrypt in deliverToEndpoint**

In `packages/api/src/lib/webhooks.ts`, add import at top:
```ts
import { decrypt } from "./crypto";
```

Change the HMAC signing block (line ~79-83) from:
```ts
if (endpoint.secret) {
  const signature = createHmac("sha256", endpoint.secret)
    .update(body)
    .digest("hex");
  headers["X-Webhook-Signature"] = signature;
}
```
to:
```ts
if (endpoint.secret) {
  const plainSecret = decrypt(endpoint.secret);
  const signature = createHmac("sha256", plainSecret)
    .update(body)
    .digest("hex");
  headers["X-Webhook-Signature"] = signature;
}
```

**Step 5: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 6: Commit**

```bash
git add packages/api/src/routers/webhooks.ts packages/api/src/lib/webhooks.ts
git commit -m "feat: encrypt webhook secrets at rest (AES-256-GCM)"
```

---

### Task 1.5: Encrypt notification credentials at write, decrypt at read/use

**Context:** `packages/api/src/routers/notifications.ts` has three places to update:
1. `updateSettings` handler — encrypts before storing (both insert and update branches)
2. `getSettings` handler — must **decrypt before masking** `accountSidMasked` (otherwise it masks the encrypted string, not the real SID)
3. `sendTest` handler — must decrypt before using credentials with Twilio

**Files:**
- Modify: `packages/api/src/routers/notifications.ts`

**Step 1: Import encrypt/decrypt**

At top of `packages/api/src/routers/notifications.ts`, add:
```ts
import { decrypt, encrypt } from "../lib/crypto";
```

**Step 2: Encrypt in updateSettings**

In the `credentialUpdates` block (currently lines ~112-119), wrap values with `encrypt()`:

```ts
const credentialUpdates = {
  ...(input.accountSid && !input.accountSid.includes("*")
    ? { accountSid: encrypt(input.accountSid) }
    : {}),
  ...(input.authToken && !input.authToken.includes("*")
    ? { authToken: encrypt(input.authToken) }
    : {}),
};
```

**Step 3: Decrypt before masking in getSettings**

In the `getSettings` handler return block, change the `accountSidMasked` line:

```ts
// Before (current):
accountSidMasked: s.accountSid
  ? `${s.accountSid.slice(0, 4)}${"*".repeat(Math.max(0, s.accountSid.length - 8))}${s.accountSid.slice(-4)}`
  : null,

// After:
accountSidMasked: s.accountSid
  ? (() => {
      const plain = decrypt(s.accountSid);
      return `${plain.slice(0, 4)}${"*".repeat(Math.max(0, plain.length - 8))}${plain.slice(-4)}`;
    })()
  : null,
```

**Step 4: Decrypt in sendTest before credential checks**

In the `sendTest` handler, after fetching settings and confirming `accountSid`/`authToken` are present, add decryption before the Twilio call would be made. Currently the handler throws `NOT_IMPLEMENTED` — add the decrypt call before that throw so it's ready for when Twilio is connected:

```ts
// Decrypt credentials for Twilio API use (ready for when Twilio is connected)
const accountSid = decrypt(settings[0]!.accountSid!);
const authToken = decrypt(settings[0]!.authToken!);
void accountSid; void authToken; // suppress unused until Twilio is wired
```

Place this after the credentials null-check (line ~354) and before the log insert.

**Step 5: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 6: Commit**

```bash
git add packages/api/src/routers/notifications.ts
git commit -m "feat: encrypt notification credentials at rest (AES-256-GCM)"
```

---

## Wave 2 — Route Default-Deny (B09)

### Task 2.1: Extract hasRouteAccess into a standalone utility

**Context:** Currently `hasRouteAccess` and `ROUTE_MODULE_MAP` live inside `apps/web/src/routes/dashboard.tsx`. To make them testable with `bun test` (which runs outside React), they need to be in a plain `.ts` module. We extract both into `apps/web/src/lib/route-access.ts` and import back in `dashboard.tsx`.

**Files:**
- Create: `apps/web/src/lib/route-access.ts`
- Modify: `apps/web/src/routes/dashboard.tsx` (remove the two definitions, add import)

**Step 1: Create `apps/web/src/lib/route-access.ts`**

```ts
export const ROUTE_MODULE_MAP: Record<string, string> = {
  "/dashboard/reports": "reports",
  "/dashboard/reconciliation": "reports",
  "/dashboard/eod": "reports",
  "/dashboard/analytics": "reports",
  "/dashboard/journal": "reports",
  "/dashboard/labor": "reports",
  "/dashboard/profitability": "reports",
  "/dashboard/pnl": "reports",
  "/dashboard/production-report": "reports",
  "/dashboard/inventory": "inventory",
  "/dashboard/stock-alerts": "inventory",
  "/dashboard/waste": "inventory",
  "/dashboard/variance": "inventory",
  "/dashboard/suppliers": "inventory",
  "/dashboard/settings": "settings",
  "/dashboard/locations": "settings",
  "/dashboard/webhooks": "settings",
  "/dashboard/notifications": "settings",
  "/dashboard/menu-schedules": "settings",
  "/dashboard/discounts": "settings",
  "/dashboard/currency": "settings",
  "/dashboard/expenses": "settings",
  "/dashboard/audit": "audit",
  "/dashboard/invoices": "invoices",
  "/dashboard/quotations": "quotations",
  "/dashboard/labels": "products",
  "/dashboard/tables": "orders",
  "/dashboard/loyalty": "orders",
  "/dashboard/customers": "orders",
  "/dashboard/giftcards": "orders",
  "/dashboard/products": "products",
  "/dashboard/production": "orders",
  "/dashboard/pos": "orders",
  "/dashboard/orders": "orders",
  "/dashboard/cash": "shifts",
  "/dashboard/kitchen": "orders",
  "/dashboard/timeclock": "shifts",
};

/**
 * Returns true if the current user has access to `pathname`.
 *
 * Rules:
 * 1. The dashboard home `/dashboard` is always accessible (no module required).
 * 2. Any route in ROUTE_MODULE_MAP requires the user to have at least one
 *    permission in that module.
 * 3. Any other route not in the map is DENIED by default (explicit-deny).
 */
export function hasRouteAccess(
  pathname: string,
  permissions: Record<string, string[]>,
): boolean {
  for (const [prefix, module] of Object.entries(ROUTE_MODULE_MAP)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const perms = permissions[module];
      return Array.isArray(perms) && perms.length > 0;
    }
  }
  // Allow the exact dashboard home; deny everything else that isn't mapped
  return pathname === "/dashboard";
}
```

**Step 2: Update `apps/web/src/routes/dashboard.tsx`**

Remove the `ROUTE_MODULE_MAP` constant (lines 118-156) and the `hasRouteAccess` function (lines 158-169) from `dashboard.tsx`.

Add import near the top (after the existing imports):
```ts
import { hasRouteAccess } from "@/lib/route-access";
```

The existing usage `hasRouteAccess(pathname, user.permissions)` on line 377 remains unchanged.

**Step 3: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add apps/web/src/lib/route-access.ts apps/web/src/routes/dashboard.tsx
git commit -m "refactor: extract hasRouteAccess to standalone module with default-deny"
```

---

### Task 2.2: Write route access unit tests

**Files:**
- Create: `apps/web/src/__tests__/route-access.test.ts`

**Add test script to `apps/web/package.json`**

In `"scripts"`:
```json
"test": "bun test src/__tests__"
```

**Implementation:**

```ts
import { describe, expect, test } from "bun:test";
import { hasRouteAccess } from "../lib/route-access";

const fullPerms = {
  orders: ["create", "read", "void"],
  reports: ["read"],
  settings: ["create", "read", "update", "delete"],
  inventory: ["read"],
  products: ["read"],
  shifts: ["read"],
  audit: ["read"],
  invoices: ["read"],
  quotations: ["read"],
  customers: ["create", "read", "update", "delete"],
};

const noPerms: Record<string, string[]> = {};

describe("hasRouteAccess", () => {
  test("allows /dashboard home for any authenticated user (no module)", () => {
    expect(hasRouteAccess("/dashboard", noPerms)).toBe(true);
    expect(hasRouteAccess("/dashboard", fullPerms)).toBe(true);
  });

  test("allows mapped route when user has the module permission", () => {
    expect(hasRouteAccess("/dashboard/orders", fullPerms)).toBe(true);
    expect(hasRouteAccess("/dashboard/reports", fullPerms)).toBe(true);
    expect(hasRouteAccess("/dashboard/settings", fullPerms)).toBe(true);
  });

  test("denies mapped route when user lacks the module permission", () => {
    expect(hasRouteAccess("/dashboard/orders", noPerms)).toBe(false);
    expect(hasRouteAccess("/dashboard/audit", noPerms)).toBe(false);
  });

  test("denies unmapped routes (default-deny — B09 fix)", () => {
    expect(hasRouteAccess("/dashboard/unknown-page", fullPerms)).toBe(false);
    expect(hasRouteAccess("/dashboard/admin-secret", noPerms)).toBe(false);
    expect(hasRouteAccess("/dashboard/unknown-page", noPerms)).toBe(false);
  });

  test("allows route matching by prefix (sub-paths)", () => {
    expect(hasRouteAccess("/dashboard/orders/123", fullPerms)).toBe(true);
    expect(hasRouteAccess("/dashboard/inventory/details", fullPerms)).toBe(true);
  });

  test("cashier with only orders+shifts can access pos and cash", () => {
    const cashierPerms = { orders: ["create", "read"], shifts: ["read"] };
    expect(hasRouteAccess("/dashboard/pos", cashierPerms)).toBe(true);
    expect(hasRouteAccess("/dashboard/cash", cashierPerms)).toBe(true);
    expect(hasRouteAccess("/dashboard/reports", cashierPerms)).toBe(false);
    expect(hasRouteAccess("/dashboard/settings", cashierPerms)).toBe(false);
  });

  test("empty permissions array for module denies access", () => {
    const permsWithEmptyOrders = { orders: [] };
    expect(hasRouteAccess("/dashboard/orders", permsWithEmptyOrders)).toBe(false);
  });
});
```

**Step: Run tests**

```bash
cd apps/web && bun test src/__tests__/route-access.test.ts
```
Expected: 7 test groups, all passing.

**Step: Commit**

```bash
git add apps/web/src/__tests__/route-access.test.ts apps/web/package.json
git commit -m "test: route access — default-deny, permission checks, cashier scope"
```

---

## Wave 3 — Automated Test Suite

### Task 3.1: Wire test pipeline into Turbo

**Context:** Add `"test"` as a recognized Turbo task so `bun run test` at the root runs all package tests.

**Files:**
- Modify: `package.json` (root)
- Modify: `turbo.json`

**Step 1: Add root test script to `package.json`**

In `"scripts"`, add:
```json
"test": "turbo test"
```

**Step 2: Add `test` task to `turbo.json`**

Inside the `"tasks"` object, add:
```json
"test": {
  "dependsOn": ["^build"],
  "cache": false
}
```

**Step 3: Verify**

```bash
bun run test
```
Expected: Both `packages/api` and `apps/web` test tasks execute.

**Step 4: Commit**

```bash
git add package.json turbo.json
git commit -m "chore: add bun test pipeline to turbo"
```

---

### Task 3.2: Test permission utility

**Context:** `packages/api/src/lib/permissions.ts` exports `hasPermission(permissions, "resource.action")`. This is a pure function — no DB needed.

**Files:**
- Create: `packages/api/src/__tests__/permissions.test.ts`

**Implementation:**

```ts
import { describe, expect, test } from "bun:test";
import { hasPermission } from "../lib/permissions";

describe("hasPermission", () => {
  const perms = {
    orders: ["create", "read", "void"],
    products: ["read"],
    settings: [],
  };

  test("returns true when action is present", () => {
    expect(hasPermission(perms, "orders.create")).toBe(true);
    expect(hasPermission(perms, "orders.void")).toBe(true);
    expect(hasPermission(perms, "products.read")).toBe(true);
  });

  test("returns false when action is absent", () => {
    expect(hasPermission(perms, "orders.delete")).toBe(false);
    expect(hasPermission(perms, "products.create")).toBe(false);
  });

  test("returns false when module has empty action array", () => {
    expect(hasPermission(perms, "settings.read")).toBe(false);
  });

  test("returns false for missing module", () => {
    expect(hasPermission(perms, "reports.read")).toBe(false);
  });

  test("returns false for malformed permission string", () => {
    expect(hasPermission(perms, "orders")).toBe(false);
    expect(hasPermission(perms, "")).toBe(false);
  });
});
```

**Step: Run**

```bash
cd packages/api && bun test src/__tests__/permissions.test.ts
```
Expected: 5 test groups, all passing.

**Step: Commit**

```bash
git add packages/api/src/__tests__/permissions.test.ts
git commit -m "test: hasPermission — action matching, missing modules, edge cases"
```

---

### Task 3.3: Test escapeHtml (print/export XSS safety)

**Context:** `apps/web/src/lib/utils.ts` exports `escapeHtml`. This proves B06 fix is correct.

**Files:**
- Create: `apps/web/src/__tests__/utils.test.ts`

**Implementation:**

```ts
import { describe, expect, test } from "bun:test";
import { escapeHtml } from "../lib/utils";

describe("escapeHtml", () => {
  test("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("</div>")).toBe("&lt;/div&gt;");
  });

  test("escapes ampersand", () => {
    expect(escapeHtml("Fish & Chips")).toBe("Fish &amp; Chips");
  });

  test("escapes double quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  test("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  test("handles a full XSS payload", () => {
    const xss = `<img src=x onerror="alert('xss')">`;
    const escaped = escapeHtml(xss);
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(escaped).not.toContain('"');
  });

  test("returns empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml("")).toBe("");
  });

  test("does not double-escape", () => {
    // Already-escaped strings should not be re-escaped
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
});
```

**Step: Run**

```bash
cd apps/web && bun test src/__tests__/utils.test.ts
```
Expected: 7 tests, all passing.

**Step: Commit**

```bash
git add apps/web/src/__tests__/utils.test.ts
git commit -m "test: escapeHtml — XSS safety for print templates"
```

---

### Task 3.4: Test PIN auth banned-user and rate-limit logic

**Context:** The PIN login in `apps/server/src/index.ts` has two testable pure logic blocks that we can extract into a utility file:
1. `isBanned` check — is the user account currently banned (handles expiry)
2. Rate-limit check — is this IP currently locked out

We extract these two functions into `apps/server/src/lib/pin-auth.ts` so they're testable without starting Hono.

**Files:**
- Create: `apps/server/src/lib/pin-auth.ts`
- Modify: `apps/server/src/index.ts` (import and use extracted functions)
- Create: `apps/server/src/__tests__/pin-auth.test.ts`
- Modify: `apps/server/package.json` (add test script)

**Step 1: Create `apps/server/src/lib/pin-auth.ts`**

```ts
/**
 * Returns true if the user is currently banned (unexpired ban).
 */
export function isBanned(user: {
  banned: boolean | null;
  banExpires: Date | null;
}): boolean {
  if (!user.banned) return false;
  if (user.banExpires === null) return true; // permanent ban
  return user.banExpires > new Date(); // ban not yet expired
}

export type RateLimitEntry = { count: number; lockedUntil: number };
export type RateLimitStore = Map<string, RateLimitEntry>;

/**
 * Returns true if this IP is currently rate-limited (locked out).
 */
export function isRateLimited(store: RateLimitStore, ip: string): boolean {
  const entry = store.get(ip);
  if (!entry) return false;
  return entry.count >= 5 && Date.now() < entry.lockedUntil;
}

/**
 * Records a failed attempt for this IP. Locks out for `lockoutMs` ms after 5 failures.
 */
export function recordFailure(
  store: RateLimitStore,
  ip: string,
  lockoutMs = 60_000,
): void {
  const existing = store.get(ip) || { count: 0, lockedUntil: 0 };
  existing.count += 1;
  if (existing.count >= 5) {
    existing.lockedUntil = Date.now() + lockoutMs;
  }
  store.set(ip, existing);
}

/**
 * Clears the rate-limit record for this IP (call on success).
 */
export function clearFailures(store: RateLimitStore, ip: string): void {
  store.delete(ip);
}
```

**Step 2: Import in `apps/server/src/index.ts`**

Add import near the top:
```ts
import {
  clearFailures,
  isBanned,
  isRateLimited,
  recordFailure,
} from "./lib/pin-auth";
```

Replace the inline logic in the PIN handler:
- `if (attempt && attempt.count >= 5 && Date.now() < attempt.lockedUntil)` → `if (isRateLimited(pinFailures, clientIp))`
- The `trackFailure` function body → call `recordFailure(pinFailures, clientIp)` at each call site
- `pinFailures.delete(clientIp)` → `clearFailures(pinFailures, clientIp)`
- The `isBanned` inline check → call `isBanned(user)`

Exact replacements:

```ts
// BEFORE (rate limit check):
const attempt = pinFailures.get(clientIp);
if (attempt && attempt.count >= 5 && Date.now() < attempt.lockedUntil) {

// AFTER:
if (isRateLimited(pinFailures, clientIp)) {
```

```ts
// BEFORE (trackFailure calls):
const trackFailure = () => {
  const existing = pinFailures.get(clientIp) || { count: 0, lockedUntil: 0 };
  existing.count += 1;
  if (existing.count >= 5) {
    existing.lockedUntil = Date.now() + 60_000;
  }
  pinFailures.set(clientIp, existing);
};
// ... later: trackFailure();

// AFTER: remove trackFailure definition; replace each call with:
recordFailure(pinFailures, clientIp);
```

```ts
// BEFORE (banned check):
const isBanned =
  user.banned === true &&
  (user.banExpires === null || user.banExpires > new Date());
if (isBanned) {

// AFTER:
if (isBanned(user)) {
```

```ts
// BEFORE (clear on success):
pinFailures.delete(clientIp);

// AFTER:
clearFailures(pinFailures, clientIp);
```

**Step 3: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 4: Create test file `apps/server/src/__tests__/pin-auth.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import {
  clearFailures,
  isBanned,
  isRateLimited,
  recordFailure,
  type RateLimitStore,
} from "../lib/pin-auth";

describe("isBanned", () => {
  test("returns false for non-banned user", () => {
    expect(isBanned({ banned: false, banExpires: null })).toBe(false);
    expect(isBanned({ banned: null, banExpires: null })).toBe(false);
  });

  test("returns true for permanently banned user (no expiry)", () => {
    expect(isBanned({ banned: true, banExpires: null })).toBe(true);
  });

  test("returns true for banned user with future expiry", () => {
    const future = new Date(Date.now() + 86_400_000); // 1 day ahead
    expect(isBanned({ banned: true, banExpires: future })).toBe(true);
  });

  test("returns false for banned user with past expiry (ban lifted)", () => {
    const past = new Date(Date.now() - 1000);
    expect(isBanned({ banned: true, banExpires: past })).toBe(false);
  });
});

describe("rate limiting", () => {
  function makeStore(): RateLimitStore {
    return new Map();
  }

  test("not rate-limited on first attempt", () => {
    const store = makeStore();
    expect(isRateLimited(store, "1.2.3.4")).toBe(false);
  });

  test("not rate-limited after 4 failures", () => {
    const store = makeStore();
    for (let i = 0; i < 4; i++) recordFailure(store, "1.2.3.4");
    expect(isRateLimited(store, "1.2.3.4")).toBe(false);
  });

  test("rate-limited after 5 failures", () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) recordFailure(store, "1.2.3.4");
    expect(isRateLimited(store, "1.2.3.4")).toBe(true);
  });

  test("different IPs are tracked independently", () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) recordFailure(store, "1.1.1.1");
    expect(isRateLimited(store, "1.1.1.1")).toBe(true);
    expect(isRateLimited(store, "2.2.2.2")).toBe(false);
  });

  test("clearFailures removes rate limit", () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) recordFailure(store, "1.2.3.4");
    expect(isRateLimited(store, "1.2.3.4")).toBe(true);
    clearFailures(store, "1.2.3.4");
    expect(isRateLimited(store, "1.2.3.4")).toBe(false);
  });
});
```

**Step 5: Add test script to `apps/server/package.json`**

```json
"test": "bun test src/__tests__"
```

**Step 6: Run tests**

```bash
cd apps/server && bun test src/__tests__/pin-auth.test.ts
```
Expected: 9 tests, all passing.

**Step 7: Commit**

```bash
git add apps/server/src/lib/pin-auth.ts apps/server/src/__tests__/pin-auth.test.ts apps/server/src/index.ts apps/server/package.json
git commit -m "test: extract and test PIN auth banned-user and rate-limit logic"
```

---

### Task 3.5: Test checkout invariants

**Context:** The `pos.ts` router computes `total = Math.max(0, subtotal + taxTotal - discountTotal)`. The invariant (no negative totals) is the testable assertion. Extract the calculation into `packages/api/src/lib/checkout.ts`.

**Files:**
- Create: `packages/api/src/lib/checkout.ts`
- Modify: `packages/api/src/routers/pos.ts` (import and call the extracted function)
- Create: `packages/api/src/__tests__/checkout.test.ts`

**Step 1: Create `packages/api/src/lib/checkout.ts`**

```ts
export interface CheckoutTotals {
  subtotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Computes order totals from line items and discount.
 * Guarantees total is never negative.
 */
export function computeOrderTotals(
  items: Array<{
    unitPrice: number;
    quantity: number;
    taxRate: number;
    modifiers: Array<{ price: number }>;
  }>,
  discountTotal: number,
): CheckoutTotals {
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
    const lineSubtotal = (item.unitPrice + modifierTotal) * item.quantity;
    const lineTax = lineSubtotal * item.taxRate;
    subtotal += lineSubtotal;
    taxTotal += lineTax;
  }
  const total = Math.max(0, subtotal + taxTotal - discountTotal);
  return { subtotal, taxTotal, total };
}
```

**Step 2: Use in `packages/api/src/routers/pos.ts`**

Add import:
```ts
import { computeOrderTotals } from "../lib/checkout";
```

Replace the inline totals calculation block:
```ts
// BEFORE:
let subtotal = 0;
let taxTotal = 0;
for (const item of items) {
  const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
  const lineSubtotal = (item.unitPrice + modifierTotal) * item.quantity;
  const lineTax = lineSubtotal * item.taxRate;
  subtotal += lineSubtotal;
  taxTotal += lineTax;
}
const total = Math.max(0, subtotal + taxTotal - discountTotal);

// AFTER:
const { subtotal, taxTotal, total } = computeOrderTotals(items, discountTotal);
```

**Step 3: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 4: Create test file `packages/api/src/__tests__/checkout.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { computeOrderTotals } from "../lib/checkout";

const singleItem = (overrides = {}) => ({
  unitPrice: 10.0,
  quantity: 1,
  taxRate: 0.16,
  modifiers: [],
  ...overrides,
});

describe("computeOrderTotals", () => {
  test("basic single item no tax no discount", () => {
    const result = computeOrderTotals(
      [{ unitPrice: 10, quantity: 1, taxRate: 0, modifiers: [] }],
      0,
    );
    expect(result.subtotal).toBe(10);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(10);
  });

  test("applies tax rate correctly", () => {
    const result = computeOrderTotals([singleItem({ taxRate: 0.16 })], 0);
    expect(result.subtotal).toBeCloseTo(10);
    expect(result.taxTotal).toBeCloseTo(1.6);
    expect(result.total).toBeCloseTo(11.6);
  });

  test("adds modifier price to unit price", () => {
    const result = computeOrderTotals(
      [singleItem({ modifiers: [{ price: 2.0 }] })],
      0,
    );
    // (10 + 2) * 1 = 12 subtotal
    expect(result.subtotal).toBeCloseTo(12);
  });

  test("applies discount correctly", () => {
    const result = computeOrderTotals([singleItem({ taxRate: 0 })], 3);
    expect(result.total).toBe(7);
  });

  test("total is never negative even with excessive discount (B07 invariant)", () => {
    const result = computeOrderTotals([singleItem({ taxRate: 0 })], 999);
    expect(result.total).toBe(0);
  });

  test("multiple items are summed correctly", () => {
    const items = [
      { unitPrice: 5, quantity: 2, taxRate: 0, modifiers: [] },
      { unitPrice: 10, quantity: 1, taxRate: 0, modifiers: [] },
    ];
    const result = computeOrderTotals(items, 0);
    expect(result.subtotal).toBe(20);
    expect(result.total).toBe(20);
  });

  test("quantity multiplier applies", () => {
    const result = computeOrderTotals(
      [{ unitPrice: 5, quantity: 3, taxRate: 0, modifiers: [] }],
      0,
    );
    expect(result.subtotal).toBe(15);
  });
});
```

**Step 5: Run tests**

```bash
cd packages/api && bun test src/__tests__/checkout.test.ts
```
Expected: 7 tests, all passing.

**Step 6: Commit**

```bash
git add packages/api/src/lib/checkout.ts packages/api/src/__tests__/checkout.test.ts packages/api/src/routers/pos.ts
git commit -m "test: checkout invariants — totals, tax, discount, negative-total guard"
```

---

## Wave 4 — Final Verification and Deployment

### Task 4.1: Full test run

```bash
bun run test
```
Expected: All `packages/api` and `apps/web` and `apps/server` test suites pass.

### Task 4.2: TypeScript check

```bash
bun run check-types
```
Expected: 4 tasks successful, 0 errors.

### Task 4.3: Production build

```bash
bun run build
```
Expected: 3 tasks successful.

### Task 4.4: Update PROGRESS.md and docs

Add a Plan #10 entry in `docs/PROGRESS.md` documenting what was resolved.

### Task 4.5: Merge to master and rebuild Docker

```bash
# From repo root, after committing in worktree:
git merge plan10/final-audit-closure --ff-only
git push origin master
docker compose -f docker-compose.prod.yml up -d --build
```

### Task 4.6: Update MEMORY.md

Mark all Codex audit findings as fully resolved.

---

## Post-Implementation Checklist

- [ ] `bun run test` — 0 failures across all packages
- [ ] `bun run check-types` — 0 errors
- [ ] `bun run build` — clean build
- [ ] Webhook create: secret stored as `enc:v1:...` in DB (verify via `db:studio`)
- [ ] Notification settings save: accountSid stored as `enc:v1:...` in DB
- [ ] Navigate to `/dashboard/unknown-page` → 403 Access Denied screen shown (not the page)
- [ ] Navigate to `/dashboard` → dashboard home loads correctly
- [ ] `grep -r "return true" apps/web/src/lib/route-access.ts` → empty (no more default-allow)
- [ ] Docker rebuilt, live at pos.karetechsolutions.com

---

## What this does NOT cover (intentional future scope)

- Twilio API integration for `sendTest` (placeholder remains, credentials now ready)
- Redis-backed rate limiting (current in-memory is single-process only)
- Full E2E integration tests with a real test DB (requires CI DB setup)
- Automated test suite in CI/CD pipeline (GitHub Actions)
