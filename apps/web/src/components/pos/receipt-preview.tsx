import type { CartItem } from "@/lib/types"
import { formatGYD } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, X } from "lucide-react"

interface ReceiptPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Record<string, unknown> | null
  items: CartItem[]
  change: number
  userName: string
}

export function ReceiptPreview({ open, onOpenChange, order, items, change, userName }: ReceiptPreviewProps) {
  if (!order) return null

  const now = new Date(order.created_at as string || Date.now())
  const subtotal = items.reduce((s, i) => s + i.line_total, 0)
  const tax = items.reduce((s, i) => s + i.line_total * i.product.tax_rate, 0)
  const total = Number(order.total || subtotal + tax)

  // Group items by department
  const departments = new Set(items.map((i) => i.product.department_name || "General"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Receipt
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-background p-5 font-mono text-xs leading-relaxed">
          {/* Header */}
          <div className="mb-3 text-center">
            <p className="text-sm font-bold">{"Bettencourt's Food Inc."}</p>
            <p className="text-[10px] italic text-muted-foreground">{"'A True Guyanese Gem'"}</p>
            <p className="text-muted-foreground">Lot 12 Robb Street</p>
            <p className="text-muted-foreground">Georgetown, Guyana</p>
            <p className="text-muted-foreground">Tel: +592-227-0000</p>
          </div>

          {/* Order info */}
          <div className="mb-2 border-t border-dashed border-border pt-2">
            <div className="flex justify-between">
              <span>Order</span>
              <span className="font-bold">{order.order_number as string}</span>
            </div>
            {order.daily_number && (
              <div className="flex justify-between">
                <span>Daily #</span>
                <span className="font-bold">{String(order.daily_number)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Date</span>
              <span>{now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="flex justify-between">
              <span>Served by</span>
              <span className="font-medium">{(order.user_name as string) || userName}</span>
            </div>
            {departments.size === 1 && (
              <div className="flex justify-between">
                <span>Dept</span>
                <span className="font-medium">{[...departments][0]}</span>
              </div>
            )}
            {order.order_type && order.order_type !== "dine_in" && (
              <div className="flex justify-between">
                <span>Type</span>
                <span className="font-bold uppercase">{order.order_type as string}</span>
              </div>
            )}
          </div>

          {/* Pickup / Delivery details */}
          {order.customer_name && (
            <div className="mb-2 border-t border-dashed border-border pt-2">
              <div className="flex justify-between">
                <span>Customer</span>
                <span className="font-medium">{order.customer_name as string}</span>
              </div>
              {order.customer_phone && (
                <div className="flex justify-between">
                  <span>Phone</span>
                  <span>{order.customer_phone as string}</span>
                </div>
              )}
              {order.delivery_address && (
                <div className="flex justify-between">
                  <span>Address</span>
                  <span className="max-w-[50%] text-right">{order.delivery_address as string}</span>
                </div>
              )}
              {order.estimated_ready_at && (
                <div className="flex justify-between">
                  <span>Ready at</span>
                  <span className="font-medium">
                    {new Date(order.estimated_ready_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div className="mb-2 border-t border-dashed border-border pt-2">
            {items.map((item, idx) => (
              <div key={idx} className="mb-1">
                <div className="flex justify-between">
                  <span className="flex-1 truncate">
                    {item.quantity > 1 ? `${item.quantity}x ` : ""}
                    {item.product.name}
                  </span>
                  <span className="shrink-0 pl-2">{formatGYD(item.line_total)}</span>
                </div>
                {item.quantity > 1 && (
                  <div className="pl-2 text-muted-foreground">
                    {"@ " + formatGYD(item.product.price) + " each"}
                  </div>
                )}
                {departments.size > 1 && item.product.department_name && (
                  <div className="pl-2 text-[10px] text-muted-foreground">
                    [{item.product.department_name}]
                  </div>
                )}
                {item.notes && (
                  <div className="pl-2 text-[10px] italic text-muted-foreground">
                    Note: {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mb-2 flex flex-col gap-0.5 border-t border-dashed border-border pt-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatGYD(subtotal)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatGYD(tax)}</span>
              </div>
            )}
            {Number(order.discount_total || 0) > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Discount{order.discount_label ? ` (${order.discount_label})` : ""}</span>
                <span>-{formatGYD(Number(order.discount_total))}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-double border-border pt-1 text-sm font-bold">
              <span>TOTAL</span>
              <span>{formatGYD(total)}</span>
            </div>
          </div>

          {/* Payment Info */}
          {order.payments && Array.isArray(order.payments) && (
            <div className="mb-2 border-t border-dashed border-border pt-2">
              {(order.payments as Array<{ method: string; amount: number }>).map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="capitalize">{p.method}</span>
                  <span>{formatGYD(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Change */}
          {change > 0 && (
            <div className="mb-2 border-t border-dashed border-border pt-2">
              <div className="flex justify-between font-bold">
                <span>Change</span>
                <span>{formatGYD(change)}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 text-center text-muted-foreground">
            <p>{"Thank you for choosing Bettencourt's!"}</p>
            <p className="text-[10px] italic">{"'A True Guyanese Gem'"}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1 gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
