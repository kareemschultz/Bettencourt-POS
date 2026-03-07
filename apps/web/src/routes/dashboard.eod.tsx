import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function EodReportPage() {
	const [date, setDate] = useState(todayGY());

	const { data: report, isLoading } = useQuery(
		orpc.reports.getEodReport.queryOptions({ input: { date } }),
	);

	const sales = report?.sales as Record<string, unknown> | undefined;
	const payments = (report?.payments ?? []) as Array<Record<string, unknown>>;
	const cashSessions = (report?.cashSessions ?? []) as Array<
		Record<string, unknown>
	>;
	const voids = (report?.voids ?? []) as Array<Record<string, unknown>>;
	const topProducts = (report?.topProducts ?? []) as Array<
		Record<string, unknown>
	>;
	const departments = (report?.departments ?? []) as Array<
		Record<string, unknown>
	>;
	const labor = (report?.labor ?? []) as Array<Record<string, unknown>>;

	const totalVoids = voids.reduce((sum, v) => sum + Number(v.voided_total), 0);
	const totalVoidCount = voids.reduce(
		(sum, v) => sum + Number(v.void_count),
		0,
	);

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header — hidden in print */}
			<div className="flex items-center justify-between print:hidden">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<FileText className="size-6 text-primary" /> End-of-Day Report
					</h1>
					<p className="text-muted-foreground text-sm">
						Daily business summary for reconciliation and review. Select a date
						and print for your records.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Input
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
						className="w-auto"
						aria-label="Report date"
					/>
					<Button className="gap-2" onClick={() => window.print()}>
						<Printer className="size-4" /> Print
					</Button>
				</div>
			</div>

			{/* Print header — only visible in print */}
			<div className="mb-6 hidden border-b pb-4 print:block">
				<div className="flex items-start justify-between">
					<div>
						<h1 className="font-bold text-xl">Bettencourt's Food Inc.</h1>
						<p className="text-muted-foreground text-sm">
							Main Location, Georgetown, Guyana
						</p>
					</div>
					<div className="text-right">
						<p className="font-bold text-base">End-of-Day Report</p>
						<p className="text-sm">{date}</p>
						<p className="text-muted-foreground text-xs">
							Generated: {new Date().toLocaleString("en-GY")}
						</p>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : (
				<div className="grid gap-4 print:gap-2">
					{/* ── Sales Summary ─────────────────────────────────────── */}
					<Card className="print:border print:shadow-none">
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Sales Summary</CardTitle>
							<CardDescription>
								Revenue, order count, average ticket, tax, and discounts for the
								day.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
								<SummaryItem
									label="Orders"
									value={String(sales?.order_count ?? 0)}
								/>
								<SummaryItem
									label="Revenue"
									value={formatGYD(Number(sales?.total_revenue ?? 0))}
									highlight
								/>
								<SummaryItem
									label="Avg Ticket"
									value={formatGYD(Number(sales?.avg_ticket ?? 0))}
								/>
								<SummaryItem
									label="Tax Collected"
									value={formatGYD(Number(sales?.total_tax ?? 0))}
								/>
								<SummaryItem
									label="Discounts"
									value={formatGYD(Number(sales?.total_discounts ?? 0))}
								/>
							</div>
						</CardContent>
					</Card>

					<div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
						{/* ── Payment Breakdown ────────────────────────────────── */}
						<Card className="print:border print:shadow-none">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Payments</CardTitle>
								<CardDescription>
									Breakdown by payment method (cash, card, etc.).
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Method</TableHead>
											<TableHead className="text-right">Count</TableHead>
											<TableHead className="text-right">Total</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{payments.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={3}
													className="py-4 text-center text-muted-foreground"
												>
													No payments
												</TableCell>
											</TableRow>
										) : (
											payments.map((p, i) => (
												<TableRow key={i}>
													<TableCell className="font-medium capitalize">
														{String(p.method)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{String(p.count)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatGYD(Number(p.total))}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>

						{/* ── Cash Sessions ────────────────────────────────────── */}
						<Card className="print:border print:shadow-none">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Cash Drawer</CardTitle>
								<CardDescription>
									Opening float, expected cash, closing count, and variance per
									session.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Opened By</TableHead>
											<TableHead className="text-right">Float</TableHead>
											<TableHead className="text-right">Expected</TableHead>
											<TableHead className="text-right">Counted</TableHead>
											<TableHead className="text-right">Variance</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{cashSessions.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={5}
													className="py-4 text-center text-muted-foreground"
												>
													No cash sessions
												</TableCell>
											</TableRow>
										) : (
											cashSessions.map((cs, i) => {
												const variance = Number(cs.variance ?? 0);
												return (
													<TableRow key={i}>
														<TableCell className="font-medium">
															{String(cs.opened_by_name)}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatGYD(Number(cs.opening_float ?? 0))}
														</TableCell>
														<TableCell className="text-right font-mono">
															{formatGYD(Number(cs.expected_cash ?? 0))}
														</TableCell>
														<TableCell className="text-right font-mono">
															{cs.closing_count != null
																? formatGYD(Number(cs.closing_count))
																: "—"}
														</TableCell>
														<TableCell className="text-right font-mono">
															{cs.variance != null ? (
																<span
																	className={
																		variance === 0
																			? "text-green-600"
																			: variance > 0
																				? "text-amber-600"
																				: "text-red-600"
																	}
																>
																	{variance >= 0 ? "+" : ""}
																	{formatGYD(variance)}
																</span>
															) : (
																"—"
															)}
														</TableCell>
													</TableRow>
												);
											})
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
						{/* ── Top Products ─────────────────────────────────────── */}
						<Card className="print:border print:shadow-none">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Top 10 Products</CardTitle>
								<CardDescription>
									Best-selling items by quantity and revenue.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>#</TableHead>
											<TableHead>Product</TableHead>
											<TableHead className="text-right">Qty</TableHead>
											<TableHead className="text-right">Revenue</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{topProducts.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={4}
													className="py-4 text-center text-muted-foreground"
												>
													No sales data
												</TableCell>
											</TableRow>
										) : (
											topProducts.map((p, i) => (
												<TableRow key={i}>
													<TableCell className="text-muted-foreground">
														{i + 1}
													</TableCell>
													<TableCell className="font-medium">
														{String(p.product_name)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{String(p.qty_sold)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatGYD(Number(p.revenue))}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>

						{/* ── Department Breakdown ─────────────────────────────── */}
						<Card className="print:border print:shadow-none">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Departments</CardTitle>
								<CardDescription>Sales split by department.</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Department</TableHead>
											<TableHead className="text-right">Orders</TableHead>
											<TableHead className="text-right">Revenue</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{departments.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={3}
													className="py-4 text-center text-muted-foreground"
												>
													No data
												</TableCell>
											</TableRow>
										) : (
											departments.map((d, i) => (
												<TableRow key={i}>
													<TableCell className="font-medium">
														{String(d.department)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{String(d.order_count)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{formatGYD(Number(d.revenue))}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
						{/* ── Voids & Refunds ──────────────────────────────────── */}
						<Card className="print:border print:shadow-none">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									Voids & Refunds
									{totalVoidCount > 0 && (
										<Badge variant="destructive" className="text-[10px]">
											{totalVoidCount} void{totalVoidCount !== 1 ? "s" : ""} —{" "}
											{formatGYD(totalVoids)}
										</Badge>
									)}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Employee</TableHead>
											<TableHead className="text-right">Count</TableHead>
											<TableHead className="text-right">Total</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{voids.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={3}
													className="py-4 text-center text-muted-foreground"
												>
													No voids today
												</TableCell>
											</TableRow>
										) : (
											voids.map((v, i) => (
												<TableRow key={i}>
													<TableCell className="font-medium">
														{String(v.user_name)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{String(v.void_count)}
													</TableCell>
													<TableCell className="text-right font-mono text-destructive">
														{formatGYD(Number(v.voided_total))}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>

						{/* ── Labor Summary ────────────────────────────────────── */}
						<Card className="print:border print:shadow-none">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Labor</CardTitle>
								<CardDescription>
									Employee shifts and hours worked.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Employee</TableHead>
											<TableHead className="text-right">Shifts</TableHead>
											<TableHead className="text-right">Net Hours</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{labor.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={3}
													className="py-4 text-center text-muted-foreground"
												>
													No time entries
												</TableCell>
											</TableRow>
										) : (
											labor.map((l, i) => (
												<TableRow key={i}>
													<TableCell className="font-medium">
														{String(l.employee_name)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{String(l.shift_count)}
													</TableCell>
													<TableCell className="text-right font-mono">
														{Number(l.net_hours).toFixed(1)}h
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>
				</div>
			)}

			{/* Print footer */}
			<div className="mt-8 hidden border-t pt-2 text-center text-muted-foreground text-xs print:block">
				Bettencourt's Food Inc. · End-of-Day Report ·{" "}
				{new Date().toLocaleString("en-GY")}
			</div>
		</div>
	);
}

function SummaryItem({
	label,
	value,
	highlight,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span
				className={`font-bold font-mono text-lg ${highlight ? "text-primary" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}
