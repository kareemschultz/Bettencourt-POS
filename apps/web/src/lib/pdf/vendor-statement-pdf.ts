// ── Vendor Statement PDF Builder ─────────────────────────────────────────────
// Generates a professional Blob URL HTML document for vendor statement printing.
// Opens in a new tab — does NOT use window.print() on the current page.

export interface VendorStatementOptions {
	vendor: {
		name: string;
		contactName: string | null;
		phone: string | null;
		email: string | null;
	};
	period: {
		label: string; // e.g. "This Month" or "Mar 1 – Mar 9, 2026"
		startDate: string | null;
		endDate: string | null;
	};
	transactions: Array<{
		date: string; // ISO string
		description: string;
		category: string;
		paymentMethod: string;
		referenceNumber: string | null;
		authorizedBy: string | null;
		amount: string; // numeric string e.g. "4500.00"
	}>;
	categoryBreakdown: Array<{
		category: string;
		total: string; // numeric string
	}>;
	preparedBy: string;
}

export function printVendorStatement(options: VendorStatementOptions): void {
	// Open window synchronously (inside user-gesture context) before any await.
	// Browsers block window.open() called after an await as an untrusted popup.
	const win = window.open("about:blank", "_blank");
	void fetchLogoBase64().then((logoBase64) => {
		const html = buildStatementHtml(options, logoBase64);
		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		if (win) {
			win.location.href = url;
		} else {
			window.open(url, "_blank");
		}
		setTimeout(() => URL.revokeObjectURL(url), 15_000);
	});
}

async function fetchLogoBase64(): Promise<string> {
	try {
		const resp = await fetch("/logo.png");
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

/** Format ISO date string as "Mar 9, 2026" in Guyana timezone. */
function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-GY", {
		timeZone: "America/Guyana",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
	cash: "Cash",
	card: "Card",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	mobile_money: "Mobile Money",
};

function humanPaymentMethod(method: string): string {
	return PAYMENT_METHOD_LABEL[method.toLowerCase()] ?? method;
}

function escHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildStatementHtml(
	opts: VendorStatementOptions,
	logo: string,
): string {
	const { vendor, period, transactions, categoryBreakdown, preparedBy } = opts;

	const grandTotal = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

	const logoHtml = logo
		? `<img src="${logo}" class="logo" alt="Bettencourt's Logo" />`
		: "";

	const periodDisplay = (() => {
		if (period.startDate && period.endDate) {
			return `${fmtDate(period.startDate)} – ${fmtDate(period.endDate)}`;
		}
		return escHtml(period.label);
	})();

	const transactionRows = transactions
		.map(
			(t) => `
    <tr>
      <td class="nowrap">${fmtDate(t.date)}</td>
      <td>${escHtml(t.description)}</td>
      <td><span class="category-badge">${escHtml(t.category)}</span></td>
      <td class="mono">${t.referenceNumber ? escHtml(t.referenceNumber) : '<span class="muted">—</span>'}</td>
      <td>${escHtml(humanPaymentMethod(t.paymentMethod))}</td>
      <td>${t.authorizedBy ? escHtml(t.authorizedBy) : '<span class="muted">—</span>'}</td>
      <td class="right mono">${fmtGYD(Number(t.amount))}</td>
    </tr>`,
		)
		.join("");

	const categoryRows = categoryBreakdown
		.map(
			(c) => `
    <div class="breakdown-row">
      <span class="breakdown-label">${escHtml(c.category)}</span>
      <span class="breakdown-dots"></span>
      <span class="breakdown-amount">${fmtGYD(Number(c.total))}</span>
    </div>`,
		)
		.join("");

	const generatedAt = new Date().toLocaleString("en-GY", {
		timeZone: "America/Guyana",
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Vendor Statement — ${escHtml(vendor.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; }
  .wrapper { max-width: 794px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; }

  /* ── Header band ── */
  .header { background: #1e293b; color: white; padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .logo-area { display: flex; align-items: center; gap: 16px; }
  .logo { height: 56px; width: auto; border-radius: 6px; }
  .company-name { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
  .company-sub { font-size: 11px; opacity: 0.7; margin-top: 3px; line-height: 1.5; }
  .doc-type { font-size: 26px; font-weight: 800; letter-spacing: 0.12em; text-align: right; }

  /* ── Vendor / Period info strip ── */
  .info-strip { padding: 20px 36px; display: flex; gap: 48px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .info-col { flex: 1; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
  .vendor-name { font-size: 15px; font-weight: 700; color: #1e293b; }
  .vendor-sub { font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.6; }
  .period-value { font-size: 13px; font-weight: 600; color: #1e293b; }
  .period-sub { font-size: 11px; color: #475569; margin-top: 4px; }

  /* ── Transaction table ── */
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table thead tr { background: #f8fafc; }
  .items-table th { padding: 10px 14px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; text-align: left; white-space: nowrap; }
  .items-table th.right { text-align: right; }
  .items-table td { padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #334155; }
  .items-table td.right { text-align: right; }
  .items-table td.mono { font-family: 'Courier New', monospace; font-size: 11px; font-variant-numeric: tabular-nums; }
  .items-table td.nowrap { white-space: nowrap; }
  .items-table tbody tr:hover { background: #fafcff; }
  .items-table tbody tr:last-child td { border-bottom: none; }
  .category-badge { display: inline-block; background: #e0f2fe; color: #0369a1; border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 600; white-space: nowrap; }
  .muted { color: #94a3b8; }

  /* ── Totals footer row ── */
  .totals-strip { padding: 14px 36px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; background: #f8fafc; }
  .tx-count { font-size: 12px; color: #64748b; }
  .grand-total { display: flex; align-items: center; gap: 14px; }
  .grand-label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #475569; text-transform: uppercase; }
  .grand-amount { font-size: 16px; font-weight: 800; color: #1e293b; font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }

  /* ── Category breakdown ── */
  .breakdown-section { padding: 20px 36px; border-top: 1px solid #e2e8f0; }
  .breakdown-title { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 14px; }
  .breakdown-row { display: flex; align-items: baseline; gap: 6px; padding: 5px 0; font-size: 12px; color: #334155; border-bottom: 1px dashed #f1f5f9; }
  .breakdown-row:last-child { border-bottom: none; }
  .breakdown-label { white-space: nowrap; min-width: 180px; }
  .breakdown-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; margin-bottom: 3px; }
  .breakdown-amount { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; font-size: 12px; white-space: nowrap; }

  /* ── Footer ── */
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
        <div class="company-sub">Georgetown, Guyana<br>bettencourtsfood@gmail.com</div>
      </div>
    </div>
    <div>
      <div class="doc-type">VENDOR STATEMENT</div>
    </div>
  </div>

  <!-- Vendor + Period info -->
  <div class="info-strip">
    <div class="info-col">
      <div class="section-label">Vendor</div>
      <div class="vendor-name">${escHtml(vendor.name)}</div>
      ${vendor.contactName ? `<div class="vendor-sub">${escHtml(vendor.contactName)}</div>` : ""}
      ${
				vendor.phone || vendor.email
					? `<div class="vendor-sub">${[vendor.phone, vendor.email]
							.filter(Boolean)
							.map((v) => escHtml(v!))
							.join(" &nbsp;&middot;&nbsp; ")}</div>`
					: ""
			}
    </div>
    <div class="info-col">
      <div class="section-label">Statement Period</div>
      <div class="period-value">${periodDisplay}</div>
      <div class="period-sub">Generated: ${escHtml(generatedAt)}</div>
    </div>
  </div>

  <!-- Transaction table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:90px">Date</th>
        <th>Description</th>
        <th style="width:120px">Category</th>
        <th style="width:100px">Ref #</th>
        <th style="width:100px">Method</th>
        <th style="width:100px">Authorized By</th>
        <th class="right" style="width:110px">Amount (GYD)</th>
      </tr>
    </thead>
    <tbody>
      ${transactions.length > 0 ? transactionRows : `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8;font-style:italic">No transactions in this period</td></tr>`}
    </tbody>
  </table>

  <!-- Totals strip -->
  <div class="totals-strip">
    <span class="tx-count">${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}</span>
    <div class="grand-total">
      <span class="grand-label">Total</span>
      <span class="grand-amount">${fmtGYD(grandTotal)}</span>
    </div>
  </div>

  ${
		categoryBreakdown.length > 0
			? `
  <!-- Category breakdown -->
  <div class="breakdown-section">
    <div class="breakdown-title">Category Breakdown</div>
    ${categoryRows}
  </div>`
			: ""
	}

  <!-- Footer -->
  <div class="footer">
    Prepared by: ${escHtml(preparedBy)} &nbsp;&bull;&nbsp; ${escHtml(generatedAt)}
    <br>Bettencourt's Food Inc. &nbsp;&bull;&nbsp; Georgetown, Guyana
  </div>

</div>
</body>
</html>`;
}
