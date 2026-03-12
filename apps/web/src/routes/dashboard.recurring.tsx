import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  Edit2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// ── Types ────────────────────────────────────────────────────────────────────

type RecurringType = "invoice" | "expense" | "vendor_bill";
type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";

interface TemplateRow {
  id: string;
  name: string;
  type: RecurringType;
  frequency: RecurringFrequency;
  status?: "active" | "paused" | "completed";
  startDate?: string | null;
  remainingCycles?: number | null;
  priceAutomationMode?: "none" | "fixed_update" | "percent_increase";
  priceAutomationValue?: string | number | null;
  nextRunDate: string | null;
  endDate: string | null;
  isActive: boolean;
  templateData: Record<string, unknown> | null;
  createdAt: string;
}

interface RecurringRun {
  id: string;
  generatedType: RecurringType;
  generatedId: string | null;
  status: "success" | "failed";
  createdAt: string;
  details: Record<string, unknown> | null;
}

interface TemplateForm {
  name: string;
  type: RecurringType;
  frequency: RecurringFrequency;
  startDate: string;
  nextRunDate: string;
  endDate: string;
  remainingCycles: string;
  priceAutomationMode: "none" | "fixed_update" | "percent_increase";
  priceAutomationValue: string;
  description: string;
}

const emptyForm: TemplateForm = {
  name: "",
  type: "invoice",
  frequency: "monthly",
  startDate: "",
  nextRunDate: "",
  endDate: "",
  remainingCycles: "",
  priceAutomationMode: "none",
  priceAutomationValue: "",
  description: "",
};

const TYPE_FILTERS = ["All", "Invoice", "Expense", "Vendor Bill"] as const;

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

// ── Badges ───────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: RecurringType }) {
  const map: Record<RecurringType, { label: string; cls: string }> = {
    invoice: {
      label: "Invoice",
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    },
    expense: {
      label: "Expense",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    },
    vendor_bill: {
      label: "Vendor Bill",
      cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    },
  };
  const { label, cls } = map[type] ?? {
    label: type,
    cls: "bg-secondary text-secondary-foreground",
  };
  return <Badge className={`text-[10px] ${cls}`}>{label}</Badge>;
}

function FrequencyBadge({ frequency }: { frequency: RecurringFrequency }) {
  return (
    <Badge className="bg-secondary text-[10px] text-secondary-foreground">
      {FREQUENCY_LABELS[frequency] ?? frequency}
    </Badge>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  // Generate confirmation
  const [generateTemplate, setGenerateTemplate] = useState<TemplateRow | null>(
    null,
  );
  const [historyTemplate, setHistoryTemplate] = useState<TemplateRow | null>(
    null,
  );

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: raw = [], isLoading } = useQuery(
    orpc.recurring.list.queryOptions({ input: {} }),
  );
  const allTemplates = raw as unknown as TemplateRow[];

  const { data: runHistory = [], isLoading: isHistoryLoading } = useQuery({
    ...orpc.recurring.runHistory.queryOptions({
      input: {
        templateId:
          historyTemplate?.id ?? "00000000-0000-0000-0000-000000000000",
        limit: 15,
      },
    }),
    enabled: Boolean(historyTemplate?.id),
  });
  const templateRuns = runHistory as unknown as RecurringRun[];

  // ── Client-side filter ───────────────────────────────────────────────────

  const filtered = allTemplates.filter((t) => {
    if (typeFilter === "All") return true;
    const typeMap: Record<string, RecurringType> = {
      Invoice: "invoice",
      Expense: "expense",
      "Vendor Bill": "vendor_bill",
    };
    return t.type === typeMap[typeFilter];
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: orpc.recurring.list.queryOptions({ input: {} }).queryKey,
    });
  }

  const createMut = useMutation(
    orpc.recurring.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        setDialogOpen(false);
        setForm(emptyForm);
        toast.success("Template created");
      },
      onError: (e) => toast.error(e.message || "Failed to create template"),
    }),
  );

  const updateMut = useMutation(
    orpc.recurring.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        setDialogOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        toast.success("Template updated");
      },
      onError: (e) => toast.error(e.message || "Failed to update template"),
    }),
  );

  const deleteMut = useMutation(
    orpc.recurring.delete.mutationOptions({
      onSuccess: () => {
        invalidate();
        setDeleteId(null);
        toast.success("Template deleted");
      },
      onError: (e) => toast.error(e.message || "Failed to delete template"),
    }),
  );

  const pauseMut = useMutation(
    orpc.recurring.pause.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Template paused");
      },
      onError: (e) => toast.error(e.message || "Failed to pause template"),
    }),
  );

  const resumeMut = useMutation(
    orpc.recurring.resume.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Template resumed");
      },
      onError: (e) => toast.error(e.message || "Failed to resume template"),
    }),
  );

  const generateMut = useMutation(
    orpc.recurring.generateNext.mutationOptions({
      onSuccess: () => {
        invalidate();
        setGenerateTemplate(null);
        toast.success("Next occurrence generated");
      },
      onError: (e) => toast.error(e.message || "Failed to generate occurrence"),
    }),
  );

  // ── Helpers ──────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, nextRunDate: todayGY() });
    setDialogOpen(true);
  }

  function openEdit(t: TemplateRow) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      type: t.type,
      frequency: t.frequency,
      startDate: t.startDate ? (t.startDate.split("T")[0] ?? "") : "",
      nextRunDate: t.nextRunDate ? (t.nextRunDate.split("T")[0] ?? "") : "",
      endDate: t.endDate ? (t.endDate.split("T")[0] ?? "") : "",
      remainingCycles:
        t.remainingCycles === null || t.remainingCycles === undefined
          ? ""
          : String(t.remainingCycles),
      priceAutomationMode: t.priceAutomationMode ?? "none",
      priceAutomationValue:
        t.priceAutomationValue == null ? "" : String(t.priceAutomationValue),
      description: String(t.templateData?.description ?? ""),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const templateData: Record<string, unknown> = form.description
      ? { description: form.description }
      : {};

    const remainingCycles = form.remainingCycles
      ? Number.parseInt(form.remainingCycles, 10)
      : undefined;
    const priceAutomationValue = form.priceAutomationValue
      ? Number.parseFloat(form.priceAutomationValue)
      : undefined;

    if (
      remainingCycles !== undefined &&
      (!Number.isFinite(remainingCycles) || remainingCycles <= 0)
    ) {
      toast.error("Remaining cycles must be a positive whole number");
      return;
    }

    if (
      priceAutomationValue !== undefined &&
      !Number.isFinite(priceAutomationValue)
    ) {
      toast.error("Price automation value must be a valid number");
      return;
    }

    if (editingId) {
      updateMut.mutate({
        id: editingId,
        name: form.name,
        templateType: form.type,
        frequency: form.frequency,
        startDate: form.startDate || undefined,
        nextRunDate: form.nextRunDate || undefined,
        endDate: form.endDate || undefined,
        remainingCycles,
        priceAutomationMode: form.priceAutomationMode,
        priceAutomationValue,
        templateData,
      });
    } else {
      createMut.mutate({
        name: form.name,
        templateType: form.type,
        frequency: form.frequency,
        startDate: form.startDate || undefined,
        nextRunDate: form.nextRunDate || todayGY(),
        endDate: form.endDate || undefined,
        remainingCycles,
        priceAutomationMode: form.priceAutomationMode,
        priceAutomationValue,
        templateData,
      });
    }
  }

  function toggleActive(t: TemplateRow) {
    if (t.status === "completed") {
      toast.error("Completed templates cannot be reactivated");
      return;
    }

    if (t.isActive) {
      pauseMut.mutate({ id: t.id });
    } else {
      resumeMut.mutate({ id: t.id });
    }
  }

  // ── Generate preview ─────────────────────────────────────────────────────

  function generatePreview(t: TemplateRow): string {
    const typeLabels: Record<RecurringType, string> = {
      invoice: "invoice",
      expense: "expense",
      vendor_bill: "vendor bill",
    };
    const desc = t.templateData?.description
      ? ` — "${String(t.templateData.description)}"`
      : "";
    const next = t.nextRunDate
      ? ` for ${new Date(t.nextRunDate).toLocaleDateString("en-GY")}`
      : "";
    return `Generate ${typeLabels[t.type]}${next}${desc}`;
  }

  function statusLabel(t: TemplateRow): string {
    if (t.status === "completed") return "Completed";
    return t.isActive ? "Active" : "Paused";
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
            <RefreshCw className="size-6" />
            Recurring Templates
          </h1>
          <p className="text-muted-foreground text-sm">
            Automate recurring invoices, expenses, and vendor bills
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          New Template
        </Button>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTypeFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary/60 hover:bg-primary/5 ${
              typeFilter === f
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <RefreshCw className="size-10 opacity-30" />
            <p className="text-sm">No recurring templates yet</p>
            <p className="text-xs">
              Create a template to automatically generate invoices, expenses, or
              vendor bills on a schedule.
            </p>
            <Button onClick={openCreate} size="sm" className="mt-2 gap-1">
              <Plus className="size-3" />
              New Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card
              key={t.id}
              className={`transition-shadow hover:shadow-md ${!t.isActive ? "opacity-60" : ""}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="leading-tight">{t.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                      type="button"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => openEdit(t)}>
                        <Edit2 className="mr-2 size-3.5" />
                        Edit Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistoryTemplate(t)}>
                        <Clock3 className="mr-2 size-3.5" />
                        Run History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeleteId(t.id);
                          setDeleteName(t.name);
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {/* Type + Frequency badges */}
                <div className="flex flex-wrap gap-1.5">
                  <TypeBadge type={t.type} />
                  <FrequencyBadge frequency={t.frequency} />
                </div>

                {/* Next run */}
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs">
                    Next run:{" "}
                  </span>
                  <span className="font-medium text-xs">
                    {t.nextRunDate
                      ? new Date(t.nextRunDate).toLocaleDateString("en-GY")
                      : "Not set"}
                  </span>
                </div>

                {t.endDate && (
                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">
                      Ends:{" "}
                    </span>
                    <span className="text-xs">
                      {new Date(t.endDate).toLocaleDateString("en-GY")}
                    </span>
                  </div>
                )}

                {t.remainingCycles !== undefined &&
                  t.remainingCycles !== null && (
                    <div className="text-sm">
                      <span className="text-muted-foreground text-xs">
                        Remaining cycles:
                      </span>
                      <span className="text-xs">{t.remainingCycles}</span>
                    </div>
                  )}

                {!!t.templateData?.description && (
                  <p className="line-clamp-2 text-muted-foreground text-xs italic">
                    {String(t.templateData.description)}
                  </p>
                )}

                {/* Active toggle + Generate button */}
                <div className="flex items-center justify-between border-t pt-2">
                  <div className="flex cursor-pointer items-center gap-2 text-sm">
                    <div
                      role="switch"
                      aria-checked={t.isActive}
                      tabIndex={0}
                      onClick={() => toggleActive(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleActive(t);
                        }
                      }}
                      className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        t.isActive ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          t.isActive ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                    <span className="text-xs">{statusLabel(t)}</span>
                  </div>

                  {t.status !== "completed" && t.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={generateMut.isPending}
                      onClick={() => setGenerateTemplate(t)}
                    >
                      <Play className="size-3" />
                      Generate Next
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditingId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Template" : "New Recurring Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g. Monthly Rent, Weekly Payroll Invoice"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as RecurringType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="vendor_bill">Vendor Bill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Frequency *</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      frequency: v as RecurringFrequency,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Start Date (optional)</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Next Run Date</Label>
                <Input
                  type="date"
                  value={form.nextRunDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nextRunDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Remaining Cycles (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.remainingCycles}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, remainingCycles: e.target.value }))
                  }
                  placeholder="Unlimited if blank"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Price Automation</Label>
                <Select
                  value={form.priceAutomationMode}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priceAutomationMode: v as
                        | "none"
                        | "fixed_update"
                        | "percent_increase",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No auto update</SelectItem>
                    <SelectItem value="fixed_update">
                      Set fixed unit price/amount
                    </SelectItem>
                    <SelectItem value="percent_increase">
                      Increase by percent
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  Automation Value{" "}
                  {form.priceAutomationMode === "percent_increase" ? "(%)" : ""}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.priceAutomationValue}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priceAutomationValue: e.target.value,
                    }))
                  }
                  disabled={form.priceAutomationMode === "none"}
                  placeholder={
                    form.priceAutomationMode === "percent_increase"
                      ? "e.g. 5"
                      : "e.g. 100.00"
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Description / Notes{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Textarea
                placeholder="Customer name, supplier, amount, or any notes for the generated documents..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="h-20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !form.name || createMut.isPending || updateMut.isPending
              }
            >
              {createMut.isPending || updateMut.isPending
                ? "Saving..."
                : editingId
                  ? "Update Template"
                  : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the recurring template. Already
              generated invoices, expenses, or bills will not be affected. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMut.mutate({ id: deleteId })}
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Confirmation */}
      <AlertDialog
        open={!!generateTemplate}
        onOpenChange={(open) => {
          if (!open) setGenerateTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Generate next {generateTemplate?.type.replace("_", " ")}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                {generateTemplate && (
                  <>
                    <p>{generatePreview(generateTemplate)}</p>
                    <div className="rounded-md bg-muted/50 p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Template</span>
                        <span className="font-medium">
                          {generateTemplate.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span>{generateTemplate.type.replace("_", " ")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency</span>
                        <span>
                          {FREQUENCY_LABELS[generateTemplate.frequency]}
                        </span>
                      </div>
                      {generateTemplate.nextRunDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Scheduled for
                          </span>
                          <span>
                            {new Date(
                              generateTemplate.nextRunDate,
                            ).toLocaleDateString("en-GY")}
                          </span>
                        </div>
                      )}
                      {!!generateTemplate.templateData?.description && (
                        <div className="mt-1 border-t pt-1">
                          <span className="text-muted-foreground">Notes: </span>
                          <span>
                            {String(generateTemplate.templateData.description)}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      The next run date will be updated automatically after
                      generation.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                generateTemplate &&
                generateMut.mutate({ id: generateTemplate.id })
              }
            >
              Generate Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run History Dialog */}
      <Dialog
        open={Boolean(historyTemplate)}
        onOpenChange={(open) => {
          if (!open) setHistoryTemplate(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Run History{historyTemplate ? ` — ${historyTemplate.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {isHistoryLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : templateRuns.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No runs recorded yet.
              </p>
            ) : (
              templateRuns.map((run) => (
                <div key={run.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {run.generatedType.replace("_", " ")}
                    </span>
                    <Badge
                      className={
                        run.status === "success"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {new Date(run.createdAt).toLocaleString("en-GY")}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
