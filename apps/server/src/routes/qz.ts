import { env } from "@Bettencourt-POS/env/server";
import { createSign } from "node:crypto";
import { Hono } from "hono";

export const qzRouter = new Hono();

qzRouter.get("/api/qz/certificate", (c) => {
	return c.text(env.QZ_TRAY_CERT ?? "");
});

qzRouter.get("/api/qz/sign", (c) => {
	const request = c.req.query("request");
	if (!request || !env.QZ_TRAY_PRIVATE_KEY) return c.text("", 200);
	try {
		const sign = createSign("SHA512");
		sign.update(request);
		return c.text(sign.sign(env.QZ_TRAY_PRIVATE_KEY, "base64"));
	} catch {
		return c.text("", 200);
	}
});
