# Bettencourt POS — Claude Code Configuration

## Project Overview
Custom POS system for Bettencourt's Food Inc. and Bettencourt's Home Style.
Deployed at: `pos.karetechsolutions.com` (container: `kt-bettencourt-pos`)

**Stack:** Bun 1.3 · Hono · oRPC · Better-Auth · Drizzle ORM · PostgreSQL · React Router v7 · Vite · Tailwind · shadcn/ui · Turbo monorepo

## Key Paths
- **API routers:** `packages/api/src/routers/`
- **DB schema:** `packages/db/src/schema/`
- **DB migrations:** `packages/db/src/migrations/`
- **Web routes/pages:** `apps/web/src/routes/`
- **PDF builders:** `apps/web/src/lib/pdf/`
- **Shared types:** `packages/api/src/lib/`

## Two Companies (Same App)
- **Bettencourt's Food Inc.** (`brand: "foods_inc"`) — default
- **Bettencourt's Home Style** (`brand: "home_style"`) — separate logo + header

Brand is stored per-quotation/invoice and controls which logo appears on PDFs.

## Database Rules
- All schema changes require a Drizzle migration: `bun run --cwd packages/db db:generate` then `db:migrate`
- Never modify the DB directly. Use Drizzle ORM.
- Database: `bettencourt_pos` on `kt-central-db` (shared PostgreSQL 16)
- Connection string in `docker-compose.prod.yml` env (should be in Vault: `secret/bettencourt-pos/db`)

## PDF System
- Quotation PDF: `apps/web/src/lib/pdf/quotation-pdf.ts`
- Invoice PDF: `apps/web/src/lib/pdf/invoice-pdf.ts`
- Both build HTML blobs opened in a new tab (no server-side PDF library)
- `openQuotationPdf()` / `openInvoicePdf()` must be called synchronously (before any await) to avoid popup blockers

## Key Domain Concepts
- **Government agency orders**: Toggle `customerType` state (`"individual"` | `"agency"`) in forms. Agency mode shows `agencyName` + `contactPersonName` + `contactPersonPosition` + `orderPlacedBy` fields. These map to DB columns (no new migration needed — columns existed). Auto-detected on edit: if `agencyName` is set → agency mode.
- **Product combobox in line items**: `apps/web/src/components/ui/product-combobox.tsx`. Queries `orpc.products.list` with `{ search }`. `onSelect` callback fills description + unitPrice. Free text always allowed. Only `isActive = true` products shown.
- **VAT default**: 14% inclusive. Stored in `invoice_document_settings` table (`default_tax_rate`, `default_tax_mode`). `openCreate()` reads from `docSettings` API — change DB record to change the default for new documents.
- **Tax modes**: `invoice` (flat rate on total), `line` (per-line item), `incl` (price includes tax)
- **Discount types**: `percent` or `fixed` (GYD)
- **Notes vs Terms & Conditions**: Notes = operational/delivery instructions shown at bottom of PDF (e.g. "Delivery in 2 working days"). Terms & Conditions = legal/payment terms block printed below signature line (e.g. "Payment due within 30 days"). Both are optional free text. Quotations have both; invoices have Notes only.
- **Quotation statuses**: draft → sent → accepted/rejected → converted/expired
- **Invoice statuses**: draft → sent → partial → paid / overdue

## Deployment
```bash
# Rebuild and redeploy
cd /home/karetech/projects/bettencourt/Bettencourt-POS
docker compose -f docker-compose.prod.yml up -d --build
```

Container name: `kt-bettencourt-pos` | Port: 3000 | Memory limit: 512M

See `DEPLOYMENT-CHANGES.md` for full infrastructure notes.

## Lessons Learned
- [2026-03-05] Dockerfile: Builder must use `node:22-slim + bun` (NOT `oven/bun`) — React Router's `writeBundle` hook requires `react-dom/server.renderToPipeableStream` which Bun's runtime doesn't export
- [2026-03-05] Bun workspace symlinks break across Docker stages — copy only `dist/` + `public/` + a fresh externals `node_modules/` to the production stage
- [2026-03-30] Agency fields (`agency_name`, `contact_person_name`, `contact_person_position`) were in the DB schema from day one but not wired to forms/PDFs — always check schema for existing columns before adding migrations
- [2026-03-30] VAT default lives in `invoice_document_settings` table, NOT in `emptyForm` JS defaults — `openCreate()` overrides emptyForm with `docSettings` from API. Fix defaults at the DB source, not in code.
- [2026-03-30] Postgres numeric columns (e.g. `default_tax_rate = 14`) may return "14.00" as string. Always `parseFloat(String(value))` before displaying percentages to avoid trailing zeros.
