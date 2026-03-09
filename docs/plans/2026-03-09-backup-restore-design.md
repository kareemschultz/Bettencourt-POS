# Backup & Restore — Design Document

**Date:** 2026-03-09
**Status:** Approved

---

## Overview

Self-contained backup and restore system for Bettencourt's POS. Scheduled daily backups at midnight (Guyana time), manual trigger from UI, download/restore from Settings, and email notification on backup failure. Fully portable — no host-level dependencies, works in any Docker environment.

---

## Architecture

### Backup Engine (server-side)
- `node-cron` scheduler fires at midnight `America/Guyana` time
- Drizzle ORM queries all tables sequentially
- Output: gzipped JSON with header metadata + all table rows
- Retention: keeps last 7 files, deletes older ones automatically
- On failure: sends email via existing notification system (failure only)

### Storage
- Backup folder: `/app/backups/` inside the container
- Mapped to Docker named volume `bettencourt-backups` in `docker-compose.prod.yml`
- Survives container rebuilds and image updates

### API (Hono, admin-only)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/backups` | List backup files (name, size, date, row counts) |
| POST | `/api/backups/trigger` | Manual backup now |
| GET | `/api/backups/download/:filename` | Stream file download |
| POST | `/api/backups/restore` | Upload + apply a backup |

All routes protected by existing Better Auth session middleware, executive/admin roles only.

### UI
- New route: `/dashboard/backup`
- Sidebar: under **System** group (alongside Settings, Audit Log)
- Access: executive + admin only

---

## Backup File Format

**Filename:** `bettencourt-pos-backup-2026-03-09T04-00-00.json.gz`

```json
{
  "version": "1",
  "createdAt": "2026-03-09T04:00:00.000Z",
  "checksum": "sha256:abc123...",
  "rowCounts": {
    "organizations": 1,
    "orders": 312,
    "products": 112
  },
  "tables": {
    "organizations": [...],
    "users": [...],
    "products": [...],
    "orders": [...]
  }
}
```

---

## Restore Process

1. User uploads `.json.gz` file (or clicks Restore on an existing backup)
2. Server decompresses + validates: version field, checksum verification (SHA-256)
3. Shows row counts in UI for sanity check before confirming
4. **Auto-snapshot**: server automatically creates a `pre-restore-YYYY-MM-DD.json.gz` of current state before applying — so you can always undo
5. Single DB transaction:
   - Disable FK constraints (`SET session_replication_role = replica`)
   - Truncate all tables in reverse dependency order
   - Bulk insert all rows from backup
   - Re-enable FK constraints
6. On success → confirmation toast, page refreshes backup list
7. On failure → transaction rolls back, existing data untouched, error shown

---

## Enhancements (beyond baseline)

1. **Auto-snapshot before restore** — creates a safety backup before every restore operation so a bad restore is always reversible
2. **SHA-256 checksum** — stored in backup header, verified on restore to detect file corruption
3. **Row count summary** — backup header includes per-table row counts, shown in UI so admin can sanity-check before restoring ("does this backup have 312 orders as expected?")
4. **"Backup Now" with live feedback** — spinner + success/error toast, last backup time updates in real time
5. **Visual health indicator** — green dot (backup within 25h), yellow (missed 1 day), red (2+ days missed)
6. **Pre-restore backup tagged clearly** — prefixed `pre-restore-` so it's obvious in the backup list

---

## UI Layout

### `/dashboard/backup` — Backup & Restore

**① Status Bar**
- Last backup timestamp with colour-coded health dot
- Next scheduled time
- "Backup Now" button (spinner while running)

**② Backup History Table**
| File | Created | Size | Row Summary | Actions |
|------|---------|------|-------------|---------|
| bettencourt-pos-backup-2026-03-09... | Mar 9 12:00 AM | 2.4 MB | 312 orders, 112 products... | Download · Restore |

- Up to 7 rows + any `pre-restore-` snapshots
- Restore → `AlertDialog` confirmation with row count summary shown inside dialog

**③ Restore from File**
- File upload (`.json.gz` only)
- Warning callout box
- "Restore from File" → same `AlertDialog` with parsed row count preview

---

## Table Export Order (FK-safe)

Truncate in reverse, insert in forward order:

**Insert order (parents first):**
organizations → users → roles → locations → suppliers → categories → products → customers → orders → orderLineItems → expenses → invoices → invoiceLineItems → creditNotes → vendorBills → ... (all remaining)

---

## Email Notification

On scheduled backup failure:
- Uses existing `sendNotificationEmail` utility in the server
- Subject: `[Bettencourt POS] Backup Failed — {date}`
- Body: error message + timestamp + prompt to check server
- Recipient: organization's notification email from Settings

---

## Files Changed

| File | Change |
|------|--------|
| `apps/server/src/lib/backup-engine.ts` | NEW — core export/import/schedule logic |
| `apps/server/src/routes/backups.ts` | NEW — Hono routes |
| `apps/server/src/index.ts` | Register backup routes + start scheduler |
| `apps/web/src/routes/dashboard.backup.tsx` | NEW — UI page |
| `apps/web/src/components/layout/app-sidebar.tsx` | Add Backup entry under System |
| `apps/web/src/routes/dashboard.tsx` | Add to PAGE_TITLES + ROUTE_MODULE_MAP |
| `docker-compose.prod.yml` | Add `bettencourt-backups` volume mount |
| `docs/USER-MANUAL.md` | Backup & Restore section |
