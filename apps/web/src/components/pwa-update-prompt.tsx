import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shows a non-intrusive banner at the bottom of the screen when a new
 * app version is available. Tapping "Update" calls skipWaiting() on the
 * new service worker and reloads the page so the update takes effect.
 *
 * With registerType:"autoUpdate" the new SW is already downloaded in the
 * background — this just makes the activation visible to the cashier
 * instead of silently waiting until they close all tabs.
 */
export function PWAUpdatePrompt() {
	const [show, setShow] = useState(false);

	const { updateServiceWorker } = useRegisterSW({
		onNeedRefresh() {
			setShow(true);
		},
		onOfflineReady() {
			// App is cached and ready to work offline — no banner needed
		},
	});

	// Auto-dismiss if user ignores for 60 s (they'll see it next refresh)
	useEffect(() => {
		if (!show) return;
		const t = setTimeout(() => setShow(false), 60_000);
		return () => clearTimeout(t);
	}, [show]);

	if (!show) return null;

	return (
		<div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-background px-4 py-3 shadow-lg">
			<RefreshCw className="size-4 shrink-0 text-primary" />
			<span className="text-sm">New version available</span>
			<Button
				size="sm"
				className="h-7 px-3 text-xs"
				onClick={() => updateServiceWorker(true)}
			>
				Update now
			</Button>
			<button
				type="button"
				className="text-muted-foreground text-xs hover:text-foreground"
				onClick={() => setShow(false)}
			>
				Later
			</button>
		</div>
	);
}
