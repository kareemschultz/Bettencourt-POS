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
	brand?: string | null;
	agencyName?: string | null;
	contactPersonName?: string | null;
	contactPersonPosition?: string | null;
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
	const logoBase64 = await fetchLogoBase64(quotation.brand);
	const html = buildQuotationHtml(quotation, settings, logoBase64);
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	if (!win) return "popup_blocked";
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

	const isHomeStyle = quot.brand === "home_style";
	const companyName = isHomeStyle ? "Bettencourt's Home Style" : "Bettencourt's Food Inc.";
	const companyTagline = isHomeStyle ? "" : "A true Guyanese Gem";

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
<title>${escHtml(quot.quotationNumber)} — ${companyName}</title>
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

  /* QUOTATION stamp badge (gold bordered) */
  .stamp-badge { border: 2.5px solid #b8862d; border-radius: 6px; padding: 6px 14px; display: inline-block; }
  .stamp-text { font-size: 24px; font-weight: 800; letter-spacing: 0.14em; color: #b8862d; }
  .doc-number { font-family: 'Courier New', monospace; font-size: 12px; margin-top: 5px; color: #475569; }
  .doc-terms { font-size: 10.5px; color: #64748b; margin-top: 3px; }
  .revision-badge { display: inline-block; background: #f59e0b22; color: #b45309; border: 1px solid #f59e0b55; border-radius: 99px; padding: 2px 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; margin-top: 6px; }

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
  .meta-box .total-row td { background: rgba(0,0,0,0.2); font-size: 14px; font-weight: 800; }
  .meta-box .status-row td { background: rgba(0,0,0,0.12); font-size: 10px; letter-spacing: 0.08em; }
  .validity-note { font-size: 10.5px; margin-top: 4px; padding: 3px 8px; border-radius: 4px; background: rgba(0,0,0,0.12); color: white; display: inline-block; }

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
  .total-row.grand-total { background: #b8862d; color: white; padding: 9px 12px; border-radius: 4px; margin-top: 6px; font-size: 14px; font-weight: 800; }
  .total-row.grand-total .amt { color: white; font-family: 'Courier New', monospace; }

  /* T&C */
  .tc-section { padding: 18px 36px; border-top: 1px solid #e2e8f0; }
  .tc-label, .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
  .tc-text { font-size: 11px; color: #475569; line-height: 1.7; white-space: pre-wrap; }

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

  <!-- TOP HEADER: Logo | Company Info | QUOTATION stamp -->
  <div class="top-header">
    <div class="logo-col">${logoHtml}</div>
    <div class="co-info">
      <div class="co-name">${escHtml(companyName)}</div>
      <div class="co-sub">Georgetown, Guyana${settings.companyTin ? `<br>TIN: ${escHtml(settings.companyTin)}` : ""}</div>
    </div>
    <div class="doc-col">
      <div class="stamp-badge"><div class="stamp-text">QUOTATION</div></div>
      <div class="doc-number">${escHtml(quot.quotationNumber)}</div>
      ${isRevision ? `<div style="text-align:right;margin-top:4px"><span class="revision-badge">REVISION</span></div>` : ""}
    </div>
  </div>

  <!-- BILL-TO + META BOX -->
  <div class="bill-meta">
    <div class="bill-to">
      <div class="bill-label">Quotation prepared for:</div>
      ${quot.agencyName
        ? `<div class="cust-name">${escHtml(quot.agencyName)}</div><div class="cust-sub">${escHtml(quot.customerName)}</div>`
        : `<div class="cust-name">${escHtml(quot.customerName)}</div>`}
      ${quot.contactPersonName ? `<div class="cust-sub">${escHtml(quot.contactPersonName)}${quot.contactPersonPosition ? `, ${escHtml(quot.contactPersonPosition)}` : ""}</div>` : quot.contactPersonPosition ? `<div class="cust-sub">${escHtml(quot.contactPersonPosition)}</div>` : ""}
      ${quot.customerPhone ? `<div class="cust-sub">${escHtml(quot.customerPhone)}</div>` : ""}
      ${quot.customerAddress ? `<div class="cust-sub">${escHtml(quot.customerAddress)}</div>` : ""}
      ${quot.preparedBy ? `<div class="prepared-label">Prepared By</div><div class="cust-sub">${escHtml(quot.preparedBy)}</div>` : ""}
    </div>
    <div class="meta-box">
      <table>
        <tr><td>Quotation Number</td><td>${escHtml(quot.quotationNumber)}</td></tr>
        <tr><td>Date</td><td>${createdStr}</td></tr>
        ${validStr ? `<tr><td>Valid Until</td><td>${validStr}</td></tr>` : ""}
        <tr class="total-row"><td>Quotation Total</td><td>${fmtGYD(total)}</td></tr>
        <tr class="status-row"><td>Status</td><td>${escHtml(quot.status.toUpperCase())}</td></tr>
      </table>
      ${validityNote ? `<div style="padding:6px 12px 8px"><span class="validity-note">${escHtml(validityNote)}</span></div>` : ""}
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
      ${discountAmt > 0 ? `<div class="total-row discount"><span>Discount${quot.discountType === "percent" ? ` (${quot.discountValue}%)` : ""}</span><span class="amt">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="total-row sep"><span>Tax</span><span class="amt">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="total-row grand-total">
        <span>Quotation Total</span><span class="amt">${fmtGYD(total)}</span>
      </div>
    </div>
  </div>

  ${tcBlock}

  ${quot.notes ? `<div class="notes-section"><span class="notes-label">Notes:</span> <span class="notes-text">${escHtml(quot.notes)}</span></div>` : ""}

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
    <div class="credit-terms">This is a quotation only — not a tax invoice &nbsp;&bull;&nbsp; Credit period: All invoices are due 30 days from date of issue &nbsp;&bull;&nbsp; 10% service charge will be applied to balance due for late payments.</div>
  </div>

  <div class="footer">
    ${escHtml(companyName)}${settings.quotationFooterNote ? ` &nbsp;&bull;&nbsp; ${escHtml(settings.quotationFooterNote)}` : ""} &nbsp;&bull;&nbsp; Generated ${new Date().toLocaleString("en-GY")}${quot.preparedBy ? ` &nbsp;&bull;&nbsp; Prepared by: ${escHtml(quot.preparedBy)}` : ""}
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
