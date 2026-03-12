// ── Branded Expense Report PDF ────────────────────────────────────────────────
// Professional alternative to the inline downloadPdf function.
// Opens in a new tab — does NOT auto-print.

export const CATEGORY_COLORS: Record<string, string> = {
	"Food & Beverage": "#ef4444",
	Food: "#ef4444",
	Beverages: "#3b82f6",
	Utilities: "#f59e0b",
	"Cleaning Supplies": "#22c55e",
	Cleaning: "#22c55e",
	"Repairs & Maintenance": "#a855f7",
	Repairs: "#a855f7",
	"Delivery & Transport": "#06b6d4",
	Transport: "#06b6d4",
	Labor: "#ec4899",
	Miscellaneous: "#6b7280",
	Other: "#6b7280",
};

function categoryColor(cat: string): string {
	if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat]!;
	// Deterministic fallback from category name hash
	const palette = Object.values(CATEGORY_COLORS);
	let hash = 0;
	for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
	return palette[hash % palette.length]!;
}

export interface ExpenseReportEntry {
	id: string;
	amount: string;
	category: string;
	description: string;
	created_at: string;
	supplier_name: string | null;
	payment_method: string | null;
	reference_number: string | null;
	authorized_by_name: string | null;
	funding_source_id: string | null;
}

export interface ExpenseReportGroup {
	name: string;
	color: string;
	items: ExpenseReportEntry[];
	total: number;
}

export interface ExpenseReportOptions {
	title?: string;
	period: string;
	rows: ExpenseReportEntry[];
	groups?: ExpenseReportGroup[];
	getSourceName?: (id: string | null | undefined) => string;
	preparedBy?: string;
}

export function printExpenseReport(opts: ExpenseReportOptions): void {
	if (!opts.rows.length) return;
	const win = window.open("about:blank", "_blank");
	void fetchLogoBase64().then((logo) => {
		const html = buildReportHtml(opts, logo);
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
		const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
		return `data:image/png;base64,${b64}`;
	} catch {
		return "";
	}
}

function fmtGYD(n: number | string): string {
	return new Intl.NumberFormat("en-GY", {
		style: "currency",
		currency: "GYD",
		minimumFractionDigits: 2,
	}).format(Number(n));
}

function esc(str: string | null | undefined): string {
	return (str ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildReportHtml(opts: ExpenseReportOptions, logo: string): string {
	const { rows, groups, period, getSourceName, preparedBy } = opts;
	const title = opts.title ?? "Expense Report";
	const total = rows.reduce((s, e) => s + Number(e.amount), 0);

	// KPI data
	const topCatMap = new Map<string, number>();
	const topSupMap = new Map<string, number>();
	for (const e of rows) {
		topCatMap.set(e.category, (topCatMap.get(e.category) ?? 0) + Number(e.amount));
		if (e.supplier_name) {
			topSupMap.set(
				e.supplier_name,
				(topSupMap.get(e.supplier_name) ?? 0) + Number(e.amount),
			);
		}
	}
	const topCat = [...topCatMap.entries()].sort((a, b) => b[1] - a[1])[0];
	const topSup = [...topSupMap.entries()].sort((a, b) => b[1] - a[1])[0];

	// Category breakdown bars
	const catBreakdown = [...topCatMap.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);

	const catBars = catBreakdown
		.map(([cat, amt]) => {
			const pct = total > 0 ? (amt / total) * 100 : 0;
			const color = categoryColor(cat);
			return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:110px;font-size:11px;color:#475569;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cat)}</div>
      <div style="flex:1;background:#f1f5f9;border-radius:4px;overflow:hidden;height:14px">
        <div style="width:${pct.toFixed(1)}%;background:${color};height:100%;min-width:2px"></div>
      </div>
      <div style="width:80px;font-size:11px;font-weight:700;color:#1e293b;text-align:right;white-space:nowrap">${fmtGYD(amt)}</div>
      <div style="width:36px;font-size:10px;color:#94a3b8;text-align:right">${pct.toFixed(0)}%</div>
    </div>`;
		})
		.join("");

	const logoHtml = logo
		? `<img src="${logo}" style="height:48px;width:auto;border-radius:6px" alt="Logo" />`
		: "";

	// Table body
	const showSource = !!getSourceName && !groups;

	let tableBody = "";
	if (groups && groups.length > 0) {
		for (const grp of groups) {
			tableBody += `<tr><td colspan="8" style="background:${grp.color}22;border-left:4px solid ${grp.color};padding:6px 10px;font-weight:700;font-size:11px;color:#1e293b">${esc(grp.name)} &middot; ${grp.items.length} item${grp.items.length !== 1 ? "s" : ""} &middot; ${fmtGYD(grp.total)}</td></tr>`;
			for (const e of grp.items) {
				tableBody += expenseRow(e, false, categoryColor(e.category));
			}
		}
	} else {
		for (const e of rows) {
			tableBody += expenseRow(
				e,
				showSource,
				categoryColor(e.category),
				getSourceName ? getSourceName(e.funding_source_id) : undefined,
			);
		}
	}

	const sourceHeader = showSource
		? '<th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Source</th>'
		: "";

	const generatedAt = new Date().toLocaleString("en-GY", {
		timeZone: "America/Guyana",
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; }
  .wrapper { max-width: 900px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; background: white; }
  @media print {
    @page { margin: 0; size: A4 landscape; }
    body { background: white; }
    .wrapper { margin: 0; box-shadow: none; border-radius: 0; }
    .actions { display: none !important; }
  }
</style>
</head>
<body>
<div class="wrapper">

  <!-- Header -->
  <div style="background:#1e293b;color:white;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
    <div style="display:flex;align-items:center;gap:14px">
      ${logoHtml}
      <div>
        <div style="font-size:15px;font-weight:700">Bettencourt's Diner</div>
        <div style="font-size:10px;opacity:.7;margin-top:3px">Georgetown, Guyana</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase">${esc(title)}</div>
      <div style="font-size:12px;margin-top:5px;opacity:.85">${esc(period)}</div>
      <div style="font-size:10px;margin-top:3px;opacity:.7">${rows.length} entries</div>
    </div>
  </div>

  <!-- KPI row -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;border-bottom:2px solid #e2e8f0">
    <div style="padding:16px 24px;border-right:1px solid #e2e8f0">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Total Spent</div>
      <div style="font-size:22px;font-weight:800;color:#1e293b;font-family:'Courier New',monospace">${fmtGYD(total)}</div>
    </div>
    <div style="padding:16px 24px;border-right:1px solid #e2e8f0">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Entries</div>
      <div style="font-size:22px;font-weight:800;color:#1e293b">${rows.length}</div>
    </div>
    <div style="padding:16px 24px;border-right:1px solid #e2e8f0">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Top Category</div>
      ${topCat ? `<div style="font-size:13px;font-weight:700;color:${categoryColor(topCat[0])}">${esc(topCat[0])}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${fmtGYD(topCat[1])}</div>` : '<div style="font-size:13px;color:#94a3b8">—</div>'}
    </div>
    <div style="padding:16px 24px">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Top Supplier</div>
      ${topSup ? `<div style="font-size:13px;font-weight:700;color:#1e293b">${esc(topSup[0])}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${fmtGYD(topSup[1])}</div>` : '<div style="font-size:13px;color:#94a3b8">—</div>'}
    </div>
  </div>

  <!-- Category breakdown -->
  ${catBreakdown.length > 0 ? `
  <div style="padding:20px 32px;border-bottom:2px solid #e2e8f0">
    <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:14px">Category Breakdown</div>
    ${catBars}
  </div>` : ""}

  <!-- Expense table -->
  <div style="padding:0">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>
          ${sourceHeader}
          <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Date</th>
          <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Supplier</th>
          <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Category</th>
          <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Description</th>
          <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Payment</th>
          <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Ref #</th>
          <th style="padding:6px 10px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Amount</th>
          <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.1em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0">Auth. By</th>
        </tr>
      </thead>
      <tbody>${tableBody}</tbody>
    </table>
  </div>

  <!-- Grand total strip -->
  <div style="padding:14px 24px;display:flex;justify-content:space-between;align-items:center;background:#1e293b;color:white">
    <span style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Grand Total</span>
    <span style="font-size:18px;font-weight:800;font-family:'Courier New',monospace">${fmtGYD(total)}</span>
  </div>

  <!-- Signatures -->
  <div style="padding:24px 32px;display:flex;gap:32px;border-top:1px solid #e2e8f0">
    <div style="flex:1">
      <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:28px">Prepared By</div>
      <div style="border-top:1px solid #94a3b8;padding-top:6px;font-size:10px;color:#94a3b8">${esc(preparedBy ?? "")}</div>
    </div>
    <div style="flex:1">
      <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:28px">Checked By</div>
      <div style="border-top:1px solid #94a3b8;padding-top:6px;font-size:10px;color:#94a3b8"></div>
    </div>
    <div style="flex:1">
      <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:28px">Authorized By</div>
      <div style="border-top:1px solid #94a3b8;padding-top:6px;font-size:10px;color:#94a3b8"></div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:10px 32px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;background:#f8fafc">
    Generated: ${esc(generatedAt)} &nbsp;&bull;&nbsp; Bettencourt's Food Inc.
  </div>

  <!-- In-page actions -->
  <div class="actions" style="padding:16px 32px;display:flex;gap:10px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <button onclick="window.print()" style="padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #1e293b;background:#1e293b;color:#fff">Print / Save as PDF</button>
    <button onclick="window.close()" style="padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#1e293b">Close</button>
  </div>

</div>
</body>
</html>`;
}

function expenseRow(
	e: ExpenseReportEntry,
	showSource: boolean,
	color: string,
	sourceName?: string,
): string {
	const date = new Date(e.created_at).toLocaleString("en-GY", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const sourceCell = showSource
		? `<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#64748b">${esc(sourceName ?? "")}</td>`
		: "";
	return `<tr>
    ${sourceCell}
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;white-space:nowrap">${esc(date)}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${esc(e.supplier_name ?? "—")}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">
      <span style="display:inline-flex;align-items:center;gap:5px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
        ${esc(e.category)}
      </span>
    </td>
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#475569">${esc(e.description)}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(e.payment_method ?? "—")}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(e.reference_number ?? "—")}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;font-family:'Courier New',monospace">${fmtGYD(e.amount)}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(e.authorized_by_name ?? "—")}</td>
  </tr>`;
}
