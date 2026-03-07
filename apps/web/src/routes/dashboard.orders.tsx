import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { OrdersTable } from "@/components/orders/orders-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
	if (!rows.length) return;
	const headers = Object.keys(rows[0]);
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
					<Skeleton className="h-9 w-24" />
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
	const orders = (data?.orders || []).map((o) => ({
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
