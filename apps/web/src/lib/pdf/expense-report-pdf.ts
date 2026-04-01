// ── Branded Expense Report PDF ────────────────────────────────────────────────
// Professional alternative to the inline downloadPdf function.
// Opens in a new tab — does NOT auto-print.

export const CATEGORY_COLORS: Record<string, string> = {
	"Food & Beverage Supplies": "#ef4444",
	"Food & Beverage": "#ef4444",
	"Food Cost": "#ef4444",
	Food: "#ef4444",
	Beverages: "#3b82f6",
	Utilities: "#f59e0b",
	"Cleaning Supplies": "#22c55e",
	"Cleaning & Sanitation": "#22c55e",
	Cleaning: "#22c55e",
	"Repairs & Maintenance": "#a855f7",
	Maintenance: "#a855f7",
	Repairs: "#a855f7",
	"Delivery & Transport": "#06b6d4",
	Transport: "#06b6d4",
	Packaging: "#0ea5e9",
	Supplies: "#64748b",
	"Office Supplies": "#64748b",
	"Staff Meals": "#f97316",
	Labor: "#ec4899",
	"Vehicle Maintenance": "#dc2626",
	"Marketing & Advertising": "#d946ef",
	"CEO Drawings": "#1d4ed8",
	"GM Drawings": "#2563eb",
	"COO Drawings": "#3b82f6",
	"Owner Drawings": "#60a5fa",
	Miscellaneous: "#94a3b8",
	Other: "#94a3b8",
};

function categoryColor(cat: string): string {
	if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat]!;
	const palette = Object.values(CATEGORY_COLORS);
	let hash = 0;
	for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
	return palette[hash % palette.length]!;
}

function fmtPayment(raw: string | null | undefined): string {
	if (!raw) return "—";
	return raw
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ExpenseReportEntry {
	id: string;
	amount: string;
	category: string;
	description: string;
	expense_date: string;   // date the expense occurred (YYYY-MM-DD)
	created_at: string;     // audit: when the entry was recorded
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

// Shared cell/header styles
const TH = `padding:7px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0`;
const TH_R = `padding:7px 10px;text-align:right;font-size:9px;font-weight:700;letter-spacing:.08em;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:2px solid #e2e8f0`;
const TD = `padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11.5px;vertical-align:top`;

// Render description as individual line items (split on newlines)
function formatDescLines(desc: string): string {
	if (!desc) return "<span style='color:#94a3b8'>—</span>";
	const lines = desc
		.split(/\n/)
		.map((l) => l.trim().replace(/,\s*$/, ""))
		.filter(Boolean);
	if (lines.length <= 1)
		return `<span style="font-size:11px;color:#334155">${esc(desc.trim())}</span>`;
	return lines
		.map(
			(l) =>
				`<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:3px">` +
				`<span style="color:#b8862d;font-size:9px;flex-shrink:0;margin-top:1px">▪</span>` +
				`<span style="font-size:11px;color:#334155">${esc(l)}</span>` +
				`</div>`,
		)
		.join("");
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

	// Category breakdown — show all categories (up to 10)
	const catBreakdown = [...topCatMap.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);

	const catBars = catBreakdown
		.map(([cat, amt]) => {
			const pct = total > 0 ? (amt / total) * 100 : 0;
			const color = categoryColor(cat);
			return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
      <div style="min-width:175px;max-width:175px;font-size:11px;color:#334155;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(cat)}">${esc(cat)}</div>
      <div style="flex:1;background:#f1f5f9;border-radius:4px;overflow:hidden;height:14px">
        <div style="width:${pct.toFixed(1)}%;background:${color};height:100%;min-width:2px;border-radius:4px"></div>
      </div>
      <div style="min-width:110px;font-size:11px;font-weight:700;color:#1e293b;text-align:right;white-space:nowrap">${fmtGYD(amt)}</div>
      <div style="min-width:36px;font-size:10px;color:#94a3b8;text-align:right">${pct.toFixed(0)}%</div>
    </div>`;
		})
		.join("");

	const logoHtml = logo
		? `<img src="${logo}" style="height:48px;width:48px;border-radius:8px;object-fit:cover" alt="Logo" />`
		: "";

	// Table
	const showSource = !!getSourceName && !groups;

	let tableBody = "";
	if (groups && groups.length > 0) {
		for (const grp of groups) {
			tableBody += `<tr><td colspan="9" style="background:${grp.color}18;border-left:4px solid ${grp.color};padding:7px 12px;font-weight:700;font-size:11px;color:#1e293b;letter-spacing:.02em">${esc(grp.name)} &nbsp;·&nbsp; ${grp.items.length} item${grp.items.length !== 1 ? "s" : ""} &nbsp;·&nbsp; ${fmtGYD(grp.total)}</td></tr>`;
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
		? `<th style="${TH}">Source</th>`
		: "";

	const generatedAt = new Date().toLocaleString("en-GY", {
		timeZone: "America/Guyana",
		dateStyle: "medium",
		timeStyle: "short",
	} as Intl.DateTimeFormatOptions);

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .wrapper { max-width: 1100px; margin: 24px auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-radius: 10px; overflow: hidden; background: white; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  col.c-source  { width: 78px; }
  col.c-date    { width: 95px; }
  col.c-supplier{ width: 130px; }
  col.c-cat     { width: 148px; }
  col.c-desc    { width: auto; }
  col.c-pay     { width: 90px; }
  col.c-ref     { width: 95px; }
  col.c-amt     { width: 108px; }
  col.c-auth    { width: 68px; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  td { vertical-align: top; }
  .sticky-actions { position: sticky; top: 0; z-index: 10; background: #1e293b; display: flex; gap: 10px; padding: 10px 32px; border-bottom: 2px solid #334155; }
  @media print {
    @page { margin: 8mm 8mm; size: A4 landscape; }
    body { background: white; }
    .wrapper { margin: 0; box-shadow: none; border-radius: 0; max-width: 100%; }
    .actions { display: none !important; }
    .sticky-actions { display: none !important; }
    tbody tr:nth-child(even) td { background: #f8fafc !important; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<!-- Sticky top actions (hidden on print) -->
<div class="sticky-actions">
  <button onclick="window.print()" style="padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #475569;background:#334155;color:#f8fafc;letter-spacing:.01em">Print / Save as PDF</button>
  <button onclick="window.close()" style="padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #475569;background:transparent;color:#94a3b8">Close</button>
</div>

<div class="wrapper">

  <!-- Header -->
  <div style="background:#1e293b;color:white;padding:22px 32px;display:flex;justify-content:space-between;align-items:center;gap:16px">
    <div style="display:flex;align-items:center;gap:14px">
      ${logoHtml}
      <div>
        <div style="font-size:16px;font-weight:700;letter-spacing:-.01em">Bettencourt's Diner</div>
        <div style="font-size:10px;opacity:.65;margin-top:3px;letter-spacing:.03em">Georgetown, Guyana</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">${esc(title)}</div>
      <div style="font-size:12px;margin-top:5px;opacity:.8;letter-spacing:.02em">${esc(period)}</div>
      <div style="font-size:10px;margin-top:3px;opacity:.6">${rows.length} entries</div>
    </div>
  </div>

  <!-- KPI row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:2px solid #e2e8f0">
    <div style="padding:16px 22px;border-right:1px solid #e2e8f0">
      <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-weight:700">Total Spent</div>
      <div style="font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-.02em">${fmtGYD(total)}</div>
    </div>
    <div style="padding:16px 22px;border-right:1px solid #e2e8f0">
      <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-weight:700">Entries</div>
      <div style="font-size:28px;font-weight:800;color:#1e293b">${rows.length}</div>
    </div>
    <div style="padding:16px 22px;border-right:1px solid #e2e8f0">
      <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-weight:700">Top Category</div>
      ${topCat ? `<div style="font-size:12px;font-weight:700;color:${categoryColor(topCat[0])};margin-bottom:2px">${esc(topCat[0])}</div><div style="font-size:11px;color:#64748b">${fmtGYD(topCat[1])}</div>` : '<div style="font-size:13px;color:#94a3b8">—</div>'}
    </div>
    <div style="padding:16px 22px">
      <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-weight:700">Top Supplier</div>
      ${topSup ? `<div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px">${esc(topSup[0])}</div><div style="font-size:11px;color:#64748b">${fmtGYD(topSup[1])}</div>` : '<div style="font-size:13px;color:#94a3b8">—</div>'}
    </div>
  </div>

  <!-- Category breakdown -->
  ${catBreakdown.length > 0 ? `
  <div style="padding:20px 32px;border-bottom:2px solid #e2e8f0">
    <div style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px">Category Breakdown</div>
    ${catBars}
  </div>` : ""}

  <!-- Expense table -->
  <div style="overflow-x:auto">
    <table style="min-width:1050px">
      <colgroup>
        ${showSource ? '<col class="c-source" />' : ''}
        <col class="c-date" /><col class="c-supplier" /><col class="c-cat" />
        <col class="c-desc" /><col class="c-pay" /><col class="c-ref" />
        <col class="c-amt" /><col class="c-auth" />
      </colgroup>
      <thead>
        <tr>
          ${sourceHeader}
          <th style="${TH}">Expense Date</th>
          <th style="${TH}">Supplier</th>
          <th style="${TH}">Category</th>
          <th style="${TH}">Description</th>
          <th style="${TH}">Payment</th>
          <th style="${TH}">Ref #</th>
          <th style="${TH_R}">Amount</th>
          <th style="${TH}">Auth. By</th>
        </tr>
      </thead>
      <tbody>${tableBody}</tbody>
    </table>
  </div>

  <!-- Grand total strip -->
  <div style="padding:14px 24px;display:flex;justify-content:space-between;align-items:center;background:#1e293b;color:white">
    <span style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.8">Grand Total — ${rows.length} transactions</span>
    <span style="font-size:20px;font-weight:800;letter-spacing:-.01em">${fmtGYD(total)}</span>
  </div>

  <!-- Signatures -->
  <div style="padding:24px 32px;display:flex;gap:40px;border-top:1px solid #e2e8f0">
    <div style="flex:1">
      <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:32px">Prepared By</div>
      <div style="border-top:1.5px solid #cbd5e1;padding-top:6px;font-size:11px;color:#64748b">${esc(preparedBy ?? "")}</div>
    </div>
    <div style="flex:1">
      <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:32px">Checked By</div>
      <div style="border-top:1.5px solid #cbd5e1;padding-top:6px;font-size:11px;color:#94a3b8">&nbsp;</div>
    </div>
    <div style="flex:1">
      <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:32px">Authorized By</div>
      <div style="border-top:1.5px solid #cbd5e1;padding-top:6px;font-size:11px;color:#94a3b8">&nbsp;</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:10px 32px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;background:#f8fafc">
    <span>Bettencourt's Food Inc. &nbsp;·&nbsp; Georgetown, Guyana</span>
    <span>Generated: ${esc(generatedAt)}</span>
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
	// Expense date: when the expense actually occurred (user-supplied)
	const expenseDateFmt = new Date(e.expense_date + "T12:00:00").toLocaleDateString("en-GY", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	// Entry date: when the record was entered into the system (audit trail)
	const enteredDateFmt = new Date(e.created_at).toLocaleString("en-GY", {
		timeZone: "America/Guyana",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	} as Intl.DateTimeFormatOptions);

	// Show "Entered" line only when entry date differs from expense date
	const enteredDateGYT = new Date(e.created_at).toLocaleDateString("en-CA", { timeZone: "America/Guyana" });
	const isBackdated = e.expense_date !== enteredDateGYT;
	const enteredLine = isBackdated
		? `<div style="font-size:9px;color:#94a3b8;margin-top:2px">Entered: ${esc(enteredDateFmt)}</div>`
		: "";

	const sourceCell = showSource
		? `<td style="${TD};white-space:nowrap;color:#64748b;font-size:10.5px">${esc(sourceName ?? "")}</td>`
		: "";

	const zebraStyle = "";
	return `<tr style="${zebraStyle}">
    ${sourceCell}
    <td style="${TD};white-space:nowrap;color:#475569">
      <div style="font-weight:600;font-size:11px">${esc(expenseDateFmt)}</div>
      ${enteredLine}
    </td>
    <td style="${TD};max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.supplier_name ?? "")}">${esc(e.supplier_name ?? "—")}</td>
    <td style="${TD};white-space:nowrap">
      <span style="display:inline-flex;align-items:center;background:${color}18;border:1px solid ${color}44;border-radius:12px;padding:2px 8px 2px 6px;gap:5px">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="font-size:10.5px;font-weight:600;color:${color}">${esc(e.category)}</span>
      </span>
    </td>
    <td style="${TD};color:#475569">${formatDescLines(e.description)}</td>
    <td style="${TD};white-space:nowrap;color:#64748b;font-size:10.5px">${esc(fmtPayment(e.payment_method))}</td>
    <td style="${TD};white-space:nowrap;color:#64748b;font-size:10.5px">${esc(e.reference_number ?? "—")}</td>
    <td style="${TD};text-align:right;font-weight:700;white-space:nowrap;color:#1e293b">${fmtGYD(e.amount)}</td>
    <td style="${TD};color:#64748b;white-space:nowrap;font-size:10.5px">${esc(e.authorized_by_name ?? "—")}</td>
  </tr>`;
}
