// ── Vendor Bill PDF Builder ──────────────────────────────────────────────────
// Generates a professional Blob URL HTML document for vendor bill printing.
// Opens in a new tab — does NOT use window.print() on the current page.

type LineItem = {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
};

export type VendorBillPdfRow = {
	billNumber: string;
	supplierName: string;
	issuedDate?: string | null;
	dueDate?: string | null;
	status: string;
	items: unknown;
	subtotal: string | number;
	taxTotal: string | number;
	total: string | number;
	amountPaid: string | number;
	notes?: string | null;
	createdAt?: string | null;
};

export async function openVendorBillPdf(
	bill: VendorBillPdfRow,
): Promise<void> {
	// Open window synchronously (inside user-gesture context) before any await.
	// Browsers block window.open() called after an await as an untrusted popup.
	const win = window.open("about:blank", "_blank");
	const logoBase64 = await fetchLogoBase64();
	const html = buildVendorBillHtml(bill, logoBase64);
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	if (win) {
		win.location.href = url;
	} else {
		window.open(url, "_blank");
	}
	setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

async function fetchLogoBase64(): Promise<string> {
	try {
		const resp = await fetch("/images/bettencourts-logo.png");
		const buf = await resp.arrayBuffer();
		const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
		return `data:image/png;base64,${b64}`;
	} catch {
		return "";
	}
}

function fmtGYD(amount: number): string {
	return new Intl.NumberFormat("en-GY", {
		style: "currency",
		currency: "GYD",
		minimumFractionDigits: 2,
	}).format(amount);
}

function escHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildVendorBillHtml(bill: VendorBillPdfRow, logo: string): string {
	const items = Array.isArray(bill.items) ? (bill.items as LineItem[]) : [];
	const subtotal = Number(bill.subtotal);
	const taxAmt = Number(bill.taxTotal);
	const total = Number(bill.total);
	const paid = Number(bill.amountPaid);
	const balanceDue = Math.max(total - paid, 0);
	const isFullyPaid = balanceDue <= 0.005;

	const issuedStr = bill.issuedDate
		? new Date(bill.issuedDate).toLocaleDateString("en-GY")
		: bill.createdAt
			? new Date(bill.createdAt).toLocaleDateString("en-GY")
			: new Date().toLocaleDateString("en-GY");
	const dueStr = bill.dueDate
		? new Date(bill.dueDate).toLocaleDateString("en-GY")
		: null;

	const logoHtml = logo
		? `<img src="${logo}" class="logo" alt="Bettencourt's Logo" />`
		: "";

	const statusBadgeColor =
		bill.status === "paid"
			? "#16a34a"
			: bill.status === "void" || bill.status === "cancelled"
				? "#94a3b8"
				: bill.status === "overdue"
					? "#dc2626"
					: "#d97706";

	const itemRows = items
		.map(
			(item) => `
    <tr>
      <td>${escHtml(item.description)}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${fmtGYD(item.unitPrice)}</td>
      <td class="right">${fmtGYD(item.total)}</td>
    </tr>`,
		)
		.join("");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(bill.billNumber)} — Bettencourt's Food Inc.</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; }
  .wrapper { max-width: 794px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; }

  .header { background: #1e293b; color: white; padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .logo-area { display: flex; align-items: center; gap: 16px; }
  .logo { height: 56px; width: auto; border-radius: 6px; }
  .company-name { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
  .company-sub { font-size: 11px; opacity: 0.7; margin-top: 3px; line-height: 1.5; }
  .doc-type { font-size: 28px; font-weight: 800; letter-spacing: 0.12em; text-align: right; color: #fbbf24; }
  .doc-number { font-family: 'Courier New', monospace; font-size: 13px; margin-top: 5px; opacity: 0.85; text-align: right; }
  .doc-meta { font-size: 11px; margin-top: 3px; opacity: 0.7; text-align: right; }
  .status-pill { display: inline-block; background: ${statusBadgeColor}22; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeColor}44; border-radius: 99px; padding: 2px 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 6px; }

  .parties-section { padding: 24px 36px; display: flex; gap: 48px; border-bottom: 1px solid #e2e8f0; background: #fffbeb; }
  .party-col { flex: 1; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
  .party-name { font-size: 14px; font-weight: 600; }
  .party-sub { font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.5; }

  .items-table { width: 100%; border-collapse: collapse; }
  .items-table thead tr { background: #fffbeb; }
  .items-table th { padding: 10px 16px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: #78350f; text-transform: uppercase; border-bottom: 2px solid #fde68a; text-align: left; white-space: nowrap; }
  .items-table th.right { text-align: right; }
  .items-table td { padding: 11px 16px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #334155; }
  .items-table td.right { text-align: right; font-variant-numeric: tabular-nums; font-family: 'Courier New', monospace; }
  .items-table tbody tr:hover { background: #fffbeb; }
  .items-table tbody tr:last-child td { border-bottom: none; }

  .totals-section { padding: 20px 36px; display: flex; justify-content: flex-end; border-top: 2px solid #e2e8f0; }
  .totals-table { min-width: 300px; }
  .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 12px; color: #475569; }
  .totals-row .label { }
  .totals-row .amount { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
  .totals-row.separator { border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
  .totals-row.grand { font-size: 14px; font-weight: 700; color: #1e293b; }
  .totals-row.paid-row .amount { color: #16a34a; }
  .totals-row.balance-due { font-size: 16px; font-weight: 800; color: #d97706; margin-top: 4px; padding-top: 8px; border-top: 2px solid #fde68a; }
  .totals-row.balance-due.settled { color: #16a34a; }

  .notes-section { padding: 16px 36px; font-size: 12px; color: #475569; border-top: 1px solid #e2e8f0; line-height: 1.6; }
  .notes-section strong { color: #1e293b; }

  .footer { padding: 14px 36px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; background: #f8fafc; }

  @media print {
    @page { margin: 0; size: A4; }
    body { background: white; }
    .wrapper { margin: 0; box-shadow: none; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <!-- Dark header band -->
  <div class="header">
    <div class="logo-area">
      ${logoHtml}
      <div>
        <div class="company-name">Bettencourt's Food Inc.</div>
        <div class="company-sub">Georgetown, Guyana</div>
      </div>
    </div>
    <div>
      <div class="doc-type">VENDOR BILL</div>
      <div class="doc-number">${escHtml(bill.billNumber)}</div>
      <div class="doc-meta">Issued: ${issuedStr}</div>
      ${dueStr ? `<div class="doc-meta">Due: ${dueStr}</div>` : ""}
      <div style="text-align:right"><span class="status-pill">${escHtml(bill.status.toUpperCase())}</span></div>
    </div>
  </div>

  <!-- Billed From / To -->
  <div class="parties-section">
    <div class="party-col">
      <div class="section-label">Billed From</div>
      <div class="party-name">${escHtml(bill.supplierName)}</div>
    </div>
    <div class="party-col">
      <div class="section-label">To</div>
      <div class="party-name">Bettencourt's Food Inc.</div>
      <div class="party-sub">Georgetown, Guyana</div>
    </div>
  </div>

  <!-- Line Items -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right" style="width:60px">Qty</th>
        <th class="right" style="width:110px">Unit Price</th>
        <th class="right" style="width:120px">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows.length > 0 ? itemRows : `<tr><td colspan="4" style="text-align:center;padding:24px;color:#94a3b8;font-style:italic">No line items</td></tr>`}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <div class="totals-table">
      <div class="totals-row"><span class="label">Subtotal</span><span class="amount">${fmtGYD(subtotal)}</span></div>
      ${taxAmt > 0 ? `<div class="totals-row"><span class="label">VAT</span><span class="amount">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="totals-row separator grand"><span class="label">Total</span><span class="amount">${fmtGYD(total)}</span></div>
      ${paid > 0 ? `<div class="totals-row paid-row"><span class="label">Amount Paid</span><span class="amount">-${fmtGYD(paid)}</span></div>` : ""}
      <div class="totals-row balance-due${isFullyPaid ? " settled" : ""}">
        <span class="label">Balance Due</span>
        <span class="amount">${fmtGYD(balanceDue)}</span>
      </div>
    </div>
  </div>

  ${bill.notes ? `<div class="notes-section"><strong>Notes:</strong> ${escHtml(bill.notes)}</div>` : ""}

  <div class="footer">
    Bettencourt's Food Inc. &nbsp;&bull;&nbsp; Vendor Bill
    <br>Generated ${new Date().toLocaleString("en-GY")}
  </div>
</div>
</body>
</html>`;
}
