import type { CartItem } from "@/lib/types"
import { formatGYD } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Minus, Plus, Trash2, Pause, X, Truck, ShoppingBag, Clock,
  Percent, StickyNote,
} from "lucide-react"

interface CartPanelProps {
  items: CartItem[]
  total: number
  tax: number
  grandTotal: number
  discount: number
  discountLabel: string
  onUpdateQuantity: (id: string, delta: number) => void
  onRemoveItem: (id: string) => void
  onCheckout: () => void
  onClearCart: () => void
  onHoldOrder: () => void
  onOpenDiscount: () => void
  onOpenNotes: (id: string) => void
  orderMode?: "dine_in" | "pickup" | "delivery"
  customerName?: string
}

export function CartPanel({
  items,
  total,
  tax,
  grandTotal,
  discount,
  discountLabel,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onClearCart,
  onHoldOrder,
  onOpenDiscount,
  onOpenNotes,
  orderMode,
  customerName,
}: CartPanelProps) {
  const modeLabel = orderMode === "pickup" ? "Pickup" : orderMode === "delivery" ? "Delivery" : null
  const ModeIcon = orderMode === "delivery" ? Truck : orderMode === "pickup" ? Clock : ShoppingBag

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-card-foreground">Current Order</h2>
          {modeLabel && (
            <Badge variant="outline" className="gap-1 text-xs">
              <ModeIcon className="size-3" />
              {modeLabel}
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {items.reduce((s, i) => s + i.quantity, 0)} items
        </span>
      </div>
      {customerName && modeLabel && (
        <div className="border-b border-border bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
          Customer: <span className="font-medium text-foreground">{customerName}</span>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <ShoppingBag className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Tap a product to add it</p>
            <p className="text-xs text-muted-foreground/60">or scan a barcode</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 rounded-md border border-border bg-background p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{item.product.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.modifiers.map((m) => `${m.name}${m.price > 0 ? ` +${formatGYD(m.price)}` : ""}`).join(", ")}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 truncate text-xs italic text-amber-600 dark:text-amber-400">{item.notes}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatGYD(item.line_total)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-7" onClick={() => onUpdateQuantity(item.id, -1)}>
                    <Minus className="size-3" />
                    <span className="sr-only">Decrease</span>
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="size-7" onClick={() => onUpdateQuantity(item.id, 1)}>
                    <Plus className="size-3" />
                    <span className="sr-only">Increase</span>
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {"@ " + formatGYD(item.product.price)}
                  </span>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => onOpenNotes(item.id)}>
                    <StickyNote className="size-3" />
                    <span className="sr-only">Add notes</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => onRemoveItem(item.id)}>
                    <Trash2 className="size-3" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals + Actions */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatGYD(total)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-destructive">
              <span className="truncate text-xs">{discountLabel || "Discount"}</span>
              <span className="shrink-0 font-medium">-{formatGYD(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatGYD(tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 text-lg font-bold">
            <span>Total</span>
            <span>{formatGYD(grandTotal)}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Button className="h-12 w-full text-base font-bold" onClick={onCheckout} disabled={items.length === 0}>
            Pay {formatGYD(grandTotal)}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onOpenDiscount} disabled={items.length === 0}>
              <Percent className="size-3.5" />
              Discount
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onHoldOrder} disabled={items.length === 0}>
              <Pause className="size-3.5" />
              Hold
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onClearCart} disabled={items.length === 0}>
              <X className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
