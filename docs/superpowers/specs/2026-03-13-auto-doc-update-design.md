# Auto Documentation Update — Design Spec

**Date:** 2026-03-13
**Project:** Bettencourt POS
**Status:** Draft — Pending User Review

---

## Problem

After every feature addition or code change, `docs/USER-MANUAL.md` (1717 lines, Shakira's client manual) and `apps/fumadocs/content/docs/*.mdx` (20 pages, in-app help) must be kept in sync with the actual system state. This has historically been done manually, which is error-prone and easy to forget.

## Goal

Docs update **automatically** whenever Claude commits code, with zero user action required. A manual catch-up command covers the edge case where commits are made outside of Claude.

---

## Mechanism — How the Hook Injects Into Claude's Context

Claude Code PostToolUse hooks run a shell command after a tool call completes. The hook receives the tool event as **JSON on stdin** (not via environment variables). The hook's **stdout** is captured by Claude Code and returned to Claude as part of the tool result — Claude reads it in its active context window and can act on it in the same or next step of the same conversation turn. This is the intended "prompt injection" pattern for PostToolUse hooks.

The hook fires **immediately** after the `git commit` Bash call returns. Because Claude has not yet composed its final reply at that point (the commit is typically a mid-turn step, not the last), Claude will read the injected message, run the doc updates as additional steps, and then give its final response.

**Loop guard:** The doc-update commit itself (which only touches `docs/USER-MANUAL.md` and `apps/fumadocs/content/docs/*.mdx`) satisfies the skip pattern `docs/**` / `apps/fumadocs/**`, so Claude exits the doc-update path immediately — no infinite loop.

---

## Components

### 1. PostToolUse Hook — `.claude/settings.json`

**Location:** `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/settings.json`

**Trigger:** Fires after every `Bash` tool call. The hook shell script reads JSON from stdin using `jq`, checks `tool_name == "Bash"` and that `.tool_input.command` contains the string `git commit` (substring match: `[[ "$COMMAND" == *"git commit"* ]]`). For all other Bash calls, it exits immediately (< 10ms overhead). The match is intentionally a substring match — it catches `HUSKY=0 git commit -F /tmp/...` but not multi-word strings like `# git commit` in comments.

**Hook script logic:**

```bash
#!/bin/sh
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL" != "Bash" ] && exit 0
CMD=$(echo "$INPUT" | jq -r '.tool_input.command')
case "$CMD" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac
# print injected message (below) to stdout
```

**Injected message structure:**

```
📚 DOCS UPDATE REQUIRED

You just committed code. Before finalising your response:
1. Run: git show --stat HEAD
2. Run: git diff HEAD~1..HEAD -- '*.tsx' '*.ts'
3. Identify which sections need updating using the routing table below
4. Update docs/USER-MANUAL.md (surgical edit — only changed sections)
5. Update the relevant apps/fumadocs/content/docs/*.mdx file(s)
6. Stage and commit both:
   git add docs/USER-MANUAL.md apps/fumadocs/content/docs/
   printf 'docs: sync manual with recent changes\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
   HUSKY=0 git commit -F /tmp/docmsg.txt

SKIP if ALL changed files match one or more skip patterns:
  - docs/** or apps/fumadocs/** (docs-only commit — loop guard for the doc commit itself)
  - drizzle/migrations/** or apps/server/src/db/seed* (migration/seed only)
  - packages/env/** or *.config.* or .env* (config only)

ROUTING TABLE — match on any substring of changed file path → USER-MANUAL section + fumadocs page:

  dashboard.expenses / lib/pdf/expense / lib/pdf/daily-expense
      → §22 Expenses → expenses.mdx

  dashboard.pos / components/pos / pos-terminal
      → §3 New Sale → pos-terminal.mdx

  dashboard.orders
      → §4 Orders → orders.mdx

  dashboard.kitchen / components/kds
      → §5 KDS → kitchen.mdx

  dashboard.production / dashboard.waste / dashboard.production-report
      → §6 Production → production.mdx

  dashboard.cash / lib/pdf/cash-session / routers/cash
      → §7 Cash Control → cash.mdx

  dashboard.inventory / dashboard.stock-alerts / dashboard.labels
      → §8–13 Inventory → inventory.mdx

  dashboard.suppliers / lib/pdf/vendor-statement
      → §12 Suppliers → suppliers.mdx

  dashboard.reports / dashboard.analytics / dashboard.eod /
  dashboard.pnl / dashboard.profitability / dashboard.variance
      → §14–21 Reports → reports.mdx

  dashboard.customers / dashboard.loyalty / dashboard.customer-statements /
  lib/pdf/customer-statement
      → §24–27 Customers → customers.mdx

  dashboard.giftcards / dashboard.discounts
      → §24–27 Commerce → commerce.mdx

  dashboard.finance / dashboard.invoices / dashboard.quotations /
  dashboard.credit-notes / dashboard.vendor-bills / dashboard.budgets /
  dashboard.tax-summary / dashboard.recurring / dashboard.aging /
  dashboard.journal / dashboard.reconciliation /
  lib/pdf/invoice / lib/pdf/credit-note / lib/pdf/quotation / lib/pdf/vendor-bill
      → §41 Finance → finance.mdx

  dashboard.timeclock / dashboard.labor
      → §30 Time Clock → staff.mdx

  dashboard.notifications
      → §36 Notifications → notifications.mdx

  dashboard.webhooks
      → §37 Webhooks → webhooks.mdx

  dashboard.settings / dashboard.locations / dashboard.audit /
  dashboard.menu-schedules / dashboard.tables / dashboard.currency /
  dashboard.products / dashboard.profile / dashboard.backup /
  backup-engine
      → §31–40 Settings → settings.mdx

If no routing table entry matches any changed file:
  - Update only the "Last Updated" date in USER-MANUAL.md
  - Append a one-line note to docs/PROGRESS.md: "⚠️ [date] Undocumented change — routing miss on: [files]"
  - Stage and commit: git add docs/ && HUSKY=0 git commit -F /tmp/docmsg.txt
```

---

### 2. Slash Command — `.claude/commands/update-manual.md`

**Location:** `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/commands/update-manual.md`

**Invoked as:** `/update-manual`

**Use case:** Catch-up runs after manual `git commit` calls made outside Claude, or periodic full-sync checks.

**Execution steps:**

1. Find all commits made since `USER-MANUAL.md` was last modified. `--diff-filter=AM` catches both the initial Add and subsequent Modifications of the file. The result is a timestamp anchor — commits _after_ this timestamp are the undocumented ones:
   ```bash
   LAST_DOC_COMMIT=$(git log --all --diff-filter=AM -- docs/USER-MANUAL.md --format=%ci | head -1)
   ```
   Edge case: if `USER-MANUAL.md` has never been committed, `LAST_DOC_COMMIT` is empty and `--since=""` returns all commits — a full-history run. This is acceptable for a fresh repo.
2. List commits since that timestamp:
   ```bash
   git log --oneline --since="$LAST_DOC_COMMIT"
   ```
   If empty, print "USER-MANUAL.md is already up to date" and exit.
3. Run `git diff <oldest-undocumented-commit>^..HEAD -- '*.tsx' '*.ts'` to see all code changes in scope
4. Apply the same skip logic as the hook (docs-only / migration-only → skip)
5. Read full `docs/USER-MANUAL.md`
6. Read all affected `apps/fumadocs/content/docs/*.mdx` files identified by the routing table
7. Perform surgical rewrites — update only sections that need it, preserve all others verbatim
8. Stage and commit doc changes:
   ```bash
   git add docs/USER-MANUAL.md apps/fumadocs/content/docs/
   printf 'docs: sync USER-MANUAL and fumadocs with recent changes\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
   HUSKY=0 git commit -F /tmp/docmsg.txt
   ```
9. If routing table produces no matches for any changed file, append warning to `docs/PROGRESS.md` as above before committing

---

## Implementation Files

```
Bettencourt-POS/
├── .claude/
│   ├── settings.json          ← NEW: PostToolUse hook definition (requires jq on PATH)
│   └── commands/
│       └── update-manual.md   ← NEW: /update-manual slash command
```

**Prerequisite:** `jq` must be installed on the host for the hook script to parse stdin JSON. On Ubuntu: `sudo apt-get install -y jq`.

No changes to existing source code, routes, components, API, or `CLAUDE.md`.

---

## Skip Patterns (both hook and command)

A commit is skipped (no doc update triggered) if **all** changed files match at least one of:

| Pattern | Reason |
|---|---|
| `docs/**`, `apps/fumadocs/**` | Docs-only — no user-visible feature change; also loop guard for the doc-update commit itself |
| `drizzle/migrations/**` | DB migration — no UI change |
| `apps/server/src/db/seed*` | Seed data — no UI change |
| `packages/env/**`, `*.config.*`, `.env*` | Config — no UI change |

If even **one** file outside these patterns changed, the doc update runs.

---

## Commit Convention (project-specific)

This project requires HUSKY=0 prefix and `-F /tmp/file.txt` pattern for all commits (pre-commit hook uses `bat` which is not available in all environments). Both the hook message and slash command must use:

```bash
git add <files>
printf 'docs: ...\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
HUSKY=0 git commit -F /tmp/docmsg.txt
```

---

## Success Criteria

1. After Claude commits code that changes a route page, `USER-MANUAL.md` and the corresponding `.mdx` file are updated and committed in the same Claude turn, with no user action
2. Running `/update-manual` after manual commits produces correct targeted doc updates covering all commits since the last doc update
3. Commits that are migrations, seeds, config, or docs-only do not trigger spurious doc rewrites
4. Hook shell script execution time for non-commit Bash calls is under 10ms
5. When the routing table produces no matches, a warning is appended to `docs/PROGRESS.md` — no silent failures
6. The doc-update commit does not re-trigger the hook (loop guard confirmed via skip pattern match on `docs/**` + `apps/fumadocs/**`)
