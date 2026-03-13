/**
 * ESC/POS command helpers for thermal receipt printers.
 *
 * Reference: Epson ESC/POS Application Programming Guide
 * These commands work with most Epson-compatible thermal printers
 * (Epson TM-T20, TM-T88, Star TSP100, etc.)
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const CMD = {
	/** Initialize printer (reset to defaults) */
	INIT: new Uint8Array([ESC, 0x40]),

	/** Line feed */
	LF: new Uint8Array([LF]),

	/** Cut paper (partial cut) */
	CUT: new Uint8Array([GS, 0x56, 0x41, 0x03]),

	/** Full cut */
	FULL_CUT: new Uint8Array([GS, 0x56, 0x00]),

	/** Open cash drawer (pin 2, 100ms on, 100ms off) */
	CASH_DRAWER: new Uint8Array([ESC, 0x70, 0x00, 0x64, 0x64]),

	/** Bold on */
	BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),

	/** Bold off */
	BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),

	/** Double height + width on */
	DOUBLE_ON: new Uint8Array([GS, 0x21, 0x11]),

	/** Double height + width off */
	DOUBLE_OFF: new Uint8Array([GS, 0x21, 0x00]),

	/** Align left */
	ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),

	/** Align center */
	ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),

	/** Align right */
	ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),

	/** Underline on */
	UNDERLINE_ON: new Uint8Array([ESC, 0x2d, 0x01]),

	/** Underline off */
	UNDERLINE_OFF: new Uint8Array([ESC, 0x2d, 0x00]),

	/** Feed N lines */
	feedLines: (n: number) => new Uint8Array([ESC, 0x64, n]),
} as const;

const encoder = new TextEncoder();

/** Encode a plain-text string to bytes suitable for ESC/POS printer */
export function textToBytes(text: string): Uint8Array {
	return encoder.encode(text);
}

/** Concatenate multiple Uint8Arrays into one */
export function concat(...arrays: Uint8Array[]): Uint8Array {
	const totalLen = arrays.reduce((sum, arr) => sum + arr.length, 0);
	const result = new Uint8Array(totalLen);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

/**
 * Build ESC/POS binary from a plain-text ticket.
 * Takes the rendered text output from the server's print service
 * and wraps it with proper ESC/POS commands.
 */
export function buildEscPosPayload(
	text: string,
	opts?: { cut?: boolean; openDrawer?: boolean },
): Uint8Array {
	const lines = text.split("\n");
	const parts: Uint8Array[] = [CMD.INIT];

	for (const line of lines) {
		// Detect headers (all caps lines) and make them bold + centered
		const isHeader =
			line === line.toUpperCase() &&
			line.trim().length > 0 &&
			!/^[-=]+$/.test(line.trim());
		const isDivider = /^[-=]+$/.test(line.trim());

		if (isHeader && !isDivider) {
			parts.push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
			parts.push(textToBytes(line), CMD.LF);
			parts.push(CMD.DOUBLE_OFF, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
		} else if (isDivider) {
			parts.push(textToBytes(line), CMD.LF);
		} else {
			parts.push(textToBytes(line), CMD.LF);
		}
	}

	// Feed 3 lines then cut
	parts.push(CMD.feedLines(3));
	if (opts?.cut !== false) {
		parts.push(CMD.CUT);
	}
	if (opts?.openDrawer) {
		parts.push(CMD.CASH_DRAWER);
	}

	return concat(...parts);
}
