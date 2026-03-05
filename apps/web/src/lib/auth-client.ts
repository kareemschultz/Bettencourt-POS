import { env } from "@Bettencourt-POS/env/web";
import { createAuthClient } from "better-auth/react";
import {
	organizationClient,
	twoFactorClient,
	multiSessionClient,
	adminClient,
	usernameClient,
} from "better-auth/client/plugins";

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
