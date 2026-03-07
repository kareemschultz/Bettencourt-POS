import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { OrdersTable } from "@/components/orders/orders-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

type OrderRow = {
	id: string;
	order_number: string;
	status: string;
	order_type: string;
	total: number;
	user_name?: string;
	customer_name?: string;
	created_at: string;
};

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
	if (!rows.length) return;
	const headers = Object.keys(rows[0]!);
	const csv = [
		headers.join(","),
		...rows.map((r) =>
			headers
				.map((h) => {
					const v = String(r[h] ?? "");
					return v.includes(",") || v.includes('"')
						? `"${v.replace(/"/g, '""')}"`
						: v;
				})
				.join(","),
		),
	].join("\n");
	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function printOrdersPdf(
	orders: OrderRow[],
	filters: { status: string; dateFrom: string; dateTo: string },
) {
	if (!orders.length) return;
	const fmt = (n: number) =>
		new Intl.NumberFormat("en-GY", {
			style: "currency",
			currency: "GYD",
		}).format(n);
	const fmtDT = (d: string) =>
		new Date(d).toLocaleString("en-GY", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});

	const grandTotal = orders.reduce((s, o) => s + o.total, 0);
	const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
		acc[o.status] = (acc[o.status] ?? 0) + o.total;
		return acc;
	}, {});

	const filterDesc = [
		filters.status !== "all" ? `Status: ${filters.status}` : "",
		filters.dateFrom ? `From: ${filters.dateFrom}` : "",
		filters.dateTo ? `To: ${filters.dateTo}` : "",
	]
		.filter(Boolean)
		.join(" · ");

	const statusBg: Record<string, string> = {
		completed: "background:#d1fae5;color:#065f46",
		voided: "background:#fee2e2;color:#991b1b",
		refunded: "background:#dbeafe;color:#1e40af",
		held: "background:#fef9c3;color:#854d0e",
	};

	const itemRows = orders
		.map(
			(o) =>
				`<tr>
  <td>${o.order_number}</td>
  <td>${fmtDT(o.created_at)}</td>
  <td style="text-transform:capitalize">${(o.order_type ?? "").replace("_", " ") || "walk-in"}</td>
  <td>${o.user_name ?? "—"}</td>
  <td>${o.customer_name ?? "—"}</td>
  <td style="text-align:center"><span style="padding:2px 7px;border-radius:3px;font-size:10px;${statusBg[o.status] ?? "background:#f3f4f6;color:#374151"}">${o.status}</span></td>
  <td style="text-align:right;font-weight:600">${fmt(o.total)}</td>
</tr>`,
		)
		.join("");

	const summaryRows = Object.entries(byStatus)
		.map(
			([s, t]) =>
				`<tr><td style="padding:3px 8px;color:#666;text-transform:capitalize">${s}</td><td style="padding:3px 8px;text-align:right">${fmt(t)}</td></tr>`,
		)
		.join("");

	const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Orders Report</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px;max-width:1050px;margin:0 auto}
h1{font-size:18px;margin:0}h2{font-size:11px;margin:14px 0 4px;color:#666;text-transform:uppercase;letter-spacing:.06em}
.meta{color:#666;font-size:11px;margin:4px 0 0}
.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.sbox{background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px}
.sbox .lbl{color:#888;font-size:10px}.sbox .val{font-size:15px;font-weight:700;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:6px}
th{background:#f3f4f6;text-align:left;padding:5px 8px;font-size:10px;border-bottom:2px solid #ddd}
td{padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle}
hr{border:none;border-top:1px solid #e5e7eb;margin:12px 0}
@media print{button{display:none}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1>Orders Report</h1>
    <p class="meta">Bettencourt's Food Inc. &nbsp;|&nbsp; Generated ${new Date().toLocaleString("en-GY")}</p>
    ${filterDesc ? `<p class="meta" style="font-size:10px;color:#aaa">${filterDesc}</p>` : ""}
  </div>
</div>
<hr/>
<div class="summary">
  <div class="sbox"><div class="lbl">Total Orders</div><div class="val">${orders.length}</div></div>
  <div class="sbox"><div class="lbl">Grand Total</div><div class="val">${fmt(grandTotal)}</div></div>
</div>
<h2>By Status</h2>
<table style="max-width:280px"><thead><tr><th>Status</th><th style="text-align:right">Total (GYD)</th></tr></thead><tbody>${summaryRows}</tbody></table>
<h2>All Orders (${orders.length})</h2>
<table>
  <thead><tr><th>Order #</th><th>Date &amp; Time</th><th>Type</th><th>Cashier</th><th>Customer</th><th style="text-align:center">Status</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<button onclick="window.print()" style="margin-top:20px;padding:8px 20px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f9fafb">Print / Save as PDF</button>
</body></html>`;

	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	window.open(url, "_blank");
	setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export default function OrdersPage() {
	const { data: session } = authClient.useSession();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");

	const { data, isLoading } = useQuery(
		orpc.orders.list.queryOptions({
			input: {
				status: statusFilter !== "all" ? statusFilter : undefined,
				startDate: dateFrom || undefined,
				endDate: dateTo || undefined,
				limit: 200,
			},
		}),
	);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4 p-4 md:p-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-32" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-28" />
						<Skeleton className="h-9 w-24" />
					</div>
				</div>
				<div className="flex flex-wrap gap-3">
					<Skeleton className="h-9 w-52" />
					<Skeleton className="h-9 w-44" />
					<Skeleton className="h-9 w-40" />
					<Skeleton className="h-9 w-40" />
					<Skeleton className="h-9 w-40" />
				</div>
				<Skeleton className="h-96 rounded-lg" />
			</div>
		);
	}

	// Map camelCase response to what OrdersTable expects
	const orders: OrderRow[] = (data?.orders || []).map((o) => ({
		id: o.id,
		order_number: o.orderNumber,
		status: o.status,
		order_type: o.type,
		total: Number(o.total),
		created_at:
			o.createdAt instanceof Date
				? o.createdAt.toISOString()
				: String(o.createdAt),
		user_name: o.cashierName ?? undefined,
		customer_name: o.customerName ?? undefined,
	}));

	return (
		<div className="flex flex-col gap-4 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl">Orders</h1>
				<div className="flex gap-2">
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() =>
							printOrdersPdf(orders, {
								status: statusFilter,
								dateFrom,
								dateTo,
							})
						}
					>
						<Printer className="size-4" />
						Print PDF
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="gap-1"
						onClick={() =>
							downloadCsv(
								`orders-${new Date().toISOString().slice(0, 10)}.csv`,
								orders.map((o) => ({
									Order: o.order_number,
									Status: o.status,
									Type: o.order_type,
									Total: o.total,
									Cashier: o.user_name ?? "",
									Customer: o.customer_name ?? "",
									Date: o.created_at,
								})),
							)
						}
					>
						<Download className="size-4" />
						Export
					</Button>
				</div>
			</div>
			<OrdersTable
				orders={orders}
				userId={session?.user?.id}
				userRole="admin"
				search={search}
				onSearchChange={setSearch}
				statusFilter={statusFilter}
				onStatusFilterChange={setStatusFilter}
				dateFrom={dateFrom}
				onDateFromChange={setDateFrom}
				dateTo={dateTo}
				onDateToChange={setDateTo}
			/>
		</div>
	);
}
