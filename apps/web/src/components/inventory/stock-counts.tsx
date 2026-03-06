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

export function StockCounts() {
	const { data: counts = [], isLoading } = useQuery(
		orpc.inventory.getCounts.queryOptions({ input: {} }),
	);

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Location</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Created By</TableHead>
									<TableHead>Date</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="py-8 text-center text-muted-foreground"
										>
											Loading...
										</TableCell>
									</TableRow>
								) : counts.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="py-8 text-center text-muted-foreground"
										>
											No stock counts yet
										</TableCell>
									</TableRow>
								) : (
									counts.map((c) => (
										<TableRow key={c.id}>
											<TableCell className="font-medium text-foreground">
												{c.locationName}
											</TableCell>
											<TableCell className="text-muted-foreground capitalize">
												{c.type}
											</TableCell>
											<TableCell>
												<Badge
													variant={
														c.status === "completed" ? "default" : "secondary"
													}
												>
													{c.status?.replace("_", " ")}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{c.createdByName || "---"}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{c.createdAt
													? new Date(c.createdAt).toLocaleDateString()
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
