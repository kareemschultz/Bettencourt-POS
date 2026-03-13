import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export function TabListDialog({
	open,
	onClose,
	onSelectTab,
}: {
	open: boolean;
	onClose: () => void;
	onSelectTab: (tabName: string) => void;
}) {
	const [newTabName, setNewTabName] = useState("");
	const { data: tabs = [] } = useQuery({
		...orpc.orders.listOpenTabs.queryOptions({ input: {} }),
		enabled: open,
	});

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Open / Recall Tab</DialogTitle>
					<DialogDescription>
						Create a new tab name or recall an existing open tab.
					</DialogDescription>
				</DialogHeader>

				<div className="mb-3 flex gap-2">
					<Input
						placeholder="Enter tab name"
						value={newTabName}
						onChange={(e) => setNewTabName(e.target.value)}
					/>
					<Button
						onClick={() => {
							if (!newTabName.trim()) return;
							onSelectTab(newTabName.trim());
							onClose();
							setNewTabName("");
						}}
					>
						<Plus className="mr-1 size-3.5" /> Open
					</Button>
				</div>

				<div className="max-h-72 space-y-2 overflow-auto">
					{tabs.length === 0 ? (
						<p className="text-center text-muted-foreground text-sm">
							No open tabs found
						</p>
					) : (
						tabs.map((tab) => (
							<button
								type="button"
								key={tab.id}
								className="w-full rounded-lg border p-3 text-left hover:bg-muted/50"
								onClick={() => {
									onSelectTab(tab.tabName || `Tab ${tab.orderNumber}`);
									onClose();
								}}
							>
								<div className="flex items-center justify-between">
									<p className="font-medium">{tab.tabName || `Tab ${tab.orderNumber}`}</p>
									<p className="font-mono text-sm">{formatGYD(Number(tab.total || 0))}</p>
								</div>
								<p className="text-muted-foreground text-xs">#{tab.orderNumber}</p>
							</button>
						))
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
