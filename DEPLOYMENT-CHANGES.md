# Bettencourt POS - Deployment Changes by Alfred
Date: 2026-03-05

## Summary
Alfred (Kareem's infrastructure agent) made the following changes to get the Bettencourt POS app deployed to production at `pos.karetechsolutions.com` on KareTech's VPS (kt-nexus-01).

---

## Files Modified

### 1. `Dockerfile` (rewritten)

**Problem**: The original Dockerfile used `oven/bun:1` for the builder stage. React Router v7's Vite plugin has a `writeBundle` hook that imports `react-dom/server` at runtime to verify the build. Bun's `react-dom/server.bun.js` does NOT export `renderToPipeableStream` (a Node.js streaming API), causing the build to fail even though `ssr: false` is set.

**Second problem**: Bun's workspace `node_modules` uses symlinks into a `.bun/` cache directory. These symlinks break when copied between Docker stages with `COPY --from=builder`. The production image could never resolve packages like `better-auth`, `hono`, etc.

**Solution** (pattern taken from Terminal Control's server Dockerfile):

1. **Builder stage uses `node:22-slim` + `npm install -g bun`** instead of `oven/bun:1`. Node.js handles the `react-dom/server` import in the writeBundle hook correctly.

2. **Externals-only node_modules**: After building, a clean `/app/externals/` directory is created with a fresh `package.json`. Only the packages that tsdown leaves as external imports are installed via `bun add`. This produces a proper `node_modules/` with real directories (no broken symlinks).

3. **Production stage** (`oven/bun:1-slim`) receives only:
   - `dist/` (server bundle from tsdown)
   - `public/` (web SPA build from Vite/React Router)
   - `node_modules/` (from the clean externals directory)

**External packages** (these break when bundled due to dynamic imports):
- `hono` - web framework
- `@orpc/openapi`, `@orpc/server`, `@orpc/zod` - RPC framework
- `better-auth`, `@better-auth/drizzle-adapter` - auth (dynamic adapter loading)
- `drizzle-orm`, `pg` - database
- `dotenv`, `@t3-oss/env-core` - env validation
- `zod` - schema validation

**If you add new external dependencies** to the server: add them to the `bun add` line in the Dockerfile (line ~58).

### 2. `docker-compose.prod.yml` (modified)

Changes from original:
- **Network**: Changed from `kt-network` (does not exist) to `kt-net-apps` (actual network name on kt-nexus-01)
- **Added networks**: `kt-net-databases` (for kt-central-db access) and `pangolin` (for reverse proxy routing)
- **Added resource limits**: `memory: 256M`, `cpus: "0.5"`
- **Added logging limits**: `max-size: 10m`, `max-file: 3` (prevents disk fill)

### 3. `apps/web/vite.config.ts` (NOT modified)
This file was NOT changed. The `ssr: false` config is correct. The build issue was solved at the Dockerfile level by using Node.js for the build stage.

---

## Infrastructure Setup (outside this repo)

### Database
- Database `bettencourt_pos` was created on `kt-central-db` (shared PostgreSQL 16 instance)
- Connection: `postgresql://postgres:{password}@kt-central-db:5432/bettencourt_pos`
- The DB password in docker-compose.prod.yml is currently plaintext -- should be moved to HashiCorp Vault

### Pangolin Reverse Proxy
- Resource created: `pos.karetechsolutions.com` (resource ID 42)
- Target: `kt-bettencourt-pos:3000` (target ID 43)
- SSO disabled (app has its own auth via better-auth)
- SSL enabled (auto via Let's Encrypt through Pangolin/Gerbil)

### Docker Container
- Name: `kt-bettencourt-pos`
- Networks: `kt-net-apps`, `kt-net-databases`, `pangolin`
- Health check: `GET /health` every 30s
- Status as of deployment: running, healthy, serving at pos.karetechsolutions.com

---

## Known Issues / TODO

1. **DB password in plaintext** in docker-compose.prod.yml -- should be stored in HashiCorp Vault at `secret/bettencourt-pos/db` and referenced via `.env` file
2. **BETTER_AUTH_SECRET** has a hardcoded default -- should also go to Vault
3. **Server RAM is tight** (5.7/7.7GB used, heavy swap at 6.3/8.0GB) -- the 256M limit keeps this container lean but monitor for OOM
4. **Image size** could be reduced further by switching to DHI (Docker Hardened Images) like Terminal Control does -- see `apps/server/Dockerfile` in the terminal-control repo for the pattern

---

## How to Rebuild

```bash
cd /home/karetech/projects/bettencourt/Bettencourt-POS
docker compose -f docker-compose.prod.yml up -d --build
```

The container auto-connects to all required networks via the compose file. No manual `docker network connect` needed.

---

## Server Context (kt-nexus-01)

- **VPS**: 7.7GB RAM, 240GB disk, ~44 containers running
- **Docker networks**: `kt-net-apps` (app-to-app), `kt-net-databases` (app-to-db), `pangolin` (reverse proxy)
- **Central DB**: `kt-central-db` at port 5432 (internal), PostgreSQL 16 with PgBouncer
- **Reverse proxy**: Pangolin + Traefik + Gerbil stack (API at `http://172.20.0.6:3003/v1/`)
- **Pangolin API key**: stored in Vault at `secret/pangolin/api_key`
- **Domain**: `karetechsolutions.com` managed via Pangolin (domainId: `domain1`)

---

## Update: 2026-03-30 — Agency/Contact Fields for Government Orders

**Problem**: When government agencies (e.g. Ministry of Home Affairs) placed orders, the printed quotation/invoice only had a customer name and address. When staff called to follow up, no one at the agency knew who had placed the order.

**Solution**: Added three optional fields to both Quotations and Invoices:
- **Agency / Organization** — the ministry or company name
- **Order Placed By** — the specific person who placed the order
- **Position / Title** — their role/title

These fields were already in the database schema (`agency_name`, `contact_person_name`, `contact_person_position`) but were not wired up in the form or PDF.

**Files Changed**:
- `apps/web/src/lib/pdf/quotation-pdf.ts` — added fields to type, updated PDF "Prepared For" section to display them
- `apps/web/src/lib/pdf/invoice-pdf.ts` — already rendered these fields; no change needed
- `apps/web/src/routes/dashboard.quotations.tsx` — added form inputs, QuotationForm/QuotationRow types, openEdit, sharedFields
- `apps/web/src/routes/dashboard.invoices.tsx` — updated "Contact Person" label to "Order Placed By" for clarity

**PDF Output** (both Quotation and Invoice):
```
Prepared For / Bill To
[Contact Person Name]         ← the specific person
[Their Position/Title]        ← their title
[Agency / Organization]       ← ministry or company (bold)
[Phone]
[Address]

                   Order Placed By
                   [Contact Name]
```

**No database migration needed** — columns were already present.

---

## Update: 2026-04-19 — Security Audit Remediation + GRA VAT + POS Settings Wiring

### Security audit (all waves complete — commits `8e5247c` → `c1ae520`)

**26 findings addressed:**
- IDOR org-scoping: pos router, customers, orders, modifiers (9 procedures), reports (13 types + EOD)
- Server-side price & tax validation; money.ts helpers (toCents/fromCents/roundMoney)
- Offline cart UX: cart stays visible on queue; cashier manually clears after confirmation
- Gift card debit inside DB transaction; UNIQUE index on `order_number+org`; CHECK constraints on financial columns
- Pagination on all list endpoints; product grid virtualisation (`@tanstack/react-virtual`)
- Path traversal + SSRF protections on print proxy and uploads
- Dead code removed; console.log/error stripped from offline module

### GRA VAT (Guyana 14%)
- Seed updated: "VAT" at 14% (was "Sales Tax" at 9%); Alcohol Tax seed removed
- Tax extraction formula `price × rate/(1+rate)` used throughout: CartPanel, receipt preview, ESC/POS print
- Settings UI shows GRA formula + correct terminology

### QZ Tray signed-mode printing
- Self-signed CA cert (CA:TRUE, RSA-2048) served at `/api/qz/certificate`
- PowerShell one-liner for Windows terminal setup (Printers settings page)
- `scripts/install-qz-cert.bat` alternative

### POS settings wired into terminal
- `getPosSettings` now called from `pos-terminal.tsx`; `autoPrintReceipt` honours org setting (was hardcoded)
- `defaultOrderType` applied once on load; `enableGiftCards`/`enableLoyalty` gate UI elements

### CartPanel VAT breakdown toggle
- "Incl. VAT" row clickable — expands per-item VAT breakdown
- Single item: shows that item's VAT. Multiple items: shows each item's VAT
- State persisted per-terminal via `localStorage` key `pos-show-vat`

### GYD denomination fix
- Quick-cash buttons: `[100, 500, 1000, 2000, 5000]` (removed non-existent $10k/$20k notes)

### Courses toggle (Shakira feedback)
- Course selector bar has "Hide / Show courses" toggle; persisted to `pos-show-courses` localStorage
- Counter-service mode defaults to hidden

### Deployment
- All changes live on `kt-titan-01` (`pos.bettencourtgy.com`), HTTP 200 confirmed
- DB migrations 0020 + 0021 applied (UNIQUE index, CHECK constraints)
- GitHub: `kareemschultz/Bettencourt-POS`, branch `master`
