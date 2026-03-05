import { useState, useCallback, useEffect } from "react"
import type { Product, CartItem } from "@/lib/types"
import { formatGYD } from "@/lib/types"
import { ProductGrid } from "./product-grid"
import { CartPanel } from "./cart-panel"
import { ModifierDialog } from "./modifier-dialog"
import { PaymentDialog } from "./payment-dialog"
import { ReceiptPreview } from "./receipt-preview"
import { DiscountDialog } from "./discount-dialog"
import { ItemNotesDialog } from "./item-notes-dialog"
import useSWR from "swr"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReceiptText, Truck, ShoppingBag, Clock, ShoppingCart, Keyboard } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const BEVERAGE_REGISTER = "c0000000-0000-0000-0000-000000000003"

interface POSTerminalProps {
  userId: string | null
  userName?: string
}

export function POSTerminal({ userId, userName = "Cashier" }: POSTerminalProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [selectedRegister, setSelectedRegister] = useState<string>("c0000000-0000-0000-0000-000000000001")
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [notesItemId, setNotesItemId] = useState<string | null>(null)
  const [lastOrder, setLastOrder] = useState<Record<string, unknown> | null>(null)
  const [lastChange, setLastChange] = useState(0)
  const [lastCartSnapshot, setLastCartSnapshot] = useState<CartItem[]>([])
  const [heldOrders, setHeldOrders] = useState<CartItem[][]>([])
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountLabel, setDiscountLabel] = useState("")
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Pickup / Delivery state (Terminal 3 only)
  const isBeverageTerminal = selectedRegister === BEVERAGE_REGISTER
  const [orderMode, setOrderMode] = useState<"dine_in" | "pickup" | "delivery">("dine_in")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [estimatedReady, setEstimatedReady] = useState("15")

  // Fetch products filtered by register + department
  const productUrl =
    selectedDepartment !== "all"
      ? `/api/pos/products?register_id=${selectedRegister}&department_id=${selectedDepartment}`
      : `/api/pos/products?register_id=${selectedRegister}`

  const { data: posData, isLoading } = useSWR(productUrl, fetcher)

  const departments: { id: string; name: string }[] = posData?.departments || []
  const products: Product[] = (posData?.products || []).map(
    (p: Record<string, unknown>) => ({
      ...p,
      price: Number(p.price),
      cost: Number(p.cost || 0),
      tax_rate: Number(p.tax_rate || 0),
    })
  )

  const handleProductTap = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === product.id && item.modifiers.length === 0 && !item.notes
      )
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1, line_total: (item.quantity + 1) * item.product.price }
            : item
        )
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          product,
          quantity: 1,
          modifiers: [],
          notes: "",
          line_total: product.price,
        },
      ]
    })
  }, [])

  function handleUpdateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta), line_total: Math.max(0, item.quantity + delta) * item.product.price }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function handleRemoveItem(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  function handleClearCart() {
    setCart([])
    setDiscount(0)
    setDiscountLabel("")
    resetPickupFields()
  }

  function handleHoldOrder() {
    if (cart.length === 0) return
    setHeldOrders((prev) => [...prev, cart])
    setCart([])
    setDiscount(0)
    setDiscountLabel("")
    resetPickupFields()
  }

  function handleRecallOrder(index: number) {
    setCart(heldOrders[index])
    setHeldOrders((prev) => prev.filter((_, i) => i !== index))
  }

  function handleApplyDiscount(amount: number, label: string) {
    setDiscount(amount)
    setDiscountLabel(label)
  }

  function handleSaveItemNotes(notes: string) {
    if (!notesItemId) return
    setCart((prev) =>
      prev.map((item) => (item.id === notesItemId ? { ...item, notes } : item))
    )
    setNotesItemId(null)
  }

  function resetPickupFields() {
    setCustomerName("")
    setCustomerPhone("")
    setDeliveryAddress("")
    setEstimatedReady("15")
    setOrderMode("dine_in")
  }

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.line_total, 0)
  const cartTax = cart.reduce((sum, item) => sum + item.line_total * item.product.tax_rate, 0)
  const grandTotal = cartTotal + cartTax - discount

  async function handlePaymentComplete(
    payments: { method: string; amount: number; reference?: string }[]
  ) {
    const checkoutItems = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      department: item.product.department_name || null,
      quantity: item.quantity,
      unit_price: item.product.price,
      tax_rate: item.product.tax_rate,
      is_combo: item.product.is_combo || false,
      combo_components: item.product.combo_components || [],
      modifiers: item.modifiers.map((m) => ({ name: m.name, price: m.price })),
      notes: item.notes || null,
    }))

    const body: Record<string, unknown> = {
      items: checkoutItems,
      payments,
      user_id: userId,
      register_id: selectedRegister,
      order_type: isBeverageTerminal ? orderMode : "dine_in",
      discount_total: discount,
    }

    if (isBeverageTerminal && (orderMode === "pickup" || orderMode === "delivery")) {
      body.customer_name = customerName
      body.customer_phone = customerPhone
      body.estimated_ready_minutes = parseInt(estimatedReady) || 15
      if (orderMode === "delivery") {
        body.delivery_address = deliveryAddress
      }
    }

    const res = await fetch("/api/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Checkout failed")
    }

    const result = await res.json()
    setLastCartSnapshot([...cart])
    setLastOrder(result.order)
    setLastChange(result.change || 0)
    setPaymentOpen(false)
    setReceiptOpen(true)
    setMobileCartOpen(false)
    setCart([])
    setDiscount(0)
    setDiscountLabel("")
    resetPickupFields()
  }

  // Keyboard shortcuts (F2=Pay, F3=Hold, F4=Clear, F5=Discount, F8=Reprint, F12=Shortcuts)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "F2") { e.preventDefault(); if (cart.length > 0) setPaymentOpen(true) }
      if (e.key === "F3") { e.preventDefault(); if (cart.length > 0) { setHeldOrders((prev) => [...prev, cart]); setCart([]); setDiscount(0); setDiscountLabel("") } }
      if (e.key === "F4") { e.preventDefault(); setCart([]); setDiscount(0); setDiscountLabel("") }
      if (e.key === "F5") { e.preventDefault(); if (cart.length > 0) setDiscountOpen(true) }
      if (e.key === "F8") { e.preventDefault(); if (lastOrder) setReceiptOpen(true) }
      if (e.key === "F12") { e.preventDefault(); setShowShortcuts((s) => !s) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart, lastOrder])

  // Barcode scanning listener
  useEffect(() => {
    let buffer = ""
    let timer: ReturnType<typeof setTimeout>
    function handleKeyPress(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Enter" && buffer.length > 3) {
        const barcode = buffer
        buffer = ""
        const found = products.find((p) => p.sku?.toLowerCase() === barcode.toLowerCase())
        if (found) handleProductTap(found)
      } else if (e.key.length === 1) {
        buffer += e.key
        clearTimeout(timer)
        timer = setTimeout(() => { buffer = "" }, 200)
      }
    }
    window.addEventListener("keypress", handleKeyPress)
    return () => window.removeEventListener("keypress", handleKeyPress)
  }, [products, handleProductTap])

  const notesItem = cart.find((i) => i.id === notesItemId)

  // Shared cart component
  const cartContent = (
    <CartPanel
      items={cart}
      total={cartTotal}
      tax={cartTax}
      grandTotal={grandTotal}
      discount={discount}
      discountLabel={discountLabel}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveItem}
      onCheckout={() => { setPaymentOpen(true); setMobileCartOpen(false) }}
      onClearCart={handleClearCart}
      onHoldOrder={handleHoldOrder}
      onOpenDiscount={() => setDiscountOpen(true)}
      onOpenNotes={(id) => setNotesItemId(id)}
      orderMode={isBeverageTerminal ? orderMode : undefined}
      customerName={isBeverageTerminal ? customerName : undefined}
    />
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 md:gap-3 md:px-4">
        {/* Register selector */}
        <Select value={selectedRegister} onValueChange={(v) => { setSelectedRegister(v); setSelectedDepartment("all"); resetPickupFields() }}>
          <SelectTrigger className="h-9 w-full shrink-0 text-xs sm:w-44 sm:text-sm">
            <SelectValue placeholder="Select Register" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="c0000000-0000-0000-0000-000000000001">Meals POS</SelectItem>
            <SelectItem value="c0000000-0000-0000-0000-000000000002">Pastry POS</SelectItem>
            <SelectItem value="c0000000-0000-0000-0000-000000000003">Beverage & Pickup POS</SelectItem>
          </SelectContent>
        </Select>

        {/* Department filter */}
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
          <Badge
            variant={selectedDepartment === "all" ? "default" : "outline"}
            className="shrink-0 cursor-pointer touch-manipulation px-2.5 py-1 text-xs sm:px-3"
            onClick={() => setSelectedDepartment("all")}
          >
            All
          </Badge>
          {departments.map((dept) => (
            <Badge
              key={dept.id}
              variant={selectedDepartment === dept.id ? "default" : "outline"}
              className="shrink-0 cursor-pointer touch-manipulation px-2.5 py-1 text-xs sm:px-3"
              onClick={() => setSelectedDepartment(dept.id)}
            >
              {dept.name}
            </Badge>
          ))}
        </div>

        {/* Held orders, reprint, shortcuts, user */}
        <div className="flex shrink-0 items-center gap-1.5">
          {heldOrders.map((held, i) => (
            <button
              key={i}
              className="rounded border border-dashed border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 touch-manipulation"
              onClick={() => handleRecallOrder(i)}
            >
              Held #{i + 1}
            </button>
          ))}
          {lastOrder && (
            <Button variant="ghost" size="sm" className="hidden gap-1.5 text-xs sm:flex" onClick={() => setReceiptOpen(true)}>
              <ReceiptText className="size-3.5" />
              Reprint
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden size-8 sm:flex" onClick={() => setShowShortcuts((s) => !s)}>
                  <Keyboard className="size-3.5" />
                  <span className="sr-only">Keyboard shortcuts</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Keyboard shortcuts (F12)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="hidden text-xs text-muted-foreground lg:inline">{userName}</span>
        </div>
      </div>

      {/* Keyboard shortcuts banner */}
      {showShortcuts && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Shortcuts:</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">F2</kbd> Pay</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">F3</kbd> Hold</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">F4</kbd> Clear</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">F5</kbd> Discount</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">F8</kbd> Reprint</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">F12</kbd> Toggle this bar</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => setShowShortcuts(false)}>Dismiss</Button>
        </div>
      )}

      {/* Pickup/Delivery bar (Terminal 3 only) */}
      {isBeverageTerminal && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-muted/30 px-3 py-2 md:gap-3 md:px-4">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
            <Button variant={orderMode === "dine_in" ? "default" : "ghost"} size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setOrderMode("dine_in")}>
              <ShoppingBag className="size-3" />
              <span className="hidden xs:inline">Walk-in</span>
            </Button>
            <Button variant={orderMode === "pickup" ? "default" : "ghost"} size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setOrderMode("pickup")}>
              <Clock className="size-3" />
              <span className="hidden xs:inline">Pickup</span>
            </Button>
            <Button variant={orderMode === "delivery" ? "default" : "ghost"} size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setOrderMode("delivery")}>
              <Truck className="size-3" />
              <span className="hidden xs:inline">Delivery</span>
            </Button>
          </div>

          {(orderMode === "pickup" || orderMode === "delivery") && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" className="h-8 w-28 text-sm sm:w-36" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+592-..." className="h-8 w-24 text-sm sm:w-32" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ready in</Label>
                <Select value={estimatedReady} onValueChange={setEstimatedReady}>
                  <SelectTrigger className="h-8 w-20 text-sm sm:w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="20">20 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {orderMode === "delivery" && (
                <div className="flex w-full flex-col gap-1 sm:w-auto">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Address</Label>
                  <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Delivery Address" className="h-8 w-full text-sm sm:w-56" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Main area: product grid + cart */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
          <ProductGrid products={products} isLoading={isLoading} onProductTap={handleProductTap} cart={cart} />
        </div>
        <div className="hidden h-full w-72 shrink-0 border-l border-border md:block lg:w-80 xl:w-96">
          {cartContent}
        </div>
      </div>

      {/* Mobile floating cart button */}
      <div className="fixed bottom-4 right-4 z-30 md:hidden">
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="h-14 w-14 rounded-full shadow-lg">
              <ShoppingCart className="size-5" />
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                  {cartItemCount}
                </span>
              )}
              <span className="sr-only">Open cart</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Cart</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <div className="flex justify-center py-2">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
              {cartContent}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile bottom bar */}
      {cartItemCount > 0 && (
        <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2.5 md:hidden">
          <div>
            <p className="text-xs text-muted-foreground">{cartItemCount} items</p>
            <p className="text-base font-bold text-foreground">{formatGYD(grandTotal)}</p>
          </div>
          <Button size="sm" className="h-10 gap-1.5 px-5 text-sm font-semibold" onClick={() => setMobileCartOpen(true)}>
            <ShoppingCart className="size-4" />
            View Cart
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <PaymentDialog open={paymentOpen} onClose={() => setPaymentOpen(false)} total={grandTotal} items={cart} onComplete={handlePaymentComplete} />
      <ReceiptPreview open={receiptOpen} onOpenChange={setReceiptOpen} order={lastOrder} items={lastCartSnapshot} change={lastChange} userName={userName} />
      <DiscountDialog open={discountOpen} onClose={() => setDiscountOpen(false)} subtotal={cartTotal} onApply={handleApplyDiscount} />
      {notesItem && (
        <ItemNotesDialog
          open={!!notesItemId}
          onClose={() => setNotesItemId(null)}
          productName={notesItem.product.name}
          currentNotes={notesItem.notes}
          onSave={handleSaveItemNotes}
        />
      )}
    </div>
  )
}
