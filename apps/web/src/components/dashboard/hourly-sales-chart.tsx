import {
	Bar,
	ComposedChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

interface HourlySalesChartProps {
	data: { hour: string; orders: number; revenue: number }[];
}

function formatGYD(amount: number): string {
	return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function HourlySalesChart({ data }: HourlySalesChartProps) {
	if (data.every((d) => d.orders === 0)) {
		return (
			<div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
				No sales data for today yet. Open the POS to start selling.
			</div>
		);
	}

	return (
		<div className="h-[220px] w-full overflow-visible sm:h-[260px]">
			<ResponsiveContainer width="100%" height="100%">
				<ComposedChart
					data={data}
					margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
				>
					<XAxis
						dataKey="hour"
						className="text-[10px] sm:text-xs"
						tick={{ fill: "hsl(var(--muted-foreground))" }}
						tickLine={false}
						axisLine={false}
					/>
					<YAxis
						yAxisId="revenue"
						orientation="left"
						tickFormatter={(v) => formatGYD(v)}
						className="text-[10px] sm:text-xs"
						tick={{ fill: "hsl(var(--muted-foreground))" }}
						tickLine={false}
						axisLine={false}
						width={70}
					/>
					<YAxis
						yAxisId="orders"
						orientation="right"
						className="text-[10px]"
						tick={{ fill: "hsl(var(--muted-foreground))" }}
						tickLine={false}
						axisLine={false}
						width={30}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "hsl(var(--card))",
							border: "1px solid hsl(var(--border))",
							borderRadius: "8px",
							fontSize: "12px",
						}}
						formatter={
							((value: number | undefined, name: string | undefined) => [
								name === "revenue" ? formatGYD(value ?? 0) : (value ?? 0),
								name === "revenue" ? "Revenue" : "Orders",
							]) as never
						}
					/>
					<Bar
						yAxisId="revenue"
						dataKey="revenue"
						fill="#10b981"
						radius={[4, 4, 0, 0]}
						opacity={0.85}
					/>
					<Line
						yAxisId="orders"
						type="monotone"
						dataKey="orders"
						stroke="#3b82f6"
						strokeWidth={2}
						dot={{ r: 3, fill: "#3b82f6" }}
					/>
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}
