import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ChefHat, Clock, Wifi } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/utils/orpc";

function getTimeSince(date: string | Date) {
	const diff = Date.now() - new Date(date).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

const statusConfig: Record<
	string,
	{ color: string; icon: React.ReactNode; label: string }
> = {
	pending: {
		color: "bg-amber-500/10 text-amber-600 border-amber-200",
		icon: <Clock className="h-4 w-4" />,
		label: "Pending",
	},
	preparing: {
		color: "bg-sky-500/10 text-sky-600 border-sky-200",
		icon: <ChefHat className="h-4 w-4" />,
		label: "Preparing",
	},
	ready: {
		color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
		icon: <CheckCircle2 className="h-4 w-4" />,
		label: "Ready",
	},
};

function useKitchenSSE() {
	const queryClient = useQueryClient();
	const queryKey = orpc.kitchen.getActiveTickets.queryOptions({
		input: {},
	}).queryKey;

	useEffect(() => {
		const es = new EventSource("/api/kitchen/events");

		es.onmessage = () => {
			// Any kitchen event → invalidate to re-fetch fresh data
			queryClient.invalidateQueries({ queryKey });
		};

		es.onerror = () => {
			// EventSource auto-reconnects; no action needed
		};

		return () => es.close();
	}, [queryClient, queryKey]);
}

export default function KitchenPage() {
	const queryClient = useQueryClient();

	const { data: orders = [], isLoading } = useQuery({
		...orpc.kitchen.getActiveTickets.queryOptions({ input: {} }),
		// Fallback polling in case SSE disconnects
		refetchInterval: 15000,
	});

	// Subscribe to SSE for instant updates
	useKitchenSSE();

	const updateStatus = useMutation(
		orpc.kitchen.updateItemStatus.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.kitchen.getActiveTickets.queryOptions({ input: {} })
						.queryKey,
				});
			},
			onError: (err) => toast.error(err.message || "Failed to update status"),
		}),
	);

	const pending = orders.filter((o) => o.status === "pending");
	const preparing = orders.filter((o) => o.status === "preparing");
	const ready = orders.filter((o) => o.status === "ready");

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-foreground text-xl tracking-tight sm:text-2xl">
						Kitchen Display
					</h1>
					<p className="flex items-center gap-1.5 text-muted-foreground text-sm">
						<Wifi className="size-3.5 text-emerald-500" /> Live updates via SSE
					</p>
				</div>
				<div
					className="flex flex-wrap items-center gap-2"
					aria-live="polite"
					aria-atomic="true"
				>
					<Badge
						variant="outline"
						className="gap-1 border-amber-200 bg-amber-500/10 text-amber-600"
					>
						<Clock className="h-3 w-3" /> {pending.length} Pending
					</Badge>
					<Badge
						variant="outline"
						className="gap-1 border-sky-200 bg-sky-500/10 text-sky-600"
					>
						<ChefHat className="h-3 w-3" /> {preparing.length} Preparing
					</Badge>
					<Badge
						variant="outline"
						className="gap-1 border-emerald-200 bg-emerald-500/10 text-emerald-600"
					>
						<CheckCircle2 className="h-3 w-3" /> {ready.length} Ready
					</Badge>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-20 text-muted-foreground">
					Loading kitchen orders...
				</div>
			) : orders.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 py-20">
					<ChefHat className="h-12 w-12 text-muted-foreground/50" />
					<p className="text-muted-foreground">No active kitchen orders</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{orders.map((order) => {
						const config = statusConfig[order.status] || statusConfig.pending;
						const items = order.items || [];
						const timeSince = getTimeSince(order.createdAt);
						const isUrgent =
							Date.now() - new Date(order.createdAt).getTime() > 15 * 60 * 1000;

						return (
							<Card
								key={order.id}
								className={`flex flex-col ${isUrgent ? "ring-2 ring-destructive" : ""}`}
							>
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="font-semibold text-base text-foreground">
											#{order.orderNumber}
										</CardTitle>
										<Badge
											variant="outline"
											className={`gap-1 ${config.color}`}
										>
											{config.icon} {config.label}
										</Badge>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
										<Clock className="h-3 w-3" />
										{timeSince}
										{order.tableName && (
											<Badge variant="secondary" className="text-xs">
												{order.tableName}
											</Badge>
										)}
										{order.orderType === "pickup" && (
											<Badge className="bg-blue-600 text-[10px] text-white">
												PICKUP
											</Badge>
										)}
										{order.orderType === "delivery" && (
											<Badge className="bg-orange-600 text-[10px] text-white">
												DELIVERY
											</Badge>
										)}
										{isUrgent && (
											<AlertCircle className="h-3 w-3 text-destructive" />
										)}
									</div>
								</CardHeader>
								<CardContent className="flex-1 pb-3">
									<ul className="flex flex-col gap-1.5">
										{items.map((item) => (
											<li key={item.id} className="text-sm">
												<div className="flex items-center justify-between">
													<span
														className={`text-foreground ${item.status === "done" ? "text-muted-foreground line-through" : ""}`}
													>
														{item.productName}
													</span>
													<span className="font-mono text-muted-foreground">
														x{item.quantity}
													</span>
												</div>
												{item.modifiers &&
													(() => {
														try {
															const mods = JSON.parse(item.modifiers) as Array<{
																name: string;
																price: number;
																isComponent?: boolean;
															}>;
															const components = mods.filter(
																(m) => m.isComponent,
															);
															const regular = mods.filter(
																(m) => !m.isComponent,
															);
															return (
																<>
																	{components.length > 0 && (
																		<ul className="mt-0.5 flex flex-col gap-0">
																			{components.map((c) => (
																				<li
																					key={c.name}
																					className="text-muted-foreground text-xs"
																				>
																					· {c.name}
																				</li>
																			))}
																		</ul>
																	)}
																	{regular.length > 0 && (
																		<p className="mt-0.5 text-sky-600 text-xs dark:text-sky-400">
																			{regular.map((m) => m.name).join(", ")}
																		</p>
																	)}
																</>
															);
														} catch {
															return null;
														}
													})()}
												{item.notes && (
													<p className="mt-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
														{item.notes}
													</p>
												)}
											</li>
										))}
										{items.length === 0 && (
											<li className="text-muted-foreground text-sm">
												No items
											</li>
										)}
									</ul>
								</CardContent>
								<CardFooter className="pt-0">
									{order.status === "pending" && (
										<Button
											className="w-full"
											size="sm"
											onClick={() =>
												updateStatus.mutate({
													id: order.id,
													status: "preparing",
												})
											}
										>
											Start Preparing
										</Button>
									)}
									{order.status === "preparing" && (
										<Button
											className="w-full"
											size="sm"
											variant="outline"
											onClick={() =>
												updateStatus.mutate({ id: order.id, status: "ready" })
											}
										>
											Mark Ready
										</Button>
									)}
									{order.status === "ready" && (
										<Button
											className="w-full"
											size="sm"
											variant="secondary"
											onClick={() =>
												updateStatus.mutate({ id: order.id, status: "served" })
											}
										>
											Mark Served
										</Button>
									)}
								</CardFooter>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
