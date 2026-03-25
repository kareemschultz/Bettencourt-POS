import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JournalPage from "./dashboard.journal";
import PnlPage from "./dashboard.pnl";

export default function FinancialReportsPage() {
	const [activeTab, setActiveTab] = useState("pnl");

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
			<div className="flex items-center justify-between border-b px-4 pt-4 md:px-6">
				<TabsList>
					<TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
					<TabsTrigger value="journal">Sales Journal</TabsTrigger>
				</TabsList>
			</div>
			<TabsContent value="pnl" className="mt-0">
				<PnlPage />
			</TabsContent>
			<TabsContent value="journal" className="mt-0">
				<JournalPage />
			</TabsContent>
		</Tabs>
	);
}
