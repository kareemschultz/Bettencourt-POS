// ── Customer Statement PDF Builder ────────────────────────────────────────────
// Generates a professional Blob URL HTML document for customer statement printing.
// Opens in a new tab — does NOT use window.print() on the current page.

export interface CustomerStatementOptions {
	customerName: string;
	startDate: string;
	endDate: string;
	companyName?: string;
	companyAddress?: string;
}

export type CustomerStatementRow = {
	date: string;
	description: string;
	reference: string;
	debit: string;
	credit: string;
	balance: string;
};

export function printCustomerStatementPdf(
	rows: CustomerStatementRow[],
	options: CustomerStatementOptions,
): void {
	// Open window synchronously (inside user-gesture context) before any await.
	// Browsers block window.open() called after an await as an untrusted popup.
	const win = window.open("about:blank", "_blank");
	void fetchLogoBase64().then((logoBase64) => {
		const html = buildStatementHtml(rows, options, logoBase64);
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

function escHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildStatementHtml(
	rows: CustomerStatementRow[],
	opts: CustomerStatementOptions,
	logo: string,
): string {
	const {
		customerName,
		startDate,
		endDate,
		companyName = "Bettencourt's Food Inc.",
		companyAddress = "Georgetown, Guyana",
	} = opts;

	const totalDebits = rows.reduce((sum, r) => sum + Number(r.debit || 0), 0);
	const totalCredits = rows.reduce((sum, r) => sum + Number(r.credit || 0), 0);
	const closingBalance =
		rows.length > 0 ? Number(rows[rows.length - 1]?.balance) : 0;

	const logoHtml = logo
		? `<img src="${logo}" class="logo" alt="Bettencourt's Logo" />`
		: "";

	const periodDisplay =
		startDate && endDate
			? `${fmtDate(startDate)} – ${fmtDate(endDate)}`
			: "All Dates";

	const transactionRows = rows
		.map(
			(r) => `
    <tr>
      <td class="nowrap">${fmtDate(r.date)}</td>
      <td>${escHtml(r.description)}</td>
      <td class="mono">${r.reference ? escHtml(r.reference) : '<span class="muted">—</span>'}</td>
      <td class="right mono">${Number(r.debit) > 0 ? fmtGYD(Number(r.debit)) : '<span class="muted">—</span>'}</td>
      <td class="right mono">${Number(r.credit) > 0 ? fmtGYD(Number(r.credit)) : '<span class="muted">—</span>'}</td>
      <td class="right mono bold">${fmtGYD(Number(r.balance))}</td>
    </tr>`,
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
<title>Customer Statement — ${escHtml(customerName)}</title>
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

  /* ── Customer / Period info strip ── */
  .info-strip { padding: 20px 36px; display: flex; gap: 48px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .info-col { flex: 1; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
  .customer-name { font-size: 15px; font-weight: 700; color: #1e293b; }
  .customer-sub { font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.6; }
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
  .items-table td.bold { font-weight: 700; }
  .items-table tbody tr:hover { background: #fafcff; }
  .items-table tbody tr:last-child td { border-bottom: none; }
  .muted { color: #94a3b8; }

  /* ── Totals row ── */
  .totals-row td { background: #f8fafc; font-weight: 700; font-size: 12px; padding: 12px 14px; border-top: 2px solid #e2e8f0; border-bottom: none; }

  /* ── Closing balance strip ── */
  .closing-strip { padding: 16px 36px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; background: #f8fafc; }
  .tx-count { font-size: 12px; color: #64748b; }
  .closing-balance { display: flex; align-items: center; gap: 14px; }
  .closing-label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #475569; text-transform: uppercase; }
  .closing-amount { font-size: 16px; font-weight: 800; color: #1e293b; font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }

  /* ── Thank you / Footer ── */
  .thankyou { padding: 18px 36px; text-align: center; font-size: 13px; color: #475569; font-style: italic; border-top: 1px solid #e2e8f0; }
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
        <div class="company-name">${escHtml(companyName)}</div>
        <div class="company-sub">${escHtml(companyAddress)}<br>bettencourtsfood@gmail.com</div>
      </div>
    </div>
    <div>
      <div class="doc-type">CUSTOMER STATEMENT</div>
    </div>
  </div>

  <!-- Customer + Period info -->
  <div class="info-strip">
    <div class="info-col">
      <div class="section-label">Customer</div>
      <div class="customer-name">${escHtml(customerName)}</div>
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
        <th style="width:110px">Reference</th>
        <th class="right" style="width:110px">Debit (GYD)</th>
        <th class="right" style="width:110px">Credit (GYD)</th>
        <th class="right" style="width:120px">Balance (GYD)</th>
      </tr>
    </thead>
    <tbody>
      ${
				rows.length > 0
					? transactionRows +
						`
      <tr class="totals-row">
        <td colspan="3" style="text-align:right;color:#64748b;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Totals</td>
        <td class="right mono">${fmtGYD(totalDebits)}</td>
        <td class="right mono">${fmtGYD(totalCredits)}</td>
        <td class="right mono">${fmtGYD(closingBalance)}</td>
      </tr>`
					: `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8;font-style:italic">No transactions in this period</td></tr>`
			}
    </tbody>
  </table>

  <!-- Closing balance strip -->
  <div class="closing-strip">
    <span class="tx-count">${rows.length} transaction${rows.length !== 1 ? "s" : ""}</span>
    <div class="closing-balance">
      <span class="closing-label">Closing Balance</span>
      <span class="closing-amount">${fmtGYD(closingBalance)}</span>
    </div>
  </div>

  <!-- Thank you message -->
  <div class="thankyou">
    Thank you for your business!
  </div>

  <!-- Footer -->
  <div class="footer">
    Generated: ${escHtml(generatedAt)} &nbsp;&bull;&nbsp; ${escHtml(companyName)} &nbsp;&bull;&nbsp; ${escHtml(companyAddress)}
  </div>

</div>
</body>
</html>`;
}
