import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function ProductionReportPage() {
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

	return (
		<div className="space-y-6 p-4 md:p-6">
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
						onClick={() => window.print()}
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
							<th className="p-3 text-center font-medium">Closing</th>
							<th className="p-3 text-center font-medium">Expected Sold</th>
							<th className="p-3 text-center font-medium">Actual Sold</th>
							<th className="p-3 text-center font-medium">Variance</th>
						</tr>
					</thead>
					<tbody>
						{isLoading ? (
							<tr>
								<td
									colSpan={7}
									className="p-8 text-center text-muted-foreground"
								>
									Loading...
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td
									colSpan={7}
									className="p-8 text-center text-muted-foreground"
								>
									No Check Off data for {date}
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<tr key={row.productId} className="border-t hover:bg-muted/30">
									<td className="p-3 font-medium">{row.productName}</td>
									<td className="p-3 text-center text-muted-foreground">
										{row.opening}
									</td>
									<td className="p-3 text-center text-muted-foreground">
										{row.reorder}
									</td>
									<td className="p-3 text-center text-muted-foreground">
										{row.closing}
									</td>
									<td className="p-3 text-center font-semibold">
										{row.expected}
									</td>
									<td className="p-3 text-center">{row.actual}</td>
									<td className="p-3 text-center">
										<Badge
											variant={row.variance === 0 ? "secondary" : "destructive"}
											className={
												row.variance > 0
													? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100"
													: row.variance === 0
														? ""
														: ""
											}
										>
											{row.variance > 0 ? "+" : ""}
											{row.variance}
										</Badge>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			{/* Print footer */}
			<div className="mt-8 hidden border-t pt-2 text-center text-muted-foreground text-xs print:block">
				Bettencourt's Food Inc. · Production Report ·{" "}
				{new Date().toLocaleString("en-GY")}
			</div>
		</div>
	);
}
