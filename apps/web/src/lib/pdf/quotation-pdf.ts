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

	const clientNameLine = quot.agencyName
		? `<p class="client-primary">${escHtml(quot.agencyName)}</p><p>${escHtml(quot.customerName)}</p>`
		: `<p class="client-primary">${escHtml(quot.customerName)}</p>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(quot.quotationNumber)} — ${companyName}</title>
<style>
  :root {
    --primary: #b8862d;
    --secondary: #7d5518;
    --line-height: 1.6;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif;
    font-size: 14px;
    background: #dde0e3;
    color: #333;
    -webkit-font-smoothing: antialiased;
    padding: 24px 16px 48px;
  }

  .wrapper {
    max-width: 794px;
    margin: 0 auto;
    background: white;
    padding: 48px 52px 52px;
    box-shadow: 0 2px 14px rgba(0,0,0,0.18);
  }

  /* ── 3-COLUMN HEADER ── */
  .header-container {
    display: grid;
    grid-template-columns: 1.8fr 1fr 1fr;
    align-items: start;
    gap: 20px;
    width: 100%;
    margin-bottom: 2rem;
  }

  .company-logo-container { justify-self: start; }
  .company-logo { max-width: 160px; max-height: 64px; width: auto; height: auto; display: block; }

  #company-details {
    display: flex;
    flex-direction: column;
    color: #b1b1b1;
    line-height: var(--line-height);
    text-align: left;
    font-size: 0.88em;
  }

  #company-address {
    display: flex;
    flex-direction: column;
    color: #b1b1b1;
    line-height: var(--line-height);
    text-align: left;
    font-size: 0.88em;
  }

  /* ── CLIENT + ENTITY WRAPPER ── */
  .client-and-entity-wrapper {
    display: grid;
    grid-template-columns: 2fr 1.5fr;
    align-items: start;
    margin-bottom: 2rem;
    gap: 20px;
  }

  #client-details {
    display: flex;
    flex-direction: column;
    line-height: var(--line-height);
    font-size: 0.9em;
    color: #555;
  }
  .entity-issued-to { margin-top: 0; font-size: 0.78em; font-weight: 700; color: #888; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
  #client-details .client-primary { color: var(--primary); font-size: 1.2em; font-weight: 600; }

  /* QUOTATION badge in header area (above entity box) */
  .quotation-badge-wrapper { text-align: right; margin-bottom: 6px; }
  .quotation-badge {
    display: inline-block;
    border: 2px solid var(--primary);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 1.1em;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--primary);
  }
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
    margin-left: 6px;
    vertical-align: middle;
  }

  #entity-details {
    background-color: var(--primary);
    border-radius: 1rem;
    min-width: 220px;
    color: white;
    border-collapse: separate;
    border-spacing: 0;
    flex-shrink: 0;
  }
  #entity-details th {
    font-weight: normal;
    padding: 0.5rem 12px 0.5rem 1.2rem;
    white-space: nowrap;
    font-size: 0.88em;
    opacity: 0.9;
  }
  #entity-details td {
    text-align: right;
    padding: 0.5rem 1.2rem 0.5rem 10px;
    font-size: 0.88em;
    font-weight: 600;
  }
  #entity-details tr:last-child th,
  #entity-details tr:last-child td { padding-bottom: 0; }

  /* ── ITEMS TABLE ── */
  .items-table {
    margin-top: 2.5rem;
    margin-bottom: 5px;
    min-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    overflow-wrap: break-word;
  }
  .items-table thead { text-align: left; background: var(--secondary); }
  .items-table thead th { padding: 1rem; color: white; font-weight: 600; font-size: 0.88em; }
  .items-table thead th.left-radius { border-top-left-radius: 10px; }
  .items-table thead th.right-radius { text-align: right; border-top-right-radius: 10px; }
  .items-table tbody td { padding: 1rem; font-size: 0.88em; color: #444; vertical-align: top; }
  .items-table tbody td.right-td { text-align: right; font-variant-numeric: tabular-nums; }
  .items-table tbody tr td { background: #F7F7F7; }

  /* ── TABLE TOTALS ── */
  #table-totals {
    margin-top: 0;
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 80px;
    padding-top: 0.5rem;
    padding-bottom: 0.8rem;
    overflow: visible;
  }

  .totals-left { font-size: 0.82em; color: #666; line-height: var(--line-height); }
  .totals-right { display: flex; flex-direction: column; }
  .t-row { display: grid; grid-template-columns: 1fr 1fr; margin-top: 0.75rem; font-size: 0.88em; color: #555; }
  .t-row .amt { text-align: right; padding-right: 17px; font-variant-numeric: tabular-nums; }
  .t-row .lbl { padding-left: 7px; }
  .t-row.discount .amt { color: #dc2626; }
  .t-row.sep { font-weight: bold; color: #333; }

  .outstanding-row { display: grid; grid-template-columns: 1fr 1fr; margin-top: 0.75rem; }
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

  /* ── T&C ── */
  .tc-section { padding-top: 12px; border-top: 1px solid #ebebeb; margin-top: 8px; }
  .section-label { font-size: 0.78em; font-weight: 700; letter-spacing: 0.1em; color: #888; text-transform: uppercase; margin-bottom: 8px; }
  .tc-text { font-size: 0.85em; color: #666; line-height: 1.7; white-space: pre-wrap; }

  /* ── NOTES ── */
  .notes-left { font-size: 0.85em; line-height: 1.6; }
  .notes-label { font-weight: bold; color: #dc2626; font-style: italic; }
  .notes-text { color: #dc2626; font-style: italic; font-weight: 500; }

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
  #footer { margin-top: 30px; font-size: 0.78em; color: #aaa; text-align: center; }

  /* ── PRINT BAR ── */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #1e293b; color: white; display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .print-bar span { opacity: 0.7; font-size: 12px; }
  .print-btn { background: white; color: #1e293b; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .print-btn:hover { background: #f1f5f9; }

  @media print {
    @page { margin: 18mm 15mm; size: A4; }
    body { background: white; padding: 0; }
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

  <!-- 3-COLUMN HEADER -->
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

  <!-- CLIENT LEFT | GOLD QUOTATION BOX RIGHT -->
  <div class="client-and-entity-wrapper">
    <div id="client-details">
      <p class="entity-issued-to">Quotation prepared for:</p>
      ${clientNameLine}
      ${quot.contactPersonName ? `<p>${escHtml(quot.contactPersonName)}${quot.contactPersonPosition ? `, ${escHtml(quot.contactPersonPosition)}` : ""}</p>` : quot.contactPersonPosition ? `<p>${escHtml(quot.contactPersonPosition)}</p>` : ""}
      ${quot.customerPhone ? `<p>${escHtml(quot.customerPhone)}</p>` : ""}
      ${quot.customerAddress ? `<p>${escHtml(quot.customerAddress)}</p>` : ""}
      ${quot.preparedBy ? `<p style="margin-top:8px;font-size:0.82em;color:#888">Prepared by: ${escHtml(quot.preparedBy)}</p>` : ""}
    </div>

    <div>
      <div class="quotation-badge-wrapper">
        <span class="quotation-badge">QUOTATION</span>
        ${isRevision ? `<span class="revision-tag">REVISION</span>` : ""}
      </div>
      <table id="entity-details" cellspacing="0">
        <tr><th>Quotation #</th><td>${escHtml(quot.quotationNumber)}</td></tr>
        <tr><th>Date</th><td>${createdStr}</td></tr>
        ${validStr ? `<tr><th>Valid Until</th><td>${validStr}</td></tr>` : ""}
        ${validityNote ? `<tr><th>Validity</th><td>${escHtml(validityNote)}</td></tr>` : ""}
        <tr><th>Total</th><td>${fmtGYD(total)}</td></tr>
        <tr><th>Status</th><td>${escHtml(quot.status.toUpperCase())}</td></tr>
      </table>
    </div>
  </div>

  <!-- ITEMS TABLE -->
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

  <!-- TABLE TOTALS -->
  <div id="table-totals">
    <div class="totals-left">
      ${notesBlock}
    </div>
    <div class="totals-right">
      <div class="t-row"><span class="lbl">Subtotal</span><span class="amt">${fmtGYD(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="t-row discount"><span class="lbl">Discount${quot.discountType === "percent" ? ` (${quot.discountValue}%)` : ""}</span><span class="amt">-${fmtGYD(discountAmt)}</span></div>` : ""}
      ${taxAmt > 0 ? `<div class="t-row"><span class="lbl">Tax</span><span class="amt">${fmtGYD(taxAmt)}</span></div>` : ""}
      <div class="outstanding-row">
        <div class="outstanding-label">Quotation Total</div>
        <div class="outstanding-value">${fmtGYD(total)}</div>
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
