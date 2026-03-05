import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DollarSign, CreditCard, Banknote, AlertTriangle, CheckCircle2, Scale, Package, Ban } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function VarianceBadge({ variance, threshold = 0 }: { variance: number; threshold?: number }) {
  if (variance === 0) return <Badge className="bg-emerald-600 text-white">Balanced</Badge>
  if (Math.abs(variance) <= threshold) return <Badge className="bg-amber-500 text-white">Minor ({fmt(variance)})</Badge>
  return <Badge variant="destructive">{variance > 0 ? "+" : ""}{fmt(variance)}</Badge>
}

export function ReconciliationDashboard() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const { data, isLoading } = useSWR(`/api/reconciliation?date=${date}`, fetcher, { refreshInterval: 30000 })

  const sp = data?.salesVsPayments || {}
  const cashSessions = data?.cashSessions || []
  const deptTotals = data?.departmentTotals || []
  const voidSummary = data?.voidSummary || []
  const prodVsSales = data?.productionVsSales || []

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Reconciliation</h1>
          <p className="text-sm text-muted-foreground">Does everything add up today?</p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading reconciliation data...</p>}

      {/* Top 4 reconciliation cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Sales vs Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="size-4 text-emerald-600" />
              Sales vs Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">POS Sales Total ({sp.order_count || 0} orders)</span>
                <span className="font-mono font-bold">{fmt(sp.total_sales || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-muted-foreground"><Banknote className="size-3" /> Cash</span>
                <span className="font-mono">{fmt(sp.cash_total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-muted-foreground"><CreditCard className="size-3" /> Card</span>
                <span className="font-mono">{fmt(sp.card_total || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-medium">Payment Total</span>
                <span className="font-mono font-bold">{fmt(sp.payment_total || 0)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Variance</span>
                <VarianceBadge variance={sp.variance || 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Drawer Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="size-4 text-blue-600" />
              Cash Drawer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cashSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cash sessions today</p>
            ) : (
              <div className="flex flex-col gap-3">
                {cashSessions.map((cs: Record<string, unknown>) => {
                  const variance = Number(cs.variance || 0)
                  return (
                    <div key={cs.id as string} className="rounded-lg border border-border p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold">{cs.register_name as string}</span>
                        <Badge variant={cs.status === "open" ? "default" : "secondary"} className="text-[10px]">
                          {cs.status as string}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Opening: {fmt(Number(cs.opening_float || 0))}</span>
                        <span>Expected: {fmt(Number(cs.expected_cash || 0))}</span>
                      </div>
                      {cs.status === "closed" && (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs">Counted: {fmt(Number(cs.closing_count || 0))}</span>
                          <VarianceBadge variance={variance} threshold={5} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Void/Refund Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ban className="size-4 text-red-600" />
              Voids & Refunds
              {(sp.void_count || 0) > 0 && <Badge variant="destructive" className="text-[10px]">{sp.void_count}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {voidSummary.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="size-4" /> No voids today
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="mb-2 flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="size-4" /> {fmt(sp.voided_total || 0)} voided
                </div>
                {voidSummary.map((v: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{(v.user_name as string) || "Unknown"}</span>
                    <span className="font-mono">{v.void_count as number}x = {fmt(Number(v.voided_total || 0))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Production vs Sales */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4 text-amber-600" />
              Production vs Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prodVsSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">No production logs for this date</p>
            ) : (
              <div className="flex flex-col gap-1">
                {prodVsSales.slice(0, 6).map((p: Record<string, unknown>, i: number) => {
                  const v = Number(p.variance || 0)
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="truncate">{p.product_name as string}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{p.expected_sold as number} exp / {p.actual_sold as number} sold</span>
                        {v === 0 ? <CheckCircle2 className="size-3 text-emerald-600" /> :
                         <span className={`font-mono font-bold ${v < 0 ? "text-red-600" : "text-amber-600"}`}>{v > 0 ? "+" : ""}{v}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Cross-Check Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4" />
            Department Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Line Item Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptTotals.map((d: Record<string, unknown>, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.department as string}</TableCell>
                  <TableCell className="text-right font-mono">{String(d.order_count)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(d.line_item_total || 0))}</TableCell>
                </TableRow>
              ))}
              {deptTotals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Production vs Sales detail table */}
      {prodVsSales.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Production vs Sales Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Produced</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead className="text-right">Expected Sold</TableHead>
                  <TableHead className="text-right">Actual Sold</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prodVsSales.map((p: Record<string, unknown>, i: number) => {
                  const v = Number(p.variance || 0)
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.product_name as string}</TableCell>
                      <TableCell className="text-right font-mono">{String(p.produced)}</TableCell>
                      <TableCell className="text-right font-mono">{String(p.closing_stock)}</TableCell>
                      <TableCell className="text-right font-mono">{String(p.expected_sold)}</TableCell>
                      <TableCell className="text-right font-mono">{String(p.actual_sold)}</TableCell>
                      <TableCell className="text-right">
                        {v === 0 ? <CheckCircle2 className="ml-auto size-4 text-emerald-600" /> :
                         <span className={`font-mono font-bold ${v < 0 ? "text-red-600" : "text-amber-600"}`}>{v > 0 ? "+" : ""}{v}</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
