import { useState } from "react"
import type { CartItem } from "@/lib/types"
import { formatGYD } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Banknote, CreditCard, Check, ArrowLeft, Split } from "lucide-react"

interface PaymentDialogProps {
  open: boolean
  total: number
  items: CartItem[]
  onClose: () => void
  onComplete: (payments: { method: string; amount: number; reference?: string }[]) => Promise<void>
}

type PaymentStep = "method" | "cash" | "split_cash" | "complete"

export function PaymentDialog({ open, total, items, onClose, onComplete }: PaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>("method")
  const [cashTendered, setCashTendered] = useState("")
  const [splitCashAmount, setSplitCashAmount] = useState("")
  const [processing, setProcessing] = useState(false)
  const [change, setChange] = useState(0)

  function reset() {
    setStep("method")
    setCashTendered("")
    setSplitCashAmount("")
    setProcessing(false)
    setChange(0)
  }

  async function handleCashPayment() {
    const tendered = Number(cashTendered) || 0
    if (tendered < total) return
    setProcessing(true)
    try {
      await onComplete([{ method: "cash", amount: tendered }])
      setChange(tendered - total)
      setStep("complete")
    } catch {
      setProcessing(false)
    }
  }

  async function handleCardPayment() {
    setProcessing(true)
    try {
      await onComplete([{ method: "card", amount: total, reference: "CARD-" + Date.now() }])
      setStep("complete")
    } catch {
      setProcessing(false)
    }
  }

  async function handleSplitPayment() {
    const cashPart = Number(splitCashAmount) || 0
    if (cashPart <= 0 || cashPart >= total) return
    const cardPart = total - cashPart
    setProcessing(true)
    try {
      await onComplete([
        { method: "cash", amount: cashPart },
        { method: "card", amount: cardPart, reference: "SPLIT-CARD-" + Date.now() },
      ])
      setChange(0)
      setStep("complete")
    } catch {
      setProcessing(false)
    }
  }

  // GYD quick amounts
  const quickCashAmounts = [
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 5000) * 5000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total)

  const splitCashNum = Number(splitCashAmount) || 0
  const splitCardRemaining = Math.max(0, total - splitCashNum)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            {step === "complete" ? "Payment Complete" : `Payment - ${formatGYD(total)}`}
          </DialogTitle>
        </DialogHeader>

        {step === "method" && (
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="outline"
              className="flex h-16 items-center justify-start gap-3 px-5 touch-manipulation sm:h-14"
              onClick={() => setStep("cash")}
            >
              <Banknote className="size-6 shrink-0 sm:size-5" />
              <div className="text-left">
                <span className="text-base font-medium">Cash</span>
                <span className="block text-xs text-muted-foreground">Full cash payment</span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="flex h-16 items-center justify-start gap-3 px-5 touch-manipulation sm:h-14"
              onClick={handleCardPayment}
              disabled={processing}
            >
              <CreditCard className="size-6 shrink-0 sm:size-5" />
              <div className="text-left">
                <span className="text-base font-medium">{processing ? "Processing..." : "Card"}</span>
                <span className="block text-xs text-muted-foreground">Full card payment</span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="flex h-16 items-center justify-start gap-3 px-5 touch-manipulation sm:h-14"
              onClick={() => setStep("split_cash")}
            >
              <Split className="size-6 shrink-0 sm:size-5" />
              <div className="text-left">
                <span className="text-base font-medium">Split Payment</span>
                <span className="block text-xs text-muted-foreground">Part cash + part card</span>
              </div>
            </Button>
          </div>
        )}

        {step === "cash" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-3xl font-bold sm:text-2xl">{formatGYD(total)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cash-amount">Cash Tendered (GYD)</Label>
              <Input
                id="cash-amount"
                type="number"
                inputMode="numeric"
                step="100"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder="0"
                className="h-16 text-center text-3xl touch-manipulation sm:h-14 sm:text-2xl"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickCashAmounts.map((amt) => (
                <Button key={amt} variant="outline" className="h-12 text-base touch-manipulation sm:h-11 sm:text-sm" onClick={() => setCashTendered(String(amt))}>
                  {formatGYD(amt)}
                </Button>
              ))}
            </div>
            {Number(cashTendered) >= total && (
              <p className="text-center text-xl font-semibold text-green-600 dark:text-green-400 sm:text-lg">
                Change: {formatGYD(Number(cashTendered) - total)}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1 touch-manipulation" onClick={() => setStep("method")}>
                <ArrowLeft className="mr-1.5 size-4" /> Back
              </Button>
              <Button className="h-12 flex-1 text-base font-bold touch-manipulation" onClick={handleCashPayment} disabled={processing || Number(cashTendered) < total}>
                {processing ? "Processing..." : "Complete"}
              </Button>
            </div>
          </div>
        )}

        {step === "split_cash" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Due</p>
              <p className="text-2xl font-bold">{formatGYD(total)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Cash Portion (GYD)</Label>
              <Input
                type="number"
                inputMode="numeric"
                step="100"
                value={splitCashAmount}
                onChange={(e) => setSplitCashAmount(e.target.value)}
                placeholder="Enter cash amount"
                className="h-14 text-center text-2xl touch-manipulation"
                autoFocus
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Banknote className="size-3.5" /> Cash</span>
                <span className="font-medium">{formatGYD(splitCashNum)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><CreditCard className="size-3.5" /> Card</span>
                <span className="font-medium">{formatGYD(splitCardRemaining)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1 touch-manipulation" onClick={() => setStep("method")}>
                <ArrowLeft className="mr-1.5 size-4" /> Back
              </Button>
              <Button className="h-12 flex-1 text-base font-bold touch-manipulation" onClick={handleSplitPayment} disabled={processing || splitCashNum <= 0 || splitCashNum >= total}>
                {processing ? "Processing..." : "Complete Split"}
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="flex flex-col items-center gap-4 py-6 sm:py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-bold text-foreground">Payment Successful</p>
            {change > 0 && (
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 sm:text-2xl">
                Change: {formatGYD(change)}
              </p>
            )}
            <Button className="mt-2 h-14 w-full text-base touch-manipulation sm:h-12" onClick={() => { reset(); onClose() }}>
              New Order
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
