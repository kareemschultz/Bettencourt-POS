import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { KdsHeader } from "@/components/kds/kds-header";
import { KdsOrderCard } from "@/components/kds/kds-order-card";
import { useWebSocket } from "@/hooks/use-websocket";
import { orpc } from "@/utils/orpc";

export default function KdsRoute() {
	const [station, setStation] = useState("all");
	const qc = useQueryClient();
	const queryKey = orpc.kitchen.getActiveTickets.queryOptions({ input: {} }).queryKey;
	const { data: orders = [] } = useQuery({
		...orpc.kitchen.getActiveTickets.queryOptions({ input: {} }),
		refetchInterval: 15000,
	});

	useWebSocket({
		channels: ["pos:kds"],
		onMessage: () => qc.invalidateQueries({ queryKey }),
	});

	const bumpItem = useMutation(
		orpc.kitchen.updateItemStatus.mutationOptions({
			onSuccess: () => qc.invalidateQueries({ queryKey }),
		}),
	);

	const fireCourse = useMutation(
		orpc.kitchen.fireCourse.mutationOptions({
			onSuccess: () => qc.invalidateQueries({ queryKey }),
		}),
	);

	const filtered = useMemo(() => {
		if (station === "all") return orders;
		return orders.filter((o) => (o.printerTarget ?? "kitchen").toLowerCase().includes(station));
	}, [orders, station]);

	const counts = {
		pending: filtered.filter((o) => o.status === "pending").length,
		preparing: filtered.filter((o) => o.status === "preparing").length,
		ready: filtered.filter((o) => o.status === "ready").length,
	};

	return (
		<div className="h-screen overflow-hidden bg-muted/20">
			<KdsHeader station={station} onStationChange={setStation} counts={counts} />
			<div className="h-[calc(100vh-64px)] overflow-auto p-3">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
					{filtered.map((order) => (
						<KdsOrderCard
							key={order.id}
							order={order}
							onBumpItem={(itemId) =>
								bumpItem.mutate({ itemId, itemStatus: "done" })
							}
							onFireCourse={(ticketId, courseNumber) =>
								fireCourse.mutate({ ticketId, courseNumber })
							}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
