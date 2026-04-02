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
	// Revoke the blob URL after the window has loaded it — no replaceState
	// needed here because the HTML template itself runs history.replaceState
	// in its own <script> tag (runs in the new window's context, not cross-origin).
	const onLoad = () => {
		setTimeout(() => URL.revokeObjectURL(url), 1_000);
		win.removeEventListener("load", onLoad);
	};
	win.addEventListener("load", onLoad);
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
	const companyName = isHomeStyle ? "Bettencourts Homestyle Diner" : "Bettencourt's Food Inc.";

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

	const clientPrimaryName = invoice.agencyName
		? escHtml(invoice.agencyName)
		: escHtml(invoice.customerName);

	const clientSubLines = [
		invoice.agencyName ? escHtml(invoice.customerName) : null,
		invoice.contactPersonName
			? `${escHtml(invoice.contactPersonName)}${invoice.contactPersonPosition ? `, ${escHtml(invoice.contactPersonPosition)}` : ""}`
			: invoice.contactPersonPosition ? escHtml(invoice.contactPersonPosition) : null,
		invoice.customerPhone ? escHtml(invoice.customerPhone) : null,
		invoice.customerAddress ? escHtml(invoice.customerAddress) : null,
	].filter(Boolean).join("<br>");

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
    --primary-contrast: #ffffff;
    --primary-contrast-soft: rgba(255, 255, 255, 0.85);
    --secondary-contrast: #ffffff;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif;
    font-size: 13px;
    background: #dde0e3;
    color: #333;
    -webkit-font-smoothing: antialiased;
    padding: 28px 16px 48px;
  }

  .wrapper {
    max-width: 794px;
    margin: 0 auto;
    background: white;
    padding: 44px 52px 52px;
    box-shadow: 0 2px 14px rgba(0,0,0,0.18);
  }

  /* ── HEADER: logo+company LEFT | doc-title + entity box RIGHT ── */
  .header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    align-items: start;
    margin-bottom: 2.4rem;
  }

  .company-logo { max-width: 180px; max-height: 72px; width: auto; height: auto; display: block; margin-bottom: 12px; }
  .company-name { font-size: 1em; font-weight: 700; color: #222; margin-bottom: 3px; }
  .company-sub  { font-size: 0.82em; color: #aaa; line-height: var(--line-height); }

  .header-right { display: flex; flex-direction: column; align-items: flex-end; }

  .doc-title {
    font-size: 2.6em;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: var(--primary);
    text-align: right;
    margin-bottom: 14px;
    line-height: 1;
  }

  /* Entity details box */
  #entity-details {
    width: 100%;
    background: var(--primary);
    border-radius: 12px;
    border-collapse: separate;
    border-spacing: 0;
    color: var(--primary-contrast);
  }
  #entity-details tr:first-child th,
  #entity-details tr:first-child td { padding-top: 14px; }
  #entity-details tr:last-child th,
  #entity-details tr:last-child td { padding-bottom: 14px; }
  #entity-details th {
    font-weight: 400;
    padding: 4px 8px 4px 16px;
    font-size: 0.82em;
    color: var(--primary-contrast-soft);
    white-space: nowrap;
    text-align: left;
  }
  #entity-details td {
    padding: 4px 16px 4px 8px;
    font-size: 0.82em;
    font-weight: 700;
    color: var(--primary-contrast);
    text-align: right;
    white-space: nowrap;
  }

  /* ── BILL TO: full-width section below header ── */
  .bill-to {
    margin-bottom: 2rem;
    padding-bottom: 1.4rem;
    border-bottom: 1px solid #ebebeb;
  }
  .bill-to-label {
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #aaa;
    margin-bottom: 6px;
  }
  .client-name {
    font-size: 1.15em;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 3px;
  }
  .client-sub { font-size: 0.86em; color: #555; line-height: var(--line-height); }

  /* ── ITEMS TABLE ── */
  .items-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    overflow-wrap: break-word;
    margin-bottom: 4px;
  }
  .items-table thead { background: var(--secondary); text-align: left; }
  .items-table thead th { padding: 11px 12px; color: var(--secondary-contrast); font-weight: 600; font-size: 0.82em; }
  .items-table thead th:first-child { border-top-left-radius: 8px; }
  .items-table thead th.right-th { text-align: right; }
  .items-table thead th.right-radius { text-align: right; border-top-right-radius: 8px; }
  .items-table tbody td {
    padding: 11px 12px;
    font-size: 0.86em;
    color: #444;
    vertical-align: top;
    background: #f8f8f8;
    border-bottom: 1px solid #efefef;
  }
  .items-table tbody td.right-td { text-align: right; font-variant-numeric: tabular-nums; }

  /* ── TABLE TOTALS ── */
  #table-totals {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    padding-bottom: 0.8rem;
  }
  .totals-right { display: flex; flex-direction: column; }
  .t-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    font-size: 0.86em;
    color: #555;
    border-bottom: 1px solid #f0f0f0;
  }
  .t-row:last-of-type { border-bottom: none; }
  .t-row .lbl { color: #777; }
  .t-row .amt { font-variant-numeric: tabular-nums; }
  .t-row.sep { font-weight: 700; color: #222; }
  .t-row.sep .lbl { color: #222; }
  .t-row.discount .amt { color: #dc2626; }
  .t-row.paid-row .amt { color: #16a34a; }

  .balance-due-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    background: var(--secondary);
    color: var(--secondary-contrast);
    font-weight: 700;
    font-size: 0.92em;
    padding: 11px 14px;
    border-radius: 8px;
    font-variant-numeric: tabular-nums;
  }
  .balance-due-row.paid { background: #16a34a; }

  body.ink-saver {
    --primary: #f3f4f6;
    --secondary: #e5e7eb;
    --primary-contrast: #0f172a;
    --primary-contrast-soft: #475569;
    --secondary-contrast: #0f172a;
  }
  body.ink-saver .doc-title,
  body.ink-saver .client-name { color: #334155; }
  body.ink-saver #entity-details { box-shadow: inset 0 0 0 1px #cbd5e1; }
  body.ink-saver .balance-due-row {
    border: 1px solid #cbd5e1;
    box-shadow: none;
  }
  body.ink-saver .balance-due-row.paid {
    background: var(--secondary);
    color: var(--secondary-contrast);
  }

  /* ── NOTES ── */
  .notes-left { font-size: 0.82em; line-height: var(--line-height); }
  .notes-label { font-weight: bold; color: #dc2626; font-style: italic; }
  .notes-text  { color: #dc2626; font-style: italic; font-weight: 500; }

  /* ── PAYMENT HISTORY ── */
  .history-section { padding-top: 12px; border-top: 1px solid #ebebeb; margin-top: 8px; }
  .section-label { font-size: 0.72em; font-weight: 700; letter-spacing: 0.1em; color: #888; text-transform: uppercase; margin-bottom: 8px; }
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
  .sig-section { display: flex; justify-content: space-between; gap: 48px; padding-top: 24px; border-top: 1px solid #ccc; margin-top: 12px; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1.5px solid #333; height: 32px; margin-bottom: 6px; }
  .sig-label { font-size: 0.88em; color: #333; font-weight: 700; }

  /* ── CHEQUES + CREDIT ── */
  .cheques-section { padding-top: 10px; border-top: 1px solid #ebebeb; margin-top: 8px; font-size: 0.82em; color: #dc2626; line-height: 1.5; }
  .cheques-section strong { color: #dc2626; }
  .credit-terms { margin-top: 3px; color: #dc2626; }

  /* ── FOOTER ── */
  #footer { margin-top: 30px; font-size: 0.72em; color: #aaa; text-align: center; }

  /* ── PRINT BAR (screen only) ── */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #1e293b; color: white; display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .print-bar span { opacity: 0.7; font-size: 12px; }
  .print-actions { display: flex; align-items: center; gap: 10px; }
  .print-btn { background: white; color: #1e293b; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .print-btn:hover { background: #f1f5f9; }
  .print-btn-toggle {
    background: transparent;
    color: white;
    border: 1px solid rgba(255,255,255,0.24);
  }
  .print-btn-toggle:hover { background: rgba(255,255,255,0.08); }
  .print-btn-toggle.is-active {
    background: #e2e8f0;
    color: #0f172a;
    border-color: #e2e8f0;
  }

  @media print {
    @page { margin: 0; size: auto; }
    body { background: white; padding: 15mm; }
    .wrapper { margin: 0; max-width: 100%; box-shadow: none; padding: 0; }
    .print-bar { display: none; }
    /* Tighten section gaps so short invoices fit on one page */
    .header { margin-bottom: 1rem; }
    .doc-title { font-size: 2em; margin-bottom: 8px; }
    #entity-details tr:first-child th,
    #entity-details tr:first-child td { padding-top: 10px; }
    #entity-details tr:last-child th,
    #entity-details tr:last-child td { padding-bottom: 10px; }
    #entity-details th, #entity-details td { padding-top: 3px; padding-bottom: 3px; }
    .bill-to { margin-bottom: 0.9rem; padding-bottom: 0.7rem; }
    .items-table thead th { padding: 8px 10px; }
    .items-table tbody td { padding: 8px 10px; }
    #table-totals { padding-top: 4px; padding-bottom: 4px; }
    .t-row { padding: 3px 0; }
    .balance-due-row { padding: 9px 12px; margin-top: 6px; }
    .sig-section { padding-top: 12px; margin-top: 6px; }
    #footer { margin-top: 14px; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <span>Bettencourt's POS — Document Preview</span>
  <div class="print-actions">
    <button id="ink-saver-toggle" class="print-btn print-btn-toggle" type="button" aria-pressed="false" onclick="toggleInkSaver()">Ink Saver: Off</button>
    <button class="print-btn" type="button" onclick="window.print()">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
      Print / Save as PDF
    </button>
  </div>
</div>

<div class="wrapper">

  <!-- HEADER: logo+company LEFT | INVOICE title + entity box RIGHT -->
  <div class="header">
    <div>
      ${logoHtml}
      <div class="company-name">${escHtml(companyName)}</div>
      <div class="company-sub">
        Georgetown, Guyana<br>
        ${settings.companyTin ? `TIN: ${escHtml(settings.companyTin)}` : ""}
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">INVOICE</div>
      <table id="entity-details" cellspacing="0">
        <tr><th>Invoice #</th><td>${escHtml(invoice.invoiceNumber)}</td></tr>
        <tr><th>Invoice Date</th><td>${issuedStr}</td></tr>
        ${dueStr ? `<tr><th>Due Date</th><td>${dueStr}</td></tr>` : ""}
        <tr><th>Terms</th><td>${escHtml(TERMS_LABEL[invoice.paymentTerms ?? "due_on_receipt"] ?? invoice.paymentTerms ?? "Due on Receipt")}</td></tr>
        <tr><th>Invoice Total</th><td>${fmtGYD(total)}</td></tr>
        <tr><th>Balance Due</th><td>${fmtGYD(Math.max(balance, 0))}</td></tr>
      </table>
    </div>
  </div>

  <!-- BILL TO -->
  <div class="bill-to">
    <div class="bill-to-label">Bill To</div>
    <div class="client-name">${clientPrimaryName}</div>
    ${clientSubLines ? `<div class="client-sub">${clientSubLines}</div>` : ""}
    ${invoice.preparedBy ? `<p style="margin-top:8px;font-size:0.82em;color:#888">Prepared by: ${escHtml(invoice.preparedBy)}</p>` : ""}
  </div>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Item / Description</th>
        <th class="right-th" style="width:52px">Qty</th>
        <th class="right-th" style="width:106px">Unit Cost</th>
        ${taxColHeader}
        <th class="right-radius" style="width:116px">Line Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TABLE TOTALS: Amounts right-aligned -->
  <div id="table-totals">
    <div class="totals-right">
      <div class="t-row"><span class="lbl">Subtotal</span><span class="amt">${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="t-row discount"><span class="lbl">Discount${invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span class="amt">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="t-row"><span class="lbl">Tax</span><span class="amt">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="t-row sep"><span class="lbl">Total</span><span class="amt">${fmtGYD(total)}</span></div>
      ${paid > 0 ? `<div class="t-row paid-row"><span class="lbl">Amount Paid</span><span class="amt">-${fmtGYD(paid)}</span></div>` : ""}
      <div class="balance-due-row${isFullyPaid ? " paid" : ""}">
        <span>Balance Due</span>
        <span>${fmtGYD(Math.max(balance, 0))}</span>
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

  ${notesBlock}

  <!-- CHEQUES + CREDIT TERMS -->
  <div class="cheques-section">
    <div>All cheques are to be made payable to: <strong>${escHtml(companyName)}</strong></div>
    <div class="credit-terms">Credit period: All invoices are due 30 days from date of issue &nbsp;&bull;&nbsp; 10% service charge will be applied to balance due for late payments.</div>
  </div>

  <div id="footer">
    ${escHtml(companyName)}${settings.invoiceFooterNote ? ` &nbsp;&bull;&nbsp; ${escHtml(settings.invoiceFooterNote)}` : ""}
  </div>

</div>

<script>
  function toggleInkSaver(){const active=document.body.classList.toggle("ink-saver"),button=document.getElementById("ink-saver-toggle");if(button){button.textContent=active?"Ink Saver: On":"Ink Saver: Off";button.setAttribute("aria-pressed",String(active));button.classList.toggle("is-active",active);}}
  // Replace the blob:// URL with a clean path before the browser shows it
  // in the address bar or print footer. Running inside the document itself
  // avoids cross-origin restrictions from the parent window.
  try { history.replaceState({}, document.title, "/invoice-preview"); } catch (e) {}
</script>
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
