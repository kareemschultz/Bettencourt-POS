import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Package, Search, Download, ShoppingCart } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function StockBar({ qty, reorder, max }: { qty: number; reorder: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (qty / max) * 100) : 0
  const color = qty <= reorder * 0.5 ? "bg-red-500" : qty <= reorder ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
    </div>
  )
}

export function StockLevels() {
  const [search, setSearch] = useState("")
  const [showLowOnly, setShowLowOnly] = useState(false)

  const { data: inventory = [], isLoading } = useSWR(
    `/api/inventory?lowStock=${showLowOnly}`,
    fetcher
  )

  const filtered = inventory.filter((item: Record<string, unknown>) =>
    !search || (item.product_name as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (item.sku as string)?.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockItems = inventory.filter(
    (i: Record<string, unknown>) => Number(i.quantity) <= Number(i.reorder_point)
  )
  const criticalItems = inventory.filter(
    (i: Record<string, unknown>) => Number(i.quantity) <= Number(i.reorder_point) * 0.5
  )

  const totalValue = inventory.reduce(
    (sum: number, i: Record<string, unknown>) => sum + Number(i.quantity || 0) * Number(i.cost || 0), 0
  )

  function exportCSV() {
    const headers = "Product,SKU,Location,Quantity,Reorder Point,Category,Status\n"
    const rows = filtered.map((i: Record<string, unknown>) => {
      const isLow = Number(i.quantity) <= Number(i.reorder_point)
      const isCritical = Number(i.quantity) <= Number(i.reorder_point) * 0.5
      return `"${i.product_name}","${i.sku || ""}","${i.location_name}",${i.quantity},${i.reorder_point},"${i.reporting_category || ""}","${isCritical ? "Critical" : isLow ? "Low" : "OK"}"`
    }).join("\n")
    const blob = new Blob([headers + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className={`flex items-center gap-3 rounded-lg border-2 p-3 ${criticalItems.length > 0 ? "border-red-500/50 bg-red-50 dark:bg-red-950/20" : "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"}`}>
          <AlertTriangle className={`size-5 shrink-0 ${criticalItems.length > 0 ? "text-red-600" : "text-amber-600"}`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${criticalItems.length > 0 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
              {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} below reorder point
              {criticalItems.length > 0 && (
                <span className="ml-1 text-red-700 dark:text-red-400">({criticalItems.length} critical)</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {lowStockItems.slice(0, 3).map((i: Record<string, unknown>) => i.product_name as string).join(", ")}
              {lowStockItems.length > 3 && ` and ${lowStockItems.length - 3} more`}
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs" onClick={() => setShowLowOnly(true)}>
            <ShoppingCart className="size-3" /> View All
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Items</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{inventory.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Low Stock</CardTitle>
            <AlertTriangle className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStockItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Critical</CardTitle>
            <AlertTriangle className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showLowOnly ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowLowOnly(!showLowOnly)}
          >
            <AlertTriangle className="size-3.5" />
            {showLowOnly ? "Show All" : "Low Stock Only"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Table with Progress Bars */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reorder Pt</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No inventory items found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item: Record<string, unknown>) => {
                    const qty = Number(item.quantity || 0)
                    const reorder = Number(item.reorder_point || 0)
                    const maxLevel = Math.max(reorder * 3, qty, 100) // estimate max
                    const isLow = qty <= reorder
                    const isCritical = qty <= reorder * 0.5
                    return (
                      <TableRow key={item.id as string} className={isCritical ? "bg-red-50/50 dark:bg-red-950/10" : isLow ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                        <TableCell className="font-medium text-foreground">{item.product_name as string}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{(item.sku as string) || "---"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.location_name as string}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">{qty}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{reorder}</TableCell>
                        <TableCell>
                          <StockBar qty={qty} reorder={reorder} max={maxLevel} />
                        </TableCell>
                        <TableCell>
                          {isCritical ? (
                            <Badge variant="destructive" className="gap-1 text-[10px]">
                              <AlertTriangle className="size-2.5" /> Critical
                            </Badge>
                          ) : isLow ? (
                            <Badge className="gap-1 bg-amber-500 text-[10px] text-white hover:bg-amber-600">
                              Reorder Needed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
