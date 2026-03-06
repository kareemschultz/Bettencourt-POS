import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { OrdersTable } from "@/components/orders/orders-table";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

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
			<div className="flex items-center justify-center py-20 text-muted-foreground">
				Loading orders...
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
