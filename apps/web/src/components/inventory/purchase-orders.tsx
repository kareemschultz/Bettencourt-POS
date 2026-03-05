import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText } from "lucide-react"

const fetcher = (url: string) => fetch(url).then(r => r.json())

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  submitted: "outline",
  partial: "default",
  received: "default",
  cancelled: "destructive"
}

export function PurchaseOrders() {
  const { data: orders = [], isLoading } = useSWR("/api/inventory/purchase-orders", fetcher)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Purchase Orders</h3>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No purchase orders yet
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((po: Record<string, unknown>) => (
                    <TableRow key={po.id as string}>
                      <TableCell className="font-mono font-medium text-foreground">{po.po_number as string}</TableCell>
                      <TableCell className="text-foreground">{po.supplier_name as string}</TableCell>
                      <TableCell className="text-muted-foreground">{po.location_name as string}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{String(po.item_count)}</TableCell>
                      <TableCell className="text-right font-mono text-foreground">
                        ${Number(po.total_cost || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[po.status as string] || "secondary"}>
                          {(po.status as string)?.charAt(0).toUpperCase() + (po.status as string)?.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(po.created_at as string).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
