import { useQuery } from "@tanstack/react-query";
import { POSTerminal } from "@/components/pos/pos-terminal";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { useLocationContext } from "./dashboard";

export default function PosPage() {
	const { data: session } = authClient.useSession();
	const { locationId } = useLocationContext();

	const { data: userProfile } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);

	const permissions = userProfile?.permissions ?? {};

	return (
		<POSTerminal
			userName={session?.user?.name || "Cashier"}
			locationId={locationId}
			userPermissions={permissions}
		/>
	);
}
