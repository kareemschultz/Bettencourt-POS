import {
	AlertCircle,
	CloudOff,
	RefreshCw,
	RotateCcw,
	Trash2,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	clearPendingOperations,
	getOnlineStatus,
	getPendingCount,
	listPendingOperations,
	onStatusChange,
	type PendingOperation,
	removePendingOperationById,
	retryPendingOperation,
	syncPendingOperations,
} from "@/lib/offline";

export function SyncIndicator() {
	const [online, setOnline] = useState(true);
	const [pending, setPending] = useState(0);
	const [syncing, setSyncing] = useState(false);
	const [lastSynced, setLastSynced] = useState<Date | null>(null);
	const [syncError, setSyncError] = useState(false);
	const [queueOpen, setQueueOpen] = useState(false);
	const [queue, setQueue] = useState<PendingOperation[]>([]);
	const [loadingQueue, setLoadingQueue] = useState(false);
	const [activeOpId, setActiveOpId] = useState<string | null>(null);

	const refreshPending = useCallback(async () => {
		try {
			const count = await getPendingCount();
			setPending(count);
		} catch {
			// IndexedDB not available
		}
	}, []);

	const loadQueue = useCallback(async () => {
		setLoadingQueue(true);
		try {
			const ops = await listPendingOperations();
			setQueue(ops);
			setPending(ops.length);
		} catch {
			toast.error("Failed to load sync queue");
		} finally {
			setLoadingQueue(false);
		}
	}, []);

	useEffect(() => {
		setOnline(getOnlineStatus());
		const cleanup = onStatusChange(setOnline);
		refreshPending();
		const interval = setInterval(refreshPending, 10000);

		return () => {
			cleanup();
			clearInterval(interval);
		};
	}, [refreshPending]);

	const handleSync = useCallback(async () => {
		if (syncing) return;
		setSyncing(true);
		setSyncError(false);
		try {
			const result = await syncPendingOperations();
			setPending(result.remaining);
			if (queueOpen) {
				await loadQueue();
			}
			if (result.remaining === 0) {
				setLastSynced(new Date());
				toast.success("All queued changes synced");
			}
			if (result.failed > 0) {
				setSyncError(true);
				toast.warning(`${result.failed} queued operation(s) need attention`);
			}
		} catch {
			setSyncError(true);
			toast.error("Sync failed");
		}
		setSyncing(false);
	}, [loadQueue, queueOpen, syncing]);

	// Auto-sync when coming back online
	useEffect(() => {
		if (online && pending > 0) {
			void handleSync();
		}
	}, [online, handleSync, pending]);

	useEffect(() => {
		if (queueOpen) {
			void loadQueue();
		}
	}, [queueOpen, loadQueue]);

	async function handleRetry(opId: string) {
		setActiveOpId(opId);
		try {
			const result = await retryPendingOperation(opId);
			if (result.success) {
				toast.success("Operation synced");
			} else {
				toast.error(result.error ?? "Retry failed");
			}
			await loadQueue();
		} finally {
			setActiveOpId(null);
		}
	}

	async function handleRemove(opId: string) {
		setActiveOpId(opId);
		try {
			await removePendingOperationById(opId);
			toast.success("Queued operation removed");
			await loadQueue();
		} finally {
			setActiveOpId(null);
		}
	}

	async function handleClearAll() {
		setActiveOpId("all");
		try {
			await clearPendingOperations();
			toast.success("Sync queue cleared");
			await loadQueue();
		} finally {
			setActiveOpId(null);
		}
	}

	function ageLabel(createdAt: number): string {
		const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h`;
	}

	const timeAgo = lastSynced
		? `Last synced ${lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
		: "All changes saved to server";

	if (online && pending === 0) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="outline"
							className="cursor-default gap-1.5 border-emerald-200 bg-emerald-500/10 text-emerald-600"
						>
							<Wifi className="h-3 w-3" />
							<span className="hidden sm:inline">Online</span>
						</Badge>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p className="text-xs">{timeAgo}</p>
						<p className="text-muted-foreground text-xs">
							Connected to server — all data is up to date
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	if (!online) {
		return (
			<>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-1.5">
								<Badge
									variant="outline"
									className="cursor-default gap-1.5 border-amber-200 bg-amber-500/10 text-amber-600"
								>
									<WifiOff className="h-3 w-3" />
									<span className="hidden sm:inline">Offline</span>
									{pending > 0 && (
										<span className="font-mono">({pending})</span>
									)}
								</Badge>
								{pending > 0 && (
									<Button
										variant="outline"
										size="sm"
										className="h-7 px-2 text-xs"
										onClick={() => setQueueOpen(true)}
									>
										Queue
									</Button>
								)}
							</div>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p className="font-medium text-xs">No internet connection</p>
							<p className="text-muted-foreground text-xs">
								{pending > 0
									? `${pending} operation${pending > 1 ? "s" : ""} queued — will sync automatically when reconnected`
									: "You can continue working — orders will be queued and synced when back online"}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<Dialog open={queueOpen} onOpenChange={setQueueOpen}>
					<DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden">
						<DialogHeader>
							<DialogTitle>Offline Sync Queue</DialogTitle>
							<DialogDescription>
								Review queued operations, retry specific items, or clear stale
								entries.
							</DialogDescription>
						</DialogHeader>
						<QueueTable
							queue={queue}
							loadingQueue={loadingQueue}
							activeOpId={activeOpId}
							ageLabel={ageLabel}
							onRetry={handleRetry}
							onRemove={handleRemove}
						/>
						<DialogFooter className="gap-2 sm:justify-between">
							<Button
								variant="outline"
								onClick={handleClearAll}
								disabled={queue.length === 0 || activeOpId !== null}
							>
								<Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear Queue
							</Button>
							<Button
								onClick={handleSync}
								disabled={syncing || queue.length === 0 || !online}
							>
								{syncing ? (
									<RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
								) : (
									<RotateCcw className="mr-1.5 h-3.5 w-3.5" />
								)}
								Sync All
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</>
		);
	}

	// Online but has pending operations
	return (
		<>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<Button
								variant="outline"
								size="sm"
								className="h-7 gap-1.5"
								onClick={handleSync}
								disabled={syncing}
							>
								{syncing ? (
									<RefreshCw className="h-3 w-3 animate-spin" />
								) : syncError ? (
									<AlertCircle className="h-3 w-3 text-destructive" />
								) : (
									<CloudOff className="h-3 w-3" />
								)}
								{syncing ? "Syncing..." : `${pending} pending`}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => setQueueOpen(true)}
							>
								Queue
							</Button>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p className="font-medium text-xs">
							{syncing
								? "Syncing queued operations to the server..."
								: syncError
									? "Some operations failed to sync — click to retry"
									: `${pending} operation${pending > 1 ? "s" : ""} waiting to sync`}
						</p>
						<p className="text-muted-foreground text-xs">
							Sync now or open Queue to retry/remove individual items
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<Dialog open={queueOpen} onOpenChange={setQueueOpen}>
				<DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden">
					<DialogHeader>
						<DialogTitle>Offline Sync Queue</DialogTitle>
						<DialogDescription>
							Review queued operations, retry specific items, or clear stale
							entries.
						</DialogDescription>
					</DialogHeader>
					<QueueTable
						queue={queue}
						loadingQueue={loadingQueue}
						activeOpId={activeOpId}
						ageLabel={ageLabel}
						onRetry={handleRetry}
						onRemove={handleRemove}
					/>
					<DialogFooter className="gap-2 sm:justify-between">
						<Button
							variant="outline"
							onClick={handleClearAll}
							disabled={queue.length === 0 || activeOpId !== null}
						>
							<Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear Queue
						</Button>
						<Button
							onClick={handleSync}
							disabled={syncing || queue.length === 0}
						>
							{syncing ? (
								<RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
							) : (
								<RotateCcw className="mr-1.5 h-3.5 w-3.5" />
							)}
							Sync All
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function QueueTable({
	queue,
	loadingQueue,
	activeOpId,
	ageLabel,
	onRetry,
	onRemove,
}: {
	queue: PendingOperation[];
	loadingQueue: boolean;
	activeOpId: string | null;
	ageLabel: (createdAt: number) => string;
	onRetry: (id: string) => Promise<void>;
	onRemove: (id: string) => Promise<void>;
}) {
	if (loadingQueue) {
		return (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Loading queued operations...
			</div>
		);
	}
	if (queue.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Queue is empty.
			</div>
		);
	}
	return (
		<div className="max-h-[45vh] overflow-auto rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Method</TableHead>
						<TableHead>Endpoint</TableHead>
						<TableHead>Age</TableHead>
						<TableHead>Retries</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{queue.map((op) => (
						<TableRow key={op.id}>
							<TableCell className="font-mono text-xs uppercase">
								{op.method}
							</TableCell>
							<TableCell className="max-w-[260px] truncate font-mono text-xs">
								{op.url}
							</TableCell>
							<TableCell className="text-xs">
								{ageLabel(op.createdAt)}
							</TableCell>
							<TableCell className="text-xs">
								{op.retries}/{op.maxRetries}
							</TableCell>
							<TableCell className="text-right">
								<div className="flex justify-end gap-1.5">
									<Button
										size="sm"
										variant="outline"
										className="h-7 px-2 text-xs"
										disabled={activeOpId !== null}
										onClick={() => onRetry(op.id)}
									>
										<RotateCcw className="mr-1 h-3 w-3" />
										Retry
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="h-7 px-2 text-destructive text-xs hover:text-destructive"
										disabled={activeOpId !== null}
										onClick={() => onRemove(op.id)}
									>
										<Trash2 className="mr-1 h-3 w-3" />
										Remove
									</Button>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
