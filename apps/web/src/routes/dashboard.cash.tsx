import { useQuery } from "@tanstack/react-query";
import { CashControlPanel } from "@/components/cash/cash-control-panel";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { useLocationContext } from "./dashboard";

export default function CashPage() {
	const { data: session } = authClient.useSession();
	const { locationId } = useLocationContext();

	const { data: sessions, isLoading } = useQuery(
		orpc.cash.getSessions.queryOptions({ input: {} }),
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20 text-muted-foreground">
				Loading cash control...
			</div>
		);
	}

	const allSessions = sessions || [];
	const openSession = allSessions.find((s) => s.status === "open") || null;

	return (
		<div className="p-4 md:p-6">
			<CashControlPanel
				sessions={allSessions}
				openSession={openSession}
				userId={session?.user?.id || ""}
				locationId={locationId ?? "b0000000-0000-4000-8000-000000000001"}
			/>
		</div>
	);
}
