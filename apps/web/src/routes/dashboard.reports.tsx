import { useQuery } from "@tanstack/react-query";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function ReportsPage() {
	const today = todayGY();
	const d = new Date(`${today}T00:00:00-04:00`);
	d.setDate(d.getDate() - 7);
	const sevenDaysAgo = d.toLocaleDateString("en-CA", {
		timeZone: "America/Guyana",
	});

	const { data: deptData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: {
				type: "department-totals",
				startDate: sevenDaysAgo,
				endDate: today,
			},
		}),
	);
	const { data: productData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "product-sales", startDate: sevenDaysAgo, endDate: today },
		}),
	);
	const { data: dailyData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: { type: "sales-by-day", startDate: sevenDaysAgo, endDate: today },
		}),
	);
	const { data: paymentData } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: {
				type: "sales-by-payment",
				startDate: sevenDaysAgo,
				endDate: today,
			},
		}),
	);
	const { data: cashierData, isLoading } = useQuery(
		orpc.reports.getReport.queryOptions({
			input: {
				type: "cashier-activity",
				startDate: sevenDaysAgo,
				endDate: today,
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

	return (
		<div className="p-4 md:p-6">
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
