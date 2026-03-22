// ── Daily Expense Summary PDF Builder ────────────────────────────────────────
// Mirrors Shakira's handwritten "Bettencourt's Diner Expense Summary Form".
// Grouped by funding source (Renatta, CEO, Pastry Section, etc.).
// Opens in a new tab — does NOT use window.print() on the current page.

export interface DailyExpenseSummaryOptions {
	date: string; // e.g. "2026-03-09"
	grandTotal: string;
	groups: Array<{
		fundingSourceId: string | null;
		fundingSource: string; // "General Cash", "Renatta", "Miss Bonita", etc.
		subtotal: string;
		items: Array<{
			expenseId: string;
			vendor: string;
			category: string;
			amount: string;
			description: string;
			createdAt: string;
		}>;
	}>;
	preparedBy?: string;
}

export function printDailyExpenseSummary(
	opts: DailyExpenseSummaryOptions,
): void {
	// Open window synchronously to avoid popup blockers.
	const win = window.open("about:blank", "_blank");
	void fetchLogoBase64().then((logoBase64) => {
		const html = buildSummaryHtml(opts, logoBase64);
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

function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-GY", {
		timeZone: "America/Guyana",
		weekday: "long",
		month: "long",
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

function buildSummaryHtml(
	opts: DailyExpenseSummaryOptions,
	logo: string,
): string {
	const { date, grandTotal, groups, preparedBy } = opts;

	const logoHtml = logo
		? `<img src="${logo}" class="logo" alt="Bettencourt's Logo" />`
		: "";

	const dateDisplay = (() => {
		try {
			// Parse as local date (YYYY-MM-DD)
			const [y, m, d] = date.split("-").map(Number);
			return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-GY", {
				weekday: "long",
				month: "long",
				day: "numeric",
				year: "numeric",
			});
		} catch {
			return fmtDate(date);
		}
	})();

	const generatedAt = new Date().toLocaleString("en-GY", {
		timeZone: "America/Guyana",
	});

	const groupSections = groups
		.map((group) => {
			const itemRows = group.items
				.map(
					(item) => `
      <tr>
        <td>${escHtml(item.vendor)}</td>
        <td class="cat"><span class="badge">${escHtml(item.category)}</span></td>
        <td>${escHtml(item.description)}</td>
        <td class="right mono">${fmtGYD(Number(item.amount))}</td>
      </tr>`,
				)
				.join("");

			return `
  <div class="group-section">
    <div class="group-header">
      <span class="group-name">${escHtml(group.fundingSource)}</span>
      <span class="group-count">${group.items.length} item${group.items.length !== 1 ? "s" : ""}</span>
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:30%">Vendor / Supplier</th>
          <th style="width:15%">Category</th>
          <th>Description</th>
          <th class="right" style="width:15%">Amount (GYD)</th>
        </tr>
      </thead>
      <tbody>
        ${group.items.length > 0 ? itemRows : `<tr><td colspan="4" class="empty">No expenses</td></tr>`}
      </tbody>
    </table>
    <div class="group-subtotal">
      <span class="subtotal-label">${escHtml(group.fundingSource)} Total</span>
      <span class="subtotal-amount">${fmtGYD(Number(group.subtotal))}</span>
    </div>
  </div>`;
		})
		.join("");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Expense Summary — ${escHtml(date)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; }
  .wrapper { max-width: 794px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; }

  /* Header */
  .header { background: #1e293b; color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .logo-area { display: flex; align-items: center; gap: 14px; }
  .logo { height: 52px; width: auto; border-radius: 6px; }
  .company-name { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
  .company-sub { font-size: 10px; opacity: 0.7; margin-top: 3px; line-height: 1.5; }
  .doc-info { text-align: right; }
  .doc-type { font-size: 14px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .doc-date { font-size: 13px; margin-top: 6px; opacity: 0.85; }

  /* Groups */
  .group-section { border-bottom: 2px solid #e2e8f0; }
  .group-header { padding: 12px 24px 8px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .group-name { font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; }
  .group-count { font-size: 11px; color: #64748b; }

  /* Items table */
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table th { padding: 8px 16px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; text-align: left; }
  .items-table th.right { text-align: right; }
  .items-table td { padding: 9px 16px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #334155; }
  .items-table td.right { text-align: right; }
  .items-table td.mono { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
  .items-table td.cat { }
  .items-table td.empty { text-align: center; padding: 16px; color: #94a3b8; font-style: italic; }
  .badge { display: inline-block; background: #e0f2fe; color: #0369a1; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: 600; white-space: nowrap; }

  /* Subtotals */
  .group-subtotal { padding: 10px 24px; display: flex; justify-content: flex-end; align-items: center; gap: 24px; background: #f8fafc; }
  .subtotal-label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
  .subtotal-amount { font-size: 14px; font-weight: 700; color: #1e293b; font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }

  /* Grand total */
  .grand-total-strip { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; background: #1e293b; color: white; }
  .grand-label { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .grand-amount { font-size: 20px; font-weight: 800; font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }

  /* Signature section */
  .signatures { padding: 24px 32px; display: flex; gap: 32px; border-top: 1px solid #e2e8f0; }
  .sig-block { flex: 1; }
  .sig-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 28px; }
  .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 10px; color: #94a3b8; }

  /* Footer */
  .footer { padding: 10px 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; background: #f8fafc; }

  @media print {
    @page { margin: 0; size: A4; }
    body { background: white; }
    .wrapper { margin: 0; box-shadow: none; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="wrapper">

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      ${logoHtml}
      <div>
        <div class="company-name">Bettencourt's Diner</div>
        <div class="company-sub">Georgetown, Guyana</div>
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-type">Expense Summary Form</div>
      <div class="doc-date">${escHtml(dateDisplay)}</div>
    </div>
  </div>

  <!-- Expense groups by funding source -->
  ${groups.length > 0 ? groupSections : `<div style="padding:32px;text-align:center;color:#94a3b8;font-style:italic">No expenses recorded for this date.</div>`}

  <!-- Grand total -->
  <div class="grand-total-strip">
    <span class="grand-label">Grand Total</span>
    <span class="grand-amount">${fmtGYD(Number(grandTotal))}</span>
  </div>

  <!-- Signature lines -->
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-label">Prepared By</div>
      <div class="sig-line">${escHtml(preparedBy ?? "")}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Checked By</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Authorized By</div>
      <div class="sig-line"></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    Generated: ${escHtml(generatedAt)} &nbsp;&bull;&nbsp; Bettencourt's Food Inc.
  </div>

</div>
</body>
</html>`;
}
