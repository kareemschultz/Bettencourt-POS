import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Bell,
	Check,
	Loader2,
	PackageX,
	ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { orpc } from "@/utils/orpc";
import { useLocationContext } from "./dashboard";

export default function StockAlertsPage() {
	const queryClient = useQueryClient();
	const [filter, setFilter] = useState<"all" | "unacknowledged">("all");
	const [generatingPO, setGeneratingPO] = useState(false);
	const { locationId } = useLocationContext();

	const { data: userProfile } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);

	const orgId = userProfile?.organizationId;
	const locId = locationId;

	const { data: alerts = [], isLoading } = useQuery(
		orpc.inventory.getAlerts.queryOptions({
			input: {
				organizationId: orgId ?? "",
				unacknowledgedOnly: filter === "unacknowledged",
			},
			enabled: !!orgId,
		}),
	);

	// For generating POs, we need suppliers list
	const { data: suppliers = [] } = useQuery(
		orpc.settings.getSuppliers.queryOptions({
			input: { organizationId: orgId ?? undefined },
		}),
	);

	const acknowledgeMutation = useMutation(
		orpc.inventory.acknowledgeAlert.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.inventory.getAlerts.queryOptions({
						input: { organizationId: orgId },
					}).queryKey,
				});
				toast.success("Alert acknowledged");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to acknowledge alert"),
		}),
	);

	const generatePOMutation = useMutation(
		orpc.inventory.autoGeneratePO.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({
					queryKey: orpc.inventory.getAlerts.queryOptions({
						input: { organizationId: orgId },
					}).queryKey,
				});
				queryClient.invalidateQueries({
					queryKey: orpc.inventory.getPurchaseOrders.queryOptions({
						input: {},
					}).queryKey,
				});
				toast.success(`Generated ${data.count} purchase order(s)`);
				setGeneratingPO(false);
			},
			onError: (err) => {
				toast.error(err.message || "Failed to generate purchase orders");
				setGeneratingPO(false);
			},
		}),
	);

	function handleAcknowledge(inventoryItemId: string) {
		if (!orgId) return;
		acknowledgeMutation.mutate({
			inventoryItemId,
			organizationId: orgId,
		});
	}

	function handleGeneratePO() {
		if (!orgId || !locId) {
			toast.error("Location or organization is not selected");
			return;
		}
		// Get unacknowledged alerts with assigned suppliers
		const eligibleAlerts = alerts.filter(
			(a) => !a.acknowledgedBy && a.preferredSupplierId,
		);

		if (eligibleAlerts.length === 0) {
			toast.error("No unacknowledged alerts with assigned suppliers");
			return;
		}

		setGeneratingPO(true);
		generatePOMutation.mutate({
			organizationId: orgId,
			locationId: locId,
			items: eligibleAlerts.map((a) => ({
				inventoryItemId: a.inventoryItemId,
				preferredSupplierId: a.preferredSupplierId,
				// Order quantity = reorderPoint * 2 - currentStock (reorder to 2x reorder point)
				quantity: Math.max(
					a.reorderPoint - a.currentStock,
					a.reorderPoint,
				).toString(),
				unitCost: "0",
			})),
		});
	}

	const unacknowledgedCount = alerts.filter((a) => !a.acknowledgedBy).length;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<Bell className="size-6 text-primary" /> Stock Alerts
						{unacknowledgedCount > 0 && (
							<Badge variant="destructive" className="ml-1">
								{unacknowledgedCount}
							</Badge>
						)}
					</h1>
					<p className="text-muted-foreground text-sm">
						Items below their reorder point that need attention. Acknowledge
						alerts and auto-generate purchase orders to restock.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={filter}
						onValueChange={(v) => setFilter(v as "all" | "unacknowledged")}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Alerts</SelectItem>
							<SelectItem value="unacknowledged">
								Unacknowledged Only
							</SelectItem>
						</SelectContent>
					</Select>
					<Button
						onClick={handleGeneratePO}
						disabled={generatingPO || unacknowledgedCount === 0}
						className="gap-1.5"
					>
						{generatingPO ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<ShoppingCart className="size-4" />
						)}
						Generate PO
					</Button>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="flex items-center gap-3 pt-6">
						<div className="rounded-lg bg-orange-100 p-2.5 dark:bg-orange-900/30">
							<AlertTriangle className="size-5 text-orange-600 dark:text-orange-400" />
						</div>
						<div>
							<p className="font-bold text-2xl">
								{alerts.filter((a) => a.alertType === "low_stock").length}
							</p>
							<p className="text-muted-foreground text-xs">Low Stock Items</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 pt-6">
						<div className="rounded-lg bg-red-100 p-2.5 dark:bg-red-900/30">
							<PackageX className="size-5 text-red-600 dark:text-red-400" />
						</div>
						<div>
							<p className="font-bold text-2xl">
								{alerts.filter((a) => a.alertType === "out_of_stock").length}
							</p>
							<p className="text-muted-foreground text-xs">Out of Stock</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 pt-6">
						<div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
							<Check className="size-5 text-green-600 dark:text-green-400" />
						</div>
						<div>
							<p className="font-bold text-2xl">
								{alerts.filter((a) => a.acknowledgedBy).length}
							</p>
							<p className="text-muted-foreground text-xs">Acknowledged</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Alerts Table */}
			<Card>
				<CardHeader>
					<CardTitle>Alert Details</CardTitle>
					<CardDescription>
						{alerts.length} item{alerts.length !== 1 ? "s" : ""} below reorder
						point
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					) : alerts.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
							<Check className="mb-2 size-8" />
							<p className="font-medium">All stock levels are healthy</p>
							<p className="text-sm">
								No items are currently below their reorder point.
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Item</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead className="text-right">Current Stock</TableHead>
									<TableHead className="text-right">Reorder Point</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Supplier</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{alerts.map((alert) => {
									const supplierName = suppliers.find(
										(s) => s.id === alert.preferredSupplierId,
									)?.name;

									return (
										<TableRow key={alert.inventoryItemId}>
											<TableCell className="font-medium">
												{alert.name}
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{alert.sku}
											</TableCell>
											<TableCell className="text-right">
												<span
													className={
														alert.currentStock === 0
															? "font-bold text-red-600 dark:text-red-400"
															: "font-medium text-orange-600 dark:text-orange-400"
													}
												>
													{alert.currentStock}
												</span>
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												{alert.reorderPoint}
											</TableCell>
											<TableCell>
												{alert.alertType === "out_of_stock" ? (
													<Badge variant="destructive" className="gap-1">
														<PackageX className="size-3" />
														Out of Stock
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="gap-1 border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400"
													>
														<AlertTriangle className="size-3" />
														Low Stock
													</Badge>
												)}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{supplierName ?? (
													<span className="text-muted-foreground/60 italic">
														Unassigned
													</span>
												)}
											</TableCell>
											<TableCell className="text-right">
												{alert.acknowledgedBy ? (
													<Badge variant="secondary" className="gap-1">
														<Check className="size-3" />
														Acknowledged
													</Badge>
												) : (
													<Button
														variant="outline"
														size="sm"
														className="gap-1"
														onClick={() =>
															handleAcknowledge(alert.inventoryItemId)
														}
														disabled={acknowledgeMutation.isPending}
													>
														{acknowledgeMutation.isPending ? (
															<Loader2 className="size-3 animate-spin" />
														) : (
															<Check className="size-3" />
														)}
														Acknowledge
													</Button>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
