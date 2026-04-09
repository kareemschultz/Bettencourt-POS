import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Desktop-only update banner. Listens for the "update-available" event
 * emitted by the Rust side (lib.rs) after the tauri-plugin-updater check.
 *
 * The update is already downloaded and installed silently in the background.
 * This banner just tells the cashier to restart the app to apply it.
 * Only renders inside a Tauri webview (__TAURI_INTERNALS__ is defined).
 */
export function TauriUpdatePrompt() {
	const [update, setUpdate] = useState<{
		version: string;
		body?: string;
	} | null>(null);

	useEffect(() => {
		// Only active inside Tauri desktop app
		if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
			return;
		}
		// Dynamically import the Tauri event API so web build doesn't break
		import("@tauri-apps/api/event")
			.then(({ listen }) => {
				return listen<{ version: string; body?: string }>(
					"update-available",
					(event) => {
						setUpdate(event.payload);
					},
				);
			})
			.catch(() => {});
	}, []);

	if (!update) return null;

	return (
		<div className="fixed right-4 bottom-4 z-50 flex max-w-xs flex-col gap-2 rounded-xl border bg-background p-4 shadow-lg">
			<div className="flex items-center gap-2">
				<Download className="size-4 shrink-0 text-primary" />
				<span className="font-medium text-sm">
					Update v{update.version} installed
				</span>
			</div>
			<p className="text-muted-foreground text-xs">
				Restart the app to apply the latest version.
			</p>
			<Button
				size="sm"
				className="w-full"
				onClick={() => {
					// Relaunch via Tauri process plugin
					import("@tauri-apps/plugin-process")
						.then(({ relaunch }) => relaunch())
						.catch(() => window.location.reload());
				}}
			>
				Restart now
			</Button>
			<button
				type="button"
				className="text-center text-muted-foreground text-xs hover:text-foreground"
				onClick={() => setUpdate(null)}
			>
				Restart later
			</button>
		</div>
	);
}
