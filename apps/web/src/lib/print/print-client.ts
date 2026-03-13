/**
 * Client-side print service for sending ESC/POS data to thermal printers.
 *
 * Supports two connection types:
 * 1. WebUSB — direct USB connection from the browser (Chrome/Chromium only)
 * 2. Network — proxied through the server to TCP printers
 *
 * Usage:
 *   const client = new PrintClient();
 *   await client.print({ connectionType: "usb", text: "..." });
 *   await client.print({ connectionType: "network", address: "192.168.1.100:9100", text: "..." });
 */

import { buildEscPosPayload } from "./esc-pos";

export type PrintRequest = {
	/** Connection type for the target printer */
	connectionType: "usb" | "network" | "mock";
	/** For network printers: "host:port" */
	address?: string | null;
	/** The rendered text to print */
	text: string;
	/** Whether to cut paper after printing (default: true) */
	cut?: boolean;
	/** Whether to open cash drawer (default: false) */
	openDrawer?: boolean;
};

// ── WebUSB Adapter ──────────────────────────────────────────────────────
// WebUSB is available in Chrome/Chromium. The user must grant access to the printer.

let cachedUsbDevice: USBDevice | null = null;

async function getUsbDevice(): Promise<USBDevice> {
	if (cachedUsbDevice?.opened) {
		return cachedUsbDevice;
	}

	// Check for previously paired device
	const devices = await navigator.usb.getDevices();
	if (devices.length > 0) {
		cachedUsbDevice = devices[0]!;
	} else {
		// Prompt user to select a USB printer
		// Common USB printer vendor IDs: Epson (0x04b8), Star (0x0519), etc.
		cachedUsbDevice = await navigator.usb.requestDevice({
			filters: [
				{ classCode: 7 }, // Printer class
			],
		});
	}

	if (!cachedUsbDevice.opened) {
		await cachedUsbDevice.open();
	}

	// Select configuration and claim interface
	if (cachedUsbDevice.configuration === null) {
		await cachedUsbDevice.selectConfiguration(1);
	}

	// Find the printer interface (class 7)
	const iface = cachedUsbDevice.configuration?.interfaces.find((i) =>
		i.alternates.some((a) => a.interfaceClass === 7),
	);

	if (iface) {
		await cachedUsbDevice.claimInterface(iface.interfaceNumber);
	}

	return cachedUsbDevice;
}

async function printViaUsb(data: Uint8Array): Promise<void> {
	const device = await getUsbDevice();

	// Find the bulk OUT endpoint
	const iface = device.configuration?.interfaces.find((i) =>
		i.alternates.some((a) => a.interfaceClass === 7),
	);
	const alt = iface?.alternates.find((a) => a.interfaceClass === 7);
	const endpoint = alt?.endpoints.find((e) => e.direction === "out");

	if (!endpoint) {
		throw new Error("No output endpoint found on USB printer");
	}

	await device.transferOut(endpoint.endpointNumber, data);
}

// ── Network Print (via server proxy) ────────────────────────────────────
// Sends the ESC/POS payload to the server which forwards it to the network printer

async function printViaNetwork(
	address: string,
	data: Uint8Array,
): Promise<void> {
	const response = await fetch("/api/print/network", {
		method: "POST",
		headers: { "Content-Type": "application/octet-stream" },
		body: JSON.stringify({
			address,
			data: Array.from(data), // Send as number array for JSON transport
		}),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Network print failed: ${err}`);
	}
}

// ── Print Client ────────────────────────────────────────────────────────

export class PrintClient {
	async print(request: PrintRequest): Promise<void> {
		const escPosData = buildEscPosPayload(request.text, {
			cut: request.cut,
			openDrawer: request.openDrawer,
		});

		switch (request.connectionType) {
			case "usb":
				await printViaUsb(escPosData);
				break;
			case "network":
				if (!request.address) {
					throw new Error("Network printer address is required");
				}
				await printViaNetwork(request.address, escPosData);
				break;
			case "mock":
				console.info("[mock-print]", request.text.slice(0, 200));
				break;
		}
	}

	/** Check if WebUSB is available in this browser */
	get isWebUsbAvailable(): boolean {
		return typeof navigator !== "undefined" && "usb" in navigator;
	}

	/** Request user to pair a USB printer. Must be called from a user gesture. */
	async pairUsbPrinter(): Promise<USBDevice> {
		cachedUsbDevice = null;
		return getUsbDevice();
	}

	/** Disconnect from the current USB device */
	async disconnectUsb(): Promise<void> {
		if (cachedUsbDevice?.opened) {
			await cachedUsbDevice.close();
		}
		cachedUsbDevice = null;
	}
}

/** Singleton instance */
export const printClient = new PrintClient();
