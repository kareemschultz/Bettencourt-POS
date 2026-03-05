import { useState } from "react"
import { useNavigate } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { DollarSign, ArrowDown, ArrowUp } from "lucide-react"
import { formatGYD } from "@/lib/types"

interface CashControlPanelProps {
  sessions: Record<string, unknown>[]
  openSession: Record<string, unknown> | null
  drops: Record<string, unknown>[]
  payouts: Record<string, unknown>[]
  userId: string
  locationId: string
}

export function CashControlPanel({
  sessions, openSession, drops, payouts, userId, locationId,
}: CashControlPanelProps) {
  const navigate = useNavigate()
  const [openShiftDialog, setOpenShiftDialog] = useState(false)
  const [closeShiftDialog, setCloseShiftDialog] = useState(false)
  const [dropDialog, setDropDialog] = useState(false)
  const [payoutDialog, setPayoutDialog] = useState(false)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  async function openShift() {
    setLoading(true)
    await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "open",
        openingFloat: Number(amount) || 0,
        userId,
        locationId,
        registerId: "c0000000-0000-0000-0000-000000000001",
      }),
    })
    setOpenShiftDialog(false)
    setAmount("")
    setLoading(false)
    navigate(0) // refresh current route
  }

  async function closeShift() {
    if (!openSession) return
    setLoading(true)
    await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close",
        sessionId: openSession.id,
        actualCash: Number(amount) || 0,
        expectedCash: Number(openSession.opening_float) || 0,
      }),
    })
    setCloseShiftDialog(false)
    setAmount("")
    setLoading(false)
    navigate(0) // refresh current route
  }

  async function addDrop() {
    if (!openSession) return
    setLoading(true)
    await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "movement",
        sessionId: openSession.id,
        amount: Number(amount),
        movementType: "drop",
        userId,
        reason,
      }),
    })
    setDropDialog(false)
    setAmount("")
    setReason("")
    setLoading(false)
    navigate(0) // refresh current route
  }

  async function addPayout() {
    if (!openSession) return
    setLoading(true)
    await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "movement",
        sessionId: openSession.id,
        amount: Number(amount),
        movementType: "payout",
        userId,
        reason,
      }),
    })
    setPayoutDialog(false)
    setAmount("")
    setReason("")
    setLoading(false)
    navigate(0) // refresh current route
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-5" />
            Current Shift
          </CardTitle>
          {openSession ? <Badge>Open</Badge> : <Badge variant="secondary">Closed</Badge>}
        </CardHeader>
        <CardContent>
          {openSession ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Opened by</p>
                  <p className="font-medium">{(openSession.user_name as string) || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Opening Float</p>
                  <p className="font-medium font-mono">{formatGYD(Number(openSession.opening_float))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Cash</p>
                  <p className="font-medium font-mono">
                    {formatGYD(Number(openSession.expected_cash || openSession.opening_float))}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setDropDialog(true)}>
                  <ArrowDown className="mr-2 size-4" />Cash Drop
                </Button>
                <Button variant="outline" onClick={() => setPayoutDialog(true)}>
                  <ArrowUp className="mr-2 size-4" />Payout
                </Button>
                <Button variant="destructive" onClick={() => { setAmount(""); setCloseShiftDialog(true) }}>
                  Close Shift
                </Button>
              </div>

              {(drops.length > 0 || payouts.length > 0) && (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drops.map((d: Record<string, unknown>) => (
                        <TableRow key={d.id as string}>
                          <TableCell><Badge variant="secondary">Drop</Badge></TableCell>
                          <TableCell className="font-mono">{formatGYD(Number(d.amount))}</TableCell>
                          <TableCell className="text-sm">{(d.reason as string) || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(d.performed_at as string).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {payouts.map((p: Record<string, unknown>) => (
                        <TableRow key={p.id as string}>
                          <TableCell><Badge variant="outline">Payout</Badge></TableCell>
                          <TableCell className="font-mono">{formatGYD(Number(p.amount))}</TableCell>
                          <TableCell className="text-sm">{(p.reason as string) || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(p.performed_at as string).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-muted-foreground">No shift is currently open</p>
              <Button onClick={() => setOpenShiftDialog(true)}>Open Shift</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Shift History</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opened By</TableHead>
                  <TableHead>Float</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id as string}>
                    <TableCell className="text-sm">{(s.user_name as string) || "Unknown"}</TableCell>
                    <TableCell className="font-mono text-sm">{formatGYD(Number(s.opening_float))}</TableCell>
                    <TableCell className="font-mono text-sm">{s.expected_cash ? formatGYD(Number(s.expected_cash)) : "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{s.actual_cash ? formatGYD(Number(s.actual_cash)) : "-"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {s.variance != null ? (
                        <span className={Number(s.variance) < 0 ? "text-destructive" : "text-foreground"}>
                          {formatGYD(Number(s.variance))}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "open" ? "default" : "secondary"}>
                        {s.status as string}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={openShiftDialog} onOpenChange={setOpenShiftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Open Shift</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label>Opening Float Amount (GYD)</Label>
            <Input type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-11 text-base" />
          </div>
          <DialogFooter>
            <Button onClick={openShift} disabled={loading}>{loading ? "Opening..." : "Open Shift"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeShiftDialog} onOpenChange={setCloseShiftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Close Shift</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label>Cash Count (GYD)</Label>
            <Input type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-11 text-base" />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={closeShift} disabled={loading}>{loading ? "Closing..." : "Close Shift"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dropDialog} onOpenChange={setDropDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cash Drop</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label>Amount (GYD)</Label>
            <Input type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-base" />
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 text-base" />
          </div>
          <DialogFooter>
            <Button onClick={addDrop} disabled={loading}>Record Drop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payoutDialog} onOpenChange={setPayoutDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cash Payout</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label>Amount (GYD)</Label>
            <Input type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-base" />
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 text-base" />
          </div>
          <DialogFooter>
            <Button onClick={addPayout} disabled={loading}>Record Payout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
