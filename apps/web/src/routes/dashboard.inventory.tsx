import { useSearchParams } from "react-router";
import { PurchaseOrders } from "@/components/inventory/purchase-orders";
import { StockCounts } from "@/components/inventory/stock-counts";
import { StockLedger } from "@/components/inventory/stock-ledger";
import { StockLevels } from "@/components/inventory/stock-levels";
import { TransfersList } from "@/components/inventory/transfers-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InventoryPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const activeTab = searchParams.get("tab") || "stock";
	const setActiveTab = (tab: string) => setSearchParams({ tab });

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="font-bold text-2xl text-foreground tracking-tight">
					Inventory Management
				</h1>
				<p className="text-muted-foreground">
					Track stock levels, manage purchase orders, and perform stock counts.
				</p>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-5 lg:flex lg:w-auto lg:grid-cols-none">
					<TabsTrigger value="stock">Stock Levels</TabsTrigger>
					<TabsTrigger value="ledger">Stock Ledger</TabsTrigger>
					<TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
					<TabsTrigger value="transfers">Transfers</TabsTrigger>
					<TabsTrigger value="counts">Stock Counts</TabsTrigger>
				</TabsList>

				<TabsContent value="stock" className="mt-4">
					<StockLevels />
				</TabsContent>
				<TabsContent value="ledger" className="mt-4">
					<StockLedger />
				</TabsContent>
				<TabsContent value="purchase-orders" className="mt-4">
					<PurchaseOrders />
				</TabsContent>
				<TabsContent value="transfers" className="mt-4">
					<TransfersList />
				</TabsContent>
				<TabsContent value="counts" className="mt-4">
					<StockCounts />
				</TabsContent>
			</Tabs>
		</div>
	);
}
