# Comprehensive Code Audit Report

**Date:** 2026-03-28  
**Auditor:** Codex (static + limited runtime verification)  
**Repository:** Bettencourt-POS

## Executive Summary

This audit pass covered backend security-sensitive flows, dashboard shell state propagation, and repository documentation accuracy.

### Key outcomes

1. **Fixed a cash handoff authorization gap** in the API router:
   - Prevented handoff to users outside the organization.
   - Prevented self-handoffs.
   - Restricted handoff acceptance to the assigned recipient only.
   - Enforced `pending` state before acceptance.
2. **Fixed dashboard user context propagation** so active location context is preserved in `AppUser`.
3. **Updated README accuracy** where metadata and structure were stale.

---

## Audit Scope

### In scope
- `packages/api/src/routers/cash.ts` (handoff/security and role-bound business rules)
- `apps/web/src/routes/dashboard.tsx` (shell context and location state)
- `README.md` (operator/developer docs accuracy)

### Verification constraints
- Full dependency install and full type/test runs were **blocked** by registry access returning HTTP 403 in this environment.

---

## Findings and Resolutions

## 1) Cash handoff authorization hardening (High)

### Issue
Cash handoffs could be initiated with any `toUserId` string, and acceptance did not enforce recipient identity or pending status.

### Risk
- Potential misrouting of custody workflow.
- Unauthorized acceptance of handoffs by users not explicitly assigned.
- Audit-trail trust degradation.

### Fixes applied
- Enforced org membership validation of `toUserId` in `initiateHandoff`.
- Rejected self-handoffs.
- Enforced `pending` status in `acceptHandoff`.
- Enforced that only the assigned recipient may accept.

### Files touched
- `packages/api/src/routers/cash.ts`

---

## 2) Dashboard location context propagation (Medium)

### Issue
`AppUser.location_id` was hardcoded to `null`, which could cause location-aware flows to miss active context.

### Fix applied
- Set `location_id` from `selectedLocationId`.
- Added `selectedLocationId` as a memo dependency so updates propagate correctly.

### Files touched
- `apps/web/src/routes/dashboard.tsx`

---

## 3) Documentation freshness and onboarding friction (Medium)

### Issue
README had stale environment/version metadata and an outdated package tree entry.

### Fixes applied
- Updated Bun baseline references to `1.3+`.
- Updated route/schema count wording for current repo state.
- Replaced non-existent `packages/catalog` with `packages/config`.
- Added troubleshooting note for missing workspace binaries (`turbo`, `biome`) before install.

### Files touched
- `README.md`

---

## Remaining Risks / Follow-up Recommendations

1. **Run full verification in CI or a network-enabled dev environment**:
   - `bun install`
   - `bun run check-types`
   - `bun run check`
   - `bun run test`
2. **Add API tests for cash handoffs**:
   - Reject non-org recipient.
   - Reject self-handoff.
   - Reject accept by non-recipient.
   - Reject accept when status is not `pending`.
3. **Continue module-by-module security review** for actor attribution and permission boundaries across remaining routers.

---

## Commands Executed During This Audit

- `sed` and `rg` review commands over server/api/web files.
- `bun install` (failed due 403 registry access in this environment).
- Focused checks from prior pass:
  - `bun test apps/web/src/__tests__/route-access.test.ts apps/web/src/__tests__/escape-html.test.ts` (dependency-missing errors due blocked install).
  - `git diff --check` (passed).

