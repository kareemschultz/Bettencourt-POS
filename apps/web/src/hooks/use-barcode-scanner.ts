import { useEffect, useRef } from "react";

interface BarcodeScanResult {
	barcode: string;
	timestamp: number;
}

/**
 * Detects USB/Bluetooth HID barcode scanner input.
 * HID scanners emit keystrokes rapidly (< 50ms between chars) ending with Enter.
 * This hook intercepts those rapid keystrokes and calls the callback with the scanned barcode.
 */
export function useBarcodeScanner(
	onScan: (result: BarcodeScanResult) => void,
	options?: { enabled?: boolean; minLength?: number; maxDelay?: number },
) {
	// Default options
	const enabled = options?.enabled ?? true;
	const minLength = options?.minLength ?? 3; // minimum barcode length
	const maxDelay = options?.maxDelay ?? 50; // max ms between keystrokes for scanner detection

	// Use refs for the buffer and timing
	const bufferRef = useRef("");
	const lastKeystrokeRef = useRef(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const callbackRef = useRef(onScan);
	callbackRef.current = onScan;

	useEffect(() => {
		if (!enabled) return;

		function handleKeyDown(e: KeyboardEvent) {
			const now = Date.now();
			const timeSinceLastKey = now - lastKeystrokeRef.current;

			// If too much time passed, reset buffer
			if (timeSinceLastKey > 300) {
				bufferRef.current = "";
			}

			// On Enter, check if we have a valid barcode
			if (e.key === "Enter" && bufferRef.current.length >= minLength) {
				e.preventDefault();
				e.stopPropagation();
				const barcode = bufferRef.current;
				bufferRef.current = "";
				callbackRef.current({ barcode, timestamp: now });
				return;
			}

			// Only buffer printable single characters arriving rapidly
			if (
				e.key.length === 1 &&
				(timeSinceLastKey <= maxDelay || bufferRef.current === "")
			) {
				bufferRef.current += e.key;
				lastKeystrokeRef.current = now;

				// Reset buffer after inactivity
				if (timeoutRef.current) clearTimeout(timeoutRef.current);
				timeoutRef.current = setTimeout(() => {
					bufferRef.current = "";
				}, 300);
			}
		}

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => {
			window.removeEventListener("keydown", handleKeyDown, { capture: true });
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, [enabled, minLength, maxDelay]);
}
