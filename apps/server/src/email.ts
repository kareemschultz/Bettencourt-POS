import { env } from "@Bettencourt-POS/env/server";
import nodemailer from "nodemailer";

// ── Daily Digest ───────────────────────────────────────────────────────

interface DigestData {
	date: string;
	revenue: string;
	orderCount: number;
	topProducts: Array<{ name: string; qty: number }>;
	expensesTotal: string;
	openInvoicesCount: number;
	openInvoicesTotal: string;
	stockAlertCount: number;
}

export async function sendDailyDigest(
	data: DigestData,
	to: string,
): Promise<void> {
	if (!env.SMTP_HOST) return;

	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		auth: env.SMTP_USER
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
	});

	const fmtGYD = (v: string | number) =>
		new Intl.NumberFormat("en-GY", {
			style: "currency",
			currency: "GYD",
		}).format(Number(v));

	const topRows = data.topProducts
		.map(
			(p) =>
				`<tr><td style="padding:3px 8px">${p.name}</td><td style="padding:3px 8px;text-align:center">${p.qty}</td></tr>`,
		)
		.join("");

	const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:18px">Bettencourt's — Daily Summary</h1>
    <p style="margin:4px 0 0;font-size:12px;opacity:.8">${data.date}</p>
  </div>
  <div style="background:#f9fafb;padding:16px 20px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280">Revenue Today</div>
        <div style="font-size:20px;font-weight:bold;color:#0f766e">${fmtGYD(data.revenue)}</div>
        <div style="font-size:11px;color:#6b7280">${data.orderCount} orders</div>
      </div>
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280">Expenses Today</div>
        <div style="font-size:20px;font-weight:bold;color:#dc2626">${fmtGYD(data.expensesTotal)}</div>
      </div>
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280">Open Invoices</div>
        <div style="font-size:20px;font-weight:bold;color:#7c3aed">${data.openInvoicesCount}</div>
        <div style="font-size:11px;color:#6b7280">${fmtGYD(data.openInvoicesTotal)} outstanding</div>
      </div>
      <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid ${data.stockAlertCount > 0 ? "#f59e0b" : "#e5e7eb"}">
        <div style="font-size:11px;color:#6b7280">Stock Alerts</div>
        <div style="font-size:20px;font-weight:bold;color:${data.stockAlertCount > 0 ? "#d97706" : "#111"}">${data.stockAlertCount}</div>
        <div style="font-size:11px;color:#6b7280">unacknowledged</div>
      </div>
    </div>
    ${
			data.topProducts.length > 0
				? `
    <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #e5e7eb">
      <div style="font-size:11px;font-weight:600;margin-bottom:8px;color:#374151">TOP SELLERS TODAY</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f3f4f6"><th style="padding:3px 8px;text-align:left">Product</th><th style="padding:3px 8px">Qty</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>`
				: ""
		}
    <p style="font-size:11px;color:#9ca3af;margin-top:12px;text-align:center">
      <a href="https://pos.karetechsolutions.com/dashboard" style="color:#0f766e">Open Dashboard →</a>
    </p>
  </div>
</div>`;

	const recipients = to
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	await transporter.sendMail({
		from: env.SMTP_FROM,
		to: recipients.join(", "),
		subject: `[Bettencourt's] Daily Summary — ${data.date}`,
		html,
	});
}

// ── Invoice Email ──────────────────────────────────────────────────────

interface InvoiceEmailData {
	to: string;
	invoiceNumber: string;
	customerName: string;
	issueDate: string;
	dueDate: string;
	items: Array<{
		description: string;
		qty: number;
		unitPrice: string;
		total: string;
	}>;
	subtotal: string;
	taxTotal: string;
	total: string;
	notes?: string | null;
	paymentTerms: string;
	organizationName: string;
}

export async function sendInvoiceEmailMsg(
	data: InvoiceEmailData,
): Promise<void> {
	if (!env.SMTP_HOST) throw new Error("SMTP not configured");

	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		auth: env.SMTP_USER
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
	});

	const fmtGYD = (v: string | number) =>
		new Intl.NumberFormat("en-GY", {
			style: "currency",
			currency: "GYD",
		}).format(Number(v));

	const itemRows = data.items
		.map(
			(item) =>
				`<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #eee">${item.description}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${fmtGYD(item.unitPrice)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${fmtGYD(item.total)}</td>
    </tr>`,
		)
		.join("");

	const html = `
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto">
  <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:18px">${data.organizationName}</h1>
    <p style="margin:4px 0 0;opacity:.8;font-size:13px">Invoice ${data.invoiceNumber}</p>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-top:0">
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <div><b>Bill To:</b><br>${data.customerName}</div>
      <div style="text-align:right">
        <div><b>Issue Date:</b> ${data.issueDate}</div>
        <div><b>Due Date:</b> ${data.dueDate}</div>
        <div><b>Payment Terms:</b> ${data.paymentTerms.replace(/_/g, " ")}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:6px 8px;text-align:left">Description</th>
          <th style="padding:6px 8px;text-align:center">Qty</th>
          <th style="padding:6px 8px;text-align:right">Unit Price</th>
          <th style="padding:6px 8px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:right;font-size:13px">
      <div>Subtotal: ${fmtGYD(data.subtotal)}</div>
      <div>Tax: ${fmtGYD(data.taxTotal)}</div>
      <div style="font-size:16px;font-weight:bold;color:#0f766e;margin-top:4px">Total: ${fmtGYD(data.total)}</div>
    </div>
    ${data.notes ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:4px;font-size:12px"><b>Notes:</b> ${data.notes}</div>` : ""}
    <p style="font-size:11px;color:#9ca3af;margin-top:20px">
      For questions, please contact ${data.organizationName}.
    </p>
  </div>
</div>`;

	await transporter.sendMail({
		from: env.SMTP_FROM,
		to: data.to,
		subject: `Invoice ${data.invoiceNumber} from ${data.organizationName}`,
		html,
	});
}

// ── Overdue Reminder ───────────────────────────────────────────────────

interface OverdueReminderData {
	to: string;
	customerName: string;
	invoiceNumber: string;
	dueDate: string;
	amountOutstanding: string;
	organizationName: string;
}

export async function sendOverdueReminder(
	data: OverdueReminderData,
): Promise<void> {
	if (!env.SMTP_HOST) return;

	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		auth: env.SMTP_USER
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
	});

	const fmtGYD = (v: string | number) =>
		new Intl.NumberFormat("en-GY", {
			style: "currency",
			currency: "GYD",
		}).format(Number(v));

	const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#dc2626;color:#fff;padding:14px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:16px">Payment Reminder — ${data.organizationName}</h1>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-top:0">
    <p>Dear ${data.customerName},</p>
    <p>This is a friendly reminder that invoice <b>${data.invoiceNumber}</b> was due on <b>${data.dueDate}</b> and remains outstanding.</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:16px 0">
      <div style="font-size:11px;color:#6b7280">Amount Outstanding</div>
      <div style="font-size:22px;font-weight:bold;color:#dc2626">${fmtGYD(data.amountOutstanding)}</div>
    </div>
    <p>Please arrange payment at your earliest convenience. If you have already made payment, please disregard this notice.</p>
    <p>Thank you for your business.</p>
    <p>— ${data.organizationName}</p>
  </div>
</div>`;

	await transporter.sendMail({
		from: env.SMTP_FROM,
		to: data.to,
		subject: `Payment Reminder — Invoice ${data.invoiceNumber} from ${data.organizationName}`,
		html,
	});
}

// ── Stock Alert Email ──────────────────────────────────────────────────

interface StockAlertRow {
	itemName: string;
	category: string;
	quantityOnHand: string | number;
	threshold: string | number;
	type: string;
}

export async function sendStockAlertEmail(
	alerts: StockAlertRow[],
): Promise<void> {
	if (!env.SMTP_HOST || !env.SMTP_ALERT_TO) return;
	if (alerts.length === 0) return;

	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		auth: env.SMTP_USER
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
	});

	const statusColor = (type: string) =>
		type === "out_of_stock" ? "#dc2626" : "#d97706";
	const statusLabel = (type: string) =>
		type === "out_of_stock" ? "Out of Stock" : "Low Stock";

	const rows = alerts
		.map(
			(a) =>
				`<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #eee">${a.itemName}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;color:#6b7280">${a.category}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">${Number(a.quantityOnHand)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">${Number(a.threshold)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee">
        <span style="color:${statusColor(a.type)};font-weight:600;font-size:11px">${statusLabel(a.type)}</span>
      </td>
    </tr>`,
		)
		.join("");

	const date = new Date().toLocaleDateString("en-GY", {
		timeZone: "America/Guyana",
	});

	const html = `
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto">
  <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:18px">Bettencourt's — Stock Alerts</h1>
    <p style="margin:4px 0 0;font-size:12px;opacity:.8">${date} &nbsp;&bull;&nbsp; ${alerts.length} unacknowledged alert${alerts.length !== 1 ? "s" : ""}</p>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-top:0">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:6px 8px;text-align:left">Item</th>
          <th style="padding:6px 8px;text-align:left">Category</th>
          <th style="padding:6px 8px;text-align:center">Qty On Hand</th>
          <th style="padding:6px 8px;text-align:center">Threshold</th>
          <th style="padding:6px 8px;text-align:left">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin-top:16px;text-align:center">
      <a href="https://pos.karetechsolutions.com/dashboard/inventory" style="color:#0f766e">Go to Inventory →</a>
    </p>
  </div>
</div>`;

	const recipients = env.SMTP_ALERT_TO.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	await transporter.sendMail({
		from: env.SMTP_FROM,
		to: recipients.join(", "),
		subject: `[Bettencourt's] Stock Alert — ${alerts.length} item${alerts.length !== 1 ? "s" : ""} need attention (${date})`,
		html,
	});
}

// ── Backup Failure Alert ───────────────────────────────────────────────

export async function sendBackupFailureAlert(error: string): Promise<void> {
	if (!env.SMTP_HOST || !env.SMTP_ALERT_TO) {
		console.error("[backup] SMTP not configured — skipping email alert");
		return;
	}
	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		auth: env.SMTP_USER
			? { user: env.SMTP_USER, pass: env.SMTP_PASS }
			: undefined,
	});
	await transporter.sendMail({
		from: env.SMTP_FROM,
		to: env.SMTP_ALERT_TO,
		subject: `[Bettencourt POS] Backup Failed — ${new Date().toLocaleDateString("en-GY", { timeZone: "America/Guyana" })}`,
		text: `The scheduled backup failed at ${new Date().toISOString()}.\n\nError: ${error}\n\nPlease log in to the POS and run a manual backup.`,
	});
}
