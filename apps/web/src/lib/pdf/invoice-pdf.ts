// ── Invoice PDF Builder ─────────────────────────────────────────────────
// Generates a professional Blob URL HTML document for invoice printing.
// Opens in a new tab — does NOT use window.print() on the current page.

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
	const companyTagline = isHomeStyle ? "" : "A true Guyanese Gem";

	const issuedStr = invoice.issuedDate
		? new Date(invoice.issuedDate).toLocaleDateString("en-GY")
		: new Date(invoice.createdAt).toLocaleDateString("en-GY");
	const dueStr = invoice.dueDate
		? new Date(invoice.dueDate).toLocaleDateString("en-GY")
		: null;

	const logoHtml = logo
		? `<img src="${logo}" class="logo" alt="Bettencourt's Logo" />`
		: "";

	const taxColHeader =
		invoice.taxMode === "line" ? "<th class='right'>Tax</th>" : "";

	const itemRows = items
		.map(
			(item) => `
    <tr>
      <td>${escHtml(item.description)}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${fmtGYD(item.unitPrice)}</td>
      ${invoice.taxMode === "line" ? `<td class="right">${item.taxExempt ? "Exempt" : `${invoice.taxRate ?? "14"}%`}</td>` : ""}
      <td class="right">${fmtGYD(item.total)}</td>
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
    <div class="history-title">Payment History</div>
    <table class="history-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Method</th>
          <th>Reference</th>
          <th class="right">Amount</th>
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
          <td class="right${p.isReversal ? " reversal" : ""}">${p.isReversal ? "-" : ""}${fmtGYD(Math.abs(Number(p.amount)))}</td>
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
      <div class="payment-title">Payment Instructions</div>
      ${settings.bankName ? `<div class="payment-detail"><strong>Bank:</strong> ${escHtml(settings.bankName)}${settings.bankBranch ? ` (${escHtml(settings.bankBranch)})` : ""}</div>` : ""}
      ${settings.bankAccount ? `<div class="payment-detail"><strong>Account:</strong> ${escHtml(settings.bankAccount)}</div>` : ""}
      <div class="payment-detail"><strong>Reference:</strong> ${escHtml(invoice.invoiceNumber)}</div>
      ${settings.paymentInstructions ? `<div class="payment-detail" style="margin-top:6px">${escHtml(settings.paymentInstructions)}</div>` : ""}
    </div>`
			: "";

	const statusBadgeColor =
		invoice.status === "paid"
			? "#16a34a"
			: invoice.status === "cancelled"
				? "#94a3b8"
				: invoice.status === "overdue"
					? "#dc2626"
					: "#0ea5e9";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(invoice.invoiceNumber)} — ${companyName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { padding-top: 52px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; }
  .wrapper { max-width: 794px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; border-top: 8px solid #b8862d; }

  /* TOP HEADER: 3-column grid */
  .top-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 20px; padding: 28px 36px; border-bottom: 2px solid #b8862d; }
  .logo-col .logo { height: 64px; width: auto; border-radius: 4px; }
  .co-info { text-align: center; }
  .co-name { font-size: 16px; font-weight: 700; color: #1e293b; }
  .co-sub { font-size: 10.5px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .doc-col { text-align: right; }
  .doc-type { font-size: 28px; font-weight: 800; letter-spacing: 0.12em; color: #b8862d; }
  .doc-number { font-family: 'Courier New', monospace; font-size: 12px; margin-top: 4px; color: #475569; }
  .doc-terms { font-size: 10.5px; color: #64748b; margin-top: 3px; }

  /* BILL-TO + META BOX row */
  .bill-meta { display: grid; grid-template-columns: 1fr auto; gap: 32px; padding: 22px 36px; border-bottom: 1px solid #e2e8f0; align-items: start; }
  .bill-to .bill-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
  .bill-to .cust-name { font-size: 14px; font-weight: 600; color: #1e293b; }
  .bill-to .cust-sub { font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.5; }
  .bill-to .prepared-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-top: 12px; margin-bottom: 4px; }

  .meta-box { background: #b8862d; border-radius: 6px; min-width: 240px; overflow: hidden; }
  .meta-box table { width: 100%; border-collapse: collapse; }
  .meta-box td { padding: 7px 12px; font-size: 11px; color: white; }
  .meta-box td:last-child { text-align: right; font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
  .meta-box tr + tr td { border-top: 1px solid rgba(255,255,255,0.15); }
  .meta-box .balance-row td { background: rgba(0,0,0,0.2); font-size: 14px; font-weight: 800; }
  .meta-box .status-row td { background: rgba(0,0,0,0.12); font-size: 10px; letter-spacing: 0.08em; }

  /* ITEMS TABLE */
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table thead tr { background: #b8862d; }
  .items-table th { padding: 10px 16px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: white; text-transform: uppercase; text-align: left; white-space: nowrap; }
  .items-table th.right { text-align: right; }
  .items-table td { padding: 11px 16px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #334155; }
  .items-table td.right { text-align: right; font-variant-numeric: tabular-nums; font-family: 'Courier New', monospace; }
  .items-table tbody tr:nth-child(even) { background: #fafaf9; }
  .items-table tbody tr:last-child td { border-bottom: none; }

  /* TOTALS */
  .totals-wrapper { padding: 20px 36px; display: flex; justify-content: flex-end; border-top: 2px solid #e2e8f0; }
  .totals-table { min-width: 300px; }
  .total-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 12px; color: #475569; }
  .total-row .amt { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
  .total-row.sep { border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 12px; font-size: 14px; font-weight: 700; color: #1e293b; }
  .total-row.discount .amt { color: #dc2626; }
  .total-row.paid-row .amt { color: #16a34a; }
  .total-row.balance { background: #b8862d; color: white; padding: 9px 12px; border-radius: 4px; margin-top: 6px; font-size: 14px; font-weight: 800; }
  .total-row.balance .amt { color: white; font-family: 'Courier New', monospace; }
  .total-row.balance.paid { background: #16a34a; }

  /* PAYMENT HISTORY */
  .history-section { padding: 16px 36px; border-top: 1px solid #e2e8f0; }
  .history-title { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #475569; text-transform: uppercase; margin-bottom: 10px; }
  .history-table { width: 100%; border-collapse: collapse; }
  .history-table th { padding: 6px 10px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; text-align: left; }
  .history-table th.right { text-align: right; }
  .history-table td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .history-table td.right { text-align: right; font-family: 'Courier New', monospace; }
  .history-table td.reversal { color: #dc2626; font-style: italic; }

  /* PAYMENT INSTRUCTIONS */
  .payment-section { padding: 18px 36px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  .payment-title { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #475569; text-transform: uppercase; margin-bottom: 10px; }
  .payment-detail { font-size: 11px; color: #334155; margin-top: 3px; }

  /* NOTES */
  .notes-section { padding: 16px 36px; font-size: 12px; border-top: 1px solid #e2e8f0; line-height: 1.6; }
  .notes-section .notes-label { font-weight: 700; color: #dc2626; font-style: italic; }
  .notes-section .notes-text { color: #dc2626; font-style: italic; font-weight: 500; }

  /* SIGNATURES */
  .sig-section { display: flex; justify-content: space-between; gap: 48px; padding: 24px 36px; border-top: 1px solid #e2e8f0; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1px solid #334155; margin-bottom: 6px; height: 32px; }
  .sig-label { font-size: 11px; color: #475569; font-weight: 600; }

  /* CHEQUES + CREDIT */
  .cheques-section { padding: 10px 36px 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #334155; }
  .cheques-section strong { color: #1e293b; }
  .credit-terms { font-size: 10px; color: #64748b; margin-top: 4px; }

  /* FOOTER */
  .footer { padding: 10px 36px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; }

  /* PRINT BAR */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #1e293b; color: white; display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .print-bar span { opacity: 0.7; font-size: 12px; }
  .print-btn { background: white; color: #1e293b; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .print-btn:hover { background: #f1f5f9; }

  @media print {
    @page { margin: 15mm; size: A4; }
    body { background: white; padding-top: 0; }
    .wrapper { margin: 0; max-width: 100%; box-shadow: none; border-radius: 0; }
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

  <!-- TOP HEADER: Logo | Company Info | INVOICE -->
  <div class="top-header">
    <div class="logo-col">${logoHtml}</div>
    <div class="co-info">
      <div class="co-name">${escHtml(companyName)}</div>
      <div class="co-sub">Georgetown, Guyana${settings.companyTin ? `<br>TIN: ${escHtml(settings.companyTin)}` : ""}</div>
    </div>
    <div class="doc-col">
      <div class="doc-type">INVOICE</div>
      <div class="doc-number">${escHtml(invoice.invoiceNumber)}</div>
      <div class="doc-terms">Terms: ${escHtml(TERMS_LABEL[invoice.paymentTerms ?? "due_on_receipt"] ?? invoice.paymentTerms ?? "Due on Receipt")}</div>
    </div>
  </div>

  <!-- BILL-TO + META BOX -->
  <div class="bill-meta">
    <div class="bill-to">
      <div class="bill-label">Invoice issued to:</div>
      ${invoice.agencyName
        ? `<div class="cust-name">${escHtml(invoice.agencyName)}</div><div class="cust-sub">${escHtml(invoice.customerName)}</div>`
        : `<div class="cust-name">${escHtml(invoice.customerName)}</div>`}
      ${invoice.contactPersonName ? `<div class="cust-sub">${escHtml(invoice.contactPersonName)}${invoice.contactPersonPosition ? `, ${escHtml(invoice.contactPersonPosition)}` : ""}</div>` : invoice.contactPersonPosition ? `<div class="cust-sub">${escHtml(invoice.contactPersonPosition)}</div>` : ""}
      ${invoice.customerPhone ? `<div class="cust-sub">${escHtml(invoice.customerPhone)}</div>` : ""}
      ${invoice.customerAddress ? `<div class="cust-sub">${escHtml(invoice.customerAddress)}</div>` : ""}
      ${invoice.preparedBy ? `<div class="prepared-label">Prepared By</div><div class="cust-sub">${escHtml(invoice.preparedBy)}</div>` : ""}
    </div>
    <div class="meta-box">
      <table>
        <tr><td>Invoice Number</td><td>${escHtml(invoice.invoiceNumber)}</td></tr>
        <tr><td>Invoice Date</td><td>${issuedStr}</td></tr>
        ${dueStr ? `<tr><td>Due Date</td><td>${dueStr}</td></tr>` : ""}
        <tr><td>Invoice Total</td><td>${fmtGYD(total)}</td></tr>
        <tr class="balance-row"><td>Balance Due</td><td>${fmtGYD(Math.max(balance, 0))}</td></tr>
        <tr class="status-row"><td>Status</td><td>${escHtml(invoice.status.toUpperCase())}</td></tr>
      </table>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Item / Description</th>
        <th class="right" style="width:60px">Qty</th>
        <th class="right" style="width:110px">Unit Cost</th>
        ${taxColHeader}
        <th class="right" style="width:120px">Line Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals-wrapper">
    <div class="totals-table">
      <div class="total-row"><span>Subtotal</span><span class="amt">${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="total-row discount"><span>Discount${invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span class="amt">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="total-row"><span>Tax</span><span class="amt">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="total-row sep"><span>Total</span><span class="amt">${fmtGYD(total)}</span></div>
      ${paid > 0 ? `<div class="total-row paid-row"><span>Amount Paid</span><span class="amt">-${fmtGYD(paid)}</span></div>` : ""}
      <div class="total-row balance${isFullyPaid ? " paid" : ""}">
        <span>Balance Due</span><span class="amt">${fmtGYD(Math.max(balance, 0))}</span>
      </div>
    </div>
  </div>

  ${paymentHistoryBlock}

  ${paymentBlock}

  ${invoice.notes ? `<div class="notes-section"><span class="notes-label">Notes:</span> <span class="notes-text">${escHtml(invoice.notes)}</span></div>` : ""}

  <!-- SIGNATURES -->
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Received by</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Authorized by</div>
    </div>
  </div>

  <!-- CHEQUES + CREDIT TERMS -->
  <div class="cheques-section">
    <div>All cheques are to be made payable to: <strong>${escHtml(companyName)}</strong></div>
    <div class="credit-terms">Credit period: All invoices are due 30 days from date of issue &nbsp;&bull;&nbsp; 10% service charge will be applied to balance due for late payments.</div>
  </div>

  <div class="footer">
    ${escHtml(companyName)} &nbsp;&bull;&nbsp; ${settings.invoiceFooterNote ? escHtml(settings.invoiceFooterNote) + " &nbsp;&bull;&nbsp; " : ""}Generated ${new Date().toLocaleString("en-GY")}${invoice.preparedBy ? ` &nbsp;&bull;&nbsp; Prepared by: ${escHtml(invoice.preparedBy)}` : ""}
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
