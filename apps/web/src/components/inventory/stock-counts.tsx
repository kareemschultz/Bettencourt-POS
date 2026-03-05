import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function StockCounts() {
  const { data: counts = [], isLoading } = useSWR("/api/inventory/counts", fetcher)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
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
                ) : counts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No stock counts yet</TableCell>
                  </TableRow>
                ) : (
                  counts.map((c: Record<string, unknown>) => (
                    <TableRow key={c.id as string}>
                      <TableCell className="font-medium text-foreground">{c.location_name as string}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{c.type as string}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{String(c.item_count)}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "completed" ? "default" : "secondary"}>
                          {(c.status as string)?.replace("_", " ").charAt(0).toUpperCase() + (c.status as string)?.replace("_", " ").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.created_by_name as string || "---"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(c.created_at as string).toLocaleDateString()}
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
