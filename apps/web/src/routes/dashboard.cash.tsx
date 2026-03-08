import { useQuery } from "@tanstack/react-query";
import { CashControlPanel } from "@/components/cash/cash-control-panel";
import { orpc } from "@/utils/orpc";
import { useLocationContext } from "./dashboard";

export default function CashPage() {
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
	const resolvedLocationId = locationId ?? "";

	return (
		<div className="p-4 md:p-6">
			<CashControlPanel
				sessions={allSessions}
				openSession={openSession}
				locationId={resolvedLocationId}
			/>
		</div>
	);
}
