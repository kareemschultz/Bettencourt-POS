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
