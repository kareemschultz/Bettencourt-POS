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

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	trustedOrigins: [env.CORS_ORIGIN],
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
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
