import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema/auth";
import { env } from "@Bettencourt-POS/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { multiSession } from "better-auth/plugins/multi-session";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { username } from "better-auth/plugins/username";
import nodemailer from "nodemailer";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	trustedOrigins: [env.CORS_ORIGIN],
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		sendResetPassword: async ({ user, url }) => {
			if (!env.SMTP_HOST) {
				console.warn(
					"[auth] SMTP not configured — skipping reset email for",
					user.email,
				);
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
				to: user.email,
				subject: "Reset your Bettencourt POS password",
				text: `Reset your password: ${url}\n\nExpires in 1 hour. If you did not request this, ignore this email.`,
				html: `<p>Click to reset your password (expires in 1 hour):</p><p><a href="${url}">${url}</a></p><p>If you did not request a password reset, ignore this email.</p>`,
			});
		},
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true,
		},
	},
	plugins: [
		organization({
			disableOrganizationDeletion: true,
		}),
		twoFactor({
			issuer: "Bettencourt POS",
		}),
		multiSession({
			maximumSessions: 3,
		}),
		admin(),
		username(),
	],
});
