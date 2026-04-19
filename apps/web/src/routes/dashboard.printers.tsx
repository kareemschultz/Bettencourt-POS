import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ClipboardCopy,
	Download,
	Loader2,
	Monitor,
	Plus,
	Printer,
	RefreshCw,
	ShieldCheck,
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
import { useQzPrinter } from "@/hooks/use-qz-printer";
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
	const [qzPrinterName, setQzPrinterName] = useState(
		() => localStorage.getItem("pos-printer-name") ?? "",
	);
	const { status: qzStatus } = useQzPrinter();

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
					<p className="flex items-center gap-2 text-muted-foreground text-sm">
						Configure receipt and kitchen printers
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${qzStatus === "ready" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
						>
							<Printer className="size-3" />
							QZ Tray{" "}
							{qzStatus === "ready"
								? "connected"
								: qzStatus === "connecting"
									? "connecting..."
									: "not connected"}
						</span>
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

			{/* QZ Tray Receipt Printer */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<ShieldCheck className="size-4 text-muted-foreground" />
						QZ Tray — Silent Receipt Printing
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<QzTraySetup
						qzStatus={qzStatus}
						printerName={qzPrinterName}
						onSave={setQzPrinterName}
					/>
				</CardContent>
			</Card>

			{/* Kiosk Mode — optional, clearly separated */}
			<Card className="border-dashed">
				<CardContent className="space-y-4 py-5">
					<div className="flex items-start gap-3">
						<Monitor className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
						<div className="flex-1">
							<p className="font-medium text-sm">
								Optional — Fullscreen Kiosk Mode
							</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								This is separate from printing. Skip this if you only need
								silent printing — the steps above are all that's required for
								that. Kiosk mode hides the Windows taskbar and locks the
								terminal into fullscreen POS view.
							</p>
						</div>
					</div>

					<div className="rounded-md border bg-muted/30 p-3">
						<p className="mb-1 font-medium text-xs">
							Step A — Install as desktop app (PWA)
						</p>
						<p className="mb-2 text-muted-foreground text-xs">
							Installs the POS as a standalone app with its own window. Required
							before running the kiosk setup script.
						</p>
						{isPwa ? (
							<p className="flex items-center gap-1.5 text-[11px] text-green-600 dark:text-green-400">
								<Check className="size-3" /> Already installed as an app on this
								device
							</p>
						) : pwaPrompt ? (
							<Button size="sm" onClick={installPwa} className="h-7 text-xs">
								<Smartphone className="mr-1.5 size-3.5" />
								Install App Now
							</Button>
						) : (
							<p className="text-[11px] text-muted-foreground">
								Click the <span className="font-medium">⊕ install icon</span> in
								Chrome's address bar to install.
							</p>
						)}
					</div>

					<div className="rounded-md border bg-muted/30 p-3">
						<p className="mb-1 font-medium text-xs">
							Step B — Run kiosk setup script (after installing the app above)
						</p>
						<p className="mb-2 text-muted-foreground text-xs">
							Patches the desktop shortcut with fullscreen kiosk flags and
							auto-hides the Windows taskbar. Run once per terminal.
						</p>
						<a
							href="/downloads/BettencourtPOS-SilentPrint-Setup.bat"
							download="BettencourtPOS-SilentPrint-Setup.bat"
						>
							<Button variant="outline" size="sm" className="h-7 text-xs">
								<Download className="mr-1.5 size-3" />
								Download Kiosk Setup Script
							</Button>
						</a>
						<p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
							Windows may show &quot;Publisher could not be verified&quot; —
							this is expected. Click <span className="font-semibold">Run</span>{" "}
							and approve the admin prompt.
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
	const [tab, setTab] = useState<"manual" | "qz">("manual");
	const [name, setName] = useState("");
	const [connectionType, setConnectionType] = useState<
		"usb" | "network" | "mock"
	>("network");
	const [address, setAddress] = useState("");
	const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
	const [autoCut, setAutoCut] = useState(true);
	const [detected, setDetected] = useState<string[]>([]);
	const [detecting, setDetecting] = useState(false);
	const [qzSaved, setQzSaved] = useState(false);
	const { status: qzStatus } = useQzPrinter();

	const { data: locations = [] } = useQuery(
		orpc.locations.listLocations.queryOptions({ input: {} }),
	);
	const locationId = (locations as Array<{ id: string }>)[0]?.id ?? "";

	const handleDetect = async () => {
		setDetecting(true);
		try {
			const qz = await import("qz-tray");
			const result = await qz.printers.find();
			const list = (Array.isArray(result) ? result : [result]).filter(Boolean);
			setDetected(list);
			if (list.length === 0) toast.info("No printers found");
		} catch {
			toast.error("Could not detect printers. Is QZ Tray running?");
		} finally {
			setDetecting(false);
		}
	};

	const saveQzPrinter = (printerName: string) => {
		localStorage.setItem("pos-printer-name", printerName);
		setQzSaved(true);
		toast.success(`Receipt printer set to "${printerName}"`);
		setTimeout(() => setQzSaved(false), 2000);
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>Add Printer</DialogTitle>
			</DialogHeader>

			<div className="mt-2 flex gap-1 rounded-lg bg-muted p-1">
				<button
					type="button"
					onClick={() => setTab("manual")}
					className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${tab === "manual" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
				>
					Network / USB
				</button>
				<button
					type="button"
					onClick={() => {
						setTab("qz");
						if (detected.length === 0 && qzStatus === "ready") handleDetect();
					}}
					className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${tab === "qz" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
				>
					Windows (QZ Tray)
				</button>
			</div>

			{tab === "manual" ? (
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
			) : (
				<div className="space-y-3 py-4">
					<p className="text-muted-foreground text-sm">
						Detects Windows printers via QZ Tray and sets it as the receipt
						printer for this terminal.
					</p>
					<Button
						size="sm"
						variant="outline"
						onClick={handleDetect}
						disabled={detecting || qzStatus !== "ready"}
						className="gap-2"
					>
						{detecting ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
						{detecting
							? "Detecting..."
							: qzStatus === "ready"
								? "Detect Printers"
								: "QZ Tray not connected"}
					</Button>
					{detected.length > 0 && (
						<div className="space-y-1">
							<p className="text-muted-foreground text-xs">
								Click a printer to select it as the receipt printer:
							</p>
							{detected.map((p) => (
								<button
									key={p}
									type="button"
									onClick={() => saveQzPrinter(p)}
									className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
								>
									<span>{p}</span>
									{qzSaved &&
										localStorage.getItem("pos-printer-name") === p && (
											<Check className="size-4 text-green-600" />
										)}
								</button>
							))}
						</div>
					)}
					{qzStatus !== "ready" && (
						<p className="text-amber-600 text-xs dark:text-amber-400">
							QZ Tray must be installed and running on this terminal. See the QZ
							Tray setup section below.
						</p>
					)}
				</div>
			)}

			{tab === "manual" && (
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
			)}
		</>
	);
}

function QzTraySetup({
	qzStatus,
	printerName,
	onSave,
}: {
	qzStatus: string;
	printerName: string;
	onSave: (name: string) => void;
}) {
	const [detected, setDetected] = useState<string[]>([]);
	const [detecting, setDetecting] = useState(false);
	const [localName, setLocalName] = useState(printerName);
	const [saved, setSaved] = useState(false);
	const [copied, setCopied] = useState(false);
	const [copiedQz, setCopiedQz] = useState(false);
	const qzInstallCmd = "irm pwsh.sh | iex";
	const psCommand = `$d='C:\\Program Files\\QZ Tray'; Invoke-WebRequest '${window.location.origin}/api/qz/override.crt' -OutFile "$d\\override.crt" -UseBasicParsing; Stop-Process -Name qz-tray -Force -ErrorAction SilentlyContinue; Start-Sleep 1; Start-Process "$d\\qz-tray.exe"`;

	const handleDetect = async () => {
		setDetecting(true);
		try {
			const qz = await import("qz-tray");
			const result = await qz.printers.find();
			const list = (Array.isArray(result) ? result : [result]).filter(Boolean);
			setDetected(list);
			if (list.length === 0) toast.info("No printers found");
		} catch {
			toast.error("Could not detect printers. Is QZ Tray running?");
		} finally {
			setDetecting(false);
		}
	};

	const savePrinter = (name: string) => {
		localStorage.setItem("pos-printer-name", name);
		setLocalName(name);
		onSave(name);
		setSaved(true);
		toast.success("Receipt printer saved");
		setTimeout(() => setSaved(false), 2000);
	};

	const downloadBat = () => {
		const origin = window.location.origin;
		const content = `@echo off\n:: QZ Tray Certificate Installer for Bettencourt POS\n:: Run as Administrator.\nset POS_URL=${origin}/api/qz/override.crt\nset QZ_DIR=C:\\Program Files\\QZ Tray\nset CERT_PATH=%QZ_DIR%\\override.crt\necho Bettencourt POS - QZ Tray Certificate Installer\nnet session >nul 2>&1\nif %errorlevel% neq 0 (echo ERROR: Run as Administrator & pause & exit /b 1)\nif not exist "%QZ_DIR%" (echo ERROR: Install QZ Tray first from https://qz.io/download & pause & exit /b 1)\necho Downloading certificate...\npowershell -Command "Invoke-WebRequest -Uri '%POS_URL%' -OutFile '%CERT_PATH%' -UseBasicParsing"\nif %errorlevel% neq 0 (echo ERROR: Download failed & pause & exit /b 1)\ntaskkill /f /im qz-tray.exe >nul 2>&1\ntimeout /t 2 /nobreak >nul\nstart "" "%QZ_DIR%\\qz-tray.exe"\necho Done! Reload the POS and click Always Allow once.\npause`;
		const blob = new Blob([content], { type: "text/plain" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "install-qz-cert.bat";
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const configured = !!localStorage.getItem("pos-printer-name");

	return (
		<div className="space-y-4">
			{/* Step 1: Install QZ Tray */}
			<div>
				<p className="mb-1 font-medium text-sm">Step 1 — Install QZ Tray</p>
				<p className="mb-2 text-muted-foreground text-xs">
					Must be installed and running on this Windows terminal.
				</p>

				{/* Recommended: PowerShell install */}
				<div className="mb-2 rounded-md border bg-muted/30 p-3">
					<p className="mb-1.5 flex items-center gap-1.5 font-medium text-xs">
						<ShieldCheck className="size-3.5 text-primary" />
						Recommended — PowerShell (installs automatically)
					</p>
					<p className="mb-2 text-[11px] text-muted-foreground">
						Open PowerShell as Administrator and run:
					</p>
					<div className="flex items-center gap-2">
						<code className="flex-1 rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
							{qzInstallCmd}
						</code>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 shrink-0 px-2"
							onClick={() => {
								navigator.clipboard.writeText(qzInstallCmd);
								setCopiedQz(true);
								setTimeout(() => setCopiedQz(false), 2000);
							}}
						>
							{copiedQz ? (
								<Check className="size-3.5 text-green-600" />
							) : (
								<ClipboardCopy className="size-3.5" />
							)}
						</Button>
					</div>
				</div>

				{/* Alternative: manual download */}
				<div className="rounded-md border border-dashed p-3">
					<p className="mb-1 font-medium text-muted-foreground text-xs">
						Alternative — download the installer from qz.io
					</p>
					<Button size="sm" variant="outline" className="h-7 text-xs" asChild>
						<a href="https://qz.io/download" target="_blank" rel="noreferrer">
							<Download className="mr-1.5 size-3" />
							qz.io/download
						</a>
					</Button>
				</div>
			</div>

			{/* Step 2: Install cert */}
			<div className="border-t pt-4">
				<p className="mb-1 font-medium text-sm">
					Step 2 — Trust this POS server (run once per terminal)
				</p>
				<p className="mb-3 text-muted-foreground text-xs">
					Installs the signing certificate so QZ Tray never shows a security
					prompt again. Both options below do the exact same thing.
				</p>

				{/* Recommended: BAT file */}
				<div className="mb-2 rounded-md border bg-muted/30 p-3">
					<p className="mb-1.5 flex items-center gap-1.5 font-medium text-xs">
						<ShieldCheck className="size-3.5 text-primary" />
						Recommended — Download install-qz-cert.bat
					</p>
					<p className="mb-2 text-[11px] text-muted-foreground">
						Download and run as Administrator. Downloads the certificate,
						installs it, and restarts QZ Tray automatically.
					</p>
					<Button
						size="sm"
						onClick={downloadBat}
						className="h-7 gap-1.5 text-xs"
					>
						<Download className="size-3" />
						Download install-qz-cert.bat
					</Button>
					<p className="mt-2 text-[11px] text-muted-foreground">
						After it runs, reload this page and click{" "}
						<span className="font-medium">Always Allow</span> once. Done.
					</p>
				</div>

				{/* Alternative: PowerShell */}
				<div className="rounded-md border border-dashed p-3">
					<p className="mb-1 font-medium text-muted-foreground text-xs">
						Alternative — PowerShell (same as above, just a one-liner)
					</p>
					<p className="mb-2 text-[11px] text-muted-foreground">
						Open PowerShell as Administrator and paste this. Does exactly what
						the .bat does.
					</p>
					<div className="flex items-start gap-2">
						<code className="flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">
							{psCommand}
						</code>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 shrink-0 px-2"
							onClick={() => {
								navigator.clipboard.writeText(psCommand);
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							}}
						>
							{copied ? (
								<Check className="size-3.5 text-green-600" />
							) : (
								<ClipboardCopy className="size-3.5" />
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Step 3: Select printer */}
			<div className="border-t pt-4">
				<p className="mb-1 flex items-center gap-2 font-medium text-sm">
					Step 3 — Select receipt printer
					{configured && (
						<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 text-xs dark:bg-green-900/30 dark:text-green-400">
							<Check className="size-3" />{" "}
							{localName || localStorage.getItem("pos-printer-name")}
						</span>
					)}
				</p>
				<div className="space-y-2">
					<Button
						size="sm"
						variant="outline"
						onClick={handleDetect}
						disabled={detecting || qzStatus !== "ready"}
						className="gap-2"
					>
						{detecting ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
						{detecting
							? "Detecting..."
							: qzStatus === "ready"
								? "Detect Printers"
								: "QZ Tray not connected"}
					</Button>
					{detected.length > 0 && (
						<div className="max-w-sm space-y-1">
							{detected.map((p) => (
								<button
									key={p}
									type="button"
									onClick={() => savePrinter(p)}
									className={`w-full rounded-md border px-3 py-1.5 text-left text-sm transition-colors ${localName === p ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted"}`}
								>
									{p}
								</button>
							))}
						</div>
					)}
					<div className="flex max-w-sm gap-2">
						<Input
							value={localName}
							onChange={(e) => setLocalName(e.target.value)}
							placeholder="e.g. OFFICELAB PR02002"
							className="h-9 text-sm"
						/>
						<Button
							size="sm"
							onClick={() => savePrinter(localName)}
							disabled={saved || !localName.trim()}
							className="shrink-0"
						>
							{saved ? <Check className="size-4" /> : "Save"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
