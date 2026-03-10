import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		SECRET_ENCRYPTION_KEY: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		PORT: z.coerce.number().default(3000),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		SMTP_HOST: z.string().optional(),
		SMTP_PORT: z.coerce.number().optional().default(587),
		SMTP_USER: z.string().optional(),
		SMTP_PASS: z.string().optional(),
		SMTP_FROM: z.string().optional().default("noreply@bettencourt-pos.com"),
		SMTP_ALERT_TO: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
