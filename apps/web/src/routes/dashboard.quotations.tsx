import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { orpc } from "@/utils/orpc"
import { formatGYD } from "@/lib/types"
import { todayGY } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Plus, Search, Edit2, ArrowRightLeft, Trash2, X } from "lucide-react"
import { toast } from "sonner"

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface QuotationForm {
  customerName: string
  customerAddress: string
  customerPhone: string
  validUntil: string
  notes: string
  items: LineItem[]
}

const emptyForm: QuotationForm = {
  customerName: "",
  customerAddress: "",
  customerPhone: "",
  validUntil: "",
  notes: "",
  items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft": return "bg-secondary text-secondary-foreground"
    case "sent": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
    case "accepted": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "rejected": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
    case "expired": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    case "converted": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
    default: return "bg-secondary text-secondary-foreground"
  }
}

type QuotationRow = {
  id: string
  quotationNumber: string
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  items: unknown
  subtotal: string
  taxTotal: string
  total: string
  status: string
  validUntil: string | null
  notes: string | null
  createdAt: string
}

export default function QuotationsPage() {
  const { data: session } = authClient.useSession()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<QuotationForm>(emptyForm)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: userProfile } = useQuery(
    orpc.settings.getCurrentUser.queryOptions({ input: {} })
  )

  const userPerms = (userProfile as { permissions?: Record<string, string[]> })?.permissions ?? {}
  const canCreate = userPerms.quotations?.includes("create") ?? false
  const canUpdate = userPerms.quotations?.includes("update") ?? false
  const canDelete = userPerms.quotations?.includes("delete") ?? false
  const canConvert = userPerms.invoices?.includes("create") ?? false

  const { data: raw = { quotations: [], total: 0 } } = useQuery(
    orpc.quotations.list.queryOptions({
      input: { search: search || undefined, status: statusFilter || undefined, limit: 50, offset: 0 },
    })
  )
  const quotations = (raw as unknown as { quotations: QuotationRow[]; total: number }).quotations

  const createMut = useMutation(
    orpc.quotations.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey })
        setDialogOpen(false)
        setForm(emptyForm)
        toast.success("Quotation created")
      },
      onError: (e) => toast.error(e.message || "Failed to create quotation"),
    })
  )

  const updateMut = useMutation(
    orpc.quotations.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey })
        setDialogOpen(false)
        setEditingId(null)
        setForm(emptyForm)
        toast.success("Quotation updated")
      },
      onError: (e) => toast.error(e.message || "Failed to update quotation"),
    })
  )

  const deleteMut = useMutation(
    orpc.quotations.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey })
        setSelectedId(null)
        toast.success("Quotation cancelled")
      },
      onError: (e) => toast.error(e.message || "Failed to cancel quotation"),
    })
  )

  const convertMut = useMutation(
    orpc.quotations.convertToInvoice.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.quotations.list.queryOptions({ input: {} }).queryKey })
        setSelectedId(null)
        toast.success("Converted to invoice")
      },
      onError: (e) => toast.error(e.message || "Failed to convert"),
    })
  )

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(q: QuotationRow) {
    setEditingId(q.id)
    setForm({
      customerName: q.customerName,
      customerAddress: q.customerAddress ?? "",
      customerPhone: q.customerPhone ?? "",
      validUntil: q.validUntil ? q.validUntil.split("T")[0] ?? "" : "",
      notes: q.notes ?? "",
      items: Array.isArray(q.items) ? (q.items as LineItem[]) : [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
    })
    setDialogOpen(true)
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setForm((f) => {
      const items = [...f.items]
      const item = { ...items[index]! }
      ;(item as Record<string, unknown>)[field] = value
      if (field === "quantity" || field === "unitPrice") {
        item.total = Number(item.quantity) * Number(item.unitPrice)
      }
      items[index] = item
      return { ...f, items }
    })
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { description: "", quantity: 1, unitPrice: 0, total: 0 }] }))
  }

  function removeItem(index: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  function handleSave() {
    const subtotal = form.items.reduce((s, i) => s + i.total, 0)
    const total = subtotal
    const userId = session?.user?.id ?? ""

    if (editingId) {
      updateMut.mutate({
        id: editingId,
        customerName: form.customerName,
        customerAddress: form.customerAddress || undefined,
        customerPhone: form.customerPhone || undefined,
        validUntil: form.validUntil || undefined,
        notes: form.notes || undefined,
        items: form.items,
        subtotal: String(subtotal),
        taxTotal: "0",
        total: String(total),
      })
    } else {
      createMut.mutate({
        customerName: form.customerName,
        customerAddress: form.customerAddress || undefined,
        customerPhone: form.customerPhone || undefined,
        validUntil: form.validUntil || undefined,
        notes: form.notes || undefined,
        items: form.items,
        subtotal: String(subtotal),
        taxTotal: "0",
        total: String(total),
        createdBy: userId,
      })
    }
  }

  const selectedQuotation = quotations.find((q) => q.id === selectedId) ?? null
  const subtotal = form.items.reduce((s, i) => s + i.total, 0)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="size-6" />
            Quotations
          </h1>
          <p className="text-sm text-muted-foreground">Create and manage customer quotations</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" />
            New Quotation
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search quotations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid: table + detail */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Quotation #</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Items</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Valid Until</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      <FileText className="mx-auto mb-2 size-8 opacity-30" />
                      No quotations yet
                    </TableCell>
                  </TableRow>
                ) : (
                  quotations.map((q) => (
                    <TableRow
                      key={q.id}
                      className={`cursor-pointer ${selectedId === q.id ? "bg-muted/50" : ""}`}
                      onClick={() => setSelectedId(q.id === selectedId ? null : q.id)}
                    >
                      <TableCell className="text-xs font-mono font-semibold">{q.quotationNumber}</TableCell>
                      <TableCell className="text-xs font-medium">{q.customerName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {Array.isArray(q.items) ? q.items.length : 0} items
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatGYD(Number(q.total))}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${statusBadgeClass(q.status)}`}>
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-GY") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={(e) => { e.stopPropagation(); openEdit(q) }}
                            >
                              <Edit2 className="size-3" />
                            </Button>
                          )}
                          {canConvert && ["sent", "accepted"].includes(q.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-blue-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                convertMut.mutate({ id: q.id, createdBy: session?.user?.id ?? "" })
                              }}
                            >
                              <ArrowRightLeft className="size-3" />
                            </Button>
                          )}
                          {canDelete && q.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteMut.mutate({ id: q.id }) }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Detail Panel */}
        <div>
          {selectedQuotation ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{selectedQuotation.quotationNumber}</span>
                  <Badge className={`text-[10px] ${statusBadgeClass(selectedQuotation.status)}`}>
                    {selectedQuotation.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="font-semibold">{selectedQuotation.customerName}</p>
                  {selectedQuotation.customerPhone && (
                    <p className="text-muted-foreground">{selectedQuotation.customerPhone}</p>
                  )}
                  {selectedQuotation.customerAddress && (
                    <p className="text-muted-foreground">{selectedQuotation.customerAddress}</p>
                  )}
                </div>
                {selectedQuotation.validUntil && (
                  <p className="text-xs text-muted-foreground">
                    Valid until: {new Date(selectedQuotation.validUntil).toLocaleDateString("en-GY")}
                  </p>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-right text-xs">Qty</TableHead>
                      <TableHead className="text-right text-xs">Price</TableHead>
                      <TableHead className="text-right text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Array.isArray(selectedQuotation.items) ? selectedQuotation.items as LineItem[] : []).map(
                      (item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{item.description}</TableCell>
                          <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                          <TableCell className="text-right text-xs">{formatGYD(item.unitPrice)}</TableCell>
                          <TableCell className="text-right text-xs">{formatGYD(item.total)}</TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{formatGYD(Number(selectedQuotation.total))}</span>
                </div>
                {selectedQuotation.notes && (
                  <p className="text-xs text-muted-foreground italic">{selectedQuotation.notes}</p>
                )}
                <div className="flex gap-2 pt-1">
                  {canUpdate && (
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(selectedQuotation)}>
                      <Edit2 className="size-3" />
                      Edit
                    </Button>
                  )}
                  {canConvert && ["sent", "accepted"].includes(selectedQuotation.status) && (
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => convertMut.mutate({ id: selectedQuotation.id, createdBy: session?.user?.id ?? "" })}
                      disabled={convertMut.isPending}
                    >
                      <ArrowRightLeft className="size-3" />
                      To Invoice
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                <FileText className="size-10 opacity-30" />
                <p className="text-sm">Select a quotation to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingId(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Quotation" : "New Quotation"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Customer Name *</Label>
                <Input
                  placeholder="Customer name"
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="Phone number"
                  value={form.customerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  min={todayGY()}
                  onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Address</Label>
                <Input
                  placeholder="Customer address"
                  value={form.customerAddress}
                  onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="flex flex-col gap-2">
              <Label>Line Items</Label>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs w-16">Qty</TableHead>
                      <TableHead className="text-xs w-28">Unit Price</TableHead>
                      <TableHead className="text-right text-xs w-24">Total</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateItem(i, "description", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            className="h-8 text-xs"
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            className="h-8 text-xs"
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-right text-xs font-medium">
                          {formatGYD(item.total)}
                        </TableCell>
                        <TableCell className="p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => removeItem(i)}
                          >
                            <X className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" className="gap-1 self-start" onClick={addItem}>
                <Plus className="size-3" />
                Add Item
              </Button>
            </div>

            {/* Totals */}
            <div className="flex justify-end gap-6 border-t pt-2 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold w-28 text-right">{formatGYD(subtotal)}</span>
            </div>
            <div className="flex justify-end gap-6 text-sm font-bold">
              <span>Total</span>
              <span className="w-28 text-right">{formatGYD(subtotal)}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="h-16 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.customerName || createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
