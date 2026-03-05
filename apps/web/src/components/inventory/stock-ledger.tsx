import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const fetcher = (url: string) => fetch(url).then(r => r.json())

const reasonColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sale: "default",
  purchase: "default",
  adjustment: "secondary",
  transfer_in: "outline",
  transfer_out: "outline",
  return: "destructive",
  waste: "destructive",
  count: "secondary"
}

export function StockLedger() {
  const { data: entries = [], isLoading } = useSWR("/api/inventory/ledger", fetcher)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No ledger entries yet</TableCell>
                  </TableRow>
                ) : (
                  entries.map((e: Record<string, unknown>) => (
                    <TableRow key={e.id as string}>
                      <TableCell className="font-medium text-foreground">{e.product_name as string}</TableCell>
                      <TableCell className="text-muted-foreground">{e.location_name as string}</TableCell>
                      <TableCell>
                        <Badge variant={reasonColors[e.reason as string] || "secondary"}>
                          {(e.reason as string)?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${Number(e.quantity_change) > 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {Number(e.quantity_change) > 0 ? "+" : ""}{String(e.quantity_change)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-foreground">{String(e.balance_after)}</TableCell>
                      <TableCell className="text-muted-foreground">{e.user_name as string || "System"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(e.created_at as string).toLocaleString()}
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
