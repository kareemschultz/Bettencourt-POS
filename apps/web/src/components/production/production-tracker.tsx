import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Sunrise, RefreshCw, Moon, Package, Check, Minus, Plus, X } from "lucide-react"
import useSWR, { mutate as globalMutate } from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type EntryType = "opening" | "reorder" | "closing"
type ProductItem = { id: string; name: string; department_id: string | null; department_name: string | null }
type ProductionTotal = { product_id: string; product_name: string; opening: number; reorder: number; closing: number }

const MODE_CONFIG: Record<EntryType, { label: string; color: string; bg: string; icon: typeof Sunrise }> = {
  opening: { label: "Opening", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-600", icon: Sunrise },
  reorder: { label: "Reorder", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-600", icon: RefreshCw },
  closing: { label: "Closing", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-600", icon: Moon },
}

interface Props {
  products: ProductItem[]
  initialTotals: ProductionTotal[]
  userId: string
  userName: string
}

export function ProductionTracker({ products, initialTotals, userId }: Props) {
  const [mode, setMode] = useState<EntryType>("opening")
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null)
  const [quantity, setQuantity] = useState(0)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deptFilter, setDeptFilter] = useState<string>("all")

  const today = new Date().toISOString().slice(0, 10)
  const { data: prodData } = useSWR(`/api/production?date=${today}`, fetcher, {
    refreshInterval: 10000,
    fallbackData: { totals: initialTotals },
  })
  const totals: ProductionTotal[] = prodData?.totals || initialTotals

  const totalsMap = new Map(totals.map((t) => [t.product_id, t]))

  // Get unique departments
  const departments = Array.from(new Set(products.map((p) => p.department_name).filter(Boolean))) as string[]

  const filtered = deptFilter === "all" ? products : products.filter((p) => p.department_name === deptFilter)

  const handleNumpad = useCallback((digit: number) => {
    setQuantity((prev) => {
      const next = prev * 10 + digit
      return next > 9999 ? prev : next
    })
  }, [])

  async function handleSubmit() {
    if (!selectedProduct || quantity <= 0) return
    setSubmitting(true)
    try {
      await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          logged_by_user_id: userId,
          entry_type: mode,
          quantity,
          notes: notes || null,
        }),
      })
      globalMutate(`/api/production?date=${today}`)
      setSelectedProduct(null)
      setQuantity(0)
      setNotes("")
    } finally {
      setSubmitting(false)
    }
  }

  const modeConfig = MODE_CONFIG[mode]

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Mode Toggle Bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 sm:px-4">
        {(Object.entries(MODE_CONFIG) as [EntryType, typeof modeConfig][]).map(([key, cfg]) => {
          const Icon = cfg.icon
          return (
            <Button
              key={key}
              variant={mode === key ? "default" : "outline"}
              className={`h-12 flex-1 gap-2 text-base sm:h-14 sm:text-lg ${mode === key ? `${cfg.bg} text-white` : ""}`}
              onClick={() => setMode(key)}
            >
              <Icon className="size-5" />
              {cfg.label}
            </Button>
          )
        })}
      </div>

      {/* Department filter pills */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 sm:px-4">
        <Button
          variant={deptFilter === "all" ? "default" : "outline"}
          size="sm"
          className="h-9 shrink-0 text-sm"
          onClick={() => setDeptFilter("all")}
        >
          All
        </Button>
        {departments.map((d) => (
          <Button
            key={d}
            variant={deptFilter === d ? "default" : "outline"}
            size="sm"
            className="h-9 shrink-0 text-sm"
            onClick={() => setDeptFilter(d)}
          >
            {d}
          </Button>
        ))}
      </div>

      {/* Product Grid -- large tap targets */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((product) => {
            const t = totalsMap.get(product.id)
            const produced = (t?.opening || 0) + (t?.reorder || 0)
            const remaining = produced - (t?.closing || 0)
            return (
              <button
                key={product.id}
                onClick={() => { setSelectedProduct(product); setQuantity(0); setNotes("") }}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-border bg-card p-3 text-center transition-colors hover:border-primary active:scale-[0.97] sm:p-4"
                style={{ minHeight: 120, touchAction: "manipulation" }}
              >
                <Package className="mb-1 size-6 text-muted-foreground sm:size-7" />
                <span className="text-xs font-semibold leading-tight text-foreground sm:text-sm">{product.name}</span>
                {product.department_name && (
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{product.department_name}</span>
                )}
                {produced > 0 && (
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      Made: {produced}
                    </Badge>
                    {t?.closing ? (
                      <Badge variant="outline" className="text-[10px]">
                        Left: {remaining}
                      </Badge>
                    ) : null}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Number Pad Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) setSelectedProduct(null) }}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className={`rounded-full p-1.5 text-white ${modeConfig.bg}`}>
                {(() => { const Icon = modeConfig.icon; return <Icon className="size-4" /> })()}
              </div>
              {modeConfig.label}: {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Quantity display */}
          <div className="rounded-lg border-2 border-border bg-muted/30 p-4 text-center">
            <span className="text-4xl font-bold tabular-nums text-foreground sm:text-5xl">
              {quantity || "0"}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">servings / units</p>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <Button
                key={n}
                variant="outline"
                className="h-14 text-xl font-bold sm:h-16 sm:text-2xl"
                onClick={() => handleNumpad(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-14 text-xl font-bold sm:h-16 sm:text-2xl"
              onClick={() => setQuantity(0)}
            >
              C
            </Button>
            <Button
              variant="outline"
              className="h-14 text-xl font-bold sm:h-16 sm:text-2xl"
              onClick={() => handleNumpad(0)}
            >
              0
            </Button>
            <Button
              variant="outline"
              className="h-14 sm:h-16"
              onClick={() => setQuantity((prev) => Math.floor(prev / 10))}
            >
              <X className="size-5" />
            </Button>
          </div>

          {/* Quick quantities */}
          <div className="flex gap-2">
            {[5, 10, 20, 25, 50].map((q) => (
              <Button
                key={q}
                variant="secondary"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setQuantity(q)}
              >
                {q}
              </Button>
            ))}
          </div>

          {/* +/- fine tune */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" className="size-10" onClick={() => setQuantity((q) => Math.max(0, q - 1))}>
              <Minus className="size-4" />
            </Button>
            <span className="text-lg font-bold tabular-nums">{quantity}</span>
            <Button variant="outline" size="icon" className="size-10" onClick={() => setQuantity((q) => q + 1)}>
              <Plus className="size-4" />
            </Button>
          </div>

          {/* Optional notes */}
          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-16 resize-none text-sm"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProduct(null)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={quantity <= 0 || submitting}
              className={`gap-2 ${modeConfig.bg} text-white`}
            >
              <Check className="size-4" />
              {submitting ? "Saving..." : `Log ${quantity} (${modeConfig.label})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
