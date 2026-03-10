import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Database,
	Download,
	RefreshCw,
	RotateCcw,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type BackupFile = {
	filename: string;
	createdAt: string;
	sizeBytes: number;
	rowCounts: Record<string, number>;
	isPreRestore: boolean;
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString("en-GY", {
		timeZone: "America/Guyana",
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function rowSummary(counts: Record<string, number>): string {
	const top = ["order", "product", "customer", "expense", "invoice"]
		.filter((k) => (counts[k] ?? 0) > 0)
		.map((k) => `${counts[k]} ${k}s`)
		.slice(0, 3);
	return top.join(", ") || "empty";
}

async function apiPost(path: string): Promise<{
	success?: boolean;
	filename?: string;
	error?: string;
}> {
	const res = await fetch(path, { method: "POST", credentials: "include" });
	return res.json() as Promise<{ success?: boolean; filename?: string; error?: string }>;
}

export default function BackupPage() {
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
	const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

	const { data, isLoading } = useQuery<{ backups: BackupFile[] }>({
		queryKey: ["backups"],
		queryFn: async () => {
			const res = await fetch("/api/backups", { credentials: "include" });
			return res.json() as Promise<{ backups: BackupFile[] }>;
		},
		refetchInterval: 30_000,
	});

	const backups = data?.backups ?? [];
	const latest = backups.find((b) => !b.isPreRestore);
	const hoursSinceLast = latest
		? (Date.now() - new Date(latest.createdAt).getTime()) / 3_600_000
		: null;

	const healthDot =
		hoursSinceLast === null
			? "bg-red-500"
			: hoursSinceLast < 25
				? "bg-green-500"
				: hoursSinceLast < 49
					? "bg-yellow-500"
					: "bg-red-500";

	const triggerMutation = useMutation({
		mutationFn: () => apiPost("/api/backups/trigger"),
		onSuccess: (res) => {
			if (res.error) {
				toast.error("Backup failed: " + res.error);
			} else {
				toast.success("Backup created: " + res.filename);
				queryClient.invalidateQueries({ queryKey: ["backups"] });
			}
		},
	});

	const restoreFromListMutation = useMutation({
		mutationFn: async (filename: string) => {
			const formData = new FormData();
			const res = await fetch(`/api/backups/download/${filename}`, {
				credentials: "include",
			});
			const blob = await res.blob();
			formData.append("file", blob, filename);
			const r = await fetch("/api/backups/restore", {
				method: "POST",
				body: formData,
				credentials: "include",
			});
			return r.json() as Promise<{ success?: boolean; error?: string }>;
		},
		onSuccess: (res) => {
			if (res.error) {
				toast.error("Restore failed: " + res.error);
			} else {
				toast.success("Restore complete — data restored. Please refresh.");
				queryClient.invalidateQueries({ queryKey: ["backups"] });
			}
		},
	});

	const restoreFromFileMutation = useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append("file", file, file.name);
			const r = await fetch("/api/backups/restore", {
				method: "POST",
				body: formData,
				credentials: "include",
			});
			return r.json() as Promise<{ success?: boolean; error?: string }>;
		},
		onSuccess: (res) => {
			if (res.error) {
				toast.error("Restore failed: " + res.error);
			} else {
				toast.success("Restore complete — data restored from file. Please refresh.");
				queryClient.invalidateQueries({ queryKey: ["backups"] });
				setUploadFile(null);
				if (fileInputRef.current) fileInputRef.current.value = "";
			}
		},
	});

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Backup & Restore</h1>
				<p className="text-muted-foreground text-sm">
					Manage database backups. Backups run automatically every night at midnight.
				</p>
			</div>

			{/* Status Bar */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Backup Status</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<span className={`inline-block h-3 w-3 rounded-full ${healthDot}`} />
						<div>
							<p className="font-medium text-sm">
								{latest
									? `Last backup: ${formatDate(latest.createdAt)}`
									: "No backups yet"}
							</p>
							<p className="text-muted-foreground text-xs">
								Next scheduled: midnight tonight (Guyana time)
							</p>
						</div>
					</div>
					<Button
						onClick={() => triggerMutation.mutate()}
						disabled={triggerMutation.isPending}
					>
						{triggerMutation.isPending ? (
							<RefreshCw className="mr-2 size-4 animate-spin" />
						) : (
							<Database className="mr-2 size-4" />
						)}
						{triggerMutation.isPending ? "Creating backup..." : "Backup Now"}
					</Button>
				</CardContent>
			</Card>

			{/* Backup History */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Backup History</CardTitle>
					<CardDescription>
						Up to 7 regular backups are kept. Pre-restore snapshots are kept until manually
						removed.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="space-y-2">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-10 w-full" />
							))}
						</div>
					) : backups.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No backups yet. Click "Backup Now" to create your first backup.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>File</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Size</TableHead>
									<TableHead>Contents</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{backups.map((b) => (
									<TableRow key={b.filename}>
										<TableCell className="font-mono text-xs">
											{b.isPreRestore ? (
												<Badge variant="outline" className="mr-2">
													pre-restore
												</Badge>
											) : null}
											{b.filename.replace(
												/^(bettencourt-pos-backup-|pre-restore-)/,
												"",
											)}
										</TableCell>
										<TableCell className="text-sm">{formatDate(b.createdAt)}</TableCell>
										<TableCell className="text-sm">{formatBytes(b.sizeBytes)}</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{rowSummary(b.rowCounts)}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button variant="ghost" size="sm" asChild>
													<a href={`/api/backups/download/${b.filename}`} download>
														<Download className="mr-1 size-3.5" />
														Download
													</a>
												</Button>
												<AlertDialog
													open={
														restoreDialogOpen &&
														restoreTarget?.filename === b.filename
													}
													onOpenChange={(open) => {
														setRestoreDialogOpen(open);
														if (!open) setRestoreTarget(null);
													}}
												>
													<AlertDialogTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => {
																setRestoreTarget(b);
																setRestoreDialogOpen(true);
															}}
														>
															<RotateCcw className="mr-1 size-3.5" />
															Restore
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>Restore this backup?</AlertDialogTitle>
															<AlertDialogDescription asChild>
																<div className="space-y-2">
																	<p>
																		This will{" "}
																		<strong>replace all current data</strong> with the
																		backup from{" "}
																		{b ? formatDate(b.createdAt) : ""}.
																	</p>
																	<p className="text-muted-foreground text-xs">
																		Contents:{" "}
																		{b ? rowSummary(b.rowCounts) : ""}
																	</p>
																	<p className="font-medium text-amber-600 text-sm">
																		A pre-restore snapshot of your current data will
																		be saved automatically before the restore begins.
																	</p>
																</div>
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																className="bg-destructive hover:bg-destructive/90"
																onClick={() => {
																	if (restoreTarget)
																		restoreFromListMutation.mutate(
																			restoreTarget.filename,
																		);
																	setRestoreDialogOpen(false);
																	setRestoreTarget(null);
																}}
															>
																Yes, Restore
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Restore from File */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Restore from File</CardTitle>
					<CardDescription>
						Upload a previously downloaded <code>.json.gz</code> backup file.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
						<div className="flex gap-2">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
							<p className="text-amber-800 text-sm dark:text-amber-200">
								Restoring will overwrite all current data. A pre-restore snapshot is created
								automatically, but ensure you have a recent backup before proceeding.
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						<Input
							ref={fileInputRef}
							type="file"
							accept=".json.gz"
							className="max-w-sm"
							onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
						/>
						<AlertDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
							<AlertDialogTrigger asChild>
								<Button
									disabled={!uploadFile || restoreFromFileMutation.isPending}
									onClick={() => setUploadDialogOpen(true)}
								>
									{restoreFromFileMutation.isPending ? (
										<RefreshCw className="mr-2 size-4 animate-spin" />
									) : (
										<Upload className="mr-2 size-4" />
									)}
									Restore from File
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Restore from uploaded file?</AlertDialogTitle>
									<AlertDialogDescription>
										This will <strong>replace all current data</strong> with the contents
										of <code>{uploadFile?.name}</code>. A pre-restore snapshot will be
										saved first.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										className="bg-destructive hover:bg-destructive/90"
										onClick={() => {
											if (uploadFile) restoreFromFileMutation.mutate(uploadFile);
											setUploadDialogOpen(false);
										}}
									>
										Yes, Restore
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
