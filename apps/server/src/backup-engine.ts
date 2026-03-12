import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { env } from "@Bettencourt-POS/env/server";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import cron from "node-cron";
import {
	sendBackupFailureAlert,
	sendDailyDigest,
	sendOverdueReminder,
} from "./email";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const BACKUP_DIR = process.env.BACKUP_DIR ?? "/app/backups";
const MAX_BACKUPS = 7;

// All tables to export, in insertion order (parents before children).
// Skipped: session, verification, pinLoginRateLimit (transient auth state).
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
	{ name: "registerDepartment", table: schema.registerDepartment },
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
	{
		name: "productProductionComponent",
		table: schema.productProductionComponent,
	},
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
	for (const filename of files
		.filter((f) => f.endsWith(".json.gz"))
		.sort()
		.reverse()) {
		try {
			const filePath = join(BACKUP_DIR, filename);
			const fileStat = await stat(filePath);
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
			// Skip corrupt or unreadable files
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
		// biome-ignore lint/suspicious/noExplicitAny: dynamic table iteration
		const rows = await db.select().from(table as any);
		tables[name] = rows;
		rowCounts[name] = rows.length;
	}

	const payload = JSON.stringify({ version: "1", rowCounts, tables });
	const checksum = `sha256:${createHash("sha256").update(payload).digest("hex")}`;
	const full = JSON.stringify({ version: "1", checksum, rowCounts, tables });

	const compressed = await gzipAsync(Buffer.from(full, "utf8"));
	const now = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
	const prefix =
		tag === "pre-restore" ? "pre-restore-" : "bettencourt-pos-backup-";
	const filename = `${prefix}${now}.json.gz`;
	await writeFile(join(BACKUP_DIR, filename), compressed);

	// Prune old regular backups (keep MAX_BACKUPS); never delete pre-restore snapshots
	if (tag !== "pre-restore") {
		const all = await readdir(BACKUP_DIR);
		const regular = all
			.filter(
				(f) =>
					f.startsWith("bettencourt-pos-backup-") && f.endsWith(".json.gz"),
			)
			.sort();
		const toDelete = regular.slice(
			0,
			Math.max(0, regular.length - MAX_BACKUPS),
		);
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
		rowCounts: Record<string, number>;
		tables: Record<string, unknown[]>;
	};

	if (parsed.version !== "1")
		throw new Error(`Unknown backup version: ${parsed.version}`);

	// Verify checksum
	const payloadForCheck = JSON.stringify({
		version: parsed.version,
		rowCounts: parsed.rowCounts,
		tables: parsed.tables,
	});
	const actual = `sha256:${createHash("sha256").update(payloadForCheck).digest("hex")}`;
	if (actual !== parsed.checksum)
		throw new Error("Backup file is corrupt (checksum mismatch)");

	// Auto-snapshot current state before overwriting
	await createBackup("pre-restore");

	// Restore in a transaction: delete all (reverse order) then insert (forward order)
	await db.transaction(async (tx) => {
		const reversed = [...EXPORT_TABLES].reverse();
		for (const { table } of reversed) {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic table iteration
			await tx.delete(table as any);
		}
		for (const { name, table } of EXPORT_TABLES) {
			const rows = parsed.tables[name];
			if (!rows || rows.length === 0) continue;
			// Insert in batches of 500 to avoid query size limits
			for (let i = 0; i < rows.length; i += 500) {
				// biome-ignore lint/suspicious/noExplicitAny: dynamic table iteration
				await tx.insert(table as any).values(rows.slice(i, i + 500) as any);
			}
		}
	});
}

export function startBackupScheduler(): void {
	// Run at 04:00 UTC = midnight Guyana time (UTC-4)
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
	// Daily digest email — 04:30 UTC (after backup)
	cron.schedule(
		"30 4 * * *",
		async () => {
			const to = env.SMTP_DIGEST_TO ?? env.SMTP_ALERT_TO;
			if (!to) {
				console.log("[digest] No SMTP_DIGEST_TO configured — skipping");
				return;
			}
			try {
				const today = new Date().toLocaleDateString("en-CA", {
					timeZone: "America/Guyana",
				});

				const [revenueRes, expensesRes, invoicesRes, stockRes, topRes] =
					await Promise.all([
						db.execute(sql`
              SELECT COALESCE(SUM(total),0)::text as revenue, COUNT(*)::int as order_count
              FROM "order"
              WHERE status IN ('completed','closed')
                AND DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`),
						db.execute(sql`
              SELECT COALESCE(SUM(amount),0)::text as total
              FROM expense
              WHERE DATE(created_at AT TIME ZONE 'America/Guyana') = ${today}`),
						db.execute(sql`
              SELECT COUNT(*)::int as cnt, COALESCE(SUM(total - amount_paid),0)::text as outstanding
              FROM invoice
              WHERE status IN ('sent','partial')`),
						db.execute(sql`
              SELECT COUNT(*)::int as cnt FROM stock_alert
              WHERE acknowledged = false AND alert_type IN ('low_stock','out_of_stock')`),
						db.execute(sql`
              SELECT oli.product_name_snapshot as name, SUM(oli.quantity)::int as qty
              FROM order_line_item oli
              JOIN "order" o ON o.id = oli.order_id
              WHERE o.status IN ('completed','closed')
                AND DATE(o.created_at AT TIME ZONE 'America/Guyana') = ${today}
                AND oli.voided = false
              GROUP BY oli.product_name_snapshot
              ORDER BY qty DESC LIMIT 5`),
					]);

				const rev = revenueRes.rows[0] as {
					revenue: string;
					order_count: number;
				};
				const exp = expensesRes.rows[0] as { total: string };
				const inv = invoicesRes.rows[0] as {
					cnt: number;
					outstanding: string;
				};
				const stk = stockRes.rows[0] as { cnt: number };

				await sendDailyDigest(
					{
						date: today,
						revenue: rev.revenue,
						orderCount: rev.order_count,
						expensesTotal: exp.total,
						openInvoicesCount: inv.cnt,
						openInvoicesTotal: inv.outstanding,
						stockAlertCount: stk.cnt,
						topProducts: topRes.rows as Array<{ name: string; qty: number }>,
					},
					to,
				);

				console.log(`[digest] Daily digest sent to ${to}`);
			} catch (err) {
				console.error("[digest] Failed to send daily digest:", err);
			}
		},
		{ timezone: "UTC" },
	);

	// Overdue invoice reminders — 05:00 UTC
	cron.schedule(
		"0 5 * * *",
		async () => {
			try {
				const intervalDays = env.REMINDER_INTERVAL_DAYS ?? 7;
				const cutoff = new Date();
				cutoff.setDate(cutoff.getDate() - intervalDays);

				const overdueRows = await db.execute(sql`
          SELECT
            i.id,
            i.invoice_number as "invoiceNumber",
            i.customer_name as "customerName",
            i.due_date as "dueDate",
            (i.total - i.amount_paid)::text as "amountOutstanding",
            c.email as "customerEmail"
          FROM invoice i
          LEFT JOIN customer c ON c.id = i.customer_id
          WHERE i.status IN ('sent', 'partial')
            AND i.due_date < NOW()
            AND c.email IS NOT NULL
            AND (i.last_reminder_sent_at IS NULL OR i.last_reminder_sent_at < ${cutoff.toISOString()})
        `);

				const orgRows = await db.execute(
					sql`SELECT name FROM organization LIMIT 1`,
				);
				const orgName =
					(orgRows.rows[0] as { name: string })?.name ?? "Bettencourt's";

				let sent = 0;
				for (const row of overdueRows.rows as Array<{
					id: string;
					invoiceNumber: string;
					customerName: string;
					dueDate: string;
					amountOutstanding: string;
					customerEmail: string;
				}>) {
					try {
						await sendOverdueReminder({
							to: row.customerEmail,
							customerName: row.customerName,
							invoiceNumber: row.invoiceNumber,
							dueDate: new Date(row.dueDate).toLocaleDateString("en-GY"),
							amountOutstanding: row.amountOutstanding,
							organizationName: orgName,
						});
						await db.execute(
							sql`UPDATE invoice SET last_reminder_sent_at = NOW() WHERE id = ${row.id}`,
						);
						sent++;
					} catch (e) {
						console.error(
							`[reminders] Failed to send reminder for invoice ${row.invoiceNumber}:`,
							e,
						);
					}
				}
				console.log(`[reminders] Sent ${sent} overdue reminder(s)`);
			} catch (err) {
				console.error("[reminders] Overdue reminder job failed:", err);
			}
		},
		{ timezone: "UTC" },
	);

	console.log(
		"[backup] Scheduler started — daily at 04:00 UTC (midnight Guyana)",
	);
}
