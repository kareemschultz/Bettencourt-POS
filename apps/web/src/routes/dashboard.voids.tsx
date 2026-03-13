import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatGYD } from "@/lib/types";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function defaultStartDate(): string {
	const d = new Date();
	d.setDate(d.getDate() - 30);
	return d.toISOString().slice(0, 10);
}

type VoidSummary = {
	user_name: string;
	user_id: string;
	void_count: number;
	voided_total: string;
	last_void_at: string;
};

type VoidDetail = {
	order_number: string;
	total: string;
	status: string;
	created_at: string;
	notes: string | null;
	user_name: string;
};

export default function VoidsReportPage() {
	const [startDate, setStartDate] = useState(defaultStartDate());
	const [endDate, setEndDate] = useState(todayGY());

	const { data: raw, isLoading } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "voids", startDate, endDate },
		}),
	);

	const data = raw as
		| { summary: VoidSummary[]; details: VoidDetail[] }
		| undefined;

	const summary = data?.summary ?? [];
	const details = data?.details ?? [];

	const totalVoids = summary.reduce((sum, s) => sum + s.void_count, 0);
	const totalVoidedAmount = summary.reduce(
		(sum, s) => sum + Number(s.voided_total),
		0,
	);

	function handleExport() {
		downloadCsv(
			`voids-report-${startDate}-to-${endDate}.csv`,
			details.map((d) => ({
				"Order #": d.order_number,
				Status: d.status,
				Total: d.total,
				Employee: d.user_name,
				Date: new Date(d.created_at).toLocaleDateString(),
				Reason: d.notes || "",
			})),
		);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Void & Comp Report
					</h1>
					<p className="text-muted-foreground text-sm">
						Track voided and refunded orders by employee
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5">
						<Label className="text-xs">From</Label>
						<Input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="h-8 w-36 text-xs"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<Label className="text-xs">To</Label>
						<Input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="h-8 w-36 text-xs"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExport}
						disabled={details.length === 0}
					>
						<Download className="mr-1 size-3.5" /> CSV
					</Button>
				</div>
			</div>

			{/* KPI Cards */}
			{isLoading ? (
				<div className="grid grid-cols-2 gap-4">
					<Skeleton className="h-24 rounded-lg" />
					<Skeleton className="h-24 rounded-lg" />
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">
								Total Voids
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{totalVoids}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">
								Total Voided Amount
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl text-destructive">
								{formatGYD(totalVoidedAmount)}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">
								Avg per Void
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{totalVoids > 0
									? formatGYD(totalVoidedAmount / totalVoids)
									: "–"}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="text-muted-foreground text-xs font-normal">
								Employees with Voids
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{summary.length}</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* By Employee */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Voids by Employee</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Employee</TableHead>
								<TableHead className="text-right">Void Count</TableHead>
								<TableHead className="text-right">Voided Total</TableHead>
								<TableHead className="text-right">Last Void</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{summary.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="py-8 text-center text-muted-foreground"
									>
										No voids in this period
									</TableCell>
								</TableRow>
							) : (
								summary.map((s) => (
									<TableRow key={s.user_id}>
										<TableCell className="font-medium">
											{s.user_name}
										</TableCell>
										<TableCell className="text-right">
											{s.void_count}
											{s.void_count >= 5 && (
												<AlertTriangle className="ml-1 inline size-3 text-amber-500" />
											)}
										</TableCell>
										<TableCell className="text-right text-destructive">
											{formatGYD(Number(s.voided_total))}
										</TableCell>
										<TableCell className="text-right text-muted-foreground text-xs">
											{new Date(s.last_void_at).toLocaleDateString()}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Recent Void Details */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Recent Voided Orders (Last 50)
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Order #</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Employee</TableHead>
								<TableHead className="text-right">Amount</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Reason</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{details.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="py-8 text-center text-muted-foreground"
									>
										No voided orders found
									</TableCell>
								</TableRow>
							) : (
								details.map((d, i) => (
									<TableRow key={i}>
										<TableCell className="font-mono font-medium">
											#{d.order_number}
										</TableCell>
										<TableCell>
											<Badge
												variant="secondary"
												className={
													d.status === "voided"
														? "bg-red-100 text-red-800"
														: "bg-orange-100 text-orange-800"
												}
											>
												{d.status}
											</Badge>
										</TableCell>
										<TableCell>{d.user_name}</TableCell>
										<TableCell className="text-right">
											{formatGYD(Number(d.total))}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(d.created_at).toLocaleString("en-GY", {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</TableCell>
										<TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
											{d.notes || "–"}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
