import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts"

interface HourlySalesChartProps {
  data: { hour: string; orders: number; revenue: number }[]
}

function formatGYD(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function HourlySalesChart({ data }: HourlySalesChartProps) {
  if (data.every((d) => d.orders === 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No sales data for today yet. Open the POS to start selling.
      </div>
    )
  }

  return (
    <div className="h-[220px] w-full sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
            formatter={(value: number, name: string) => [
              name === "revenue" ? formatGYD(value) : value,
              name === "revenue" ? "Revenue" : "Orders",
            ]}
          />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            opacity={0.8}
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--chart-2))" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
