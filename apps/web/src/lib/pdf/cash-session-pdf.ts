// ── Cash Session / End-of-Shift Report PDF ────────────────────────────────────
// Opens in a new tab with in-page Print + Save as PDF buttons.

export interface CashSessionPdfOptions {
	session: {
		id: string;
		userName: string | null;
		openedAt: Date | string;
		closedAt: Date | string | null;
		openingFloat: string;
		expectedCash: string | null;
		closingCount: string | null;
		variance: string | null;
		notes: string | null;
	};
	organizationName: string;
}

export function printCashSessionReport(opts: CashSessionPdfOptions): void {
	const win = window.open("about:blank", "_blank");
	void fetchLogoBase64().then((logoBase64) => {
		const html = buildSessionHtml(opts, logoBase64);
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

function fmtGYD(amount: number | string): string {
	return new Intl.NumberFormat("en-GY", {
		style: "currency",
		currency: "GYD",
		minimumFractionDigits: 2,
	}).format(Number(amount));
}

function fmtDate(d: Date | string | null): string {
	if (!d) return "—";
	return new Date(d).toLocaleString("en-GY", {
		timeZone: "America/Guyana",
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function esc(str: string | null | undefined): string {
	return (str ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildSessionHtml(
	opts: CashSessionPdfOptions,
	logo: string,
): string {
	const { session, organizationName } = opts;
	const logoHtml = logo
		? `<img src="${logo}" class="logo" alt="Logo" />`
		: "";

	const expected = Number(session.expectedCash ?? session.openingFloat);
	const actual = Number(session.closingCount ?? 0);
	const variance = Number(session.variance ?? actual - expected);
	const varianceColor = variance < 0 ? "#dc2626" : variance > 0 ? "#16a34a" : "#1e293b";

	const generatedAt = new Date().toLocaleString("en-GY", {
		timeZone: "America/Guyana",
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Shift Report — ${esc(session.userName ?? "Unknown")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; }
  .wrapper { max-width: 600px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; }

  .header { background: #1e293b; color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .logo-area { display: flex; align-items: center; gap: 14px; }
  .logo { height: 48px; width: auto; border-radius: 6px; }
  .company-name { font-size: 15px; font-weight: 700; }
  .company-sub { font-size: 10px; opacity: 0.7; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-type { font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .doc-sub { font-size: 11px; margin-top: 4px; opacity: 0.8; }

  .section { padding: 20px 32px; border-bottom: 1px solid #e2e8f0; }
  .section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .field-label { font-size: 10px; color: #64748b; margin-bottom: 3px; }
  .field-value { font-size: 13px; font-weight: 600; color: #1e293b; }

  .cash-summary { padding: 20px 32px; border-bottom: 1px solid #e2e8f0; }
  .cash-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .cash-row:last-child { border-bottom: none; }
  .cash-label { font-size: 12px; color: #475569; }
  .cash-value { font-size: 13px; font-weight: 700; font-family: 'Courier New', monospace; }

  .variance-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; margin-top: 4px; border-top: 2px solid #e2e8f0; }
  .variance-label { font-size: 13px; font-weight: 700; color: #1e293b; }
  .variance-value { font-size: 16px; font-weight: 800; font-family: 'Courier New', monospace; color: ${varianceColor}; }

  .signatures { padding: 24px 32px; display: flex; gap: 32px; }
  .sig-block { flex: 1; }
  .sig-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 28px; }
  .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 10px; color: #94a3b8; }

  .footer { padding: 10px 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; background: #f8fafc; }

  .actions { padding: 16px 32px; display: flex; gap: 10px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  .btn { padding: 8px 18px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #1e293b; }
  .btn-primary { background: #1e293b; color: #fff; border-color: #1e293b; }

  @media print {
    @page { margin: 0; size: A5; }
    body { background: white; }
    .wrapper { margin: 0; box-shadow: none; border-radius: 0; }
    .actions { display: none !important; }
  }
</style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <div class="logo-area">
      ${logoHtml}
      <div>
        <div class="company-name">${esc(organizationName)}</div>
        <div class="company-sub">Georgetown, Guyana</div>
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-type">Shift Report</div>
      <div class="doc-sub">${esc(fmtDate(session.openedAt).split(",")[0] ?? "")}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Session Details</div>
    <div class="grid">
      <div>
        <div class="field-label">Cashier</div>
        <div class="field-value">${esc(session.userName ?? "Unknown")}</div>
      </div>
      <div>
        <div class="field-label">Opening Float</div>
        <div class="field-value">${fmtGYD(session.openingFloat)}</div>
      </div>
      <div>
        <div class="field-label">Opened</div>
        <div class="field-value" style="font-size:11px">${esc(fmtDate(session.openedAt))}</div>
      </div>
      <div>
        <div class="field-label">Closed</div>
        <div class="field-value" style="font-size:11px">${esc(fmtDate(session.closedAt))}</div>
      </div>
    </div>
    ${session.notes ? `<div style="margin-top:14px"><div class="field-label">Notes</div><div class="field-value" style="font-weight:400;font-size:12px">${esc(session.notes)}</div></div>` : ""}
  </div>

  <div class="cash-summary">
    <div class="section-title">Cash Summary</div>
    <div class="cash-row">
      <span class="cash-label">Opening Float</span>
      <span class="cash-value">${fmtGYD(session.openingFloat)}</span>
    </div>
    <div class="cash-row">
      <span class="cash-label">Expected Cash (Float + Sales)</span>
      <span class="cash-value">${fmtGYD(expected)}</span>
    </div>
    <div class="cash-row">
      <span class="cash-label">Actual Count</span>
      <span class="cash-value">${session.closingCount ? fmtGYD(actual) : "—"}</span>
    </div>
    <div class="variance-row">
      <span class="variance-label">Variance</span>
      <span class="variance-value">${session.variance != null ? fmtGYD(variance) : "—"}</span>
    </div>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-label">Cashier Signature</div>
      <div class="sig-line">${esc(session.userName ?? "")}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Verified By</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Authorized By</div>
      <div class="sig-line"></div>
    </div>
  </div>

  <div class="footer">
    Generated: ${esc(generatedAt)} &nbsp;&bull;&nbsp; ${esc(organizationName)}
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick="window.print()">Print Report</button>
    <button class="btn" onclick="window.close()">Close</button>
  </div>

</div>
</body>
</html>`;
}
