import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight } from "lucide-react"

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function TransfersList() {
  const { data: transfers = [], isLoading } = useSWR("/api/inventory/transfers", fetcher)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers yet</TableCell>
                  </TableRow>
                ) : (
                  transfers.map((t: Record<string, unknown>) => (
                    <TableRow key={t.id as string}>
                      <TableCell className="font-mono font-medium text-foreground">{t.transfer_number as string}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-foreground">
                          {t.from_location_name as string}
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          {t.to_location_name as string}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{String(t.item_count)}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                          {(t.status as string)?.charAt(0).toUpperCase() + (t.status as string)?.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.created_by_name as string || "---"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(t.created_at as string).toLocaleDateString()}
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
