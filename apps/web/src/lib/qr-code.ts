/**
 * Minimal QR Code generator for table ordering URLs.
 * Uses the Google Charts API to generate QR code images.
 * For offline/no-dependency usage, consider adding the 'qrcode' npm package.
 */

/**
 * Generate a QR code image URL for the given data string.
 * Returns a data URL that can be used as an <img> src.
 */
export function generateQrUrl(data: string, size = 256): string {
	// Use Google Charts QR API (works without any npm dependency)
	const encoded = encodeURIComponent(data);
	return `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}&choe=UTF-8`;
}

/**
 * Build the full ordering URL for a specific table.
 */
export function buildTableOrderUrl(
	baseUrl: string,
	tableId: string,
	tableName: string,
): string {
	const url = new URL("/order", baseUrl);
	url.searchParams.set("table", tableId);
	url.searchParams.set("tableName", tableName);
	return url.toString();
}

/**
 * Print QR codes for one or more tables.
 * Opens a new window with a printable layout.
 */
export function printTableQrCodes(
	tables: Array<{ id: string; name: string }>,
	baseUrl: string,
): void {
	const cards = tables
		.map((table) => {
			const orderUrl = buildTableOrderUrl(baseUrl, table.id, table.name);
			const qrUrl = generateQrUrl(orderUrl, 200);
			return `
				<div style="display:inline-block;text-align:center;margin:16px;padding:16px;border:2px solid #333;border-radius:12px;width:240px;">
					<h2 style="margin:0 0 8px;font-size:20px;">Table ${table.name}</h2>
					<img src="${qrUrl}" width="200" height="200" style="display:block;margin:0 auto 8px;" />
					<p style="margin:0;font-size:11px;color:#666;">Scan to order</p>
				</div>
			`;
		})
		.join("");

	const html = `<!DOCTYPE html>
<html>
<head>
	<title>Table QR Codes</title>
	<style>
		body { font-family: system-ui, sans-serif; text-align: center; padding: 20px; }
		@media print {
			body { padding: 0; }
			div { break-inside: avoid; }
		}
	</style>
</head>
<body>
	<h1 style="font-size:24px;margin-bottom:20px;">Table QR Codes</h1>
	${cards}
</body>
</html>`;

	const win = window.open("", "_blank");
	if (win) {
		win.document.write(html);
		win.document.close();
	}
}
