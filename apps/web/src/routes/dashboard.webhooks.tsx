import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Edit2,
	Eye,
	Loader2,
	Plus,
	Send,
	Trash2,
	Webhook,
	XCircle,
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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

const WEBHOOK_EVENTS = [
	{ value: "order.created", label: "Order Created" },
	{ value: "order.voided", label: "Order Voided" },
	{ value: "order.refunded", label: "Order Refunded" },
	{ value: "inventory.low_stock", label: "Low Stock Alert" },
	{ value: "inventory.updated", label: "Inventory Updated" },
	{ value: "cash_session.opened", label: "Cash Session Opened" },
	{ value: "cash_session.closed", label: "Cash Session Closed" },
	{ value: "production.logged", label: "Production Logged" },
] as const;

interface EndpointForm {
	name: string;
	url: string;
	secret: string;
	events: string[];
	isActive: boolean;
}

const emptyForm: EndpointForm = {
	name: "",
	url: "",
	secret: "",
	events: [],
	isActive: true,
};

function formatDate(dateStr: string | Date | null) {
	if (!dateStr) return "--";
	const d = new Date(dateStr);
	return d.toLocaleString("en-GY", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

export default function WebhooksPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<EndpointForm>(emptyForm);
	const [viewingEndpointId, setViewingEndpointId] = useState<string | null>(
		null,
	);

	const listKey = orpc.webhooks.listEndpoints.queryOptions({
		input: {},
	}).queryKey;

	const { data: endpoints = [], isLoading } = useQuery(
		orpc.webhooks.listEndpoints.queryOptions({ input: {} }),
	);

	const [deleteConfirmWebhook, setDeleteConfirmWebhook] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const createMut = useMutation(
		orpc.webhooks.createEndpoint.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Webhook endpoint created");
			},
			onError: (err) => toast.error(err.message || "Failed to create endpoint"),
		}),
	);

	const updateMut = useMutation(
		orpc.webhooks.updateEndpoint.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Webhook endpoint updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update endpoint"),
		}),
	);

	const deleteMut = useMutation(
		orpc.webhooks.deleteEndpoint.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				toast.success("Webhook endpoint deleted");
			},
			onError: (err) => toast.error(err.message || "Failed to delete endpoint"),
		}),
	);

	const toggleMut = useMutation(
		orpc.webhooks.updateEndpoint.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
			},
			onError: (err) => toast.error(err.message || "Failed to toggle endpoint"),
		}),
	);

	const testMut = useMutation(
		orpc.webhooks.testEndpoint.mutationOptions({
			onSuccess: () => {
				toast.success("Test webhook dispatched");
				// Refresh deliveries if viewing
				if (viewingEndpointId) {
					queryClient.invalidateQueries({
						queryKey: orpc.webhooks.getDeliveries.queryOptions({
							input: { endpointId: viewingEndpointId },
						}).queryKey,
					});
				}
			},
			onError: (err) => toast.error(err.message || "Failed to send test"),
		}),
	);

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(ep: {
		id: string;
		name: string;
		url: string;
		secret: string | null;
		events: unknown;
		isActive: boolean;
	}) {
		setEditingId(ep.id);
		setForm({
			name: ep.name,
			url: ep.url,
			secret: ep.secret || "",
			events: (ep.events as string[]) || [],
			isActive: ep.isActive,
		});
		setDialogOpen(true);
	}

	function toggleEvent(event: string) {
		setForm((prev) => ({
			...prev,
			events: prev.events.includes(event)
				? prev.events.filter((e) => e !== event)
				: [...prev.events, event],
		}));
	}

	function handleSave() {
		if (!form.name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!form.url.trim()) {
			toast.error("URL is required");
			return;
		}
		try {
			new URL(form.url);
		} catch {
			toast.error("Please enter a valid URL");
			return;
		}
		if (form.events.length === 0) {
			toast.error("Select at least one event");
			return;
		}

		const payload = {
			name: form.name,
			url: form.url,
			secret: form.secret || null,
			events: form.events,
			isActive: form.isActive,
		};

		if (editingId) {
			updateMut.mutate({ id: editingId, ...payload });
		} else {
			createMut.mutate(payload);
		}
	}

	const activeCount = endpoints.filter((ep) => ep.isActive).length;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<Webhook className="size-6 text-primary" />
						Webhook Endpoints
					</h1>
					<p className="text-muted-foreground">
						{endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}{" "}
						configured, {activeCount} active
					</p>
				</div>
				<Button onClick={openCreate}>
					<Plus className="mr-2 size-4" />
					Add Endpoint
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>URL</TableHead>
								<TableHead>Events</TableHead>
								<TableHead>Active</TableHead>
								<TableHead className="w-40">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="py-8 text-center text-muted-foreground"
									>
										<Loader2 className="mx-auto mb-2 size-6 animate-spin" />
										Loading webhooks...
									</TableCell>
								</TableRow>
							) : endpoints.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="py-8 text-center text-muted-foreground"
									>
										<Webhook className="mx-auto mb-2 size-8 opacity-50" />
										<p>No webhook endpoints configured</p>
										<p className="mt-1 text-xs">
											Click "Add Endpoint" to get started
										</p>
									</TableCell>
								</TableRow>
							) : (
								endpoints.map((ep) => (
									<TableRow key={ep.id}>
										<TableCell className="font-medium">{ep.name}</TableCell>
										<TableCell>
											<span className="block max-w-[300px] truncate font-mono text-muted-foreground text-xs">
												{ep.url}
											</span>
										</TableCell>
										<TableCell>
											<div className="flex max-w-[250px] flex-wrap gap-1">
												{(ep.events as string[]).slice(0, 3).map((event) => (
													<Badge
														key={event}
														variant="secondary"
														className="text-xs"
													>
														{event}
													</Badge>
												))}
												{(ep.events as string[]).length > 3 && (
													<Badge variant="outline" className="text-xs">
														+{(ep.events as string[]).length - 3}
													</Badge>
												)}
											</div>
										</TableCell>
										<TableCell>
											<Switch
												checked={ep.isActive}
												onCheckedChange={(checked) =>
													toggleMut.mutate({ id: ep.id, isActive: checked })
												}
											/>
										</TableCell>
										<TableCell>
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="sm"
													title="View deliveries"
													onClick={() =>
														setViewingEndpointId(
															viewingEndpointId === ep.id ? null : ep.id,
														)
													}
												>
													<Eye className="size-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													title="Send test ping"
													disabled={testMut.isPending}
													onClick={() => testMut.mutate({ id: ep.id })}
												>
													<Send className="size-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													title="Edit"
													onClick={() => openEdit(ep)}
												>
													<Edit2 className="size-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													title="Delete"
													onClick={() => {
														setDeleteConfirmWebhook({
															id: ep.id,
															name: ep.name,
														});
													}}
												>
													<Trash2 className="size-3.5 text-destructive" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Delivery Log */}
			{viewingEndpointId && (
				<DeliveryLog
					endpointId={viewingEndpointId}
					endpointName={
						endpoints.find((ep) => ep.id === viewingEndpointId)?.name ||
						"Endpoint"
					}
					onClose={() => setViewingEndpointId(null)}
				/>
			)}

			{/* Add/Edit Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Webhook Endpoint" : "Add Webhook Endpoint"}
						</DialogTitle>
						<DialogDescription>
							Configure a URL to receive event notifications from the POS
							system.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Name *</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								placeholder="e.g. Accounting System, Slack Notifications"
							/>
						</div>

						<div>
							<Label>URL *</Label>
							<Input
								value={form.url}
								onChange={(e) => setForm({ ...form, url: e.target.value })}
								placeholder="https://example.com/webhooks"
								type="url"
							/>
						</div>

						<div>
							<Label>Signing Secret (optional)</Label>
							<Input
								value={form.secret}
								onChange={(e) => setForm({ ...form, secret: e.target.value })}
								placeholder="Used for HMAC-SHA256 signature verification"
								type="password"
							/>
							<p className="mt-1 text-muted-foreground text-xs">
								If set, each delivery will include an X-Webhook-Signature
								header.
							</p>
						</div>

						<div>
							<Label className="mb-2 block">Events *</Label>
							<div className="grid grid-cols-2 gap-2">
								{WEBHOOK_EVENTS.map((evt) => {
									const isSelected = form.events.includes(evt.value);
									return (
										<button
											key={evt.value}
											type="button"
											onClick={() => toggleEvent(evt.value)}
											className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
												isSelected
													? "border-primary bg-primary/10 text-primary"
													: "border-border bg-background text-muted-foreground hover:bg-muted"
											}`}
										>
											{isSelected ? (
												<CheckCircle2 className="size-3.5 shrink-0" />
											) : (
												<div className="size-3.5 shrink-0 rounded-full border border-muted-foreground/30" />
											)}
											<span className="truncate">{evt.label}</span>
										</button>
									);
								})}
							</div>
							<div className="mt-2 flex gap-2">
								<Button
									variant="outline"
									size="sm"
									type="button"
									onClick={() =>
										setForm({
											...form,
											events: WEBHOOK_EVENTS.map((e) => e.value),
										})
									}
								>
									Select All
								</Button>
								<Button
									variant="outline"
									size="sm"
									type="button"
									onClick={() => setForm({ ...form, events: [] })}
								>
									Clear All
								</Button>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<Switch
								checked={form.isActive}
								onCheckedChange={(checked) =>
									setForm({ ...form, isActive: checked })
								}
							/>
							<Label>Active</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={createMut.isPending || updateMut.isPending}
						>
							{createMut.isPending || updateMut.isPending
								? "Saving..."
								: "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{/* Delete Webhook Confirmation */}
			<AlertDialog
				open={!!deleteConfirmWebhook}
				onOpenChange={(o) => {
					if (!o) setDeleteConfirmWebhook(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete "{deleteConfirmWebhook?.name}"?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This webhook endpoint will be permanently deleted.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								deleteConfirmWebhook &&
								deleteMut.mutate({ id: deleteConfirmWebhook.id })
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

// ── Delivery Log Component ──────────────────────────────────────────────

function DeliveryLog({
	endpointId,
	endpointName,
	onClose,
}: {
	endpointId: string;
	endpointName: string;
	onClose: () => void;
}) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const { data: deliveries = [], isLoading } = useQuery(
		orpc.webhooks.getDeliveries.queryOptions({
			input: { endpointId, limit: 50, offset: 0 },
		}),
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-lg">
							Delivery Log: {endpointName}
						</CardTitle>
						<CardDescription>
							Recent webhook deliveries ({deliveries.length} shown)
						</CardDescription>
					</div>
					<Button variant="outline" size="sm" onClick={onClose}>
						Close
					</Button>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-8" />
							<TableHead>Event</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Duration</TableHead>
							<TableHead>Time</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="py-8 text-center text-muted-foreground"
								>
									<Loader2 className="mx-auto mb-2 size-5 animate-spin" />
									Loading deliveries...
								</TableCell>
							</TableRow>
						) : deliveries.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="py-8 text-center text-muted-foreground"
								>
									No deliveries yet. Send a test ping to verify the endpoint.
								</TableCell>
							</TableRow>
						) : (
							deliveries.map((d) => {
								const isExpanded = expandedId === d.id;
								return (
									<Collapsible key={d.id} asChild open={isExpanded}>
										<CollapsibleTrigger asChild>
											<TableRow
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => setExpandedId(isExpanded ? null : d.id)}
											>
												<TableCell>
													{isExpanded ? (
														<ChevronDown className="size-4" />
													) : (
														<ChevronRight className="size-4" />
													)}
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className="font-mono text-xs"
													>
														{d.event}
													</Badge>
												</TableCell>
												<TableCell>
													{d.success ? (
														<div className="flex items-center gap-1.5">
															<CheckCircle2 className="size-4 text-green-600" />
															<span className="text-green-600 text-sm">
																{d.statusCode}
															</span>
														</div>
													) : (
														<div className="flex items-center gap-1.5">
															<XCircle className="size-4 text-destructive" />
															<span className="text-destructive text-sm">
																{d.statusCode || "Failed"}
															</span>
														</div>
													)}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1 text-muted-foreground text-sm">
														<Clock className="size-3" />
														{d.duration != null ? `${d.duration}ms` : "--"}
													</div>
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{formatDate(d.createdAt)}
												</TableCell>
											</TableRow>
										</CollapsibleTrigger>
										<CollapsibleContent asChild>
											<TableRow className="bg-muted/30">
												<TableCell colSpan={5} className="py-3">
													<div className="grid gap-3 md:grid-cols-2">
														<div>
															<p className="mb-1 font-semibold text-muted-foreground text-xs">
																Request Payload
															</p>
															<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 font-mono text-xs">
																{JSON.stringify(d.payload, null, 2)}
															</pre>
														</div>
														<div>
															<p className="mb-1 font-semibold text-muted-foreground text-xs">
																Response Body
															</p>
															<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 font-mono text-xs">
																{d.responseBody || "(empty)"}
															</pre>
														</div>
													</div>
												</TableCell>
											</TableRow>
										</CollapsibleContent>
									</Collapsible>
								);
							})
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
