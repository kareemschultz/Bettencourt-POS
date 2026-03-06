import { env } from "@Bettencourt-POS/env/web";
import {
	adminClient,
	multiSessionClient,
	organizationClient,
	twoFactorClient,
	usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL,
	plugins: [
		organizationClient(),
		twoFactorClient(),
		multiSessionClient(),
		adminClient(),
		usernameClient(),
	],
});

export const signOut = authClient.signOut;
