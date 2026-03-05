import { useState, useEffect, useCallback } from "react"
import type { Product, CartModifier } from "@/lib/types"
import { formatGYD } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface ModifierGroup {
  id: string
  name: string
  required: boolean
  min_select: number
  max_select: number
  modifiers: {
    id: string
    name: string
    price: number
    sort_order: number
  }[]
}

interface ModifierDialogProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onConfirm: (modifiers: CartModifier[], notes: string) => void
}

export function ModifierDialog({
  product,
  open,
  onClose,
  onConfirm,
}: ModifierDialogProps) {
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [selected, setSelected] = useState<CartModifier[]>([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const fetchModifiers = useCallback(async (productId: string) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/pos/modifiers?product_id=${productId}`
      )
      const data = await res.json()
      setGroups(data.groups || [])
    } catch {
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (product && open) {
      setSelected([])
      setNotes("")
      fetchModifiers(product.id)
    }
  }, [product, open, fetchModifiers])

  function toggleModifier(mod: { id: string; name: string; price: number }) {
    setSelected((prev) => {
      const exists = prev.find((m) => m.id === mod.id)
      if (exists) return prev.filter((m) => m.id !== mod.id)
      return [...prev, { id: mod.id, name: mod.name, price: Number(mod.price) }]
    })
  }

  function handleConfirm() {
    onConfirm(selected, notes)
  }

  if (!product) return null

  // If no modifiers, skip the dialog
  if (!loading && groups.length === 0 && open) {
    onConfirm([], "")
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize: {product.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading...</p>
        ) : (
          <div className="flex max-h-[50vh] flex-col gap-4 overflow-auto py-2">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">
                  {group.name}
                  {group.required && (
                    <span className="ml-1 text-xs text-destructive">
                      Required
                    </span>
                  )}
                </h4>
                {group.modifiers.map((mod) => {
                  const isSelected = selected.some((s) => s.id === mod.id)
                  return (
                    <div
                      key={mod.id}
                      className="flex items-center gap-3"
                    >
                      <Checkbox
                        id={mod.id}
                        checked={isSelected}
                        onCheckedChange={() => toggleModifier(mod)}
                      />
                      <Label
                        htmlFor={mod.id}
                        className="flex flex-1 cursor-pointer items-center justify-between"
                      >
                        <span>{mod.name}</span>
                        {Number(mod.price) > 0 && (
                          <span className="text-sm text-muted-foreground">
                            +{formatGYD(Number(mod.price))}
                          </span>
                        )}
                      </Label>
                    </div>
                  )
                })}
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Input
                id="item-notes"
                placeholder="Special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            Add to Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
