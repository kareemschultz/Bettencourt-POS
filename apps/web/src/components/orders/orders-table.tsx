import { useState } from "react"
import useSWR from "swr"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatGYD } from "@/lib/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Truck, Clock, ShoppingBag, Filter, Ban, ChevronDown, ChevronRight, CreditCard, Banknote } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Order {
  id: string
  order_number: string
  status: string
  order_type: string
  total: number
  created_at: string
  user_name?: string
  customer_name?: string
  customer_phone?: string
  delivery_address?: string
  fulfillment_status?: string
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  open: "secondary",
  voided: "destructive",
  refunded: "outline",
  held: "outline",
  closed: "default",
}

const fulfillmentColors: Record<string, string> = {
  preparing: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  picked_up: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
}

function OrderDetailPanel({ orderId }: { orderId: string }) {
  const { data, isLoading } = useSWR(`/api/orders/${orderId}`, fetcher)

  if (isLoading) return <div className="px-6 py-4 text-sm text-muted-foreground">Loading order details...</div>
  if (!data || data.error) return <div className="px-6 py-4 text-sm text-destructive">Failed to load details</div>

  const lineItems = data.line_items || []
  const payments = data.payments || []

  return (
    <div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
      {/* Line Items */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 text-xs">Product</TableHead>
                <TableHead className="h-8 text-right text-xs">Qty</TableHead>
                <TableHead className="h-8 text-right text-xs">Price</TableHead>
                <TableHead className="h-8 text-right text-xs">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item: Record<string, unknown>, i: number) => (
                <TableRow key={i}>
                  <TableCell className="py-1.5 text-xs">
                    <span className="font-medium">{item.product_name_snapshot as string}</span>
                    {item.notes && <span className="block text-[10px] italic text-muted-foreground">{item.notes as string}</span>}
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs">{String(item.quantity)}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-xs">{formatGYD(Number(item.unit_price))}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-xs">{formatGYD(Number(item.total))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Payments + Summary */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payments</p>
        <div className="flex flex-col gap-2">
          {payments.map((p: Record<string, unknown>, i: number) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {p.method === "cash" ? <Banknote className="size-3.5 text-green-600" /> : <CreditCard className="size-3.5 text-blue-600" />}
                <span className="capitalize font-medium">{p.method as string}</span>
                {p.status === "voided" && <Badge variant="destructive" className="text-[10px]">Voided</Badge>}
              </div>
              <span className="font-mono text-sm">{formatGYD(Number(p.amount))}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-md bg-muted/50 p-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span><span className="font-mono">{formatGYD(Number(data.subtotal || 0))}</span>
          </div>
          {Number(data.tax_total || 0) > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tax</span><span className="font-mono">{formatGYD(Number(data.tax_total))}</span>
            </div>
          )}
          {Number(data.discount_total || 0) > 0 && (
            <div className="flex justify-between text-xs text-destructive">
              <span>Discount</span><span className="font-mono">-{formatGYD(Number(data.discount_total))}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-bold">
            <span>Total</span><span className="font-mono">{formatGYD(Number(data.total))}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrdersTable({ orders: initialOrders, userId, userRole }: { orders: Order[]; userId?: string; userRole?: string }) {
  const [orders, setOrders] = useState(initialOrders)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [voidReason, setVoidReason] = useState("")
  const [voiding, setVoiding] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const canVoid = userRole === "admin" || userRole === "executive"

  async function handleVoid(orderId: string) {
    setVoiding(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, reason: voidReason }),
      })
      if (res.ok) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "voided" } : o))
      }
    } finally {
      setVoiding(null)
      setVoidReason("")
    }
  }

  const filtered = typeFilter === "all"
    ? orders
    : orders.filter((o) => o.order_type === typeFilter)

  const orderTypeIcon = (type: string) => {
    switch (type) {
      case "pickup": return <Clock className="size-3" />
      case "delivery": return <Truck className="size-3" />
      default: return <ShoppingBag className="size-3" />
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Filter className="size-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All order types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="dine_in">Walk-in / Dine-in</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} orders</span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Time</TableHead>
              {canVoid && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canVoid ? 8 : 7} className="h-24 text-center">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => (
                <><TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <TableCell className="font-mono text-sm font-medium">
                    <div className="flex items-center gap-1.5">
                      {expandedOrder === order.id ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                      {order.order_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusVariant[order.status] || "secondary"}>
                        {order.status}
                      </Badge>
                      {order.fulfillment_status && order.fulfillment_status !== "none" && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${fulfillmentColors[order.fulfillment_status] || ""}`}>
                          {order.fulfillment_status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm capitalize">
                      {orderTypeIcon(order.order_type)}
                      {order.order_type?.replace("_", " ") || "walk-in"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {order.user_name || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.customer_name ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{order.customer_name}</span>
                        {order.customer_phone && (
                          <span className="text-xs text-muted-foreground">{order.customer_phone}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatGYD(Number(order.total))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  {canVoid && (
                    <TableCell>
                      {order.status === "completed" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive">
                              <Ban className="size-3" />Void
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Void Order {order.order_number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will void the order totalling {formatGYD(Number(order.total))} and reverse any cash session entries. This action is logged in the audit trail.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                              placeholder="Reason for voiding (required)"
                              value={voidReason}
                              onChange={(e) => setVoidReason(e.target.value)}
                            />
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setVoidReason("")}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={!voidReason.trim() || voiding === order.id}
                                onClick={() => handleVoid(order.id)}
                              >
                                {voiding === order.id ? "Voiding..." : "Confirm Void"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  )}
                </TableRow>
                {expandedOrder === order.id && (
                  <TableRow key={`${order.id}-detail`}>
                    <TableCell colSpan={canVoid ? 8 : 7} className="bg-muted/20 p-0">
                      <OrderDetailPanel orderId={order.id} />
                    </TableCell>
                  </TableRow>
                )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
