# Production Migration Guide

Step-by-step guide for deploying Bettencourt POS to production.

---

## Prerequisites

- Docker + Docker Compose on the host server
- A PostgreSQL 15+ database (external, not containerized with the app)
- DNS pointing your domain to the server
- Pangolin reverse proxy configured (or another proxy)

---

## Environment Variables

Copy `docker-compose.prod.env.example` and fill in real values:

```bash
cp docker-compose.prod.env.example .env.prod
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random secret ≥ 32 chars. Generate: `openssl rand -base64 32` |

Never commit `.env.prod` to git.

---

## First-Time Setup

### 1. Apply database schema

```bash
cd Bettencourt-POS
DATABASE_URL="postgresql://..." bun run db:push
```

### 2. Seed structural data + create admin user

```bash
cd packages/db
DATABASE_URL="postgresql://..." bun run db:seed:prod
```

This will:
- Create the organization, locations, registers, products, roles, modifiers, receipt config
- Generate a random admin password and print it to the console

**Save the credentials printed to the terminal. They will not be shown again.**

### 3. Build and start the application

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 4. Verify the deployment

```bash
curl https://pos.karetechsolutions.com/health
```

Should return `{"status":"ok",...}`.

---

## Removing Demo Data

If you previously ran `bun run db:seed` (full mode) and want a clean production database:

```sql
-- Connect to the database and run:
TRUNCATE order_line_item, payment, "order", cash_session, cash_drop,
  kitchen_order_item, kitchen_order_ticket, stock_ledger, waste_log,
  time_entry, expense, gift_card, loyalty_transaction, customer_loyalty,
  customer, audit_log RESTART IDENTITY CASCADE;

-- Also delete demo users (keep only the production admin):
DELETE FROM "user" WHERE email != 'admin@bettencourts.com';
```

---

## Database Backup Strategy

### Manual backup

```bash
pg_dump "postgresql://user:pass@host:5432/bettencourt_pos" \
  --no-owner --no-acl \
  -f "backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Restore

```bash
psql "postgresql://user:pass@host:5432/bettencourt_pos" \
  -f backup_20260306_120000.sql
```

### Recommended schedule

- **Daily**: Automated pg_dump to a remote location (S3, SFTP, etc.)
- **Before every deployment**: Manual backup
- **Test restores**: Monthly, restore to a test DB and verify data

---

## Updating the Application

```bash
# Pull latest code
git pull origin master

# Build new Docker image and restart
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Zero-downtime: Docker Compose will build the new image before stopping the old container.

---

## Troubleshooting

### View logs

```bash
docker logs kt-bettencourt-pos --tail 100 -f
```

### Restart the container

```bash
docker compose -f docker-compose.prod.yml restart
```

### Database connection issues

Verify the container can reach the database:

```bash
docker exec kt-bettencourt-pos sh -c 'echo $DATABASE_URL'
```

---

## Migrating from Development (db:push) to Migrations

The current setup uses `drizzle-kit push` which directly applies schema changes without migration files. This is fine for development but riskier in production.

To switch to proper migrations:

1. Generate migrations: `bun run db:generate`
2. Run migrations: `bun run db:migrate`
3. Update `docker-compose.prod.yml` entrypoint to run migrations before starting the server

This is a future improvement. For now, `db:push` is used with manual backups before each schema change.
