import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type Preset = "today" | "7days" | "30days" | "custom";

function computeDateRange(
	preset: Preset,
	customFrom: string,
	customTo: string,
	today: string,
): { startDate: string; endDate: string } {
	if (preset === "today") return { startDate: today, endDate: today };
	if (preset === "30days") {
		const d = new Date(`${today}T00:00:00-04:00`);
		d.setDate(d.getDate() - 30);
		return {
			startDate: d.toLocaleDateString("en-CA", { timeZone: "America/Guyana" }),
			endDate: today,
		};
	}
	if (preset === "custom") {
		return { startDate: customFrom || today, endDate: customTo || today };
	}
	// default: 7days
	const d = new Date(`${today}T00:00:00-04:00`);
	d.setDate(d.getDate() - 7);
	return {
		startDate: d.toLocaleDateString("en-CA", { timeZone: "America/Guyana" }),
		endDate: today,
	};
}

export default function ReportsPage() {
	const today = todayGY();
	const [preset, setPreset] = useState<Preset>("7days");
	const [customFrom, setCustomFrom] = useState(today);
	const [customTo, setCustomTo] = useState(today);

	const { startDate, endDate } = computeDateRange(
		preset,
		customFrom,
		customTo,
		today,
	);

	const { data: deptData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: {
				type: "department-totals",
				startDate,
				endDate,
			},
		}),
	);
	const { data: productData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "product-sales", startDate, endDate },
		}),
	);
	const { data: dailyData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "sales-by-day", startDate, endDate },
		}),
	);
	const { data: paymentData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: {
				type: "sales-by-payment",
				startDate,
				endDate,
			},
		}),
	);
	const { data: cashierData, isLoading } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: {
				type: "cashier-activity",
				startDate,
				endDate,
			},
		}),
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20 text-muted-foreground">
				Loading reports...
			</div>
		);
	}

	const departmentTotals = Array.isArray(deptData) ? deptData : [];
	const productSales = Array.isArray(productData) ? productData : [];
	const dailySales = Array.isArray(dailyData) ? dailyData : [];
	const paymentMethods = Array.isArray(paymentData) ? paymentData : [];
	const cashierActivity = Array.isArray(cashierData) ? cashierData : [];

	const presets: { label: string; value: Preset }[] = [
		{ label: "Today", value: "today" },
		{ label: "Last 7 Days", value: "7days" },
		{ label: "Last 30 Days", value: "30days" },
		{ label: "Custom", value: "custom" },
	];

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex flex-wrap items-center gap-2">
				{presets.map((p) => (
					<Button
						key={p.value}
						variant={preset === p.value ? "default" : "outline"}
						size="sm"
						onClick={() => setPreset(p.value)}
					>
						{p.label}
					</Button>
				))}
				{preset === "custom" && (
					<>
						<Input
							type="date"
							aria-label="From date"
							value={customFrom}
							onChange={(e) => setCustomFrom(e.target.value)}
							className="w-auto"
						/>
						<span className="text-muted-foreground text-sm">to</span>
						<Input
							type="date"
							aria-label="To date"
							value={customTo}
							onChange={(e) => setCustomTo(e.target.value)}
							className="w-auto"
						/>
					</>
				)}
			</div>
			<ReportsDashboard
				departmentTotals={departmentTotals as Record<string, unknown>[]}
				productSales={productSales as Record<string, unknown>[]}
				dailySales={dailySales as Record<string, unknown>[]}
				paymentMethods={paymentMethods as Record<string, unknown>[]}
				cashierActivity={cashierActivity as Record<string, unknown>[]}
			/>
		</div>
	);
}
