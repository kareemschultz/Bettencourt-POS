import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2, Printer, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv-export";
import { printCustomerStatementPdf } from "@/lib/pdf/customer-statement-pdf";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

type StatementRow = {
	date: string;
	description: string;
	reference: string;
	debit: string;
	credit: string;
	balance: string;
};

type CustomerSummary = {
	customerId: string | null;
	customerName: string;
	totalOutstanding: string;
};

/** Returns the first day of the current month in Guyana timezone as YYYY-MM-DD. */
function firstOfMonthGY(): string {
	const now = new Date();
	const gyDate = now.toLocaleDateString("en-CA", {
		timeZone: "America/Guyana",
	});
	// gyDate is "YYYY-MM-DD"; replace the day with "01"
	return `${gyDate.slice(0, 7)}-01`;
}

export default function CustomerStatementsPage() {
	const [customerId, setCustomerId] = useState<string | null>(null);
	const [startDate, setStartDate] = useState<string>(firstOfMonthGY());
	const [endDate, setEndDate] = useState<string>(todayGY());
	const [statementData, setStatementData] = useState<StatementRow[]>([]);
	const [isLoadingStatement, setIsLoadingStatement] = useState(false);
	const [statementLoaded, setStatementLoaded] = useState(false);

	// Customer balance summary for dropdown
	const { data: customersRaw, isLoading: loadingCustomers } = useQuery(
		orpc.invoices.getCustomerBalanceSummary.queryOptions({ input: {} }),
	);
	const customers = (customersRaw as CustomerSummary[] | undefined) ?? [];

	const selectedCustomer = customers.find((c) => c.customerId === customerId);

	async function handleLoadStatement() {
		if (!customerId) {
			toast.error("Please select a customer");
			return;
		}
		setIsLoadingStatement(true);
		setStatementLoaded(false);
		try {
			const result = await client.invoices.getCustomerStatement({
				customerId,
				startDate: startDate || todayGY(),
				endDate: endDate || todayGY(),
			});
			setStatementData((result as StatementRow[]) ?? []);
			setStatementLoaded(true);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to load statement",
			);
		} finally {
			setIsLoadingStatement(false);
		}
	}

	function handlePrintPdf() {
		if (!statementLoaded || !selectedCustomer) return;
		printCustomerStatementPdf(statementData, {
			customerName: selectedCustomer.customerName,
			startDate,
			endDate,
		});
	}

	function handleExportCsv() {
		if (!statementLoaded || statementData.length === 0) {
			toast.error("No data to export");
			return;
		}
		const filename = `customer-statement-${selectedCustomer?.customerName.replace(/\s+/g, "-").toLowerCase()}-${startDate}-to-${endDate}.csv`;
		downloadCsv(
			filename,
			statementData as unknown as Record<string, unknown>[],
		);
		toast.success("CSV exported");
	}

	// Compute totals
	const totalDebits = statementData.reduce(
		(sum, r) => sum + Number(r.debit || 0),
		0,
	);
	const totalCredits = statementData.reduce(
		(sum, r) => sum + Number(r.credit || 0),
		0,
	);
	const closingBalance =
		statementData.length > 0
			? Number(statementData[statementData.length - 1]?.balance)
			: 0;

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div>
				<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
					<FileText className="size-6" />
					Customer Statements
				</h1>
				<p className="text-muted-foreground text-sm">
					View account activity and outstanding balances per customer
				</p>
			</div>

			{/* Controls bar */}
			<Card>
				<CardContent className="flex flex-wrap items-end gap-3 pt-6">
					{/* Customer selector */}
					<div className="flex min-w-60 flex-1 flex-col gap-1.5">
						<Label>Customer</Label>
						{loadingCustomers ? (
							<Skeleton className="h-9 w-full" />
						) : (
							<Select
								value={customerId ?? ""}
								onValueChange={(v) => {
									setCustomerId(v || null);
									setStatementLoaded(false);
									setStatementData([]);
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a customer..." />
								</SelectTrigger>
								<SelectContent>
									{customers.length === 0 ? (
										<SelectItem value="__none__" disabled>
											No customers found
										</SelectItem>
									) : (
										customers.map((c) => (
											<SelectItem
												key={c.customerId ?? c.customerName}
												value={c.customerId ?? c.customerName}
											>
												{c.customerName}
												{Number(c.totalOutstanding) > 0 && (
													<span className="ml-2 text-muted-foreground text-xs">
														— {formatGYD(Number(c.totalOutstanding))}{" "}
														outstanding
													</span>
												)}
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
						)}
					</div>

					{/* Start date */}
					<div className="flex flex-col gap-1.5">
						<Label>Start Date</Label>
						<Input
							type="date"
							value={startDate}
							onChange={(e) => {
								setStartDate(e.target.value);
								setStatementLoaded(false);
							}}
							className="w-36"
						/>
					</div>

					{/* End date */}
					<div className="flex flex-col gap-1.5">
						<Label>End Date</Label>
						<Input
							type="date"
							value={endDate}
							onChange={(e) => {
								setEndDate(e.target.value);
								setStatementLoaded(false);
							}}
							className="w-36"
						/>
					</div>

					{/* Actions */}
					<div className="flex gap-2">
						<Button
							onClick={handleLoadStatement}
							disabled={!customerId || isLoadingStatement}
							className="gap-2"
						>
							{isLoadingStatement ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Search className="size-4" />
							)}
							{isLoadingStatement ? "Loading..." : "Load Statement"}
						</Button>

						<Button
							variant="outline"
							onClick={handlePrintPdf}
							disabled={!statementLoaded}
							className="gap-2"
						>
							<Printer className="size-4" />
							Print PDF
						</Button>

						<Button
							variant="outline"
							onClick={handleExportCsv}
							disabled={!statementLoaded || statementData.length === 0}
							className="gap-2"
						>
							<Download className="size-4" />
							Export CSV
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Statement table */}
			{isLoadingStatement ? (
				<Card>
					<CardContent className="flex flex-col gap-2 pt-6">
						{[0, 1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</CardContent>
				</Card>
			) : statementLoaded ? (
				<Card>
					{/* Customer header */}
					{selectedCustomer && (
						<div className="flex items-center justify-between border-b px-4 py-3">
							<div>
								<p className="font-semibold">{selectedCustomer.customerName}</p>
								<p className="text-muted-foreground text-xs">
									Period: {startDate} to {endDate}
								</p>
							</div>
							{Number(selectedCustomer.totalOutstanding) > 0 && (
								<div className="text-right">
									<p className="text-muted-foreground text-xs">Outstanding</p>
									<p className="font-bold text-amber-600">
										{formatGYD(Number(selectedCustomer.totalOutstanding))}
									</p>
								</div>
							)}
						</div>
					)}

					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="text-xs">Date</TableHead>
								<TableHead className="text-xs">Description</TableHead>
								<TableHead className="text-xs">Reference</TableHead>
								<TableHead className="text-right text-xs">Debit</TableHead>
								<TableHead className="text-right text-xs">Credit</TableHead>
								<TableHead className="text-right text-xs">Balance</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{statementData.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="py-10 text-center text-muted-foreground text-sm"
									>
										<FileText className="mx-auto mb-2 size-8 opacity-30" />
										No transactions in this period
									</TableCell>
								</TableRow>
							) : (
								<>
									{statementData.map((row, i) => (
										<TableRow key={i}>
											<TableCell className="whitespace-nowrap text-xs">
												{new Date(row.date).toLocaleDateString("en-GY", {
													timeZone: "America/Guyana",
													month: "short",
													day: "numeric",
													year: "numeric",
												})}
											</TableCell>
											<TableCell className="text-sm">
												{row.description}
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{row.reference || "—"}
											</TableCell>
											<TableCell className="text-right font-mono text-xs">
												{Number(row.debit) > 0 ? (
													<span className="text-destructive">
														{formatGYD(Number(row.debit))}
													</span>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell className="text-right font-mono text-xs">
												{Number(row.credit) > 0 ? (
													<span className="text-emerald-600">
														{formatGYD(Number(row.credit))}
													</span>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell className="text-right font-mono font-semibold text-sm">
												{formatGYD(Number(row.balance))}
											</TableCell>
										</TableRow>
									))}

									{/* Totals row */}
									<TableRow className="bg-muted/40 font-bold">
										<TableCell
											colSpan={3}
											className="text-right text-muted-foreground text-xs uppercase tracking-wide"
										>
											Totals
										</TableCell>
										<TableCell className="text-right font-mono text-destructive text-sm">
											{formatGYD(totalDebits)}
										</TableCell>
										<TableCell className="text-right font-mono text-emerald-600 text-sm">
											{formatGYD(totalCredits)}
										</TableCell>
										<TableCell className="text-right font-mono text-sm">
											{formatGYD(closingBalance)}
										</TableCell>
									</TableRow>
								</>
							)}
						</TableBody>
					</Table>

					{/* Summary footer */}
					{statementData.length > 0 && (
						<div className="flex items-center justify-between border-t px-4 py-3 text-sm">
							<span className="text-muted-foreground text-xs">
								{statementData.length} transaction
								{statementData.length !== 1 ? "s" : ""}
							</span>
							<div className="flex items-center gap-4">
								<span className="text-muted-foreground text-xs">
									Closing Balance:
								</span>
								<span className="font-bold text-base">
									{formatGYD(closingBalance)}
								</span>
							</div>
						</div>
					)}
				</Card>
			) : (
				/* Empty state */
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
						<FileText className="size-12 opacity-20" />
						<p className="font-medium text-base">No statement loaded</p>
						<p className="max-w-sm text-sm">
							Select a customer and date range to view their statement, then
							click "Load Statement".
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
