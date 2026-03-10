import {
	hasPermission,
	loadUserPermissions,
} from "@Bettencourt-POS/api/lib/permissions";
import { auth } from "@Bettencourt-POS/auth";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import {
	BACKUP_DIR,
	createBackup,
	listBackups,
	restoreBackup,
} from "../backup-engine";

const backupsRouter = new Hono();

// Auth guard — all backup routes require settings.write (admin / executive only)
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

// POST /api/backups/trigger — run a backup immediately
backupsRouter.post("/trigger", async (c) => {
	try {
		const filename = await createBackup("manual");
		return c.json({ success: true, filename });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

// GET /api/backups/download/:filename — stream a backup file
backupsRouter.get("/download/:filename", async (c) => {
	const filename = c.req.param("filename");
	// Prevent path traversal
	if (filename.includes("..") || filename.includes("/")) {
		return c.json({ error: "Invalid filename" }, 400);
	}
	const filePath = join(BACKUP_DIR, filename);
	if (!existsSync(filePath)) return c.json({ error: "File not found" }, 404);

	const file = Bun.file(filePath);
	return new Response(file, {
		headers: {
			"Content-Type": "application/gzip",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
});

// POST /api/backups/restore — upload a .json.gz file and apply it
backupsRouter.post("/restore", async (c) => {
	const formData = await c.req.formData();
	const file = formData.get("file") as File | null;
	if (!file) return c.json({ error: "No file uploaded" }, 400);

	const tmpPath = join(tmpdir(), `restore-${randomUUID()}.json.gz`);
	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(tmpPath, buffer);
		await restoreBackup(tmpPath);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	} finally {
		try {
			await unlink(tmpPath);
		} catch {
			// ignore cleanup errors
		}
	}
});

export { backupsRouter };
