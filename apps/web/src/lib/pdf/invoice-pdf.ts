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
  .wrapper { max-width: 794px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; }

  .header { background: #1e293b; color: white; padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .logo-area { display: flex; align-items: center; gap: 16px; }
  .logo { height: 56px; width: auto; border-radius: 6px; }
  .company-name { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
  .company-sub { font-size: 11px; opacity: 0.7; margin-top: 3px; line-height: 1.5; }
  .doc-type { font-size: 28px; font-weight: 800; letter-spacing: 0.12em; text-align: right; }
  .doc-number { font-family: 'Courier New', monospace; font-size: 13px; margin-top: 5px; opacity: 0.85; text-align: right; }
  .doc-meta { font-size: 11px; margin-top: 3px; opacity: 0.7; text-align: right; }
  .status-pill { display: inline-block; background: ${statusBadgeColor}22; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeColor}44; border-radius: 99px; padding: 2px 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 6px; }

  .bill-to-section { padding: 24px 36px; display: flex; gap: 48px; border-bottom: 1px solid #e2e8f0; }
  .bill-col { flex: 1; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
  .customer-name { font-size: 14px; font-weight: 600; }
  .customer-sub { font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.5; }

  .items-table { width: 100%; border-collapse: collapse; }
  .items-table thead tr { background: #f8fafc; }
  .items-table th { padding: 10px 16px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; text-align: left; white-space: nowrap; }
  .items-table th.right { text-align: right; }
  .items-table td { padding: 11px 16px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #334155; }
  .items-table td.right { text-align: right; font-variant-numeric: tabular-nums; font-family: 'Courier New', monospace; }
  .items-table tbody tr:hover { background: #f8fafc; }
  .items-table tbody tr:last-child td { border-bottom: none; }

  .totals-section { padding: 20px 36px; display: flex; justify-content: flex-end; border-top: 2px solid #e2e8f0; }
  .totals-table { min-width: 300px; }
  .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 12px; color: #475569; }
  .totals-row .label { }
  .totals-row .amount { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
  .totals-row.separator { border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
  .totals-row.grand { font-size: 14px; font-weight: 700; color: #1e293b; }
  .totals-row.balance { font-size: 16px; font-weight: 800; color: #dc2626; margin-top: 4px; padding-top: 8px; border-top: 2px solid #e2e8f0; }
  .totals-row.balance.paid { color: #16a34a; }
  .totals-row.discount .amount { color: #dc2626; }

  .payment-section { padding: 18px 36px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  .payment-title { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #475569; text-transform: uppercase; margin-bottom: 10px; }
  .payment-detail { font-size: 11px; color: #334155; margin-top: 3px; }

  .history-section { padding: 16px 36px; border-top: 1px solid #e2e8f0; }
  .history-title { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #475569; text-transform: uppercase; margin-bottom: 10px; }
  .history-table { width: 100%; border-collapse: collapse; }
  .history-table th { padding: 6px 10px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; text-align: left; }
  .history-table th.right { text-align: right; }
  .history-table td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .history-table td.right { text-align: right; font-family: 'Courier New', monospace; }
  .history-table td.reversal { color: #dc2626; font-style: italic; }

  .notes-section { padding: 16px 36px; font-size: 12px; color: #475569; border-top: 1px solid #e2e8f0; line-height: 1.6; }
  .notes-section strong { color: #1e293b; }

  .footer { padding: 14px 36px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; background: #f8fafc; }

  .print-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #1e293b; color: white; display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .print-bar span { opacity: 0.7; font-size: 12px; }
  .print-btn { background: white; color: #1e293b; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .print-btn:hover { background: #f1f5f9; }
  @media print {
    @page { margin: 0; size: A4; }
    body { background: white; }
    .wrapper { margin: 0; box-shadow: none; border-radius: 0; }
    .print-bar { display: none; }
    body { padding-top: 0; }
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
  <!-- Dark header band -->
  <div class="header">
    <div class="logo-area">
      ${logoHtml}
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-sub">Georgetown, Guyana${companyTagline ? `<br>${companyTagline}` : ""}${settings.companyTin ? `<br>TIN: ${escHtml(settings.companyTin)}` : ""}</div>
      </div>
    </div>
    <div>
      <div class="doc-type">INVOICE</div>
      <div class="doc-number">${escHtml(invoice.invoiceNumber)}</div>
      <div class="doc-meta">Issued: ${issuedStr}</div>
      ${dueStr ? `<div class="doc-meta">Due: ${dueStr}</div>` : ""}
      <div class="doc-meta">Terms: ${escHtml(TERMS_LABEL[invoice.paymentTerms ?? "due_on_receipt"] ?? invoice.paymentTerms ?? "Due on Receipt")}</div>
      <div style="text-align:right"><span class="status-pill">${escHtml(invoice.status.toUpperCase())}</span></div>
    </div>
  </div>

  <!-- Bill To / Invoice Details -->
  <div class="bill-to-section">
    <div class="bill-col">
      <div class="section-label">Bill To</div>
      ${invoice.agencyName
        ? `<div class="customer-name">${escHtml(invoice.agencyName)}</div><div class="customer-sub">${escHtml(invoice.customerName)}</div>`
        : `<div class="customer-name">${escHtml(invoice.customerName)}</div>`}
      ${invoice.contactPersonPosition ? `<div class="customer-sub">${escHtml(invoice.contactPersonPosition)}</div>` : ""}
      ${invoice.customerPhone ? `<div class="customer-sub">${escHtml(invoice.customerPhone)}</div>` : ""}
      ${invoice.customerAddress ? `<div class="customer-sub">${escHtml(invoice.customerAddress)}</div>` : ""}
    </div>
    <div class="bill-col">
      ${invoice.contactPersonName ? `<div class="section-label">Order Placed By</div><div class="customer-name">${escHtml(invoice.contactPersonName)}</div>` : ""}
      ${invoice.preparedBy ? `<div class="section-label" style="margin-top:${invoice.contactPersonName ? "12px" : "0"}">Prepared By</div><div class="customer-name">${escHtml(invoice.preparedBy)}</div>` : ""}
    </div>
  </div>

  <!-- Line Items -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right" style="width:60px">Qty</th>
        <th class="right" style="width:110px">Unit Price</th>
        ${taxColHeader}
        <th class="right" style="width:120px">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <div class="totals-table">
      <div class="totals-row"><span class="label">Subtotal</span><span class="amount">${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="totals-row discount"><span class="label">Discount${invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span class="amount">-${fmtGYD(discountAmt)}</span></div>` : ""}
      <div class="totals-row separator grand"><span class="label">Total</span><span class="amount">${fmtGYD(total)}</span></div>
      ${paid > 0 ? `<div class="totals-row"><span class="label" style="color:#16a34a">Amount Paid</span><span class="amount" style="color:#16a34a">-${fmtGYD(paid)}</span></div>` : ""}
      <div class="totals-row balance${isFullyPaid ? " paid" : ""}">
        <span class="label">Balance Due</span>
        <span class="amount">${fmtGYD(Math.max(balance, 0))}</span>
      </div>
    </div>
  </div>

  ${paymentHistoryBlock}

  ${paymentBlock}

  ${invoice.notes ? `<div class="notes-section"><strong>Notes:</strong> ${escHtml(invoice.notes)}</div>` : ""}

  <div class="footer">
    Bettencourt's Food Inc. &nbsp;&bull;&nbsp; Thank you for your business
    ${settings.invoiceFooterNote ? ` &nbsp;&bull;&nbsp; ${escHtml(settings.invoiceFooterNote)}` : ""}
    <br>Generated ${new Date().toLocaleString("en-GY")}
    ${invoice.preparedBy ? ` &nbsp;&bull;&nbsp; Prepared by: ${escHtml(invoice.preparedBy)}` : ""}
  </div>
</div>
</body>
</html>`;
}

function escHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
