import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

const statusColors: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	draft: "secondary",
	submitted: "outline",
	partial: "default",
	received: "default",
	cancelled: "destructive",
};

export function PurchaseOrders() {
	const { data: orders = [], isLoading } = useQuery(
		orpc.inventory.getPurchaseOrders.queryOptions({ input: {} }),
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<FileText className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Purchase Orders</h3>
				</div>
			</div>

			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>PO Number</TableHead>
									<TableHead>Supplier</TableHead>
									<TableHead>Location</TableHead>
									<TableHead className="text-right">Items</TableHead>
									<TableHead className="text-right">Total</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Date</TableHead>
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
								) : orders.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-8 text-center text-muted-foreground"
										>
											No purchase orders yet
										</TableCell>
									</TableRow>
								) : (
									orders.map((po) => (
										<TableRow key={po.id}>
											<TableCell className="font-medium font-mono text-foreground">
												{po.id.slice(0, 8).toUpperCase()}
											</TableCell>
											<TableCell className="text-foreground">
												{po.supplierName}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{po.locationName}
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												—
											</TableCell>
											<TableCell className="text-right font-mono text-foreground">
												${Number(po.total || 0).toFixed(2)}
											</TableCell>
											<TableCell>
												<Badge variant={statusColors[po.status] || "secondary"}>
													{po.status?.charAt(0).toUpperCase() +
														po.status?.slice(1)}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{po.createdAt
													? new Date(po.createdAt).toLocaleDateString()
													: "—"}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
