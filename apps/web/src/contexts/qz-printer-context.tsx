import { createContext, useContext, useEffect, useRef, useState } from "react";

export type QzStatus = "unavailable" | "connecting" | "ready" | "error";

interface QzPrinterContextValue {
	status: QzStatus;
	print: (printerName: string, data: string[]) => Promise<boolean>;
}

let qzModule: typeof import("qz-tray") | null = null;

async function getQz() {
	if (!qzModule) qzModule = await import("qz-tray");
	return qzModule;
}

const QzPrinterContext = createContext<QzPrinterContextValue>({
	status: "unavailable",
	print: async () => false,
});

export function QzPrinterProvider({ children }: { children: React.ReactNode }) {
	const [status, setStatus] = useState<QzStatus>("unavailable");
	const connectedRef = useRef(false);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const qz = await getQz();

				qz.security.setCertificatePromise(
					(resolve: (v: string) => void, reject: (v: unknown) => void) => {
						fetch("/api/qz/certificate", { cache: "no-store" })
							.then((r) => (r.ok ? r.text() : Promise.reject(r)))
							.then(resolve)
							.catch(reject);
					},
				);

				qz.security.setSignatureAlgorithm("SHA512");
				qz.security.setSignaturePromise(
					(toSign: string) =>
						(resolve: (v: string) => void, reject: (v: unknown) => void) => {
							fetch(`/api/qz/sign?request=${encodeURIComponent(toSign)}`, {
								cache: "no-store",
							})
								.then((r) => (r.ok ? r.text() : Promise.reject(r)))
								.then(resolve)
								.catch(reject);
						},
				);

				if (!cancelled) setStatus("connecting");
				await qz.websocket.connect({ retries: 3, delay: 1 });

				if (cancelled) {
					qz.websocket.disconnect().catch(() => {});
					return;
				}

				connectedRef.current = true;
				setStatus("ready");
			} catch {
				if (!cancelled) setStatus("unavailable");
			}
		})();

		// Keep connection alive for the lifetime of the POS session.
		// Do NOT disconnect on unmount — the provider lives at the app root.
		return () => {
			cancelled = true;
		};
	}, []);

	async function print(printerName: string, data: string[]): Promise<boolean> {
		if (!connectedRef.current || !printerName) return false;
		try {
			const qz = await getQz();
			const config = qz.configs.create(printerName);
			await qz.print(
				config,
				data.map((d) => ({
					type: "raw",
					format: "command",
					flavor: "plain",
					data: d,
				})),
			);
			return true;
		} catch {
			return false;
		}
	}

	return (
		<QzPrinterContext.Provider value={{ status, print }}>
			{children}
		</QzPrinterContext.Provider>
	);
}

export function useQzPrinter() {
	return useContext(QzPrinterContext);
}
