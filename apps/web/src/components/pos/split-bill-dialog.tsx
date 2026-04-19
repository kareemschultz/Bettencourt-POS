import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	DollarSign,
	Loader2,
	Minus,
	Plus,
	ShoppingBasket,
	Split,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface SplitBillDialogProps {
	open: boolean;
	orderId: string;
	orderTotal: number;
	onClose: () => void;
}

export function SplitBillDialog({
	open,
	orderId,
	orderTotal,
	onClose,
}: SplitBillDialogProps) {
	const queryClient = useQueryClient();
	const [tab, setTab] = useState("equal");

	// Equal split state
	const [numberOfWays, setNumberOfWays] = useState(2);

	// By-item split state
	const [itemAssignments, setItemAssignments] = useState<
		Record<string, number>
	>({});
	const [checkCount, setCheckCount] = useState(2);

	// Custom split state
	const [customAmounts, setCustomAmounts] = useState<string[]>(["", ""]);

	// Fetch order split info (line items)
	const { data: splitData } = useQuery({
		...orpc.splitBill.getSplits.queryOptions({ input: { orderId } }),
		enabled: open,
	});

	const lineItems = splitData?.lineItems?.filter((li) => !li.voided) ?? [];

	// Mutations
	const splitEqualMut = useMutation(
		orpc.splitBill.splitEqual.mutationOptions({
			onSuccess: (data) => {
				toast.success(
					`Bill split ${numberOfWays} ways - ${formatGYD(data.perPerson)} each`,
				);
				queryClient.invalidateQueries({
					queryKey: orpc.splitBill.getSplits.queryOptions({
						input: { orderId },
					}).queryKey,
				});
				onClose();
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);

	const splitByItemsMut = useMutation(
		orpc.splitBill.splitByItems.mutationOptions({
			onSuccess: () => {
				toast.success("Bill split by items successfully");
				queryClient.invalidateQueries({
					queryKey: orpc.splitBill.getSplits.queryOptions({
						input: { orderId },
					}).queryKey,
				});
				onClose();
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);

	const splitCustomMut = useMutation(
		orpc.splitBill.splitCustom.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Bill split into ${data.length} custom amounts`);
				queryClient.invalidateQueries({
					queryKey: orpc.splitBill.getSplits.queryOptions({
						input: { orderId },
					}).queryKey,
				});
				onClose();
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);

	// Equal split calculations
	const perPerson = useMemo(() => {
		if (numberOfWays < 2) return orderTotal;
		return Math.floor((orderTotal / numberOfWays) * 100) / 100;
	}, [orderTotal, numberOfWays]);

	const lastPersonAmount = useMemo(() => {
		if (numberOfWays < 2) return orderTotal;
		return (
			Math.round((orderTotal - perPerson * (numberOfWays - 1)) * 100) / 100
		);
	}, [orderTotal, perPerson, numberOfWays]);

	// By-item calculations
	const checkTotals = useMemo(() => {
		const totals = Array.from({ length: checkCount }, () => 0);
		for (const item of lineItems) {
			const checkIdx = itemAssignments[item.id] ?? 0;
			if (checkIdx >= 0 && checkIdx < checkCount) {
				totals[checkIdx] += item.total;
			}
		}
		return totals;
	}, [lineItems, itemAssignments, checkCount]);

	const allItemsAssigned = useMemo(() => {
		return (
			lineItems.length > 0 &&
			lineItems.every((li) => itemAssignments[li.id] !== undefined)
		);
	}, [lineItems, itemAssignments]);

	// Custom split calculations
	const customTotal = useMemo(() => {
		return customAmounts.reduce((sum, amt) => sum + (Number(amt) || 0), 0);
	}, [customAmounts]);

	const customRemaining = orderTotal - customTotal;

	function handleSplitEqual() {
		splitEqualMut.mutate({ orderId, numberOfWays });
	}

	function handleSplitByItems() {
		// Group items by their check assignment
		const groups: Record<number, string[]> = {};
		for (const item of lineItems) {
			const checkIdx = itemAssignments[item.id] ?? 0;
			if (!groups[checkIdx]) groups[checkIdx] = [];
			groups[checkIdx].push(item.id);
		}

		const splits = Object.values(groups).map((items) => ({
			items,
			paymentMethod: "pending",
		}));

		if (splits.length < 2) {
			toast.error("Assign items to at least 2 checks");
			return;
		}

		splitByItemsMut.mutate({ orderId, splits });
	}

	function handleSplitCustom() {
		if (Math.abs(customRemaining) > 0.01) {
			toast.error("Split amounts must equal the order total");
			return;
		}
		const validAmounts = customAmounts.map(Number).filter((a) => a > 0);
		if (validAmounts.length < 2) {
			toast.error("Enter at least 2 split amounts");
			return;
		}
		splitCustomMut.mutate({ orderId, amounts: validAmounts });
	}

	const checkLabels = ["A", "B", "C", "D", "E", "F"];
	const checkColors = [
		"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
		"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
		"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
		"bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
		"bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
	];

	const isProcessing =
		splitEqualMut.isPending ||
		splitByItemsMut.isPending ||
		splitCustomMut.isPending;

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent
				aria-describedby={undefined}
				className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-md"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Split className="size-5" />
						Split Check - {formatGYD(orderTotal)}
					</DialogTitle>
				</DialogHeader>

				<Tabs value={tab} onValueChange={setTab}>
					<TabsList className="w-full">
						<TabsTrigger value="equal" className="flex-1 gap-1">
							<Users className="size-3.5" /> Equal
						</TabsTrigger>
						<TabsTrigger value="items" className="flex-1 gap-1">
							<ShoppingBasket className="size-3.5" /> By Item
						</TabsTrigger>
						<TabsTrigger value="custom" className="flex-1 gap-1">
							<DollarSign className="size-3.5" /> Custom
						</TabsTrigger>
					</TabsList>

					{/* ── Equal Split Tab ─────────────────────────────────── */}
					<TabsContent value="equal" className="space-y-4 pt-2">
						<div className="flex items-center justify-center gap-4">
							<Button
								variant="outline"
								size="icon"
								className="size-10"
								onClick={() => setNumberOfWays(Math.max(2, numberOfWays - 1))}
								disabled={numberOfWays <= 2}
							>
								<Minus className="size-4" />
							</Button>
							<div className="text-center">
								<p className="font-bold text-4xl tabular-nums">
									{numberOfWays}
								</p>
								<p className="text-muted-foreground text-xs">ways</p>
							</div>
							<Button
								variant="outline"
								size="icon"
								className="size-10"
								onClick={() => setNumberOfWays(Math.min(20, numberOfWays + 1))}
								disabled={numberOfWays >= 20}
							>
								<Plus className="size-4" />
							</Button>
						</div>

						<div className="rounded-lg border bg-muted/30 p-4">
							<div className="grid gap-2">
								{Array.from({ length: numberOfWays }, (_, i) => (
									<div
										key={i}
										className="flex items-center justify-between text-sm"
									>
										<span className="text-muted-foreground">
											Person {i + 1}
										</span>
										<span className="font-mono font-semibold">
											{formatGYD(
												i === numberOfWays - 1 ? lastPersonAmount : perPerson,
											)}
										</span>
									</div>
								))}
								<div className="mt-1 flex items-center justify-between border-t pt-2 font-semibold text-sm">
									<span>Total</span>
									<span className="font-mono">{formatGYD(orderTotal)}</span>
								</div>
							</div>
						</div>

						<Button
							className="h-11 w-full"
							onClick={handleSplitEqual}
							disabled={isProcessing}
						>
							{isProcessing ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<Check className="mr-2 size-4" />
							)}
							Split {numberOfWays} Ways
						</Button>
					</TabsContent>

					{/* ── By Item Tab ─────────────────────────────────────── */}
					<TabsContent value="items" className="space-y-4 pt-2">
						<div className="flex items-center gap-2">
							<Label className="text-muted-foreground text-xs">Checks:</Label>
							{[2, 3, 4].map((n) => (
								<Button
									key={n}
									variant={checkCount === n ? "default" : "outline"}
									size="sm"
									className="h-7 px-3 text-xs"
									onClick={() => {
										setCheckCount(n);
										// Reset assignments that exceed new check count
										setItemAssignments((prev) => {
											const next = { ...prev };
											for (const [k, v] of Object.entries(next)) {
												if (v >= n) delete next[k];
											}
											return next;
										});
									}}
								>
									{n}
								</Button>
							))}
						</div>

						<div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border p-2">
							{lineItems.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-sm">
									No items in this order
								</p>
							) : (
								lineItems.map((item) => {
									const assigned = itemAssignments[item.id];
									return (
										<div
											key={item.id}
											className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
										>
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-sm">
													{item.quantity > 1 && (
														<span className="text-muted-foreground">
															{item.quantity}x{" "}
														</span>
													)}
													{item.name}
												</p>
												<p className="font-mono text-muted-foreground text-xs">
													{formatGYD(item.total)}
												</p>
											</div>
											<div className="flex gap-1">
												{Array.from({ length: checkCount }, (_, ci) => (
													<button
														type="button"
														key={ci}
														className={`flex size-7 items-center justify-center rounded-md font-bold text-xs transition-colors ${
															assigned === ci
																? checkColors[ci]
																: "bg-muted/50 text-muted-foreground hover:bg-muted"
														}`}
														onClick={() =>
															setItemAssignments((prev) => ({
																...prev,
																[item.id]: ci,
															}))
														}
													>
														{checkLabels[ci]}
													</button>
												))}
											</div>
										</div>
									);
								})
							)}
						</div>

						{/* Check totals */}
						<div className="rounded-lg border bg-muted/30 p-3">
							<div className="grid gap-1.5">
								{checkTotals.map((total, i) => (
									<div
										key={i}
										className="flex items-center justify-between text-sm"
									>
										<Badge
											variant="outline"
											className={`gap-1 ${checkColors[i]}`}
										>
											Check {checkLabels[i]}
										</Badge>
										<span className="font-mono font-semibold">
											{formatGYD(total)}
										</span>
									</div>
								))}
								<div className="mt-1 flex items-center justify-between border-t pt-2 font-semibold text-sm">
									<span>Total</span>
									<span className="font-mono">
										{formatGYD(checkTotals.reduce((a, b) => a + b, 0))}
									</span>
								</div>
							</div>
						</div>

						<Button
							className="h-11 w-full"
							onClick={handleSplitByItems}
							disabled={isProcessing || !allItemsAssigned}
						>
							{isProcessing ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<Check className="mr-2 size-4" />
							)}
							{allItemsAssigned
								? "Split by Items"
								: "Assign all items to a check"}
						</Button>
					</TabsContent>

					{/* ── Custom Amount Tab ───────────────────────────────── */}
					<TabsContent value="custom" className="space-y-4 pt-2">
						<div className="flex items-center justify-between">
							<Label className="text-muted-foreground text-xs">
								Split entries
							</Label>
							<div className="flex gap-1">
								<Button
									variant="outline"
									size="icon"
									className="size-7"
									disabled={customAmounts.length <= 2}
									onClick={() => setCustomAmounts((prev) => prev.slice(0, -1))}
								>
									<Minus className="size-3" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									className="size-7"
									disabled={customAmounts.length >= 6}
									onClick={() => setCustomAmounts((prev) => [...prev, ""])}
								>
									<Plus className="size-3" />
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							{customAmounts.map((amt, i) => (
								<div key={i} className="flex items-center gap-2">
									<Badge
										variant="outline"
										className={`shrink-0 ${checkColors[i]}`}
									>
										{checkLabels[i]}
									</Badge>
									<Input
										type="number"
										inputMode="numeric"
										step="100"
										value={amt}
										onChange={(e) => {
											setCustomAmounts((prev) => {
												const next = [...prev];
												next[i] = e.target.value;
												return next;
											});
										}}
										placeholder="0"
										className="h-10 text-right font-mono"
									/>
								</div>
							))}
						</div>

						<div className="rounded-lg border bg-muted/30 p-3">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Assigned</span>
								<span className="font-mono font-semibold">
									{formatGYD(customTotal)}
								</span>
							</div>
							<div className="mt-1 flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Remaining</span>
								<span
									className={`font-mono font-semibold ${
										Math.abs(customRemaining) < 0.01
											? "text-green-600 dark:text-green-400"
											: "text-red-600 dark:text-red-400"
									}`}
								>
									{formatGYD(customRemaining)}
								</span>
							</div>
							<div className="mt-1 flex items-center justify-between border-t pt-2 font-semibold text-sm">
								<span>Order Total</span>
								<span className="font-mono">{formatGYD(orderTotal)}</span>
							</div>
						</div>

						<Button
							className="h-11 w-full"
							onClick={handleSplitCustom}
							disabled={isProcessing || Math.abs(customRemaining) > 0.01}
						>
							{isProcessing ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<Check className="mr-2 size-4" />
							)}
							{Math.abs(customRemaining) > 0.01
								? `${formatGYD(Math.abs(customRemaining))} remaining`
								: "Split Custom Amounts"}
						</Button>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
