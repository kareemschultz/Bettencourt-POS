// Env vars store the PEM files as base64 to avoid multiline issues in
// Docker Compose env_file handling (which doesn't expand \n escapes).
import { env } from "@Bettencourt-POS/env/server";
import { createSign } from "node:crypto";
import { Hono } from "hono";

function decodePem(b64: string | undefined): string {
	if (!b64) return "";
	try {
		return Buffer.from(b64, "base64").toString("utf8");
	} catch {
		return "";
	}
}

export const qzRouter = new Hono();

qzRouter.get("/api/qz/certificate", (c) => {
	return c.text(decodePem(env.QZ_TRAY_CERT));
});

qzRouter.get("/api/qz/sign", (c) => {
	const request = c.req.query("request");
	if (!request || !env.QZ_TRAY_PRIVATE_KEY) return c.text("", 200);
	try {
		const sign = createSign("SHA512");
		sign.update(request);
		return c.text(sign.sign(decodePem(env.QZ_TRAY_PRIVATE_KEY), "base64"));
	} catch {
		return c.text("", 200);
	}
});

qzRouter.get("/api/qz/override.crt", (c) => {
	c.header("Content-Disposition", 'attachment; filename="override.crt"');
	c.header("Content-Type", "application/x-pem-file");
	return c.text(decodePem(env.QZ_TRAY_CERT));
});
