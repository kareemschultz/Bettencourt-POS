import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

interface JournalEntry {
	account: string;
	debit: number;
	credit: number;
}

interface JournalData {
	startDate: string;
	endDate: string;
	entries: JournalEntry[];
	totalDebits: number;
	totalCredits: number;
}

export default function JournalPage() {
	const today = todayGY();
	const [startDate, setStartDate] = useState(today);
	const [endDate, setEndDate] = useState(today);
	const [exportFormat, setExportFormat] = useState<"csv" | "qbo" | "xero">(
		"csv",
	);
	const [isExporting, setIsExporting] = useState(false);

	// Build full timestamp strings for the API
	const startTs = `${startDate}T00:00:00-04:00`;
	const endTs = `${endDate}T23:59:59-04:00`;

	const { data: journal, isLoading } = useQuery(
		orpc.journal.getSalesJournal.queryOptions({
			input: { startDate: startTs, endDate: endTs },
		}),
	);

	const entries = journal?.entries ?? [];
	const totalDebits = journal?.totalDebits ?? 0;
	const totalCredits = journal?.totalCredits ?? 0;

	function exportCSV() {
		if (!entries.length) return;
		const header = "Account,Debit,Credit";
		const rows = entries.map(
			(e: JournalEntry) =>
				`"${e.account}",${e.debit.toFixed(2)},${e.credit.toFixed(2)}`,
		);
		rows.push(`"TOTALS",${totalDebits.toFixed(2)},${totalCredits.toFixed(2)}`);
		const csvContent = [header, ...rows].join("\n");
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `sales-journal-${startDate}-to-${endDate}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	const FORMAT_INFO: Record<
		string,
		{ label: string; desc: string; ext: string; mime: string }
	> = {
		csv: {
			label: "Generic CSV",
			desc: "Standard double-entry CSV with Date, Account, Description, Debit, Credit, Reference columns. Compatible with most accounting software.",
			ext: "csv",
			mime: "text/csv;charset=utf-8;",
		},
		qbo: {
			label: "QuickBooks (IIF)",
			desc: "QuickBooks IIF format with tab-delimited TRNS/SPL/ENDTRNS blocks. Import via File > Utilities > Import > IIF Files.",
			ext: "iif",
			mime: "text/plain;charset=utf-8;",
		},
		xero: {
			label: "Xero (CSV)",
			desc: "Xero manual journal CSV with Date, Description, AccountCode, Debit, Credit, TaxRate, Reference columns.",
			ext: "csv",
			mime: "text/csv;charset=utf-8;",
		},
	};

	async function downloadAccountingExport() {
		setIsExporting(true);
		try {
			const data = await client.journal.getExportData({
				startDate: startTs,
				endDate: endTs,
				format: exportFormat,
			});

			let content: string;
			let filename: string;
			const info = FORMAT_INFO[exportFormat]!;

			if (data.format === "csv") {
				const csvRows = data.rows as {
					date: string;
					account: string;
					description: string;
					debit: number;
					credit: number;
					reference: string;
				}[];
				const header = "Date,Account,Description,Debit,Credit,Reference";
				const lines = csvRows.map(
					(r) =>
						`"${r.date}","${r.account}","${r.description}",${r.debit.toFixed(2)},${r.credit.toFixed(2)},"${r.reference}"`,
				);
				content = [header, ...lines].join("\n");
				filename = `bettencourt-journal-${startDate}.${info.ext}`;
			} else if (data.format === "qbo") {
				content = (data.rows as string[]).join("\n");
				filename = `bettencourt-journal-${startDate}.${info.ext}`;
			} else {
				// xero
				const xeroRows = data.rows as {
					date: string;
					description: string;
					accountCode: string;
					debit: number;
					credit: number;
					taxRate: string;
					reference: string;
				}[];
				const header =
					"Date,Description,AccountCode,Debit,Credit,TaxRate,Reference";
				const lines = xeroRows.map(
					(r) =>
						`"${r.date}","${r.description}","${r.accountCode}",${r.debit.toFixed(2)},${r.credit.toFixed(2)},"${r.taxRate}","${r.reference}"`,
				);
				content = [header, ...lines].join("\n");
				filename = `bettencourt-journal-${startDate}.${info.ext}`;
			}

			const blob = new Blob([content], { type: info.mime });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
			toast.success(`Downloaded ${info.label} export`);
		} catch {
			toast.error("Failed to generate export");
		} finally {
			setIsExporting(false);
		}
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex items-center justify-between print:hidden">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<BookOpen className="size-6" /> Sales Journal
					</h1>
					<p className="text-muted-foreground">
						Double-entry daily journal with debit/credit columns.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Input
						type="date"
						value={startDate}
						onChange={(e) => setStartDate(e.target.value)}
						className="w-auto"
						aria-label="Start date"
					/>
					<span className="text-muted-foreground">to</span>
					<Input
						type="date"
						value={endDate}
						onChange={(e) => setEndDate(e.target.value)}
						className="w-auto"
						aria-label="End date"
					/>
					<Button variant="outline" className="gap-2" onClick={exportCSV}>
						<Download className="size-4" /> CSV
					</Button>
				</div>
			</div>

			{/* Print header */}
			<div className="mb-4 hidden text-center print:block">
				<h1 className="font-bold text-xl">Bettencourt's Food Inc.</h1>
				<p className="text-sm">
					Sales Journal — {startDate} to {endDate}
				</p>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : (
				<Card className="print:border print:shadow-none">
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Journal Entries</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Account</TableHead>
									<TableHead className="text-right">Debit</TableHead>
									<TableHead className="text-right">Credit</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{entries.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={3}
											className="py-8 text-center text-muted-foreground"
										>
											No journal data for this date range.
										</TableCell>
									</TableRow>
								) : (
									entries.map((entry: JournalEntry, i: number) => (
										<TableRow key={i}>
											<TableCell className="font-medium">
												{entry.credit > 0 ? (
													<span className="ml-4">{entry.account}</span>
												) : (
													entry.account
												)}
											</TableCell>
											<TableCell className="text-right font-mono">
												{entry.debit > 0 ? formatGYD(entry.debit) : ""}
											</TableCell>
											<TableCell className="text-right font-mono">
												{entry.credit > 0 ? formatGYD(entry.credit) : ""}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
							{entries.length > 0 && (
								<TableFooter>
									<TableRow className="font-bold">
										<TableCell>Totals</TableCell>
										<TableCell className="text-right font-mono">
											{formatGYD(totalDebits)}
										</TableCell>
										<TableCell className="text-right font-mono">
											{formatGYD(totalCredits)}
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell
											colSpan={3}
											className="text-right text-muted-foreground text-xs"
										>
											{Math.abs(totalDebits - totalCredits) < 0.01
												? "Balanced"
												: `Out of balance by ${formatGYD(Math.abs(totalDebits - totalCredits))}`}
										</TableCell>
									</TableRow>
								</TableFooter>
							)}
						</Table>
					</CardContent>
				</Card>
			)}

			{/* Export for Accounting */}
			<Card className="print:hidden">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<FileSpreadsheet className="size-4" /> Export for Accounting
					</CardTitle>
					<CardDescription>
						Download journal data formatted for your accounting software.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end">
						<div className="flex flex-col gap-1.5">
							<label className="font-medium text-sm" htmlFor="export-format">
								Format
							</label>
							<Select
								value={exportFormat}
								onValueChange={(v) =>
									setExportFormat(v as "csv" | "qbo" | "xero")
								}
							>
								<SelectTrigger id="export-format" className="w-[220px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="csv">Generic CSV</SelectItem>
									<SelectItem value="qbo">QuickBooks (IIF)</SelectItem>
									<SelectItem value="xero">Xero (CSV)</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Button
							onClick={downloadAccountingExport}
							disabled={isExporting}
							className="gap-2"
						>
							{isExporting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Download className="size-4" />
							)}
							Download
						</Button>
					</div>
					<p className="mt-3 text-muted-foreground text-xs">
						{FORMAT_INFO[exportFormat]?.desc}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
