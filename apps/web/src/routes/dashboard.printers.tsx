import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	Copy,
	Download,
	Loader2,
	Monitor,
	Plus,
	Printer,
	Smartphone,
	TestTube2,
	Trash2,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
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
import { printClient } from "@/lib/print/print-client";
import { orpc } from "@/utils/orpc";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PrintersPage() {
	const qc = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(
		null,
	);
	const [isPwa, setIsPwa] = useState(false);

	useEffect(() => {
		const standalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			window.matchMedia("(display-mode: fullscreen)").matches;
		setIsPwa(standalone);

		const onPrompt = (e: Event) => {
			e.preventDefault();
			setPwaPrompt(e as BeforeInstallPromptEvent);
		};
		const onInstalled = () => {
			setIsPwa(true);
			setPwaPrompt(null);
			toast.success("App installed — reopen from the desktop shortcut");
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	const installPwa = async () => {
		if (!pwaPrompt) return;
		await pwaPrompt.prompt();
		const { outcome } = await pwaPrompt.userChoice;
		if (outcome === "accepted") {
			setIsPwa(true);
			setPwaPrompt(null);
		}
	};

	const { data: printers = [], isLoading } = useQuery(
		orpc.printers.list.queryOptions({ input: {} }),
	);

	const { data: categories = [] } = useQuery(
		orpc.categories.list.queryOptions({ input: {} }),
	);

	const createMutation = useMutation(
		orpc.printers.create.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey,
				});
				setCreateOpen(false);
				toast.success("Printer created");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.printers.update.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey,
				});
				toast.success("Printer updated");
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.printers.remove.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey,
				});
				toast.success("Printer removed");
			},
		}),
	);

	const testMutation = useMutation(
		orpc.printers.testPrint.mutationOptions({
			onSuccess: async (data) => {
				try {
					await printClient.print({
						connectionType: data.connectionType as "usb" | "network" | "mock",
						address: data.address,
						text: data.testText,
					});
					toast.success(`Test print sent to ${data.name}`);
				} catch (err) {
					toast.error(
						`Print failed: ${err instanceof Error ? err.message : "Unknown error"}`,
					);
				}
			},
		}),
	);

	const setRoutesMutation = useMutation(
		orpc.printers.setRoutes.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey,
				});
				toast.success("Routes updated");
			},
		}),
	);

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Printers</h1>
					<p className="text-muted-foreground text-sm">
						Configure receipt and kitchen printers
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-1 size-4" /> Add Printer
						</Button>
					</DialogTrigger>
					<DialogContent>
						<CreatePrinterForm
							onSubmit={(data) => createMutation.mutate(data)}
							isSubmitting={createMutation.isPending}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : printers.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-3 py-12">
						<Printer className="size-12 text-muted-foreground" />
						<p className="text-muted-foreground">
							No printers configured. Add one to get started.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{(
						printers as Array<{
							id: string;
							name: string;
							connectionType: string;
							address: string | null;
							paperWidth: string;
							isActive: boolean;
							autoCut: boolean;
							routes: Array<{
								reportingCategoryId: string;
								categoryName: string | null;
							}>;
						}>
					).map((printer) => (
						<Card
							key={printer.id}
							className={!printer.isActive ? "opacity-50" : ""}
						>
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-2">
										<Printer className="size-5 text-muted-foreground" />
										<CardTitle className="text-base">{printer.name}</CardTitle>
									</div>
									<div className="flex items-center gap-1.5">
										<Badge variant={printer.isActive ? "default" : "secondary"}>
											{printer.isActive ? "Active" : "Disabled"}
										</Badge>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
									<span className="flex items-center gap-1">
										{printer.connectionType === "network" ? (
											<Wifi className="size-3" />
										) : (
											<WifiOff className="size-3" />
										)}
										{printer.connectionType}
									</span>
									{printer.address && <span>{printer.address}</span>}
									<span>{printer.paperWidth}</span>
									{printer.autoCut && <span>Auto-cut</span>}
								</div>

								{/* Category routes */}
								{printer.routes.length > 0 && (
									<div>
										<p className="mb-1 text-[10px] text-muted-foreground uppercase">
											Routes
										</p>
										<div className="flex flex-wrap gap-1">
											{printer.routes.map((r) => (
												<Badge
													key={r.reportingCategoryId}
													variant="outline"
													className="text-[10px]"
												>
													{r.categoryName}
												</Badge>
											))}
										</div>
									</div>
								)}

								{/* Category routing select */}
								<div>
									<p className="mb-1 text-[10px] text-muted-foreground uppercase">
										Assign Categories
									</p>
									<div className="flex flex-wrap gap-1">
										{(categories as Array<{ id: string; name: string }>).map(
											(cat) => {
												const isAssigned = printer.routes.some(
													(r) => r.reportingCategoryId === cat.id,
												);
												return (
													<button
														key={cat.id}
														type="button"
														onClick={() => {
															const newIds = isAssigned
																? printer.routes
																		.filter(
																			(r) => r.reportingCategoryId !== cat.id,
																		)
																		.map((r) => r.reportingCategoryId)
																: [
																		...printer.routes.map(
																			(r) => r.reportingCategoryId,
																		),
																		cat.id,
																	];
															setRoutesMutation.mutate({
																printerId: printer.id,
																reportingCategoryIds: newIds,
															});
														}}
														className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
															isAssigned
																? "border-primary bg-primary/10 text-primary"
																: "border-border text-muted-foreground hover:border-primary/50"
														}`}
													>
														{isAssigned && (
															<Check className="mr-0.5 inline size-2.5" />
														)}
														{cat.name}
													</button>
												);
											},
										)}
									</div>
								</div>

								{/* Actions */}
								<div className="flex items-center justify-between border-t pt-3">
									<div className="flex items-center gap-2">
										<Switch
											checked={printer.isActive}
											onCheckedChange={(checked) =>
												updateMutation.mutate({
													id: printer.id,
													isActive: checked,
												})
											}
										/>
										<span className="text-xs">
											{printer.isActive ? "Enabled" : "Disabled"}
										</span>
									</div>
									<div className="flex gap-1">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												testMutation.mutate({ printerId: printer.id })
											}
											disabled={testMutation.isPending}
										>
											<TestTube2 className="mr-1 size-3" /> Test
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												if (confirm(`Delete printer "${printer.name}"?`)) {
													removeMutation.mutate({ id: printer.id });
												}
											}}
										>
											<Trash2 className="size-3 text-destructive" />
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Terminal Setup */}
			<Card>
				<CardContent className="space-y-4 py-5">
					{/* Header row */}
					<div className="flex items-start gap-3">
						<Monitor className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
						<div className="flex-1">
							<p className="font-medium text-sm">Terminal Setup</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								Configure this Windows terminal for silent receipt printing and
								fullscreen kiosk mode. Works with both the installed PWA and
								Chrome browser shortcuts.
							</p>
						</div>
					</div>

					{/* Option A — Install as app (PWA) */}
					<div className="rounded-md border bg-muted/30 p-3">
						<p className="mb-1 font-medium text-xs">
							Option A — Install as App (recommended)
						</p>
						<p className="mb-2 text-muted-foreground text-xs">
							Installs the POS as a desktop app. After installing, run the Setup
							Script below once to enable fullscreen kiosk mode and silent
							printing.
						</p>
						{isPwa ? (
							<p className="flex items-center gap-1.5 text-[11px] text-green-600 dark:text-green-400">
								<Check className="size-3" /> Installed as an app on this device
								— run the setup script below if not yet in kiosk mode
							</p>
						) : pwaPrompt ? (
							<Button size="sm" onClick={installPwa} className="h-7 text-xs">
								<Smartphone className="mr-1.5 size-3.5" />
								Install App Now
							</Button>
						) : (
							<p className="text-[11px] text-muted-foreground">
								To install: click the{" "}
								<span className="font-medium">⊕ install icon</span> in Chrome's
								address bar. If you just removed the app, stay on this page for
								30 seconds — Chrome will re-enable the install option.
							</p>
						)}
					</div>

					{/* Option B — Setup script */}
					<div className="rounded-md border bg-muted/30 p-3">
						<p className="mb-1 font-medium text-xs">
							Setup Script — Kiosk Mode + Silent Printing
						</p>
						<p className="mb-2 text-muted-foreground text-xs">
							Run once on the POS computer (after installing the app above).
							Patches the Desktop shortcut with kiosk flags and sets Windows
							taskbar to auto-hide. Creates a shortcut automatically if none
							exists.
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<a
								href="/downloads/BettencourtPOS-SilentPrint-Setup.bat"
								download="BettencourtPOS-SilentPrint-Setup.bat"
							>
								<Button variant="outline" size="sm" className="h-7 text-xs">
									<Download className="mr-1.5 size-3" />
									Download Setup Script
								</Button>
							</a>
						</div>
						<p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
							Windows will show &quot;Publisher could not be verified&quot; —
							this is expected. Click <span className="font-semibold">Run</span>{" "}
							to proceed. The script will request administrator access
							automatically.
						</p>
					</div>

					{/* QZ Tray silent printing */}
					<div className="rounded-md border bg-muted/30 p-3">
						<p className="mb-1 font-medium text-xs">
							QZ Tray — Zero-Flash Silent Printing
						</p>
						<p className="mb-3 text-muted-foreground text-xs">
							Eliminates the Windows print dialog entirely. Install once on this
							PC. QZ Tray runs silently in the system tray and starts
							automatically on login. Free and open-source.
						</p>
						<div className="flex flex-wrap gap-2">
							<QzInstallButton />
							<a
								href="https://github.com/qzind/tray/releases/download/v2.2.6/qz-tray-2.2.6-x86_64.exe"
								target="_blank"
								rel="noopener noreferrer"
							>
								<Button variant="outline" size="sm" className="h-7 text-xs">
									<Download className="mr-1.5 size-3" />
									Download EXE Installer
								</Button>
							</a>
						</div>
						<p className="mt-2 text-[11px] text-muted-foreground">
							PowerShell option opens an admin prompt and installs
							automatically. EXE option downloads the installer for manual
							setup. After install, a one-time &quot;Allow&quot; prompt will
							appear — tick &quot;Remember this decision&quot; and click Allow.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* WebUSB info */}
			{printClient.isWebUsbAvailable && (
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Printer className="size-5 text-muted-foreground" />
						<div>
							<p className="font-medium text-sm">USB Printing Available</p>
							<p className="text-muted-foreground text-xs">
								Your browser supports WebUSB. USB printers can be connected
								directly without any drivers.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="ml-auto"
							onClick={async () => {
								try {
									await printClient.pairUsbPrinter();
									toast.success("USB printer paired");
								} catch {
									toast.error("Failed to pair USB printer");
								}
							}}
						>
							Pair USB Printer
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// ── QZ Tray PowerShell install button ──────────────────────────────────

const QZ_POWERSHELL_CMD = "irm https://qz.io/pwsh | iex";

function QzInstallButton() {
	const [copied, setCopied] = useState(false);

	function copyCommand() {
		navigator.clipboard.writeText(QZ_POWERSHELL_CMD).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	return (
		<div className="flex items-center gap-1 rounded-md border bg-background">
			<code className="px-2 text-[11px] text-muted-foreground">
				{QZ_POWERSHELL_CMD}
			</code>
			<Button
				variant="ghost"
				size="sm"
				className="h-7 gap-1 rounded-l-none border-l px-2 text-xs"
				onClick={copyCommand}
				title="Copy PowerShell command"
			>
				{copied ? (
					<Check className="size-3 text-green-500" />
				) : (
					<Copy className="size-3" />
				)}
				{copied ? "Copied" : "Copy"}
			</Button>
		</div>
	);
}

// ── Create Printer Form ─────────────────────────────────────────────────

function CreatePrinterForm({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: {
		locationId: string;
		name: string;
		connectionType: "usb" | "network" | "mock";
		address?: string | null;
		paperWidth: "58mm" | "80mm";
		autoCut: boolean;
	}) => void;
	isSubmitting: boolean;
}) {
	const [name, setName] = useState("");
	const [connectionType, setConnectionType] = useState<
		"usb" | "network" | "mock"
	>("network");
	const [address, setAddress] = useState("");
	const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
	const [autoCut, setAutoCut] = useState(true);

	// Use a default location ID (first available)
	const { data: locations = [] } = useQuery(
		orpc.locations.listLocations.queryOptions({ input: {} }),
	);
	const locationId = (locations as Array<{ id: string }>)[0]?.id ?? "";

	return (
		<>
			<DialogHeader>
				<DialogTitle>Add Printer</DialogTitle>
			</DialogHeader>
			<div className="space-y-4 py-4">
				<div className="space-y-1.5">
					<Label>Name</Label>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Kitchen Printer"
					/>
				</div>
				<div className="space-y-1.5">
					<Label>Connection Type</Label>
					<Select
						value={connectionType}
						onValueChange={(v) =>
							setConnectionType(v as "usb" | "network" | "mock")
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="network">Network (TCP/IP)</SelectItem>
							<SelectItem value="usb">USB (WebUSB)</SelectItem>
							<SelectItem value="mock">Mock (Console)</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{connectionType === "network" && (
					<div className="space-y-1.5">
						<Label>IP Address</Label>
						<Input
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							placeholder="192.168.1.100:9100"
						/>
					</div>
				)}
				<div className="space-y-1.5">
					<Label>Paper Width</Label>
					<Select
						value={paperWidth}
						onValueChange={(v) => setPaperWidth(v as "58mm" | "80mm")}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="80mm">80mm (Standard)</SelectItem>
							<SelectItem value="58mm">58mm (Narrow)</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-center gap-2">
					<Switch checked={autoCut} onCheckedChange={setAutoCut} />
					<Label>Auto-cut paper</Label>
				</div>
			</div>
			<DialogFooter>
				<Button
					onClick={() =>
						onSubmit({
							locationId,
							name,
							connectionType,
							address: connectionType === "network" ? address : null,
							paperWidth,
							autoCut,
						})
					}
					disabled={!name.trim() || !locationId || isSubmitting}
				>
					{isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
					Create
				</Button>
			</DialogFooter>
		</>
	);
}
