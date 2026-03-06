import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
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

type TransferRow = {
	id: string;
	transfer_number?: string;
	from_location_name: string;
	to_location_name: string;
	item_count?: number;
	status: string;
	created_by_name: string | null;
	created_at: string;
};

export function TransfersList() {
	const { data: rawTransfers = [], isLoading } = useQuery(
		orpc.inventory.getTransfers.queryOptions({ input: {} }),
	);
	const transfers = rawTransfers as TransferRow[];

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Transfer #</TableHead>
									<TableHead>Route</TableHead>
									<TableHead className="text-right">Items</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Created By</TableHead>
									<TableHead>Date</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="py-8 text-center text-muted-foreground"
										>
											Loading...
										</TableCell>
									</TableRow>
								) : transfers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="py-8 text-center text-muted-foreground"
										>
											No transfers yet
										</TableCell>
									</TableRow>
								) : (
									transfers.map((t) => (
										<TableRow key={t.id}>
											<TableCell className="font-medium font-mono text-foreground">
												{t.id.slice(0, 8).toUpperCase()}
											</TableCell>
											<TableCell>
												<span className="flex items-center gap-1 text-foreground text-sm">
													{t.from_location_name}
													<ArrowRight className="h-3 w-3 text-muted-foreground" />
													{t.to_location_name}
												</span>
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												—
											</TableCell>
											<TableCell>
												<Badge
													variant={
														t.status === "completed" ? "default" : "secondary"
													}
												>
													{t.status?.charAt(0).toUpperCase() +
														t.status?.slice(1)}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{t.created_by_name || "---"}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{t.created_at
													? new Date(t.created_at).toLocaleDateString()
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
