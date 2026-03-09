# Backup & Restore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scheduled daily backups (midnight GY time), manual trigger, download/restore from a Settings UI page, and email alert on backup failure.

**Architecture:** The Hono server exports all DB tables as gzipped JSON using Drizzle, stores files in a Docker-mounted volume at `/app/backups/`, and schedules via `node-cron`. Direct Hono routes (not oRPC) handle file uploads/downloads. The web UI adds a `/dashboard/backup` page under the System section.

**Tech Stack:** `node-cron` (scheduler), `node:zlib` (compression), `node:crypto` (SHA-256 checksum), `nodemailer` (email alerts), Drizzle ORM (data export/import), Hono (routes), React Router + Tanstack Query (UI)

---

## Table of Contents
1. SMTP Email Utility
2. Backup Engine
3. Hono Backup Routes
4. Docker Volume
5. Web UI Page
6. Sidebar + Routing
7. Tests + Docs + Commit

---

### Task 1: SMTP Email Utility

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `apps/server/package.json`
- Create: `apps/server/src/email.ts`

**Step 1: Add optional SMTP env vars**

In `packages/env/src/server.ts`, add to the `server` block:

```ts
SMTP_HOST: z.string().optional(),
SMTP_PORT: z.coerce.number().optional().default(587),
SMTP_USER: z.string().optional(),
SMTP_PASS: z.string().optional(),
SMTP_FROM: z.string().optional().default("noreply@bettencourt-pos.com"),
SMTP_ALERT_TO: z.string().optional(),
```

**Step 2: Install nodemailer**

```bash
cd apps/server && bun add nodemailer && bun add -d @types/nodemailer
```

**Step 3: Create email utility**

Create `apps/server/src/email.ts`:

```ts
import { env } from "@Bettencourt-POS/env/server";
import nodemailer from "nodemailer";

export async function sendBackupFailureAlert(error: string): Promise<void> {
	if (!env.SMTP_HOST || !env.SMTP_ALERT_TO) {
		console.error("[backup] SMTP not configured — skipping email alert");
		return;
	}
	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		auth: env.SMTP_USER
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
	});
	await transporter.sendMail({
		from: env.SMTP_FROM,
		to: env.SMTP_ALERT_TO,
		subject: `[Bettencourt POS] Backup Failed — ${new Date().toLocaleDateString("en-GY", { timeZone: "America/Guyana" })}`,
		text: `The scheduled backup failed at ${new Date().toISOString()}.\n\nError: ${error}\n\nPlease log in to the POS and run a manual backup.`,
	});
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd /path/to/Bettencourt-POS && bun run check-types
```
Expected: 0 errors.

**Step 5: Commit**

```bash
git add packages/env/src/server.ts apps/server/src/email.ts apps/server/package.json bun.lock
git commit -F /tmp/msg.txt  # "feat: add SMTP email utility for backup alerts"
```

---

### Task 2: Backup Engine

**Files:**
- Create: `apps/server/src/backup-engine.ts`
- Modify: `apps/server/src/index.ts` (start scheduler on boot)

**Step 1: Create the backup engine**

Create `apps/server/src/backup-engine.ts`:

```ts
import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { gunzip, gzip } from "node:zlib";
import { promisify } from "node:util";
import { join } from "node:path";
import cron from "node-cron";
import { sendBackupFailureAlert } from "./email";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const BACKUP_DIR = process.env.BACKUP_DIR ?? "/app/backups";
const MAX_BACKUPS = 7;

// All tables to export, in insertion order (parents before children)
// Skipped: session, verification, pinLoginRateLimit (transient auth state)
const EXPORT_TABLES = [
	// Auth / org root
	{ name: "organization", table: schema.organization },
	{ name: "user", table: schema.user },
	{ name: "account", table: schema.account },
	{ name: "twoFactor", table: schema.twoFactor },
	{ name: "member", table: schema.member },
	{ name: "invitation", table: schema.invitation },
	// Config
	{ name: "location", table: schema.location },
	{ name: "register", table: schema.register },
	{ name: "receiptConfig", table: schema.receiptConfig },
	{ name: "customRole", table: schema.customRole },
	{ name: "userRole", table: schema.userRole },
	{ name: "reportingCategory", table: schema.reportingCategory },
	{ name: "taxRate", table: schema.taxRate },
	{ name: "discountRule", table: schema.discountRule },
	// Products / menu
	{ name: "product", table: schema.product },
	{ name: "modifierGroup", table: schema.modifierGroup },
	{ name: "modifier", table: schema.modifier },
	{ name: "productModifierGroup", table: schema.productModifierGroup },
	{ name: "productBarcode", table: schema.productBarcode },
	{ name: "productLocation", table: schema.productLocation },
	{ name: "comboProduct", table: schema.comboProduct },
	{ name: "comboComponent", table: schema.comboComponent },
	{ name: "menuSchedule", table: schema.menuSchedule },
	{ name: "menuScheduleProduct", table: schema.menuScheduleProduct },
	{ name: "recipeIngredient", table: schema.recipeIngredient },
	{ name: "productProductionComponent", table: schema.productProductionComponent },
	// Inventory
	{ name: "supplier", table: schema.supplier },
	{ name: "inventoryItem", table: schema.inventoryItem },
	{ name: "inventoryItemBarcode", table: schema.inventoryItemBarcode },
	{ name: "inventoryStock", table: schema.inventoryStock },
	{ name: "stockLedger", table: schema.stockLedger },
	{ name: "purchaseOrder", table: schema.purchaseOrder },
	{ name: "purchaseOrderLine", table: schema.purchaseOrderLine },
	{ name: "goodsReceipt", table: schema.goodsReceipt },
	{ name: "goodsReceiptLine", table: schema.goodsReceiptLine },
	{ name: "transfer", table: schema.transfer },
	{ name: "transferLine", table: schema.transferLine },
	{ name: "stockCount", table: schema.stockCount },
	{ name: "stockCountLine", table: schema.stockCountLine },
	{ name: "wasteLog", table: schema.wasteLog },
	{ name: "stockAlert", table: schema.stockAlert },
	// Customers & loyalty
	{ name: "customer", table: schema.customer },
	{ name: "loyaltyProgram", table: schema.loyaltyProgram },
	{ name: "loyaltyTier", table: schema.loyaltyTier },
	{ name: "customerLoyalty", table: schema.customerLoyalty },
	{ name: "loyaltyTransaction", table: schema.loyaltyTransaction },
	{ name: "giftCard", table: schema.giftCard },
	{ name: "giftCardTransaction", table: schema.giftCardTransaction },
	// Cash / operations
	{ name: "fundingSource", table: schema.fundingSource },
	{ name: "expenseCategory", table: schema.expenseCategory },
	{ name: "cashSession", table: schema.cashSession },
	{ name: "cashDrop", table: schema.cashDrop },
	{ name: "cashPayout", table: schema.cashPayout },
	{ name: "cashReconciliationRule", table: schema.cashReconciliationRule },
	{ name: "shiftHandoff", table: schema.shiftHandoff },
	{ name: "expense", table: schema.expense },
	{ name: "noSaleEvent", table: schema.noSaleEvent },
	{ name: "tableLayout", table: schema.tableLayout },
	{ name: "timeEntry", table: schema.timeEntry },
	// Orders
	{ name: "dailyOrderCounter", table: schema.dailyOrderCounter },
	{ name: "order", table: schema.order },
	{ name: "orderLineItem", table: schema.orderLineItem },
	{ name: "payment", table: schema.payment },
	{ name: "refund", table: schema.refund },
	{ name: "kitchenOrderTicket", table: schema.kitchenOrderTicket },
	{ name: "kitchenOrderItem", table: schema.kitchenOrderItem },
	{ name: "productionLog", table: schema.productionLog },
	// Finance
	{ name: "invoiceCounter", table: schema.invoiceCounter },
	{ name: "quotationCounter", table: schema.quotationCounter },
	{ name: "creditNoteCounter", table: schema.creditNoteCounter },
	{ name: "vendorBillCounter", table: schema.vendorBillCounter },
	{ name: "invoiceDocumentSettings", table: schema.invoiceDocumentSettings },
	{ name: "invoice", table: schema.invoice },
	{ name: "quotation", table: schema.quotation },
	{ name: "invoicePayment", table: schema.invoicePayment },
	{ name: "creditNote", table: schema.creditNote },
	{ name: "vendorBill", table: schema.vendorBill },
	{ name: "vendorBillPayment", table: schema.vendorBillPayment },
	{ name: "recurringTemplate", table: schema.recurringTemplate },
	{ name: "budget", table: schema.budget },
	// Notifications / system
	{ name: "notificationSettings", table: schema.notificationSettings },
	{ name: "notificationTemplate", table: schema.notificationTemplate },
	{ name: "notificationLog", table: schema.notificationLog },
	{ name: "webhookEndpoint", table: schema.webhookEndpoint },
	{ name: "webhookDelivery", table: schema.webhookDelivery },
	{ name: "auditLog", table: schema.auditLog },
	{ name: "financeAuditEvent", table: schema.financeAuditEvent },
] as const;

export type BackupFile = {
	filename: string;
	createdAt: string;
	sizeBytes: number;
	rowCounts: Record<string, number>;
	isPreRestore: boolean;
};

export async function listBackups(): Promise<BackupFile[]> {
	await mkdir(BACKUP_DIR, { recursive: true });
	const files = await readdir(BACKUP_DIR);
	const backups: BackupFile[] = [];
	for (const filename of files.filter((f) => f.endsWith(".json.gz")).sort().reverse()) {
		try {
			const filePath = join(BACKUP_DIR, filename);
			const fileStat = await stat(filePath);
			// Read metadata from header only (decompress + parse header)
			const compressed = await readFile(filePath);
			const raw = await gunzipAsync(compressed);
			const { rowCounts } = JSON.parse(raw.toString("utf8")) as {
				rowCounts: Record<string, number>;
			};
			backups.push({
				filename,
				createdAt: fileStat.mtime.toISOString(),
				sizeBytes: fileStat.size,
				rowCounts,
				isPreRestore: filename.startsWith("pre-restore-"),
			});
		} catch {
			// Skip corrupt files
		}
	}
	return backups;
}

export async function createBackup(tag = "scheduled"): Promise<string> {
	await mkdir(BACKUP_DIR, { recursive: true });

	// Export all tables
	const tables: Record<string, unknown[]> = {};
	const rowCounts: Record<string, number> = {};
	for (const { name, table } of EXPORT_TABLES) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const rows = await db.select().from(table as any);
		tables[name] = rows;
		rowCounts[name] = rows.length;
	}

	const payload = JSON.stringify({ version: "1", rowCounts, tables });
	const checksum = `sha256:${createHash("sha256").update(payload).digest("hex")}`;
	const full = JSON.stringify({ version: "1", checksum, rowCounts, tables });

	const compressed = await gzipAsync(Buffer.from(full, "utf8"));
	const now = new Date()
		.toISOString()
		.replace(/:/g, "-")
		.replace(/\..+/, "");
	const filename = `${tag === "pre-restore" ? "pre-restore-" : "bettencourt-pos-backup-"}${now}.json.gz`;
	await writeFile(join(BACKUP_DIR, filename), compressed);

	// Prune old regular backups (keep MAX_BACKUPS), never delete pre-restore files
	if (tag !== "pre-restore") {
		const all = await readdir(BACKUP_DIR);
		const regular = all
			.filter((f) => f.startsWith("bettencourt-pos-backup-") && f.endsWith(".json.gz"))
			.sort();
		const toDelete = regular.slice(0, Math.max(0, regular.length - MAX_BACKUPS));
		for (const f of toDelete) await rm(join(BACKUP_DIR, f));
	}

	return filename;
}

export async function restoreBackup(filePath: string): Promise<void> {
	const compressed = await readFile(filePath);
	const raw = await gunzipAsync(compressed);
	const parsed = JSON.parse(raw.toString("utf8")) as {
		version: string;
		checksum: string;
		tables: Record<string, unknown[]>;
	};

	if (parsed.version !== "1") throw new Error(`Unknown backup version: ${parsed.version}`);

	// Verify checksum
	const { checksum, tables, ...rest } = parsed;
	const payloadForCheck = JSON.stringify({ version: parsed.version, rowCounts: (parsed as Record<string, unknown>).rowCounts, tables });
	const actual = `sha256:${createHash("sha256").update(payloadForCheck).digest("hex")}`;
	if (actual !== checksum) throw new Error("Backup file is corrupt (checksum mismatch)");

	// Auto-snapshot current state before overwriting
	await createBackup("pre-restore");

	// Restore in a transaction: delete all (reverse order) then insert (forward order)
	await db.transaction(async (tx) => {
		// Delete in reverse order to respect FK constraints
		const reversed = [...EXPORT_TABLES].reverse();
		for (const { table } of reversed) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await tx.delete(table as any);
		}
		// Insert in forward order
		for (const { name, table } of EXPORT_TABLES) {
			const rows = tables[name];
			if (!rows || rows.length === 0) continue;
			// Insert in batches of 500 to avoid query size limits
			for (let i = 0; i < rows.length; i += 500) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await tx.insert(table as any).values(rows.slice(i, i + 500) as any);
			}
		}
	});
}

export function startBackupScheduler(): void {
	// Run at midnight Guyana time (UTC-4, so 04:00 UTC)
	cron.schedule(
		"0 4 * * *",
		async () => {
			console.log("[backup] Starting scheduled backup...");
			try {
				const filename = await createBackup("scheduled");
				console.log(`[backup] Scheduled backup complete: ${filename}`);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`[backup] Scheduled backup failed: ${message}`);
				try {
					await sendBackupFailureAlert(message);
				} catch (emailErr) {
					console.error("[backup] Failed to send alert email:", emailErr);
				}
			}
		},
		{ timezone: "UTC" },
	);
	console.log("[backup] Scheduler started — daily at 04:00 UTC (midnight Guyana)");
}
```

**Step 2: Install node-cron**

```bash
cd apps/server && bun add node-cron && bun add -d @types/node-cron
```

**Step 3: Start scheduler in index.ts**

In `apps/server/src/index.ts`, after the imports, add:

```ts
import { startBackupScheduler } from "./backup-engine";
```

Before the `export default { port, fetch }` block, add:

```ts
// Start backup scheduler
startBackupScheduler();
```

**Step 4: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 5: Commit**

```bash
git add apps/server/src/backup-engine.ts apps/server/src/index.ts apps/server/package.json bun.lock
git commit -F /tmp/msg.txt  # "feat: add backup engine with node-cron scheduler"
```

---

### Task 3: Hono Backup Routes

**Files:**
- Create: `apps/server/src/routes/backups.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Create backup routes**

Create `apps/server/src/routes/backups.ts`:

```ts
import { auth } from "@Bettencourt-POS/auth";
import { hasPermission, loadUserPermissions } from "@Bettencourt-POS/api/lib/permissions";
import { join } from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { Hono } from "hono";
import {
	BACKUP_DIR,
	createBackup,
	listBackups,
	restoreBackup,
} from "../backup-engine";

const backupsRouter = new Hono();

// Auth middleware for all backup routes — requires settings.write (admin/executive)
backupsRouter.use("/*", async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) return c.json({ error: "Unauthorized" }, 401);
	const permissions = await loadUserPermissions(session.user.id);
	if (!hasPermission(permissions, "settings.write")) {
		return c.json({ error: "Forbidden" }, 403);
	}
	await next();
});

// GET /api/backups — list backup files
backupsRouter.get("/", async (c) => {
	try {
		const backups = await listBackups();
		return c.json({ backups });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

// POST /api/backups/trigger — manual backup now
backupsRouter.post("/trigger", async (c) => {
	try {
		const filename = await createBackup("manual");
		return c.json({ success: true, filename });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

// GET /api/backups/download/:filename — stream file download
backupsRouter.get("/download/:filename", async (c) => {
	const filename = c.req.param("filename");
	// Prevent path traversal
	if (filename.includes("..") || filename.includes("/")) {
		return c.json({ error: "Invalid filename" }, 400);
	}
	const filePath = join(BACKUP_DIR, filename);
	if (!existsSync(filePath)) return c.json({ error: "File not found" }, 404);

	const stream = createReadStream(filePath);
	return new Response(stream as unknown as ReadableStream, {
		headers: {
			"Content-Type": "application/gzip",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
});

// POST /api/backups/restore — upload + apply a backup file
backupsRouter.post("/restore", async (c) => {
	const formData = await c.req.formData();
	const file = formData.get("file") as File | null;
	if (!file) return c.json({ error: "No file uploaded" }, 400);

	// Write to temp file
	const tmpPath = join(tmpdir(), `restore-${randomUUID()}.json.gz`);
	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(tmpPath, buffer);
		await restoreBackup(tmpPath);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	} finally {
		try { await unlink(tmpPath); } catch { /* ignore */ }
	}
});

export { backupsRouter };
```

**Step 2: Register routes in index.ts**

In `apps/server/src/index.ts`, add import:

```ts
import { backupsRouter } from "./routes/backups";
```

After the `app.post("/api/auth/demo-login", ...)` block and before the RPC handler, add:

```ts
app.route("/api/backups", backupsRouter);
```

**Step 3: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 4: Manual smoke test**

```bash
# Start server in dev mode
cd apps/server && bun run dev

# Trigger manual backup (will fail auth but confirms route exists)
curl -X POST http://localhost:3000/api/backups/trigger
# Expected: {"error":"Unauthorized"}  — routes are live

# List backups
curl http://localhost:3000/api/backups
# Expected: {"error":"Unauthorized"}
```

**Step 5: Commit**

```bash
git add apps/server/src/routes/backups.ts apps/server/src/index.ts
git commit -F /tmp/msg.txt  # "feat: add Hono backup API routes"
```

---

### Task 4: Docker Volume

**Files:**
- Modify: `docker-compose.prod.yml`

**Step 1: Add volume mount**

In `docker-compose.prod.yml`, update the `app` service and add a top-level `volumes` section:

```yaml
services:
  app:
    # ... existing config ...
    volumes:
      - bettencourt-backups:/app/backups

volumes:
  bettencourt-backups:
    name: bettencourt-backups
```

**Step 2: Commit**

```bash
git add docker-compose.prod.yml
git commit -F /tmp/msg.txt  # "feat: add Docker volume for backup persistence"
```

---

### Task 5: Web UI Page

**Files:**
- Create: `apps/web/src/routes/dashboard.backup.tsx`

**Step 1: Create the backup page**

Create `apps/web/src/routes/dashboard.backup.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	CheckCircle,
	Clock,
	Database,
	Download,
	RefreshCw,
	RotateCcw,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type BackupFile = {
	filename: string;
	createdAt: string;
	sizeBytes: number;
	rowCounts: Record<string, number>;
	isPreRestore: boolean;
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString("en-GY", {
		timeZone: "America/Guyana",
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function rowSummary(counts: Record<string, number>): string {
	const top = ["order", "product", "customer", "expense", "invoice"]
		.filter((k) => counts[k] > 0)
		.map((k) => `${counts[k]} ${k}s`)
		.slice(0, 3);
	return top.join(", ") || "empty";
}

async function apiPost(path: string): Promise<{ success?: boolean; filename?: string; error?: string }> {
	const res = await fetch(path, { method: "POST", credentials: "include" });
	return res.json();
}

export default function BackupPage() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
	const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

	const { data, isLoading } = useQuery<{ backups: BackupFile[] }>({
		queryKey: ["backups"],
		queryFn: async () => {
			const res = await fetch("/api/backups", { credentials: "include" });
			return res.json();
		},
		refetchInterval: 30_000,
	});

	const backups = data?.backups ?? [];
	const latest = backups.find((b) => !b.isPreRestore);
	const hoursSinceLast = latest
		? (Date.now() - new Date(latest.createdAt).getTime()) / 3_600_000
		: null;

	const healthDot =
		hoursSinceLast === null
			? "bg-red-500"
			: hoursSinceLast < 25
			? "bg-green-500"
			: hoursSinceLast < 49
			? "bg-yellow-500"
			: "bg-red-500";

	const triggerMutation = useMutation({
		mutationFn: () => apiPost("/api/backups/trigger"),
		onSuccess: (res) => {
			if (res.error) {
				toast({ title: "Backup failed", description: res.error, variant: "destructive" });
			} else {
				toast({ title: "Backup created", description: res.filename });
				queryClient.invalidateQueries({ queryKey: ["backups"] });
			}
		},
	});

	const restoreFromListMutation = useMutation({
		mutationFn: async (filename: string) => {
			const formData = new FormData();
			const res = await fetch(`/api/backups/download/${filename}`, { credentials: "include" });
			const blob = await res.blob();
			formData.append("file", blob, filename);
			const r = await fetch("/api/backups/restore", {
				method: "POST",
				body: formData,
				credentials: "include",
			});
			return r.json();
		},
		onSuccess: (res) => {
			if (res.error) {
				toast({ title: "Restore failed", description: res.error, variant: "destructive" });
			} else {
				toast({ title: "Restore complete", description: "Data restored successfully. Please refresh." });
				queryClient.invalidateQueries({ queryKey: ["backups"] });
			}
		},
	});

	const restoreFromFileMutation = useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append("file", file, file.name);
			const r = await fetch("/api/backups/restore", {
				method: "POST",
				body: formData,
				credentials: "include",
			});
			return r.json();
		},
		onSuccess: (res) => {
			if (res.error) {
				toast({ title: "Restore failed", description: res.error, variant: "destructive" });
			} else {
				toast({ title: "Restore complete", description: "Data restored from uploaded file. Please refresh." });
				queryClient.invalidateQueries({ queryKey: ["backups"] });
				setUploadFile(null);
			}
		},
	});

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Backup & Restore</h1>
				<p className="text-muted-foreground text-sm">
					Manage database backups. Backups run automatically every night at midnight.
				</p>
			</div>

			{/* Status Bar */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Backup Status</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<span className={`inline-block h-3 w-3 rounded-full ${healthDot}`} />
						<div>
							<p className="font-medium text-sm">
								{latest ? `Last backup: ${formatDate(latest.createdAt)}` : "No backups yet"}
							</p>
							<p className="text-muted-foreground text-xs">
								Next scheduled: midnight tonight (Guyana time)
							</p>
						</div>
					</div>
					<Button
						onClick={() => triggerMutation.mutate()}
						disabled={triggerMutation.isPending}
					>
						{triggerMutation.isPending ? (
							<RefreshCw className="mr-2 size-4 animate-spin" />
						) : (
							<Database className="mr-2 size-4" />
						)}
						{triggerMutation.isPending ? "Creating backup..." : "Backup Now"}
					</Button>
				</CardContent>
			</Card>

			{/* Backup History */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Backup History</CardTitle>
					<CardDescription>
						Up to {7} regular backups are kept. Pre-restore snapshots are kept until manually removed.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="space-y-2">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-10 w-full" />
							))}
						</div>
					) : backups.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No backups yet. Click "Backup Now" to create your first backup.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>File</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Size</TableHead>
									<TableHead>Contents</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{backups.map((b) => (
									<TableRow key={b.filename}>
										<TableCell className="font-mono text-xs">
											{b.isPreRestore ? (
												<Badge variant="outline" className="mr-2">pre-restore</Badge>
											) : null}
											{b.filename.replace(/^(bettencourt-pos-backup-|pre-restore-)/, "")}
										</TableCell>
										<TableCell className="text-sm">{formatDate(b.createdAt)}</TableCell>
										<TableCell className="text-sm">{formatBytes(b.sizeBytes)}</TableCell>
										<TableCell className="text-muted-foreground text-xs">{rowSummary(b.rowCounts)}</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button
													variant="ghost"
													size="sm"
													asChild
												>
													<a href={`/api/backups/download/${b.filename}`} download>
														<Download className="mr-1 size-3.5" />
														Download
													</a>
												</Button>
												<AlertDialog
													open={restoreDialogOpen && restoreTarget?.filename === b.filename}
													onOpenChange={(open) => {
														setRestoreDialogOpen(open);
														if (!open) setRestoreTarget(null);
													}}
												>
													<AlertDialogTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => {
																setRestoreTarget(b);
																setRestoreDialogOpen(true);
															}}
														>
															<RotateCcw className="mr-1 size-3.5" />
															Restore
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>Restore this backup?</AlertDialogTitle>
															<AlertDialogDescription className="space-y-2">
																<p>
																	This will <strong>replace all current data</strong> with the
																	backup from {b ? formatDate(b.createdAt) : ""}.
																</p>
																<p className="text-muted-foreground text-xs">
																	Contents: {b ? rowSummary(b.rowCounts) : ""}
																</p>
																<p className="font-medium text-amber-600 text-sm">
																	A pre-restore snapshot of your current data will be saved
																	automatically before the restore begins.
																</p>
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																className="bg-destructive hover:bg-destructive/90"
																onClick={() => {
																	if (restoreTarget) restoreFromListMutation.mutate(restoreTarget.filename);
																	setRestoreDialogOpen(false);
																	setRestoreTarget(null);
																}}
															>
																Yes, Restore
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Restore from File */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Restore from File</CardTitle>
					<CardDescription>
						Upload a previously downloaded <code>.json.gz</code> backup file.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
						<div className="flex gap-2">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
							<p className="text-amber-800 text-sm dark:text-amber-200">
								Restoring will overwrite all current data. A pre-restore snapshot is created
								automatically, but ensure you have a recent backup before proceeding.
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						<Input
							ref={fileInputRef}
							type="file"
							accept=".json.gz"
							className="max-w-sm"
							onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
						/>
						<AlertDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
							<AlertDialogTrigger asChild>
								<Button
									disabled={!uploadFile || restoreFromFileMutation.isPending}
									onClick={() => setUploadDialogOpen(true)}
								>
									{restoreFromFileMutation.isPending ? (
										<RefreshCw className="mr-2 size-4 animate-spin" />
									) : (
										<Upload className="mr-2 size-4" />
									)}
									Restore from File
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Restore from uploaded file?</AlertDialogTitle>
									<AlertDialogDescription>
										This will <strong>replace all current data</strong> with the contents of{" "}
										<code>{uploadFile?.name}</code>. A pre-restore snapshot will be saved first.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										className="bg-destructive hover:bg-destructive/90"
										onClick={() => {
											if (uploadFile) restoreFromFileMutation.mutate(uploadFile);
											setUploadDialogOpen(false);
										}}
									>
										Yes, Restore
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
```

**Step 2: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 3: Biome check**

```bash
bun run lint
```
Fix any errors before committing.

**Step 4: Commit**

```bash
git add apps/web/src/routes/dashboard.backup.tsx
git commit -F /tmp/msg.txt  # "feat: add Backup & Restore UI page"
```

---

### Task 6: Sidebar + Routing

**Files:**
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`
- Modify: `apps/web/src/routes/dashboard.tsx`

**Step 1: Add Backup to sidebar System group**

In `apps/web/src/components/layout/app-sidebar.tsx`, import `HardDrive` from lucide-react (add to imports block), then add to `systemNavItems`:

```ts
{
  title: "Backup & Restore",
  url: "/dashboard/backup",
  icon: HardDrive,
  module: "settings",
  roles: ["executive", "admin"],
},
```

**Step 2: Add to PAGE_TITLES and ROUTE_MODULE_MAP in dashboard.tsx**

In `apps/web/src/routes/dashboard.tsx`, add to `PAGE_TITLES`:

```ts
"/dashboard/backup": "Backup & Restore",
```

Add to `ROUTE_MODULE_MAP` in `apps/web/src/lib/route-access.ts`:

```ts
"/dashboard/backup": "settings",
```

**Step 3: TypeScript check**

```bash
bun run check-types
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add apps/web/src/components/layout/app-sidebar.tsx apps/web/src/routes/dashboard.tsx apps/web/src/lib/route-access.ts
git commit -F /tmp/msg.txt  # "feat: add Backup & Restore to sidebar and routing"
```

---

### Task 7: Tests, Docs, Docker Rebuild, Push

**Step 1: Write Bun tests for backup engine**

Create `apps/server/src/__tests__/backup-engine.test.ts`:

```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Override BACKUP_DIR for tests
const TEST_BACKUP_DIR = join(tmpdir(), `backup-test-${Date.now()}`);
process.env.BACKUP_DIR = TEST_BACKUP_DIR;

import { listBackups, BACKUP_DIR } from "../backup-engine";

describe("listBackups", () => {
	beforeEach(async () => {
		await mkdir(TEST_BACKUP_DIR, { recursive: true });
	});
	afterEach(async () => {
		await rm(TEST_BACKUP_DIR, { recursive: true, force: true });
	});

	test("returns empty array when no backups exist", async () => {
		const result = await listBackups();
		expect(result).toEqual([]);
	});

	test("BACKUP_DIR is set from env", () => {
		expect(BACKUP_DIR).toBe(TEST_BACKUP_DIR);
	});
});
```

**Step 2: Run tests**

```bash
cd packages/api && bun test src/__tests__/backup-engine.test.ts
```

Note: Full integration tests (createBackup/restoreBackup) require a live DB — run manually in development.

**Step 3: Update USER-MANUAL.md**

Add a "Backup & Restore" section to `docs/USER-MANUAL.md`:

```markdown
## Backup & Restore

The system automatically backs up all data every night at midnight. Up to 7 days of backups are stored.

### Download a Backup
Go to **Settings → Backup & Restore** → click **Download** next to any backup.

### Restore from a Backup
1. Go to **Settings → Backup & Restore**
2. Click **Restore** next to the backup you want
3. Confirm the warning dialog — a pre-restore snapshot is saved automatically
4. Refresh the page after restore completes

### Restore from a File
Upload a previously downloaded `.json.gz` backup file using the "Restore from File" section.

### Backup Now
Click **Backup Now** to create an immediate backup outside the scheduled time.

### Email Alerts
If a scheduled backup fails, an alert email is sent to the configured SMTP address. Configure SMTP via environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_ALERT_TO`.
```

**Step 4: Full TypeScript + build check**

```bash
bun run check-types && bun run build
```
Expected: 0 errors, 3 tasks successful.

**Step 5: Docker rebuild**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Expected: `Container kt-bettencourt-pos Started`

**Step 6: Smoke test live**

```bash
# Confirm container is healthy
docker ps | grep kt-bettencourt-pos
# Open https://pos.karetechsolutions.com/dashboard/backup in browser
# Click "Backup Now" — should create backup and show it in the list
# Click Download — should download the .json.gz file
```

**Step 7: Final commit + push**

```bash
git add apps/server/src/__tests__/backup-engine.test.ts docs/USER-MANUAL.md
git commit -F /tmp/msg.txt  # "feat: Plan 13 Backup & Restore — complete"
git push origin master
```

---

## Enhancements Already Included
- Auto pre-restore snapshot before every restore (safety net)
- SHA-256 checksum verification on restore
- Row count summary in backup header + UI
- Colour-coded health indicator (green/yellow/red)
- Path traversal protection on download endpoint
- Batch inserts (500 rows) to avoid query size limits
- Graceful SMTP skip when not configured
