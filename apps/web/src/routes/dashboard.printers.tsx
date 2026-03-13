import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	Loader2,
	Plus,
	Printer,
	TestTube2,
	Trash2,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useState } from "react";
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

export default function PrintersPage() {
	const qc = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);

	const { data: printers = [], isLoading } = useQuery(
		orpc.printers.list.queryOptions({ input: {} }),
	);

	const { data: categories = [] } = useQuery(
		orpc.products.getCategories.queryOptions({ input: {} }),
	);

	const createMutation = useMutation(
		orpc.printers.create.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey });
				setCreateOpen(false);
				toast.success("Printer created");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.printers.update.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey });
				toast.success("Printer updated");
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.printers.remove.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey });
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
					toast.error(`Print failed: ${err instanceof Error ? err.message : "Unknown error"}`);
				}
			},
		}),
	);

	const setRoutesMutation = useMutation(
		orpc.printers.setRoutes.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: orpc.printers.list.queryOptions({ input: {} }).queryKey });
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
					{(printers as Array<{
						id: string;
						name: string;
						connectionType: string;
						address: string | null;
						paperWidth: string;
						isActive: boolean;
						autoCut: boolean;
						routes: Array<{ reportingCategoryId: string; categoryName: string | null }>;
					}>).map((printer) => (
						<Card key={printer.id} className={!printer.isActive ? "opacity-50" : ""}>
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
								<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
										<p className="mb-1 text-[10px] text-muted-foreground uppercase">Routes</p>
										<div className="flex flex-wrap gap-1">
											{printer.routes.map((r) => (
												<Badge key={r.reportingCategoryId} variant="outline" className="text-[10px]">
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
										{(categories as Array<{ id: string; name: string }>).map((cat) => {
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
																	.filter((r) => r.reportingCategoryId !== cat.id)
																	.map((r) => r.reportingCategoryId)
															: [
																	...printer.routes.map((r) => r.reportingCategoryId),
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
													{isAssigned && <Check className="mr-0.5 inline size-2.5" />}
													{cat.name}
												</button>
											);
										})}
									</div>
								</div>

								{/* Actions */}
								<div className="flex items-center justify-between border-t pt-3">
									<div className="flex items-center gap-2">
										<Switch
											checked={printer.isActive}
											onCheckedChange={(checked) =>
												updateMutation.mutate({ id: printer.id, isActive: checked })
											}
										/>
										<span className="text-xs">{printer.isActive ? "Enabled" : "Disabled"}</span>
									</div>
									<div className="flex gap-1">
										<Button
											variant="outline"
											size="sm"
											onClick={() => testMutation.mutate({ printerId: printer.id })}
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
	const [name, setName] = useState("");
	const [connectionType, setConnectionType] = useState<"usb" | "network" | "mock">("network");
	const [address, setAddress] = useState("");
	const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
	const [autoCut, setAutoCut] = useState(true);

	// Use a default location ID (first available)
	const { data: locations = [] } = useQuery(
		orpc.locations.list.queryOptions({ input: {} }),
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
						onValueChange={(v) => setConnectionType(v as "usb" | "network" | "mock")}
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
