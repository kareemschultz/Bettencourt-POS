# Auto Documentation Update — Design Spec

**Date:** 2026-03-13
**Project:** Bettencourt POS
**Status:** Approved

---

## Problem

After every feature addition or code change, `docs/USER-MANUAL.md` (1717 lines, Shakira's client manual) and `apps/fumadocs/content/docs/*.mdx` (21 pages, in-app help) must be kept in sync with the actual system state. This has historically been done manually, which is error-prone and easy to forget.

## Goal

Docs update **automatically** whenever Claude commits code, with zero user action required. A manual catch-up command covers the edge case where commits are made outside of Claude.

---

## Components

### 1. PostToolUse Hook — `/.claude/settings.json`

**Location:** `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/settings.json`

**Trigger:** Fires after every `Bash` tool call. Inspects the command; if it contains `git commit`, outputs a structured prompt message to stdout.

**Behaviour:** Claude Code injects stdout from PostToolUse hooks into Claude's active context. Claude reads the message and updates the documentation before finalising its response — entirely within the same turn, no user action required.

**Hook message content:**
- Instruction to update `docs/USER-MANUAL.md` and the relevant `apps/fumadocs/content/docs/*.mdx` files
- Git commands to run to understand what changed (`git log --oneline -3`, `git diff HEAD~1 -- '*.tsx' '*.ts'`)
- A file-to-docs routing table so Claude knows which manual section and MDX page to touch for common file patterns

**File → docs routing table (embedded in hook message):**

| Changed file pattern | Manual section | fumadocs page |
|---|---|---|
| `dashboard.expenses*` | §22 Expenses | `expenses.mdx` |
| `dashboard.pos*` / `pos-terminal*` | §3 New Sale | `pos-terminal.mdx` |
| `dashboard.orders*` | §4 Orders | `orders.mdx` |
| `dashboard.inventory*` | §8–11 Inventory | `inventory.mdx` |
| `dashboard.cash*` | §7 Cash Control | `cash.mdx` |
| `dashboard.customers*` | §24–27 Customers | `customers.mdx` |
| `dashboard.reports*` | §14 Reports | `reports.mdx` |
| `dashboard.settings*` | §31 Settings | `settings.mdx` |
| `dashboard.suppliers*` | §12 Suppliers | `suppliers.mdx` |
| `dashboard.kitchen*` / `kds*` | §5 KDS | `kitchen.mdx` |
| `dashboard.finance*` / `cash.ts` router | §28–30 Finance | `finance.mdx` |
| `dashboard.staff*` / `time-clock*` | §30 Time Clock | `staff.mdx` |
| `dashboard.production*` | §6 Production | `production.mdx` |
| `backup-engine*` | §31 Settings | `settings.mdx` |

**Edge cases:**
- If the commit is docs-only (no `.tsx`/`.ts` changes), skip the doc update
- If the commit is a migration or seed file only, skip — no user-visible change
- If Claude cannot determine which section changed, update only USER-MANUAL.md's "Last Updated" date

---

### 2. Slash Command — `.claude/commands/update-manual.md`

**Location:** `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/commands/update-manual.md`

**Invoked as:** `/update-manual`

**Use case:** Catch-up runs after manual `git commit` calls made outside Claude, or periodic full-sync checks.

**Execution steps:**
1. Run `git log --oneline -20` — identify commits since docs were last touched
2. Run `git diff` on those commits scoped to `*.tsx` and `*.ts` — understand what code changed
3. Read full `docs/USER-MANUAL.md`
4. Read all 21 `apps/fumadocs/content/docs/*.mdx` files
5. Use the routing table to identify affected sections
6. Perform surgical rewrites — only update sections that need it, preserve all others verbatim
7. Commit doc changes: `docs: sync USER-MANUAL and fumadocs with recent changes`
8. If nothing user-visible changed, print a message and exit without writing

---

## Implementation Files

```
Bettencourt-POS/
├── .claude/
│   ├── settings.json          ← NEW: PostToolUse hook definition
│   └── commands/
│       └── update-manual.md   ← NEW: /update-manual slash command
```

---

## What Is NOT Changed

- `CLAUDE.md` — the existing "Documentation Workflow (REQUIRED)" note stays as a human reminder
- Any existing routes, components, or API code
- The fumadocs MDX content itself (only updated by the hook/command at runtime)

---

## Success Criteria

1. After Claude commits code that changes a route page, `USER-MANUAL.md` and the corresponding `.mdx` file are updated and committed in the same Claude turn, with no user action
2. Running `/update-manual` after manual commits produces correct targeted doc updates
3. Commits that are migrations, seeds, or docs-only do not trigger spurious doc rewrites
4. The hook adds no perceptible delay when non-commit bash commands run (grep exits immediately when pattern not found)
