// ── Invoice PDF Builder ─────────────────────────────────────────────────
// Generates a professional Blob URL HTML document for invoice printing.
// Opens in a new tab — does NOT use window.print() on the current page.
// Layout mirrors the Invoice Ninja "Business" template (ID 5):
//   - 3-col header (1fr auto 1fr), grey company details in centre/right
//   - client-details LEFT (client name in gold at 120%), gold entity-details box RIGHT
//   - Secondary-gold table header with rounded top corners
//   - 2fr/1fr totals grid, secondary-gold outstanding row

export type InvoicePaymentEntry = {
	datePaid: string;
	amount: string | number;
	paymentMethod: string;
	referenceNumber?: string | null;
	chequeNumber?: string | null;
	isReversal?: boolean;
};

export type InvoicePdfRow = {
	invoiceNumber: string;
	customerName: string;
	customerAddress?: string | null;
	customerPhone?: string | null;
	agencyName?: string | null;
	contactPersonName?: string | null;
	contactPersonPosition?: string | null;
	issuedDate?: string | null;
	createdAt: string;
	dueDate?: string | null;
	paymentTerms?: string | null;
	status: string;
	items: unknown;
	subtotal: string | number;
	taxTotal: string | number;
	total: string | number;
	amountPaid: string | number;
	discountType?: string | null;
	discountValue?: string | null;
	taxMode?: string | null;
	taxRate?: string | null;
	notes?: string | null;
	preparedBy?: string | null;
	payments?: InvoicePaymentEntry[];
	brand?: string | null;
};

export type DocSettings = {
	companyTin?: string | null;
	bankName?: string | null;
	bankAccount?: string | null;
	bankBranch?: string | null;
	paymentInstructions?: string | null;
	invoiceFooterNote?: string | null;
};

type LineItem = {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
	taxExempt?: boolean;
};

export async function openInvoicePdf(
	invoice: InvoicePdfRow,
	settings: DocSettings = {},
): Promise<"ok" | "popup_blocked"> {
	// Open window synchronously (inside user-gesture context) before any await.
	// Browsers block window.open() called after an await as an untrusted popup.
	const win = window.open("about:blank", "_blank");
	if (!win) {
		return "popup_blocked";
	}
	const logoBase64 = await fetchLogoBase64(invoice.brand);
	const html = buildInvoiceHtml(invoice, settings, logoBase64);
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	win.location.href = url;
	setTimeout(() => URL.revokeObjectURL(url), 15_000);
	return "ok";
}

async function fetchLogoBase64(brand?: string | null): Promise<string> {
	const isHomeStyle = brand === "home_style";
	const path = isHomeStyle
		? "/images/bettencourts-home-style-logo.jpg"
		: "/images/bettencourts-logo.png";
	const mime = isHomeStyle ? "image/jpeg" : "image/png";
	try {
		const resp = await fetch(path);
		if (!resp.ok) throw new Error("not found");
		const buf = await resp.arrayBuffer();
		const b64 = (() => {
		const bytes = new Uint8Array(buf);
		let binary = "";
		for (let i = 0; i < bytes.length; i += 8192)
			binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
		return btoa(binary);
	})();
		return `data:${mime};base64,${b64}`;
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

const TERMS_LABEL: Record<string, string> = {
	due_on_receipt: "Due on Receipt",
	net_15: "Net 15",
	net_30: "Net 30",
	net_60: "Net 60",
	custom: "Custom",
};

function buildInvoiceHtml(
	invoice: InvoicePdfRow,
	settings: DocSettings,
	logo: string,
): string {
	const items = Array.isArray(invoice.items)
		? (invoice.items as LineItem[])
		: [];
	const subtotal = Number(invoice.subtotal);
	const discountAmt =
		invoice.discountType === "percent"
			? (subtotal * Number(invoice.discountValue ?? 0)) / 100
			: Number(invoice.discountValue ?? 0);
	const taxAmt = Number(invoice.taxTotal);
	const total = Number(invoice.total);
	const paid = Number(invoice.amountPaid);
	const balance = total - paid;
	const isFullyPaid = balance <= 0.005;

	const isHomeStyle = invoice.brand === "home_style";
	const companyName = isHomeStyle ? "Bettencourt's Home Style" : "Bettencourt's Food Inc.";

	const issuedStr = invoice.issuedDate
		? new Date(invoice.issuedDate).toLocaleDateString("en-GY")
		: new Date(invoice.createdAt).toLocaleDateString("en-GY");
	const dueStr = invoice.dueDate
		? new Date(invoice.dueDate).toLocaleDateString("en-GY")
		: null;

	const logoHtml = logo
		? `<img class="company-logo" src="${logo}" alt="${escHtml(companyName)} logo">`
		: "";

	const taxColHeader =
		invoice.taxMode === "line" ? "<th>Tax</th>" : "";

	const itemRows = items
		.map(
			(item) => `
    <tr>
      <td>${escHtml(item.description)}</td>
      <td class="right-td">${item.quantity}</td>
      <td class="right-td">${fmtGYD(item.unitPrice)}</td>
      ${invoice.taxMode === "line" ? `<td class="right-td">${item.taxExempt ? "Exempt" : `${invoice.taxRate ?? "14"}%`}</td>` : ""}
      <td class="right-td">${fmtGYD(item.total)}</td>
    </tr>`,
		)
		.join("");

	const METHOD_LABEL: Record<string, string> = {
		cash: "Cash",
		cheque: "Cheque",
		bank_transfer: "Bank Transfer",
		mobile_money: "Mobile Money",
		credit_note: "Credit Note",
	};

	const paymentHistoryBlock =
		invoice.payments && invoice.payments.length > 0
			? `
  <div class="history-section">
    <div class="section-label">Payment History</div>
    <table class="history-table">
      <thead>
        <tr>
          <th>Date</th><th>Method</th><th>Reference</th><th class="right-th">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.payments
					.map(
						(p) => `
        <tr>
          <td${p.isReversal ? ' class="reversal"' : ""}>${new Date(p.datePaid).toLocaleDateString("en-GY")}${p.isReversal ? " (Reversal)" : ""}</td>
          <td>${escHtml(METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod)}${p.chequeNumber ? ` #${escHtml(p.chequeNumber)}` : ""}</td>
          <td>${p.referenceNumber ? escHtml(p.referenceNumber) : "—"}</td>
          <td class="right-td${p.isReversal ? " reversal" : ""}">${p.isReversal ? "-" : ""}${fmtGYD(Math.abs(Number(p.amount)))}</td>
        </tr>`,
					)
					.join("")}
      </tbody>
    </table>
  </div>`
			: "";

	const paymentBlock =
		settings.bankName || settings.paymentInstructions
			? `
    <div class="payment-section">
      <div class="section-label">Payment Instructions</div>
      ${settings.bankName ? `<div class="payment-detail"><strong>Bank:</strong> ${escHtml(settings.bankName)}${settings.bankBranch ? ` (${escHtml(settings.bankBranch)})` : ""}</div>` : ""}
      ${settings.bankAccount ? `<div class="payment-detail"><strong>Account:</strong> ${escHtml(settings.bankAccount)}</div>` : ""}
      <div class="payment-detail"><strong>Reference:</strong> ${escHtml(invoice.invoiceNumber)}</div>
      ${settings.paymentInstructions ? `<div class="payment-detail" style="margin-top:6px">${escHtml(settings.paymentInstructions)}</div>` : ""}
    </div>`
			: "";

	const clientNameLine = invoice.agencyName
		? `<p class="client-primary">${escHtml(invoice.agencyName)}</p><p>${escHtml(invoice.customerName)}</p>`
		: `<p class="client-primary">${escHtml(invoice.customerName)}</p>`;

	// Notes shown above the totals left-column (mirrors IN public_notes placement)
	const notesBlock = invoice.notes
		? `<div class="notes-left"><span class="notes-label">Notes:</span> <span class="notes-text">${escHtml(invoice.notes)}</span></div>`
		: "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(invoice.invoiceNumber)} — ${companyName}</title>
<style>
  :root {
    --primary: #b8862d;
    --secondary: #7d5518;
    --line-height: 1.6;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    padding-top: 52px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif;
    font-size: 14px;
    background: #f1f5f9;
    color: #333;
    -webkit-font-smoothing: antialiased;
  }

  .wrapper {
    max-width: 800px;
    margin: 24px auto;
    background: white;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    padding: 28px 36px 24px;
  }

  /* ── 3-COLUMN HEADER (Business: 1fr auto 1fr, grey company text) ── */
  .header-container {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: start;
    gap: 1rem;
    width: 100%;
    margin-bottom: 2rem;
  }

  .company-logo-container { justify-self: start; }
  .company-logo { max-width: 160px; max-height: 64px; width: auto; height: auto; display: block; }

  /* Company details — grey (Business: #AAA9A9) */
  #company-details {
    justify-self: center;
    align-self: start;
    display: flex;
    flex-direction: column;
    color: #aaa9a9;
    line-height: var(--line-height);
    text-align: center;
    font-size: 0.88em;
  }

  /* Company address — lighter grey (Business: #b1b1b1) */
  #company-address {
    justify-self: end;
    align-self: start;
    display: flex;
    flex-direction: column;
    color: #b1b1b1;
    line-height: var(--line-height);
    text-align: right;
    font-size: 0.88em;
  }

  /* ── CLIENT + ENTITY WRAPPER (Business: flex space-between, margin-bottom 2rem) ── */
  .client-and-entity-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1.5rem;
  }

  /* LEFT: client-details — "issued to" label + client name in PRIMARY (120%) */
  #client-details {
    display: flex;
    flex-direction: column;
    line-height: var(--line-height);
    font-size: 0.9em;
    color: #555;
  }
  .entity-issued-to {
    font-size: 0.82em;
    color: #888;
    margin-bottom: 4px;
  }
  /* Second child = client name in primary color at 120% (Business signature) */
  #client-details .client-primary {
    color: var(--primary);
    font-size: 1.2em;
    font-weight: 600;
  }

  /* RIGHT: entity-details — PRIMARY background, border-radius 1rem, white text */
  #entity-details {
    background-color: var(--primary);
    padding: 1.2rem;
    border-radius: 1rem;
    min-width: 220px;
    color: white;
    border-collapse: collapse;
    flex-shrink: 0;
  }
  #entity-details th {
    font-weight: normal;
    padding-bottom: 0.5rem;
    padding-right: 12px;
    white-space: nowrap;
    font-size: 0.88em;
    opacity: 0.9;
  }
  #entity-details td {
    text-align: right;
    padding-left: 10px;
    font-size: 0.88em;
    font-weight: 600;
    padding-bottom: 0.5rem;
  }
  #entity-details tr:last-child th,
  #entity-details tr:last-child td { padding-bottom: 0; }

  /* ── ITEMS TABLE (Business: secondary-color header, rounded top corners 10px) ── */
  .items-table {
    margin-top: 0.5rem;
    margin-bottom: 5px;
    min-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    overflow-wrap: break-word;
  }
  .items-table thead {
    text-align: left;
    background: var(--secondary);
  }
  .items-table thead th {
    padding: 1rem;
    color: white;
    font-weight: 600;
    font-size: 0.88em;
  }
  .items-table thead th.left-radius { border-top-left-radius: 10px; }
  .items-table thead th.right-radius { text-align: right; border-top-right-radius: 10px; }

  .items-table tbody td {
    padding: 1rem;
    font-size: 0.88em;
    color: #444;
    vertical-align: top;
  }
  .items-table tbody td.right-td { text-align: right; font-variant-numeric: tabular-nums; }
  /* Business: odd + even both use #F7F7F7 (light grey for all rows) */
  .items-table tbody tr td { background: #F7F7F7; }
  .items-table tbody tr:nth-child(even) td { background: #f7f7f7; }

  /* ── TABLE TOTALS (Business: 2fr 1fr, gap 80px, outstanding in secondary-color) ── */
  #table-totals {
    margin-top: 0;
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 80px;
    padding-top: 0.5rem;
    padding-bottom: 0.8rem;
    overflow: visible;
  }

  .totals-left {
    font-size: 0.82em;
    color: #666;
    line-height: var(--line-height);
  }

  .totals-right { display: flex; flex-direction: column; }
  .t-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: 0.75rem;
    font-size: 0.88em;
    color: #555;
  }
  .t-row .amt { text-align: right; padding-right: 17px; font-variant-numeric: tabular-nums; }
  .t-row .lbl { padding-left: 7px; }
  .t-row.discount .amt { color: #dc2626; }
  .t-row.paid-row .amt { color: #16a34a; }
  .t-row.sep { font-weight: bold; color: #333; }

  /* Outstanding row — full secondary-color box (Business signature) */
  .outstanding-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: 0.75rem;
  }
  .outstanding-label {
    background-color: var(--secondary);
    color: white;
    font-size: 1.05em;
    font-weight: bold;
    padding: 1rem;
    border-top-left-radius: 7px;
    border-bottom-left-radius: 7px;
    white-space: nowrap;
    padding-left: 10px;
  }
  .outstanding-value {
    background-color: var(--secondary);
    color: white;
    font-size: 1.05em;
    font-weight: bold;
    padding: 1rem 17px;
    border-top-right-radius: 7px;
    border-bottom-right-radius: 7px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .outstanding-label.paid,
  .outstanding-value.paid { background-color: #16a34a; }

  /* ── NOTES ── */
  .notes-left { font-size: 0.85em; line-height: 1.6; }
  .notes-label { font-weight: bold; color: #dc2626; font-style: italic; }
  .notes-text { color: #dc2626; font-style: italic; font-weight: 500; }

  /* ── PAYMENT HISTORY ── */
  .history-section { padding-top: 12px; border-top: 1px solid #ebebeb; margin-top: 8px; }
  .section-label { font-size: 0.78em; font-weight: 700; letter-spacing: 0.1em; color: #888; text-transform: uppercase; margin-bottom: 8px; }
  .history-table { width: 100%; border-collapse: collapse; }
  .history-table th { padding: 5px 8px; font-size: 0.78em; font-weight: 700; color: #888; border-bottom: 1px solid #ebebeb; text-align: left; }
  .history-table th.right-th { text-align: right; }
  .history-table td { padding: 6px 8px; font-size: 0.85em; border-bottom: 1px solid #f5f5f5; color: #444; }
  .history-table td.right-td { text-align: right; font-variant-numeric: tabular-nums; }
  .history-table td.reversal { color: #dc2626; font-style: italic; }

  /* ── PAYMENT INSTRUCTIONS ── */
  .payment-section { padding-top: 12px; border-top: 1px solid #ebebeb; margin-top: 8px; font-size: 0.85em; color: #555; line-height: var(--line-height); }
  .payment-detail { margin-top: 2px; }

  /* ── SIGNATURES ── */
  .sig-section { display: flex; justify-content: space-between; gap: 48px; padding-top: 20px; border-top: 1px solid #ebebeb; margin-top: 8px; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1px solid #555; height: 28px; margin-bottom: 4px; }
  .sig-label { font-size: 0.85em; color: #555; font-weight: 600; }

  /* ── CHEQUES + CREDIT ── */
  .cheques-section { padding-top: 10px; border-top: 1px solid #ebebeb; margin-top: 8px; font-size: 0.82em; color: #555; line-height: 1.5; }
  .cheques-section strong { color: #333; }
  .credit-terms { margin-top: 3px; color: #888; }

  /* ── FOOTER (Business: margin-top 30px, plain text) ── */
  #footer {
    margin-top: 30px;
    font-size: 0.78em;
    color: #aaa;
    text-align: center;
  }

  /* ── PRINT BAR (screen only) ── */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #1e293b; color: white; display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .print-bar span { opacity: 0.7; font-size: 12px; }
  .print-btn { background: white; color: #1e293b; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .print-btn:hover { background: #f1f5f9; }

  @media print {
    @page { margin: 15mm; size: A4; }
    body { background: white; padding-top: 0; }
    .wrapper { margin: 0; max-width: 100%; box-shadow: none; padding: 0; }
    .print-bar { display: none; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <span>Bettencourt's POS — Document Preview</span>
  <button class="print-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
    Print / Save as PDF
  </button>
</div>

<div class="wrapper">

  <!-- 3-COLUMN HEADER: Logo LEFT | Company Details (grey) CENTER | Address (grey) RIGHT -->
  <div class="header-container">
    <div class="company-logo-container">${logoHtml}</div>
    <div id="company-details">
      <span>${escHtml(companyName)}</span>
      <span>Georgetown, Guyana</span>
      ${settings.companyTin ? `<span>TIN: ${escHtml(settings.companyTin)}</span>` : ""}
    </div>
    <div id="company-address">
      <span>Georgetown</span>
      <span>Demerara-Mahaica</span>
      <span>Guyana</span>
    </div>
  </div>

  <!-- CLIENT LEFT | GOLD ENTITY-DETAILS BOX RIGHT -->
  <div class="client-and-entity-wrapper">
    <div id="client-details">
      <p class="entity-issued-to">Invoice issued to:</p>
      ${clientNameLine}
      ${invoice.contactPersonName ? `<p>${escHtml(invoice.contactPersonName)}${invoice.contactPersonPosition ? `, ${escHtml(invoice.contactPersonPosition)}` : ""}</p>` : invoice.contactPersonPosition ? `<p>${escHtml(invoice.contactPersonPosition)}</p>` : ""}
      ${invoice.customerPhone ? `<p>${escHtml(invoice.customerPhone)}</p>` : ""}
      ${invoice.customerAddress ? `<p>${escHtml(invoice.customerAddress)}</p>` : ""}
      ${invoice.preparedBy ? `<p style="margin-top:8px;font-size:0.82em;color:#888">Prepared by: ${escHtml(invoice.preparedBy)}</p>` : ""}
    </div>

    <table id="entity-details" cellspacing="0">
      <tr><th>Invoice #</th><td>${escHtml(invoice.invoiceNumber)}</td></tr>
      <tr><th>Date</th><td>${issuedStr}</td></tr>
      ${dueStr ? `<tr><th>Due Date</th><td>${dueStr}</td></tr>` : ""}
      <tr><th>Terms</th><td>${escHtml(TERMS_LABEL[invoice.paymentTerms ?? "due_on_receipt"] ?? invoice.paymentTerms ?? "Due on Receipt")}</td></tr>
      <tr><th>Total</th><td>${fmtGYD(total)}</td></tr>
      <tr><th>Balance Due</th><td>${fmtGYD(Math.max(balance, 0))}</td></tr>
      <tr><th>Status</th><td>${escHtml(invoice.status.toUpperCase())}</td></tr>
    </table>
  </div>

  <!-- ITEMS TABLE: secondary-gold header, rounded corners, grey rows -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="left-radius">Item / Description</th>
        <th style="width:58px;text-align:right">Qty</th>
        <th style="width:110px;text-align:right">Unit Cost</th>
        ${taxColHeader}
        <th class="right-radius" style="width:120px">Line Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TABLE TOTALS: Notes LEFT | Amounts RIGHT -->
  <div id="table-totals">
    <div class="totals-left">
      ${notesBlock}
    </div>
    <div class="totals-right">
      <div class="t-row"><span class="lbl">Subtotal</span><span class="amt">${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="t-row discount"><span class="lbl">Discount${invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span class="amt">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="t-row"><span class="lbl">Tax</span><span class="amt">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="t-row sep"><span class="lbl">Total</span><span class="amt">${fmtGYD(total)}</span></div>
      ${paid > 0 ? `<div class="t-row paid-row"><span class="lbl">Amount Paid</span><span class="amt">-${fmtGYD(paid)}</span></div>` : ""}
      <div class="outstanding-row">
        <div class="outstanding-label${isFullyPaid ? " paid" : ""}">Balance Due</div>
        <div class="outstanding-value${isFullyPaid ? " paid" : ""}">${fmtGYD(Math.max(balance, 0))}</div>
      </div>
    </div>
  </div>

  ${paymentHistoryBlock}

  ${paymentBlock}

  <!-- SIGNATURES -->
  <div class="sig-section">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Received by</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Authorized by</div></div>
  </div>

  <!-- CHEQUES + CREDIT TERMS -->
  <div class="cheques-section">
    <div>All cheques are to be made payable to: <strong>${escHtml(companyName)}</strong></div>
    <div class="credit-terms">Credit period: All invoices are due 30 days from date of issue &nbsp;&bull;&nbsp; 10% service charge will be applied to balance due for late payments.</div>
  </div>

  <div id="footer">
    ${escHtml(companyName)} &nbsp;&bull;&nbsp; ${settings.invoiceFooterNote ? escHtml(settings.invoiceFooterNote) + " &nbsp;&bull;&nbsp; " : ""}Generated ${new Date().toLocaleString("en-GY")}
  </div>

</div>
</body>
</html>`;
}

function escHtml(str: string | null | undefined): string {
	if (!str) return "";
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
