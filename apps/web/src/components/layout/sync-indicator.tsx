import { AlertCircle, CloudOff, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	getOnlineStatus,
	getPendingCount,
	onStatusChange,
	syncPendingOperations,
} from "@/lib/offline";

export function SyncIndicator() {
	const [online, setOnline] = useState(true);
	const [pending, setPending] = useState(0);
	const [syncing, setSyncing] = useState(false);
	const [lastSynced, setLastSynced] = useState<Date | null>(null);
	const [syncError, setSyncError] = useState(false);

	useEffect(() => {
		setOnline(getOnlineStatus());
		const cleanup = onStatusChange(setOnline);

		const checkPending = async () => {
			try {
				const count = await getPendingCount();
				setPending(count);
			} catch {
				// IndexedDB not available
			}
		};

		checkPending();
		const interval = setInterval(checkPending, 10000);

		return () => {
			cleanup();
			clearInterval(interval);
		};
	}, []);

	// Auto-sync when coming back online
	useEffect(() => {
		if (online && pending > 0) {
			handleSync();
		}
	}, [online, handleSync, pending]);

	async function handleSync() {
		if (syncing) return;
		setSyncing(true);
		setSyncError(false);
		try {
			const result = await syncPendingOperations();
			setPending(result.remaining);
			if (result.remaining === 0) {
				setLastSynced(new Date());
			}
			if (result.failed > 0) {
				setSyncError(true);
			}
		} catch {
			setSyncError(true);
		}
		setSyncing(false);
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
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="outline"
							className="cursor-default gap-1.5 border-amber-200 bg-amber-500/10 text-amber-600"
						>
							<WifiOff className="h-3 w-3" />
							<span className="hidden sm:inline">Offline</span>
							{pending > 0 && <span className="font-mono">({pending})</span>}
						</Badge>
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
		);
	}

	// Online but has pending operations
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
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
						Click to manually sync pending changes
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
