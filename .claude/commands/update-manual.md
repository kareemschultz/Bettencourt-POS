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
