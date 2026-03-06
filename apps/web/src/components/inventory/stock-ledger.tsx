import { useQuery } from "@tanstack/react-query";
import { Filter, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 50;

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

const REASON_OPTIONS = [
	{ value: "all", label: "All Reasons" },
	{ value: "sale", label: "Sale" },
	{ value: "purchase", label: "Purchase" },
	{ value: "adjustment", label: "Adjustment" },
	{ value: "transfer_in", label: "Transfer In" },
	{ value: "transfer_out", label: "Transfer Out" },
	{ value: "waste", label: "Waste" },
	{ value: "return", label: "Return" },
	{ value: "count", label: "Count" },
];

export function StockLedger() {
	const { data: entries = [], isLoading } = useQuery(
		orpc.inventory.getLedger.queryOptions({ input: {} }),
	);

	const [search, setSearch] = useState("");
	const [reason, setReason] = useState("all");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [page, setPage] = useState(1);

	const q = search.trim().toLowerCase();

	const filtered = entries.filter((e) => {
		if (reason !== "all" && e.reason !== reason) return false;
		if (q) {
			const name = (e.itemName ?? "").toLowerCase();
			if (!name.includes(q)) return false;
		}
		if (dateFrom && e.createdAt) {
			if (new Date(e.createdAt) < new Date(dateFrom)) return false;
		}
		if (dateTo && e.createdAt) {
			// include the full "to" day
			const end = new Date(dateTo);
			end.setDate(end.getDate() + 1);
			if (new Date(e.createdAt) >= end) return false;
		}
		return true;
	});

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const startIdx = (safePage - 1) * PAGE_SIZE;
	const pageEntries = filtered.slice(startIdx, startIdx + PAGE_SIZE);

	// Reset to page 1 when filters change
	function handleSearchChange(v: string) {
		setSearch(v);
		setPage(1);
	}
	function handleReasonChange(v: string) {
		setReason(v);
		setPage(1);
	}
	function handleDateFromChange(v: string) {
		setDateFrom(v);
		setPage(1);
	}
	function handleDateToChange(v: string) {
		setDateTo(v);
		setPage(1);
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Filter bar */}
			<div className="flex flex-wrap items-center gap-3">
				<Filter className="size-4 shrink-0 text-muted-foreground" />

				<div className="relative">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Product name..."
						value={search}
						onChange={(e) => handleSearchChange(e.target.value)}
						className="h-9 w-52 pl-9"
					/>
				</div>

				<Select value={reason} onValueChange={handleReasonChange}>
					<SelectTrigger className="h-9 w-44">
						<SelectValue placeholder="All Reasons" />
					</SelectTrigger>
					<SelectContent>
						{REASON_OPTIONS.map((r) => (
							<SelectItem key={r.value} value={r.value}>
								{r.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Input
					type="date"
					value={dateFrom}
					onChange={(e) => handleDateFromChange(e.target.value)}
					className="h-9 w-40"
					aria-label="From date"
				/>
				<span className="text-muted-foreground text-sm">to</span>
				<Input
					type="date"
					value={dateTo}
					onChange={(e) => handleDateToChange(e.target.value)}
					className="h-9 w-40"
					aria-label="To date"
				/>

				<span className="text-muted-foreground text-sm">
					{filtered.length} entries
				</span>
			</div>

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
								) : pageEntries.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-8 text-center text-muted-foreground"
										>
											No ledger entries found
										</TableCell>
									</TableRow>
								) : (
									pageEntries.map((e) => (
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

			{/* Pagination */}
			{filtered.length > PAGE_SIZE && (
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">
						Showing {startIdx + 1}–
						{Math.min(startIdx + PAGE_SIZE, filtered.length)} of{" "}
						{filtered.length} entries
					</span>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={safePage <= 1}
						>
							Prev
						</Button>
						<span className="text-muted-foreground">
							Page {safePage} of {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={safePage >= totalPages}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
