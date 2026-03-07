import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Ban,
	Banknote,
	ChevronDown,
	ChevronRight,
	Clock,
	CreditCard,
	Filter,
	RotateCcw,
	Search,
	ShoppingBag,
	Truck,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface Order {
	id: string;
	order_number: string;
	status: string;
	order_type: string;
	total: number;
	created_at: string;
	user_name?: string;
	customer_name?: string;
	customer_phone?: string;
	delivery_address?: string;
	fulfillment_status?: string;
}

const statusVariant: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	completed: "default",
	open: "secondary",
	voided: "destructive",
	refunded: "outline",
	held: "outline",
	closed: "default",
};

const fulfillmentColors: Record<string, string> = {
	preparing:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	ready:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
	picked_up: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	delivered: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

function OrderDetailPanel({ orderId }: { orderId: string }) {
	const { data, isLoading } = useQuery(
		orpc.orders.getById.queryOptions({ input: { id: orderId } }),
	);

	if (isLoading)
		return (
			<div className="px-6 py-4 text-muted-foreground text-sm">
				Loading order details...
			</div>
		);
	if (!data)
		return (
			<div className="px-6 py-4 text-destructive text-sm">
				Failed to load details
			</div>
		);

	const lineItems = data.lineItems || [];
	const payments = data.payments || [];

	return (
		<div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
			{/* Line Items */}
			<div>
				<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Items
				</p>
				<div className="rounded-md border border-border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="h-8 text-xs">Product</TableHead>
								<TableHead className="h-8 text-right text-xs">Qty</TableHead>
								<TableHead className="h-8 text-right text-xs">Price</TableHead>
								<TableHead className="h-8 text-right text-xs">Total</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{lineItems.map((item, i: number) => (
								<TableRow key={i}>
									<TableCell className="py-1.5 text-xs">
										<span className="font-medium">
											{item.productNameSnapshot}
										</span>
										{item.notes && (
											<span className="block text-[10px] text-muted-foreground italic">
												{item.notes}
											</span>
										)}
									</TableCell>
									<TableCell className="py-1.5 text-right text-xs">
										{item.quantity}
									</TableCell>
									<TableCell className="py-1.5 text-right font-mono text-xs">
										{formatGYD(Number(item.unitPrice))}
									</TableCell>
									<TableCell className="py-1.5 text-right font-mono text-xs">
										{formatGYD(Number(item.total))}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Payments + Summary */}
			<div>
				<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Payments
				</p>
				<div className="flex flex-col gap-2">
					{payments.map((p, i: number) => (
						<div
							key={i}
							className="flex items-center justify-between rounded-md border border-border px-3 py-2"
						>
							<div className="flex items-center gap-2 text-sm">
								{p.method === "cash" ? (
									<Banknote className="size-3.5 text-green-600" />
								) : (
									<CreditCard className="size-3.5 text-blue-600" />
								)}
								<span className="font-medium capitalize">{p.method}</span>
								{p.status === "voided" && (
									<Badge variant="destructive" className="text-[10px]">
										Voided
									</Badge>
								)}
							</div>
							<span className="font-mono text-sm">
								{formatGYD(Number(p.amount))}
							</span>
						</div>
					))}
				</div>
				<div className="mt-3 rounded-md bg-muted/50 p-3">
					<div className="flex justify-between text-muted-foreground text-xs">
						<span>Subtotal</span>
						<span className="font-mono">
							{formatGYD(Number(data.subtotal || 0))}
						</span>
					</div>
					{Number(data.taxTotal || 0) > 0 && (
						<div className="flex justify-between text-muted-foreground text-xs">
							<span>Tax</span>
							<span className="font-mono">
								{formatGYD(Number(data.taxTotal))}
							</span>
						</div>
					)}
					{Number(data.discountTotal || 0) > 0 && (
						<div className="flex justify-between text-destructive text-xs">
							<span>Discount</span>
							<span className="font-mono">
								-{formatGYD(Number(data.discountTotal))}
							</span>
						</div>
					)}
					<div className="mt-1 flex justify-between border-border border-t pt-1 font-bold text-sm">
						<span>Total</span>
						<span className="font-mono">{formatGYD(Number(data.total))}</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export function OrdersTable({
	orders: initialOrders,
	userId,
	userRole,
	search = "",
	onSearchChange,
	statusFilter = "all",
	onStatusFilterChange,
	dateFrom = "",
	onDateFromChange,
	dateTo = "",
	onDateToChange,
}: {
	orders: Order[];
	userId?: string;
	userRole?: string;
	search?: string;
	onSearchChange?: (v: string) => void;
	statusFilter?: string;
	onStatusFilterChange?: (v: string) => void;
	dateFrom?: string;
	onDateFromChange?: (v: string) => void;
	dateTo?: string;
	onDateToChange?: (v: string) => void;
}) {
	const queryClient = useQueryClient();
	const [orders, setOrders] = useState(initialOrders);
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [voidReason, setVoidReason] = useState("");
	const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

	const canVoid = userRole === "admin" || userRole === "executive";

	const voidMutation = useMutation(
		orpc.orders.void.mutationOptions({
			onSuccess: (_result, variables) => {
				setOrders((prev) =>
					prev.map((o) =>
						o.id === variables.id ? { ...o, status: "voided" } : o,
					),
				);
				queryClient.invalidateQueries({ queryKey: ["orders"] });
				toast.success("Order voided");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to void order");
			},
		}),
	);

	function handleVoid(orderId: string) {
		voidMutation.mutate({ id: orderId, userId, reason: voidReason });
		setVoidReason("");
	}

	const [refundReason, setRefundReason] = useState("");
	const [refundAmount, setRefundAmount] = useState("");

	const refundMutation = useMutation(
		orpc.orders.refund.mutationOptions({
			onSuccess: (_result, variables) => {
				setOrders((prev) =>
					prev.map((o) =>
						o.id === variables.id ? { ...o, status: "refunded" } : o,
					),
				);
				queryClient.invalidateQueries({ queryKey: ["orders"] });
				toast.success("Order refunded");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to refund order");
			},
		}),
	);

	function handleRefund(orderId: string, total: number) {
		const amt = refundAmount ? Number(refundAmount) : total;
		refundMutation.mutate({ id: orderId, reason: refundReason, amount: amt });
		setRefundReason("");
		setRefundAmount("");
	}

	const q = search.trim().toLowerCase();
	const filtered = orders.filter((o) => {
		if (typeFilter !== "all" && o.order_type !== typeFilter) return false;
		if (q) {
			const matchesNumber = o.order_number.toLowerCase().includes(q);
			const matchesCustomer = (o.customer_name ?? "").toLowerCase().includes(q);
			if (!matchesNumber && !matchesCustomer) return false;
		}
		return true;
	});

	const orderTypeIcon = (type: string) => {
		switch (type) {
			case "pickup":
				return <Clock className="size-3" />;
			case "delivery":
				return <Truck className="size-3" />;
			default:
				return <ShoppingBag className="size-3" />;
		}
	};

	return (
		<div className="flex flex-col gap-3">
			{/* Filter bar */}
			<div className="flex flex-wrap items-center gap-3">
				<Filter className="size-4 shrink-0 text-muted-foreground" />

				{/* Search */}
				<div className="relative">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Order # or customer..."
						value={search}
						onChange={(e) => onSearchChange?.(e.target.value)}
						className="h-9 w-52 pl-9"
					/>
				</div>

				{/* Order type */}
				<Select value={typeFilter} onValueChange={setTypeFilter}>
					<SelectTrigger className="h-9 w-44">
						<SelectValue placeholder="All order types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="dine_in">Walk-in / Dine-in</SelectItem>
						<SelectItem value="pickup">Pickup</SelectItem>
						<SelectItem value="delivery">Delivery</SelectItem>
					</SelectContent>
				</Select>

				{/* Status */}
				<Select
					value={statusFilter}
					onValueChange={(v) => onStatusFilterChange?.(v)}
				>
					<SelectTrigger className="h-9 w-40">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
						<SelectItem value="open">Open</SelectItem>
						<SelectItem value="voided">Voided</SelectItem>
						<SelectItem value="refunded">Refunded</SelectItem>
						<SelectItem value="held">Held</SelectItem>
					</SelectContent>
				</Select>

				{/* Date range */}
				<Input
					type="date"
					value={dateFrom}
					onChange={(e) => onDateFromChange?.(e.target.value)}
					className="h-9 w-40"
					aria-label="From date"
				/>
				<span className="text-muted-foreground text-sm">to</span>
				<Input
					type="date"
					value={dateTo}
					onChange={(e) => onDateToChange?.(e.target.value)}
					className="h-9 w-40"
					aria-label="To date"
				/>

				<span className="text-muted-foreground text-sm">
					{filtered.length} orders
				</span>
			</div>

			<div className="overflow-x-auto rounded-lg border">
				<Table className="min-w-[640px]">
					<TableHeader>
						<TableRow>
							<TableHead>Order #</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Cashier</TableHead>
							<TableHead>Customer</TableHead>
							<TableHead className="text-right">Total</TableHead>
							<TableHead>Time</TableHead>
							{canVoid && <TableHead className="w-16" />}
						</TableRow>
					</TableHeader>
					<TableBody>
						{filtered.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={canVoid ? 8 : 7}
									className="h-24 text-center"
								>
									No orders found
								</TableCell>
							</TableRow>
						) : (
							filtered.map((order) => (
								<Fragment key={order.id}>
									<TableRow
										className="cursor-pointer hover:bg-muted/50"
										onClick={() =>
											setExpandedOrder(
												expandedOrder === order.id ? null : order.id,
											)
										}
									>
										<TableCell className="font-medium font-mono text-sm">
											<div className="flex items-center gap-1.5">
												{expandedOrder === order.id ? (
													<ChevronDown className="size-3.5 text-muted-foreground" />
												) : (
													<ChevronRight className="size-3.5 text-muted-foreground" />
												)}
												{order.order_number}
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1.5">
												<Badge
													variant={statusVariant[order.status] || "secondary"}
												>
													{order.status}
												</Badge>
												{order.fulfillment_status &&
													order.fulfillment_status !== "none" && (
														<span
															className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[10px] ${fulfillmentColors[order.fulfillment_status] || ""}`}
														>
															{order.fulfillment_status.replace("_", " ")}
														</span>
													)}
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1.5 text-sm capitalize">
												{orderTypeIcon(order.order_type)}
												{order.order_type?.replace("_", " ") || "walk-in"}
											</div>
										</TableCell>
										<TableCell className="font-medium text-sm">
											{order.user_name || "-"}
										</TableCell>
										<TableCell className="text-sm">
											{order.customer_name ? (
												<div className="flex flex-col">
													<span className="font-medium">
														{order.customer_name}
													</span>
													{order.customer_phone && (
														<span className="text-muted-foreground text-xs">
															{order.customer_phone}
														</span>
													)}
												</div>
											) : (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell className="text-right font-mono text-sm">
											{formatGYD(Number(order.total))}
										</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
											{new Date(order.created_at).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</TableCell>
										{canVoid && (
											<TableCell>
												<div className="flex items-center gap-1">
													{order.status === "completed" && (
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-7 gap-1 text-destructive text-xs hover:text-destructive"
																>
																	<Ban className="size-3" />
																	Void
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		Void Order {order.order_number}?
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		This will void the order totalling{" "}
																		{formatGYD(Number(order.total))} and reverse
																		any cash session entries. This action is
																		logged in the audit trail.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<Input
																	placeholder="Reason for voiding (required)"
																	value={voidReason}
																	onChange={(e) =>
																		setVoidReason(e.target.value)
																	}
																/>
																<AlertDialogFooter>
																	<AlertDialogCancel
																		onClick={() => setVoidReason("")}
																	>
																		Cancel
																	</AlertDialogCancel>
																	<AlertDialogAction
																		className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																		disabled={
																			!voidReason.trim() ||
																			voidMutation.isPending
																		}
																		onClick={() => handleVoid(order.id)}
																	>
																		{voidMutation.isPending
																			? "Voiding..."
																			: "Confirm Void"}
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													)}

													{order.status === "completed" && (
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-7 gap-1 text-amber-600 text-xs hover:text-amber-700"
																	onClick={() =>
																		setRefundAmount(String(order.total))
																	}
																>
																	<RotateCcw className="size-3" />
																	Refund
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		Refund Order {order.order_number}?
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		Full order total is{" "}
																		{formatGYD(Number(order.total))}. Enter a
																		partial amount for partial refunds.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<div className="flex flex-col gap-3">
																	<Input
																		type="number"
																		placeholder={`Amount (default: ${order.total})`}
																		value={refundAmount}
																		onChange={(e) =>
																			setRefundAmount(e.target.value)
																		}
																	/>
																	<Input
																		placeholder="Reason for refund (required)"
																		value={refundReason}
																		onChange={(e) =>
																			setRefundReason(e.target.value)
																		}
																	/>
																</div>
																<AlertDialogFooter>
																	<AlertDialogCancel
																		onClick={() => {
																			setRefundReason("");
																			setRefundAmount("");
																		}}
																	>
																		Cancel
																	</AlertDialogCancel>
																	<AlertDialogAction
																		className="bg-amber-600 text-white hover:bg-amber-700"
																		disabled={
																			!refundReason.trim() ||
																			refundMutation.isPending
																		}
																		onClick={() =>
																			handleRefund(
																				order.id,
																				Number(order.total),
																			)
																		}
																	>
																		{refundMutation.isPending
																			? "Refunding..."
																			: "Confirm Refund"}
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													)}
												</div>
											</TableCell>
										)}
									</TableRow>
									{expandedOrder === order.id && (
										<TableRow key={`${order.id}-detail`}>
											<TableCell
												colSpan={canVoid ? 8 : 7}
												className="bg-muted/20 p-0"
											>
												<OrderDetailPanel orderId={order.id} />
											</TableCell>
										</TableRow>
									)}
								</Fragment>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
