// ── Quotation PDF Builder ───────────────────────────────────────────────
// Generates a professional Blob URL HTML document for quotation printing.
// Includes QUOTATION stamp badge, T&C section, and signature blocks.

export type QuotationPdfRow = {
	quotationNumber: string;
	customerName: string;
	customerAddress?: string | null;
	customerPhone?: string | null;
	createdAt: string;
	validUntil?: string | null;
	status: string;
	items: unknown;
	subtotal: string | number;
	taxTotal: string | number;
	total: string | number;
	discountType?: string | null;
	discountValue?: string | null;
	taxMode?: string | null;
	taxRate?: string | null;
	termsAndConditions?: string | null;
	notes?: string | null;
	preparedBy?: string | null;
	parentQuotationId?: string | null;
};

export type QuotationDocSettings = {
	companyTin?: string | null;
	quotationFooterNote?: string | null;
	defaultQuotationTerms?: string | null;
};

type LineItem = {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
	taxExempt?: boolean;
};

export async function openQuotationPdf(
	quotation: QuotationPdfRow,
	settings: QuotationDocSettings = {},
) {
	// Open window synchronously (inside user-gesture context) before any await.
	// Browsers block window.open() called after an await as an untrusted popup.
	const win = window.open("about:blank", "_blank");
	if (!win) return "popup_blocked";
	const logoBase64 = await fetchLogoBase64();
	const html = buildQuotationHtml(quotation, settings, logoBase64);
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	if (!win) return "popup_blocked";
	win.location.href = url;
	setTimeout(() => URL.revokeObjectURL(url), 15_000);
	return "ok";
}

async function fetchLogoBase64(): Promise<string> {
	try {
		const resp = await fetch("/images/bettencourts-logo.png");
		const buf = await resp.arrayBuffer();
		const b64 = (() => {
		const bytes = new Uint8Array(buf);
		let binary = "";
		for (let i = 0; i < bytes.length; i += 8192)
			binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
		return btoa(binary);
	})();
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

function buildQuotationHtml(
	quot: QuotationPdfRow,
	settings: QuotationDocSettings,
	logo: string,
): string {
	const items = Array.isArray(quot.items) ? (quot.items as LineItem[]) : [];
	const subtotal = Number(quot.subtotal);
	const discountAmt =
		quot.discountType === "percent"
			? (subtotal * Number(quot.discountValue ?? 0)) / 100
			: Number(quot.discountValue ?? 0);
	const taxAmt = Number(quot.taxTotal);
	const total = Number(quot.total);

	const createdStr = new Date(quot.createdAt).toLocaleDateString("en-GY");
	const validStr = quot.validUntil
		? new Date(quot.validUntil).toLocaleDateString("en-GY")
		: null;

	// Validity countdown
	let validityNote = "";
	if (quot.validUntil) {
		const days = Math.ceil(
			(new Date(quot.validUntil).getTime() - Date.now()) / 86_400_000,
		);
		validityNote =
			days > 0
				? `Valid for ${days} more day${days !== 1 ? "s" : ""}`
				: "This quotation has expired";
	}

	const logoHtml = logo
		? `<img src="${logo}" class="logo" alt="Bettencourt's Logo" />`
		: "";

	const taxColHeader =
		quot.taxMode === "line" ? "<th class='right'>Tax</th>" : "";

	const itemRows = items
		.map(
			(item) => `
    <tr>
      <td>${escHtml(item.description)}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${fmtGYD(item.unitPrice)}</td>
      ${quot.taxMode === "line" ? `<td class="right">${item.taxExempt ? "Exempt" : `${quot.taxRate ?? "16.5"}%`}</td>` : ""}
      <td class="right">${fmtGYD(item.total)}</td>
    </tr>`,
		)
		.join("");

	const termsContent =
		quot.termsAndConditions || settings.defaultQuotationTerms;

	const tcBlock = termsContent
		? `
    <div class="tc-section">
      <div class="section-label">Terms &amp; Conditions</div>
      <div class="tc-text">${escHtml(termsContent)}</div>
    </div>`
		: "";

	const isRevision = quot.parentQuotationId != null;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(quot.quotationNumber)} — Bettencourt's Food Inc.</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; }
  .wrapper { max-width: 794px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; }

  .header { background: #1e293b; color: white; padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .logo-area { display: flex; align-items: center; gap: 16px; }
  .logo { height: 56px; width: auto; border-radius: 6px; }
  .company-name { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
  .company-sub { font-size: 11px; opacity: 0.7; margin-top: 3px; line-height: 1.5; }

  /* Quotation stamp badge */
  .stamp-badge { border: 2.5px solid rgba(255,255,255,0.8); border-radius: 6px; padding: 6px 16px; display: inline-block; text-align: center; }
  .stamp-text { font-size: 22px; font-weight: 800; letter-spacing: 0.18em; }
  .doc-number { font-family: 'Courier New', monospace; font-size: 13px; margin-top: 6px; opacity: 0.85; text-align: right; }
  .doc-meta { font-size: 11px; margin-top: 3px; opacity: 0.7; text-align: right; }
  .revision-badge { display: inline-block; background: #f59e0b22; color: #f59e0b; border: 1px solid #f59e0b55; border-radius: 99px; padding: 2px 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; margin-top: 6px; }

  .bill-to-section { padding: 24px 36px; display: flex; gap: 48px; border-bottom: 1px solid #e2e8f0; }
  .bill-col { flex: 1; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
  .customer-name { font-size: 14px; font-weight: 600; }
  .customer-sub { font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.5; }
  .validity-note { font-size: 11px; color: #0ea5e9; font-weight: 600; margin-top: 4px; }
  .validity-expired { color: #dc2626; }

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
  .totals-row .amount { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
  .totals-row.separator { border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
  .totals-row.grand { font-size: 15px; font-weight: 800; color: #1e293b; }
  .totals-row.discount .amount { color: #dc2626; }

  .tc-section { padding: 18px 36px; border-top: 1px solid #e2e8f0; }
  .tc-text { font-size: 11px; color: #475569; margin-top: 8px; line-height: 1.7; white-space: pre-wrap; }

  .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding: 36px 36px 28px; border-top: 1px solid #e2e8f0; }
  .sig-box {}
  .sig-line { border-bottom: 1.5px solid #334155; padding-bottom: 44px; margin-bottom: 10px; }
  .sig-label { font-size: 10px; color: #64748b; line-height: 1.5; }
  .sig-label strong { color: #1e293b; display: block; margin-bottom: 2px; }

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
  <!-- Dark header band with stamp -->
  <div class="header">
    <div class="logo-area">
      ${logoHtml}
      <div>
        <div class="company-name">Bettencourt's Food Inc.</div>
        <div class="company-sub">Georgetown, Guyana${settings.companyTin ? `<br>TIN: ${escHtml(settings.companyTin)}` : ""}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="stamp-badge">
        <div class="stamp-text">QUOTATION</div>
      </div>
      <div class="doc-number">${escHtml(quot.quotationNumber)}</div>
      <div class="doc-meta">Date: ${createdStr}</div>
      ${validStr ? `<div class="doc-meta">Valid Until: ${validStr}</div>` : ""}
      ${isRevision ? `<div style="text-align:right"><span class="revision-badge">REVISION</span></div>` : ""}
    </div>
  </div>

  <!-- Bill To / Quote Details -->
  <div class="bill-to-section">
    <div class="bill-col">
      <div class="section-label">Prepared For</div>
      <div class="customer-name">${escHtml(quot.customerName)}</div>
      ${quot.customerPhone ? `<div class="customer-sub">${escHtml(quot.customerPhone)}</div>` : ""}
      ${quot.customerAddress ? `<div class="customer-sub">${escHtml(quot.customerAddress)}</div>` : ""}
    </div>
    <div class="bill-col">
      ${validityNote ? `<div class="section-label">Validity</div><div class="validity-note${validityNote.includes("expired") ? " validity-expired" : ""}">${escHtml(validityNote)}</div>` : ""}
      ${quot.preparedBy ? `<div class="section-label" style="margin-top:12px">Prepared By</div><div class="customer-name">${escHtml(quot.preparedBy)}</div>` : ""}
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
        <th class="right" style="width:120px">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <div class="totals-table">
      <div class="totals-row"><span class="label">Subtotal</span><span class="amount">${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="totals-row discount"><span class="label">Discount${quot.discountType === "percent" ? ` (${quot.discountValue}%)` : ""}</span><span class="amount">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="totals-row"><span class="label">VAT (${quot.taxRate ?? "16.5"}%)</span><span class="amount">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="totals-row separator grand"><span class="label">Quotation Total</span><span class="amount">${fmtGYD(total)}</span></div>
    </div>
  </div>

  ${tcBlock}

  ${quot.notes ? `<div class="notes-section"><strong>Notes:</strong> ${escHtml(quot.notes)}</div>` : ""}

  <!-- Signature Section -->
  <div class="sig-section">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">
        <strong>Authorized By</strong>
        Bettencourt's Food Inc. &nbsp;·&nbsp; Date: _______________
      </div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">
        <strong>Accepted By</strong>
        Customer Signature &nbsp;·&nbsp; Date: _______________
      </div>
    </div>
  </div>

  <div class="footer">
    Bettencourt's Food Inc. &nbsp;&bull;&nbsp; This is a quotation only — not a tax invoice
    ${settings.quotationFooterNote ? ` &nbsp;&bull;&nbsp; ${escHtml(settings.quotationFooterNote)}` : ""}
    <br>Generated ${new Date().toLocaleString("en-GY")}
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
