import { useQuery } from "@tanstack/react-query";
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

const reasonColors: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	sale: "default",
	purchase: "default",
	adjustment: "secondary",
	transfer_in: "outline",
	transfer_out: "outline",
	return: "destructive",
	waste: "destructive",
	count: "secondary",
};

export function StockLedger() {
	const { data: entries = [], isLoading } = useQuery(
		orpc.inventory.getLedger.queryOptions({ input: {} }),
	);

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead>Location</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead className="text-right">Change</TableHead>
									<TableHead className="text-right">Balance</TableHead>
									<TableHead>User</TableHead>
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
								) : entries.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-8 text-center text-muted-foreground"
										>
											No ledger entries yet
										</TableCell>
									</TableRow>
								) : (
									entries.map((e) => (
										<TableRow key={e.id}>
											<TableCell className="font-medium text-foreground">
												{e.itemName}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{e.locationName}
											</TableCell>
											<TableCell>
												<Badge
													variant={reasonColors[e.reason || ""] || "secondary"}
												>
													{e.reason?.replace("_", " ") || "—"}
												</Badge>
											</TableCell>
											<TableCell
												className={`text-right font-mono ${Number(e.quantityChange) > 0 ? "text-emerald-600" : "text-destructive"}`}
											>
												{Number(e.quantityChange) > 0 ? "+" : ""}
												{e.quantityChange}
											</TableCell>
											<TableCell className="text-right font-mono text-foreground">
												{e.afterQuantity}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{e.userName || "System"}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{e.createdAt
													? new Date(e.createdAt).toLocaleString()
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
