# Bettencourt POS

Enterprise point-of-sale system for **Bettencourt's Food Inc.**, a Guyanese restaurant in Georgetown, Guyana.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router v7, Tailwind CSS v4, shadcn/ui |
| Backend | Hono, oRPC (type-safe API), Better Auth |
| Database | PostgreSQL 15+, Drizzle ORM |
| Runtime | Bun |
| Build | Turborepo (monorepo) |
| Deployment | Docker, Pangolin reverse proxy |

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://docker.com) + Docker Compose
- PostgreSQL 15+ database

---

## Quick Start (Development)

```bash
# 1. Clone and install
git clone https://github.com/kareemschultz/Bettencourt-POS.git
cd Bettencourt-POS
bun install

# 2. Configure environment
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your DATABASE_URL and BETTER_AUTH_SECRET

# 3. Push schema to database
bun run db:push

# 4. Seed database with demo data
cd packages/db && bun run db:seed && cd ../..

# 5. Start development servers
bun run dev
```

- Web app: http://localhost:5173
- API server: http://localhost:3000

**Demo credentials:** `admin@bettencourt.com` / `password123`

---

## Project Structure

```
Bettencourt-POS/
├── apps/
│   ├── web/              # React SPA (React Router v7)
│   │   └── src/routes/   # All page components
│   └── server/           # Hono API server
│       └── src/index.ts  # Server entry point + auth routes
├── packages/
│   ├── api/              # oRPC routers + business logic
│   │   └── src/routers/  # 29 domain routers
│   ├── auth/             # Better Auth configuration
│   ├── db/               # Drizzle schema + seed script
│   │   └── src/
│   │       ├── schema/   # 78 database tables across 14 files
│   │       └── seed.ts   # 7,000+ line comprehensive seed
│   └── env/              # Zod-validated environment variables
├── docs/                 # Project documentation
├── docker-compose.prod.yml
└── Dockerfile
```

---

## Available Scripts

### Root (run from project root)

| Script | Description |
|--------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all apps for production |
| `bun run check-types` | TypeScript type check across all packages |
| `bun run check` | Biome lint + format |

### Database (run from `packages/db/`)

| Script | Description |
|--------|-------------|
| `bun run db:push` | Apply schema changes to database |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run migration files |
| `bun run db:seed` | Seed full demo data |
| `bun run db:seed:prod` | Seed structural data only + create admin user |
| `bun run db:studio` | Open Drizzle Studio |

---

## Environment Variables

### `apps/server/.env`

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `BETTER_AUTH_SECRET` | Auth secret ≥ 32 chars | ✅ |
| `BETTER_AUTH_URL` | Public URL of the app | ✅ |
| `CORS_ORIGIN` | Allowed CORS origin | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |
| `NODE_ENV` | `development` or `production` | ❌ |

---

## Deployment

See [docs/PRODUCTION-MIGRATION.md](docs/PRODUCTION-MIGRATION.md) for full deployment guide.

### Quick deploy

```bash
# Build and start production container
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Live at: https://pos.karetechsolutions.com

---

## Key Features

- **POS Terminal** — Order creation, product grid by department, modifiers, discounts, split payments
- **Kitchen Display System** — Real-time order tickets via SSE (Server-Sent Events)
- **Inventory Management** — Stock tracking, purchase orders, waste logging, stock alerts
- **Cash Control** — Shift open/close, cash drops, payouts, shift summaries
- **Reporting** — Sales by period/department/product, expenses, profitability
- **Customer Management** — Customer profiles, loyalty points, gift cards
- **Time Clock** — Employee clock in/out with hourly rate tracking
- **RBAC** — 8 roles (Owner, Manager, Cashier, Server, Kitchen, Warehouse, Accountant, Executive)
- **Settings** — Products, categories, modifiers, receipt config, tax rates, registers

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/USER-MANUAL.md](docs/USER-MANUAL.md) | Client guide for daily operations |
| [docs/DEVELOPER.md](docs/DEVELOPER.md) | Architecture and development guide |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Project history and status |
| [docs/PRODUCTION-MIGRATION.md](docs/PRODUCTION-MIGRATION.md) | Production deployment guide |
| [DEMO-CREDENTIALS.md](DEMO-CREDENTIALS.md) | Demo login credentials |
