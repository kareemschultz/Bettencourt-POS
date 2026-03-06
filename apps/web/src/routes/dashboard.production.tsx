import { useQuery } from "@tanstack/react-query";
import { ProductionTracker } from "@/components/production/production-tracker";
import { authClient } from "@/lib/auth-client";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function ProductionPage() {
	const { data: session } = authClient.useSession();
	const today = todayGY();

	const { data: productsData, isLoading: loadingProducts } = useQuery(
		orpc.products.list.queryOptions({ input: {} }),
	);

	const { data: prodData, isLoading: loadingProd } = useQuery(
		orpc.production.getEntries.queryOptions({ input: { date: today } }),
	);

	if (loadingProducts || loadingProd) {
		return (
			<div className="flex items-center justify-center py-20 text-muted-foreground">
				Loading production tracker...
			</div>
		);
	}

	// Map products to the shape expected by ProductionTracker
	const products = (productsData || []).map((p) => ({
		id: p.id,
		name: p.name,
		department_id: p.reportingCategoryId,
		department_name: p.departmentName ?? null,
	}));

	// Map totals from raw SQL rows
	const totals = ((prodData?.totals || []) as Record<string, unknown>[]).map(
		(t) => ({
			product_id: t.product_id as string,
			product_name: t.product_name as string,
			opening: Number(t.opening),
			reorder: Number(t.reorder),
			closing: Number(t.closing),
		}),
	);

	return (
		<ProductionTracker
			products={products}
			initialTotals={totals}
			userId={session?.user?.id || ""}
			userName={session?.user?.name || "User"}
		/>
	);
}
