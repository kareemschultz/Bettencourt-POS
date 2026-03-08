import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Bell,
	CheckCircle2,
	Clock,
	Info,
	MessageCircle,
	MessageSquare,
	Pencil,
	Phone,
	Plus,
	Send,
	Settings,
	Smartphone,
	TestTube,
	Trash2,
	XCircle,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
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
	AlertDialogTrigger,
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

export default function NotificationsPage() {
	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Page Header */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<MessageSquare className="size-6 text-primary" />
					<h1 className="font-bold text-xl sm:text-2xl">SMS & Notifications</h1>
				</div>
				<p className="text-muted-foreground text-sm">
					Configure automated SMS and WhatsApp notifications to keep your
					customers informed about their orders, loyalty rewards, and more.
				</p>
			</div>

			<Tabs defaultValue="templates" className="w-full">
				<TabsList>
					<TabsTrigger value="templates" className="gap-1.5">
						<Bell className="size-3.5" /> Templates
					</TabsTrigger>
					<TabsTrigger value="log" className="gap-1.5">
						<Clock className="size-3.5" /> Delivery Log
					</TabsTrigger>
					<TabsTrigger value="settings" className="gap-1.5">
						<Settings className="size-3.5" /> Provider Settings
					</TabsTrigger>
				</TabsList>

				<TabsContent value="templates" className="mt-4">
					<TemplatesTab />
				</TabsContent>
				<TabsContent value="log" className="mt-4">
					<DeliveryLogTab />
				</TabsContent>
				<TabsContent value="settings" className="mt-4">
					<ProviderSettingsTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// ── Delete Template Confirmation ────────────────────────────────────────

function DeleteTemplateConfirmation({
	templateId,
	templateName,
	onConfirm,
}: {
	templateId: string;
	templateName: string;
	onConfirm: (id: string) => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="size-7 text-destructive hover:text-destructive"
				>
					<Trash2 className="size-3.5" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Template</AlertDialogTitle>
					<AlertDialogDescription>
						Delete &quot;{templateName}&quot;? This cannot be undone and will
						stop this message from being sent.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						onClick={() => onConfirm(templateId)}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// ── Templates Tab ──────────────────────────────────────────────────────

function TemplatesTab() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingTemplate, setEditingTemplate] = useState<Record<
		string,
		unknown
	> | null>(null);

	const { data: templates = [] } = useQuery(
		orpc.notifications.listTemplates.queryOptions({ input: {} }),
	);

	const { data: availableEvents = [] } = useQuery(
		orpc.notifications.getAvailableEvents.queryOptions({ input: {} }),
	);

	const deleteMutation = useMutation(
		orpc.notifications.deleteTemplate.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["notifications"] });
				toast.success("Template deleted");
			},
		}),
	);

	const channelIcon = (ch: string) => {
		switch (ch) {
			case "sms":
				return <Smartphone className="size-3.5 text-blue-500" />;
			case "whatsapp":
				return <MessageCircle className="size-3.5 text-green-500" />;
			default:
				return <MessageSquare className="size-3.5 text-purple-500" />;
		}
	};

	return (
		<div className="flex flex-col gap-4">
			{/* Info Banner */}
			<Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
				<CardContent className="flex items-start gap-3 p-4">
					<Info className="mt-0.5 size-5 shrink-0 text-blue-500" />
					<div className="text-sm">
						<p className="font-medium text-blue-700 dark:text-blue-400">
							How notification templates work
						</p>
						<p className="mt-1 text-blue-600/80 dark:text-blue-400/70">
							Each template defines the message sent for a specific event. Use
							placeholders like{" "}
							<code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">
								{"{{customerName}}"}
							</code>
							,{" "}
							<code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">
								{"{{orderNumber}}"}
							</code>
							, and{" "}
							<code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">
								{"{{amount}}"}
							</code>{" "}
							to personalize messages. Toggle templates on/off without deleting
							them.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Actions */}
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{templates.length} template{templates.length !== 1 ? "s" : ""}{" "}
					configured
				</p>
				<Dialog
					open={dialogOpen}
					onOpenChange={(o) => {
						setDialogOpen(o);
						if (!o) setEditingTemplate(null);
					}}
				>
					<DialogTrigger asChild>
						<Button size="sm" className="gap-1.5">
							<Plus className="size-3.5" /> New Template
						</Button>
					</DialogTrigger>
					<TemplateDialog
						template={editingTemplate}
						availableEvents={
							availableEvents as {
								event: string;
								name: string;
								description: string;
								defaultTemplate: string;
							}[]
						}
						onClose={() => {
							setDialogOpen(false);
							setEditingTemplate(null);
						}}
					/>
				</Dialog>
			</div>

			{/* Available Events (unconfigured) */}
			{availableEvents.length > 0 && (
				<div className="flex flex-col gap-2">
					<h3 className="font-medium text-muted-foreground text-sm">
						Quick Setup — Available Events
					</h3>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{(
							availableEvents as {
								event: string;
								name: string;
								description: string;
								defaultTemplate: string;
							}[]
						)
							.filter(
								(ev) =>
									!(templates as Record<string, unknown>[]).some(
										(t) => t.event === ev.event,
									),
							)
							.map((ev) => (
								<Card key={ev.event} className="border-dashed">
									<CardContent className="flex flex-col gap-2 p-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Zap className="size-3.5 text-amber-500" />
												<span className="font-medium text-sm">{ev.name}</span>
											</div>
											<Badge variant="outline" className="text-[10px]">
												Not configured
											</Badge>
										</div>
										<p className="text-muted-foreground text-xs">
											{ev.description}
										</p>
										<Button
											size="sm"
											variant="outline"
											className="mt-1 gap-1 text-xs"
											onClick={() => {
												setEditingTemplate({
													event: ev.event,
													name: ev.name,
													description: ev.description,
													messageTemplate: ev.defaultTemplate,
													channel: "sms",
													isActive: true,
												});
												setDialogOpen(true);
											}}
										>
											<Plus className="size-3" /> Use Default Template
										</Button>
									</CardContent>
								</Card>
							))}
					</div>
				</div>
			)}

			{/* Configured Templates */}
			{(templates as Record<string, unknown>[]).length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Active Templates</CardTitle>
						<CardDescription>
							These templates are used to send notifications when events occur
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Event</TableHead>
									<TableHead>Channel</TableHead>
									<TableHead className="hidden md:table-cell">
										Message Preview
									</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="w-[100px]">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(templates as Record<string, unknown>[]).map((t) => (
									<TableRow key={t.id as string}>
										<TableCell>
											<div className="flex flex-col gap-0.5">
												<span className="font-medium text-sm">
													{t.name as string}
												</span>
												<span className="font-mono text-muted-foreground text-xs">
													{t.event as string}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1.5">
												{channelIcon(t.channel as string)}
												<span className="text-xs capitalize">
													{t.channel as string}
												</span>
											</div>
										</TableCell>
										<TableCell className="hidden max-w-[300px] md:table-cell">
											<p className="truncate text-muted-foreground text-xs">
												{t.messageTemplate as string}
											</p>
										</TableCell>
										<TableCell>
											{t.isActive ? (
												<Badge className="gap-1 border-emerald-200 bg-emerald-500/10 text-emerald-600">
													<CheckCircle2 className="size-3" /> Active
												</Badge>
											) : (
												<Badge variant="secondary" className="gap-1">
													<Clock className="size-3" /> Paused
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												<Button
													size="icon"
													variant="ghost"
													className="size-7"
													onClick={() => {
														setEditingTemplate(t);
														setDialogOpen(true);
													}}
												>
													<Pencil className="size-3.5" />
												</Button>
												<DeleteTemplateConfirmation
													templateId={t.id as string}
													templateName={t.name as string}
													onConfirm={(id) => deleteMutation.mutate({ id })}
												/>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// ── Template Dialog ────────────────────────────────────────────────────

function TemplateDialog({
	template,
	availableEvents,
	onClose,
}: {
	template: Record<string, unknown> | null;
	availableEvents: {
		event: string;
		name: string;
		description: string;
		defaultTemplate: string;
	}[];
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const isEditing = template?.id;
	const [event, setEvent] = useState((template?.event as string) || "");
	const [name, setName] = useState((template?.name as string) || "");
	const [channel, setChannel] = useState(
		(template?.channel as string) || "sms",
	);
	const [messageTemplate, setMessageTemplate] = useState(
		(template?.messageTemplate as string) || "",
	);
	const [isActive, setIsActive] = useState(template?.isActive !== false);

	const createMutation = useMutation(
		orpc.notifications.createTemplate.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["notifications"] });
				toast.success("Template created");
				onClose();
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.notifications.updateTemplate.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["notifications"] });
				toast.success("Template updated");
				onClose();
			},
		}),
	);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (isEditing) {
			updateMutation.mutate({
				id: template.id as string,
				name,
				channel: channel as "sms" | "whatsapp" | "both",
				messageTemplate,
				isActive,
			});
		} else {
			createMutation.mutate({
				event,
				name,
				channel: channel as "sms" | "whatsapp" | "both",
				messageTemplate,
				isActive,
			});
		}
	}

	const selectedEventInfo = availableEvents.find((e) => e.event === event);

	return (
		<DialogContent className="max-w-lg">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<Bell className="size-4" />
					{isEditing ? "Edit Template" : "Create Notification Template"}
				</DialogTitle>
				<DialogDescription>
					{isEditing
						? "Update the message template and delivery channel for this notification."
						: "Set up an automated notification that triggers when a specific event occurs in your POS system."}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				{!isEditing && (
					<div className="flex flex-col gap-2">
						<Label htmlFor="event">Trigger Event</Label>
						<Select
							value={event}
							onValueChange={(v) => {
								setEvent(v);
								const info = availableEvents.find((e) => e.event === v);
								if (info && !name) setName(info.name);
								if (info && !messageTemplate)
									setMessageTemplate(info.defaultTemplate);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select when this notification fires" />
							</SelectTrigger>
							<SelectContent>
								{availableEvents.map((ev) => (
									<SelectItem key={ev.event} value={ev.event}>
										<div className="flex flex-col">
											<span>{ev.name}</span>
											<span className="text-muted-foreground text-xs">
												{ev.description}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedEventInfo && (
							<p className="flex items-start gap-1.5 text-muted-foreground text-xs">
								<Info className="mt-0.5 size-3 shrink-0" />
								{selectedEventInfo.description}
							</p>
						)}
					</div>
				)}

				<div className="flex flex-col gap-2">
					<Label htmlFor="name">Template Name</Label>
					<Input
						id="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g., Order Ready SMS"
						required
					/>
					<p className="text-muted-foreground text-xs">
						A friendly name to identify this template in your list
					</p>
				</div>

				<div className="flex flex-col gap-2">
					<Label>Delivery Channel</Label>
					<Select value={channel} onValueChange={setChannel}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="sms">
								<div className="flex items-center gap-2">
									<Smartphone className="size-3.5 text-blue-500" /> SMS
								</div>
							</SelectItem>
							<SelectItem value="whatsapp">
								<div className="flex items-center gap-2">
									<MessageCircle className="size-3.5 text-green-500" /> WhatsApp
								</div>
							</SelectItem>
							<SelectItem value="both">
								<div className="flex items-center gap-2">
									<MessageSquare className="size-3.5 text-purple-500" /> Both
									(SMS + WhatsApp)
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						{channel === "sms"
							? "Standard text message — works on all phones, charged per message"
							: channel === "whatsapp"
								? "WhatsApp message — free for customers, requires WhatsApp Business API"
								: "Sends via both channels — customer receives on whichever they use"}
					</p>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="message">Message Template</Label>
					<Textarea
						id="message"
						value={messageTemplate}
						onChange={(e) => setMessageTemplate(e.target.value)}
						placeholder="Hi {{customerName}}, your order #{{orderNumber}} is ready!"
						rows={3}
						required
					/>
					<div className="flex flex-wrap gap-1.5">
						<span className="text-muted-foreground text-xs">
							Available placeholders:
						</span>
						{[
							"customerName",
							"orderNumber",
							"amount",
							"points",
							"totalPoints",
							"estimatedTime",
						].map((p) => (
							<Badge
								key={p}
								variant="outline"
								className="cursor-pointer text-[10px] hover:bg-primary/10"
								onClick={() => setMessageTemplate((prev) => `${prev}{{${p}}}`)}
							>
								{`{{${p}}}`}
							</Badge>
						))}
					</div>
				</div>

				<div className="flex items-center justify-between rounded-md border p-3">
					<div>
						<p className="font-medium text-sm">Active</p>
						<p className="text-muted-foreground text-xs">
							Enable or disable this notification without deleting it
						</p>
					</div>
					<Switch checked={isActive} onCheckedChange={setIsActive} />
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={createMutation.isPending || updateMutation.isPending}
						className="gap-1.5"
					>
						<Send className="size-3.5" />
						{isEditing ? "Update" : "Create"} Template
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

// ── Delivery Log Tab ───────────────────────────────────────────────────

function DeliveryLogTab() {
	const [statusFilter, setStatusFilter] = useState<string>("");

	const { data } = useQuery(
		orpc.notifications.getLog.queryOptions({
			input: {
				limit: 50,
				offset: 0,
				...(statusFilter
					? {
							status: statusFilter as
								| "pending"
								| "sent"
								| "delivered"
								| "failed",
						}
					: {}),
			},
		}),
	);

	const { data: stats } = useQuery(
		orpc.notifications.getStats.queryOptions({ input: {} }),
	);

	const logs = (data?.items || []) as Record<string, unknown>[];

	const statusConfig: Record<
		string,
		{ icon: typeof CheckCircle2; color: string; label: string }
	> = {
		pending: { icon: Clock, color: "text-amber-500", label: "Pending" },
		sent: { icon: Send, color: "text-blue-500", label: "Sent" },
		delivered: {
			icon: CheckCircle2,
			color: "text-emerald-500",
			label: "Delivered",
		},
		failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
	};

	return (
		<div className="flex flex-col gap-4">
			{/* Stats Cards */}
			<div className="grid grid-cols-3 gap-3">
				<Card>
					<CardContent className="flex items-center gap-3 p-4">
						<div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
							<Send className="size-5 text-blue-500" />
						</div>
						<div>
							<p className="font-bold text-2xl">{stats?.todaySent ?? 0}</p>
							<p className="text-muted-foreground text-xs">Sent Today</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 p-4">
						<div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
							<XCircle className="size-5 text-red-500" />
						</div>
						<div>
							<p className="font-bold text-2xl">{stats?.todayFailed ?? 0}</p>
							<p className="text-muted-foreground text-xs">Failed Today</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 p-4">
						<div className="flex size-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
							<MessageSquare className="size-5 text-purple-500" />
						</div>
						<div>
							<p className="font-bold text-2xl">{stats?.todayTotal ?? 0}</p>
							<p className="text-muted-foreground text-xs">Total Today</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filter + Table */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<div>
						<CardTitle className="text-base">Delivery Log</CardTitle>
						<CardDescription>
							Track every notification sent from your system — view status,
							recipient, and message content
						</CardDescription>
					</div>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="w-[140px]">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All statuses</SelectItem>
							<SelectItem value="sent">Sent</SelectItem>
							<SelectItem value="delivered">Delivered</SelectItem>
							<SelectItem value="failed">Failed</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
						</SelectContent>
					</Select>
				</CardHeader>
				<CardContent>
					{logs.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-12 text-center">
							<MessageSquare className="size-10 text-muted-foreground/40" />
							<p className="text-muted-foreground text-sm">
								No notifications sent yet
							</p>
							<p className="text-muted-foreground/70 text-xs">
								Notifications will appear here once your templates are
								configured and events trigger
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Status</TableHead>
									<TableHead>Event</TableHead>
									<TableHead>Channel</TableHead>
									<TableHead>Recipient</TableHead>
									<TableHead className="hidden lg:table-cell">
										Message
									</TableHead>
									<TableHead>Time</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{logs.map((log) => {
									const cfg =
										statusConfig[log.status as string] || statusConfig.pending!;
									const StatusIcon = cfg.icon;
									return (
										<TableRow key={log.id as string}>
											<TableCell>
												<div className="flex items-center gap-1.5">
													<StatusIcon className={`size-3.5 ${cfg.color}`} />
													<span className="text-xs">{cfg.label}</span>
												</div>
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className="font-mono text-[10px]"
												>
													{log.event as string}
												</Badge>
											</TableCell>
											<TableCell className="text-xs capitalize">
												{log.channel as string}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1.5">
													<Phone className="size-3 text-muted-foreground" />
													<span className="font-mono text-xs">
														{log.recipient as string}
													</span>
												</div>
											</TableCell>
											<TableCell className="hidden max-w-[250px] lg:table-cell">
												<p className="truncate text-muted-foreground text-xs">
													{log.message as string}
												</p>
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{new Date(log.createdAt as string).toLocaleTimeString(
													[],
													{ hour: "2-digit", minute: "2-digit" },
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// ── Provider Settings Tab ──────────────────────────────────────────────

function ProviderSettingsTab() {
	const queryClient = useQueryClient();

	const { data: settings } = useQuery(
		orpc.notifications.getSettings.queryOptions({ input: {} }),
	);

	const [accountSid, setAccountSid] = useState("");
	const [authToken, setAuthToken] = useState("");
	const [fromNumber, setFromNumber] = useState("");
	const [whatsappNumber, setWhatsappNumber] = useState("");
	const [isActive, setIsActive] = useState(false);
	const [dailyLimit, setDailyLimit] = useState("500");
	const [initialized, setInitialized] = useState(false);

	// Populate form when settings load
	useEffect(() => {
		if (settings && !initialized) {
			// accountSid and authToken are not returned for security - leave as empty
			setFromNumber(settings.fromNumber || "");
			setWhatsappNumber(settings.whatsappNumber || "");
			setIsActive(settings.isActive);
			setDailyLimit(String(settings.dailyLimit));
			setInitialized(true);
		}
	}, [settings, initialized]);

	const updateMutation = useMutation(
		orpc.notifications.updateSettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["notifications"] });
				toast.success("Notification settings saved");
			},
		}),
	);

	const [testPhone, setTestPhone] = useState("");
	const testMutation = useMutation(
		orpc.notifications.sendTest.mutationOptions({
			onSuccess: (data: { message?: string }) => {
				toast.success(data.message || "Test notification sent");
			},
			onError: (err: unknown) => {
				const msg =
					err instanceof Error
						? err.message
						: "Failed to send test notification";
				toast.error(msg);
			},
		}),
	);

	function handleSave(e: React.FormEvent) {
		e.preventDefault();
		updateMutation.mutate({
			provider: "twilio",
			accountSid: accountSid || undefined,
			authToken: authToken || undefined,
			fromNumber: fromNumber || undefined,
			whatsappNumber: whatsappNumber || undefined,
			isActive,
			dailyLimit: Number(dailyLimit) || 500,
		});
	}

	return (
		<div className="flex max-w-2xl flex-col gap-4">
			{/* Setup Guide */}
			<Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
				<CardContent className="flex items-start gap-3 p-4">
					<AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
					<div className="text-sm">
						<p className="font-medium text-amber-700 dark:text-amber-400">
							Twilio account required
						</p>
						<p className="mt-1 text-amber-600/80 dark:text-amber-400/70">
							SMS and WhatsApp notifications require a Twilio account. Sign up
							at twilio.com, then enter your Account SID, Auth Token, and phone
							number below. You can test with Twilio&apos;s free trial before
							going live.
						</p>
					</div>
				</CardContent>
			</Card>

			<form onSubmit={handleSave}>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Settings className="size-4" /> Twilio Configuration
						</CardTitle>
						<CardDescription>
							Enter your Twilio API credentials to enable SMS and WhatsApp
							notifications. These are stored securely and used only for sending
							notifications from your POS system.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						{/* Master toggle */}
						<div className="flex items-center justify-between rounded-md border p-4">
							<div>
								<p className="font-medium">Enable Notifications</p>
								<p className="text-muted-foreground text-xs">
									Master switch — when off, no SMS or WhatsApp messages will be
									sent regardless of template settings
								</p>
							</div>
							<Switch checked={isActive} onCheckedChange={setIsActive} />
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label htmlFor="sid">Account SID</Label>
								<Input
									id="sid"
									value={accountSid}
									onChange={(e) => setAccountSid(e.target.value)}
									placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
									className="font-mono text-sm"
								/>
								<p className="text-muted-foreground text-xs">
									Found on your Twilio Console dashboard
								</p>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="token">Auth Token</Label>
								<Input
									id="token"
									type="password"
									value={authToken}
									onChange={(e) => setAuthToken(e.target.value)}
									placeholder="Your auth token"
								/>
								<p className="text-muted-foreground text-xs">
									Keep this secret — never share it publicly
								</p>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label htmlFor="from" className="flex items-center gap-1.5">
									<Smartphone className="size-3.5 text-blue-500" /> SMS Phone
									Number
								</Label>
								<Input
									id="from"
									value={fromNumber}
									onChange={(e) => setFromNumber(e.target.value)}
									placeholder="+15551234567"
									className="font-mono"
								/>
								<p className="text-muted-foreground text-xs">
									Your Twilio phone number for sending SMS
								</p>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="whatsapp" className="flex items-center gap-1.5">
									<MessageCircle className="size-3.5 text-green-500" /> WhatsApp
									Number
								</Label>
								<Input
									id="whatsapp"
									value={whatsappNumber}
									onChange={(e) => setWhatsappNumber(e.target.value)}
									placeholder="+15551234567"
									className="font-mono"
								/>
								<p className="text-muted-foreground text-xs">
									Optional — needed only for WhatsApp notifications
								</p>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="limit">Daily Message Limit</Label>
							<Input
								id="limit"
								type="number"
								value={dailyLimit}
								onChange={(e) => setDailyLimit(e.target.value)}
								className="w-[200px]"
							/>
							<p className="text-muted-foreground text-xs">
								Safety limit to prevent unexpected charges — notifications stop
								after this many messages per day
							</p>
						</div>

						<Button
							type="submit"
							disabled={updateMutation.isPending}
							className="gap-1.5 self-start"
						>
							<CheckCircle2 className="size-3.5" />
							{updateMutation.isPending ? "Saving..." : "Save Settings"}
						</Button>
					</CardContent>
				</Card>
			</form>

			{/* Test Section */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<TestTube className="size-4" /> Send Test Notification
					</CardTitle>
					<CardDescription>
						Verify your setup by sending a test message. Make sure your Twilio
						credentials are saved and notifications are enabled above.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex items-end gap-3">
					<div className="flex flex-1 flex-col gap-2">
						<Label htmlFor="test-phone">Phone Number</Label>
						<Input
							id="test-phone"
							value={testPhone}
							onChange={(e) => setTestPhone(e.target.value)}
							placeholder="+592XXXXXXX"
							className="font-mono"
						/>
					</div>
					<Button
						onClick={() =>
							testMutation.mutate({ phoneNumber: testPhone, channel: "sms" })
						}
						disabled={!testPhone || testMutation.isPending}
						variant="outline"
						className="gap-1.5"
					>
						<Send className="size-3.5" />
						{testMutation.isPending ? "Sending..." : "Send Test SMS"}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
