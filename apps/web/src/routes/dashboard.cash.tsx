import { useQuery } from "@tanstack/react-query";
import { CashControlPanel } from "@/components/cash/cash-control-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";
import { useLocationContext } from "./dashboard";

export default function CashPage() {
	const { locationId } = useLocationContext();

	const { data: sessions, isLoading } = useQuery(
		orpc.cash.getSessions.queryOptions({ input: {} }),
	);

	if (isLoading) {
		return (
			<div className="space-y-4 p-4 md:p-6">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-64 w-full" />
				<Skeleton className="h-64 w-full" />
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
