# Auto Doc Update Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically update `docs/USER-MANUAL.md` and `apps/fumadocs/content/docs/*.mdx` after every `git commit` Claude makes, via a PostToolUse hook and a `/update-manual` catch-up command.

**Architecture:** A shell script reads the PostToolUse hook event from stdin (JSON), detects `git commit` in the Bash command, and prints a structured prompt to stdout. Claude Code captures that stdout and injects it into Claude's active context, causing Claude to run the doc update as a next step in the same turn. A separate slash command Markdown file handles manual catch-up runs. Loop safety is provided by skip patterns matching `docs/**` and `apps/fumadocs/**`.

**Tech Stack:** Bash, jq (stdin JSON parsing), Claude Code PostToolUse hooks (`settings.json`), Claude Code slash commands (`.claude/commands/*.md`)

**Spec:** `docs/superpowers/specs/2026-03-13-auto-doc-update-design.md`

---

## Chunk 1: Hook Shell Script + Settings

### Task 1: Create the hook shell script

**Files:**
- Create: `.claude/hooks/post-commit-docs.sh`

- [ ] **Step 1: Verify `jq` is available**

```bash
which jq || sudo apt-get install -y jq
```

Expected: `/usr/bin/jq` (or install succeeds)

- [ ] **Step 2: Create the hooks directory**

```bash
mkdir -p /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/hooks
```

- [ ] **Step 3: Write the hook script**

Create `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/hooks/post-commit-docs.sh`.

**Important:** This script reads JSON from **stdin** (not environment variables). Claude Code pipes the event JSON as `{"tool_name": "Bash", "tool_input": {"command": "..."}, ...}`.

```bash
#!/bin/sh
# PostToolUse hook — fires after every Bash tool call.
# Reads JSON from stdin. If tool was a git commit, injects doc-update instructions.
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL" = "Bash" ] || exit 0
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
case "$CMD" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cat <<'PROMPT'
📚 DOCS UPDATE REQUIRED

You just committed code. Before finalising your response:
1. Run: git show --stat HEAD
2. Run: git show HEAD -- '*.tsx' '*.ts'
3. Identify which sections need updating using the routing table below
4. Update docs/USER-MANUAL.md (surgical edit — only changed sections)
5. Update the relevant apps/fumadocs/content/docs/*.mdx file(s)
6. Stage and commit both:
   git add docs/USER-MANUAL.md apps/fumadocs/content/docs/
   printf 'docs: sync manual with recent changes\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
   HUSKY=0 git commit -F /tmp/docmsg.txt

SKIP if ALL changed files match one or more skip patterns:
  - docs/** or apps/fumadocs/** (docs-only — also loop guard for the doc commit itself)
  - drizzle/migrations/** or apps/server/src/db/seed* (migration/seed only)
  - packages/env/** or *.config.* or .env* (config only)

ROUTING TABLE — match on any substring of changed file path.
A file may match multiple entries — update ALL matched sections.

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
  - Run: git log --oneline -1 to get the commit hash
  - Append to docs/PROGRESS.md: "⚠️ [today's date] Undocumented change — routing miss on: [files]"
  - git add docs/USER-MANUAL.md docs/PROGRESS.md
  - printf 'docs: update Last Updated date\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
  - HUSKY=0 git commit -F /tmp/docmsg.txt
PROMPT
```

Note: `jq -r '.tool_input.command // empty'` returns an empty string (not `null`) when the field is absent, so `case` correctly falls through to `exit 0` for non-Bash tools even if the tool_name check somehow passed.

- [ ] **Step 4: Make the script executable**

```bash
chmod +x /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/hooks/post-commit-docs.sh
```

- [ ] **Step 5: Unit-test — non-commit Bash call (must produce no output)**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"bun run check-types"}}' \
  | /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/hooks/post-commit-docs.sh
echo "Exit: $?"
```

Expected: empty stdout, `Exit: 0`

- [ ] **Step 6: Unit-test — non-Bash tool WITH git commit command (must produce no output)**

This test validates the `TOOL != Bash` guard specifically — the command contains "git commit" but must still be skipped because tool_name is not Bash:

```bash
echo '{"tool_name":"Write","tool_input":{"command":"HUSKY=0 git commit -F /tmp/x"}}' \
  | /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/hooks/post-commit-docs.sh
echo "Exit: $?"
```

Expected: empty stdout, `Exit: 0`

- [ ] **Step 7: Unit-test — git commit Bash call (must print the prompt)**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"HUSKY=0 git commit -F /tmp/docmsg.txt"}}' \
  | /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/hooks/post-commit-docs.sh | head -3
```

Expected output:
```
📚 DOCS UPDATE REQUIRED

You just committed code. Before finalising your response:
```

---

### Task 2: Create `.claude/settings.json`

**Files:**
- Create: `.claude/settings.json` (project-level — NOT `~/.claude/settings.json`)

**Important:** This is a **project-level** settings file at `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/settings.json`. Do NOT touch `~/.claude/settings.json` (the global file). Claude Code merges both; the project file adds the hook without affecting global settings.

The `command` uses an **absolute path** to guarantee the hook fires regardless of Claude Code's working directory at hook invocation time:

- [ ] **Step 1: Write the settings file**

Create `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/hooks/post-commit-docs.sh"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Validate the JSON**

```bash
jq . /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/settings.json
```

Expected: JSON pretty-printed without errors.

- [ ] **Step 3: Commit Chunk 1**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
git add .claude/hooks/post-commit-docs.sh .claude/settings.json
printf 'feat(hooks): add PostToolUse hook for automatic doc updates\n\nInjects DOCS UPDATE REQUIRED prompt after every git commit so Claude\nautomatically syncs USER-MANUAL.md and fumadocs MDX files in the same turn.\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
HUSKY=0 git commit -F /tmp/docmsg.txt
```

---

## Chunk 2: Slash Command

### Task 3: Create `/update-manual` slash command

**Files:**
- Create: `.claude/commands/update-manual.md`

Claude Code slash commands are Markdown files in `.claude/commands/`. When you type `/update-manual` in Claude Code, the file's content becomes the prompt Claude receives. Write it as clear, step-by-step instructions.

- [ ] **Step 1: Create the commands directory**

```bash
mkdir -p /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/commands
```

- [ ] **Step 2: Write the command file**

Create `/home/karetech/projects/bettencourt/Bettencourt-POS/.claude/commands/update-manual.md` with the following content (this is a prompt file, not executable code — plain text and tables are fine):

```
Perform a catch-up documentation sync. Follow every step in order.

STEP 1 — Find undocumented commits

Run this command to get the timestamp of the last time USER-MANUAL.md was updated:
  git log --all --diff-filter=AM -- docs/USER-MANUAL.md --format=%ci | head -1 | tr -d '[:space:]'

Save the result as LAST_DOC_TS.

If LAST_DOC_TS is empty (manual was never committed), run:
  git log --oneline
to get all commits, and use all of them as the set of undocumented commits.

Otherwise, list commits made AFTER that timestamp (use --after, not --since, to exclude the anchor commit itself):
  git log --oneline --after="LAST_DOC_TS"

If the output is empty (no lines at all), print "USER-MANUAL.md is already up to date." and stop.

STEP 2 — Identify changed code files

Find the oldest commit hash from Step 1, then run:
  git diff <oldest-commit>^..HEAD -- '*.tsx' '*.ts'

If the oldest commit is the very first commit in the repo (no parent), omit the ^ and run:
  git diff <oldest-commit>..HEAD -- '*.tsx' '*.ts'

STEP 3 — Apply skip logic

Skip this entire run (print "No doc-relevant changes found." and stop) if ALL changed files match:
  - docs/** or apps/fumadocs/**
  - drizzle/migrations/** or apps/server/src/db/seed*
  - packages/env/** or *.config.* or .env*

STEP 4 — Identify affected sections using the routing table

Match changed file paths against these substrings.
A single file may match multiple entries — update ALL matched sections.

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

STEP 5 — Read and update docs

1. Read docs/USER-MANUAL.md
2. Read each matched .mdx file from apps/fumadocs/content/docs/
3. Perform SURGICAL REWRITES ONLY — update only the sections identified in Step 4, preserve all other content verbatim
4. If no routing table match: update only the "Last Updated" date in USER-MANUAL.md and append to docs/PROGRESS.md the line:
   ⚠️ [today's date] Undocumented change — routing miss on: [list the unmatched files]

STEP 6 — Stage and commit

If routing table matched at least one entry:
  git add docs/USER-MANUAL.md apps/fumadocs/content/docs/
  printf 'docs: sync USER-MANUAL and fumadocs with recent changes\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
  HUSKY=0 git commit -F /tmp/docmsg.txt

If routing miss (no match):
  git add docs/USER-MANUAL.md docs/PROGRESS.md
  printf 'docs: update Last Updated date (routing miss — see PROGRESS.md)\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
  HUSKY=0 git commit -F /tmp/docmsg.txt
```

- [ ] **Step 3: Verify the file was written correctly**

```bash
head -3 /home/karetech/projects/bettencourt/Bettencourt-POS/.claude/commands/update-manual.md
```

Expected: `Perform a catch-up documentation sync. Follow every step in order.`

- [ ] **Step 4: Commit Chunk 2**

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
git add .claude/commands/update-manual.md
printf 'feat(commands): add /update-manual slash command for catch-up doc sync\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n' > /tmp/docmsg.txt
HUSKY=0 git commit -F /tmp/docmsg.txt
```

---

## Verification

- [ ] Smoke-test the hook script manually — done in Task 1 Steps 5–7
- [ ] Confirm `settings.json` is valid JSON — done in Task 2 Step 2
- [ ] Reload Claude Code session so the new `settings.json` is picked up
- [ ] Confirm `/update-manual` appears in Claude Code command palette — type `/update` and verify the command appears
- [ ] End-to-end test: make a trivial change to any route file, commit it, and verify Claude's hook fires and updates the corresponding `.mdx` and USER-MANUAL section in the same turn
