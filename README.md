<p align="center">
  <img src="https://pos.karetechsolutions.com/logo.png" alt="Bettencourt's POS" width="120" />
</p>

<h1 align="center">Bettencourt's POS</h1>

<p align="center">
  Enterprise point-of-sale system built for <strong>Bettencourt's Food Inc.</strong> — a Guyanese restaurant in Georgetown, Guyana.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/React_Router-v7-CA4245?style=flat-square&logo=reactrouter&logoColor=white" />
  <img src="https://img.shields.io/badge/Hono-4.x-E36002?style=flat-square&logo=hono&logoColor=white" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?style=flat-square&logo=drizzle&logoColor=black" />
  <img src="https://img.shields.io/badge/Bun-1.1+-F9F1E1?style=flat-square&logo=bun&logoColor=black" />
  <img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo&logoColor=white" />
  <img src="https://img.shields.io/badge/license-Private-gray?style=flat-square" />
</p>

<p align="center">
  <a href="https://pos.karetechsolutions.com">🌐 Live App</a> &nbsp;·&nbsp;
  <a href="docs/USER-MANUAL.md">📖 User Manual</a> &nbsp;·&nbsp;
  <a href="docs/DEVELOPER.md">🛠 Developer Guide</a> &nbsp;·&nbsp;
  <a href="docs/PRODUCTION-MIGRATION.md">🚀 Deployment Guide</a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Database](#database)
- [Deployment](#deployment)
- [Modules & Pages](#modules--pages)
- [Role-Based Access Control](#role-based-access-control)
- [Documentation](#documentation)

---

## Overview

Bettencourt's POS is a full-stack, type-safe point-of-sale platform purpose-built for a Guyanese restaurant. It handles everything from table-side ordering and kitchen display through to accounting, inventory, and payroll — replacing off-the-shelf software that couldn't handle GYD currency, local tax rules, or the restaurant's specific workflow.

**Key numbers:**
- 59 frontend pages across 8 modules
- 44 API routers with end-to-end type safety (oRPC)
- 20 database schema files covering 78+ tables
- 202 commits from conception to production

---

## Key Features

### 🧾 Point of Sale
- Product grid by department with real-time search
- Modifier support (spice level, extras, substitutions)
- Combo products with itemized receipts
- Discounts (fixed/percentage), split payments, tips
- Multi-currency support (GYD + USD at configurable exchange rate)
- Tab mode for dine-in orders

### 🍳 Kitchen & Operations
- Kitchen Display System (KDS) via Server-Sent Events — no polling
- Course-based firing for multi-course meals
- Floor plan with drag-and-drop table layout editor
- Table assignment, transfer, and merge
- Waitlist management with SMS-ready notifications

### 📦 Inventory
- Real-time stock tracking with low-stock and out-of-stock alerts
- Recipe management — ingredients auto-deducted per sale
- Purchase orders and goods receiving
- Waste logging with reason codes
- Barcode scanning support (EAN-13)
- Menu calendar with scheduled price overrides

### 💰 Finance & Accounting
- Full invoice lifecycle (draft → sent → paid)
- Credit notes and vendor bills
- Recurring billing with auto-generation
- Aging reports, customer statements, vendor statements
- Tax summary (16% VAT on beverages)
- Budget tracking and funding sources
- Daily expense summary PDF export

### 👥 Customers & Loyalty
- Customer profiles with purchase history
- Loyalty points accumulation and redemption
- Gift cards (issue, reload, balance check)
- Feedback collection

### 📊 Reporting
- Sales by period, department, product, server
- Product profitability report
- Cash session summaries with PDF export
- Delivery platform integration (aggregated reporting)
- Employee tip tracking

### ⚙️ Administration
- User management with invite flow, PIN login, password reset
- 8-level RBAC with granular permissions
- Backup and restore with scheduled daily backups
- Receipt configuration per location
- Tax rate management
- Printer configuration (USB + Network thermal printers)
- Notification webhooks (Slack, etc.)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.x |
| **Routing** | React Router | v7 (flat file routes) |
| **UI Components** | shadcn/ui + Tailwind CSS | v4 |
| **Data Fetching** | TanStack Query | v5 |
| **API Layer** | oRPC (type-safe RPC over HTTP) | latest |
| **Backend** | Hono (edge-compatible HTTP framework) | 4.x |
| **Authentication** | Better Auth | latest |
| **ORM** | Drizzle ORM | 0.45 |
| **Database** | PostgreSQL | 15+ |
| **Runtime** | Bun | 1.1+ |
| **Monorepo** | Turborepo | latest |
| **Containerization** | Docker + Docker Compose | — |
| **Reverse Proxy** | Pangolin (Cloudflare Tunnel alternative) | — |
| **Linting** | Biome | — |

---

## Project Structure

```
Bettencourt-POS/
├── apps/
│   ├── web/                     # React SPA (React Router v7, flat file routes)
│   │   └── src/
│   │       ├── routes/          # 59 page components (dashboard.*.tsx)
│   │       ├── components/      # Shared UI components
│   │       │   ├── pos/         # POS-specific components
│   │       │   ├── kds/         # Kitchen Display System
│   │       │   └── ui/          # shadcn/ui primitives
│   │       └── lib/             # Utilities, PDF generators, modules config
│   ├── server/                  # Hono API server
│   │   └── src/
│   │       ├── index.ts         # Server entry + auth routes
│   │       └── ws.ts            # WebSocket / SSE for KDS
│   └── fumadocs/                # In-app documentation (MDX)
│       └── content/docs/        # .mdx documentation pages
├── packages/
│   ├── api/                     # oRPC routers + all business logic
│   │   └── src/routers/         # 44 domain routers
│   ├── auth/                    # Better Auth configuration
│   ├── db/                      # Drizzle schema + migrations + seed
│   │   └── src/
│   │       ├── schema/          # 20 schema files / 78+ tables
│   │       ├── migrations/      # SQL migration files
│   │       └── seed.ts          # Comprehensive demo seed (7,000+ lines)
│   ├── env/                     # Zod-validated environment variables
│   └── catalog/                 # Shared dependency version catalog
├── docs/                        # Developer and client documentation
├── docker-compose.prod.yml      # Production compose file
├── Dockerfile                   # Multi-stage build (distroless runner)
└── turbo.json                   # Turborepo pipeline config
```

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://docker.com) + Docker Compose (for the database and production)
- PostgreSQL 15+ (or use the Docker database container)

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/kareemschultz/Bettencourt-POS.git
cd Bettencourt-POS

# 2. Install dependencies
bun install

# 3. Configure environment
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env — set DATABASE_URL and BETTER_AUTH_SECRET

# 4. Push schema to database
bun run db:push

# 5. Seed with demo data
cd packages/db && bun run db:seed && cd ../..

# 6. Start development servers
bun run dev
```

| Service | URL |
|---------|-----|
| Web App | http://localhost:5173 |
| API Server | http://localhost:3000 |
| Drizzle Studio | `bun run db:studio` (from `packages/db/`) |

**Demo login:** `admin@bettencourt.com` / `password123`
**PIN login:** any user PIN (see `DEMO-CREDENTIALS.md`)

---

## Environment Variables

All variables live in `apps/server/.env`. See `apps/server/.env.example` for a full template.

| Variable | Description | Required |
|----------|-------------|:--------:|
| `DATABASE_URL` | PostgreSQL connection string (`postgres://user:pass@host:5432/db`) | ✅ |
| `BETTER_AUTH_SECRET` | Random secret ≥ 32 characters (use `openssl rand -hex 32`) | ✅ |
| `BETTER_AUTH_URL` | Public-facing URL of the app (e.g. `https://pos.example.com`) | ✅ |
| `CORS_ORIGIN` | Allowed CORS origin (same as `BETTER_AUTH_URL` in production) | ✅ |
| `PORT` | API server port (default: `3000`) | ❌ |
| `NODE_ENV` | `development` or `production` | ❌ |
| `BACKUP_DIR` | Directory for automated backups (default: `/var/backups/bettencourt`) | ❌ |

---

## Available Scripts

### Root (run from project root with Turborepo)

| Script | Description |
|--------|-------------|
| `bun run dev` | Start all apps in parallel (web + server) |
| `bun run build` | Build all apps for production |
| `bun run check-types` | TypeScript strict type check across all packages |
| `bun run check` | Biome lint + format check |

### Database (run from `packages/db/`)

| Script | Description |
|--------|-------------|
| `bun run db:push` | Push Drizzle schema changes directly to DB (dev) |
| `bun run db:generate` | Generate new SQL migration file |
| `bun run db:migrate` | Apply pending SQL migrations |
| `bun run db:seed` | Seed full demo dataset (orders, customers, inventory) |
| `bun run db:seed:prod` | Seed structural data only (categories, roles) + create admin user |
| `bun run db:studio` | Open Drizzle Studio (visual DB browser) |

---

## Database

The schema spans **20 files and 78+ tables** covering:

- Orders, line items, payments, modifiers, discounts
- Products, categories, modifiers, barcodes, menu schedules
- Inventory, stock alerts, purchase orders, recipes
- Customers, loyalty, gift cards, feedback
- Invoices, bills, credit notes, recurring billing, budgets
- Employees, time clock, shifts, tips
- Floors, tables, printers, registers
- Delivery platforms, reservations, waitlist
- Backups, notifications, webhooks

**Migration strategy:** Drizzle uses file-based migrations. Run `bun run db:generate` after schema changes, then `bun run db:migrate` to apply. The server does **not** auto-migrate on startup.

---

## Deployment

Full guide: [docs/PRODUCTION-MIGRATION.md](docs/PRODUCTION-MIGRATION.md)

### Docker (recommended)

```bash
# Build and start production container
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker logs kt-bettencourt-pos --follow

# Apply new migrations (if any)
docker exec -i kt-central-db psql -U postgres -d bettencourt_pos < packages/db/src/migrations/<file>.sql
```

The Dockerfile uses a **multi-stage distroless build**:
1. `builder` — installs deps + compiles frontend + builds Bun binary
2. `runner` — copies only the compiled binary (no Node/Bun runtime in final image)

**Live production:** https://pos.karetechsolutions.com
Served via Pangolin reverse proxy on the same Docker host.

---

## Modules & Pages

| Module | Pages | Description |
|--------|-------|-------------|
| **POS** | New Sale, Quick Order | Table-side and counter ordering |
| **Orders** | Orders, Order Detail | Order management and history |
| **Kitchen** | KDS, Production Board | Real-time kitchen display |
| **Tables** | Floor Plan, Table Management | Dine-in table assignments |
| **Inventory** | Products, Categories, Stock, Suppliers, Barcodes, Recipes | Full inventory control |
| **Customers** | Customer List, Customer Detail, Loyalty, Gift Cards | CRM and loyalty |
| **Finance** | Invoices, Bills, Credit Notes, Recurring, Budgets, Funding Sources, Reports | Accounting suite |
| **Reports** | Sales, Cash Sessions, Expenses, Profitability, Tips, Delivery | Business intelligence |
| **Settings** | Users, Roles, Locations, Printers, Tax Rates, Modifiers, Receipts, Backup | Administration |

---

## Role-Based Access Control

8 built-in roles with granular per-module permissions:

| Role | Access Level |
|------|-------------|
| `owner` | Full access — all modules, settings, financial data |
| `manager` | All operations except user management and system settings |
| `accountant` | Finance module, reports, read-only inventory |
| `executive` | Reports and analytics — read only |
| `cashier` | POS, orders, customer lookup, cash sessions |
| `server` | POS, orders, KDS — table service focus |
| `kitchen` | KDS, production board — kitchen only |
| `warehouse` | Inventory module — stock management |

---

## Documentation

| Document | Audience | Description |
|----------|----------|-------------|
| [docs/USER-MANUAL.md](docs/USER-MANUAL.md) | Client (Shakira) | Daily operations guide for staff |
| [docs/DEVELOPER.md](docs/DEVELOPER.md) | Developers | Architecture, patterns, conventions |
| [docs/PRODUCTION-MIGRATION.md](docs/PRODUCTION-MIGRATION.md) | DevOps | Full deployment and migration guide |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Internal | Project history and status log |
| [DEMO-CREDENTIALS.md](DEMO-CREDENTIALS.md) | Developers | Demo login credentials and PIN codes |
| In-app Docs | Users | Built-in documentation at `/docs` (Fumadocs) |

---

<p align="center">
  Built by <a href="https://karetechsolutions.com">KareTech Solutions</a> for Bettencourt's Food Inc. — Georgetown, Guyana 🇬🇾
</p>
