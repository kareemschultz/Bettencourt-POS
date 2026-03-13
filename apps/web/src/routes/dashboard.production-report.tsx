import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function ProductionReportPage() {
	const pageRef = useRef<HTMLDivElement>(null);
	const [date, setDate] = useState(todayGY());
	const [workflow, setWorkflow] = useState<"restaurant" | "bakery">(
		"restaurant",
	);

	const { data, isLoading } = useQuery(
		orpc.production.getReport.queryOptions({ input: { date, workflow } }),
	);

	const rows = data?.rows ?? [];
	const balanced = rows.filter((r) => r.variance === 0).length;
	const short = rows.filter((r) => r.variance < 0).length;
	const over = rows.filter((r) => r.variance > 0).length;

	// Sort: short (negative) first → over (positive) → balanced
	const sortedRows = [...rows].sort((a, b) => {
		if (a.variance < 0 && b.variance >= 0) return -1;
		if (a.variance >= 0 && b.variance < 0) return 1;
		if (a.variance > 0 && b.variance === 0) return -1;
		if (a.variance === 0 && b.variance > 0) return 1;
		return a.variance - b.variance;
	});

	const totals = rows.reduce(
		(acc, r) => ({
			opening: acc.opening + r.opening,
			reorder: acc.reorder + r.reorder,
			closing: acc.closing + r.closing,
			expected: acc.expected + r.expected,
			actual: acc.actual + r.actual,
		}),
		{ opening: 0, reorder: 0, closing: 0, expected: 0, actual: 0 },
	);

	return (
		<div ref={pageRef} className="space-y-6 p-4 md:p-6">
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
						<p className="font-bold text-base">Production Report</p>
						<p className="text-sm capitalize">
							{workflow} · {date}
						</p>
						<p className="text-muted-foreground text-xs">
							Generated: {new Date().toLocaleString("en-GY")}
						</p>
					</div>
				</div>
			</div>

			{/* Screen header — hidden in print */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
				<div>
					<h1 className="font-bold text-2xl">Production Report</h1>
					<p className="text-muted-foreground text-sm">
						Expected (Check Off) vs Actual (Register) — variance per item
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="flex overflow-hidden rounded-md border">
						<button
							type="button"
							onClick={() => setWorkflow("restaurant")}
							className={`px-3 py-1.5 font-medium text-sm transition-colors ${workflow === "restaurant" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
						>
							Restaurant
						</button>
						<button
							type="button"
							onClick={() => setWorkflow("bakery")}
							className={`border-l px-3 py-1.5 font-medium text-sm transition-colors ${workflow === "bakery" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
						>
							Bakery
						</button>
					</div>
					<div className="flex items-center gap-1">
						<Button
							size="icon"
							variant="outline"
							className="size-8"
							onClick={() => {
								const d = new Date(date);
								d.setDate(d.getDate() - 1);
								setDate(d.toISOString().split("T")[0]);
							}}
						>
							<ChevronLeft className="size-4" />
						</Button>
						<Input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="w-36"
						/>
						<Button
							size="icon"
							variant="outline"
							className="size-8"
							disabled={date >= todayGY()}
							onClick={() => {
								const d = new Date(date);
								d.setDate(d.getDate() + 1);
								setDate(d.toISOString().split("T")[0]);
							}}
						>
							<ChevronRight className="size-4" />
						</Button>
					</div>
					<Button
						size="sm"
						variant={date === todayGY() ? "default" : "outline"}
						onClick={() => setDate(todayGY())}
					>
						Today
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() => {
							const el = pageRef.current;
							if (!el) {
								window.print();
								return;
							}
							const win = window.open(
								"",
								"_blank",
								"width=900,height=700,menubar=no,toolbar=no,scrollbars=yes",
							);
							if (!win) {
								window.print();
								return;
							}
							for (const link of document.querySelectorAll<HTMLLinkElement>(
								'link[rel="stylesheet"]',
							)) {
								const newLink = win.document.createElement("link");
								newLink.rel = "stylesheet";
								newLink.href = link.href;
								win.document.head.appendChild(newLink);
							}
							win.document.body.appendChild(win.document.importNode(el, true));
							win.focus();
							setTimeout(() => {
								win.print();
								win.close();
							}, 600);
						}}
					>
						<Printer className="size-4" />
						Print
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-4">
				<div className="rounded-lg border p-4 text-center">
					<div className="font-bold text-3xl text-emerald-600">{balanced}</div>
					<div className="mt-1 text-muted-foreground text-sm">Balanced</div>
				</div>
				<div className="rounded-lg border p-4 text-center">
					<div className="font-bold text-3xl text-red-600">{short}</div>
					<div className="mt-1 text-muted-foreground text-sm">Short</div>
				</div>
				<div className="rounded-lg border p-4 text-center">
					<div className="font-bold text-3xl text-amber-600">{over}</div>
					<div className="mt-1 text-muted-foreground text-sm">Over</div>
				</div>
			</div>

			<div className="overflow-hidden rounded-lg border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50">
						<tr>
							<th className="p-3 text-left font-medium">Item</th>
							<th className="p-3 text-center font-medium">Opening</th>
							<th className="p-3 text-center font-medium">Reorder</th>
							<th className="p-3 text-center font-medium text-amber-700 dark:text-amber-400">
								Closing
							</th>
							<th className="p-3 text-center font-medium">Expected Sold</th>
							<th className="p-3 text-center font-medium">Actual Sold</th>
							<th className="p-3 text-center font-medium">% Sold</th>
							<th className="p-3 text-center font-medium">Variance</th>
						</tr>
					</thead>
					<tbody>
						{isLoading ? (
							<tr>
								<td
									colSpan={8}
									className="p-8 text-center text-muted-foreground"
								>
									<Skeleton className="h-4 w-full" />
								</td>
							</tr>
						) : sortedRows.length === 0 ? (
							<tr>
								<td
									colSpan={8}
									className="p-8 text-center text-muted-foreground"
								>
									No Check Off data for {date}
								</td>
							</tr>
						) : (
							<>
								{sortedRows.map((row) => {
									const pctSold =
										row.expected > 0
											? Math.round((row.actual / row.expected) * 100)
											: null;
									return (
										<tr
											key={row.productId}
											className="border-t hover:bg-muted/30"
										>
											<td className="p-3 font-medium">{row.productName}</td>
											<td className="p-3 text-center text-muted-foreground">
												{row.opening}
											</td>
											<td className="p-3 text-center text-muted-foreground">
												{row.reorder}
											</td>
											<td
												className={`p-3 text-center font-medium ${row.closing > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
											>
												{row.closing}
											</td>
											<td className="p-3 text-center font-semibold">
												{row.expected}
											</td>
											<td className="p-3 text-center">{row.actual}</td>
											<td className="p-3 text-center text-muted-foreground">
												{pctSold !== null ? `${pctSold}%` : "—"}
											</td>
											<td className="p-3 text-center">
												<Badge
													variant={
														row.variance === 0 ? "secondary" : "destructive"
													}
													className={
														row.variance > 0
															? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100"
															: ""
													}
												>
													{row.variance > 0 ? "+" : ""}
													{row.variance}
												</Badge>
											</td>
										</tr>
									);
								})}
								{sortedRows.length > 1 && (
									<tr className="border-t bg-muted/30 font-semibold">
										<td className="p-3">Totals</td>
										<td className="p-3 text-center">{totals.opening}</td>
										<td className="p-3 text-center">{totals.reorder}</td>
										<td
											className={`p-3 text-center ${totals.closing > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
										>
											{totals.closing}
										</td>
										<td className="p-3 text-center">{totals.expected}</td>
										<td className="p-3 text-center">{totals.actual}</td>
										<td className="p-3 text-center text-muted-foreground">
											{totals.expected > 0
												? `${Math.round((totals.actual / totals.expected) * 100)}%`
												: "—"}
										</td>
										<td className="p-3 text-center">
											<Badge
												variant={
													totals.actual - totals.expected === 0
														? "secondary"
														: totals.actual - totals.expected < 0
															? "destructive"
															: "outline"
												}
												className={
													totals.actual - totals.expected > 0
														? "border-amber-200 bg-amber-100 text-amber-800"
														: ""
												}
											>
												{totals.actual - totals.expected > 0 ? "+" : ""}
												{totals.actual - totals.expected}
											</Badge>
										</td>
									</tr>
								)}
							</>
						)}
					</tbody>
				</table>
			</div>
			{rows.length > 0 && (
				<p className="text-muted-foreground text-xs print:hidden">
					<span className="font-medium text-amber-600">Closing</span> = leftover
					at end of day. <span className="font-medium">% Sold</span> = Actual ÷
					Expected. Combo sales are split into components in both Actual Sold
					and Variance columns.
				</p>
			)}
			{/* Print footer */}
			<div className="mt-8 hidden border-t pt-2 text-center text-muted-foreground text-xs print:block">
				Bettencourt's Food Inc. · Production Report ·{" "}
				{new Date().toLocaleString("en-GY")}
			</div>
		</div>
	);
}
