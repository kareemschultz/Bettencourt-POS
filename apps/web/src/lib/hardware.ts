/**
 * Hardware Abstraction Layer
 * Interface-based design with NO hardcoded vendor/brand dependencies.
 * Implementations can be swapped without changing business logic.
 */

// === Printer Interface ===
export interface PrinterDriver {
	connect(): Promise<boolean>;
	disconnect(): Promise<void>;
	isConnected(): boolean;
	printRaw(data: Uint8Array): Promise<void>;
	printText(text: string): Promise<void>;
	cut(): Promise<void>;
	openCashDrawer(): Promise<void>;
}

export interface ReceiptData {
	headerText: string;
	locationName: string;
	orderNumber: string;
	date: string;
	cashierName: string;
	items: Array<{
		name: string;
		quantity: number;
		unitPrice: number;
		total: number;
		modifiers?: string[];
	}>;
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	total: number;
	payments: Array<{
		method: string;
		amount: number;
	}>;
	change?: number;
	footerText: string;
}

// === Barcode Scanner Interface ===
export interface BarcodeScannerDriver {
	onScan(callback: (barcode: string) => void): void;
	offScan(): void;
}

// === Cash Drawer Interface ===
export interface CashDrawerDriver {
	open(): Promise<void>;
	isOpen(): Promise<boolean>;
}

// === Kitchen Ticket Interface ===
export interface KitchenTicketData {
	orderNumber: string;
	tableName?: string;
	orderType: string;
	items: Array<{
		name: string;
		quantity: number;
		modifiers?: string[];
		notes?: string;
	}>;
	notes?: string;
	timestamp: string;
	station: string;
}

// ================================================================
// Default implementations (browser/development mode)
// ================================================================

export class BrowserPrinter implements PrinterDriver {
	private connected = false;

	async connect(): Promise<boolean> {
		this.connected = true;
		return true;
	}

	async disconnect(): Promise<void> {
		this.connected = false;
	}

	isConnected(): boolean {
		return this.connected;
	}

	async printRaw(data: Uint8Array): Promise<void> {
		console.log("[Hardware] Print raw data:", data.length, "bytes");
	}

	async printText(text: string): Promise<void> {
		console.log("[Hardware] Print text:", text);
	}

	async cut(): Promise<void> {
		console.log("[Hardware] Paper cut");
	}

	async openCashDrawer(): Promise<void> {
		console.log("[Hardware] Cash drawer opened");
	}
}

export class KeyboardBarcodeScanner implements BarcodeScannerDriver {
	private buffer = "";
	private timeout: ReturnType<typeof setTimeout> | null = null;
	private handler: ((e: KeyboardEvent) => void) | null = null;

	onScan(callback: (barcode: string) => void): void {
		this.callback = callback;
		this.handler = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			)
				return;

			if (e.key === "Enter" && this.buffer.length > 3) {
				callback(this.buffer);
				this.buffer = "";
				return;
			}

			if (e.key.length === 1) {
				this.buffer += e.key;
				if (this.timeout) clearTimeout(this.timeout);
				this.timeout = setTimeout(() => {
					this.buffer = "";
				}, 100);
			}
		};
		window.addEventListener("keydown", this.handler);
	}

	offScan(): void {
		if (this.handler) {
			window.removeEventListener("keydown", this.handler);
			this.handler = null;
		}
		this.callback = null;
	}
}

// === Receipt Formatter (ESC/POS compatible) ===
export function formatReceipt(data: ReceiptData): string {
	const lines: string[] = [];
	const w = 48; // 80mm paper width in characters

	lines.push(
		data.headerText.padStart((w + data.headerText.length) / 2).padEnd(w),
	);
	lines.push(
		data.locationName.padStart((w + data.locationName.length) / 2).padEnd(w),
	);
	lines.push("-".repeat(w));
	lines.push(`Order: ${data.orderNumber}`);
	lines.push(`Date: ${data.date}`);
	lines.push(`Cashier: ${data.cashierName}`);
	lines.push("-".repeat(w));

	for (const item of data.items) {
		const nameQty = `${item.quantity}x ${item.name}`;
		const price = `$${item.total.toFixed(2)}`;
		lines.push(nameQty.padEnd(w - price.length) + price);
		if (item.modifiers) {
			for (const mod of item.modifiers) {
				lines.push(`  + ${mod}`);
			}
		}
	}

	lines.push("-".repeat(w));
	lines.push(
		`${"Subtotal".padEnd(w - 10)}$${data.subtotal.toFixed(2).padStart(9)}`,
	);
	if (data.discountTotal > 0) {
		lines.push(
			`${"Discount".padEnd(w - 10)}-$${data.discountTotal.toFixed(2).padStart(8)}`,
		);
	}
	lines.push(`${"Tax".padEnd(w - 10)}$${data.taxTotal.toFixed(2).padStart(9)}`);
	lines.push("=".repeat(w));
	lines.push(`${"TOTAL".padEnd(w - 10)}$${data.total.toFixed(2).padStart(9)}`);
	lines.push("-".repeat(w));

	for (const payment of data.payments) {
		lines.push(
			`${payment.method.padEnd(w - 10)}$${payment.amount.toFixed(2).padStart(9)}`,
		);
	}

	if (data.change && data.change > 0) {
		lines.push(
			`${"Change".padEnd(w - 10)}$${data.change.toFixed(2).padStart(9)}`,
		);
	}

	lines.push("");
	lines.push(
		data.footerText.padStart((w + data.footerText.length) / 2).padEnd(w),
	);

	return lines.join("\n");
}

// === Global Hardware Manager ===
class HardwareManager {
	private printer: PrinterDriver = new BrowserPrinter();
	private scanner: BarcodeScannerDriver = new KeyboardBarcodeScanner();

	setPrinter(driver: PrinterDriver) {
		this.printer = driver;
	}
	setScanner(driver: BarcodeScannerDriver) {
		this.scanner = driver;
	}

	getPrinter(): PrinterDriver {
		return this.printer;
	}
	getScanner(): BarcodeScannerDriver {
		return this.scanner;
	}

	async printReceipt(data: ReceiptData): Promise<void> {
		const text = formatReceipt(data);
		await this.printer.printText(text);
	}

	async openDrawer(): Promise<void> {
		await this.printer.openCashDrawer();
	}
}

export const hardware = new HardwareManager();
