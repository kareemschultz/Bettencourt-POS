import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	Download,
	Package,
	Search,
	ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

function StockBar({
	qty,
	reorder,
	max,
}: {
	qty: number;
	reorder: number;
	max: number;
}) {
	const pct = max > 0 ? Math.min(100, (qty / max) * 100) : 0;
	const color =
		qty <= reorder * 0.5
			? "bg-red-500"
			: qty <= reorder
				? "bg-amber-500"
				: "bg-emerald-500";
	return (
		<div className="flex items-center gap-2">
			<div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
				<div
					className={`h-full rounded-full transition-all ${color}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="text-[10px] text-muted-foreground tabular-nums">
				{Math.round(pct)}%
			</span>
		</div>
	);
}

export function StockLevels() {
	const [search, setSearch] = useState("");
	const [showLowOnly, setShowLowOnly] = useState(false);

	const { data: inventory = [], isLoading } = useQuery(
		orpc.inventory.getStockLevels.queryOptions({
			input: { lowStock: showLowOnly },
		}),
	);

	const filtered = inventory.filter(
		(item) =>
			!search ||
			item.itemName?.toLowerCase().includes(search.toLowerCase()) ||
			item.sku?.toLowerCase().includes(search.toLowerCase()),
	);

	const lowStockItems = inventory.filter(
		(i) => Number(i.quantityOnHand) <= Number(i.reorderPoint || 0),
	);
	const criticalItems = inventory.filter(
		(i) => Number(i.quantityOnHand) <= Number(i.reorderPoint || 0) * 0.5,
	);

	const totalValue = inventory.reduce(
		(sum, i) => sum + Number(i.quantityOnHand || 0) * Number(i.avgCost || 0),
		0,
	);

	function exportCSV() {
		const headers =
			"Product,SKU,Location,Quantity,Reorder Point,Category,Status\n";
		const rows = filtered
			.map((i) => {
				const isLow = Number(i.quantityOnHand) <= Number(i.reorderPoint);
				const isCritical =
					Number(i.quantityOnHand) <= Number(i.reorderPoint) * 0.5;
				return `"${i.itemName}","${i.sku || ""}","${i.locationName}",${i.quantityOnHand},${i.reorderPoint},"${i.category || ""}","${isCritical ? "Critical" : isLow ? "Low" : "OK"}"`;
			})
			.join("\n");
		const blob = new Blob([headers + rows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	}

	return (
		<div className="flex flex-col gap-4">
			{lowStockItems.length > 0 && (
				<div
					className={`flex items-center gap-3 rounded-lg border-2 p-3 ${criticalItems.length > 0 ? "border-red-500/50 bg-red-50 dark:bg-red-950/20" : "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"}`}
				>
					<AlertTriangle
						className={`size-5 shrink-0 ${criticalItems.length > 0 ? "text-red-600" : "text-amber-600"}`}
					/>
					<div className="flex-1">
						<p
							className={`font-semibold text-sm ${criticalItems.length > 0 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}
						>
							{lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""}{" "}
							below reorder point
							{criticalItems.length > 0 && (
								<span className="ml-1 text-red-700 dark:text-red-400">
									({criticalItems.length} critical)
								</span>
							)}
						</p>
						<p className="text-muted-foreground text-xs">
							{lowStockItems
								.slice(0, 3)
								.map((i) => i.itemName)
								.join(", ")}
							{lowStockItems.length > 3 &&
								` and ${lowStockItems.length - 3} more`}
						</p>
					</div>
					<Button
						size="sm"
						variant="outline"
						className="shrink-0 gap-1.5 text-xs"
						onClick={() => setShowLowOnly(true)}
					>
						<ShoppingCart className="size-3" /> View All
					</Button>
				</div>
			)}

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-muted-foreground text-xs">
							Total Items
						</CardTitle>
						<Package className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl text-foreground">
							{inventory.length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-muted-foreground text-xs">
							Low Stock
						</CardTitle>
						<AlertTriangle className="size-4 text-amber-600" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl text-amber-600">
							{lowStockItems.length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-muted-foreground text-xs">
							Critical
						</CardTitle>
						<AlertTriangle className="size-4 text-red-600" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl text-red-600">
							{criticalItems.length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-muted-foreground text-xs">
							Total Value
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl text-foreground">
							$
							{totalValue.toLocaleString("en-US", {
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							})}
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search products..."
						aria-label="Search inventory"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
				<div className="flex gap-2">
					<Button
						variant={showLowOnly ? "default" : "outline"}
						size="sm"
						className="gap-1.5"
						onClick={() => setShowLowOnly(!showLowOnly)}
					>
						<AlertTriangle className="size-3.5" />
						{showLowOnly ? "Show All" : "Low Stock Only"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={exportCSV}
					>
						<Download className="size-3.5" />
						Export
					</Button>
				</div>
			</div>

			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead>Location</TableHead>
									<TableHead className="text-right">On Hand</TableHead>
									<TableHead className="text-right">Reorder Pt</TableHead>
									<TableHead>Stock Level</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-8 text-center text-muted-foreground"
										>
											Loading...
										</TableCell>
									</TableRow>
								) : filtered.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-8 text-center text-muted-foreground"
										>
											No inventory items found
										</TableCell>
									</TableRow>
								) : (
									filtered.map((item) => {
										const qty = Number(item.quantityOnHand || 0);
										const reorder = Number(item.reorderPoint || 0);
										const maxLevel = Math.max(reorder * 3, qty, 100);
										const isLow = qty <= reorder;
										const isCritical = qty <= reorder * 0.5;
										return (
											<TableRow
												key={item.id}
												className={
													isCritical
														? "bg-red-50/50 dark:bg-red-950/10"
														: isLow
															? "bg-amber-50/50 dark:bg-amber-950/10"
															: ""
												}
											>
												<TableCell className="font-medium text-foreground">
													{item.itemName}
												</TableCell>
												<TableCell className="font-mono text-muted-foreground text-xs">
													{item.sku || "---"}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{item.locationName}
												</TableCell>
												<TableCell className="text-right font-bold font-mono text-foreground">
													{qty}
												</TableCell>
												<TableCell className="text-right font-mono text-muted-foreground">
													{reorder}
												</TableCell>
												<TableCell>
													<StockBar
														qty={qty}
														reorder={reorder}
														max={maxLevel}
													/>
												</TableCell>
												<TableCell>
													{isCritical ? (
														<Badge
															variant="destructive"
															className="gap-1 text-[10px]"
														>
															<AlertTriangle className="size-2.5" /> Critical
														</Badge>
													) : isLow ? (
														<Badge className="gap-1 bg-amber-500 text-[10px] text-white hover:bg-amber-600">
															Reorder Needed
														</Badge>
													) : (
														<Badge variant="secondary" className="text-[10px]">
															OK
														</Badge>
													)}
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
