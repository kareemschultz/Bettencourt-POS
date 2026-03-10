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
