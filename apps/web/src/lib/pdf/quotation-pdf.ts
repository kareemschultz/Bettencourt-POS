// ── Quotation PDF Builder ───────────────────────────────────────────────
// Generates a professional Blob URL HTML document for quotation printing.
// Layout mirrors the Invoice Ninja "Business" template (ID 5):
//   - 3-col header (1fr auto 1fr), grey company details
//   - client-details LEFT (client name in gold at 120%), gold entity-details box RIGHT
//   - Secondary-gold table header with rounded top corners
//   - 2fr/1fr totals grid, secondary-gold quotation total row

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
	const win = window.open("about:blank", "_blank");
	if (!win) return "popup_blocked";
	const logoBase64 = await fetchLogoBase64(quotation.brand);
	const html = buildQuotationHtml(quotation, settings, logoBase64);
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
	const isRevision = quot.parentQuotationId != null;

	const logoHtml = logo
		? `<img class="company-logo" src="${logo}" alt="${escHtml(companyName)} logo">`
		: "";

	const taxColHeader = quot.taxMode === "line" ? "<th>Tax</th>" : "";

	const itemRows = items
		.map(
			(item) => `
    <tr>
      <td>${escHtml(item.description)}</td>
      <td class="right-td">${item.quantity}</td>
      <td class="right-td">${fmtGYD(item.unitPrice)}</td>
      ${quot.taxMode === "line" ? `<td class="right-td">${item.taxExempt ? "Exempt" : `${quot.taxRate ?? "16.5"}%`}</td>` : ""}
      <td class="right-td">${fmtGYD(item.total)}</td>
    </tr>`,
		)
		.join("");

	const termsContent = quot.termsAndConditions || settings.defaultQuotationTerms;
	const tcBlock = termsContent
		? `<div class="tc-section"><div class="section-label">Terms &amp; Conditions</div><div class="tc-text">${escHtml(termsContent)}</div></div>`
		: "";

	const notesBlock = quot.notes
		? `<div class="notes-left"><span class="notes-label">Notes:</span> <span class="notes-text">${escHtml(quot.notes)}</span></div>`
		: "";

	const clientPrimaryName = quot.agencyName
		? escHtml(quot.agencyName)
		: escHtml(quot.customerName);

	const clientSubLines = [
		quot.agencyName ? escHtml(quot.customerName) : null,
		quot.contactPersonName
			? `${escHtml(quot.contactPersonName)}${quot.contactPersonPosition ? `, ${escHtml(quot.contactPersonPosition)}` : ""}`
			: quot.contactPersonPosition ? escHtml(quot.contactPersonPosition) : null,
		quot.customerPhone ? escHtml(quot.customerPhone) : null,
		quot.customerAddress ? escHtml(quot.customerAddress) : null,
	].filter(Boolean).join("<br>");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(quot.quotationNumber)} — ${companyName}</title>
<style>
  :root { --primary: #b8862d; --secondary: #7d5518; --line-height: 1.6; }
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

  /* Quotation badge (above doc-title) */
  .quotation-badge-wrapper { text-align: right; margin-bottom: 8px; }
  .revision-tag {
    display: inline-block;
    background: #f59e0b22;
    color: #b45309;
    border: 1px solid #f59e0b55;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 0.78em;
    font-weight: 700;
    letter-spacing: 0.06em;
    vertical-align: middle;
  }

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
    color: white;
  }
  #entity-details tr:first-child th,
  #entity-details tr:first-child td { padding-top: 14px; }
  #entity-details tr:last-child th,
  #entity-details tr:last-child td { padding-bottom: 14px; }
  #entity-details th {
    font-weight: 400;
    padding: 4px 8px 4px 16px;
    font-size: 0.82em;
    opacity: 0.85;
    white-space: nowrap;
    text-align: left;
  }
  #entity-details td {
    padding: 4px 16px 4px 8px;
    font-size: 0.82em;
    font-weight: 700;
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
  .items-table thead th { padding: 11px 12px; color: white; font-weight: 600; font-size: 0.82em; }
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
    display: grid;
    grid-template-columns: 1fr 220px;
    gap: 40px;
    padding-top: 8px;
    padding-bottom: 0.8rem;
  }
  .totals-left { font-size: 0.82em; color: #666; line-height: var(--line-height); }
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

  .balance-due-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    background: var(--secondary);
    color: white;
    font-weight: 700;
    font-size: 0.92em;
    padding: 11px 14px;
    border-radius: 8px;
    font-variant-numeric: tabular-nums;
  }

  /* ── NOTES ── */
  .notes-left { font-size: 0.82em; line-height: var(--line-height); }
  .notes-label { font-weight: bold; color: #dc2626; font-style: italic; }
  .notes-text  { color: #dc2626; font-style: italic; font-weight: 500; }

  /* ── T&C ── */
  .tc-section { padding-top: 12px; border-top: 1px solid #ebebeb; margin-top: 8px; }
  .section-label { font-size: 0.72em; font-weight: 700; letter-spacing: 0.1em; color: #888; text-transform: uppercase; margin-bottom: 8px; }
  .tc-text { font-size: 0.85em; color: #666; line-height: 1.7; white-space: pre-wrap; }

  /* ── SIGNATURES ── */
  .sig-section { display: flex; justify-content: space-between; gap: 48px; padding-top: 20px; border-top: 1px solid #ebebeb; margin-top: 8px; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1px solid #555; height: 28px; margin-bottom: 4px; }
  .sig-label { font-size: 0.85em; color: #555; font-weight: 600; }

  /* ── CHEQUES + CREDIT ── */
  .cheques-section { padding-top: 10px; border-top: 1px solid #ebebeb; margin-top: 8px; font-size: 0.82em; color: #555; line-height: 1.5; }
  .cheques-section strong { color: #333; }
  .credit-terms { margin-top: 3px; color: #888; }

  /* ── FOOTER ── */
  #footer { margin-top: 30px; font-size: 0.72em; color: #aaa; text-align: center; }

  /* ── PRINT BAR (screen only) ── */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #1e293b; color: white; display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .print-bar span { opacity: 0.7; font-size: 12px; }
  .print-btn { background: white; color: #1e293b; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .print-btn:hover { background: #f1f5f9; }

  @media print {
    @page { margin: 15mm; size: A4; }
    body { background: white; padding: 0; }
    .wrapper { margin: 0; max-width: 100%; box-shadow: none; padding: 0; }
    .print-bar { display: none; }
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
    #table-totals { padding-top: 4px; padding-bottom: 4px; gap: 24px; }
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
  <button class="print-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
    Print / Save as PDF
  </button>
</div>

<div class="wrapper">

  <!-- HEADER: logo+company LEFT | badge + QUOTATION title + entity box RIGHT -->
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
      ${isRevision ? `<div class="quotation-badge-wrapper"><span class="revision-tag">REVISION</span></div>` : ""}
      <div class="doc-title">QUOTATION</div>
      <table id="entity-details" cellspacing="0">
        <tr><th>Quotation #</th><td>${escHtml(quot.quotationNumber)}</td></tr>
        <tr><th>Date</th><td>${createdStr}</td></tr>
        ${validStr ? `<tr><th>Valid Until</th><td>${validStr}</td></tr>` : ""}
        ${validityNote ? `<tr><th>Validity</th><td>${escHtml(validityNote)}</td></tr>` : ""}
        <tr><th>Total</th><td>${fmtGYD(total)}</td></tr>
      </table>
    </div>
  </div>

  <!-- BILL TO -->
  <div class="bill-to">
    <div class="bill-to-label">Prepared For</div>
    <div class="client-name">${clientPrimaryName}</div>
    ${clientSubLines ? `<div class="client-sub">${clientSubLines}</div>` : ""}
    ${quot.preparedBy ? `<p style="margin-top:8px;font-size:0.82em;color:#888">Prepared by: ${escHtml(quot.preparedBy)}</p>` : ""}
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

  <!-- TABLE TOTALS -->
  <div id="table-totals">
    <div class="totals-left">
      ${notesBlock}
    </div>
    <div class="totals-right">
      <div class="t-row"><span class="lbl">Subtotal</span><span class="amt">${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="t-row discount"><span class="lbl">Discount${quot.discountType === "percent" ? ` (${quot.discountValue}%)` : ""}</span><span class="amt">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="t-row sep"><span class="lbl">Total (before tax)</span><span class="amt">${fmtGYD(subtotal - discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="t-row"><span class="lbl">Tax</span><span class="amt">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="balance-due-row">
        <span>Total</span>
        <span>${fmtGYD(total)}</span>
      </div>
    </div>
  </div>

  ${tcBlock}

  <!-- SIGNATURES -->
  <div class="sig-section">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Received by</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Authorized by</div></div>
  </div>

  <!-- CHEQUES + CREDIT TERMS -->
  <div class="cheques-section">
    <div>All cheques are to be made payable to: <strong>${escHtml(companyName)}</strong></div>
    <div class="credit-terms">This is a quotation only — not a tax invoice &nbsp;&bull;&nbsp; Invoices are due 30 days from date of issue &nbsp;&bull;&nbsp; 10% service charge applies to late payments.</div>
  </div>

  <div id="footer">
    ${escHtml(companyName)}${settings.quotationFooterNote ? ` &nbsp;&bull;&nbsp; ${escHtml(settings.quotationFooterNote)}` : ""} &nbsp;&bull;&nbsp; Generated ${new Date().toLocaleString("en-GY")}
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
