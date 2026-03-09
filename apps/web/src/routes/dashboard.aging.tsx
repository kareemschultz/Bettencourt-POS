import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv-export";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

// ── types ────────────────────────────────────────────────────────────────

type ReceivableRow = Record<string, string | null> & {
	customerName: string;
	customerId: string | null;
	current: string;
	days30: string;
	days60: string;
	days90: string;
	days90plus: string;
	total: string;
};

type PayableRow = Record<string, string | null> & {
	supplierName: string;
	supplierId: string | null;
	current: string;
	days30: string;
	days60: string;
	days90: string;
	days90plus: string;
	total: string;
};

// ── helpers ──────────────────────────────────────────────────────────────

function sumColumn(
	rows: Array<Record<string, string | null>>,
	key: string,
): number {
	return rows.reduce((acc, r) => acc + Number(r[key] ?? "0"), 0);
}

function BucketCard({
	label,
	value,
	highlight,
}: {
	label: string;
	value: number;
	highlight?: boolean;
}) {
	return (
		<Card className={highlight && value > 0 ? "border-red-200" : ""}>
			<CardContent className="flex flex-col gap-1 p-4">
				<p className="text-muted-foreground text-xs">{label}</p>
				<p
					className={`font-bold text-xl ${highlight && value > 0 ? "text-red-600" : "text-foreground"}`}
				>
					{formatGYD(value)}
				</p>
			</CardContent>
		</Card>
	);
}

// ── page ─────────────────────────────────────────────────────────────────

export default function AgingReportPage() {
	const { data: receivablesRaw, isLoading: loadingAR } = useQuery(
		orpc.invoices.getReceivableAging.queryOptions({ input: {} }),
	);
	const { data: payablesRaw, isLoading: loadingAP } = useQuery(
		orpc.invoices.getPayableAging.queryOptions({ input: {} }),
	);

	const receivables = (receivablesRaw as ReceivableRow[] | undefined) ?? [];
	const payables = (payablesRaw as PayableRow[] | undefined) ?? [];

	// Receivable totals per bucket
	const arCurrent = sumColumn(receivables, "current");
	const arDays30 = sumColumn(receivables, "days30");
	const arDays60 = sumColumn(receivables, "days60");
	const arDays90 = sumColumn(receivables, "days90");
	const arDays90plus = sumColumn(receivables, "days90plus");

	// Payable totals per bucket
	const apCurrent = sumColumn(payables, "current");
	const apDays30 = sumColumn(payables, "days30");
	const apDays60 = sumColumn(payables, "days60");
	const apDays90 = sumColumn(payables, "days90");
	const apDays90plus = sumColumn(payables, "days90plus");

	function exportReceivables() {
		downloadCsv(
			`aging-receivables-${new Date().toISOString().slice(0, 10)}.csv`,
			receivables.map((r) => ({
				Customer: r.customerName,
				Current: r.current,
				"1-30 Days": r.days30,
				"31-60 Days": r.days60,
				"61-90 Days": r.days90,
				"90+ Days": r.days90plus,
				Total: r.total,
			})),
		);
	}

	function exportPayables() {
		downloadCsv(
			`aging-payables-${new Date().toISOString().slice(0, 10)}.csv`,
			payables.map((r) => ({
				Supplier: r.supplierName,
				Current: r.current,
				"1-30 Days": r.days30,
				"31-60 Days": r.days60,
				"61-90 Days": r.days90,
				"90+ Days": r.days90plus,
				Total: r.total,
			})),
		);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div>
				<h1 className="font-bold text-2xl text-foreground tracking-tight">
					Aging Report
				</h1>
				<p className="text-muted-foreground text-sm">
					Outstanding balances by age bucket
				</p>
			</div>

			<Tabs defaultValue="receivables">
				<div className="flex items-center justify-between">
					<TabsList>
						<TabsTrigger value="receivables">Receivables (AR)</TabsTrigger>
						<TabsTrigger value="payables">Payables (AP)</TabsTrigger>
					</TabsList>
				</div>

				{/* ── Receivables ── */}
				<TabsContent value="receivables" className="mt-4 space-y-4">
					<div className="flex items-center justify-between">
						<p className="font-medium text-foreground text-sm">
							Accounts Receivable
						</p>
						<Button
							size="sm"
							variant="outline"
							className="gap-1"
							onClick={exportReceivables}
						>
							<Download className="size-4" />
							Export CSV
						</Button>
					</div>

					{/* Summary Cards */}
					{loadingAR ? (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-20 rounded-lg" />
							))}
						</div>
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
							<BucketCard label="Current" value={arCurrent} />
							<BucketCard label="1–30 Days" value={arDays30} highlight />
							<BucketCard label="31–60 Days" value={arDays60} highlight />
							<BucketCard label="61–90 Days" value={arDays90} highlight />
							<BucketCard label="90+ Days" value={arDays90plus} highlight />
						</div>
					)}

					{/* Detail Table */}
					<div className="rounded-lg border border-border">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="sticky left-0 bg-card text-xs">
											Customer
										</TableHead>
										<TableHead className="text-right text-xs">
											Current
										</TableHead>
										<TableHead className="text-right text-xs">1–30d</TableHead>
										<TableHead className="text-right text-xs">31–60d</TableHead>
										<TableHead className="text-right text-xs">61–90d</TableHead>
										<TableHead className="text-right text-xs">90+d</TableHead>
										<TableHead className="text-right font-semibold text-xs">
											Total
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loadingAR ? (
										Array.from({ length: 4 }).map((_, i) => (
											<TableRow key={i}>
												{Array.from({ length: 7 }).map((__, j) => (
													<TableCell key={j}>
														<Skeleton className="h-4 w-full rounded" />
													</TableCell>
												))}
											</TableRow>
										))
									) : receivables.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="py-10 text-center text-muted-foreground text-sm"
											>
												No outstanding receivables. Great job!
											</TableCell>
										</TableRow>
									) : (
										<>
											{receivables.map((row, i) => (
												<TableRow key={i} className="hover:bg-muted/50">
													<TableCell className="sticky left-0 bg-card font-medium text-sm">
														{row.customerName}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.current) > 0
															? formatGYD(Number(row.current))
															: "—"}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days30) > 0 ? (
															<span className="text-amber-600">
																{formatGYD(Number(row.days30))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days60) > 0 ? (
															<span className="text-orange-600">
																{formatGYD(Number(row.days60))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days90) > 0 ? (
															<span className="text-red-600">
																{formatGYD(Number(row.days90))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days90plus) > 0 ? (
															<span className="font-semibold text-red-700">
																{formatGYD(Number(row.days90plus))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right font-semibold text-sm">
														{formatGYD(Number(row.total))}
													</TableCell>
												</TableRow>
											))}
											{/* Totals Row */}
											<TableRow className="border-t-2 bg-muted/30 font-semibold">
												<TableCell className="sticky left-0 bg-muted/30 text-sm">
													Total
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(arCurrent)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(arDays30)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(arDays60)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(arDays90)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(arDays90plus)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(
														arCurrent +
															arDays30 +
															arDays60 +
															arDays90 +
															arDays90plus,
													)}
												</TableCell>
											</TableRow>
										</>
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</TabsContent>

				{/* ── Payables ── */}
				<TabsContent value="payables" className="mt-4 space-y-4">
					<div className="flex items-center justify-between">
						<p className="font-medium text-foreground text-sm">
							Accounts Payable
						</p>
						<Button
							size="sm"
							variant="outline"
							className="gap-1"
							onClick={exportPayables}
						>
							<Download className="size-4" />
							Export CSV
						</Button>
					</div>

					{/* Summary Cards */}
					{loadingAP ? (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-20 rounded-lg" />
							))}
						</div>
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
							<BucketCard label="Current" value={apCurrent} />
							<BucketCard label="1–30 Days" value={apDays30} highlight />
							<BucketCard label="31–60 Days" value={apDays60} highlight />
							<BucketCard label="61–90 Days" value={apDays90} highlight />
							<BucketCard label="90+ Days" value={apDays90plus} highlight />
						</div>
					)}

					{/* Detail Table */}
					<div className="rounded-lg border border-border">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="sticky left-0 bg-card text-xs">
											Supplier
										</TableHead>
										<TableHead className="text-right text-xs">
											Current
										</TableHead>
										<TableHead className="text-right text-xs">1–30d</TableHead>
										<TableHead className="text-right text-xs">31–60d</TableHead>
										<TableHead className="text-right text-xs">61–90d</TableHead>
										<TableHead className="text-right text-xs">90+d</TableHead>
										<TableHead className="text-right font-semibold text-xs">
											Total
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loadingAP ? (
										Array.from({ length: 4 }).map((_, i) => (
											<TableRow key={i}>
												{Array.from({ length: 7 }).map((__, j) => (
													<TableCell key={j}>
														<Skeleton className="h-4 w-full rounded" />
													</TableCell>
												))}
											</TableRow>
										))
									) : payables.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="py-10 text-center text-muted-foreground text-sm"
											>
												No outstanding payables.
											</TableCell>
										</TableRow>
									) : (
										<>
											{payables.map((row, i) => (
												<TableRow key={i} className="hover:bg-muted/50">
													<TableCell className="sticky left-0 bg-card font-medium text-sm">
														{row.supplierName}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.current) > 0
															? formatGYD(Number(row.current))
															: "—"}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days30) > 0 ? (
															<span className="text-amber-600">
																{formatGYD(Number(row.days30))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days60) > 0 ? (
															<span className="text-orange-600">
																{formatGYD(Number(row.days60))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days90) > 0 ? (
															<span className="text-red-600">
																{formatGYD(Number(row.days90))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right text-xs">
														{Number(row.days90plus) > 0 ? (
															<span className="font-semibold text-red-700">
																{formatGYD(Number(row.days90plus))}
															</span>
														) : (
															"—"
														)}
													</TableCell>
													<TableCell className="text-right font-semibold text-sm">
														{formatGYD(Number(row.total))}
													</TableCell>
												</TableRow>
											))}
											{/* Totals Row */}
											<TableRow className="border-t-2 bg-muted/30 font-semibold">
												<TableCell className="sticky left-0 bg-muted/30 text-sm">
													Total
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(apCurrent)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(apDays30)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(apDays60)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(apDays90)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(apDays90plus)}
												</TableCell>
												<TableCell className="text-right text-sm">
													{formatGYD(
														apCurrent +
															apDays30 +
															apDays60 +
															apDays90 +
															apDays90plus,
													)}
												</TableCell>
											</TableRow>
										</>
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
